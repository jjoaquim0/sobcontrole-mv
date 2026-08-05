/**
 * Story 1.30 — Serviço de apuração tributária.
 *
 * Orquestra: carrega perfil, catálogo, classificação e receita; roda o motor
 * puro (`taxCalculation.ts`); grava o snapshot; gera a guia e o espelho
 * financeiro.
 *
 * Toda consulta filtra `company_id` explicitamente, mesmo com a RLS ativa —
 * defesa em profundidade, no padrão dos demais serviços do projeto.
 */

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import {
  calculateTaxAssessment,
  type AssessmentRevenueItem,
  type MonthlyRevenueEntry,
  type TaxBracketComponentRow,
  type TaxBracketRow,
  type TaxCalculationResult,
  type TaxCatalog,
  type TaxProfileForCalculation,
} from './taxCalculation';
import {
  buildClassificationSources,
  calculateClassificationCoverage,
  type ClassificationSourceRow,
} from './taxClassification';
import {
  deriveTaxProfile,
  type CnaeAnexoMapEntry,
  type DerivedTaxProfile,
  type SimplesAnexo,
} from './taxProfileDerivation';

const requireCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

export const assertTaxManagementAccess = (): void => {
  const role = useAuthStore.getState().profile?.role;
  if (role !== 'admin' && role !== 'manager') {
    throw new Error('Apenas administradores e gerentes podem acessar o módulo tributário.');
  }
};

/** Quantos meses de histórico o RBT12 exige, mais folga para o Fator R. */
const HISTORY_MONTHS = 13;

const monthStart = (month: string): string => `${month}-01`;

const shiftMonth = (month: string, delta: number): string => {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
};

/** Último dia do mês, sem depender de fuso: usa o dia 0 do mês seguinte. */
const monthEnd = (month: string): string => {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 0));
  return date.toISOString().slice(0, 10);
};

export interface TaxProfileRecord extends TaxProfileForCalculation {
  id: string;
  revenueBasis: 'competencia' | 'caixa';
  uf: string;
  municipio: string;
  needsReconfirmation: boolean;
  reconfirmationReason: string | null;
  sourceFetchedAt: string | null;
}

export const getTaxProfile = async (): Promise<TaxProfileRecord | null> => {
  assertTaxManagementAccess();
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('company_tax_profile')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: String(data.id),
    regime: data.regime,
    anexo: (data.simples_anexo ?? null) as SimplesAnexo | null,
    meiActivityType: data.mei_activity_type ?? null,
    fatorREnabled: Boolean(data.fator_r_enabled),
    rbt12Initial: Number(data.rbt12_initial ?? 0),
    rbt12InitialReferenceMonth: data.rbt12_initial_reference_month
      ? String(data.rbt12_initial_reference_month).slice(0, 7)
      : null,
    // Perfil sem confirmação explícita não habilita apuração.
    isConfirmed: Boolean(data.confirmed_at),
    ibsCbsRegime: data.ibs_cbs_regime ?? 'simples',
    revenueBasis: data.revenue_basis ?? 'competencia',
    uf: data.uf ?? '',
    municipio: data.municipio ?? '',
    needsReconfirmation: Boolean(data.needs_reconfirmation),
    reconfirmationReason: data.reconfirmation_reason ?? null,
    sourceFetchedAt: data.source_fetched_at ?? null,
  };
};

export interface RegistryLookupResult {
  derived: DerivedTaxProfile;
  source: string;
  fetchedAt: string;
  cached: boolean;
  stale: boolean;
}

/**
 * Consulta o cadastro da Receita pela Edge Function e deriva o regime.
 * O CNPJ não é enviado: a função lê o da empresa do próprio usuário.
 */
export const lookupCompanyRegistry = async (): Promise<RegistryLookupResult> => {
  assertTaxManagementAccess();

  const { data: session } = await supabase.auth.getSession();
  const accessToken = session.session?.access_token;
  if (!accessToken) throw new Error('Sessão expirada. Entre novamente.');

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const response = await fetch(`${baseUrl}/functions/v1/cnpj-lookup`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'Não foi possível consultar o CNPJ.');
  }

  const { data: mapRows } = await supabase
    .from('cnae_anexo_map')
    .select('cnae_prefix, anexo, confidence, note');

  const cnaeAnexoMap: CnaeAnexoMapEntry[] = (mapRows ?? []).map((row) => ({
    cnaePrefix: String(row.cnae_prefix),
    anexo: row.anexo as SimplesAnexo,
    confidence: row.confidence,
    note: row.note ?? null,
  }));

  return {
    derived: deriveTaxProfile({
      payload: body.payload,
      cnaeAnexoMap,
      referenceDate: new Date(),
    }),
    source: String(body.source ?? 'receita'),
    fetchedAt: String(body.fetched_at ?? new Date().toISOString()),
    cached: Boolean(body.cached),
    stale: Boolean(body.stale),
  };
};

export interface SaveTaxProfileInput {
  regime: TaxProfileForCalculation['regime'];
  simplesAnexo: SimplesAnexo | null;
  meiActivityType: 'comercio' | 'servicos' | 'comercio_servicos' | null;
  uf: string;
  municipio: string;
  codigoMunicipioIbge: string;
  issRate: number;
  revenueBasis: 'competencia' | 'caixa';
  rbt12Initial: number;
  rbt12InitialReferenceMonth: string | null;
  fatorREnabled: boolean;
  cnaePrincipal: string;
  cnaesSecundarios: Array<{ code: string; description: string }>;
  /** 'receita' quando aceito como veio; 'receita_corrigido' quando o usuário ajustou. */
  source: 'receita' | 'manual' | 'receita_corrigido';
  sourceFetchedAt: string | null;
}

/**
 * Persiste o perfil APÓS confirmação explícita do usuário. O dado derivado da
 * Receita nunca chega aqui sozinho — `confirmed_at` é o que habilita a apuração.
 */
export const saveTaxProfile = async (input: SaveTaxProfileInput): Promise<void> => {
  assertTaxManagementAccess();
  const companyId = requireCompanyId();
  const userId = useAuthStore.getState().profile?.id ?? null;

  const { error } = await supabase.from('company_tax_profile').upsert(
    {
      company_id: companyId,
      regime: input.regime,
      simples_anexo: input.regime === 'simples_nacional' ? input.simplesAnexo : null,
      mei_activity_type: input.regime === 'mei' ? input.meiActivityType : null,
      uf: input.uf,
      municipio: input.municipio,
      codigo_municipio_ibge: input.codigoMunicipioIbge,
      iss_rate: input.issRate,
      revenue_basis: input.revenueBasis,
      rbt12_initial: input.rbt12Initial,
      rbt12_initial_reference_month: input.rbt12InitialReferenceMonth
        ? `${input.rbt12InitialReferenceMonth}-01`
        : null,
      fator_r_enabled: input.fatorREnabled,
      cnae_principal: input.cnaePrincipal,
      cnaes_secundarios: input.cnaesSecundarios,
      source: input.source,
      source_fetched_at: input.sourceFetchedAt,
      confirmed_at: new Date().toISOString(),
      confirmed_by: userId,
      needs_reconfirmation: false,
      reconfirmation_reason: null,
      is_active: true,
    },
    { onConflict: 'company_id' },
  );

  if (error) throw new Error(error.message);
};

export const getTaxCatalog = async (): Promise<TaxCatalog> => {
  const [brackets, components] = await Promise.all([
    supabase.from('tax_brackets').select('*'),
    supabase.from('tax_bracket_components').select('*'),
  ]);

  const mapBracket = (row: Record<string, unknown>): TaxBracketRow => ({
    anexo: row.anexo as SimplesAnexo,
    bracketOrder: Number(row.bracket_order),
    rbt12Min: Number(row.rbt12_min),
    rbt12Max: row.rbt12_max === null ? null : Number(row.rbt12_max),
    nominalRate: Number(row.nominal_rate),
    deduction: Number(row.deduction),
    effectiveFrom: String(row.effective_from),
    effectiveTo: row.effective_to === null ? null : String(row.effective_to),
    requiresValidation: Boolean(row.requires_validation),
  });

  return {
    brackets: (brackets.data ?? []).map(mapBracket),
    bracketComponents: (components.data ?? []).map(
      (row): TaxBracketComponentRow => ({
        anexo: row.anexo,
        bracketOrder: Number(row.bracket_order),
        tributo: row.tributo,
        share: Number(row.share),
        effectiveFrom: String(row.effective_from),
        effectiveTo: row.effective_to === null ? null : String(row.effective_to),
        requiresValidation: Boolean(row.requires_validation),
      }),
    ),
  };
};

interface SaleItemRow {
  product_id: string;
  subtotal: number;
  sales: { created_at: string; payment_status: string } | null;
  products: { category_id: string | null } | null;
}

/**
 * Itens de venda da competência, já com a categoria do produto para alimentar a
 * cascata de classificação. Vendas canceladas ficam fora da base.
 */
const fetchMonthItems = async (
  companyId: string,
  month: string,
): Promise<AssessmentRevenueItem[]> => {
  const { data, error } = await supabase
    .from('sale_items')
    .select('product_id, subtotal, sales!inner(company_id, created_at, payment_status), products(category_id)')
    .eq('sales.company_id', companyId)
    .neq('sales.payment_status', 'cancelled')
    .gte('sales.created_at', `${monthStart(month)}T00:00:00`)
    .lte('sales.created_at', `${monthEnd(month)}T23:59:59.999`);

  if (error || !data) return [];

  return (data as unknown as SaleItemRow[]).map((row) => ({
    productId: String(row.product_id),
    categoryId: row.products?.category_id ?? null,
    amount: Number(row.subtotal ?? 0),
  }));
};

/** Receita bruta mensal dos últimos meses, base do RBT12. */
const fetchRevenueHistory = async (
  companyId: string,
  referenceMonth: string,
): Promise<MonthlyRevenueEntry[]> => {
  const from = shiftMonth(referenceMonth, -HISTORY_MONTHS);
  const { data, error } = await supabase
    .from('sales')
    .select('final_value, created_at')
    .eq('company_id', companyId)
    .neq('payment_status', 'cancelled')
    .gte('created_at', `${monthStart(from)}T00:00:00`)
    .lte('created_at', `${monthEnd(referenceMonth)}T23:59:59.999`);

  if (error || !data) return [];

  const byMonth = new Map<string, number>();
  for (const row of data) {
    const month = String(row.created_at).slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + Number(row.final_value ?? 0));
  }
  return [...byMonth.entries()].map(([month, amount]) => ({ month, amount }));
};

const fetchPayrollHistory = async (
  companyId: string,
  referenceMonth: string,
): Promise<MonthlyRevenueEntry[]> => {
  const from = shiftMonth(referenceMonth, -HISTORY_MONTHS);
  const { data, error } = await supabase
    .from('company_payroll_entries')
    .select('reference_month, payroll_amount')
    .eq('company_id', companyId)
    .gte('reference_month', monthStart(from))
    .lte('reference_month', monthStart(referenceMonth));

  if (error || !data) return [];

  return data.map((row) => ({
    month: String(row.reference_month).slice(0, 7),
    amount: Number(row.payroll_amount ?? 0),
  }));
};

const fetchClassificationRows = async (
  companyId: string,
): Promise<ClassificationSourceRow[]> => {
  const { data, error } = await supabase
    .from('product_tax_classification')
    .select('product_id, category_id, anexo, tributacao')
    .eq('company_id', companyId);

  if (error || !data) return [];

  return data.map((row) => ({
    productId: row.product_id ?? null,
    categoryId: row.category_id ?? null,
    anexo: row.anexo ?? null,
    tributacao: row.tributacao ?? null,
  }));
};

export interface TaxAssessmentComputation {
  result: TaxCalculationResult;
  classificationCoverage: number | null;
  unclassifiedProductIds: string[];
  profile: TaxProfileRecord | null;
}

/**
 * Calcula a apuração da competência SEM persistir. A separação entre calcular e
 * gravar permite pré-visualizar antes de gerar guia e título financeiro.
 */
export const computeTaxAssessment = async (
  referenceMonth: string,
): Promise<TaxAssessmentComputation> => {
  assertTaxManagementAccess();
  const companyId = requireCompanyId();

  const profile = await getTaxProfile();
  const [catalog, items, revenueHistory, payrollHistory, classificationRows] = await Promise.all([
    getTaxCatalog(),
    fetchMonthItems(companyId, referenceMonth),
    fetchRevenueHistory(companyId, referenceMonth),
    fetchPayrollHistory(companyId, referenceMonth),
    fetchClassificationRows(companyId),
  ]);

  const classification = buildClassificationSources(classificationRows, profile?.anexo ?? null);
  const coverage = calculateClassificationCoverage(items, classification);

  const result = calculateTaxAssessment({
    profile: profile ?? {
      regime: 'indeterminado',
      anexo: null,
      meiActivityType: null,
      fatorREnabled: false,
      rbt12Initial: 0,
      rbt12InitialReferenceMonth: null,
      isConfirmed: false,
    },
    referenceMonth,
    items,
    classification,
    revenueHistory,
    payrollHistory,
    catalog,
  });

  return {
    result,
    classificationCoverage: coverage.isCalculable ? coverage.coverage : null,
    unclassifiedProductIds: coverage.unclassifiedProductIds,
    profile,
  };
};

const findDueDate = async (
  regime: string,
  referenceMonth: string,
): Promise<string> => {
  const { data } = await supabase
    .from('tax_due_date_rules')
    .select('day_of_month, month_offset')
    .eq('regime', regime)
    .eq('obligation_kind', 'das')
    .lte('effective_from', monthStart(referenceMonth))
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sem regra cadastrada, o padrão legal do DAS: dia 20 do mês seguinte.
  const day = Number(data?.day_of_month ?? 20);
  const offset = Number(data?.month_offset ?? 1);
  const target = shiftMonth(referenceMonth, offset);
  const lastDay = Number(monthEnd(target).slice(8, 10));
  return `${target}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
};

export interface PersistedAssessment {
  assessmentId: string;
  obligationId: string | null;
  payableId: string | null;
}

/**
 * Grava a apuração e materializa a guia com o espelho financeiro.
 * `upsert` por (company_id, reference_month) mantém uma apuração por mês —
 * recalcular atualiza, não duplica.
 */
export const saveTaxAssessment = async (
  referenceMonth: string,
): Promise<PersistedAssessment> => {
  assertTaxManagementAccess();
  const companyId = requireCompanyId();
  const userId = useAuthStore.getState().profile?.id ?? null;

  const { result, classificationCoverage } = await computeTaxAssessment(referenceMonth);

  if (result.status !== 'calculated') {
    throw new Error(result.message);
  }

  const { data: assessment, error: assessmentError } = await supabase
    .from('tax_assessments')
    .upsert(
      {
        company_id: companyId,
        reference_month: monthStart(referenceMonth),
        regime: result.regime,
        ibs_cbs_regime: result.hybridRegimeApplied ? 'regular' : 'simples',
        rbt12: result.rbt12,
        rbt12_from_initial_load: result.rbt12FromInitialLoad,
        rbt12_months_from_system: result.rbt12MonthsFromSystem,
        gross_revenue_month: result.grossRevenueMonth,
        total_taxable_base: result.totalTaxableBase,
        estimated_tax: result.estimatedTax,
        per_anexo: result.perAnexo,
        fator_r: result.fatorR,
        fator_r_available: result.fatorRAvailable,
        classification_coverage: classificationCoverage,
        requires_catalog_validation: result.requiresCatalogValidation,
        // Snapshot auditável: reproduz o número meses depois, mesmo após
        // reclassificação de produtos ou mudança de legislação.
        calculation_basis: {
          rbt12: result.rbt12,
          rbt12_months_from_system: result.rbt12MonthsFromSystem,
          computed_at: new Date().toISOString(),
        },
        warnings: result.warnings,
      },
      { onConflict: 'company_id,reference_month' },
    )
    .select('id, status, confirmed_amount')
    .single();

  if (assessmentError || !assessment) {
    throw new Error(assessmentError?.message ?? 'Não foi possível gravar a apuração.');
  }

  const assessmentId = String(assessment.id);

  // Valor confirmado pelo contador prevalece sobre a estimativa.
  const obligationAmount =
    assessment.status === 'confirmed' && assessment.confirmed_amount !== null
      ? Number(assessment.confirmed_amount)
      : result.estimatedTax;

  const dueDate = await findDueDate(result.regime, referenceMonth);

  const { data: existing } = await supabase
    .from('tax_obligations')
    .select('id, payable_id, status')
    .eq('company_id', companyId)
    .eq('kind', 'das')
    .eq('reference_month', monthStart(referenceMonth))
    .maybeSingle();

  // Guia já paga não é reescrita por um recálculo: o valor recolhido é fato.
  if (existing?.status === 'paid') {
    return {
      assessmentId,
      obligationId: String(existing.id),
      payableId: existing.payable_id ? String(existing.payable_id) : null,
    };
  }

  let payableId = existing?.payable_id ? String(existing.payable_id) : null;
  const description = `DAS ${referenceMonth} — apuração gerencial`;

  if (payableId) {
    await supabase
      .from('account_payables')
      .update({ amount: obligationAmount, due_date: dueDate, description })
      .eq('id', payableId)
      .eq('company_id', companyId);
  } else {
    payableId = `tax-${companyId.slice(0, 8)}-${referenceMonth}`;
    const { error: payableError } = await supabase.from('account_payables').insert({
      id: payableId,
      company_id: companyId,
      amount: obligationAmount,
      due_date: dueDate,
      status: 'pending',
      description,
      // Marcador que impede dupla contagem na DRE.
      origin: 'tax',
    });
    if (payableError) throw new Error(payableError.message);
  }

  const { data: obligation, error: obligationError } = await supabase
    .from('tax_obligations')
    .upsert(
      {
        company_id: companyId,
        assessment_id: assessmentId,
        kind: 'das',
        label: result.regime === 'mei' ? 'DAS — MEI' : 'DAS — Simples Nacional',
        reference_month: monthStart(referenceMonth),
        due_date: dueDate,
        amount: obligationAmount,
        status: 'pending',
        payable_id: payableId,
        is_manual: false,
        created_by: userId,
      },
      { onConflict: 'company_id,kind,reference_month' },
    )
    .select('id')
    .single();

  if (obligationError) throw new Error(obligationError.message);

  return { assessmentId, obligationId: obligation ? String(obligation.id) : null, payableId };
};

/**
 * Registra o valor real informado pelo contador e mede a divergência.
 * É o que transforma "confie na estimativa" em "veja o quanto ela acertou".
 */
export const confirmTaxAssessment = async (
  referenceMonth: string,
  confirmedAmount: number,
): Promise<void> => {
  assertTaxManagementAccess();
  const companyId = requireCompanyId();
  const userId = useAuthStore.getState().profile?.id ?? null;

  const { data: assessment, error } = await supabase
    .from('tax_assessments')
    .select('id, estimated_tax')
    .eq('company_id', companyId)
    .eq('reference_month', monthStart(referenceMonth))
    .maybeSingle();

  if (error || !assessment) {
    throw new Error('Não há apuração gravada para esta competência.');
  }

  const estimated = Number(assessment.estimated_tax ?? 0);
  // Divergência relativa só faz sentido com estimativa diferente de zero.
  const variance = estimated > 0 ? ((confirmedAmount - estimated) / estimated) * 100 : null;

  await supabase
    .from('tax_assessments')
    .update({
      status: 'confirmed',
      confirmed_amount: confirmedAmount,
      confirmed_at: new Date().toISOString(),
      confirmed_by: userId,
      variance_pct: variance,
    })
    .eq('id', assessment.id)
    .eq('company_id', companyId);

  await supabase
    .from('tax_obligations')
    .update({ amount: confirmedAmount })
    .eq('company_id', companyId)
    .eq('kind', 'das')
    .eq('reference_month', monthStart(referenceMonth))
    .neq('status', 'paid');
};

export interface VarianceSummary {
  available: boolean;
  averageVariancePct: number | null;
  sampleSize: number;
}

/** Exige duas competências confirmadas: com uma só, "erro médio" é ruído. */
export const MIN_CONFIRMATIONS_FOR_VARIANCE = 2;

export const getVarianceSummary = async (limit = 6): Promise<VarianceSummary> => {
  assertTaxManagementAccess();
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('tax_assessments')
    .select('variance_pct')
    .eq('company_id', companyId)
    .eq('status', 'confirmed')
    .not('variance_pct', 'is', null)
    .order('reference_month', { ascending: false })
    .limit(limit);

  const samples = (data ?? [])
    .map((row) => Number(row.variance_pct))
    .filter((value) => Number.isFinite(value));

  if (error || samples.length < MIN_CONFIRMATIONS_FOR_VARIANCE) {
    return { available: false, averageVariancePct: null, sampleSize: samples.length };
  }

  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  return { available: true, averageVariancePct: average, sampleSize: samples.length };
};

export interface TaxObligationRecord {
  id: string;
  kind: string;
  label: string;
  referenceMonth: string;
  dueDate: string;
  amount: number;
  status: 'pending' | 'paid' | 'late' | 'canceled';
  paidAt: string | null;
  documentId: string | null;
  isManual: boolean;
}

export const listTaxObligations = async (
  fromMonth: string,
  toMonth: string,
): Promise<TaxObligationRecord[]> => {
  assertTaxManagementAccess();
  const companyId = requireCompanyId();

  const { data, error } = await supabase
    .from('tax_obligations')
    .select('*')
    .eq('company_id', companyId)
    .gte('reference_month', monthStart(fromMonth))
    .lte('reference_month', monthStart(toMonth))
    .order('due_date', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    id: String(row.id),
    kind: String(row.kind),
    label: String(row.label),
    referenceMonth: String(row.reference_month).slice(0, 7),
    dueDate: String(row.due_date),
    amount: Number(row.amount ?? 0),
    status: row.status,
    paidAt: row.paid_at ?? null,
    documentId: row.document_id ?? null,
    isManual: Boolean(row.is_manual),
  }));
};

export const settleTaxObligation = async (
  obligationId: string,
  paidAt: string,
  documentId?: string | null,
): Promise<void> => {
  assertTaxManagementAccess();
  const companyId = requireCompanyId();

  // O trigger do banco propaga a baixa para o título espelhado.
  const { error } = await supabase
    .from('tax_obligations')
    .update({
      status: 'paid',
      paid_at: paidAt,
      ...(documentId === undefined ? {} : { document_id: documentId }),
    })
    .eq('id', obligationId)
    .eq('company_id', companyId);

  if (error) throw new Error(error.message);
};

export interface RegimeOptionWindow {
  optionKind: 'simples_nacional' | 'ibs_cbs_regime_regular';
  label: string;
  description: string;
  opensOn: string;
  closesOn: string;
  effectStartsOn: string;
  cancellableUntil: string | null;
  legalReference: string;
  requiresValidation: boolean;
}

/**
 * Janelas legais de opção de regime (Reforma Tributária). Alimenta o alerta que
 * avisa o cliente antes do prazo — nenhuma data vive em código.
 */
export const listUpcomingRegimeWindows = async (
  today: string,
): Promise<RegimeOptionWindow[]> => {
  const { data, error } = await supabase
    .from('tax_regime_option_windows')
    .select('*')
    .gte('closes_on', today)
    .order('opens_on', { ascending: true });

  if (error || !data) return [];

  return data.map((row) => ({
    optionKind: row.option_kind,
    label: String(row.label),
    description: String(row.description),
    opensOn: String(row.opens_on),
    closesOn: String(row.closes_on),
    effectStartsOn: String(row.effect_starts_on),
    cancellableUntil: row.cancellable_until ?? null,
    legalReference: String(row.legal_reference),
    requiresValidation: Boolean(row.requires_validation),
  }));
};
