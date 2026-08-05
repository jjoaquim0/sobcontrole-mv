/**
 * Story 1.32 — Serialização CSV para o contador.
 *
 * Duas decisões definem se o arquivo é usável ou vira retrabalho:
 *
 * 1. BOM UTF-8 no início. Sem ele, o Excel em português lê o arquivo como
 *    ANSI e toda acentuação quebra ("Créditos" vira "CrÃ©ditos").
 * 2. Separador ';'. O Excel em locale PT-BR espera ponto e vírgula; com
 *    vírgula, a planilha inteira cai em uma única coluna.
 *
 * Valores usam vírgula decimal e datas o formato DD/MM/AAAA, coerentes com a
 * localidade — o contador não deveria precisar reformatar nada.
 */

export const CSV_SEPARATOR = ';';
export const UTF8_BOM = '﻿';

export type CsvValue = string | number | boolean | null | undefined;

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => CsvValue;
}

/** Formata número no padrão PT-BR: milhar com ponto, decimal com vírgula. */
export const formatCsvNumber = (value: unknown, fractionDigits = 2): string => {
  // Number(null) e Number('') devolvem 0. Deixar passar transformaria "não
  // informado" em "zero" na planilha do contador — coisas diferentes num
  // relatório financeiro.
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'number' && typeof value !== 'string') return '';

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '';
  return parsed.toFixed(fractionDigits).replace('.', ',');
};

/** Converte ISO (`YYYY-MM-DD` ou timestamp) para `DD/MM/AAAA`. */
export const formatCsvDate = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
};

export const formatCsvMonth = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const match = /^(\d{4})-(\d{2})/.exec(value.trim());
  if (!match) return '';
  return `${match[2]}/${match[1]}`;
};

/**
 * Escapa um campo. Aspas, separador e quebra de linha exigem envolver em aspas
 * duplas, com as aspas internas dobradas.
 *
 * O prefixo de fórmula (`=`, `+`, `-`, `@`) recebe um apóstrofo: sem isso, um
 * nome de produto começando com "=" seria interpretado como fórmula pelo Excel
 * — o vetor clássico de CSV injection.
 */
export const escapeCsvField = (value: CsvValue): string => {
  if (value === null || value === undefined) return '';

  let text = typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value);

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  if (text.includes('"') || text.includes(CSV_SEPARATOR) || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

export const serializeCsv = <T>(rows: T[], columns: CsvColumn<T>[]): string => {
  const header = columns.map((column) => escapeCsvField(column.header)).join(CSV_SEPARATOR);
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvField(column.value(row))).join(CSV_SEPARATOR),
  );
  // CRLF é o que o Excel espera; período vazio ainda produz o cabeçalho.
  return `${UTF8_BOM}${[header, ...body].join('\r\n')}\r\n`;
};

/** Normaliza nome de arquivo para o pacote: sem acento, sem separador de caminho. */
export const normalizeFileName = (value: string, fallback = 'arquivo'): string => {
  const normalized = value
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .replace(/[^\w.\- ]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+|[._]+$/g, '')
    .slice(0, 120);
  return normalized.length > 0 ? normalized : fallback;
};

/** Garante unicidade dentro do pacote, sufixando duplicatas com _1, _2, ... */
export const dedupeFileName = (name: string, taken: Set<string>): string => {
  if (!taken.has(name)) {
    taken.add(name);
    return name;
  }

  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex > 0 ? name.slice(dotIndex) : '';

  let counter = 1;
  let candidate = `${base}_${counter}${extension}`;
  while (taken.has(candidate)) {
    counter += 1;
    candidate = `${base}_${counter}${extension}`;
  }
  taken.add(candidate);
  return candidate;
};
