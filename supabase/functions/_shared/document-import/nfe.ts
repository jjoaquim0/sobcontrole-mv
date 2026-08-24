export type NfeParserErrorCode =
  | 'nfe_xml_empty'
  | 'nfe_xml_too_large'
  | 'nfe_xml_unsafe'
  | 'nfe_xml_malformed'
  | 'nfe_structure_invalid'
  | 'nfe_ambiguous'
  | 'nfe_version_invalid'
  | 'nfe_model_invalid'
  | 'nfe_required_field_missing'
  | 'nfe_access_key_invalid'
  | 'nfe_access_key_company_mismatch'
  | 'nfe_money_invalid'
  | 'nfe_installment_invalid'
  | 'nfe_saida_nao_suportada'
  | 'nfe_cnpj_suspeito'
  | 'company_cnpj_missing';

export class NfeParserError extends Error {
  readonly code: NfeParserErrorCode;

  constructor(code: NfeParserErrorCode) {
    super(code);
    this.name = 'NfeParserError';
    this.code = code;
  }
}

export interface NfeInstallment {
  amount: number;
  due_date: string;
}

export interface NfeHeaderProposalPayload {
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
    installments: NfeInstallment[];
  };
}

export interface NfeHeaderProposalInput {
  document_category: 'nota_fiscal';
  status: 'pending';
  idempotency_key: string;
  text_origin: null;
  truncated: false;
  payload: NfeHeaderProposalPayload;
  field_origins: Record<string, 'deterministic'>;
}

const MAX_XML_BYTES = 500 * 1024;
const CNPJ_LENGTH = 14;
const MONEY_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

const localName = (element: Element): string => element.localName || element.tagName.split(':').pop() || '';

const directChildren = (element: Element, name: string): Element[] =>
  Array.from(element.children).filter((candidate) => localName(candidate) === name);

const descendants = (element: Element, name: string): Element[] => {
  const result: Element[] = [];

  for (const candidate of Array.from(element.children)) {
    if (localName(candidate) === name) result.push(candidate);
    result.push(...descendants(candidate, name));
  }

  return result;
};

const child = (element: Element, name: string): Element | null =>
  directChildren(element, name)[0] ?? null;

const valueOf = (element: Element | null): string => element?.textContent?.trim() ?? '';

const requiredChildValue = (element: Element, name: string): string => {
  const value = valueOf(child(element, name));
  if (!value) throw new NfeParserError('nfe_required_field_missing');
  return value;
};

const failMoney = (): never => {
  throw new NfeParserError('nfe_money_invalid');
};

const parseMoneyCents = (value: string): bigint => {
  const normalized = value.trim();
  if (!MONEY_PATTERN.test(normalized)) return failMoney();

  const [whole, fraction = ''] = normalized.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER) * 100n) return failMoney();
  return cents;
};

const moneyFromCents = (cents: bigint): number => {
  if (cents < 0n || cents > BigInt(Number.MAX_SAFE_INTEGER) * 100n) return failMoney();
  const value = Number(cents) / 100;
  if (!Number.isFinite(value) || value < 0) return failMoney();
  return value;
};

const requiredMoney = (element: Element, name: string): { cents: bigint; value: number } => {
  const cents = parseMoneyCents(requiredChildValue(element, name));
  return { cents, value: moneyFromCents(cents) };
};

const optionalMoney = (element: Element, name: string): { cents: bigint; value: number } => {
  const node = child(element, name);
  if (!node) return { cents: 0n, value: 0 };
  const cents = parseMoneyCents(valueOf(node));
  return { cents, value: moneyFromCents(cents) };
};

const parseDueDate = (value: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new NfeParserError('nfe_installment_invalid');
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new NfeParserError('nfe_installment_invalid');
  }

  return value;
};

export const normalizeCnpj = (value: string): string => value.replace(/\D/g, '');

const isCnpjShapeValid = (value: string): boolean => normalizeCnpj(value).length === CNPJ_LENGTH;

export const validateNfeAccessKey = (accessKey: string): boolean => {
  if (!/^\d{44}$/.test(accessKey)) return false;

  let weight = 2;
  let sum = 0;
  for (let index = 42; index >= 0; index -= 1) {
    sum += Number(accessKey[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const candidate = 11 - (sum % 11);
  const checkDigit = candidate === 10 || candidate === 11 ? 0 : candidate;
  return checkDigit === Number(accessKey[43]);
};

const parseAccessKey = (id: string): string => {
  const accessKey = id.startsWith('NFe') ? id.slice(3) : id;
  if (!validateNfeAccessKey(accessKey)) {
    throw new NfeParserError('nfe_access_key_invalid');
  }
  if (accessKey.slice(20, 22) !== '55') {
    throw new NfeParserError('nfe_model_invalid');
  }
  return accessKey;
};

const parseXmlDocument = (xml: string): XMLDocument => {
  if (!xml.trim()) throw new NfeParserError('nfe_xml_empty');
  if (new TextEncoder().encode(xml).byteLength > MAX_XML_BYTES) {
    throw new NfeParserError('nfe_xml_too_large');
  }
  if (/<!DOCTYPE\b/i.test(xml) || /<!ENTITY\b/i.test(xml)) {
    throw new NfeParserError('nfe_xml_unsafe');
  }

  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (
    !document.documentElement ||
    localName(document.documentElement) === 'parsererror' ||
    document.getElementsByTagName('parsererror').length > 0
  ) {
    throw new NfeParserError('nfe_xml_malformed');
  }
  return document;
};

const getInfNfe = (document: XMLDocument): Element => {
  const root = document.documentElement;
  const rootName = localName(root);
  let nfe: Element;

  if (rootName === 'NFe') {
    nfe = root;
  } else if (rootName === 'nfeProc') {
    const nfeNodes = directChildren(root, 'NFe');
    if (nfeNodes.length !== 1) throw new NfeParserError('nfe_ambiguous');
    nfe = nfeNodes[0];
  } else {
    throw new NfeParserError('nfe_structure_invalid');
  }

  const infNfeNodes = descendants(nfe, 'infNFe');
  if (infNfeNodes.length !== 1) throw new NfeParserError('nfe_ambiguous');
  return infNfeNodes[0];
};

const publicFieldOrigins = (
  includeEmail: boolean,
  includePhone: boolean,
  installmentCount: number,
): Record<string, 'deterministic'> => {
  const origins: Record<string, 'deterministic'> = {
    'supplier.document': 'deterministic',
    'supplier.name': 'deterministic',
    'purchase.total_amount': 'deterministic',
    'purchase.discount': 'deterministic',
    'purchase.fee': 'deterministic',
    'purchase.final_value': 'deterministic',
    'purchase.payment_method': 'deterministic',
    'purchase.notes': 'deterministic',
    'purchase.installments': 'deterministic',
  };

  if (includeEmail) origins['supplier.email'] = 'deterministic';
  if (includePhone) origins['supplier.phone'] = 'deterministic';
  for (let index = 0; index < installmentCount; index += 1) {
    origins['purchase.installments[' + index + '].amount'] = 'deterministic';
    origins['purchase.installments[' + index + '].due_date'] = 'deterministic';
  }
  return origins;
};

export const extractNfeHeader = (xml: string, companyCnpj: string): NfeHeaderProposalInput => {
  const normalizedCompanyCnpj = normalizeCnpj(companyCnpj);
  if (!isCnpjShapeValid(companyCnpj)) {
    throw new NfeParserError('company_cnpj_missing');
  }

  const document = parseXmlDocument(xml);
  const infNfe = getInfNfe(document);
  if (infNfe.getAttribute('versao') !== '4.00') {
    throw new NfeParserError('nfe_version_invalid');
  }

  const id = infNfe.getAttribute('Id');
  if (!id) throw new NfeParserError('nfe_access_key_invalid');
  const accessKey = parseAccessKey(id);

  const ide = child(infNfe, 'ide');
  const emit = child(infNfe, 'emit');
  const dest = child(infNfe, 'dest');
  const total = child(infNfe, 'total');
  const icmsTotal = total ? child(total, 'ICMSTot') : null;
  if (!ide || !emit || !dest || !icmsTotal) {
    throw new NfeParserError('nfe_required_field_missing');
  }
  if (requiredChildValue(ide, 'mod') !== '55') {
    throw new NfeParserError('nfe_model_invalid');
  }

  const emitCnpj = normalizeCnpj(requiredChildValue(emit, 'CNPJ'));
  const destCnpj = normalizeCnpj(requiredChildValue(dest, 'CNPJ'));
  if (!isCnpjShapeValid(emitCnpj) || !isCnpjShapeValid(destCnpj)) {
    throw new NfeParserError('nfe_cnpj_suspeito');
  }
  if (accessKey.slice(6, 20) !== emitCnpj) {
    throw new NfeParserError('nfe_access_key_company_mismatch');
  }

  const emitterIsCompany = emitCnpj === normalizedCompanyCnpj;
  const recipientIsCompany = destCnpj === normalizedCompanyCnpj;
  if (emitterIsCompany && !recipientIsCompany) {
    throw new NfeParserError('nfe_saida_nao_suportada');
  }
  if (!recipientIsCompany || emitterIsCompany) {
    throw new NfeParserError('nfe_cnpj_suspeito');
  }

  const totalAmount = requiredMoney(icmsTotal, 'vProd');
  const discount = optionalMoney(icmsTotal, 'vDesc');
  const freight = optionalMoney(icmsTotal, 'vFrete');
  const insurance = optionalMoney(icmsTotal, 'vSeg');
  const other = optionalMoney(icmsTotal, 'vOutro');
  const finalValue = requiredMoney(icmsTotal, 'vNF');
  const installments: NfeInstallment[] = [];
  const billing = child(infNfe, 'cobr');

  for (const duplicate of billing ? directChildren(billing, 'dup') : []) {
    const amount = requiredMoney(duplicate, 'vDup');
    if (amount.cents <= 0n) throw new NfeParserError('nfe_installment_invalid');
    const dueDate = parseDueDate(requiredChildValue(duplicate, 'dVenc'));
    installments.push({
      amount: amount.value,
      due_date: dueDate + 'T00:00:00Z',
    });
  }

  const email = valueOf(child(emit, 'email'));
  const address = child(emit, 'enderEmit');
  const phone = valueOf(address ? child(address, 'fone') : null);
  const supplier = {
    document: emitCnpj,
    name: requiredChildValue(emit, 'xNome'),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  };

  return {
    document_category: 'nota_fiscal',
    status: 'pending',
    idempotency_key: accessKey,
    text_origin: null,
    truncated: false,
    payload: {
      supplier,
      purchase: {
        total_amount: totalAmount.value,
        discount: discount.value,
        fee: moneyFromCents(freight.cents + insurance.cents + other.cents),
        final_value: finalValue.value,
        payment_method: 'other',
        notes: '',
        installments,
      },
    },
    field_origins: publicFieldOrigins(Boolean(email), Boolean(phone), installments.length),
  };
};
