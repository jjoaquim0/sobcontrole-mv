import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendChatMessage } = vi.hoisted(() => ({ sendChatMessage: vi.fn() }));

vi.mock('@/services/chatService', async () => {
  const actual = await vi.importActual<typeof import('@/services/chatService')>(
    '@/services/chatService',
  );
  return { ...actual, sendChatMessage };
});

import { GestlyChatError } from '@/services/chatService';
import { useGestlyConversation } from './useGestlyConversation';

describe('useGestlyConversation', () => {
  beforeEach(() => {
    sendChatMessage.mockReset();
  });

  it('mantém o histórico apenas em memória e cria uma nova conversa local', async () => {
    sendChatMessage.mockResolvedValue({
      role: 'assistant',
      content: 'Você vendeu R$ 100,00.',
    });
    const { result } = renderHook(() =>
      useGestlyConversation({
        companyId: 'company-a',
        firstName: 'Ana',
      }),
    );

    expect(result.current.messages[0].content).toContain('Olá, Ana.');

    await act(async () => {
      await result.current.sendMessage('Quanto vendi?');
    });
    expect(result.current.messages).toEqual(
      expect.arrayContaining([
        { role: 'user', content: 'Quanto vendi?' },
        { role: 'assistant', content: 'Você vendeu R$ 100,00.' },
      ]),
    );

    act(() => result.current.resetConversation());
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.hasConversation).toBe(false);
  });

  it('limpa mensagens e sinaliza a troca de empresa', async () => {
    sendChatMessage.mockResolvedValue({
      role: 'assistant',
      content: 'Resposta da empresa A.',
    });
    const { result, rerender } = renderHook(
      ({ companyId }) =>
        useGestlyConversation({
          companyId,
          firstName: 'Ana',
        }),
      { initialProps: { companyId: 'company-a' } },
    );

    await act(async () => {
      await result.current.sendMessage('Pergunta da empresa A');
    });

    rerender({ companyId: 'company-b' });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).not.toContain('empresa A');
    expect(result.current.wasContextCleared).toBe(true);
  });

  it('interrompe a resposta sem exibir erro técnico', async () => {
    sendChatMessage.mockImplementation(
      (
        _messages,
        options: {
          signal?: AbortSignal;
        },
      ) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(
              new GestlyChatError('request_aborted', 'Resposta interrompida.'),
            );
          });
        }),
    );
    const { result } = renderHook(() =>
      useGestlyConversation({
        companyId: 'company-a',
        firstName: 'Ana',
      }),
    );

    act(() => {
      void result.current.sendMessage('Analise meus dados');
    });
    await waitFor(() => expect(result.current.isSending).toBe(true));

    act(() => result.current.stopResponse());

    await waitFor(() => expect(result.current.isSending).toBe(false));
    expect(result.current.error).toBeNull();
  });
});
