/**
 * Story 1.30 — Motor de apuração tributária.
 *
 * Módulo PURO: recebe entradas, devolve resultado. Sem rede, sem banco, sem
 * `new Date()` implícito. É o núcleo do módulo e o único lugar onde um erro
 * silencioso vira número errado na tela do cliente.
 *
 * DECISÕES QUE DEFINEM A CORREÇÃO DO CÁLCULO
 *
 * 1. RBT12 É ÚNICO E TOTAL, NÃO POR ANEXO.
 *    A empresa tem um só RBT12 — a receita bruta dos 12 meses anteriores,
 *    somando todas as atividades. A segregação por anexo vale para a receita DO
 *    MÊS: cada parcela é tributada pela tabela do seu anexo, mas todas
 *    consultam a MESMA faixa de RBT12. Calcular um RBT12 por anexo colocaria a
 *    empresa em faixa mais baixa que a real e subestimaria o imposto.
 *
 * 2. FATOR R SE APLICA AO ANEXO V, NÃO AO IV.
 *    Atividades sujeitas ao Fator R são tributadas pelo Anexo III quando a
 *    razão folha/RBT12 alcança 28%, e pelo Anexo V abaixo disso. O Anexo IV
 *    nunca é afetado — nele a CPP é recolhida à parte. A flag `fatorREnabled`
 *    marca que a atividade da empresa está sujeita à regra.
 *
 * 3. NADA DE ZERO SILENCIOSO.
 *    Ausência de faixa vigente, regime sem estimativa, perfil não confirmado ou
 *    RBT12 indisponível devolvem `notCalculable` com motivo. Zero e NaN nunca
 *    saem daqui como se fossem resultado.
 */

import type { SimplesAnexo } from './taxProfileDerivation';
import {
  resolveClassification,
  type TaxClassificationSources,
  type TributacaoFiscal,
} from './taxClassification';

// =========================================================================
// Tipos de entrada
// =========================================================================

export type TaxRegimeForCalculation =
  | 'mei'
  | 'simples_nacional'
  | 'lucro_presumido'
  | 'lucro_real'
  | 'indeterminado';

export interface TaxBracketRow {
  anexo: SimplesAnexo;
  bracketOrder: number;
  rbt12Min: number;
  /** null = faixa sem teto. */
  rbt12Max: number | null;
  nominalRate: number;
  deduction: number;
  /** 'YYYY-MM-DD' */
  effectiveFrom: string;
  effectiveTo: string | null;
  requiresValidation: boolean;
}

/**
 * Repartição da alíquota da faixa por tributo (LC 123/2006). Só é consultada no
 * regime híbrido, quando IBS e CBS saem do DAS e o percentual correspondente
 * precisa ser removido da alíquota efetiva.
 */
export interface TaxBracketComponentRow {
  anexo: SimplesAnexo;
  bracketOrder: number;
  tributo: 'irpj' | 'csll' | 'cofins' | 'pis' | 'cpp' | 'icms' | 'iss' | 'ipi' | 'cbs' | 'ibs';
  /** Fração da alíquota da faixa destinada a este tributo. */
  share: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  requiresValidation: boolean;
}

export interface TaxCatalog {
  brackets: TaxBracketRow[];
  /** Opcional: exigido apenas quando `ibsCbsRegime === 'regular'`. */
  bracketComponents?: TaxBracketComponentRow[];
}

export interface AssessmentRevenueItem {
  productId: string;
  categoryId: string | null;
  /** Valor do item já líquido de rateio de desconto/acréscimo da venda. */
  amount: number;
}

export interface MonthlyRevenueEntry {
  /** 'YYYY-MM' */
  month: string;
  amount: number;
}

export interface TaxProfileForCalculation {
  regime: TaxRegimeForCalculation;
  anexo: SimplesAnexo | null;
  meiActivityType: 'comercio' | 'servicos' | 'comercio_servicos' | null;
  fatorREnabled: boolean;
  rbt12Initial: number;
  /** 'YYYY-MM' do mês de referência da carga inicial. */
  rbt12InitialReferenceMonth: string | null;
  isConfirmed: boolean;
  /**
   * Reforma Tributária (LC 214/2025): a partir de 2027 o optante do Simples
   * pode apurar IBS e CBS pelo regime regular, fora do DAS.
   *   'simples' → IBS/CBS dentro do DAS (padrão, e único cenário até 2026)
   *   'regular' → regime híbrido; a parcela de IBS/CBS sai da alíquota efetiva
   */
  ibsCbsRegime?: 'simples' | 'regular';
}

export interface TaxCalculationInput {
  profile: TaxProfileForCalculation;
  /** 'YYYY-MM' — competência apurada. */
  referenceMonth: string;
  items: AssessmentRevenueItem[];
  classification: TaxClassificationSources;
  /** Receita bruta total por mês, incluindo meses anteriores ao de apuração. */
  revenueHistory: MonthlyRevenueEntry[];
  /** Folha por mês, para o Fator R. Ausência = Fator R indisponível. */
  payrollHistory: MonthlyRevenueEntry[];
  catalog: TaxCatalog;
}

// =========================================================================
// Tipos de saída
// =========================================================================

export type NotCalculableReason =
  | 'perfil_nao_confirmado'
  | 'regime_sem_estimativa'
  | 'regime_indeterminado'
  | 'anexo_indefinido'
  | 'faixa_inexistente'
  | 'competencia_invalida'
  | 'reparticao_indisponivel';

export interface AnexoAssessment {
  /** Anexo resolvido pela classificação. */
  anexo: SimplesAnexo;
  /** Anexo efetivamente usado — pode diferir por Fator R. */
  appliedAnexo: SimplesAnexo;
  fatorRApplied: boolean;
  grossRevenue: number;
  /** Parcela removida da base por já ter sido recolhida ou não ser devida. */
  exemptRevenue: number;
  exemptBreakdown: Record<Exclude<TributacaoFiscal, 'normal'>, number>;
  taxableBase: number;
  bracketOrder: number;
  nominalRate: number;
  deduction: number;
  /** Alíquota efetiva cheia da faixa, antes de qualquer segregação. */
  effectiveRate: number;
  /** Fração removida por IBS/CBS no regime híbrido; 0 no regime padrão. */
  ibsCbsShareRemoved: number;
  /** Alíquota efetivamente aplicada ao DAS. */
  appliedRate: number;
  tax: number;
}

export interface TaxCalculationSuccess {
  status: 'calculated';
  referenceMonth: string;
  regime: TaxRegimeForCalculation;
  /** RBT12 único da empresa, base da faixa de todos os anexos. */
  rbt12: number;
  rbt12FromInitialLoad: number;
  rbt12MonthsFromSystem: number;
  grossRevenueMonth: number;
  totalTaxableBase: number;
  estimatedTax: number;
  perAnexo: AnexoAssessment[];
  fatorR: number | null;
  fatorRAvailable: boolean;
  /** true se alguma linha de catálogo usada ainda não foi validada por contador. */
  requiresCatalogValidation: boolean;
  /** true quando IBS/CBS foram apurados fora do DAS (regime híbrido). */
  hybridRegimeApplied: boolean;
  warnings: string[];
}

export interface TaxCalculationNotCalculable {
  status: 'not_calculable';
  referenceMonth: string;
  regime: TaxRegimeForCalculation;
  reason: NotCalculableReason;
  message: string;
  /** Receita apurada mesmo sem imposto calculável. */
  grossRevenueMonth: number;
}

export type TaxCalculationResult = TaxCalculationSuccess | TaxCalculationNotCalculable;

// =========================================================================
// Utilitários de competência
// =========================================================================

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export const isValidMonth = (month: string): boolean => {
  const match = MONTH_PATTERN.exec(month);
  if (!match) return false;
  const monthNumber = Number(match[2]);
  return monthNumber >= 1 && monthNumber <= 12;
};

const monthToIndex = (month: string): number => {
  const match = MONTH_PATTERN.exec(month);
  if (!match) return Number.NaN;
  return Number(match[1]) * 12 + (Number(match[2]) - 1);
};

const indexToMonth = (index: number): string => {
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
};

/** Primeiro dia da competência, para comparar com vigências do catálogo. */
const monthToDateString = (month: string): string => `${month}-01`;

const isRowEffective = (
  row: { effectiveFrom: string; effectiveTo: string | null },
  referenceDate: string,
): boolean => {
  if (row.effectiveFrom > referenceDate) return false;
  if (row.effectiveTo && row.effectiveTo <= referenceDate) return false;
  return true;
};

const safeAmount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** Arredonda apenas na fronteira do resultado; nunca acumula valor arredondado. */
const roundCurrency = (value: number): number => Math.round(value * 100) / 100;

// =========================================================================
// RBT12
// =========================================================================

export interface Rbt12Result {
  rbt12: number;
  fromSystem: number;
  fromInitialLoad: number;
  monthsFromSystem: number;
}

/**
 * Soma os 12 meses ANTERIORES à competência. Enquanto o sistema não tiver 12
 * meses de histórico, a diferença é coberta proporcionalmente pela carga
 * inicial informada no onboarding — sem ela, o primeiro ano de uso produziria
 * RBT12 irreal e, portanto, alíquota efetiva irreal.
 */
export const calculateRbt12 = (
  referenceMonth: string,
  revenueHistory: MonthlyRevenueEntry[],
  rbt12Initial: number,
): Rbt12Result => {
  const referenceIndex = monthToIndex(referenceMonth);
  const byMonth = new Map<string, number>();

  for (const entry of revenueHistory) {
    if (!isValidMonth(entry.month)) continue;
    byMonth.set(entry.month, (byMonth.get(entry.month) ?? 0) + safeAmount(entry.amount));
  }

  let fromSystem = 0;
  let monthsFromSystem = 0;

  for (let offset = 1; offset <= 12; offset += 1) {
    const month = indexToMonth(referenceIndex - offset);
    const amount = byMonth.get(month);
    if (amount !== undefined) {
      fromSystem += amount;
      monthsFromSystem += 1;
    }
  }

  const missingMonths = 12 - monthsFromSystem;
  const initial = safeAmount(rbt12Initial);
  // Rateio proporcional: a carga inicial representa 12 meses; só os meses que
  // faltam no sistema são aproveitados dela.
  const fromInitialLoad = missingMonths > 0 ? (initial * missingMonths) / 12 : 0;

  return {
    rbt12: fromSystem + fromInitialLoad,
    fromSystem,
    fromInitialLoad,
    monthsFromSystem,
  };
};

// =========================================================================
// Faixa e alíquota efetiva
// =========================================================================

export const findBracket = (
  brackets: TaxBracketRow[],
  anexo: SimplesAnexo,
  rbt12: number,
  referenceDate: string,
): TaxBracketRow | null => {
  const candidates = brackets
    .filter((row) => row.anexo === anexo && isRowEffective(row, referenceDate))
    .sort((left, right) => left.bracketOrder - right.bracketOrder);

  for (const row of candidates) {
    const withinMin = rbt12 >= row.rbt12Min;
    const withinMax = row.rbt12Max === null || rbt12 <= row.rbt12Max;
    if (withinMin && withinMax) return row;
  }

  // Acima da última faixa a empresa está fora do regime; devolver a última
  // faixa mascararia o estouro do teto, que é justamente o alerta mais valioso.
  return null;
};

/**
 * (RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12.
 * Com RBT12 igual a zero — empresa nova, primeiro mês — não há divisão possível
 * e a alíquota nominal da primeira faixa é o resultado correto.
 */
export const calculateEffectiveRate = (
  rbt12: number,
  nominalRate: number,
  deduction: number,
): number => {
  if (!Number.isFinite(rbt12) || rbt12 <= 0) return nominalRate;
  const rate = (rbt12 * nominalRate - deduction) / rbt12;
  // Blindagem contra catálogo inconsistente (PD maior que o imposto nominal).
  return rate > 0 ? rate : 0;
};

// =========================================================================
// Fator R
// =========================================================================

export interface FatorRResult {
  available: boolean;
  value: number | null;
  /** Anexo a aplicar quando a atividade está sujeita à regra. */
  resolvedAnexo: SimplesAnexo | null;
}

export const FATOR_R_THRESHOLD = 0.28;

export const calculateFatorR = (
  referenceMonth: string,
  payrollHistory: MonthlyRevenueEntry[],
  rbt12: number,
): FatorRResult => {
  const referenceIndex = monthToIndex(referenceMonth);
  const byMonth = new Map<string, number>();
  for (const entry of payrollHistory) {
    if (!isValidMonth(entry.month)) continue;
    byMonth.set(entry.month, (byMonth.get(entry.month) ?? 0) + safeAmount(entry.amount));
  }

  let payroll = 0;
  let monthsInformed = 0;
  for (let offset = 1; offset <= 12; offset += 1) {
    const amount = byMonth.get(indexToMonth(referenceIndex - offset));
    if (amount !== undefined) {
      payroll += amount;
      monthsInformed += 1;
    }
  }

  // Sem folha informada não se estima folha: o Fator R fica indisponível e o
  // anexo de origem é mantido. Chutar folha moveria a empresa de anexo inteiro.
  if (monthsInformed === 0 || rbt12 <= 0) {
    return { available: false, value: null, resolvedAnexo: null };
  }

  const value = payroll / rbt12;
  return {
    available: true,
    value,
    resolvedAnexo: value >= FATOR_R_THRESHOLD ? 'III' : 'V',
  };
};

// =========================================================================
// Apuração
// =========================================================================

const notCalculable = (
  input: TaxCalculationInput,
  reason: NotCalculableReason,
  message: string,
  grossRevenueMonth = 0,
): TaxCalculationNotCalculable => ({
  status: 'not_calculable',
  referenceMonth: input.referenceMonth,
  regime: input.profile.regime,
  reason,
  message,
  grossRevenueMonth: roundCurrency(grossRevenueMonth),
});

const EMPTY_EXEMPT_BREAKDOWN = (): Record<Exclude<TributacaoFiscal, 'normal'>, number> => ({
  st: 0,
  monofasico: 0,
  isento: 0,
  exportacao: 0,
});

export const calculateTaxAssessment = (input: TaxCalculationInput): TaxCalculationResult => {
  const { profile, referenceMonth, items, classification, catalog } = input;

  if (!isValidMonth(referenceMonth)) {
    return notCalculable(input, 'competencia_invalida', 'A competência informada é inválida.');
  }

  const grossRevenueMonth = items.reduce((sum, item) => sum + safeAmount(item.amount), 0);

  if (!profile.isConfirmed) {
    return notCalculable(
      input,
      'perfil_nao_confirmado',
      'O perfil tributário ainda não foi confirmado. Confirme o regime para habilitar a apuração.',
      grossRevenueMonth,
    );
  }

  if (profile.regime === 'indeterminado') {
    return notCalculable(
      input,
      'regime_indeterminado',
      'O regime tributário não foi determinado. Informe o regime para habilitar a apuração.',
      grossRevenueMonth,
    );
  }

  if (profile.regime === 'lucro_presumido' || profile.regime === 'lucro_real') {
    return notCalculable(
      input,
      'regime_sem_estimativa',
      'A estimativa automática não está disponível para Lucro Presumido e Lucro Real. Lance o valor apurado pelo seu contador.',
      grossRevenueMonth,
    );
  }

  const referenceDate = monthToDateString(referenceMonth);
  const warnings: string[] = [];
  let requiresCatalogValidation = false;

  // Reforma Tributária: só o Simples tem regime híbrido; o MEI não é alcançado.
  const isHybridRegime =
    profile.regime === 'simples_nacional' && profile.ibsCbsRegime === 'regular';

  // ---------------------------------------------------------------- MEI ----
  // O DAS de valor fixo do MEI foi retirado do escopo por não ter sido aprovado
  // pelo contador. O regime continua cadastrável — a empresa aparece com o
  // perfil correto, o calendário e a exportação funcionam — mas o sistema não
  // estima o valor. Mesmo tratamento dado a Lucro Presumido e Lucro Real.
  if (profile.regime === 'mei') {
    return notCalculable(
      input,
      'regime_sem_estimativa',
      'A estimativa automática não está disponível para o MEI. Lance o valor do DAS informado pelo seu contador.',
      grossRevenueMonth,
    );
  }

  // ---------------------------------------------- SIMPLES NACIONAL ----
  const { rbt12, fromInitialLoad, monthsFromSystem } = calculateRbt12(
    referenceMonth,
    input.revenueHistory,
    profile.rbt12Initial,
  );

  if (monthsFromSystem < 12 && profile.rbt12Initial <= 0) {
    warnings.push(
      `O sistema tem apenas ${monthsFromSystem} de 12 meses de histórico e não há carga inicial de RBT12 informada. A alíquota efetiva está subestimada.`,
    );
  }

  const fatorR = profile.fatorREnabled
    ? calculateFatorR(referenceMonth, input.payrollHistory, rbt12)
    : { available: false, value: null, resolvedAnexo: null };

  if (profile.fatorREnabled && !fatorR.available) {
    warnings.push(
      'A atividade está sujeita ao Fator R, mas não há folha informada nos 12 meses anteriores. O anexo de origem foi mantido.',
    );
  }

  // Agrupa a receita do mês por anexo resolvido, separando a parcela que sai da
  // base por já ter sido tributada na origem.
  interface AnexoBucket {
    grossRevenue: number;
    exemptBreakdown: Record<Exclude<TributacaoFiscal, 'normal'>, number>;
  }
  const buckets = new Map<SimplesAnexo, AnexoBucket>();
  let itemsWithoutAnexo = 0;

  for (const item of items) {
    const amount = safeAmount(item.amount);
    if (amount <= 0) continue;

    const resolved = resolveClassification(item, classification);
    if (!resolved.anexo) {
      itemsWithoutAnexo += 1;
      continue;
    }

    const bucket = buckets.get(resolved.anexo) ?? {
      grossRevenue: 0,
      exemptBreakdown: EMPTY_EXEMPT_BREAKDOWN(),
    };
    bucket.grossRevenue += amount;
    if (resolved.tributacao !== 'normal') {
      bucket.exemptBreakdown[resolved.tributacao] += amount;
    }
    buckets.set(resolved.anexo, bucket);
  }

  if (itemsWithoutAnexo > 0) {
    return notCalculable(
      input,
      'anexo_indefinido',
      `${itemsWithoutAnexo} item(ns) do período não têm anexo definido nem no produto, nem na categoria, nem no perfil da empresa. Defina o anexo para apurar.`,
      grossRevenueMonth,
    );
  }

  const perAnexo: AnexoAssessment[] = [];
  let estimatedTax = 0;
  let totalTaxableBase = 0;

  for (const [anexo, bucket] of [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    // Fator R decide o anexo aplicável antes da busca de faixa.
    let appliedAnexo = anexo;
    let fatorRApplied = false;
    if (profile.fatorREnabled && fatorR.available && fatorR.resolvedAnexo && anexo !== 'IV') {
      appliedAnexo = fatorR.resolvedAnexo;
      fatorRApplied = appliedAnexo !== anexo;
    }

    const bracket = findBracket(catalog.brackets, appliedAnexo, rbt12, referenceDate);
    if (!bracket) {
      return notCalculable(
        input,
        'faixa_inexistente',
        `Não há faixa vigente do Anexo ${appliedAnexo} para um RBT12 de ${rbt12.toFixed(2)} na competência ${referenceMonth}. Verifique o teto do regime e o catálogo tributário.`,
        grossRevenueMonth,
      );
    }

    if (bracket.requiresValidation) requiresCatalogValidation = true;

    const exemptRevenue = Object.values(bucket.exemptBreakdown).reduce(
      (sum, value) => sum + value,
      0,
    );
    const taxableBase = Math.max(0, bucket.grossRevenue - exemptRevenue);
    const effectiveRate = calculateEffectiveRate(rbt12, bracket.nominalRate, bracket.deduction);

    // Regime híbrido (LC 214/2025, a partir de 2027): IBS e CBS são apurados
    // fora do DAS, então a parcela correspondente sai da alíquota efetiva.
    // Aplicar a alíquota cheia superestimaria o imposto.
    let ibsCbsShareRemoved = 0;
    if (isHybridRegime) {
      const components = (catalog.bracketComponents ?? []).filter(
        (row) =>
          row.anexo === appliedAnexo &&
          row.bracketOrder === bracket.bracketOrder &&
          (row.tributo === 'ibs' || row.tributo === 'cbs') &&
          isRowEffective(row, referenceDate),
      );

      // Sem repartição cadastrada o motor NÃO estima o percentual: recusa o
      // cálculo. Chutar a fatia de IBS/CBS produziria um DAS plausível e errado.
      if (components.length === 0) {
        return notCalculable(
          input,
          'reparticao_indisponivel',
          `A empresa optou pelo regime regular de IBS e CBS, mas a repartição de tributos do Anexo ${appliedAnexo} não está cadastrada para a competência ${referenceMonth}. Atualize o catálogo tributário antes de apurar.`,
          grossRevenueMonth,
        );
      }

      if (components.some((row) => row.requiresValidation)) requiresCatalogValidation = true;
      ibsCbsShareRemoved = components.reduce((sum, row) => sum + row.share, 0);
    }

    const appliedRate = effectiveRate * Math.max(0, 1 - ibsCbsShareRemoved);
    const tax = taxableBase * appliedRate;

    estimatedTax += tax;
    totalTaxableBase += taxableBase;

    perAnexo.push({
      anexo,
      appliedAnexo,
      fatorRApplied,
      grossRevenue: roundCurrency(bucket.grossRevenue),
      exemptRevenue: roundCurrency(exemptRevenue),
      exemptBreakdown: bucket.exemptBreakdown,
      taxableBase: roundCurrency(taxableBase),
      bracketOrder: bracket.bracketOrder,
      nominalRate: bracket.nominalRate,
      deduction: bracket.deduction,
      effectiveRate,
      ibsCbsShareRemoved,
      appliedRate,
      tax: roundCurrency(tax),
    });
  }

  return {
    status: 'calculated',
    referenceMonth,
    regime: 'simples_nacional',
    rbt12: roundCurrency(rbt12),
    rbt12FromInitialLoad: roundCurrency(fromInitialLoad),
    rbt12MonthsFromSystem: monthsFromSystem,
    grossRevenueMonth: roundCurrency(grossRevenueMonth),
    totalTaxableBase: roundCurrency(totalTaxableBase),
    estimatedTax: roundCurrency(estimatedTax),
    perAnexo,
    fatorR: fatorR.value,
    fatorRAvailable: fatorR.available,
    requiresCatalogValidation,
    hybridRegimeApplied: isHybridRegime,
    warnings,
  };
};
