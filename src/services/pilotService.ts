import { supabase } from '@/lib/supabase';
import { assertPeopleCompany } from '@/services/peopleService';
import { contractErrorMessage } from '@/services/contractsService';
import { PilotCriterionConfirmation, PilotDecision, PilotMetrics, PilotSnapshot, PilotSnapshotKind } from '@/types';

export const pilotErrorMessage = contractErrorMessage;

export interface PilotSnapshotInput {
  label: string;
  kind: PilotSnapshotKind;
  periodFrom: string;
  periodTo: string;
  offlineSteps?: number;
  notes?: string;
  decision?: PilotDecision;
}

export interface PilotOverview {
  snapshots: PilotSnapshot[];
  criteria: PilotCriterionConfirmation[];
}

type RawMetrics = Record<string, unknown> & { acceptance?: Record<string, unknown> };

const num = (value: unknown) => (typeof value === 'number' ? value : Number(value) || 0);
const numOrNull = (value: unknown) => (value === null || value === undefined || value === '' ? null : Number(value));

/** Converte o JSON das RPCs (snake_case) para o formato da tela. */
export const mapPilotMetrics = (raw: RawMetrics): PilotMetrics => {
  const acceptance = raw.acceptance || {};
  return {
    periodFrom: String(raw.period_from || ''),
    periodTo: String(raw.period_to || ''),
    computedAt: String(raw.computed_at || ''),
    demandsClosed: num(raw.demands_closed),
    demandsClosedOnTime: num(raw.demands_closed_on_time),
    demandsOnTimePct: numOrNull(raw.demands_on_time_pct),
    demandsOpenWithoutResponsible: num(raw.demands_open_without_responsible),
    demandsOpenOverdue: num(raw.demands_open_overdue),
    replacementsClosed: num(raw.replacements_closed),
    replacementAvgDays: numOrNull(raw.replacement_avg_days),
    obligationItemsDue: num(raw.obligation_items_due),
    obligationItemsOnTime: num(raw.obligation_items_on_time),
    obligationItemsOnTimePct: numOrNull(raw.obligation_items_on_time_pct),
    packagesReady: num(raw.packages_ready),
    packagesSent: num(raw.packages_sent),
    usersTotal: num(raw.users_total),
    usersActive: num(raw.users_active),
    usersActivePct: numOrNull(raw.users_active_pct),
    acceptance: {
      contractsConfirmed: num(acceptance.contracts_confirmed),
      activePosts: num(acceptance.active_posts),
      activeAllocations: num(acceptance.active_allocations),
      demandsFullFlow: num(acceptance.demands_full_flow),
      periodsControlled: num(acceptance.periods_controlled),
      itemsOpenWithoutResponsible: num(acceptance.items_open_without_responsible),
    },
  };
};

export const getPilotIndicators = async (periodFrom: string, periodTo: string): Promise<PilotMetrics> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('pilot_indicators', { p_from: periodFrom, p_to: periodTo });
  if (error) throw new Error(pilotErrorMessage(error, 'Não foi possível calcular os indicadores.'));
  return mapPilotMetrics((data || {}) as RawMetrics);
};

interface SnapshotRow {
  id: string; label: string; kind: PilotSnapshotKind; period_from: string; period_to: string; metrics: RawMetrics;
  offline_steps?: number | null; notes?: string | null; decision?: PilotDecision | null; created_by?: string | null; created_at: string;
}
interface CriterionRow { criterion: number; is_confirmed: boolean; note?: string | null; updated_by?: string | null; updated_at: string }

export const getPilotOverview = async (): Promise<PilotOverview> => {
  const companyId = assertPeopleCompany();
  const [snapshots, criteria, profiles] = await Promise.all([
    supabase.from('service_pilot_snapshots').select('id, label, kind, period_from, period_to, metrics, offline_steps, notes, decision, created_by, created_at').eq('company_id', companyId).order('created_at', { ascending: false }),
    supabase.from('service_pilot_criteria').select('criterion, is_confirmed, note, updated_by, updated_at').eq('company_id', companyId).order('criterion'),
    supabase.from('profiles').select('id, name').eq('company_id', companyId),
  ]);
  const failed = [snapshots, criteria, profiles].find((response) => response.error);
  if (failed) throw new Error(pilotErrorMessage(failed.error, 'Não foi possível carregar o piloto.'));
  const names = new Map(((profiles.data || []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  const personName = (id?: string | null) => (id ? names.get(id) || 'Usuário removido' : undefined);

  return {
    snapshots: ((snapshots.data || []) as SnapshotRow[]).map((row) => ({
      id: row.id,
      label: row.label,
      kind: row.kind,
      periodFrom: row.period_from,
      periodTo: row.period_to,
      metrics: mapPilotMetrics(row.metrics || {}),
      offlineSteps: row.offline_steps ?? undefined,
      notes: row.notes || undefined,
      decision: row.decision || undefined,
      createdByName: personName(row.created_by),
      createdAt: row.created_at,
    })),
    criteria: ((criteria.data || []) as CriterionRow[]).map((row) => ({
      criterion: row.criterion,
      isConfirmed: row.is_confirmed,
      note: row.note || undefined,
      updatedByName: personName(row.updated_by),
      updatedAt: row.updated_at,
    })),
  };
};

export const capturePilotSnapshot = async (input: PilotSnapshotInput): Promise<string> => {
  assertPeopleCompany();
  const { data, error } = await supabase.rpc('capture_pilot_snapshot', {
    p_label: input.label.trim(),
    p_kind: input.kind,
    p_from: input.periodFrom,
    p_to: input.periodTo,
    p_offline_steps: input.offlineSteps ?? null,
    p_notes: input.notes?.trim() || null,
    p_decision: input.kind === 'final' ? input.decision || null : null,
  });
  if (error) throw new Error(pilotErrorMessage(error, 'Não foi possível salvar a medição.'));
  return data as string;
};

export const setPilotCriterion = async (criterion: number, confirmed: boolean, note?: string): Promise<void> => {
  assertPeopleCompany();
  const { error } = await supabase.rpc('set_pilot_criterion', {
    p_criterion: criterion,
    p_confirmed: confirmed,
    p_note: note?.trim() || null,
  });
  if (error) throw new Error(pilotErrorMessage(error, 'Não foi possível registrar o critério.'));
};
