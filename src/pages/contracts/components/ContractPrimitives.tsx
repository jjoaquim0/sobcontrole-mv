import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { ReactNode } from 'react';
import { ServiceContractStatus } from '@/types';
import {
  CONTRACT_STATUS_LABELS,
  ContractValidity,
  describeValidity,
  PostCoverage,
} from '../contractsDomain';

export const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/20 dark:border-white/10 dark:bg-white/5 dark:text-white';
export const labelClass = 'mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300';
export const cardClass = 'rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-white/5 dark:bg-[#1a1d27]';
export const primaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-60';
export const secondaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5';

const badgeBase = 'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold';
const tone = {
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  gray: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

const contractStatusTone: Record<ServiceContractStatus, keyof typeof tone> = {
  draft: 'gray',
  active: 'green',
  suspended: 'amber',
  closed: 'gray',
};

export const ContractStatusBadge = ({ status }: { status: ServiceContractStatus }) => (
  <span className={`${badgeBase} ${tone[contractStatusTone[status]]}`}>{CONTRACT_STATUS_LABELS[status]}</span>
);

const validityTone: Record<ContractValidity['kind'], keyof typeof tone> = {
  unconfirmed: 'amber',
  historical: 'gray',
  no_period: 'gray',
  not_started: 'blue',
  in_force: 'green',
  expiring: 'amber',
  expired: 'red',
};

export const ValidityBadge = ({ validity }: { validity: ContractValidity }) => (
  <span className={`${badgeBase} ${tone[validityTone[validity.kind]]}`}>{describeValidity(validity)}</span>
);

const coverageLabel: Record<PostCoverage['state'], string> = {
  covered: 'Coberto',
  covered_by_substitute: 'Coberto por substituto',
  uncovered: 'Descoberto',
  inactive: 'Posto inativo',
};
const coverageTone: Record<PostCoverage['state'], keyof typeof tone> = {
  covered: 'green',
  covered_by_substitute: 'amber',
  uncovered: 'red',
  inactive: 'gray',
};

export const CoverageBadge = ({ coverage }: { coverage: PostCoverage }) => (
  <span className={`${badgeBase} ${tone[coverageTone[coverage.state]]}`}>
    {coverageLabel[coverage.state]}{coverage.state === 'uncovered' ? ` (${coverage.uncovered})` : ''}
  </span>
);

export const FieldError = ({ message }: { message?: string }) =>
  message ? <span className="mt-1 block text-xs text-red-500">{message}</span> : null;

export interface FormModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  submitLabel: string;
  onClose: () => void;
  /** Erros já viram toast no hook; aqui só evitamos rejeição não tratada. */
  onSubmit: () => unknown;
  children: ReactNode;
  size?: 'md' | 'lg';
}

/** Moldura comum dos formulários do módulo de contratos. */
export const FormModal = ({ isOpen, title, subtitle, isLoading, submitLabel, onClose, onSubmit, children, size = 'lg' }: FormModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
        <motion.button type="button" aria-label="Fechar formulário" className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={isLoading ? undefined : onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        <motion.div className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl dark:border-white/5 dark:bg-[#1a1d27] sm:p-6 ${size === 'lg' ? 'max-w-3xl' : 'max-w-lg'}`} initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.98 }}>
          <div className="mb-6 flex items-start justify-between border-b border-gray-100 pb-4 dark:border-white/5">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
              {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} disabled={isLoading} aria-label="Fechar" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-white/5 dark:hover:text-white"><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); Promise.resolve(onSubmit()).catch(() => undefined); }} className="space-y-6" noValidate>
            {children}
            <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 dark:border-white/5">
              <button type="button" onClick={onClose} disabled={isLoading} className={secondaryButtonClass}>Cancelar</button>
              <button type="submit" disabled={isLoading} className={primaryButtonClass}>{isLoading && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}</button>
            </div>
          </form>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-300">{children}</h3>
);
