import { describe, expect, it } from 'vitest';
import {
  calculateBoletoMod11Digit,
  calculateBoletoMod11Remainder,
  decodeBoletoDigitableLine,
  extractBoletoProposal,
} from '../../supabase/functions/_shared/document-import/boleto.ts';

const REFERENCE_DATE = new Date('2026-08-26T12:00:00Z');
const FIXTURE_A = '00190000090001234000605678901231599260000025000';
const FIXTURE_B = '34190000090009876000212345678903110210000123456';

const replaceDigit = (value: string, index: number): string => {
  const nextDigit = String((Number(value[index]) + 1) % 10);
  return value.slice(0, index) + nextDigit + value.slice(index + 1);
};

const expectParserCode = (line: string, code: string): void => {
  expect(() => decodeBoletoDigitableLine(line, REFERENCE_DATE)).toThrowError(
    expect.objectContaining({ code }),
  );
};

describe('parser determinístico de boleto por linha digitável', () => {
  it('normaliza somente separadores e exige exatamente 47 dígitos', () => {
    expect(decodeBoletoDigitableLine('00190.00009 00012.340006 05678.901231 5 99260000025000', REFERENCE_DATE).line).toBe(FIXTURE_A);
    expectParserCode('', 'boleto_line_empty');
    expectParserCode(FIXTURE_A.slice(0, -1), 'boleto_line_length_invalid');
    expectParserCode(replaceDigit(FIXTURE_A, 0).slice(0, 46) + 'O', 'boleto_line_length_invalid');
  });

  it('valida cada DV de módulo 10 de forma independente', () => {
    expectParserCode(replaceDigit(FIXTURE_A, 0), 'boleto_field_1_dv_invalid');
    expectParserCode(replaceDigit(FIXTURE_A, 10), 'boleto_field_2_dv_invalid');
    expectParserCode(replaceDigit(FIXTURE_A, 21), 'boleto_field_3_dv_invalid');
  });

  it('reconstrói exatamente os códigos de barras e valida o DV geral', () => {
    expect(decodeBoletoDigitableLine(FIXTURE_A, REFERENCE_DATE).barcode).toBe('00195992600000250000000000012340000567890123');
    expect(decodeBoletoDigitableLine(FIXTURE_B, REFERENCE_DATE).barcode).toBe('34191102100001234560000000098760001234567890');

    const tamperedGeneralDigit = FIXTURE_A[32] === '0' ? '1' : '0';
    expectParserCode(FIXTURE_A.slice(0, 32) + tamperedGeneralDigit + FIXTURE_A.slice(33), 'boleto_general_dv_invalid');
  });

  it('trata os restos 0, 1 e 10 do módulo 11 como DV 1', () => {
    const remainderZero = '0'.repeat(43);
    const remainderOne = '0'.repeat(41) + '40';
    const remainderTen = '0'.repeat(42) + '5';

    expect(calculateBoletoMod11Remainder(remainderZero)).toBe(0);
    expect(calculateBoletoMod11Remainder(remainderOne)).toBe(1);
    expect(calculateBoletoMod11Remainder(remainderTen)).toBe(10);
    expect(calculateBoletoMod11Digit(remainderZero)).toBe('1');
    expect(calculateBoletoMod11Digit(remainderOne)).toBe('1');
    expect(calculateBoletoMod11Digit(remainderTen)).toBe('1');
  });

  it('decodifica a Fixture A na era original com data e valor exatos', () => {
    const decoded = decodeBoletoDigitableLine(FIXTURE_A, REFERENCE_DATE);

    expect(decoded.factor).toBe(9926);
    expect(decoded.amount).toBe(250);
    expect(decoded.dueDates.original).toBe('2024-12-10T00:00:00Z');
    expect(decoded.dueDates.reiniciada).toBe('2049-08-01T00:00:00Z');
    expect(decoded.dueDates.selected).toBe('2024-12-10T00:00:00Z');
  });

  it('decodifica a Fixture B na era reiniciada com data e valor exatos', () => {
    const decoded = decodeBoletoDigitableLine(FIXTURE_B, REFERENCE_DATE);

    expect(decoded.factor).toBe(1021);
    expect(decoded.amount).toBe(1234.56);
    expect(decoded.dueDates.original).toBe('2000-07-24T00:00:00Z');
    expect(decoded.dueDates.reiniciada).toBe('2025-03-15T00:00:00Z');
    expect(decoded.dueDates.selected).toBe('2025-03-15T00:00:00Z');
  });

  it('produz payload de proposta sem texto e com origem explícita', () => {
    const proposal = extractBoletoProposal(FIXTURE_B, REFERENCE_DATE);

    expect(proposal).toMatchObject({
      document_category: 'boleto',
      status: 'pending',
      idempotency_key: FIXTURE_B,
      text_origin: null,
      truncated: false,
      payload: {
        supplier: { document: '', name: '' },
        payable: { amount: 1234.56, due_date: '2025-03-15T00:00:00Z' },
      },
      field_origins: {
        'supplier.document': 'manual',
        'supplier.name': 'manual',
        'payable.amount': 'deterministic',
        'payable.due_date': 'deterministic',
      },
      items: [],
    });
  });
});
