import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  role: 'admin' as 'admin' | 'manager' | 'employee',
  companyId: 'company-a',
  sendChatMessage: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    company: { id: mocks.companyId, name: 'Empresa A' },
    profile: { name: 'Ana Silva', role: mocks.role },
    hasRole: (roles: string[]) => roles.includes(mocks.role),
  }),
}));

vi.mock('@/services/chatService', async () => {
  const actual = await vi.importActual<typeof import('@/services/chatService')>(
    '@/services/chatService',
  );
  return { ...actual, sendChatMessage: mocks.sendChatMessage };
});

import { GestlyChatError } from '@/services/chatService';
import { GestlyPage } from './GestlyPage';

describe('GestlyPage', () => {
  beforeEach(() => {
    mocks.role = 'admin';
    mocks.companyId = 'company-a';
    mocks.sendChatMessage.mockReset();
    mocks.sendChatMessage.mockResolvedValue({
      role: 'assistant',
      content: 'Resposta segura da Gestly.',
    });
  });

  it('exibe o estado inicial, capacidades reais e os cinco recursos futuros', () => {
    render(<GestlyPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Gestly' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pronta para ajudar',
    );
    expect(
      screen.getByText(/Olá, Ana. Posso ajudar com vendas/),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Em breve')).toHaveLength(7);
    expect(
      screen.getByRole('heading', { name: 'Insights proativos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Conhecimento do seu site' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'O que a Gestly pode fazer' }),
    ).toBeInTheDocument();
  });

  it('envia uma pergunta sugerida diretamente ao gateway seguro', async () => {
    render(<GestlyPage />);

    fireEvent.click(
      screen.getByRole('button', { name: /Vendas Quanto vendi este mês/ }),
    );

    await waitFor(() =>
      expect(mocks.sendChatMessage).toHaveBeenCalledWith(
        expect.arrayContaining([
          { role: 'user', content: 'Quanto vendi este mês?' },
        ]),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
    expect(
      await screen.findByText('Resposta segura da Gestly.'),
    ).toBeInTheDocument();
  });

  it('oculta perguntas financeiras e marca a capacidade para employee', () => {
    mocks.role = 'employee';
    render(<GestlyPage />);

    expect(
      screen.queryByRole('button', {
        name: /Financeiro Quais contas estão vencidas/,
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Sem permissão')).toBeInTheDocument();
  });

  it('apresenta o estado de limite de uso sem detalhes internos', async () => {
    mocks.sendChatMessage.mockRejectedValue(
      new GestlyChatError(
        'usage_limit_exceeded',
        'O limite de uso da IA foi atingido. Tente novamente mais tarde ou fale com o administrador da empresa.',
      ),
    );
    render(<GestlyPage />);

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Mensagem para a Gestly' }),
      { target: { value: 'Quanto vendi?' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    expect(
      await screen.findByText('Limite de uso atingido'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Indisponível temporariamente',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      /provider|modelo|token|company_id/i,
    );
  });

  it('limpa apenas o contexto local ao iniciar nova conversa', async () => {
    render(<GestlyPage />);

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Mensagem para a Gestly' }),
      { target: { value: 'Minha pergunta temporária' } },
    );
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));
    expect(
      await screen.findByText('Resposta segura da Gestly.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Nova conversa' }));

    expect(
      screen.queryByText('Minha pergunta temporária'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Olá, Ana. Posso ajudar com vendas/),
    ).toBeInTheDocument();
  });
});
