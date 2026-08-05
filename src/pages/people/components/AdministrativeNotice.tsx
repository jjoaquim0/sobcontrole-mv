import { Info } from 'lucide-react';

export const AdministrativeNotice = () => (
  <aside
    aria-label="Aviso sobre o uso administrativo da área Pessoas"
    className="flex items-start gap-3 rounded-2xl border border-sky-200/80 bg-sky-50/80 p-4 text-sky-950 dark:border-sky-400/15 dark:bg-sky-400/10 dark:text-sky-100"
  >
    <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600 dark:text-sky-300" aria-hidden="true" />
    <div className="space-y-1 text-xs leading-relaxed sm:text-sm">
      <p>
        Esta área é destinada ao gerenciamento interno de funcionários, metas e comissões. O SobControle não realiza cálculos de folha de pagamento, impostos, FGTS, INSS, férias, rescisões ou outras obrigações trabalhistas, fiscais ou contábeis.
      </p>
      <p className="text-sky-800 dark:text-sky-200/80">
        Antes de efetuar pagamentos ou cumprir obrigações legais, valide as informações com o profissional responsável.
      </p>
    </div>
  </aside>
);
