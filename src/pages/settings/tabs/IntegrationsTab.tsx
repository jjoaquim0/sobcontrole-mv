import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Loader2, Puzzle, Plus, Trash2, KeyRound, X, Copy, Check, ShieldAlert } from 'lucide-react';
import { useSettings } from '../../../hooks/useSettings';
import { ConfirmModal } from '../../../components/shared/ConfirmModal';
import { ApiKey } from '../../../services/settingsService';

const cardClass = 'bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm p-6';
const controlClass =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200';

export const IntegrationsTab: React.FC = () => {
  const {
    apiKeys,
    isApiKeysLoading,
    createApiKey,
    isCreatingApiKey,
    revokeApiKey,
    isRevokingApiKey,
  } = useSettings();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);

  const handleCreate = async () => {
    if (!newKeyName.trim()) {
      toast.error('Informe um nome para a chave.');
      return;
    }
    const key = await createApiKey(newKeyName.trim()).catch(() => null);
    if (key) {
      setCreatedKey(key);
      setNewKeyName('');
    }
  };

  const handleCopy = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      toast.success('Chave copiada para a área de transferência.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar a chave.');
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setNewKeyName('');
    setCreatedKey(null);
    setCopied(false);
  };

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke) return;
    await revokeApiKey(keyToRevoke.id)
      .then(() => setKeyToRevoke(null))
      .catch(() => undefined);
  };

  return (
    <div className={cardClass}>
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <Puzzle className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Integrações</h2>
            <p className="text-sm text-gray-500 dark:text-white/50">Gerencie chaves de API para conectar sistemas</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" />
          Criar Nova Chave
        </button>
      </div>

      {isApiKeysLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <KeyRound className="w-10 h-10 text-gray-300 dark:text-white/20 mb-3" />
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Nenhuma chave de API criada</h4>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1 max-w-xs">
            Crie uma chave para integrar o SobControle com outros sistemas.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="p-2 rounded-xl bg-white dark:bg-white/5 text-gray-500 dark:text-gray-300 border border-gray-100 dark:border-white/5">
                  <KeyRound className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{key.name}</h3>
                  <p className="text-xs text-gray-500 dark:text-white/50 font-mono truncate">{key.maskedKey}</p>
                  <p className="text-[11px] text-gray-400 dark:text-white/40 mt-0.5">
                    Criada em {new Date(key.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKeyToRevoke(key)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors duration-150 shrink-0"
                title="Revogar chave"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeModal}
              className="fixed inset-0 bg-black/55 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-md z-10"
            >
              <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {createdKey ? 'Chave Criada' : 'Criar Nova Chave'}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {createdKey ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400">
                    <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-xs leading-relaxed">
                      Copie e guarde esta chave em local seguro. Por segurança, ela não será exibida novamente.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-xs font-mono text-gray-900 dark:text-white break-all">
                      {createdKey.key}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-2.5 rounded-xl bg-[#10b981] hover:bg-[#059669] text-white transition-colors duration-200 shrink-0"
                      title="Copiar chave"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors duration-200"
                    >
                      Concluir
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Nome da Chave
                    </label>
                    <input
                      type="text"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Ex: Integração ERP"
                      className={controlClass}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={isCreatingApiKey}
                      className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-70"
                    >
                      {isCreatingApiKey && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isCreatingApiKey ? 'Criando...' : 'Criar Chave'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!keyToRevoke}
        title="Revogar Chave de API"
        message={`Tem certeza que deseja revogar a chave "${keyToRevoke?.name}"? Sistemas que a utilizam perderão o acesso imediatamente.`}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setKeyToRevoke(null)}
        isLoading={isRevokingApiKey}
        confirmText="Revogar"
        variant="danger"
      />
    </div>
  );
};
