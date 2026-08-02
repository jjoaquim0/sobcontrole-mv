import React, { useEffect, useRef } from 'react';
import { Bot, Loader2 } from 'lucide-react';
import { ChatMessage } from '@/services/chatService';
import { AssistantText } from './AssistantText';

interface ChatMessagesProps {
  messages: ChatMessage[];
  isSending: boolean;
  className?: string;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isSending,
  className = '',
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const messagesEnd = messagesEndRef.current;
    if (messagesEnd && typeof messagesEnd.scrollIntoView === 'function') {
      messagesEnd.scrollIntoView({
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  }, [isSending, messages]);

  return (
    <div
      role="log"
      aria-live="polite"
      aria-relevant="additions text"
      aria-busy={isSending}
      className={`flex flex-col gap-4 ${className}`}
    >
      {messages.map((message, index) => (
        <div
          key={`${message.role}-${index}`}
          className={`flex max-w-[92%] gap-2.5 md:max-w-[82%] ${
            message.role === 'user' ? 'self-end' : 'self-start'
          }`}
        >
          {message.role === 'assistant' && (
            <div
              aria-hidden="true"
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0B2551] to-[#00a8d8] text-white shadow-sm"
            >
              <Bot className="h-3.5 w-3.5" />
            </div>
          )}

          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
              message.role === 'user'
                ? 'rounded-br-md bg-[#0B2551] text-white'
                : 'rounded-bl-md border border-black/[0.04] bg-white text-gray-700 dark:border-white/[0.07] dark:bg-white/[0.07] dark:text-white/90'
            }`}
          >
            {message.role === 'assistant' ? (
              <AssistantText content={message.content} />
            ) : (
              <p className="whitespace-pre-line">{message.content}</p>
            )}

            {message.role === 'assistant' &&
              message.dataContexts &&
              message.dataContexts.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-black/10 pt-2.5 dark:border-white/10">
                  {message.dataContexts.map((dataContext, contextIndex) => (
                    <dl
                      key={`${dataContext.toolName}-${contextIndex}`}
                      aria-label="Contexto dos dados consultados"
                      className="text-[11px] leading-snug text-gray-500 dark:text-white/55"
                    >
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium">
                        <dt className="sr-only">Período</dt>
                        <dd>{dataContext.periodLabel}</dd>
                        <span aria-hidden="true" className="opacity-40">
                          ·
                        </span>
                        <dt className="sr-only">Registros retornados</dt>
                        <dd>
                          {dataContext.recordCount}
                          {dataContext.recordCount === 1
                            ? ' registro'
                            : ' registros'}
                          {dataContext.truncated
                            ? ' (resultado limitado)'
                            : ''}
                        </dd>
                      </div>
                      <div className="mt-0.5">
                        <dt className="inline">Fonte: </dt>
                        <dd className="inline">{dataContext.source}</dd>
                      </div>
                      <div className="mt-0.5 opacity-80">
                        <dt className="inline">Critério: </dt>
                        <dd className="inline">{dataContext.criteria}</dd>
                      </div>
                    </dl>
                  ))}
                </div>
              )}
          </div>
        </div>
      ))}

      {isSending && (
        <div className="flex max-w-[82%] items-center gap-2.5 self-start">
          <div
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0B2551] to-[#00a8d8] text-white"
          >
            <Bot className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-black/[0.04] bg-white px-4 py-3 text-xs text-gray-500 shadow-sm dark:border-white/[0.07] dark:bg-white/[0.07] dark:text-white/60">
            <Loader2
              aria-hidden="true"
              className="h-4 w-4 animate-spin motion-reduce:animate-none"
            />
            Consultando dados permitidos…
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessages;
