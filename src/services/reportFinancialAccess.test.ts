import { afterEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

import { useAuthStore } from '../store/authStore';
import { assertFinancialReportAccess } from './reportIntelligenceService';

const setRole = (role: 'admin' | 'manager' | 'employee') => {
  useAuthStore.setState({
    profile: {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Pessoa',
      role,
      companyId: 'company-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  });
};

afterEach(() => {
  rpcMock.mockReset();
  useAuthStore.setState({ profile: null, company: null });
});

describe('assertFinancialReportAccess', () => {
  it('bloqueia colaborador antes de qualquer consulta financeira', async () => {
    setRole('employee');

    await expect(assertFinancialReportAccess()).rejects.toMatchObject({
      name: 'FinancialPermissionError',
    });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it.each(['admin', 'manager'] as const)('exige confirmação do banco para %s', async (role) => {
    setRole(role);
    rpcMock.mockResolvedValue({ error: null });

    await expect(assertFinancialReportAccess()).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenCalledWith('assert_report_financial_access');
  });

  it('mantém a negação quando o banco rejeita a autorização', async () => {
    setRole('admin');
    rpcMock.mockResolvedValue({ error: { message: 'not allowed' } });

    await expect(assertFinancialReportAccess()).rejects.toMatchObject({
      name: 'FinancialPermissionError',
      message: 'not allowed',
    });
  });
});
