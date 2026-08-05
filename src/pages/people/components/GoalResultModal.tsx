import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { SalesGoal } from '@/types';
import { formatGoalValue } from '../peopleDomain';

export const GoalResultModal = ({ goal, isLoading, onClose, onSave }: {
  goal?: SalesGoal; isLoading?: boolean; onClose: () => void; onSave: (value: number) => Promise<void>;
}) => {
  const [value, setValue] = useState('');
  useEffect(() => setValue(goal ? String(goal.currentResult) : ''), [goal]);
  const submit = async (event: FormEvent) => { event.preventDefault(); const result = Number(value); if (Number.isFinite(result) && result >= 0) await onSave(result); };
  return <AnimatePresence>{goal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="goal-result-title"><motion.button type="button" aria-label="Fechar" className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1a1d27]" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}><div className="flex items-start justify-between"><div><h2 id="goal-result-title" className="font-bold text-gray-900 dark:text-white">Atualizar resultado manual</h2><p className="mt-1 text-xs text-gray-500">{goal.name} · alvo {formatGoalValue(goal)}</p></div><button type="button" onClick={onClose} aria-label="Fechar" className="p-2 text-gray-400"><X className="h-5 w-5" /></button></div><form onSubmit={submit} className="mt-5 space-y-4"><label><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Resultado atual</span><input autoFocus required type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white" /></label><p className="text-xs text-gray-500">Informe somente dados reais verificados. Esta atualização não cria prêmio, comissão ou pagamento.</p><div className="flex justify-end gap-3"><button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold dark:border-white/10">Cancelar</button><button type="submit" disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}Salvar resultado</button></div></form></motion.div></div>}</AnimatePresence>;
};
