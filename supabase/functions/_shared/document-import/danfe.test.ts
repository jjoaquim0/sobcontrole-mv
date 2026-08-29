import { describe, expect, it } from 'vitest';
import { extractDanfeHeader, DanfeParserError } from './danfe.ts';

const EMITTER = '12345678000195';
const ACCESS_KEY_BASE = '352608' + EMITTER + '55001000000123112345678';

const checkDigit = (base: string): string => {
  let weight = 2;
  let sum = 0;
  for (let index = base.length - 1; index >= 0; index -= 1) {
    sum += Number(base[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const digit = 11 - (sum % 11);
  return String(digit === 10 || digit === 11 ? 0 : digit);
};

const ACCESS_KEY = ACCESS_KEY_BASE + checkDigit(ACCESS_KEY_BASE);
const groupedAccessKey = ACCESS_KEY.match(/.{1,4}/g)?.join(' ') || ACCESS_KEY;

const DANFE_TEXT = `CHAVE DE ACESSO: ${groupedAccessKey}
RAZÃO SOCIAL: Fornecedor DANFE Ltda.
CNPJ: ${EMITTER}
VALOR TOTAL DOS PRODUTOS: 1.200,00
DESCONTO: 20,00
FRETE: 15,00
VALOR TOTAL DA NOTA: 1.195,00
PARCELA 001 - 30/09/2026 - R$ 1.195,00
INFORMAÇÕES COMPLEMENTARES: Compra de materiais para escritório.`;

const parserCode = (callback: () => unknown): string => {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(DanfeParserError);
    return (error as DanfeParserError).code;
  }
  throw new Error('expected parser to fail');
};

describe('adapter de DANFE em texto linear', () => {
  it('une chave agrupada, valida o módulo 11 e cria somente o cabeçalho rastreável', () => {
    const proposal = extractDanfeHeader(DANFE_TEXT);

    expect(proposal.idempotency_key).toBe(ACCESS_KEY);
    expect(proposal.text_origin).toBe('client');
    expect(proposal.payload).toEqual({
      supplier: { document: EMITTER, name: 'Fornecedor DANFE Ltda.' },
      purchase: {
        total_amount: 1200,
        discount: 20,
        fee: 15,
        final_value: 1195,
        payment_method: 'other',
        notes: 'Compra de materiais para escritório.',
        installments: [{ amount: 1195, due_date: '2026-09-30T00:00:00Z' }],
      },
    });
    expect(proposal.items).toEqual([]);
    expect(proposal.field_origins['supplier.name']).toEqual({ origin: 'model', source: 'RAZÃO SOCIAL: Fornecedor DANFE Ltda.' });
    expect(proposal.field_origins['purchase.installments[0].amount']).toEqual({ origin: 'model', source: 'PARCELA 001 - 30/09/2026 - R$ 1.195,00' });
  });

  it('distingue ausência de chave, DV adulterado e duas candidatas válidas', () => {
    expect(parserCode(() => extractDanfeHeader('RAZÃO SOCIAL: Fornecedor\nCNPJ: 12345678000195'))).toBe('pdf_access_key_missing');

    const invalidDigit = ACCESS_KEY.endsWith('9') ? '8' : '9';
    expect(parserCode(() => extractDanfeHeader(`CHAVE: ${ACCESS_KEY.slice(0, -1)}${invalidDigit}`))).toBe('pdf_access_key_invalid');

    expect(parserCode(() => extractDanfeHeader(`${ACCESS_KEY}\nCHAVE: ${ACCESS_KEY}`))).toBe('pdf_access_key_ambiguous');
  });

  it('rejeita texto vazio e campos financeiros obrigatórios ausentes', () => {
    expect(parserCode(() => extractDanfeHeader('   \n\t'))).toBe('pdf_text_empty');
    expect(parserCode(() => extractDanfeHeader(`CHAVE: ${ACCESS_KEY}\nRAZÃO SOCIAL: Fornecedor\nCNPJ: ${EMITTER}`))).toBe('pdf_required_field_missing');
    expect(parserCode(() => extractDanfeHeader(`CHAVE: ${ACCESS_KEY}\nRAZÃO SOCIAL: Fornecedor\nCNPJ: ${EMITTER}\nVALOR TOTAL DOS PRODUTOS: ilegível\nVALOR TOTAL DA NOTA: 10,00`))).toBe('pdf_money_invalid');
  });

  it('não interpreta uma data solta como parcela, mas aceita linha numerada de vencimento', () => {
    const proposal = extractDanfeHeader(`${DANFE_TEXT}\nDATA DE EMISSÃO: 01/09/2026`);
    expect(proposal.payload.purchase.installments).toEqual([{ amount: 1195, due_date: '2026-09-30T00:00:00Z' }]);
  });
});
