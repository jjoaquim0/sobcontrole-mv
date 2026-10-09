import { PilotCriterionConfirmation, PilotDecision, PilotMetrics, PilotSnapshot, PilotSnapshotKind } from '@/types';
import { todayIso } from '@/pages/contracts/contractsDomain';

export { formatDate, todayIso } from '@/pages/contracts/contractsDomain';

export const SNAPSHOT_KIND_LABELS: Record<PilotSnapshotKind, string> = {
  baseline: 'Linha de base',
  checkpoint: 'Acompanhamento',
  final: 'Final',
};

export const DECISION_LABELS: Record<PilotDecision, string> = {
  expand: 'Ampliar',
  adjust: 'Ajustar',
  pause: 'Pausar',
};

export const MAX_PERIOD_DAYS = 400;

type MetricUnit = 'pct' | 'count' | 'days';
type NumericMetricKey = 'demandsOnTimePct' | 'demandsOpenWithoutResponsible' | 'demandsOpenOverdue' | 'replacementAvgDays'
  | 'obligationItemsOnTimePct' | 'packagesSent' | 'usersActivePct';

export interface IndicatorDefinition {
  key: NumericMetricKey;
  label: string;
  unit: MetricUnit;
  better: 'higher' | 'lower';
  detail: (metrics: PilotMetrics) => string;
}

/** Indicadores do roadmap §9, na mesma ordem. */
export const INDICATORS: IndicatorDefinition[] = [
  { key: 'demandsOnTimePct', label: 'Demandas concluídas no prazo', unit: 'pct', better: 'higher', detail: (m) => `${m.demandsClosedOnTime} de ${m.demandsClosed} concluída(s) com prazo no período` },
  { key: 'demandsOpenWithoutResponsible', label: 'Demandas abertas sem responsável', unit: 'count', better: 'lower', detail: () => 'Situação no momento do cálculo' },
  { key: 'demandsOpenOverdue', label: 'Demandas abertas vencidas', unit: 'count', better: 'lower', detail: () => 'Situação no momento do cálculo' },
  { key: 'replacementAvgDays', label: 'Tempo médio de reposição', unit: 'days', better: 'lower', detail: (m) => `${m.replacementsClosed} reposição(ões) encerrada(s) no período, da abertura à confirmação` },
  { key: 'obligationItemsOnTimePct', label: 'Itens de comprovação conferidos até o prazo', unit: 'pct', better: 'higher', detail: (m) => `${m.obligationItemsOnTime} de ${m.obligationItemsDue} item(ns) com prazo no período` },
  { key: 'packagesSent', label: 'Pacotes mensais enviados com comprovante', unit: 'count', better: 'higher', detail: (m) => `${m.packagesReady} pacote(s) pronto(s) aguardando envio agora` },
  { key: 'usersActivePct', label: 'Usuários que registraram no sistema', unit: 'pct', better: 'higher', detail: (m) => `${m.usersActive} de ${m.usersTotal} usuário(s) da empresa no período` },
];

const decimal = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const formatMetric = (value: number | null | undefined, unit: MetricUnit) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (unit === 'pct') return `${decimal(value)}%`;
  if (unit === 'days') return `${decimal(value)} ${value === 1 ? 'dia' : 'dias'}`;
  return String(value);
};

export type ComparisonTone = 'better' | 'worse' | 'same' | 'none';

export interface MetricComparison {
  tone: ComparisonTone;
  text: string;
}

/** Diferença entre a medição atual e a linha de base, com o sentido de "melhor". */
export const compareMetric = (
  current: number | null | undefined,
  baseline: number | null | undefined,
  unit: MetricUnit,
  better: 'higher' | 'lower',
): MetricComparison => {
  if (current === null || current === undefined || baseline === null || baseline === undefined) {
    return { tone: 'none', text: 'Sem base para comparar' };
  }
  const delta = Math.round((current - baseline) * 10) / 10;
  if (delta === 0) return { tone: 'same', text: 'Igual à linha de base' };
  const improved = better === 'higher' ? delta > 0 : delta < 0;
  const sign = delta > 0 ? '+' : '−';
  const amount = Math.abs(delta);
  const formatted = unit === 'pct' ? `${decimal(amount)} p.p.` : unit === 'days' ? `${decimal(amount)} ${amount === 1 ? 'dia' : 'dias'}` : String(amount);
  return { tone: improved ? 'better' : 'worse', text: `${sign}${formatted} em relação à linha de base` };
};

const shiftDays = (iso: string, days: number) => {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};

/** Período padrão: últimos 30 dias até hoje. */
export const defaultPilotPeriod = (today: string = todayIso()) => ({ from: shiftDays(today, -29), to: today });

export const periodLengthDays = (from: string, to: string) => {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
};

export const validatePeriod = (from: string, to: string): string | undefined => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 'Informe as duas datas do período.';
  const length = periodLengthDays(from, to);
  if (Number.isNaN(length) || length < 0) return 'A data inicial deve ser anterior à final.';
  if (length > MAX_PERIOD_DAYS) return `Use um período de até ${MAX_PERIOD_DAYS} dias.`;
  return undefined;
};

/** A linha de base é a medição "baseline" mais antiga; a última é a mais recente de qualquer tipo. */
export const pickBaseline = (snapshots: PilotSnapshot[]) =>
  [...snapshots].filter((snapshot) => snapshot.kind === 'baseline').sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];

export const pickFinal = (snapshots: PilotSnapshot[]) =>
  [...snapshots].filter((snapshot) => snapshot.kind === 'final').sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

export type CriterionState = 'met' | 'pending';

export interface CriterionStatus {
  number: number;
  title: string;
  mode: 'auto' | 'manual';
  state: CriterionState;
  evidence: string;
  next: string;
  confirmation?: PilotCriterionConfirmation;
}

/** Critérios de aceite do MVP (roadmap §11). Os manuais dependem de confirmação registrada. */
export const evaluateCriteria = (
  metrics: PilotMetrics | undefined,
  confirmations: PilotCriterionConfirmation[],
  snapshots: PilotSnapshot[],
): CriterionStatus[] => {
  const a = metrics?.acceptance;
  const confirmation = (number: number) => confirmations.find((item) => item.criterion === number);
  const manual = (number: number, title: string, next: string): CriterionStatus => {
    const confirmed = confirmation(number);
    return {
      number,
      title,
      mode: 'manual',
      state: confirmed?.isConfirmed ? 'met' : 'pending',
      evidence: confirmed?.isConfirmed ? `Confirmado por ${confirmed.updatedByName || 'gestor'}: ${confirmed.note}` : 'Aguardando confirmação de um gestor.',
      next,
      confirmation: confirmed,
    };
  };
  const finalSnapshot = pickFinal(snapshots);

  return [
    {
      number: 1,
      title: 'Contrato piloto com vigência conferida, postos e equipe cadastrados',
      mode: 'auto',
      state: a && a.contractsConfirmed > 0 && a.activePosts > 0 && a.activeAllocations > 0 ? 'met' : 'pending',
      evidence: a ? `${a.contractsConfirmed} contrato(s) ativo(s) conferido(s), ${a.activePosts} posto(s) ativo(s), ${a.activeAllocations} alocação(ões) vigente(s).` : 'Indicadores ainda não calculados.',
      next: 'Em Contratos: confira a vigência, cadastre os postos e aloque a equipe.',
    },
    {
      number: 2,
      title: 'Uma demanda de reposição ou ocorrência percorreu o fluxo completo',
      mode: 'auto',
      state: a && a.demandsFullFlow > 0 ? 'met' : 'pending',
      evidence: a ? `${a.demandsFullFlow} demanda(s) encerrada(s) com responsável, prazo e mudança de etapa no histórico.` : 'Indicadores ainda não calculados.',
      next: 'Em Demandas: abra uma reposição real, defina responsável e prazo e leve até o encerramento.',
    },
    {
      number: 3,
      title: 'Documentos e obrigações de uma competência controlados e conferidos',
      mode: 'auto',
      state: a && a.periodsControlled > 0 ? 'met' : 'pending',
      evidence: a ? `${a.periodsControlled} competência(s) com pacote pronto ou enviado.` : 'Indicadores ainda não calculados.',
      next: 'Em Obrigações: abra a competência, confira todos os itens e feche o pacote.',
    },
    manual(4, 'Usuários operam sem ver dados fora do seu papel', 'Entre com um usuário de cada papel e confirme que ele só vê o que deve.'),
    manual(5, 'Equipe piloto treinada e repetindo o processo pelas instruções do sistema', 'Faça o treinamento usando os painéis "Como usar esta tela" e registre a data e os participantes.'),
    {
      number: 6,
      title: 'Pendências externas aparecem com dono e próximo passo',
      mode: 'auto',
      state: a && metrics && metrics.demandsOpenWithoutResponsible === 0 && a.itemsOpenWithoutResponsible === 0 ? 'met' : 'pending',
      evidence: a && metrics
        ? `${metrics.demandsOpenWithoutResponsible} demanda(s) aberta(s) e ${a.itemsOpenWithoutResponsible} item(ns) de obrigação sem responsável. O sistema não declara conformidade legal: ele só mostra quem cuida de cada pendência.`
        : 'Indicadores ainda não calculados.',
      next: 'Defina um responsável para cada demanda aberta e cada item de obrigação pendente.',
    },
    {
      number: 7,
      title: 'Direção revisou os indicadores e decidiu o próximo ciclo',
      mode: 'auto',
      state: finalSnapshot?.decision ? 'met' : 'pending',
      evidence: finalSnapshot?.decision
        ? `Medição final "${finalSnapshot.label}": decisão ${DECISION_LABELS[finalSnapshot.decision].toLowerCase()}.`
        : 'Nenhuma medição final com decisão registrada.',
      next: 'Salve a medição final com a decisão da direção (ampliar, ajustar ou pausar) e os motivos.',
    },
  ];
};

export const summarizeCriteria = (criteria: CriterionStatus[]) => ({
  met: criteria.filter((criterion) => criterion.state === 'met').length,
  total: criteria.length,
});
