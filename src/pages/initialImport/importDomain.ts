import { ObligationRecurrence, PostAllocationRole } from '@/types';
import type { PostInput } from '@/services/contractsService';
import type { ObligationTemplateInput } from '@/services/obligationsService';

/** Limite por arquivo: a carga inicial é feita em lotes conferidos (roadmap §10). */
export const MAX_IMPORT_ROWS = 500;

export type ImportKind = 'posts' | 'allocations' | 'obligations';

export const IMPORT_TEMPLATES: Record<ImportKind, { label: string; columns: string[]; example: string[]; help: string }> = {
  posts: {
    label: 'Postos',
    columns: ['contrato', 'posto', 'funcao', 'escala', 'quantidade', 'requisitos'],
    example: ['Portaria', 'Portaria principal', 'Porteiro', '12x36', '2', 'Curso de portaria'],
    help: 'O contrato é encontrado pelo título ou pelo número. Posto com o mesmo nome no contrato é ignorado.',
  },
  allocations: {
    label: 'Alocações',
    columns: ['contrato', 'posto', 'funcionario', 'papel', 'inicio'],
    example: ['Portaria', 'Portaria principal', 'Ana Souza', 'titular', '16/07/2026'],
    help: 'O funcionário precisa estar cadastrado em Pessoas com o nome completo igual. Papel: titular ou substituto.',
  },
  obligations: {
    label: 'Obrigações',
    columns: ['obrigacao', 'contrato', 'recorrencia', 'mes_referencia', 'dia_prazo', 'mes_prazo', 'exige_evidencia', 'descricao'],
    example: ['Folha de ponto', '', 'mensal', '', '5', 'seguinte', 'sim', 'Espelho assinado pelo fiscal'],
    help: 'Contrato em branco vale para todos os contratos ativos. Recorrência: mensal, trimestral ou anual. Mês do prazo: mesmo, seguinte ou dois.',
  },
};

export const templateCsv = (kind: ImportKind) => {
  const template = IMPORT_TEMPLATES[kind];
  return `${template.columns.join(';')}\n${template.example.join(';')}\n`;
};

/** Texto comparável: sem acento, sem caixa e com espaços simples. */
export const normalizeKey = (value: string) => value
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Lê CSV de planilha (Excel em português usa ";", outros usam ","), com aspas,
 * aspas escapadas e quebra de linha dentro de campo.
 */
export const parseCsv = (text: string): string[][] => {
  const source = text.replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length >= (firstLine.match(/,/g) || []).length ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') { field += '"'; index += 1; } else if (char === '"') quoted = false; else field += char;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; } else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[index + 1] === '\n') index += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((cells) => cells.map((cell) => cell.trim())).filter((cells) => cells.some((cell) => cell !== ''));
};

/** Aceita dd/mm/aaaa ou aaaa-mm-dd e devolve ISO, ou undefined se a data não existe. */
export const parseDate = (value: string) => {
  const trimmed = value.trim();
  const br = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parts = br ? [Number(br[3]), Number(br[2]), Number(br[1])] : iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : undefined;
  if (!parts) return undefined;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return date.toISOString().slice(0, 10);
};

export interface ImportReferences {
  contracts: { id: string; title: string; contractNumber?: string; status: string }[];
  posts: { id: string; contractId: string; name: string }[];
  employees: { id: string; fullName: string; status: string }[];
  openAllocations: { postId: string; employeeId: string }[];
  templates: { name: string; contractId?: string }[];
}

export type PlannedAction =
  | { kind: 'post'; contractId: string; input: PostInput }
  | { kind: 'allocation'; postId: string; employeeId: string; allocationRole: PostAllocationRole; startDate: string }
  | { kind: 'obligation'; input: ObligationTemplateInput };

export interface PlannedRow {
  line: number;
  label: string;
  state: 'ready' | 'skip' | 'error';
  message?: string;
  action?: PlannedAction;
}

export interface ImportPlan {
  rows: PlannedRow[];
  headerError?: string;
}

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

const RECURRENCES: Record<string, ObligationRecurrence> = { mensal: 'monthly', trimestral: 'quarterly', anual: 'yearly' };
const OFFSETS: Record<string, number> = { mesmo: 0, '0': 0, seguinte: 1, '1': 1, dois: 2, '2': 2 };
const YES = new Set(['sim', 's', 'yes', '1', 'x']);
const NO = new Set(['nao', 'n', 'no', '0', '']);

const findContract = (refs: ImportReferences, value: string) => {
  const key = normalizeKey(value);
  const matches = refs.contracts.filter((contract) => normalizeKey(contract.title) === key || (contract.contractNumber && normalizeKey(contract.contractNumber) === key));
  return matches.length === 1 ? matches[0] : matches.length > 1 ? 'ambiguous' as const : undefined;
};

/** Confere cabeçalho e linhas sem gravar nada; o usuário vê o plano antes de importar. */
export const planImport = (kind: ImportKind, table: string[][], refs: ImportReferences): ImportPlan => {
  const expected = IMPORT_TEMPLATES[kind].columns;
  const [header = [], ...lines] = table;
  const index = new Map(header.map((column, position) => [normalizeKey(column), position]));
  const required = kind === 'posts' ? expected.slice(0, 5) : kind === 'allocations' ? expected : expected.slice(0, 7);
  const missing = required.filter((column) => !index.has(column));
  if (missing.length) return { rows: [], headerError: `Faltam as colunas: ${missing.join(', ')}. Baixe o modelo e mantenha o cabeçalho.` };
  if (lines.length === 0) return { rows: [], headerError: 'O arquivo não tem linhas depois do cabeçalho.' };
  if (lines.length > MAX_IMPORT_ROWS) return { rows: [], headerError: `Importe até ${MAX_IMPORT_ROWS} linhas por arquivo.` };

  const cell = (cells: string[], column: string) => (cells[index.get(column) ?? -1] || '').trim();
  const seen = new Set<string>();
  const postKeys = new Set(refs.posts.map((post) => `${post.contractId}|${normalizeKey(post.name)}`));
  const templateKeys = new Set(refs.templates.map((template) => `${template.contractId || ''}|${normalizeKey(template.name)}`));
  const allocationKeys = new Set(refs.openAllocations.map((allocation) => `${allocation.postId}|${allocation.employeeId}`));

  const rows = lines.map((cells, position): PlannedRow => {
    const line = position + 2;
    const fail = (label: string, message: string): PlannedRow => ({ line, label, state: 'error', message });
    const skip = (label: string, message: string): PlannedRow => ({ line, label, state: 'skip', message });

    if (kind === 'posts') {
      const label = `${cell(cells, 'posto')} · ${cell(cells, 'contrato')}`;
      const contract = findContract(refs, cell(cells, 'contrato'));
      if (!contract) return fail(label, 'Contrato não encontrado pelo título ou número.');
      if (contract === 'ambiguous') return fail(label, 'Mais de um contrato com este título. Use o número do contrato.');
      const name = cell(cells, 'posto');
      const jobFunction = cell(cells, 'funcao');
      const workSchedule = cell(cells, 'escala');
      const headcount = cell(cells, 'quantidade');
      if (name.length < 2 || jobFunction.length < 2 || workSchedule.length < 2) return fail(label, 'Informe posto, função e escala.');
      if (!/^\d+$/.test(headcount) || Number(headcount) < 1 || Number(headcount) > 500) return fail(label, 'Quantidade deve ser um número de 1 a 500.');
      const key = `${contract.id}|${normalizeKey(name)}`;
      if (postKeys.has(key)) return skip(label, 'Posto já cadastrado neste contrato.');
      if (seen.has(key)) return skip(label, 'Linha repetida no arquivo.');
      seen.add(key);
      return {
        line, label, state: 'ready',
        action: { kind: 'post', contractId: contract.id, input: { name, jobFunction, workSchedule, requiredHeadcount: Number(headcount), requirements: cell(cells, 'requisitos') || undefined, status: 'active' } },
      };
    }

    if (kind === 'allocations') {
      const label = `${cell(cells, 'funcionario')} · ${cell(cells, 'posto')}`;
      const contract = findContract(refs, cell(cells, 'contrato'));
      if (!contract) return fail(label, 'Contrato não encontrado pelo título ou número.');
      if (contract === 'ambiguous') return fail(label, 'Mais de um contrato com este título. Use o número do contrato.');
      const post = refs.posts.find((item) => item.contractId === contract.id && normalizeKey(item.name) === normalizeKey(cell(cells, 'posto')));
      if (!post) return fail(label, 'Posto não encontrado neste contrato. Importe os postos antes.');
      const employees = refs.employees.filter((employee) => employee.status !== 'terminated' && normalizeKey(employee.fullName) === normalizeKey(cell(cells, 'funcionario')));
      if (employees.length === 0) return fail(label, 'Funcionário ativo não encontrado com este nome.');
      if (employees.length > 1) return fail(label, 'Há mais de um funcionário com este nome. Aloque pela tela do contrato.');
      const role = normalizeKey(cell(cells, 'papel'));
      const allocationRole: PostAllocationRole | undefined = role === 'titular' ? 'holder' : role === 'substituto' ? 'substitute' : undefined;
      if (!allocationRole) return fail(label, 'Papel deve ser titular ou substituto.');
      const startDate = parseDate(cell(cells, 'inicio'));
      if (!startDate) return fail(label, 'Data de início inválida. Use dd/mm/aaaa.');
      const key = `${post.id}|${employees[0].id}`;
      if (allocationKeys.has(key)) return skip(label, 'Funcionário já alocado neste posto.');
      if (seen.has(key)) return skip(label, 'Linha repetida no arquivo.');
      seen.add(key);
      return { line, label, state: 'ready', action: { kind: 'allocation', postId: post.id, employeeId: employees[0].id, allocationRole, startDate } };
    }

    const name = cell(cells, 'obrigacao');
    const contractValue = cell(cells, 'contrato');
    const label = `${name}${contractValue ? ` · ${contractValue}` : ''}`;
    if (name.length < 2) return fail(label, 'Informe o nome da obrigação.');
    let contractId: string | undefined;
    if (contractValue) {
      const contract = findContract(refs, contractValue);
      if (!contract) return fail(label, 'Contrato não encontrado pelo título ou número.');
      if (contract === 'ambiguous') return fail(label, 'Mais de um contrato com este título. Use o número do contrato.');
      contractId = contract.id;
    }
    const recurrence = RECURRENCES[normalizeKey(cell(cells, 'recorrencia'))];
    if (!recurrence) return fail(label, 'Recorrência deve ser mensal, trimestral ou anual.');
    const monthValue = normalizeKey(cell(cells, 'mes_referencia'));
    const referenceMonth = /^\d+$/.test(monthValue) ? Number(monthValue) : MONTHS[monthValue];
    if (recurrence !== 'monthly' && !(referenceMonth >= 1 && referenceMonth <= 12)) return fail(label, 'Informe o mês de referência (1 a 12 ou o nome do mês).');
    const dueDay = cell(cells, 'dia_prazo');
    if (!/^\d+$/.test(dueDay) || Number(dueDay) < 1 || Number(dueDay) > 31) return fail(label, 'Dia do prazo deve ser de 1 a 31.');
    const offset = OFFSETS[normalizeKey(cell(cells, 'mes_prazo'))];
    if (offset === undefined) return fail(label, 'Mês do prazo deve ser mesmo, seguinte ou dois.');
    const evidence = normalizeKey(cell(cells, 'exige_evidencia'));
    if (!YES.has(evidence) && !NO.has(evidence)) return fail(label, 'Exige evidência deve ser sim ou não.');
    const key = `${contractId || ''}|${normalizeKey(name)}`;
    if (templateKeys.has(key)) return skip(label, 'Obrigação já cadastrada.');
    if (seen.has(key)) return skip(label, 'Linha repetida no arquivo.');
    seen.add(key);
    return {
      line, label, state: 'ready',
      action: {
        kind: 'obligation',
        input: {
          name, contractId, recurrence, referenceMonth: recurrence === 'monthly' ? undefined : referenceMonth,
          dueDay: Number(dueDay), dueMonthOffset: offset, requiresEvidence: YES.has(evidence),
          description: cell(cells, 'descricao') || undefined, isActive: true,
        },
      },
    };
  });
  return { rows };
};
