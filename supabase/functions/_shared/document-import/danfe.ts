import { validateNfeAccessKey } from './nfe.ts';

export type DanfeParserErrorCode =
  | 'pdf_text_empty'
  | 'pdf_access_key_missing'
  | 'pdf_access_key_invalid'
  | 'pdf_access_key_ambiguous'
  | 'pdf_required_field_missing'
  | 'pdf_money_invalid'
  | 'pdf_installment_invalid';

export class DanfeParserError extends Error {
  readonly code: DanfeParserErrorCode;

  constructor(code: DanfeParserErrorCode) {
    super(code);
    this.name = 'DanfeParserError';
    this.code = code;
  }
}

export interface DanfeInstallment {
  amount: number;
  due_date: string;
}

export interface DanfeFieldOrigin {
  origin: 'model';
  source: string;
}

export interface DanfeProposalInput {
  document_category: 'nota_fiscal';
  status: 'pending';
  idempotency_key: string;
  text_origin: 'client';
  truncated: false;
  payload: {
    supplier: {
      document: string;
      name: string;
      email?: string;
      phone?: string;
    };
    purchase: {
      total_amount: number;
      discount: number;
      fee: number;
      final_value: number;
      payment_method: 'other';
      notes: string;
      installments: DanfeInstallment[];
    };
  };
  field_origins: Record<string, DanfeFieldOrigin>;
  items: [];
}

const stripAccents = (value: string): string => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase();

const linesOf = (text: string): string[] => text
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const normalizedDigits = (value: string): string => value.replace(/\D/g, '');

const sourceOrigin = (source: string, fallback: string): DanfeFieldOrigin => ({
  origin: 'model',
  source: source.trim() || fallback,
});

const findLine = (lines: string[], labels: string[]): string | undefined => {
  const normalizedLabels = labels.map(stripAccents);
  return lines.find((line) => {
    const normalized = stripAccents(line);
    return normalizedLabels.some((label) => normalized.includes(label));
  });
};

const valueAfterLabel = (line: string, labels: string[]): string => {
  const normalizedLine = stripAccents(line);
  const normalizedLabel = labels
    .map(stripAccents)
    .sort((left, right) => right.length - left.length)
    .find((label) => normalizedLine.includes(label));
  if (!normalizedLabel) return '';

  const colon = line.indexOf(':');
  if (colon >= 0) return line.slice(colon + 1).trim();

  const labelIndex = normalizedLine.indexOf(normalizedLabel);
  return line.slice(Math.min(line.length, labelIndex + normalizedLabel.length))
    .replace(/^[\s|\-–—]+/, '')
    .trim();
};

const valueFromLineOrNext = (lines: string[], labels: string[]): { value: string; source: string } => {
  const index = lines.findIndex((line) => labels.some((label) => stripAccents(line).includes(stripAccents(label))));
  if (index < 0) return { value: '', source: '' };

  const line = lines[index];
  const inline = valueAfterLabel(line, labels);
  if (inline) return { value: inline, source: line };
  const next = lines[index + 1] || '';
  return { value: next, source: next ? `${line} ${next}` : line };
};

const extractCnpj = (lines: string[]): { value: string; source: string } => {
  const line = findLine(lines, ['CNPJ']);
  if (!line) return { value: '', source: '' };
  const digits = normalizedDigits(valueAfterLabel(line, ['CNPJ']) || line);
  return digits.length >= 14
    ? { value: digits.slice(0, 14), source: line }
    : { value: '', source: line };
};

const parseMoney = (value: string): number | null => {
  const token = value.match(/(?:\d{1,3}(?:\.\d{3})+|\d+)(?:[,.]\d{1,2})?/g)?.pop();
  if (!token) return null;
  const normalized = token.includes(',')
    ? token.replace(/\./g, '').replace(',', '.')
    : token.split('.').length > 2
      ? token.replace(/\./g, '')
      : token;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
};

const moneyFromLabels = (lines: string[], labels: string[], required: boolean): { value: number; source: string } => {
  const line = findLine(lines, labels);
  if (!line) {
    if (required) throw new DanfeParserError('pdf_required_field_missing');
    return { value: 0, source: '' };
  }
  const value = parseMoney(valueAfterLabel(line, labels) || line);
  if (value === null) throw new DanfeParserError('pdf_money_invalid');
  return { value, source: line || '' };
};

const parseDate = (value: string): string | null => {
  const match = value.match(/\b(\d{2})[/.-](\d{2})[/.-](\d{4})\b|\b(\d{4})[/.-](\d{2})[/.-](\d{2})\b/);
  if (!match) return null;
  const year = Number(match[4] || match[3]);
  const month = Number(match[5] || match[2]);
  const day = Number(match[6] || match[1]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`;
};

const findAccessKey = (text: string, lines: string[]): { value: string; source: string } => {
  const digits = normalizedDigits(text);
  const candidates = new Set<string>();
  for (let index = 0; index <= digits.length - 44; index += 1) {
    const candidate = digits.slice(index, index + 44);
    if (candidate.slice(20, 22) === '55' && validateNfeAccessKey(candidate)) candidates.add(candidate);
  }

  if (candidates.size > 1) throw new DanfeParserError('pdf_access_key_ambiguous');
  if (candidates.size === 0) {
    throw new DanfeParserError(digits.length < 44 ? 'pdf_access_key_missing' : 'pdf_access_key_invalid');
  }

  const value = [...candidates][0];
  const source = findLine(lines, ['CHAVE DE ACESSO', 'CHAVE']) || `Chave de acesso ${value}`;
  return { value, source };
};

const extractInstallments = (lines: string[]): { value: DanfeInstallment[]; sourceByIndex: string[] } => {
  const installments: DanfeInstallment[] = [];
  const sourceByIndex: string[] = [];
  for (const line of lines) {
    const dueDate = parseDate(line);
    if (!dueDate) continue;
    const normalized = stripAccents(line);
    const isInstallmentLine = /DUPLICATA|PARCELA|VENCIMENTO/.test(normalized)
      || /^\d{1,3}\s+(?:[-|]\s*)?(?=\d{2}[/.-]|\d{4}[/.-])/.test(line);
    if (!isInstallmentLine) continue;
    const amount = parseMoney(line.replace(/\b\d{2}[/.-]\d{2}[/.-]\d{4}\b|\b\d{4}[/.-]\d{2}[/.-]\d{2}\b/, ''));
    if (amount === null || amount <= 0) throw new DanfeParserError('pdf_installment_invalid');
    installments.push({ amount, due_date: dueDate });
    sourceByIndex.push(line);
  }
  return { value: installments, sourceByIndex };
};

export const extractDanfeHeader = (text: string): DanfeProposalInput => {
  if (!text.trim()) throw new DanfeParserError('pdf_text_empty');
  const lines = linesOf(text);
  const accessKey = findAccessKey(text, lines);
  const cnpj = extractCnpj(lines);
  const name = valueFromLineOrNext(lines, ['RAZAO SOCIAL', 'NOME / RAZAO SOCIAL', 'FORNECEDOR', 'EMITENTE']);
  const supplierName = name.value.trim();
  if (!cnpj.value || cnpj.value.length !== 14 || !supplierName) {
    throw new DanfeParserError('pdf_required_field_missing');
  }

  const total = moneyFromLabels(lines, ['VALOR TOTAL DOS PRODUTOS', 'TOTAL DOS PRODUTOS'], true);
  const discount = moneyFromLabels(lines, ['DESCONTO'], false);
  const freight = moneyFromLabels(lines, ['VALOR DO FRETE', 'FRETE'], false);
  const insurance = moneyFromLabels(lines, ['VALOR DO SEGURO', 'SEGURO'], false);
  const other = moneyFromLabels(lines, ['OUTRAS DESPESAS ACESSORIAS', 'OUTRAS DESPESAS'], false);
  const finalValue = moneyFromLabels(lines, ['VALOR TOTAL DA NOTA', 'VALOR DA NOTA'], true);
  const notes = valueFromLineOrNext(lines, ['INFORMACOES COMPLEMENTARES', 'OBSERVACOES', 'INFORMACOES ADICIONAIS']);
  const installments = extractInstallments(lines);
  const email = valueFromLineOrNext(lines, ['E-MAIL', 'EMAIL']).value.trim();
  const phone = valueFromLineOrNext(lines, ['FONE', 'TELEFONE']).value.trim();
  const feeSource = [freight.source, insurance.source, other.source].filter(Boolean).join(' | ');

  const fieldOrigins: Record<string, DanfeFieldOrigin> = {
    'supplier.document': sourceOrigin(cnpj.source, cnpj.value),
    'supplier.name': sourceOrigin(name.source, supplierName),
    'purchase.total_amount': sourceOrigin(total.source, String(total.value)),
    'purchase.discount': sourceOrigin(discount.source, String(discount.value)),
    'purchase.fee': sourceOrigin(feeSource, String(freight.value + insurance.value + other.value)),
    'purchase.final_value': sourceOrigin(finalValue.source, String(finalValue.value)),
    'purchase.payment_method': sourceOrigin('Forma de pagamento não informada no DANFE; usando outro.', 'outro'),
    'purchase.notes': sourceOrigin(notes.source, 'Sem observações no DANFE.'),
    'purchase.installments': sourceOrigin(installments.sourceByIndex.join(' | '), 'Parcelas não identificadas no DANFE.'),
  };
  if (email) fieldOrigins['supplier.email'] = sourceOrigin(email, email);
  if (phone) fieldOrigins['supplier.phone'] = sourceOrigin(phone, phone);
  installments.sourceByIndex.forEach((source, index) => {
    fieldOrigins[`purchase.installments[${index}].amount`] = sourceOrigin(source, String(installments.value[index].amount));
    fieldOrigins[`purchase.installments[${index}].due_date`] = sourceOrigin(source, installments.value[index].due_date);
  });

  return {
    document_category: 'nota_fiscal',
    status: 'pending',
    idempotency_key: accessKey.value,
    text_origin: 'client',
    truncated: false,
    payload: {
      supplier: {
        document: cnpj.value,
        name: supplierName,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
      },
      purchase: {
        total_amount: total.value,
        discount: discount.value,
        fee: freight.value + insurance.value + other.value,
        final_value: finalValue.value,
        payment_method: 'other',
        notes: notes.value,
        installments: installments.value,
      },
    },
    field_origins: fieldOrigins,
    items: [],
  };
};
