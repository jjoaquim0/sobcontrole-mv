import React from 'react';
import { Bot } from 'lucide-react';
import { toast } from 'sonner';

const AI_INTEGRATION_LABEL = 'Integrar ao site com IA';
const AI_INTEGRATION_DESCRIPTION = 'Use este documento para ajudar a IA do seu site a responder perguntas com informações atualizadas.';
const AI_INTEGRATION_TOOLTIP = 'Em breve você poderá autorizar este documento como fonte de conhecimento para a IA do seu site.';

const handleClick = () => {
  toast.info('Esta integração estará disponível em breve.');
};

interface AiSiteIntegrationActionProps {
  /** Compact inline variant for tight spaces (e.g. an upload item row). Defaults to a full descriptive card. */
  compact?: boolean;
  className?: string;
}

export const AiSiteIntegrationAction: React.FC<AiSiteIntegrationActionProps> = ({ compact = false, className = '' }) => {
  if (compact) {
    return (
      <button
        type="button"
        onClick={handleClick}
        title={AI_INTEGRATION_TOOLTIP}
        aria-label={`${AI_INTEGRATION_LABEL}. Recurso em breve. ${AI_INTEGRATION_TOOLTIP}`}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 outline-none transition-colors hover:bg-emerald-500/10 hover:text-[#10b981] focus-visible:ring-2 focus-visible:ring-[#10b981] dark:text-gray-400 dark:hover:text-[#10b981] ${className}`}
      >
        <Bot className="h-3.5 w-3.5 shrink-0" />
        <span>{AI_INTEGRATION_LABEL}</span>
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-400">Em breve</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={AI_INTEGRATION_TOOLTIP}
      aria-label={`${AI_INTEGRATION_LABEL}. Recurso em breve. ${AI_INTEGRATION_TOOLTIP}`}
      className={`flex w-full items-start gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50/60 px-4 py-3 text-left outline-none transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus-visible:ring-2 focus-visible:ring-[#10b981] dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-emerald-500/30 ${className}`}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#10b981] dark:bg-emerald-950/20">
        <Bot className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{AI_INTEGRATION_LABEL}</span>
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 dark:bg-white/10 dark:text-gray-400">Em breve</span>
        </span>
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">{AI_INTEGRATION_DESCRIPTION}</span>
      </span>
    </button>
  );
};
