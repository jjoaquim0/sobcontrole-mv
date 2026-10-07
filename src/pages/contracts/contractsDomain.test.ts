import { describe, expect, it } from 'vitest';
import { allocationSchema, contractSchema, postSchema } from './contractSchemas';
import { describeValidity, getContractValidity, getPostCoverage, isAllocationActive, isSafeHttpsUrl } from './contractsDomain';

const TODAY = '2026-10-07';

describe('getContractValidity', () => {
  it('nunca trata como vigente um contrato com vigência a confirmar', () => {
    expect(getContractValidity({ startDate: '2026-01-01', endDate: '2027-01-01', validationStatus: 'pending' }, TODAY))
      .toEqual({ kind: 'unconfirmed' });
  });

  it('sinaliza vencimento dentro de 60 dias e vencido no passado', () => {
    const expiring = getContractValidity({ startDate: '2026-01-01', endDate: '2026-11-06', validationStatus: 'confirmed' }, TODAY);
    expect(expiring).toEqual({ kind: 'expiring', daysUntilEnd: 30 });
    expect(describeValidity(expiring)).toBe('Vence em 30 dia(s)');
    expect(getContractValidity({ endDate: '2026-10-01', validationStatus: 'confirmed' }, TODAY))
      .toEqual({ kind: 'expired', daysSinceEnd: 6 });
  });

  it('diferencia contrato futuro, sem fim e sem período', () => {
    expect(getContractValidity({ startDate: '2026-10-17', validationStatus: 'confirmed' }, TODAY)).toEqual({ kind: 'not_started', daysUntilStart: 10 });
    expect(getContractValidity({ startDate: '2026-01-01', validationStatus: 'confirmed' }, TODAY)).toEqual({ kind: 'in_force' });
    expect(getContractValidity({ validationStatus: 'confirmed' }, TODAY)).toEqual({ kind: 'no_period' });
  });
});

describe('getPostCoverage', () => {
  const post = { id: 'p1', requiredHeadcount: 2, status: 'active' as const };
  const holder = (startDate: string, endDate?: string) => ({ postId: 'p1', allocationRole: 'holder' as const, startDate, endDate });

  it('considera coberto quando há titulares suficientes hoje', () => {
    expect(getPostCoverage(post, [holder('2026-01-01'), holder('2026-02-01')], TODAY).state).toBe('covered');
  });

  it('ignora alocações encerradas ou futuras e aponta vagas descobertas', () => {
    const coverage = getPostCoverage(post, [holder('2026-01-01', '2026-10-06'), holder('2026-11-01'), holder('2026-01-01')], TODAY);
    expect(coverage).toMatchObject({ holders: 1, uncovered: 1, state: 'uncovered' });
  });

  it('marca cobertura por substituto sem esconder a falta de titular', () => {
    const coverage = getPostCoverage(post, [holder('2026-01-01'), { postId: 'p1', allocationRole: 'substitute', startDate: '2026-10-01' }], TODAY);
    expect(coverage).toMatchObject({ holders: 1, substitutes: 1, uncovered: 0, state: 'covered_by_substitute' });
  });

  it('não cobra cobertura de posto inativo', () => {
    expect(getPostCoverage({ ...post, status: 'inactive' }, [], TODAY)).toMatchObject({ uncovered: 0, state: 'inactive' });
  });

  it('alocação que termina hoje ainda conta como ativa', () => {
    expect(isAllocationActive({ startDate: '2026-01-01', endDate: TODAY }, TODAY)).toBe(true);
  });
});

describe('isSafeHttpsUrl', () => {
  it('aceita somente https', () => {
    expect(isSafeHttpsUrl('https://drive.example.com/pasta')).toBe(true);
    expect(isSafeHttpsUrl('http://exemplo.com')).toBe(false);
    expect(isSafeHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpsUrl('não é link')).toBe(false);
  });
});

describe('formulários de contratos', () => {
  const baseContract = { clientName: 'Prefeitura', title: 'Limpeza', validationStatus: 'pending' as const, status: 'draft' as const };

  it('exige vigência conferida para ativar o contrato', () => {
    const result = contractSchema.safeParse({ ...baseContract, status: 'active' });
    expect(result.success).toBe(false);
    expect(contractSchema.safeParse({ ...baseContract, status: 'active', validationStatus: 'confirmed' }).success).toBe(true);
  });

  it('rejeita fim antes do início e links que não sejam https', () => {
    expect(contractSchema.safeParse({ ...baseContract, startDate: '2026-05-01', endDate: '2026-04-01' }).success).toBe(false);
    expect(contractSchema.safeParse({ ...baseContract, sourceDocumentsUrl: 'http://x.com' }).success).toBe(false);
  });

  it('limita o quantitativo do posto entre 1 e 500', () => {
    const base = { name: 'Portaria', jobFunction: 'Porteiro', workSchedule: '12x36', status: 'active' as const };
    expect(postSchema.safeParse({ ...base, requiredHeadcount: '0' }).success).toBe(false);
    expect(postSchema.safeParse({ ...base, requiredHeadcount: '501' }).success).toBe(false);
    expect(postSchema.safeParse({ ...base, requiredHeadcount: '3' }).success).toBe(true);
  });

  it('exige funcionário e início na alocação', () => {
    expect(allocationSchema.safeParse({ employeeId: '', allocationRole: 'holder', startDate: TODAY }).success).toBe(false);
    expect(allocationSchema.safeParse({ employeeId: 'e1', allocationRole: 'holder', startDate: '' }).success).toBe(false);
  });
});
