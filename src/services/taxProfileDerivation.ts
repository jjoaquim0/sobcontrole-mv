/**
 * Story 1.28 — Derivação do regime tributário a partir do cadastro da Receita.
 *
 * Módulo PURO: recebe o payload da consulta de CNPJ e o mapa CNAE -> anexo,
 * devolve o perfil derivado. Sem rede, sem banco, sem data implícita — a data de
 * referência é sempre injetada, para que o resultado seja reproduzível em teste.
 *
 * Três regras existem porque são exatamente onde este módulo erraria em silêncio:
 *
 * 1. NULO NÃO É "NÃO". A base pública retorna null com frequência para empresa
 *    ativa. Tratar `opcao_pelo_simples: null` como "não optante" contaminaria
 *    todo o cálculo de imposto. Nulo cai em `indeterminado`.
 * 2. BOOLEANO NÃO BASTA. `opcao_pelo_simples: true` com data de exclusão já
 *    vigente significa empresa EXCLUÍDA. A vigência manda sobre o booleano.
 * 3. MEI ANTES DE SIMPLES. Todo MEI também é optante do Simples, então a
 *    verificação de MEI precisa vir primeiro ou todo MEI seria classificado
 *    como Simples e receberia cálculo percentual em vez do DAS fixo.
 */

export type TaxRegime =
  | 'mei'
  | 'simples_nacional'
  | 'lucro_presumido'
  | 'lucro_real'
  | 'indeterminado';

export type SimplesAnexo = 'I' | 'II' | 'III' | 'IV' | 'V';

export type MeiActivityType = 'comercio' | 'servicos' | 'comercio_servicos';

/** Espelha `cnae_anexo_map.confidence`: só 'alta' autoriza pré-seleção na interface. */
export type DerivationConfidence = 'alta' | 'media' | 'requer_confirmacao';

export type DerivationWarningCode =
  | 'registro_inativo'
  | 'dado_ausente'
  | 'excluido_do_simples'
  | 'desenquadrado_do_mei'
  | 'exclusao_agendada'
  | 'atividade_mista'
  | 'cnae_sem_mapeamento'
  | 'anexo_requer_confirmacao';

export interface DerivationWarning {
  code: DerivationWarningCode;
  message: string;
}

export interface CnaeEntry {
  code: string;
  description: string;
}

/** Subconjunto usado do retorno da consulta pública de CNPJ. */
export interface CnpjRegistryPayload {
  cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  opcao_pelo_mei?: boolean | null;
  data_opcao_pelo_mei?: string | null;
  data_exclusao_do_mei?: string | null;
  opcao_pelo_simples?: boolean | null;
  data_opcao_pelo_simples?: string | null;
  data_exclusao_do_simples?: string | null;
  regime_tributario?: Array<{
    ano?: number | string | null;
    forma_de_tributacao?: string | null;
  }> | null;
  cnae_fiscal?: number | string | null;
  cnae_fiscal_descricao?: string | null;
  cnaes_secundarios?: Array<{
    codigo?: number | string | null;
    descricao?: string | null;
  }> | null;
  uf?: string | null;
  municipio?: string | null;
  codigo_municipio_ibge?: number | string | null;
  porte?: string | null;
  situacao_cadastral?: number | string | null;
  descricao_situacao_cadastral?: string | null;
}

export interface CnaeAnexoMapEntry {
  cnaePrefix: string;
  anexo: SimplesAnexo;
  confidence: DerivationConfidence;
  note: string | null;
}

export interface DerivedTaxProfile {
  regime: TaxRegime;
  regimeConfidence: DerivationConfidence;
  regimeReason: string;
  optedAt: string | null;

  suggestedAnexo: SimplesAnexo | null;
  anexoConfidence: DerivationConfidence;
  anexoReason: string;

  suggestedMeiActivityType: MeiActivityType | null;

  razaoSocial: string;
  nomeFantasia: string;
  uf: string;
  municipio: string;
  codigoMunicipioIbge: string;

  cnaePrincipal: string;
  cnaePrincipalDescricao: string;
  cnaesSecundarios: CnaeEntry[];
  /** CNAEs secundários apontam anexo diferente do principal — receita possivelmente mista. */
  hasMixedActivity: boolean;

  registrationActive: boolean;
  registrationStatusLabel: string;

  warnings: DerivationWarning[];
}

/** Código 2 = ATIVA na tabela de situação cadastral da Receita. */
const SITUACAO_CADASTRAL_ATIVA = '2';

const REGIME_PRESUMIDO_TOKENS = ['LUCRO PRESUMIDO', 'PRESUMIDO'];
const REGIME_REAL_TOKENS = ['LUCRO REAL', 'REAL'];
const REGIME_SIMPLES_TOKENS = ['SIMPLES NACIONAL', 'SIMPLES'];

/**
 * Normaliza texto para comparação: sem acento, caixa alta, espaço colapsado.
 * `forma_de_tributacao` não tem formato garantido entre provedores.
 */
const normalizeText = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * CNAE chega como número (`9430800`) e perde o zero à esquerda das divisões
 * agrícolas: `0111301` viraria `111301` e casaria com o prefixo errado. Sempre
 * normalizar para 7 dígitos com zero-padding.
 */
export const normalizeCnae = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length === 0) return '';
  return digits.slice(0, 7).padStart(7, '0');
};

/** Aceita apenas `YYYY-MM-DD` (formato do provedor); qualquer outra coisa é ausência de dado. */
const parseIsoDate = (value: unknown): Date | null => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
};

const toDateOnly = (reference: Date): Date =>
  new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));

type ExclusionState = 'none' | 'effective' | 'scheduled';

/**
 * Exclusão só invalida a opção quando já produziu efeito na data de referência.
 * Data futura é exclusão AGENDADA: a empresa ainda está no regime, mas o
 * usuário precisa saber.
 */
const evaluateExclusion = (rawDate: unknown, reference: Date): ExclusionState => {
  const exclusionDate = parseIsoDate(rawDate);
  if (!exclusionDate) return 'none';
  return exclusionDate.getTime() <= toDateOnly(reference).getTime() ? 'effective' : 'scheduled';
};

const isOptionFlagTrue = (value: unknown): boolean => value === true;

/** Distingue "não optante" (false) de "desconhecido" (null/undefined). */
const isOptionFlagUnknown = (value: unknown): boolean => value === null || value === undefined;

/**
 * Resolve o anexo pelo CNAE com vitória do prefixo mais longo: `6911` (advocacia,
 * Anexo IV) vence `69` se ambos existirem no mapa.
 */
export const resolveAnexoByCnae = (
  cnae: string,
  map: CnaeAnexoMapEntry[],
): CnaeAnexoMapEntry | null => {
  const normalized = normalizeCnae(cnae);
  if (!normalized) return null;

  let best: CnaeAnexoMapEntry | null = null;
  for (const entry of map) {
    const prefix = String(entry.cnaePrefix ?? '').replace(/\D/g, '');
    if (!prefix || !normalized.startsWith(prefix)) continue;
    if (!best || prefix.length > String(best.cnaePrefix).replace(/\D/g, '').length) {
      best = entry;
    }
  }
  return best;
};

interface RegimeDerivation {
  regime: TaxRegime;
  confidence: DerivationConfidence;
  reason: string;
  optedAt: string | null;
  warnings: DerivationWarning[];
}

const deriveRegimeFromRegistry = (
  payload: CnpjRegistryPayload,
  reference: Date,
): RegimeDerivation => {
  const warnings: DerivationWarning[] = [];

  // --- MEI antes de Simples: todo MEI também é optante do Simples. ---
  const meiExclusion = evaluateExclusion(payload.data_exclusao_do_mei, reference);
  if (isOptionFlagTrue(payload.opcao_pelo_mei)) {
    if (meiExclusion === 'effective') {
      warnings.push({
        code: 'desenquadrado_do_mei',
        message: `A Receita registra desenquadramento do MEI em ${payload.data_exclusao_do_mei}. A opção não está mais vigente.`,
      });
    } else {
      if (meiExclusion === 'scheduled') {
        warnings.push({
          code: 'exclusao_agendada',
          message: `Há desenquadramento do MEI agendado para ${payload.data_exclusao_do_mei}.`,
        });
      }
      return {
        regime: 'mei',
        confidence: 'alta',
        reason: 'A Receita registra opção vigente pelo MEI.',
        optedAt: typeof payload.data_opcao_pelo_mei === 'string' ? payload.data_opcao_pelo_mei : null,
        warnings,
      };
    }
  }

  // --- Simples Nacional ---
  const simplesExclusion = evaluateExclusion(payload.data_exclusao_do_simples, reference);
  if (isOptionFlagTrue(payload.opcao_pelo_simples)) {
    if (simplesExclusion === 'effective') {
      warnings.push({
        code: 'excluido_do_simples',
        message: `A Receita registra exclusão do Simples Nacional em ${payload.data_exclusao_do_simples}. A opção não está mais vigente.`,
      });
    } else {
      if (simplesExclusion === 'scheduled') {
        warnings.push({
          code: 'exclusao_agendada',
          message: `Há exclusão do Simples Nacional agendada para ${payload.data_exclusao_do_simples}.`,
        });
      }
      return {
        regime: 'simples_nacional',
        confidence: 'alta',
        reason: 'A Receita registra opção vigente pelo Simples Nacional.',
        optedAt:
          typeof payload.data_opcao_pelo_simples === 'string'
            ? payload.data_opcao_pelo_simples
            : null,
        warnings,
      };
    }
  }

  // --- Lucro Presumido / Real pelo histórico de forma de tributação ---
  const regimeHistory = Array.isArray(payload.regime_tributario) ? payload.regime_tributario : [];
  const latest = regimeHistory
    .map((entry) => ({
      year: Number(entry?.ano ?? Number.NaN),
      form: normalizeText(entry?.forma_de_tributacao),
    }))
    .filter((entry) => Number.isFinite(entry.year) && entry.form.length > 0)
    .sort((left, right) => right.year - left.year)[0];

  if (latest) {
    const matches = (tokens: string[]): boolean =>
      tokens.some((token) => latest.form.includes(token));

    // Ordem importa: 'LUCRO REAL' contém 'REAL', e 'PRESUMIDO' é mais específico.
    if (matches(REGIME_PRESUMIDO_TOKENS)) {
      return {
        regime: 'lucro_presumido',
        confidence: 'media',
        reason: `A Receita registra "${latest.form}" como forma de tributação em ${latest.year}.`,
        optedAt: null,
        warnings,
      };
    }
    if (matches(REGIME_REAL_TOKENS)) {
      return {
        regime: 'lucro_real',
        confidence: 'media',
        reason: `A Receita registra "${latest.form}" como forma de tributação em ${latest.year}.`,
        optedAt: null,
        warnings,
      };
    }
    if (matches(REGIME_SIMPLES_TOKENS)) {
      return {
        regime: 'simples_nacional',
        confidence: 'media',
        reason: `A Receita registra "${latest.form}" como forma de tributação em ${latest.year}, mas não há indicador de opção vigente.`,
        optedAt: null,
        warnings,
      };
    }
  }

  // --- Indeterminado: distinguir "sem dado" de "não optante declarado" ---
  const simplesUnknown = isOptionFlagUnknown(payload.opcao_pelo_simples);
  const meiUnknown = isOptionFlagUnknown(payload.opcao_pelo_mei);

  if (simplesUnknown || meiUnknown) {
    warnings.push({
      code: 'dado_ausente',
      message:
        'A base pública não informou a opção pelo Simples ou pelo MEI. Campo ausente não significa que a empresa não seja optante — confirme o regime manualmente.',
    });
  }

  return {
    regime: 'indeterminado',
    confidence: 'requer_confirmacao',
    reason: simplesUnknown || meiUnknown
      ? 'A base pública não trouxe os indicadores de regime.'
      : 'A empresa não consta como optante do Simples nem do MEI, e não há forma de tributação declarada.',
    optedAt: null,
    warnings,
  };
};

export interface DeriveTaxProfileInput {
  payload: CnpjRegistryPayload;
  cnaeAnexoMap: CnaeAnexoMapEntry[];
  /** Data de referência para avaliar vigências. Injetada para tornar o resultado testável. */
  referenceDate: Date;
}

export const deriveTaxProfile = ({
  payload,
  cnaeAnexoMap,
  referenceDate,
}: DeriveTaxProfileInput): DerivedTaxProfile => {
  const warnings: DerivationWarning[] = [];

  const regimeDerivation = deriveRegimeFromRegistry(payload, referenceDate);
  warnings.push(...regimeDerivation.warnings);

  const situacao = String(payload.situacao_cadastral ?? '').trim();
  const registrationActive = situacao === SITUACAO_CADASTRAL_ATIVA;
  const registrationStatusLabel =
    typeof payload.descricao_situacao_cadastral === 'string' &&
    payload.descricao_situacao_cadastral.trim().length > 0
      ? payload.descricao_situacao_cadastral.trim()
      : 'Não informada';

  if (situacao.length > 0 && !registrationActive) {
    warnings.push({
      code: 'registro_inativo',
      message: `O CNPJ consta como "${registrationStatusLabel}" na Receita. Confirme a situação antes de configurar a apuração.`,
    });
  }

  const cnaePrincipal = normalizeCnae(payload.cnae_fiscal);
  const cnaesSecundarios: CnaeEntry[] = (
    Array.isArray(payload.cnaes_secundarios) ? payload.cnaes_secundarios : []
  )
    .map((entry) => ({
      code: normalizeCnae(entry?.codigo),
      description: typeof entry?.descricao === 'string' ? entry.descricao : '',
    }))
    .filter((entry) => entry.code.length > 0);

  // Anexo só é sugerido para Simples: MEI tem DAS fixo e Presumido/Real não usam anexo.
  let suggestedAnexo: SimplesAnexo | null = null;
  let anexoConfidence: DerivationConfidence = 'requer_confirmacao';
  let anexoReason = 'O anexo não se aplica a este regime.';

  if (regimeDerivation.regime === 'simples_nacional') {
    const match = cnaePrincipal ? resolveAnexoByCnae(cnaePrincipal, cnaeAnexoMap) : null;
    if (match) {
      suggestedAnexo = match.anexo;
      anexoConfidence = match.confidence;
      anexoReason = match.note
        ? `Sugerido pelo CNAE principal ${cnaePrincipal} (${match.note}).`
        : `Sugerido pelo CNAE principal ${cnaePrincipal}.`;
      if (match.confidence !== 'alta') {
        warnings.push({
          code: 'anexo_requer_confirmacao',
          message:
            'O CNAE principal não determina o anexo com segurança. Confirme com o seu contador antes de apurar.',
        });
      }
    } else {
      anexoReason = cnaePrincipal
        ? `Não há mapeamento para o CNAE ${cnaePrincipal}.`
        : 'A base pública não informou o CNAE principal.';
      warnings.push({
        code: 'cnae_sem_mapeamento',
        message: `${anexoReason} Selecione o anexo manualmente.`,
      });
    }

    // Secundário apontando outro anexo é o sinal mais barato de receita mista —
    // e receita mista sem segregação é a maior fonte de erro na apuração.
    const secondaryAnexos = new Set<SimplesAnexo>();
    for (const entry of cnaesSecundarios) {
      const match2 = resolveAnexoByCnae(entry.code, cnaeAnexoMap);
      if (match2) secondaryAnexos.add(match2.anexo);
    }
    if (suggestedAnexo) secondaryAnexos.delete(suggestedAnexo);

    if (secondaryAnexos.size > 0) {
      warnings.push({
        code: 'atividade_mista',
        message: `Os CNAEs secundários apontam também para o(s) anexo(s) ${[...secondaryAnexos].join(', ')}. Se houver receita nessas atividades, classifique os produtos para separar a apuração.`,
      });
    }

    return {
      regime: regimeDerivation.regime,
      regimeConfidence: regimeDerivation.confidence,
      regimeReason: regimeDerivation.reason,
      optedAt: regimeDerivation.optedAt,
      suggestedAnexo,
      anexoConfidence,
      anexoReason,
      suggestedMeiActivityType: null,
      razaoSocial: typeof payload.razao_social === 'string' ? payload.razao_social : '',
      nomeFantasia: typeof payload.nome_fantasia === 'string' ? payload.nome_fantasia : '',
      uf: typeof payload.uf === 'string' ? payload.uf : '',
      municipio: typeof payload.municipio === 'string' ? payload.municipio : '',
      codigoMunicipioIbge: String(payload.codigo_municipio_ibge ?? '').replace(/\D/g, ''),
      cnaePrincipal,
      cnaePrincipalDescricao:
        typeof payload.cnae_fiscal_descricao === 'string' ? payload.cnae_fiscal_descricao : '',
      cnaesSecundarios,
      hasMixedActivity: secondaryAnexos.size > 0,
      registrationActive,
      registrationStatusLabel,
      warnings,
    };
  }

  // MEI: o tipo de atividade define o valor fixo do DAS. O CNAE sugere comércio
  // ou serviço, mas a combinação dos dois é comum e não é inferível com
  // segurança — por isso a sugestão nunca é conclusiva.
  let suggestedMeiActivityType: MeiActivityType | null = null;
  if (regimeDerivation.regime === 'mei') {
    const principalMatch = cnaePrincipal ? resolveAnexoByCnae(cnaePrincipal, cnaeAnexoMap) : null;
    const secondaryAnexos = new Set<SimplesAnexo>();
    for (const entry of cnaesSecundarios) {
      const match2 = resolveAnexoByCnae(entry.code, cnaeAnexoMap);
      if (match2) secondaryAnexos.add(match2.anexo);
    }

    const anexos = new Set<SimplesAnexo>(secondaryAnexos);
    if (principalMatch) anexos.add(principalMatch.anexo);

    const hasCommerce = anexos.has('I') || anexos.has('II');
    const hasService = anexos.has('III') || anexos.has('IV') || anexos.has('V');

    if (hasCommerce && hasService) suggestedMeiActivityType = 'comercio_servicos';
    else if (hasCommerce) suggestedMeiActivityType = 'comercio';
    else if (hasService) suggestedMeiActivityType = 'servicos';

    anexoReason = 'O MEI recolhe valor fixo; o anexo não se aplica.';
  }

  return {
    regime: regimeDerivation.regime,
    regimeConfidence: regimeDerivation.confidence,
    regimeReason: regimeDerivation.reason,
    optedAt: regimeDerivation.optedAt,
    suggestedAnexo: null,
    anexoConfidence,
    anexoReason,
    suggestedMeiActivityType,
    razaoSocial: typeof payload.razao_social === 'string' ? payload.razao_social : '',
    nomeFantasia: typeof payload.nome_fantasia === 'string' ? payload.nome_fantasia : '',
    uf: typeof payload.uf === 'string' ? payload.uf : '',
    municipio: typeof payload.municipio === 'string' ? payload.municipio : '',
    codigoMunicipioIbge: String(payload.codigo_municipio_ibge ?? '').replace(/\D/g, ''),
    cnaePrincipal,
    cnaePrincipalDescricao:
      typeof payload.cnae_fiscal_descricao === 'string' ? payload.cnae_fiscal_descricao : '',
    cnaesSecundarios,
    hasMixedActivity: false,
    registrationActive,
    registrationStatusLabel,
    warnings,
  };
};
