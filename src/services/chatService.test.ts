import { describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: { invoke },
  },
}));

import { sendChatMessage } from './chatService';

describe('sendChatMessage', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it('invoca a Edge Function com o histórico da conversa e retorna a resposta', async () => {
    invoke.mockResolvedValue({
      data: { message: { role: 'assistant', content: 'Olá! Como posso ajudar?' } },
      error: null,
    });

    await expect(sendChatMessage([{ role: 'user', content: 'Olá' }])).resolves.toEqual({
      role: 'assistant',
      content: 'Olá! Como posso ajudar?',
    });
    expect(invoke).toHaveBeenCalledWith('ai-gateway', {
      body: { messages: [{ role: 'user', content: 'Olá' }] },
    });
  });

  it('não expõe detalhes do provedor quando a função falha', async () => {
    invoke.mockResolvedValue({ data: null, error: new Error('provider secret') });

    await expect(sendChatMessage([{ role: 'user', content: 'Olá' }])).rejects.toThrow(
      'Não foi possível conversar com a Gestly agora. Tente novamente.'
    );
  });

  it('exibe somente mensagens públicas permitidas retornadas pelo gateway', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({
            error: {
              code: 'usage_limit_exceeded',
              message: 'detalhe interno que não deve ser usado pelo frontend',
            },
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } },
        ),
      },
    });

    await expect(sendChatMessage([{ role: 'user', content: 'Olá' }])).rejects.toThrow(
      'O limite de uso da IA foi atingido. Tente novamente mais tarde ou fale com o administrador da empresa.',
    );
  });

  it('não repassa mensagem desconhecida do backend', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({
            error: {
              code: 'provider_raw_error',
              message: 'sk-secret stack trace',
            },
          }),
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        ),
      },
    });

    await expect(sendChatMessage([{ role: 'user', content: 'Olá' }])).rejects.toThrow(
      'Não foi possível conversar com a Gestly agora. Tente novamente.',
    );
  });

  it('valida o contexto de dados e não o reenvia como histórico ao backend', async () => {
    invoke.mockResolvedValue({
      data: {
        message: { role: 'assistant', content: 'Foram R$ 990,00.' },
        data_contexts: [
          {
            tool_name: 'get_sales_summary',
            period_label: '01/07/2026 a 25/07/2026',
            period_start: '2026-07-01T03:00:00.000Z',
            period_end: '2026-07-26T03:00:00.000Z',
            source: 'Vendas pagas registradas no SobControle.',
            criteria: "sales.payment_status = 'paid'",
            record_count: 1,
            truncated: false,
          },
        ],
      },
      error: null,
    });

    await expect(
      sendChatMessage([
        {
          role: 'assistant',
          content: 'Resposta anterior.',
          dataContexts: [
            {
              toolName: 'get_customers_summary',
              periodLabel: 'anterior',
              periodStart: '2026-01-01T00:00:00.000Z',
              periodEnd: '2026-01-02T00:00:00.000Z',
              source: 'Fonte anterior',
              criteria: 'Critério anterior',
              recordCount: 1,
              truncated: false,
            },
          ],
        },
        { role: 'user', content: 'Quanto vendi?' },
      ]),
    ).resolves.toMatchObject({
      role: 'assistant',
      content: 'Foram R$ 990,00.',
      dataContexts: [
        {
          toolName: 'get_sales_summary',
          periodLabel: '01/07/2026 a 25/07/2026',
        },
      ],
    });
    expect(invoke).toHaveBeenCalledWith('ai-gateway', {
      body: {
        messages: [
          { role: 'assistant', content: 'Resposta anterior.' },
          { role: 'user', content: 'Quanto vendi?' },
        ],
      },
    });
  });

  it('mantém múltiplas citações quando o backend encadeia mais de uma ferramenta', async () => {
    invoke.mockResolvedValue({
      data: {
        message: { role: 'assistant', content: 'Resumo combinando vendas e contas vencidas.' },
        data_contexts: [
          {
            tool_name: 'get_sales_summary',
            period_label: '01/07/2026 a 25/07/2026',
            period_start: '2026-07-01T03:00:00.000Z',
            period_end: '2026-07-26T03:00:00.000Z',
            source: 'Vendas pagas registradas no SobControle.',
            criteria: "sales.payment_status = 'paid'",
            record_count: 1,
            truncated: false,
          },
          {
            tool_name: 'get_overdue_financial_items',
            period_label: 'Posição em 25/07/2026',
            period_start: '2026-07-25T00:00:00.000Z',
            period_end: '2026-07-25T00:00:00.000Z',
            source: 'Contas a pagar e a receber do SobControle.',
            criteria: 'due_date < referência.',
            record_count: 0,
            truncated: false,
          },
        ],
      },
      error: null,
    });

    const result = await sendChatMessage([{ role: 'user', content: 'Como está minha empresa?' }]);
    expect(result.dataContexts).toHaveLength(2);
    expect(result.dataContexts?.map((entry) => entry.toolName)).toEqual([
      'get_sales_summary',
      'get_overdue_financial_items',
    ]);
  });
});
