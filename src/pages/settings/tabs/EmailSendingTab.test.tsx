import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailSendingTab } from './EmailSendingTab';

const useEmailSenderMock = vi.fn();
vi.mock('../../../hooks/useEmailSender', () => ({
  useEmailSender: () => useEmailSenderMock(),
}));

const buildHookState = (canConfigure: boolean) => ({
  state: {
    settings: {
      id: 'setting-1', mode: 'platform', displayName: 'Empresa Segura',
      senderEmail: 'notificacoes@sobcontrole.app', sendingEnabled: true,
      testSendingEnabled: true, testRateLimitPerHour: 20,
    },
    connections: [],
    domains: [{
      id: 'domain-1', domain: 'empresa.com.br', status: 'verified',
      spfStatus: 'verified', dkimStatus: 'verified', dmarcStatus: 'not_configured', records: [],
    }],
    history: [{
      id: 'log-1', createdAt: '2026-08-05T12:00:00Z', senderDisplayName: 'Empresa Segura',
      senderEmail: 'notificacoes@sobcontrole.app', recipientMasked: 'p***@example.com',
      subjectLabel: 'Teste de envio — SobControle', origin: 'test', provider: 'resend', status: 'sent',
    }],
    permissions: { canConfigure, canTest: true },
  },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
  savePlatform: vi.fn().mockResolvedValue(undefined),
  saveDomainSender: vi.fn().mockResolvedValue(undefined),
  createDomain: vi.fn().mockResolvedValue(undefined),
  verifyDomain: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  sendTest: vi.fn().mockResolvedValue(undefined),
  startOAuth: vi.fn().mockResolvedValue(undefined),
  isSaving: false,
  isTesting: false,
});

describe('EmailSendingTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the complete admin configuration without exposing the full recipient', () => {
    useEmailSenderMock.mockReturnValue(buildHookState(true));
    render(<EmailSendingTab />);
    expect(screen.getByRole('heading', { name: 'Envio de e-mails' })).toBeInTheDocument();
    expect(screen.getByText('Identidade e método de envio')).toBeInTheDocument();
    expect(screen.getByText('Google Workspace')).toBeInTheDocument();
    expect(screen.getByText('Microsoft 365')).toBeInTheDocument();
    expect(screen.getByText('empresa.com.br')).toBeInTheDocument();
    expect(screen.getByText('p***@example.com')).toBeInTheDocument();
    expect(screen.queryByText('pessoa@example.com')).not.toBeInTheDocument();
  });

  it('keeps test and history visible to managers but hides configuration controls', () => {
    useEmailSenderMock.mockReturnValue(buildHookState(false));
    render(<EmailSendingTab />);
    expect(screen.queryByText('Identidade e método de envio')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar domínio' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enviar teste' })).toBeInTheDocument();
    expect(screen.getByText(/Somente administradores alteram o remetente\./)).toBeInTheDocument();
  });

  it('reuses one idempotency intent for concurrent repeated test clicks', async () => {
    const hookState = buildHookState(true);
    useEmailSenderMock.mockReturnValue(hookState);
    render(<EmailSendingTab />);
    fireEvent.change(screen.getByLabelText('Destinatário do teste'), {
      target: { value: 'pessoa@example.com' },
    });
    const sendButton = screen.getByRole('button', { name: 'Enviar teste' });
    fireEvent.click(sendButton);
    fireEvent.click(sendButton);
    await waitFor(() => expect(hookState.sendTest).toHaveBeenCalledTimes(2));
    const firstIntent = hookState.sendTest.mock.calls[0][0].idempotencyKey;
    const secondIntent = hookState.sendTest.mock.calls[1][0].idempotencyKey;
    expect(firstIntent).toMatch(/^test:[0-9a-f-]{36}$/i);
    expect(secondIntent).toBe(firstIntent);
  });
});
