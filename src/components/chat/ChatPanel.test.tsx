import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const { sendChatMessage } = vi.hoisted(() => ({ sendChatMessage: vi.fn() }));

vi.mock('@/services/chatService', () => ({ sendChatMessage }));

import { ChatPanel } from './ChatPanel';

describe('ChatPanel', () => {
  beforeEach(() => {
    sendChatMessage.mockReset();
  });

  it('envia a mensagem e exibe a resposta da Gestly', async () => {
    sendChatMessage.mockResolvedValue({ role: 'assistant', content: 'Posso ajudar com o uso do Gestly.' });
    render(<ChatPanel isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem para a Gestly' }), {
      target: { value: 'Como cadastro um cliente?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    await waitFor(() =>
      expect(sendChatMessage).toHaveBeenCalledWith(
        expect.arrayContaining([{ role: 'user', content: 'Como cadastro um cliente?' }])
      )
    );
    expect(await screen.findByText('Posso ajudar com o uso do Gestly.')).toBeInTheDocument();
  });

  it('informa o erro de forma segura', async () => {
    sendChatMessage.mockRejectedValue(new Error('Não foi possível conversar com a Gestly agora. Tente novamente.'));
    render(<ChatPanel isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem para a Gestly' }), {
      target: { value: 'Olá' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conversar com a Gestly agora. Tente novamente.');
  });

  it('exibe período, fonte, critério e truncamento da consulta', async () => {
    sendChatMessage.mockResolvedValue({
      role: 'assistant',
      content: 'Há um produto sem estoque.',
      dataContexts: [
        {
          toolName: 'get_low_stock_products',
          periodLabel: 'Posição em 25/07/2026',
          periodStart: '2026-07-25T15:00:00.000Z',
          periodEnd: '2026-07-25T15:00:00.000Z',
          source: 'Cadastro e saldos atuais de produtos do SobControle.',
          criteria: 'Produtos ativos no mínimo ou abaixo.',
          recordCount: 1,
          truncated: true,
        },
      ],
    });
    render(<ChatPanel isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem para a Gestly' }), {
      target: { value: 'O que está sem estoque?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    expect(await screen.findByText('Posição em 25/07/2026')).toBeInTheDocument();
    expect(screen.getByText('Cadastro e saldos atuais de produtos do SobControle.')).toBeInTheDocument();
    expect(screen.getByText('Produtos ativos no mínimo ou abaixo.')).toBeInTheDocument();
    expect(screen.getByText(/1 registro \(resultado limitado\)/)).toBeInTheDocument();
  });

  it('exibe uma citação por ferramenta quando o backend encadeia mais de uma consulta', async () => {
    sendChatMessage.mockResolvedValue({
      role: 'assistant',
      content: 'Resumo combinando vendas e contas vencidas.',
      dataContexts: [
        {
          toolName: 'get_sales_summary',
          periodLabel: '01/07/2026 a 25/07/2026',
          periodStart: '2026-07-01T03:00:00.000Z',
          periodEnd: '2026-07-26T03:00:00.000Z',
          source: 'Vendas pagas registradas no SobControle.',
          criteria: "sales.payment_status = 'paid'",
          recordCount: 1,
          truncated: false,
        },
        {
          toolName: 'get_overdue_financial_items',
          periodLabel: 'Posição em 25/07/2026',
          periodStart: '2026-07-25T00:00:00.000Z',
          periodEnd: '2026-07-25T00:00:00.000Z',
          source: 'Contas a pagar e a receber do SobControle.',
          criteria: 'due_date < referência.',
          recordCount: 0,
          truncated: false,
        },
      ],
    });
    render(<ChatPanel isOpen onClose={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Mensagem para a Gestly' }), {
      target: { value: 'Como está minha empresa hoje?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    expect(await screen.findByText('Vendas pagas registradas no SobControle.')).toBeInTheDocument();
    expect(screen.getByText('Contas a pagar e a receber do SobControle.')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Contexto dos dados consultados')).toHaveLength(2);
  });
});
