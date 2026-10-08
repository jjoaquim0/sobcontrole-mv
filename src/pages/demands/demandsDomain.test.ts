import { describe, expect, it } from 'vitest';
import { DemandStage } from '@/types';
import { assignSchema, demandSchema, demandTypeSchema, evidenceSchema } from './demandSchemas';
import { checkTransition, describeDue, getDueState, getNextStage, getPreviousStages, sortDemandsForBoard } from './demandsDomain';

const TODAY = '2026-10-08';

const stage = (id: string, category: DemandStage['category'], position: number, isActive = true): DemandStage => ({
  id, typeId: 't1', name: id, category, position, isActive,
});
const stages = [
  stage('abertura', 'intake', 1),
  stage('triagem', 'triage', 2),
  stage('execucao', 'execution', 3),
  stage('autorizacao', 'triage', 4, false),
  stage('conferencia', 'review', 5),
  stage('encerramento', 'done', 6),
];
const demand = (overrides: Partial<Parameters<typeof checkTransition>[0]> = {}) => ({
  stageId: 'abertura', status: 'open' as const, responsibleId: 'resp', approverId: 'aprov', ...overrides,
});

describe('getDueState', () => {
  it('marca vencido, vence hoje e futuro somente para demanda aberta', () => {
    expect(getDueState({ dueDate: '2026-10-07', status: 'open' }, TODAY)).toBe('overdue');
    expect(getDueState({ dueDate: TODAY, status: 'open' }, TODAY)).toBe('due_today');
    expect(getDueState({ dueDate: '2026-10-09', status: 'open' }, TODAY)).toBe('upcoming');
    expect(getDueState({ status: 'open' }, TODAY)).toBe('none');
    expect(getDueState({ dueDate: '2026-10-01', status: 'closed' }, TODAY)).toBe('finished');
  });

  it('descreve o prazo para o cartão', () => {
    expect(describeDue({ dueDate: '2026-10-05', status: 'open' }, TODAY)).toBe('Atrasada há 3 dia(s)');
    expect(describeDue({ dueDate: TODAY, status: 'open' }, TODAY)).toBe('Vence hoje');
    expect(describeDue({ dueDate: '2026-10-10', status: 'open' }, TODAY)).toBe('Vence em 2 dia(s)');
    expect(describeDue({ status: 'open' }, TODAY)).toBe('Sem prazo');
  });
});

describe('sortDemandsForBoard', () => {
  it('coloca atrasadas e as que vencem hoje no topo, depois prioridade', () => {
    const sorted = sortDemandsForBoard([
      { demandNumber: 1, dueDate: '2026-12-01', status: 'open' as const, priority: 'urgent' as const },
      { demandNumber: 2, dueDate: TODAY, status: 'open' as const, priority: 'low' as const },
      { demandNumber: 3, dueDate: '2026-10-01', status: 'open' as const, priority: 'low' as const },
      { demandNumber: 4, status: 'open' as const, priority: 'high' as const },
    ], TODAY);
    expect(sorted.map((item) => item.demandNumber)).toEqual([3, 2, 1, 4]);
  });
});

describe('checkTransition', () => {
  it('avança uma etapa por vez e aponta a próxima', () => {
    expect(checkTransition(demand(), stages, 'triagem', 'resp')).toMatchObject({ allowed: true, direction: 'forward' });
    expect(checkTransition(demand(), stages, 'execucao', 'resp')).toEqual({ allowed: false, reason: 'Avance uma etapa por vez. A próxima etapa é "triagem".' });
  });

  it('pula etapas desativadas', () => {
    expect(getNextStage(stages, 'execucao')?.id).toBe('conferencia');
    expect(checkTransition(demand({ stageId: 'execucao' }), stages, 'conferencia', 'resp')).toMatchObject({ allowed: true });
  });

  it('exige responsável para executar e aprovador para conferir', () => {
    expect(checkTransition(demand({ stageId: 'triagem', responsibleId: undefined }), stages, 'execucao')).toMatchObject({ allowed: false, reason: expect.stringContaining('responsável') });
    expect(checkTransition(demand({ stageId: 'execucao', approverId: undefined }), stages, 'conferencia')).toMatchObject({ allowed: false, reason: expect.stringContaining('aprovador') });
  });

  it('somente o aprovador encerra a partir da conferência', () => {
    const inReview = demand({ stageId: 'conferencia' });
    expect(checkTransition(inReview, stages, 'encerramento', 'resp')).toMatchObject({ allowed: false, reason: expect.stringContaining('Somente o aprovador') });
    expect(checkTransition(inReview, stages, 'encerramento', 'aprov')).toEqual({ allowed: true, direction: 'forward', requiresNote: false, closes: true });
  });

  it('devolução exige motivo e demanda encerrada não se move', () => {
    expect(checkTransition(demand({ stageId: 'conferencia' }), stages, 'execucao')).toMatchObject({ allowed: true, direction: 'back', requiresNote: true });
    expect(getPreviousStages(stages, 'conferencia').map((item) => item.id)).toEqual(['abertura', 'triagem', 'execucao']);
    expect(checkTransition(demand({ status: 'closed' }), stages, 'triagem')).toMatchObject({ allowed: false });
    expect(checkTransition(demand(), stages, 'autorizacao')).toMatchObject({ allowed: false });
  });
});

describe('formulários de demandas', () => {
  it('exige tipo e título e separa responsável de aprovador', () => {
    expect(demandSchema.safeParse({ typeId: '', title: 'Repor posto', priority: 'normal' }).success).toBe(false);
    expect(demandSchema.safeParse({ typeId: 't1', title: 'ab', priority: 'normal' }).success).toBe(false);
    expect(demandSchema.safeParse({ typeId: 't1', title: 'Repor posto', priority: 'normal', responsibleId: 'p1', approverId: 'p1' }).success).toBe(false);
    expect(demandSchema.safeParse({ typeId: 't1', title: 'Repor posto', priority: 'normal', responsibleId: 'p1', approverId: 'p2' }).success).toBe(true);
    expect(assignSchema.safeParse({ responsibleId: 'p1', approverId: 'p1' }).success).toBe(false);
  });

  it('aceita evidência somente com link https', () => {
    expect(evidenceSchema.safeParse({ label: 'ASO', url: 'https://drive.google.com/x' }).success).toBe(true);
    expect(evidenceSchema.safeParse({ label: 'ASO', url: 'http://drive.google.com/x' }).success).toBe(false);
    expect(evidenceSchema.safeParse({ label: 'ASO', url: 'javascript:alert(1)' }).success).toBe(false);
  });

  it('limita o prazo padrão do tipo entre 0 e 365 dias', () => {
    expect(demandTypeSchema.safeParse({ name: 'Reposição', defaultDueDays: '400', isActive: true }).success).toBe(false);
    expect(demandTypeSchema.safeParse({ name: 'Reposição', defaultDueDays: '', isActive: true }).success).toBe(true);
    expect(demandTypeSchema.safeParse({ name: 'Reposição', defaultDueDays: '15', isActive: true }).success).toBe(true);
  });
});
