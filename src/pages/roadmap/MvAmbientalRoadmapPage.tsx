import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  Flag,
  Gauge,
  GitBranch,
  Layers,
  ListChecks,
  Printer,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  acceptanceCriteria,
  backlogMatrix,
  contracts,
  designNotes,
  discoveryDecisions,
  fitGapColumns,
  flows,
  indicators,
  indicatorsNote,
  nextStep,
  objective,
  objectiveChain,
  phases,
  pilotOutcomes,
  prioritizationRule,
  risks,
  roadmapMeta,
  roles,
  rolesNote,
  scope,
  type Priority,
} from './mvAmbientalRoadmap';

const cardClass =
  'rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-white/5 dark:bg-[#1a1d27] print:break-inside-avoid print:shadow-none';

const priorityStyles: Record<Priority, string> = {
  P0: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-400/15 dark:text-cyan-300',
  P1: 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  P2: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300',
};

const phaseBarStyles = [
  'from-[#0B2551] to-[#14457f]',
  'from-[#14457f] to-[#1d68a6]',
  'from-[#1d68a6] to-[#0f8fc0]',
  'from-[#0f8fc0] to-[#00a8d8]',
  'from-[#00a8d8] to-[#00c2ec]',
  'from-[#00c2ec] to-[#00d2ff]',
];

const sections = [
  { id: 'objetivo', label: 'Objetivo' },
  { id: 'resultados', label: 'Resultados' },
  { id: 'cronograma', label: 'Cronograma' },
  { id: 'escopo', label: 'Escopo' },
  { id: 'contratos', label: 'Contratos' },
  { id: 'fluxos', label: 'Fluxos' },
  { id: 'prioridades', label: 'Prioridades' },
  { id: 'papeis', label: 'Papéis' },
  { id: 'indicadores', label: 'Indicadores' },
  { id: 'riscos', label: 'Riscos' },
  { id: 'aceite', label: 'Aceite' },
  { id: 'proximo-passo', label: 'Próximo passo' },
];

const SectionTitle: React.FC<{ id: string; number: number; title: string; icon: React.ComponentType<{ className?: string }> }> = ({ id, number, title, icon: Icon }) => (
  <div id={id} className="mb-4 flex scroll-mt-6 items-center gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B2551] to-[#00a8d8] text-white shadow-md shadow-[#00d2ff]/10">
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/40">Seção {number}</p>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
    </div>
  </div>
);

const PriorityBadge: React.FC<{ priority: Priority }> = ({ priority }) => (
  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${priorityStyles[priority]}`}>{priority}</span>
);

export const MvAmbientalRoadmapPage: React.FC = () => {
  const [activeScope, setActiveScope] = useState<Priority>('P0');
  const weeks = Array.from({ length: roadmapMeta.horizonWeeks }, (_, index) => index + 1);
  const p0Count = scope.P0.items.length;

  return (
    <div className="mx-auto max-w-6xl space-y-10 animate-fade-in pb-16 print:max-w-none print:space-y-6">
      <PageHeader
        title={`${roadmapMeta.title} — ${roadmapMeta.client}`}
        subtitle={`Versão ${roadmapMeta.version} · ${roadmapMeta.date} · Horizonte de ${roadmapMeta.horizonWeeks} semanas`}
        action={
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#0B2551] to-[#00a8d8] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:brightness-110 print:hidden"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
        }
      />

      {/* Capa */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B2551] via-[#123a72] to-[#00a8d8] p-8 text-white shadow-xl sm:p-10 print:break-inside-avoid">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Proposta de produto · {roadmapMeta.client}</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-bold leading-snug sm:text-3xl">{roadmapMeta.direction}</h2>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { value: `${roadmapMeta.horizonWeeks}`, label: 'semanas' },
            { value: `${phases.length}`, label: 'fases' },
            { value: `${p0Count}`, label: 'itens essenciais (P0)' },
            { value: '1', label: 'contrato piloto' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="mt-1 text-xs text-cyan-100">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Navegação de seções */}
      <nav aria-label="Seções do roadmap" className="sticky top-0 z-10 -mx-1 flex gap-2 overflow-x-auto rounded-2xl bg-[#f8fafc]/90 px-1 py-2 backdrop-blur dark:bg-[#0a0b0e]/90 print:hidden">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-[#00a8d8] hover:text-[#007fa3] dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:text-[#53dcff]"
          >
            {section.label}
          </a>
        ))}
      </nav>

      {/* 1. Objetivo */}
      <section>
        <SectionTitle id="objetivo" number={1} title="Objetivo" icon={Target} />
        <div className={cardClass}>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {objectiveChain.map((item, index) => (
              <React.Fragment key={item}>
                <span className="rounded-xl bg-cyan-50 px-3 py-2 text-sm font-semibold text-[#0B2551] dark:bg-cyan-400/10 dark:text-cyan-200">{item}</span>
                {index < objectiveChain.length - 1 && <ArrowRight className="h-4 w-4 text-gray-300 dark:text-white/30" aria-hidden="true" />}
              </React.Fragment>
            ))}
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {objective.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        </div>
      </section>

      {/* 2. Resultados esperados */}
      <section>
        <SectionTitle id="resultados" number={2} title="Resultado esperado para o piloto" icon={Flag} />
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">Ao final do piloto, usuários da MV Ambiental deverão conseguir:</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {pilotOutcomes.map((outcome, index) => (
            <div key={outcome} className={`${cardClass} !p-5`}>
              <span className="text-2xl font-bold text-[#00a8d8]">{String(index + 1).padStart(2, '0')}</span>
              <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-200">{outcome}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Cronograma */}
      <section>
        <SectionTitle id="cronograma" number={3} title={`Roadmap de ${roadmapMeta.horizonWeeks} semanas`} icon={CalendarRange} />
        <div className={cardClass}>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-[230px_repeat(12,minmax(0,1fr))] gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40">
                <span className="text-left">Fase</span>
                {weeks.map((week) => <span key={week}>S{week}</span>)}
              </div>
              <div className="mt-2 space-y-2">
                {phases.map((phase, index) => (
                  <div key={phase.id} className="grid grid-cols-[230px_repeat(12,minmax(0,1fr))] items-center gap-1">
                    <span className="truncate pr-2 text-sm font-medium text-gray-700 dark:text-gray-200" title={phase.name}>
                      {phase.id}. {phase.name}
                    </span>
                    <div
                      className={`h-8 rounded-lg bg-gradient-to-r ${phaseBarStyles[index % phaseBarStyles.length]} flex items-center justify-center text-[11px] font-semibold text-white shadow-sm print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]`}
                      style={{ gridColumn: `${phase.weekStart + 1} / ${phase.weekEnd + 2}` }}
                    >
                      Semanas {phase.weekStart}–{phase.weekEnd}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {phases.map((phase, index) => (
            <article key={phase.id} className={cardClass}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${phaseBarStyles[index % phaseBarStyles.length]} text-sm font-bold text-white`}>{phase.id}</span>
                  <h3 className="font-bold text-gray-900 dark:text-white">{phase.name}</h3>
                </div>
                <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  Semanas {phase.weekStart}–{phase.weekEnd}
                </span>
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40">Entregas</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {phase.deliverables.map((deliverable) => (
                  <li key={deliverable} className="rounded-lg bg-gray-50 px-2.5 py-1 text-xs text-gray-700 dark:bg-white/[0.04] dark:text-gray-300">{deliverable}</li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs leading-relaxed text-emerald-900 dark:border-emerald-400/10 dark:bg-emerald-400/5 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <p><span className="font-semibold">Critério de saída:</span> {phase.exitCriteria}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200 print:break-inside-avoid">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <p><span className="font-semibold">Regra de priorização:</span> {prioritizationRule}</p>
        </div>
      </section>

      {/* 4. Escopo */}
      <section>
        <SectionTitle id="escopo" number={4} title="Escopo do MVP" icon={Layers} />
        <div role="tablist" aria-label="Prioridade do escopo" className="mb-4 flex flex-wrap gap-2 print:hidden">
          {(Object.keys(scope) as Priority[]).map((priority) => (
            <button
              key={priority}
              type="button"
              role="tab"
              aria-selected={activeScope === priority}
              onClick={() => setActiveScope(priority)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                activeScope === priority
                  ? 'bg-gradient-to-r from-[#0B2551] to-[#00a8d8] text-white shadow-md'
                  : 'border border-gray-200 bg-white text-gray-600 hover:text-gray-900 dark:border-white/10 dark:bg-white/5 dark:text-white/70'
              }`}
            >
              {priority} · {scope[priority].label}
              <span className={`rounded-full px-1.5 text-[11px] ${activeScope === priority ? 'bg-white/20' : 'bg-gray-100 dark:bg-white/10'}`}>{scope[priority].items.length}</span>
            </button>
          ))}
        </div>

        {(Object.keys(scope) as Priority[]).map((priority) => (
          <div key={priority} role="tabpanel" className={`${activeScope === priority ? 'block' : 'hidden'} print:mb-4 print:block`}>
            <p className="mb-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <PriorityBadge priority={priority} /> <span className="font-semibold text-gray-700 dark:text-gray-200">{scope[priority].label}.</span> {scope[priority].summary}
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {scope[priority].items.map((item) => (
                <div key={item.title} className={`${cardClass} !p-4 ${priority === 'P2' ? 'opacity-80' : ''}`}>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{item.title}</p>
                  {item.description && <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{item.description}</p>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* 5. Contratos */}
      <section>
        <SectionTitle id="contratos" number={5} title="Uso dos contratos no desenho do produto" icon={FileSignature} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {contracts.map((contract) => (
            <article key={contract.title} className={cardClass}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-gray-900 dark:text-white">{contract.title}</h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    contract.tone === 'positive'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300'
                  }`}
                >
                  {contract.badge}
                </span>
              </div>
              {contract.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{paragraph}</p>
              ))}
              {contract.chain.length > 0 && (
                <>
                  <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/40">Fluxo completo testado com escopo pequeno</p>
                  <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {contract.chain.map((step, index) => (
                      <li key={step} className="flex items-center gap-1.5">
                        <span className="rounded-lg bg-cyan-50 px-2 py-1 font-medium text-[#0B2551] dark:bg-cyan-400/10 dark:text-cyan-200">{step}</span>
                        {index < contract.chain.length - 1 && <ArrowRight className="h-3 w-3 text-gray-300" aria-hidden="true" />}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </article>
          ))}
          {designNotes.map((note) => (
            <article key={note.title} className={cardClass}>
              <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <ShieldCheck className="h-4 w-4 text-[#00a8d8]" />
                {note.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{note.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 6. Fluxos */}
      <section>
        <SectionTitle id="fluxos" number={6} title="Fluxos prioritários a validar" icon={GitBranch} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {flows.map((flow) => (
            <article key={flow.id} className={cardClass}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-sm font-bold text-[#0B2551] dark:bg-cyan-400/10 dark:text-cyan-200">{flow.id}</span>
                <h3 className="font-bold text-gray-900 dark:text-white">{flow.title}</h3>
              </div>
              <ol className="mt-4 space-y-3 border-l-2 border-cyan-100 pl-4 dark:border-cyan-400/20">
                {flow.steps.map((step, index) => (
                  <li key={step} className="relative text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                    <span className="absolute -left-[27px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-[#00a8d8] text-[10px] font-bold text-white">{index + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </section>

      {/* 7. Matriz de prioridade */}
      <section>
        <SectionTitle id="prioridades" number={7} title="Matriz de prioridade do backlog" icon={ListChecks} />
        <div className={`${cardClass} overflow-x-auto !p-0`}>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.03] dark:text-white/40">
              <tr>
                <th className="px-5 py-3 font-semibold">Prioridade</th>
                <th className="px-5 py-3 font-semibold">Item</th>
                <th className="px-5 py-3 font-semibold">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {backlogMatrix.map((row) => (
                <tr key={row.item}>
                  <td className="px-5 py-3"><PriorityBadge priority={row.priority} /></td>
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{row.item}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 8. Papéis */}
      <section>
        <SectionTitle id="papeis" number={8} title="Papéis de trabalho sugeridos" icon={Users} />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((item) => (
            <div key={item.role} className={`${cardClass} !p-5`}>
              <p className="font-semibold text-gray-900 dark:text-white">{item.role}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600 dark:text-gray-300">{item.responsibility}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs italic text-gray-500 dark:text-gray-400">{rolesNote}</p>
      </section>

      {/* 9. Indicadores */}
      <section>
        <SectionTitle id="indicadores" number={9} title="Indicadores do piloto" icon={Gauge} />
        <div className={cardClass}>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {indicators.map((indicator) => (
              <li key={indicator} className="flex gap-2 text-sm text-gray-700 dark:text-gray-200">
                <Gauge className="mt-0.5 h-4 w-4 shrink-0 text-[#00a8d8]" />
                {indicator}
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-xl bg-gray-50 p-3 text-xs leading-relaxed text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">{indicatorsNote}</p>
        </div>
      </section>

      {/* 10. Riscos */}
      <section>
        <SectionTitle id="riscos" number={10} title="Riscos, dependências e decisões" icon={AlertTriangle} />
        <div className={`${cardClass} overflow-x-auto !p-0`}>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 dark:bg-white/[0.03] dark:text-white/40">
              <tr>
                <th className="px-5 py-3 font-semibold">Risco / dependência</th>
                <th className="px-5 py-3 font-semibold">Tratamento proposto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {risks.map((row) => (
                <tr key={row.risk}>
                  <td className="w-2/5 px-5 py-3 font-medium text-gray-900 dark:text-white">{row.risk}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{row.treatment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`${cardClass} mt-4`}>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Decisões a tomar na descoberta</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {discoveryDecisions.map((decision) => (
              <li key={decision} className="rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-700 dark:border-white/15 dark:text-gray-300">{decision}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 11. Critérios de aceite */}
      <section>
        <SectionTitle id="aceite" number={11} title="Critérios de aceite do MVP" icon={ClipboardCheck} />
        <div className={cardClass}>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">O piloto está pronto para decisão de expansão quando:</p>
          <ol className="space-y-3">
            {acceptanceCriteria.map((criterion, index) => (
              <li key={criterion} className="flex gap-3 text-sm text-gray-700 dark:text-gray-200">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300">{index + 1}</span>
                <span className="pt-0.5">{criterion}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 12. Próximo passo */}
      <section>
        <SectionTitle id="proximo-passo" number={12} title="Próximo passo para tornar o roadmap técnico" icon={ArrowRight} />
        <div className={cardClass}>
          <div className="space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {nextStep.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {fitGapColumns.map((column) => (
              <div key={column} className="rounded-xl border border-gray-200 p-3 text-center text-sm font-semibold text-gray-700 dark:border-white/10 dark:text-gray-200">{column}</div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
