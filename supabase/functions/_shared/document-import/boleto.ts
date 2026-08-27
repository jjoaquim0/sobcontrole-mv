export type BoletoParserErrorCode =
  | 'boleto_line_empty'
  | 'boleto_line_length_invalid'
  | 'boleto_field_1_dv_invalid'
  | 'boleto_field_2_dv_invalid'
  | 'boleto_field_3_dv_invalid'
  | 'boleto_currency_invalid'
  | 'boleto_general_dv_invalid'
  | 'boleto_due_date_ambiguous';

export class BoletoParserError extends Error {
  readonly code: BoletoParserErrorCode;

  constructor(code: BoletoParserErrorCode) {
    super(code);
    this.name = 'BoletoParserError';
    this.code = code;
  }
}

export interface BoletoPayableProposalPayload {
  amount: number;
  due_date: string;
}

export interface BoletoProposalPayload {
  supplier: {
    document: string;
    name: string;
  };
  payable: BoletoPayableProposalPayload;
}

export interface BoletoProposalInput {
  document_category: 'boleto';
  status: 'pending';
  idempotency_key: string;
  text_origin: null;
  truncated: false;
  payload: BoletoProposalPayload;
  field_origins: Record<string, 'deterministic' | 'manual'>;
  items: [];
}

export interface BoletoDueDateCandidates {
  original: string;
  reiniciada: string;
  selected: string;
}

export interface BoletoDecodedLine {
  line: string;
  barcode: string;
  factor: number;
  amount: number;
  dueDates: BoletoDueDateCandidates;
}

const ORIGINAL_BASE_DATE = [1997, 9, 7] as const;
const RESTARTED_BASE_DATE = [2025, 1, 22] as const;
const PAST_WINDOW_DAYS = 730;
const FUTURE_WINDOW_DAYS = 1825;

export const normalizeBoletoLine = (value: string): string => value.replace(/[^0-9]/g, '');

export const calculateBoletoMod10Digit = (data: string): string => {
  let sum = 0;
  let weight = 2;

  for (let index = data.length - 1; index >= 0; index -= 1) {
    const product = Number(data[index]) * weight;
    sum += product > 9 ? product - 9 : product;
    weight = weight === 2 ? 1 : 2;
  }

  return String((10 - (sum % 10)) % 10);
};

export const calculateBoletoMod11Remainder = (data: string): number => {
  let sum = 0;
  let weight = 2;

  for (let index = data.length - 1; index >= 0; index -= 1) {
    sum += Number(data[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  return sum % 11;
};

export const calculateBoletoMod11Digit = (data: string): string => {
  const remainder = calculateBoletoMod11Remainder(data);
  return [0, 1, 10].includes(remainder) ? '1' : String(11 - remainder);
};

const addUtcDays = (baseDate: readonly [number, number, number], days: number): Date => {
  const date = new Date(Date.UTC(baseDate[0], baseDate[1], baseDate[2]));
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const utcDateText = (date: Date): string => `${date.toISOString().slice(0, 10)}T00:00:00Z`;

const amountFromCents = (amountCents: bigint): number => {
  const whole = Number(amountCents / 100n);
  const cents = Number(amountCents % 100n);
  return whole + cents / 100;
};

const asUtcDate = (referenceDate: Date): Date => {
  if (Number.isNaN(referenceDate.getTime())) throw new BoletoParserError('boleto_due_date_ambiguous');
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()));
};

const selectDueDate = (factor: number, referenceDate: Date): BoletoDueDateCandidates => {
  const reference = asUtcDate(referenceDate);
  const windowStart = new Date(reference);
  windowStart.setUTCDate(windowStart.getUTCDate() - PAST_WINDOW_DAYS);
  const windowEnd = new Date(reference);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + FUTURE_WINDOW_DAYS);
  const originalDate = addUtcDays(ORIGINAL_BASE_DATE, factor);
  const restartedDate = addUtcDays(RESTARTED_BASE_DATE, factor - 1000);
  const originalInWindow = originalDate >= windowStart && originalDate <= windowEnd;
  const restartedInWindow = restartedDate >= windowStart && restartedDate <= windowEnd;

  if (originalInWindow === restartedInWindow) {
    throw new BoletoParserError('boleto_due_date_ambiguous');
  }

  return {
    original: utcDateText(originalDate),
    reiniciada: utcDateText(restartedDate),
    selected: utcDateText(originalInWindow ? originalDate : restartedDate),
  };
};

const rebuildBarcode = (line: string): string => {
  const field1Data = line.slice(0, 9);
  const field2Data = line.slice(10, 20);
  const field3Data = line.slice(21, 31);
  const generalDigit = line[32];
  const factorAndAmount = line.slice(33, 47);

  return field1Data.slice(0, 4) + generalDigit + factorAndAmount + field1Data.slice(4) + field2Data + field3Data;
};

export const decodeBoletoDigitableLine = (
  value: string,
  referenceDate = new Date(),
): BoletoDecodedLine => {
  const line = normalizeBoletoLine(value);
  if (!line) throw new BoletoParserError('boleto_line_empty');
  if (line.length !== 47) throw new BoletoParserError('boleto_line_length_invalid');

  const fields = [
    { data: line.slice(0, 9), digit: line[9], code: 'boleto_field_1_dv_invalid' as const },
    { data: line.slice(10, 20), digit: line[20], code: 'boleto_field_2_dv_invalid' as const },
    { data: line.slice(21, 31), digit: line[31], code: 'boleto_field_3_dv_invalid' as const },
  ];
  for (const field of fields) {
    if (calculateBoletoMod10Digit(field.data) !== field.digit) {
      throw new BoletoParserError(field.code);
    }
  }

  const barcode = rebuildBarcode(line);
  if (barcode[3] !== '9') throw new BoletoParserError('boleto_currency_invalid');
  const generalDigit = calculateBoletoMod11Digit(barcode.slice(0, 4) + barcode.slice(5));
  if (generalDigit !== barcode[4]) throw new BoletoParserError('boleto_general_dv_invalid');

  const factor = Number(barcode.slice(5, 9));
  const amountCents = BigInt(barcode.slice(9, 19));
  const dueDates = selectDueDate(factor, referenceDate);

  return {
    line,
    barcode,
    factor,
    amount: amountFromCents(amountCents),
    dueDates,
  };
};

export const extractBoletoProposal = (
  value: string,
  referenceDate = new Date(),
): BoletoProposalInput => {
  const decoded = decodeBoletoDigitableLine(value, referenceDate);
  return {
    document_category: 'boleto',
    status: 'pending',
    idempotency_key: decoded.line,
    text_origin: null,
    truncated: false,
    payload: {
      supplier: { document: '', name: '' },
      payable: {
        amount: decoded.amount,
        due_date: decoded.dueDates.selected,
      },
    },
    field_origins: {
      'supplier.document': 'manual',
      'supplier.name': 'manual',
      'payable.amount': 'deterministic',
      'payable.due_date': 'deterministic',
    },
    items: [],
  };
};
