import React, { FormEvent, KeyboardEvent, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bot, Plus, Send, Square, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGestlyConversation } from '@/hooks/useGestlyConversation';
import { ChatMessages } from './ChatMessages';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
  const { company, profile } = useAuth();
  const [input, setInput] = useState('');
  const prefersReducedMotion = useReducedMotion();
  const firstName = profile?.name?.trim().split(/\s+/)[0];
  const conversation = useGestlyConversation({
    companyId: company?.id,
    firstName,
  });

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || conversation.isSending) return;

    setInput('');
    await conversation.sendMessage(content);
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

  const handleNewConversation = () => {
    setInput('');
    conversation.resetConversation();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="chat-backdrop"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40"
          />

          <motion.div
            key="chat-panel"
            initial={prefersReducedMotion ? false : { x: '100%' }}
            animate={{ x: 0 }}
            exit={prefersReducedMotion ? undefined : { x: '100%' }}
            transition={{
              type: 'tween',
              duration: prefersReducedMotion ? 0 : 0.25,
              ease: 'easeOut',
            }}
            aria-labelledby="gestly-chat-title"
            aria-modal="true"
            role="dialog"
            className="fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-white shadow-2xl dark:bg-[#0f1115] sm:w-[400px]"
          >
            <div className="flex items-center gap-3 border-b border-black/5 px-5 py-4 dark:border-white/10">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0B2551] to-[#00d2ff] text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  id="gestly-chat-title"
                  className="truncate text-sm font-semibold text-gray-900 dark:text-white"
                >
                  Gestly
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-white/50">
                  Pronta para ajudar
                </p>
              </div>
              <button
                type="button"
                onClick={handleNewConversation}
                aria-label="Nova conversa"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] dark:hover:bg-white/10 dark:hover:text-white"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar chat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] dark:hover:bg-white/10 dark:hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              {conversation.wasContextCleared && (
                <p
                  role="status"
                  className="mb-4 rounded-xl bg-cyan-50 px-3 py-2 text-xs text-cyan-800 dark:bg-cyan-400/10 dark:text-cyan-100"
                >
                  O contexto foi limpo após a troca de empresa.
                </p>
              )}
              <ChatMessages
                messages={conversation.messages}
                isSending={conversation.isSending}
              />
              {conversation.error && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-200"
                >
                  {conversation.error.message}
                </p>
              )}
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2 border-t border-black/5 px-4 py-4 dark:border-white/10"
            >
              <textarea
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={conversation.isSending}
                maxLength={2000}
                aria-label="Mensagem para a Gestly"
                placeholder="Digite sua mensagem..."
                className="max-h-28 flex-1 resize-none rounded-2xl border border-black/10 bg-gray-50 px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00d2ff] disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30"
              />
              {conversation.isSending ? (
                <button
                  type="button"
                  onClick={conversation.stopResponse}
                  aria-label="Interromper resposta"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d2ff] dark:bg-white dark:text-gray-900"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Enviar mensagem"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0B2551] text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d2ff] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatPanel;
