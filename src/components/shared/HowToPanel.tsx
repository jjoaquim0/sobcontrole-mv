import { useState } from 'react';
import { ChevronDown, GraduationCap } from 'lucide-react';

const storageKey = (id: string) => `howto:${id}:collapsed`;

const readCollapsed = (id: string) => {
  try {
    return window.localStorage.getItem(storageKey(id)) === '1';
  } catch {
    return false;
  }
};

const writeCollapsed = (id: string, collapsed: boolean) => {
  try {
    window.localStorage.setItem(storageKey(id), collapsed ? '1' : '0');
  } catch {
    // Sem armazenamento local o painel só não lembra a escolha.
  }
};

/**
 * Instruções curtas dentro do fluxo (roadmap §3, "Treinamento operacional").
 * Abre na primeira visita; quem já conhece a tela recolhe e o navegador lembra.
 */
export const HowToPanel = ({ id, title = 'Como usar esta tela', steps, note }: {
  id: string;
  title?: string;
  steps: string[];
  note?: string;
}) => {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id));
  const toggle = () => {
    setCollapsed((current) => {
      writeCollapsed(id, !current);
      return !current;
    });
  };

  return (
    <section className="rounded-2xl border border-cyan-100 bg-cyan-50/60 px-4 py-3 dark:border-cyan-400/15 dark:bg-cyan-500/5" aria-label={title}>
      <button type="button" onClick={toggle} aria-expanded={!collapsed} className="flex w-full items-center justify-between gap-2 text-left text-sm font-semibold text-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:text-cyan-200">
        <span className="inline-flex items-center gap-2"><GraduationCap className="h-4 w-4" />{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
      </button>
      {!collapsed && (
        <div className="mt-2 text-sm text-gray-700 dark:text-gray-200">
          <ol className="list-decimal space-y-1 pl-5">
            {steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          {note && <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{note}</p>}
        </div>
      )}
    </section>
  );
};
