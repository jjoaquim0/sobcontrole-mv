import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Flag, Loader2, Save } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { HowToPanel } from '@/components/shared/HowToPanel';
import { usePilot } from '@/hooks/usePilot';
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/pages/contracts/components/ContractPrimitives';
import { Badge } from '@/pages/peopleDocs/components/PeopleDocsPrimitives';
import { ReasonModal } from '@/pages/demands/components/DemandFormModals';
import {
  compareMetric,
  ComparisonTone,
  CriterionStatus,
  DECISION_LABELS,
  defaultPilotPeriod,
  evaluateCriteria,
  formatDate,
  formatMetric,
  INDICATORS,
  pickBaseline,
  pickFinal,
  SNAPSHOT_KIND_LABELS,
  summarizeCriteria,
  validatePeriod,
} from './pilotDomain';
import { SnapshotModal } from './components/SnapshotModal';

const comparisonClass: Record<ComparisonTone, string> = {
  better: 'text-emerald-700 dark:text-emerald-300',
  worse: 'text-red-600 dark:text-red-400',
  same: 'text-gray-500',
  none: 'text-gray-400',
};

const criterionLinks: Record<number, string> = { 1: '/contratos', 2: '/demandas', 3: '/obrigacoes', 6: '/painel-operacional' };

export const PilotPage = () => {
  const [period, setPeriod] = useState(defaultPilotPeriod);
  const periodError = validatePeriod(period.from, period.to);
  const { indicators, overview, captureSnapshot, isCapturing, setCriterion, isSettingCriterion } = usePilot(period, !periodError);
  const [isSnapshotOpen, setSnapshotOpen] = useState(false);
  const [confirming, setConfirming] = useState<CriterionStatus>();

  const snapshots = useMemo(() => overview.data?.snapshots || [], [overview.data]);
  const baseline = pickBaseline(snapshots);
  const finalSnapshot = pickFinal(snapshots);
  const criteria = useMemo(
    () => evaluateCriteria(indicators.data, overview.data?.criteria || [], snapshots),
    [indicators.data, overview.data, snapshots],
  );
  const criteriaSummary = summarizeCriteria(criteria);

  if (overview.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-700" /></div>;
  if (overview.isError) {
    return <div role="alert" className={`${cardClass} p-10 text-center`}><h1 className="font-bold text-gray-900 dark:text-white">Não foi possível carregar o piloto.</h1><button type="button" onClick={() => overview.refetch()} className="mt-4 text-sm font-semibold text-cyan-700">Tentar de novo</button></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader
        title="Piloto"
        subtitle="Indicadores do piloto, comparação com a linha de base, critérios de aceite e decisão de expansão."
        action={<button type="button" disabled={Boolean(periodError)} onClick={() => setSnapshotOpen(true)} className={primaryButtonClass}><Save className="h-4 w-4" />Salvar medição</button>}
      />
      <HowToPanel
        id="piloto"
        steps={[
          'No início do piloto, escolha o período e salve a medição como "Linha de base".',
          'A cada semana, salve uma medição de acompanhamento e compare com a linha de base.',
          'Conte com a equipe quantas etapas ainda dependem de planilha ou cobrança informal e registre na medição.',
          'Confirme os critérios manuais (permissões e treinamento) descrevendo como foram verificados.',
          'No fim, a direção registra a medição final com a decisão: ampliar, ajustar ou pausar.',
        ]}
        note="Defina metas só depois de medir a linha de base. Os números vêm do que foi registrado no sistema; o que ficou fora dele não aparece."
      />

      {finalSnapshot?.decision && (
        <p className="flex flex-wrap items-center gap-2 rounded-xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:bg-cyan-500/10 dark:text-cyan-100">
          <Flag className="h-4 w-4" /><span className="font-semibold">Decisão da direção: {DECISION_LABELS[finalSnapshot.decision]}.</span>
          {finalSnapshot.notes && <span>{finalSnapshot.notes}</span>}
        </p>
      )}

      <section className={`${cardClass} grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]`} aria-label="Período">
        <label><span className={labelClass}>Início</span><input type="date" className={inputClass} value={period.from} onChange={(event) => setPeriod((current) => ({ ...current, from: event.target.value }))} /></label>
        <label><span className={labelClass}>Fim</span><input type="date" className={inputClass} value={period.to} onChange={(event) => setPeriod((current) => ({ ...current, to: event.target.value }))} /></label>
        <button type="button" onClick={() => setPeriod(defaultPilotPeriod())} className={secondaryButtonClass}>Últimos 30 dias</button>
        {periodError && <p role="alert" className="text-xs font-semibold text-red-600 sm:col-span-3">{periodError}</p>}
        {baseline && <p className="text-xs text-gray-500 sm:col-span-3">Comparando com a linha de base "{baseline.label}" ({formatDate(baseline.periodFrom)} a {formatDate(baseline.periodTo)}).</p>}
      </section>

      <section aria-label="Indicadores do piloto" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {indicators.isLoading && <div className={`${cardClass} flex items-center justify-center sm:col-span-2 xl:col-span-4`}><Loader2 className="h-6 w-6 animate-spin text-cyan-700" /></div>}
        {indicators.isError && <p role="alert" className={`${cardClass} text-sm text-red-600 sm:col-span-2 xl:col-span-4`}>{indicators.error.message}</p>}
        {indicators.data && INDICATORS.map((indicator) => {
          const value = indicators.data[indicator.key];
          const comparison = compareMetric(value, baseline?.metrics[indicator.key], indicator.unit, indicator.better);
          return (
            <article key={indicator.key} className={`${cardClass} space-y-1`} aria-label={indicator.label}>
              <p className="text-xs font-semibold text-gray-500">{indicator.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMetric(value, indicator.unit)}</p>
              <p className="text-xs text-gray-500">{indicator.detail(indicators.data)}</p>
              {baseline && <p className={`text-xs font-semibold ${comparisonClass[comparison.tone]}`}>{comparison.text}</p>}
            </article>
          );
        })}
        {indicators.data && (
          <article className={`${cardClass} space-y-1`} aria-label="Etapas fora do sistema">
            <p className="text-xs font-semibold text-gray-500">Etapas ainda em planilha ou cobrança informal</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{snapshots[0]?.offlineSteps ?? '—'}</p>
            <p className="text-xs text-gray-500">{snapshots[0]?.offlineSteps !== undefined ? `Informado na medição "${snapshots[0].label}"` : 'Informe ao salvar uma medição'}</p>
            {baseline && snapshots[0] && snapshots[0].id !== baseline.id && (
              <p className={`text-xs font-semibold ${comparisonClass[compareMetric(snapshots[0].offlineSteps, baseline.offlineSteps, 'count', 'lower').tone]}`}>
                {compareMetric(snapshots[0].offlineSteps, baseline.offlineSteps, 'count', 'lower').text}
              </p>
            )}
          </article>
        )}
      </section>

      <section className={`${cardClass} space-y-4`} aria-label="Critérios de aceite do MVP">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-gray-900 dark:text-white">Critérios de aceite do MVP</h2>
          <Badge color={criteriaSummary.met === criteriaSummary.total ? 'green' : 'amber'}>{`${criteriaSummary.met} de ${criteriaSummary.total} atendidos`}</Badge>
        </div>
        <ol className="divide-y divide-gray-100 dark:divide-white/5" aria-label="Lista de critérios">
          {criteria.map((criterion) => (
            <li key={criterion.number} data-state={criterion.state} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="flex min-w-0 flex-1 gap-3">
                {criterion.state === 'met' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Atendido" /> : <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-300" aria-label="Pendente" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{criterion.number}. {criterion.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{criterion.evidence}</p>
                  {criterion.state === 'pending' && (
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                      Próximo passo: {criterion.next}
                      {criterionLinks[criterion.number] && <> <Link to={criterionLinks[criterion.number]} className="font-semibold underline">Abrir</Link></>}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge color="gray">{criterion.mode === 'auto' ? 'Automático' : 'Confirmação manual'}</Badge>
                {criterion.mode === 'manual' && (criterion.state === 'met'
                  ? <button type="button" disabled={isSettingCriterion} onClick={() => { setCriterion({ number: criterion.number, confirmed: false }).catch(() => undefined); }} className={secondaryButtonClass}>Retirar</button>
                  : <button type="button" onClick={() => setConfirming(criterion)} className={secondaryButtonClass}>Confirmar</button>)}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${cardClass} space-y-3`} aria-label="Medições salvas">
        <h2 className="font-bold text-gray-900 dark:text-white">Medições salvas</h2>
        {snapshots.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma medição ainda. Salve a linha de base antes de começar a operação assistida.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs text-gray-500">
                <tr>
                  <th className="py-2 pr-3 font-semibold">Medição</th>
                  <th className="py-2 pr-3 font-semibold">Período</th>
                  {INDICATORS.map((indicator) => <th key={indicator.key} className="py-2 pr-3 font-semibold">{indicator.label}</th>)}
                  <th className="py-2 pr-3 font-semibold">Etapas fora do sistema</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {snapshots.map((snapshot) => (
                  <tr key={snapshot.id}>
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-gray-900 dark:text-white">{snapshot.label}</p>
                      <p className="text-xs text-gray-500">{SNAPSHOT_KIND_LABELS[snapshot.kind]}{snapshot.decision ? ` · ${DECISION_LABELS[snapshot.decision]}` : ''} · {snapshot.createdByName || 'Usuário'}</p>
                    </td>
                    <td className="py-2 pr-3 text-xs text-gray-500">{formatDate(snapshot.periodFrom)} a {formatDate(snapshot.periodTo)}</td>
                    {INDICATORS.map((indicator) => <td key={indicator.key} className="py-2 pr-3">{formatMetric(snapshot.metrics[indicator.key], indicator.unit)}</td>)}
                    <td className="py-2 pr-3">{snapshot.offlineSteps ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SnapshotModal
        isOpen={isSnapshotOpen}
        period={period}
        hasBaseline={Boolean(baseline)}
        isLoading={isCapturing}
        onClose={() => setSnapshotOpen(false)}
        onSave={async (input) => { await captureSnapshot(input); setSnapshotOpen(false); }}
      />
      <ReasonModal
        isOpen={Boolean(confirming)}
        title="Confirmar critério de aceite"
        subtitle={confirming?.title}
        label="Como foi verificado (data, pessoas, teste feito)"
        submitLabel="Confirmar"
        isLoading={isSettingCriterion}
        onClose={() => setConfirming(undefined)}
        onSave={async (note) => { if (confirming) await setCriterion({ number: confirming.number, confirmed: true, note }); setConfirming(undefined); }}
      />
    </div>
  );
};
