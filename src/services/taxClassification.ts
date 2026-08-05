/**
 * Story 1.29 — Resolução da classificação fiscal em cascata.
 *
 * Módulo PURO. Resolve, para cada item de venda, qual anexo e qual tratamento
 * tributário se aplicam, seguindo a herança:
 *
 *     produto -> categoria -> perfil da empresa
 *
 * A herança é por ATRIBUTO, não por registro: um produto pode sobrescrever
 * apenas a tributação e continuar herdando o anexo da categoria. Resolver
 * registro a registro obrigaria o cliente a redigitar o que já estava certo.
 *
 * A cobertura de classificação (quanto da receita tem classificação explícita)
 * sai daqui e vai para a tela: é o que permite dizer ao cliente o quanto ele
 * pode confiar no número, em vez de apresentar estimativa sem qualificação.
 */

import type { SimplesAnexo } from './taxProfileDerivation';

export type TributacaoFiscal = 'normal' | 'st' | 'monofasico' | 'isento' | 'exportacao';

export const TRIBUTACAO_VALUES: readonly TributacaoFiscal[] = [
  'normal',
  'st',
  'monofasico',
  'isento',
  'exportacao',
] as const;

export const ANEXO_VALUES: readonly SimplesAnexo[] = ['I', 'II', 'III', 'IV', 'V'] as const;

/** Origem de cada atributo resolvido — exibida na interface e no CSV do contador. */
export type ClassificationOrigin = 'produto' | 'categoria' | 'empresa';

export interface TaxClassificationRule {
  anexo: SimplesAnexo | null;
  tributacao: TributacaoFiscal | null;
}

export interface TaxClassificationSources {
  /** Classificação por `product_id`. */
  byProduct: Map<string, TaxClassificationRule>;
  /** Classificação por `category_id`. */
  byCategory: Map<string, TaxClassificationRule>;
  /** Anexo do perfil da empresa — último nível da herança. */
  companyAnexo: SimplesAnexo | null;
}

export interface ClassifiableItem {
  productId: string;
  categoryId: string | null;
}

export interface ResolvedClassification {
  anexo: SimplesAnexo | null;
  anexoOrigin: ClassificationOrigin;
  tributacao: TributacaoFiscal;
  tributacaoOrigin: ClassificationOrigin;
  /** true quando produto ou categoria definiram ao menos um atributo. */
  isExplicit: boolean;
}

/** Default de tributação quando ninguém classificou: assume o caso comum. */
const DEFAULT_TRIBUTACAO: TributacaoFiscal = 'normal';

export const isSimplesAnexo = (value: unknown): value is SimplesAnexo =>
  typeof value === 'string' && (ANEXO_VALUES as readonly string[]).includes(value);

export const isTributacaoFiscal = (value: unknown): value is TributacaoFiscal =>
  typeof value === 'string' && (TRIBUTACAO_VALUES as readonly string[]).includes(value);

/**
 * Resolve um item pela cascata. Cada atributo desce até encontrar o primeiro
 * nível que o define.
 */
export const resolveClassification = (
  item: ClassifiableItem,
  sources: TaxClassificationSources,
): ResolvedClassification => {
  const productRule = sources.byProduct.get(item.productId);
  const categoryRule = item.categoryId ? sources.byCategory.get(item.categoryId) : undefined;

  let anexo: SimplesAnexo | null = null;
  let anexoOrigin: ClassificationOrigin = 'empresa';
  if (productRule?.anexo) {
    anexo = productRule.anexo;
    anexoOrigin = 'produto';
  } else if (categoryRule?.anexo) {
    anexo = categoryRule.anexo;
    anexoOrigin = 'categoria';
  } else {
    anexo = sources.companyAnexo;
    anexoOrigin = 'empresa';
  }

  let tributacao: TributacaoFiscal = DEFAULT_TRIBUTACAO;
  let tributacaoOrigin: ClassificationOrigin = 'empresa';
  if (productRule?.tributacao) {
    tributacao = productRule.tributacao;
    tributacaoOrigin = 'produto';
  } else if (categoryRule?.tributacao) {
    tributacao = categoryRule.tributacao;
    tributacaoOrigin = 'categoria';
  }

  // "Explícito" mede se alguém classificou de propósito — herdar o anexo da
  // empresa por ausência de cadastro NÃO conta como classificação.
  const isExplicit = Boolean(
    productRule?.anexo || productRule?.tributacao || categoryRule?.anexo || categoryRule?.tributacao,
  );

  return { anexo, anexoOrigin, tributacao, tributacaoOrigin, isExplicit };
};

export interface ClassifiableRevenueItem extends ClassifiableItem {
  /** Valor do item no período, usado para ponderar a cobertura. */
  amount: number;
}

export interface ClassificationCoverage {
  /** Fração de 0 a 1 da receita com classificação explícita. */
  coverage: number;
  classifiedAmount: number;
  totalAmount: number;
  unclassifiedProductIds: string[];
  /** false quando não há receita no período — cobertura não é calculável. */
  isCalculable: boolean;
}

/**
 * Cobertura ponderada por RECEITA, não por contagem de produtos. Classificar os
 * 20 itens que respondem por 80% do faturamento entrega quase toda a precisão
 * possível; uma métrica por contagem esconderia exatamente isso.
 */
export const calculateClassificationCoverage = (
  items: ClassifiableRevenueItem[],
  sources: TaxClassificationSources,
): ClassificationCoverage => {
  let classifiedAmount = 0;
  let totalAmount = 0;
  const unclassified = new Set<string>();

  for (const item of items) {
    const amount = Number.isFinite(item.amount) ? Math.max(0, item.amount) : 0;
    totalAmount += amount;

    if (resolveClassification(item, sources).isExplicit) {
      classifiedAmount += amount;
    } else {
      unclassified.add(item.productId);
    }
  }

  if (totalAmount <= 0) {
    return {
      coverage: 0,
      classifiedAmount: 0,
      totalAmount: 0,
      unclassifiedProductIds: [...unclassified],
      isCalculable: false,
    };
  }

  return {
    coverage: classifiedAmount / totalAmount,
    classifiedAmount,
    totalAmount,
    unclassifiedProductIds: [...unclassified],
    isCalculable: true,
  };
};

export interface ClassificationSourceRow {
  productId: string | null;
  categoryId: string | null;
  anexo: string | null;
  tributacao: string | null;
}

/**
 * Constrói as fontes a partir das linhas de `product_tax_classification`.
 * Valores inválidos vindos do banco são descartados em vez de propagados — um
 * anexo desconhecido não pode virar chave de faixa no motor de apuração.
 */
export const buildClassificationSources = (
  rows: ClassificationSourceRow[],
  companyAnexo: SimplesAnexo | null,
): TaxClassificationSources => {
  const byProduct = new Map<string, TaxClassificationRule>();
  const byCategory = new Map<string, TaxClassificationRule>();

  for (const row of rows) {
    const rule: TaxClassificationRule = {
      anexo: isSimplesAnexo(row.anexo) ? row.anexo : null,
      tributacao: isTributacaoFiscal(row.tributacao) ? row.tributacao : null,
    };

    if (!rule.anexo && !rule.tributacao) continue;

    if (row.productId) {
      byProduct.set(row.productId, rule);
    } else if (row.categoryId) {
      byCategory.set(row.categoryId, rule);
    }
  }

  return { byProduct, byCategory, companyAnexo };
};

export const EMPTY_CLASSIFICATION_SOURCES = (
  companyAnexo: SimplesAnexo | null = null,
): TaxClassificationSources => ({
  byProduct: new Map(),
  byCategory: new Map(),
  companyAnexo,
});
