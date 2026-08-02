import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChatMessage,
  GestlyChatError,
  GestlyChatErrorCode,
  sendChatMessage,
} from '@/services/chatService';

export interface GestlyConversationError {
  code: GestlyChatErrorCode;
  message: string;
}

export type GestlyConversationStatus =
  | 'ready'
  | 'consulting'
  | 'unavailable';

interface UseGestlyConversationOptions {
  companyId?: string;
  firstName?: string;
}

const createWelcomeMessage = (firstName?: string): ChatMessage => ({
  role: 'assistant',
  content: `Olá${firstName ? `, ${firstName}` : ''}. Posso ajudar com vendas, clientes, estoque, compras, agenda e informações financeiras permitidas.`,
});

const isUnavailableError = (code: GestlyChatErrorCode): boolean =>
  [
    'unauthorized',
    'company_not_found',
    'permission_denied',
    'global_disabled',
    'company_disabled',
    'usage_limit_exceeded',
    'rate_limited',
    'configuration_error',
    'tool_query_failed',
    'internal_error',
    'invalid_response',
    'unknown',
  ].includes(code);

export const useGestlyConversation = ({
  companyId,
  firstName,
}: UseGestlyConversationOptions) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(firstName),
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<GestlyConversationError | null>(null);
  const [wasContextCleared, setWasContextCleared] = useState(false);
  const activeRequestRef = useRef<AbortController | null>(null);
  const previousCompanyIdRef = useRef(companyId);

  const cancelActiveRequest = useCallback(() => {
    activeRequestRef.current?.abort();
    activeRequestRef.current = null;
    setIsSending(false);
  }, []);

  const resetConversation = useCallback(() => {
    cancelActiveRequest();
    setMessages([createWelcomeMessage(firstName)]);
    setError(null);
    setWasContextCleared(false);
  }, [cancelActiveRequest, firstName]);

  useEffect(() => {
    const previousCompanyId = previousCompanyIdRef.current;
    previousCompanyIdRef.current = companyId;

    if (
      previousCompanyId &&
      companyId &&
      previousCompanyId !== companyId
    ) {
      cancelActiveRequest();
      setMessages([createWelcomeMessage(firstName)]);
      setError(null);
      setWasContextCleared(true);
    }
  }, [cancelActiveRequest, companyId, firstName]);

  useEffect(
    () => () => {
      const activeRequest = activeRequestRef.current;
      activeRequestRef.current = null;
      activeRequest?.abort();
    },
    [],
  );

  const sendMessage = useCallback(
    async (rawContent: string) => {
      const content = rawContent.trim();
      if (!content || isSending || activeRequestRef.current) return false;

      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: 'user', content },
      ];
      const requestController = new AbortController();

      activeRequestRef.current = requestController;
      setMessages(nextMessages);
      setError(null);
      setWasContextCleared(false);
      setIsSending(true);

      try {
        const response = await sendChatMessage(nextMessages.slice(-12), {
          signal: requestController.signal,
        });

        if (
          activeRequestRef.current === requestController &&
          !requestController.signal.aborted
        ) {
          setMessages((current) => [...current, response]);
        }
      } catch (requestError) {
        if (activeRequestRef.current !== requestController) return true;

        if (
          requestError instanceof GestlyChatError &&
          requestError.code === 'request_aborted'
        ) {
          setError(null);
        } else if (requestError instanceof GestlyChatError) {
          setError({
            code: requestError.code,
            message: requestError.message,
          });
        } else {
          setError({
            code: 'unknown',
            message:
              'Não foi possível conversar com a Gestly agora. Tente novamente.',
          });
        }
      } finally {
        if (activeRequestRef.current === requestController) {
          activeRequestRef.current = null;
          setIsSending(false);
        }
      }

      return true;
    },
    [isSending, messages],
  );

  const stopResponse = useCallback(() => {
    activeRequestRef.current?.abort();
  }, []);

  const status: GestlyConversationStatus = isSending
    ? 'consulting'
    : error && isUnavailableError(error.code)
      ? 'unavailable'
      : 'ready';

  return {
    messages,
    isSending,
    error,
    status,
    wasContextCleared,
    hasConversation: messages.some((message) => message.role === 'user'),
    sendMessage,
    stopResponse,
    resetConversation,
  };
};
