import { describe, expect, it } from 'vitest';
import {
  extractNfeHeader,
  NfeParserError,
  validateNfeAccessKey,
} from '../../supabase/functions/_shared/document-import/nfe.ts';

const EMITTER = '12345678000195';
const RECIPIENT = '99888777000166';
const OTHER_COMPANY = '44555666000177';
const XML_NS = 'http://www.portalfiscal.inf.br/nfe';

const calculateCheckDigit = (base: string): string => {
  let weight = 2;
  let sum = 0;
  for (let index = base.length - 1; index >= 0; index -= 1) {
    sum += Number(base[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const candidate = 11 - (sum % 11);
  return String(candidate === 10 || candidate === 11 ? 0 : candidate);
};

const createAccessKey = (cnpj: string, model = '55'): string => {
  const base = '35' + '2608' + cnpj + model + '001' + '000000123' + '1' + '12345678';
  return base + calculateCheckDigit(base);
};

interface XmlOptions {
  accessKey?: string;
  model?: string;
  version?: string;
  emitter?: string;
  recipient?: string;
  idAttribute?: string | null;
  vProd?: string;
  vDesc?: string;
  vFrete?: string;
  vSeg?: string;
  vOutro?: string;
  vNF?: string;
  duplicate?: string;
  duplicateAmount?: string;
  includeDetail?: boolean;
  details?: string;
}

const createXml = (options: XmlOptions = {}): string => {
  const model = options.model ?? '55';
  const accessKey = options.accessKey ?? createAccessKey(options.emitter ?? EMITTER, model);
  const id = options.idAttribute === null ? '' : options.idAttribute ?? 'NFe' + accessKey;
  const duplicate = options.duplicate
    ? '<cobr><dup><nDup>001</nDup><dVenc>' + options.duplicate +
      '</dVenc><vDup>' + (options.duplicateAmount ?? '100.50') + '</vDup></dup></cobr>'
    : '';
  const detail = options.includeDetail
    ? '<det nItem="1"><prod><cProd>SKU-1</cProd><cEAN>7891234567890</cEAN><xProd>Produto</xProd><uCom>UN</uCom><qCom>1</qCom><vUnCom>999.99</vUnCom><vProd>999.99</vProd></prod></det>'
    : '';

  return '<NFe xmlns="' + XML_NS + '"><infNFe versao="' +
    (options.version ?? '4.00') + (id ? '" Id="' + id + '">' : '">') +
    '<ide><cUF>35</cUF><mod>' + model +
    '</mod><serie>1</serie><nNF>123</nNF><dhEmi>2026-08-22T10:00:00-03:00</dhEmi></ide>' +
    '<emit><CNPJ>' + (options.emitter ?? EMITTER) +
    '</CNPJ><xNome>Fornecedor Teste</xNome><email>fiscal@example.com</email><enderEmit><fone>11999990000</fone></enderEmit></emit>' +
    '<dest><CNPJ>' + (options.recipient ?? RECIPIENT) +
    '</CNPJ><xNome>Empresa Compradora</xNome></dest>' +
    '<total><ICMSTot><vProd>' + (options.vProd ?? '1234.50') +
    '</vProd><vDesc>' + (options.vDesc ?? '12.34') +
    '</vDesc><vFrete>' + (options.vFrete ?? '1.00') +
    '</vFrete><vSeg>' + (options.vSeg ?? '2.00') +
    '</vSeg><vOutro>' + (options.vOutro ?? '3.00') +
    '</vOutro><vNF>' + (options.vNF ?? '1228.16') +
    '</vNF></ICMSTot></total>' + duplicate + (options.details ?? detail) + '</infNFe></NFe>';
};

const createPrefixedProcXml = (): string => {
  let nfe = createXml({ duplicate: '2026-09-30' });
  for (const tag of [
    'NFe', 'infNFe', 'ide', 'mod', 'emit', 'CNPJ', 'xNome', 'email',
    'enderEmit', 'fone', 'dest', 'total', 'ICMSTot', 'vProd', 'vDesc',
    'vFrete', 'vSeg', 'vOutro', 'vNF', 'cobr', 'dup', 'nDup', 'dVenc', 'vDup',
  ]) {
    nfe = nfe.replaceAll('<' + tag, '<n:' + tag).replaceAll('</' + tag, '</n:' + tag);
  }
  nfe = nfe.replace('<n:NFe xmlns="' + XML_NS + '">', '<n:NFe xmlns:n="' + XML_NS + '">');
  return '<nfeProc xmlns:n="' + XML_NS + '">' + nfe + '</nfeProc>';
};

const expectParserCode = (xml: string, company: string, code: string): void => {
  try {
    extractNfeHeader(xml, company);
    throw new Error('expected parser to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(NfeParserError);
    expect((error as NfeParserError).code).toBe(code);
  }
};

describe('extractNfeHeader', () => {
  it('extrai cabecalho, totais, fornecedor e parcela de XML valido', () => {
    const result = extractNfeHeader(
      createXml({ duplicate: '2026-09-30', includeDetail: true }),
      RECIPIENT,
    );

    expect(result.document_category).toBe('nota_fiscal');
    expect(result.status).toBe('pending');
    expect(result.idempotency_key).toBe(createAccessKey(EMITTER));
    expect(result.text_origin).toBeNull();
    expect(result.truncated).toBe(false);
    expect(result.payload).toEqual({
      supplier: {
        document: EMITTER,
        name: 'Fornecedor Teste',
        email: 'fiscal@example.com',
        phone: '11999990000',
      },
      purchase: {
        total_amount: 1234.5,
        discount: 12.34,
        fee: 6,
        final_value: 1228.16,
        payment_method: 'other',
        notes: '',
        installments: [{ amount: 100.5, due_date: '2026-09-30T00:00:00Z' }],
      },
      item_count: 1,
    });
    expect(result.items).toEqual([expect.objectContaining({
      position: 0,
      payload: {
        quantity: 1,
        document_unit_cost: 999.99,
        barcode: '7891234567890',
        sku: 'SKU-1',
        new_product_name: 'Produto',
        new_product_unit: 'Unidade',
      },
      field_origins: {
        quantity: 'deterministic',
        document_unit_cost: 'deterministic',
        barcode: 'deterministic',
        sku: 'deterministic',
        new_product_name: 'deterministic',
        new_product_unit: 'deterministic',
      },
      matched_product_id: null,
      current_cost: null,
      document_cost: 999.99,
      update_cost_decision: 'pending',
    })]);
    expect(result.field_origins['supplier.document']).toBe('deterministic');
    expect(result.field_origins['purchase.installments[0].amount']).toBe('deterministic');
    expect(result.payload as unknown as Record<string, unknown>).not.toHaveProperty('det');
  });

  it('aceita chave sem o prefixo literal NFe', () => {
    const key = createAccessKey(EMITTER);
    expect(extractNfeHeader(createXml({ idAttribute: key }), RECIPIENT).idempotency_key).toBe(key);
  });

  it('aceita nfeProc e elementos com namespace prefixado', () => {
    const result = extractNfeHeader(createPrefixedProcXml(), RECIPIENT);
    expect(result.payload.supplier.document).toBe(EMITTER);
    expect(result.payload.purchase.installments).toHaveLength(1);
  });

  it('produz o mesmo resultado nas quatro combinacoes de envelope e namespace', () => {
    const defaultNfe = createXml({ duplicate: '2026-09-30' });
    const defaultProc = '<nfeProc xmlns="' + XML_NS + '">' + defaultNfe + '</nfeProc>';
    const prefixedProc = createPrefixedProcXml();
    const prefixedNfe = prefixedProc
      .replace('<nfeProc xmlns:n="' + XML_NS + '">', '')
      .replace('</nfeProc>', '');
    const expected = extractNfeHeader(defaultNfe, RECIPIENT);

    expect(extractNfeHeader(defaultProc, RECIPIENT)).toEqual(expected);
    expect(extractNfeHeader(prefixedNfe, RECIPIENT)).toEqual(expected);
    expect(extractNfeHeader(prefixedProc, RECIPIENT)).toEqual(expected);
  });

  it('rejeita XML vazio', () => expectParserCode('', RECIPIENT, 'nfe_xml_empty'));

  it('rejeita XML maior que 500 KB', () =>
    expectParserCode('<NFe>' + 'x'.repeat(500 * 1024) + '</NFe>', RECIPIENT, 'nfe_xml_too_large'));

  it('rejeita DOCTYPE', () => expectParserCode('<!DOCTYPE NFe><NFe />', RECIPIENT, 'nfe_xml_unsafe'));

  it('rejeita ENTITY', () => expectParserCode('<!ENTITY x "unsafe"><NFe />', RECIPIENT, 'nfe_xml_unsafe'));

  it('rejeita XML malformado', () =>
    expectParserCode('<NFe><infNFe></NFe>', RECIPIENT, 'nfe_xml_malformed'));

  it('rejeita mais de uma infNFe', () => {
    const xml = createXml().replace(
      '</infNFe>',
      '<infNFe versao="4.00" Id="x"></infNFe></infNFe>',
    );
    expectParserCode(xml, RECIPIENT, 'nfe_ambiguous');
  });

  it('rejeita raiz que nao seja NFe ou nfeProc', () =>
    expectParserCode('<root />', RECIPIENT, 'nfe_structure_invalid'));

  it('rejeita versao diferente de 4.00', () =>
    expectParserCode(createXml({ version: '3.10' }), RECIPIENT, 'nfe_version_invalid'));

  it('rejeita modelo divergente na chave', () =>
    expectParserCode(createXml({ model: '65' }), RECIPIENT, 'nfe_model_invalid'));

  it('rejeita Id ausente', () =>
    expectParserCode(createXml({ idAttribute: null }), RECIPIENT, 'nfe_access_key_invalid'));

  it('rejeita chave com comprimento ou digitos invalidos', () => {
    expectParserCode(createXml({ accessKey: '1'.repeat(44) }), RECIPIENT, 'nfe_access_key_invalid');
    expect(validateNfeAccessKey('1'.repeat(44))).toBe(false);
  });

  it('rejeita chave com digito verificador adulterado', () => {
    const key = createAccessKey(EMITTER);
    const tampered = key.slice(0, -1) + (key.endsWith('0') ? '1' : '0');
    expectParserCode(createXml({ accessKey: tampered }), RECIPIENT, 'nfe_access_key_invalid');
  });

  it('rejeita chave cujo CNPJ embutido diverge do emitente', () =>
    expectParserCode(
      createXml({ accessKey: createAccessKey(OTHER_COMPANY) }),
      RECIPIENT,
      'nfe_access_key_company_mismatch',
    ));

  it('rejeita NF-e de saida', () =>
    expectParserCode(
      createXml({ emitter: RECIPIENT, recipient: OTHER_COMPANY }),
      RECIPIENT,
      'nfe_saida_nao_suportada',
    ));

  it('rejeita quando a empresa nao e nem emitente nem destinataria', () =>
    expectParserCode(
      createXml({ recipient: OTHER_COMPANY }),
      RECIPIENT,
      'nfe_cnpj_suspeito',
    ));

  it('rejeita quando a empresa e simultaneamente emitente e destinataria', () =>
    expectParserCode(
      createXml({ emitter: RECIPIENT, recipient: RECIPIENT }),
      RECIPIENT,
      'nfe_cnpj_suspeito',
    ));

  it('rejeita CNPJ da empresa ausente ou com forma invalida', () =>
    expectParserCode(createXml(), '123', 'company_cnpj_missing'));

  it('rejeita campos estruturais obrigatorios ausentes', () =>
    expectParserCode(
      createXml().replace('<xNome>Fornecedor Teste</xNome>', ''),
      RECIPIENT,
      'nfe_required_field_missing',
    ));

  it('rejeita valor monetario negativo', () =>
    expectParserCode(createXml({ vProd: '-1.00' }), RECIPIENT, 'nfe_money_invalid'));

  it('rejeita valor monetario com mais de duas casas', () =>
    expectParserCode(createXml({ vNF: '1228.161' }), RECIPIENT, 'nfe_money_invalid'));

  it('rejeita parcela com vencimento impossivel', () =>
    expectParserCode(createXml({ duplicate: '2026-02-30' }), RECIPIENT, 'nfe_installment_invalid'));

  it('rejeita parcela com valor zero', () =>
    expectParserCode(
      createXml({ duplicate: '2026-09-30', duplicateAmount: '0' }),
      RECIPIENT,
      'nfe_installment_invalid',
    ));

  it('mapeia multiplas duplicatas e preserva os itens determinísticos', () => {
    const xml = createXml({ duplicate: '2026-09-30', includeDetail: true }).replace(
      '</cobr>',
      '<dup><nDup>002</nDup><dVenc>2026-10-30</dVenc><vDup>200.00</vDup></dup></cobr>',
    );
    const result = extractNfeHeader(xml, RECIPIENT);

    expect(result.payload.purchase.installments).toEqual([
      { amount: 100.5, due_date: '2026-09-30T00:00:00Z' },
      { amount: 200, due_date: '2026-10-30T00:00:00Z' },
    ]);
    expect(result.items).toHaveLength(1);
  });

  it('extrai zero itens sem bloquear o cabeçalho', () => {
    const result = extractNfeHeader(createXml(), RECIPIENT);
    expect(result.items).toEqual([]);
    expect(result.payload).not.toHaveProperty('item_count');
  });

  it('preserva a ordem de vários det e ignora cEAN ausente ou SEM GTIN', () => {
    const details = [
      '<det nItem="2"><prod><cProd>A-2</cProd><xProd>Segundo</xProd><uCom>KG</uCom><qCom>2.500</qCom><vUnCom>4.25</vUnCom><cEAN>SEM GTIN</cEAN></prod></det>',
      '<det nItem="1"><prod><cProd>A-1</cProd><xProd>Primeiro</xProd><uCom>CX</uCom><qCom>3</qCom><vUnCom>10.00</vUnCom></prod></det>',
    ].join('');
    const result = extractNfeHeader(createXml({ details }), RECIPIENT);

    expect(result.items.map((item) => [item.position, item.payload.new_product_name, item.payload.quantity])).toEqual([
      [0, 'Segundo', 2.5],
      [1, 'Primeiro', 3],
    ]);
    expect(result.items[0].payload).not.toHaveProperty('barcode');
    expect(result.items[1].payload).not.toHaveProperty('barcode');
    expect(result.items[0].payload.new_product_unit).toBe('Kg');
    expect(result.items[1].payload.new_product_unit).toBe('Caixa');
  });

  it('marca unidade desconhecida e rejeita quantidade/custo inválidos', () => {
    const unknownUnit = extractNfeHeader(createXml({
      details: '<det><prod><cProd>A</cProd><xProd>Produto especial</xProd><uCom>PC</uCom><qCom>1</qCom><vUnCom>2.3456</vUnCom></prod></det>',
    }), RECIPIENT);
    expect(unknownUnit.items[0].payload).toMatchObject({ new_product_unit: 'Unidade', source_unit_code: 'PC' });
    expect(unknownUnit.items[0].field_origins.source_unit_code).toBe('deterministic');

    expectParserCode(createXml({ details: '<det><prod><cProd>A</cProd><xProd>Produto</xProd><uCom>UN</uCom><qCom>0</qCom><vUnCom>1</vUnCom></prod></det>' }), RECIPIENT, 'nfe_item_invalid');
    expectParserCode(createXml({ details: '<det><prod><cProd>A</cProd><xProd>Produto</xProd><uCom>UN</uCom><qCom>1</qCom><vUnCom>abc</vUnCom></prod></det>' }), RECIPIENT, 'nfe_item_invalid');
  });

  it('usa defaults e lista vazia quando cobr nao existe', () => {
    const result = extractNfeHeader(
      createXml({ vDesc: '0', vFrete: '0', vSeg: '0', vOutro: '0' }),
      RECIPIENT,
    );
    expect(result.payload.purchase.installments).toEqual([]);
    expect(result.payload.purchase.discount).toBe(0);
    expect(result.payload.purchase.fee).toBe(0);
  });
});
