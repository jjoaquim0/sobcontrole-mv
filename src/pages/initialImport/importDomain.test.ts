import { describe, expect, it } from 'vitest';
import { ImportReferences, normalizeKey, parseCsv, parseDate, planImport, templateCsv } from './importDomain';

const refs: ImportReferences = {
  contracts: [
    { id: 'c1', title: 'Portaria', contractNumber: '12/2026', status: 'active' },
    { id: 'c2', title: 'Limpeza', status: 'active' },
    { id: 'c3', title: 'Limpeza', status: 'draft' },
  ],
  posts: [{ id: 'p1', contractId: 'c1', name: 'Portaria principal' }],
  employees: [
    { id: 'e1', fullName: 'Ana Souza', status: 'active' },
    { id: 'e2', fullName: 'José Lima', status: 'active' },
    { id: 'e3', fullName: 'José Lima', status: 'active' },
    { id: 'e4', fullName: 'Caio Reis', status: 'terminated' },
  ],
  openAllocations: [{ postId: 'p1', employeeId: 'e1' }],
  templates: [{ name: 'Folha de ponto' }],
};

describe('parseCsv', () => {
  it('lê ponto e vírgula, aspas, BOM e linhas vazias', () => {
    expect(parseCsv('\uFEFFa;b;c\n1;"x; y";"diz ""oi"""\r\n\n2;;3\n')).toEqual([['a', 'b', 'c'], ['1', 'x; y', 'diz "oi"'], ['2', '', '3']]);
    expect(parseCsv('a,b\n"linha\nquebrada",2')).toEqual([['a', 'b'], ['linha\nquebrada', '2']]);
  });

  it('normaliza texto e datas', () => {
    expect(normalizeKey('  JOSÉ   Lima ')).toBe('jose lima');
    expect(parseDate('16/07/2026')).toBe('2026-07-16');
    expect(parseDate('2026-07-16')).toBe('2026-07-16');
    expect(parseDate('31/02/2026')).toBeUndefined();
    expect(parseDate('julho')).toBeUndefined();
  });

  it('gera o modelo com o cabeçalho esperado', () => {
    expect(templateCsv('posts').split('\n')[0]).toBe('contrato;posto;funcao;escala;quantidade;requisitos');
  });
});

describe('planImport', () => {
  it('recusa cabeçalho incompleto', () => {
    expect(planImport('posts', [['contrato', 'posto']], refs).headerError).toContain('Faltam as colunas: funcao, escala, quantidade');
  });

  it('confere postos', () => {
    const plan = planImport('posts', parseCsv([
      'contrato;posto;funcao;escala;quantidade',
      '12/2026;Guarita;Vigia;12x36;1',
      'Portaria;portaria PRINCIPAL;Porteiro;12x36;2',
      'Limpeza;Copa;Copeira;44h;1',
      'Inexistente;X;Y;Z;1',
      'Portaria;Guarita;Vigia;12x36;1',
      'Portaria;Ronda;Vigia;12x36;0',
    ].join('\n')), refs);
    expect(plan.rows.map((row) => [row.line, row.state])).toEqual([[2, 'ready'], [3, 'skip'], [4, 'error'], [5, 'error'], [6, 'skip'], [7, 'error']]);
    expect(plan.rows[0].action).toEqual({ kind: 'post', contractId: 'c1', input: { name: 'Guarita', jobFunction: 'Vigia', workSchedule: '12x36', requiredHeadcount: 1, requirements: undefined, status: 'active' } });
    expect(plan.rows[2].message).toContain('número do contrato');
  });

  it('confere alocações', () => {
    const plan = planImport('allocations', parseCsv([
      'contrato;posto;funcionario;papel;inicio',
      'Portaria;Portaria principal;Ana Souza;titular;01/08/2026',
      'Portaria;Portaria principal;jose lima;substituto;01/08/2026',
      'Portaria;Portaria principal;Caio Reis;titular;01/08/2026',
      'Portaria;Portaria principal;Maria;titular;01/08/2026',
      'Portaria;Guarita;Ana Souza;titular;01/08/2026',
    ].join('\n')), { ...refs, employees: [...refs.employees, { id: 'e5', fullName: 'Maria', status: 'active' }], openAllocations: [] });
    expect(plan.rows.map((row) => row.state)).toEqual(['ready', 'error', 'error', 'ready', 'error']);
    expect(plan.rows[1].message).toContain('mais de um funcionário');
    expect(plan.rows[4].message).toContain('Importe os postos antes');
    expect(plan.rows[3].action).toEqual({ kind: 'allocation', postId: 'p1', employeeId: 'e5', allocationRole: 'holder', startDate: '2026-08-01' });
    expect(planImport('allocations', parseCsv('contrato;posto;funcionario;papel;inicio\nPortaria;Portaria principal;Ana Souza;titular;01/08/2026'), refs).rows[0].state).toBe('skip');
  });

  it('confere obrigações', () => {
    const plan = planImport('obligations', parseCsv([
      'obrigacao;contrato;recorrencia;mes_referencia;dia_prazo;mes_prazo;exige_evidencia;descricao',
      'Guias FGTS;Portaria;mensal;;20;seguinte;sim;Guia paga',
      'Relatório;;trimestral;março;10;seguinte;não;',
      'Folha de ponto;;mensal;;5;seguinte;sim;',
      'Certidão;;anual;;10;mesmo;sim;',
      'Ofício;;semanal;;10;mesmo;sim;',
    ].join('\n')), refs);
    expect(plan.rows.map((row) => row.state)).toEqual(['ready', 'ready', 'skip', 'error', 'error']);
    expect(plan.rows[1].action).toEqual({ kind: 'obligation', input: { name: 'Relatório', contractId: undefined, recurrence: 'quarterly', referenceMonth: 3, dueDay: 10, dueMonthOffset: 1, requiresEvidence: false, description: undefined, isActive: true } });
  });
});
