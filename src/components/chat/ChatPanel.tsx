import React, { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Loader2, Send, X } from 'lucide-react';
import { ChatMessage, sendChatMessage } from '@/services/chatService';
import { AssistantText } from './AssistantText';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou a Gestly. Posso ajudar com dúvidas gerais sobre vendas, clientes, estoque, financeiro e o uso do sistema.',
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messagesEnd = messagesEndRef.current;
    if (messagesEnd && typeof messagesEnd.scrollIntoView === 'function') {
      messagesEnd.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isSending) return;

    const nextMessages = [...messages, { role: 'user' as const, content }];
    setMessages(nextMessages);
    setInput('');
    setError(null);
    setIsSending(true);

    try {
      const response = await sendChatMessage(nextMessages.slice(-12));
      setMessages((current) => [...current, response]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível conversar com a Gestly agora. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />

          <motion.div
            key="chat-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.25, ease: 'easeOut' }}
            aria-labelledby="gestly-chat-title"
            aria-modal="true"
            role="dialog"
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl dark:bg-[#0f1115] sm:w-[380px]"
          >
            <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: 'linear-gradient(135deg, #0B2551 0%, #00d2ff 100%)' }}
              >
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p id="gestly-chat-title" className="truncate text-sm font-semibold text-gray-900 dark:text-white">Gestly</p>
                <p className="truncate text-xs text-gray-500 dark:text-white/50">Assistente Comercial</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar chat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-5" aria-live="polite">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'self-end rounded-br-sm bg-[#0B2551] text-white'
                      : 'self-start rounded-bl-sm bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/90'
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
                      <div className="mt-3 space-y-2 border-t border-black/10 pt-2 dark:border-white/10">
                        {message.dataContexts.map((dataContext, contextIndex) => (
                          <dl
                            key={`${dataContext.toolName}-${contextIndex}`}
                            aria-label="Contexto dos dados consultados"
                            className="text-[11px] leading-snug text-gray-500 dark:text-white/55"
                          >
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium">
                              <dt className="sr-only">Período</dt>
                              <dd>{dataContext.periodLabel}</dd>
                              <span aria-hidden="true" className="opacity-40">·</span>
                              <dt className="sr-only">Registros retornados</dt>
                              <dd>
                                {dataContext.recordCount}
                                {dataContext.recordCount === 1 ? ' registro' : ' registros'}
                                {dataContext.truncated ? ' (resultado limitado)' : ''}
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
              ))}
              {isSending && (
                <div className="self-start rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-3 text-gray-500 dark:bg-white/10 dark:text-white/60">
                  <Loader2 aria-label="Gestly está respondendo" className="h-4 w-4 animate-spin" />
                </div>
              )}
              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-200">
                  {error}
                </p>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t border-black/5 px-4 py-4 dark:border-white/10">
              <textarea
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                maxLength={2000}
                aria-label="Mensagem para a Gestly"
                placeholder="Digite sua mensagem..."
                className="max-h-28 flex-1 resize-none rounded-2xl border border-black/10 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d2ff] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
              />
              <button
                type="submit"
                disabled={isSending || !input.trim()}
                aria-label="Enviar mensagem"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B2551] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatPanel;
