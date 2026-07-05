import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Handshake, Trophy, XOctagon, History } from 'lucide-react';
import { Deal, PipelineStage } from '../../../types';
import { useCustomers } from '../../../hooks/useCustomers';
import { useSettings } from '../../../hooks/useSettings';
import { useDealHistory } from '../../../hooks/usePipeline';
import { useAuthStore } from '../../../store/authStore';

const dealSchema = z.object({
  title: z.string().min(3, 'O título deve conter pelo menos 3 caracteres'),
  customerId: z.string().min(1, 'Cliente é obrigatório'),
  ownerId: z.string().min(1, 'Responsável é obrigatório'),
  stageId: z.string().min(1, 'Etapa é obrigatória'),
  value: z.coerce.number().nonnegative('Valor deve ser maior ou igual a zero'),
  expectedCloseDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

type DealForm = z.infer<typeof dealSchema>;

export interface DealSavePayload {
  title: string;
  customerId: string;
  ownerId: string;
  stageId: string;
  value: number;
  expectedCloseDate?: string;
  notes?: string;
}

export interface DealModalProps {
  isOpen: boolean;
  onClose: () => void;
  deal?: Deal;
  defaultStageId?: string;
  stages: PipelineStage[];
  onSave: (data: DealSavePayload) => Promise<void>;
  isSaving?: boolean;
  onMarkWon: () => Promise<void>;
  onMarkLost: (reason?: string) => Promise<void>;
  isClosing?: boolean;
}

export const DealModal: React.FC<DealModalProps> = ({
  isOpen,
  onClose,
  deal,
  defaultStageId,
  stages,
  onSave,
  isSaving = false,
  onMarkWon,
  onMarkLost,
  isClosing = false,
}) => {
  const { customers } = useCustomers({ status: 'active' });
  const { teamMembers } = useSettings();
  const { history } = useDealHistory(deal?.id);
  const currentProfileId = useAuthStore((s) => s.profile?.id);
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      title: '',
      customerId: '',
      ownerId: '',
      stageId: '',
      value: 0,
      expectedCloseDate: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (!isOpen) return;

    setShowLostReason(false);
    setLostReason('');

    if (deal) {
      reset({
        title: deal.title,
        customerId: deal.customerId,
        ownerId: deal.ownerId,
        stageId: deal.stageId,
        value: deal.value,
        expectedCloseDate: deal.expectedCloseDate || '',
        notes: deal.notes || '',
      });
    } else {
      reset({
        title: '',
        customerId: '',
        ownerId: currentProfileId || '',
        stageId: defaultStageId || stages[0]?.id || '',
        value: 0,
        expectedCloseDate: '',
        notes: '',
      });
    }
  }, [deal, isOpen, defaultStageId, stages, currentProfileId, reset]);

  const onSubmit = async (formValues: DealForm) => {
    await onSave({
      title: formValues.title,
      customerId: formValues.customerId,
      ownerId: formValues.ownerId,
      stageId: formValues.stageId,
      value: formValues.value,
      expectedCloseDate: formValues.expectedCloseDate || undefined,
      notes: formValues.notes,
    });
    onClose();
  };

  const handleMarkLostConfirm = async () => {
    await onMarkLost(lostReason || undefined);
    onClose();
  };

  const handleMarkWon = async () => {
    await onMarkWon();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isSaving || isClosing ? undefined : onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto transition-colors duration-300"
          >
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <Handshake className="w-5.5 h-5.5 text-[#10b981]" />
                <div>
                  <h3 className="text-lg font-bold">{deal ? 'Editar Negócio' : 'Novo Negócio'}</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {deal ? 'Atualize os dados desta oportunidade' : 'Cadastre uma nova oportunidade no funil de vendas'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Título do Negócio *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Implantação ERP - Cliente XPTO"
                  {...register('title')}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200"
                />
                {errors.title && <p className="text-xs text-red-500 font-medium">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Cliente *
                  </label>
                  <select
                    {...register('customerId')}
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
                  >
                    <option value="">Selecione</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                  {errors.customerId && <p className="text-xs text-red-500 font-medium">{errors.customerId.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Responsável *
                  </label>
                  <select
                    {...register('ownerId')}
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
                  >
                    <option value="">Selecione</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  {errors.ownerId && <p className="text-xs text-red-500 font-medium">{errors.ownerId.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Etapa *
                  </label>
                  <select
                    {...register('stageId')}
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {errors.stageId && <p className="text-xs text-red-500 font-medium">{errors.stageId.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Valor Estimado (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    {...register('value')}
                    className="w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981]"
                  />
                  {errors.value && <p className="text-xs text-red-500 font-medium">{errors.value.message}</p>}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Previsão de Fechamento
                </label>
                <input
                  type="date"
                  {...register('expectedCloseDate')}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] dark:[color-scheme:dark]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Observações
                </label>
                <textarea
                  placeholder="Detalhes da negociação, próximos passos..."
                  rows={3}
                  {...register('notes')}
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] resize-none"
                />
              </div>

              {deal && (
                <div className="border-t border-gray-100 dark:border-white/5 pt-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
                    <History className="w-4 h-4 text-[#10b981]" />
                    <span className="text-xs font-bold uppercase tracking-wider">Encerrar Negócio</span>
                  </div>

                  {!showLostReason ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleMarkWon}
                        disabled={isClosing || isSaving}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-200 disabled:opacity-50"
                      >
                        <Trophy className="w-3.5 h-3.5" /> Marcar como Ganho
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowLostReason(true)}
                        disabled={isClosing || isSaving}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-200 disabled:opacity-50"
                      >
                        <XOctagon className="w-3.5 h-3.5" /> Marcar como Perdido
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 bg-red-500/5 border border-red-500/20 rounded-xl p-3">
                      <input
                        type="text"
                        placeholder="Motivo da perda (opcional)"
                        value={lostReason}
                        onChange={(e) => setLostReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-white/10 rounded-lg bg-white dark:bg-white/5 text-xs text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-red-400"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowLostReason(false)}
                          className="flex-1 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white py-1.5"
                        >
                          Voltar
                        </button>
                        <button
                          type="button"
                          onClick={handleMarkLostConfirm}
                          disabled={isClosing}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {isClosing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          Confirmar Perda
                        </button>
                      </div>
                    </div>
                  )}

                  {history.length > 0 && (
                    <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                      {history.map((h) => (
                        <div key={h.id} className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-white/20 shrink-0" />
                          <span className="truncate">
                            {h.changedByName} moveu {h.fromStageName ? `de "${h.fromStageName}" ` : ''}
                            para "{h.toStageName}" em {new Date(h.changedAt).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-gray-100 dark:border-white/5 pt-4 mt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSaving ? 'Salvando...' : deal ? 'Salvar Alterações' : 'Criar Negócio'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
