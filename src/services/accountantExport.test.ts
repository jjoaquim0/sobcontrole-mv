import { describe, expect, it } from 'vitest';
import {
  CSV_SEPARATOR,
  UTF8_BOM,
  dedupeFileName,
  escapeCsvField,
  formatCsvDate,
  formatCsvMonth,
  formatCsvNumber,
  normalizeFileName,
  serializeCsv,
} from '../../supabase/functions/_shared/tax/csv.ts';
import { crc32, createZip } from '../../supabase/functions/_shared/tax/zip.ts';

describe('serializeCsv — compatibilidade com Excel em português', () => {
  it('começa com BOM UTF-8, sem o qual a acentuação quebra no Excel', () => {
    const csv = serializeCsv([{ nome: 'Créditos' }], [
      { header: 'Nome', value: (row) => row.nome },
    ]);

    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    expect(csv).toContain('Créditos');
  });

  it('usa ponto e vírgula como separador', () => {
    const csv = serializeCsv([{ a: '1', b: '2' }], [
      { header: 'A', value: (row) => row.a },
      { header: 'B', value: (row) => row.b },
    ]);

    expect(CSV_SEPARATOR).toBe(';');
    expect(csv).toContain('A;B');
    expect(csv).toContain('1;2');
  });

  it('produz cabeçalho mesmo com período sem movimento', () => {
    const csv = serializeCsv([], [{ header: 'Data', value: () => '' }]);
    expect(csv).toBe(`${UTF8_BOM}Data\r\n`);
  });

  it('usa CRLF como quebra de linha', () => {
    const csv = serializeCsv([{ a: '1' }], [{ header: 'A', value: (row) => row.a }]);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv.split('\r\n')).toHaveLength(3);
  });
});

describe('escapeCsvField', () => {
  it('envolve em aspas quando há separador, aspas ou quebra de linha', () => {
    expect(escapeCsvField('Produto; especial')).toBe('"Produto; especial"');
    expect(escapeCsvField('Diz "olá"')).toBe('"Diz ""olá"""');
    expect(escapeCsvField('linha1\nlinha2')).toBe('"linha1\nlinha2"');
  });

  it('neutraliza injeção de fórmula no Excel', () => {
    // Um produto chamado "=1+1" não pode virar fórmula na planilha do contador.
    expect(escapeCsvField('=1+1')).toBe("'=1+1");
    expect(escapeCsvField('+SOMA(A1)')).toBe("'+SOMA(A1)");
    expect(escapeCsvField('-2')).toBe("'-2");
    expect(escapeCsvField('@import')).toBe("'@import");
  });

  it('converte nulo e indefinido em campo vazio', () => {
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('traduz booleano para Sim/Não', () => {
    expect(escapeCsvField(true)).toBe('Sim');
    expect(escapeCsvField(false)).toBe('Não');
  });
});

describe('formatadores PT-BR', () => {
  it('usa vírgula decimal', () => {
    expect(formatCsvNumber(1234.5)).toBe('1234,50');
    expect(formatCsvNumber(0)).toBe('0,00');
    expect(formatCsvNumber(3.14159, 4)).toBe('3,1416');
  });

  it('devolve vazio para valor não numérico', () => {
    expect(formatCsvNumber('abc')).toBe('');
    expect(formatCsvNumber(null)).toBe('');
    expect(formatCsvNumber(Number.NaN)).toBe('');
  });

  it('formata data como DD/MM/AAAA', () => {
    expect(formatCsvDate('2026-08-02')).toBe('02/08/2026');
    expect(formatCsvDate('2026-08-02T13:45:00.000Z')).toBe('02/08/2026');
    expect(formatCsvDate('02/08/2026')).toBe('');
    expect(formatCsvDate(null)).toBe('');
  });

  it('formata competência como MM/AAAA', () => {
    expect(formatCsvMonth('2026-08')).toBe('08/2026');
    expect(formatCsvMonth('2026-08-01')).toBe('08/2026');
  });
});

describe('nomes de arquivo no pacote', () => {
  it('remove acento e caractere de caminho', () => {
    expect(normalizeFileName('Nota Fiscal Março/2026.pdf')).toBe('Nota_Fiscal_Marco_2026.pdf');
    expect(normalizeFileName('../../etc/passwd')).toBe('etc_passwd');
  });

  it('devolve fallback quando não sobra nada utilizável', () => {
    expect(normalizeFileName('...', 'documento')).toBe('documento');
    expect(normalizeFileName('')).toBe('arquivo');
  });

  it('desduplica preservando a extensão', () => {
    const taken = new Set<string>();
    expect(dedupeFileName('nota.pdf', taken)).toBe('nota.pdf');
    expect(dedupeFileName('nota.pdf', taken)).toBe('nota_1.pdf');
    expect(dedupeFileName('nota.pdf', taken)).toBe('nota_2.pdf');
  });
});

describe('createZip', () => {
  const encoder = new TextEncoder();

  it('gera assinatura de ZIP válida', () => {
    const zip = createZip([{ name: 'a.txt', data: encoder.encode('conteudo') }]);
    // 'PK\x03\x04' — local file header.
    expect([zip[0], zip[1], zip[2], zip[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('fecha com o end of central directory', () => {
    const zip = createZip([{ name: 'a.txt', data: encoder.encode('x') }]);
    const tail = zip.slice(zip.length - 22, zip.length - 18);
    expect([...tail]).toEqual([0x50, 0x4b, 0x05, 0x06]);
  });

  it('registra a contagem correta de entradas', () => {
    const zip = createZip([
      { name: 'a.txt', data: encoder.encode('1') },
      { name: 'b.txt', data: encoder.encode('2') },
      { name: 'documentos/c.txt', data: encoder.encode('3') },
    ]);
    // Total de entradas fica no offset -14 do fim (2 bytes, little endian).
    const count = zip[zip.length - 14] | (zip[zip.length - 13] << 8);
    expect(count).toBe(3);
  });

  it('preserva o conteúdo sem compressão', () => {
    const payload = 'apuração;123,45';
    const zip = createZip([{ name: 'a.csv', data: encoder.encode(payload) }]);
    const text = new TextDecoder().decode(zip);
    expect(text).toContain(payload);
  });

  it('produz saída determinística com a mesma entrada', () => {
    const entries = [{ name: 'a.txt', data: encoder.encode('estavel') }];
    expect(createZip(entries)).toEqual(createZip(entries));
  });

  it('aceita pacote vazio sem quebrar', () => {
    const zip = createZip([]);
    expect(zip.length).toBe(22);
  });

  it('calcula CRC32 conforme o valor de referência', () => {
    // Valor canônico de CRC32("123456789").
    expect(crc32(encoder.encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});
