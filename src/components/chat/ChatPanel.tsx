import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, X } from 'lucide-react';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ isOpen, onClose }) => {
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
            className="fixed right-0 top-0 z-50 flex h-full w-full sm:w-[380px] flex-col bg-white dark:bg-[#0f1115] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-black/5 dark:border-white/10 px-5 py-4">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: 'linear-gradient(135deg, #0B2551 0%, #00d2ff 100%)' }}
              >
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">Gestly</p>
                <p className="text-xs text-gray-500 dark:text-white/50 truncate">Assistente Comercial</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar chat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-8 text-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full text-white"
                style={{ background: 'linear-gradient(135deg, #0B2551 0%, #00d2ff 100%)' }}
              >
                <Bot className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <p className="text-base font-semibold text-gray-900 dark:text-white">
                  Olá! Eu sou o <span className="font-bold">Gestly</span> 🤖
                </p>
                <p className="text-sm text-gray-500 dark:text-white/60 max-w-xs">
                  Seu assistente comercial inteligente. Em breve você poderá conversar comigo sobre
                  vendas, clientes, estoque e muito mais!
                </p>
              </div>
              <button
                type="button"
                className="mt-2 rounded-full px-5 py-2 text-sm font-medium text-white shadow-md shadow-[#0B2551]/20 hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #0B2551 0%, #00d2ff 100%)' }}
              >
                Iniciar conversa
              </button>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 border-t border-black/5 dark:border-white/10 px-4 py-4">
              <input
                type="text"
                disabled
                placeholder="Digite sua mensagem..."
                className="flex-1 rounded-full border border-black/10 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2 text-sm text-gray-400 dark:text-white/40 placeholder:text-gray-400 dark:placeholder:text-white/30 cursor-not-allowed focus:outline-none"
              />
              <button
                type="button"
                disabled
                aria-label="Enviar mensagem"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-white/5 text-gray-300 dark:text-white/20 cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ChatPanel;
