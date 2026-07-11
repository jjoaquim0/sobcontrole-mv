import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { AnalyticsModuleWithAccess } from '../../../hooks/useAnalyticsModules';
import { BiModuleContent } from '../biModulesContent';
import { BiModuleStatusBadge } from './BiModuleStatusBadge';

export interface BiModuleCardProps {
  module: AnalyticsModuleWithAccess;
  content: BiModuleContent;
  onUnlock: (module: AnalyticsModuleWithAccess) => void;
}

export const BiModuleCard: React.FC<BiModuleCardProps> = ({ module, content, onUnlock }) => {
  const navigate = useNavigate();
  const Icon = content.icon;
  const isUnlocked = module.accessStatus === 'available' || module.accessStatus === 'contracted';
  const isLocked = module.accessStatus === 'locked';
  const isComingSoon = module.accessStatus === 'coming_soon';

  return (
    <div
      data-testid="bi-module-card"
      data-status={module.accessStatus}
      className={`relative bg-white dark:bg-[#1a1d27] rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 p-5 flex flex-col gap-4 transition-all duration-300 hover:shadow-md ${
        isComingSoon ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 shrink-0">
            <Icon className="w-5 h-5" />
          </span>
          <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight">{module.name}</h3>
        </div>
        <BiModuleStatusBadge status={module.accessStatus} />
      </div>

      <p className="text-sm text-gray-500 dark:text-white/60 leading-relaxed">{content.description}</p>

      <ul className="space-y-1.5">
        {content.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981] mt-0.5 shrink-0" />
            {benefit}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-1.5">
        {content.metrics.map((metric) => (
          <span
            key={metric}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-white/50 border border-gray-100 dark:border-white/5"
          >
            {metric}
          </span>
        ))}
      </div>

      {isLocked && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
          <Sparkles className="w-3.5 h-3.5" />
          Recurso premium
        </div>
      )}

      <div className="mt-auto pt-1">
        {isUnlocked && (
          <button
            type="button"
            onClick={() => navigate(module.routePath)}
            className="w-full bg-gradient-to-r from-[#0B2551] to-[#00d2ff] hover:brightness-110 text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 transition-all duration-200"
          >
            Acessar análise
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {isLocked && (
          <button
            type="button"
            onClick={() => onUnlock(module)}
            className="w-full border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-400 rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-colors duration-200"
          >
            <Lock className="w-4 h-4" />
            {module.isAddon ? 'Desbloquear módulo' : 'Conhecer plano'}
          </button>
        )}

        {isComingSoon && (
          <div className="w-full text-center text-xs font-semibold text-gray-400 dark:text-white/30 py-2.5">
            Em breve
          </div>
        )}
      </div>
    </div>
  );
};

export const BiModuleCardSkeleton: React.FC = () => (
  <div className="h-80 bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 animate-pulse" />
);
