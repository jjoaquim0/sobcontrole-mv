/**
 * Story 1.29 — Persistência da classificação fiscal.
 *
 * A tela em lote ordena por receita do período: classificar os 20 produtos que
 * respondem por 80% do faturamento entrega quase toda a precisão possível. Uma
 * lista alfabética transformaria a tarefa em algo inviável.
 */

import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import type { SimplesAnexo } from './taxProfileDerivation';
import type { TributacaoFiscal } from './taxClassification';

const requireCompanyId = (): string => {
  const companyId = useAuthStore.getState().company?.id;
  if (!companyId) throw new Error('Empresa não identificada.');
  return companyId;
};

const assertAccess = (): void => {
  const role = useAuthStore.getState().profile?.role;
  if (role !== 'admin' && role !== 'manager') {
    throw new Error('Apenas administradores e gerentes podem classificar produtos.');
  }
};

export interface ClassifiableProduct {
  productId: string;
  name: string;
  sku: string;
  categoryId: string | null;
  categoryName: string;
  /** Receita do produto no período — base da ordenação por relevância. */
  revenue: number;
  ownAnexo: SimplesAnexo | null;
  ownTributacao: TributacaoFiscal | null;
  inheritedAnexo: SimplesAnexo | null;
  inheritedTributacao: TributacaoFiscal | null;
  isExplicit: boolean;
}

export interface CategoryClassification {
  categoryId: string;
  categoryName: string;
  anexo: SimplesAnexo | null;
  tributacao: TributacaoFiscal | null;
  productCount: number;
}

/**
 * Produtos com a classificação própria, a herdada e a receita do período.
 * Ordenados por receita decrescente.
 */
export const listClassifiableProducts = async (
  dateFrom: string,
  dateTo: string,
): Promise<ClassifiableProduct[]> => {
  assertAccess();
  const companyId = requireCompanyId();

  const [products, classifications, items] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, sku, category_id, categories(name)')
      .eq('company_id', companyId)
      .eq('is_active', true),
    supabase
      .from('product_tax_classification')
      .select('product_id, category_id, anexo, tributacao')
      .eq('company_id', companyId),
    supabase
      .from('sale_items')
      .select('product_id, subtotal, sales!inner(company_id, created_at, payment_status)')
      .eq('sales.company_id', companyId)
      .neq('sales.payment_status', 'cancelled')
      .gte('sales.created_at', `${dateFrom}T00:00:00`)
      .lte('sales.created_at', `${dateTo}T23:59:59.999`),
  ]);

  const revenueByProduct = new Map<string, number>();
  for (const item of items.data ?? []) {
    const productId = String((item as { product_id: string }).product_id);
    const subtotal = Number((item as { subtotal?: number }).subtotal ?? 0);
    revenueByProduct.set(productId, (revenueByProduct.get(productId) ?? 0) + subtotal);
  }

  const byProduct = new Map<string, { anexo: SimplesAnexo | null; tributacao: TributacaoFiscal | null }>();
  const byCategory = new Map<string, { anexo: SimplesAnexo | null; tributacao: TributacaoFiscal | null }>();

  for (const row of classifications.data ?? []) {
    const entry = {
      anexo: (row.anexo ?? null) as SimplesAnexo | null,
      tributacao: (row.tributacao ?? null) as TributacaoFiscal | null,
    };
    if (row.product_id) byProduct.set(String(row.product_id), entry);
    else if (row.category_id) byCategory.set(String(row.category_id), entry);
  }

  return (products.data ?? [])
    .map((product): ClassifiableProduct => {
      const productId = String(product.id);
      const categoryId = product.category_id ? String(product.category_id) : null;
      const own = byProduct.get(productId);
      const inherited = categoryId ? byCategory.get(categoryId) : undefined;

      return {
        productId,
        name: String(product.name),
        sku: String(product.sku ?? ''),
        categoryId,
        categoryName:
          (product as { categories?: { name?: string } | null }).categories?.name ?? 'Sem categoria',
        revenue: revenueByProduct.get(productId) ?? 0,
        ownAnexo: own?.anexo ?? null,
        ownTributacao: own?.tributacao ?? null,
        inheritedAnexo: inherited?.anexo ?? null,
        inheritedTributacao: inherited?.tributacao ?? null,
        isExplicit: Boolean(
          own?.anexo || own?.tributacao || inherited?.anexo || inherited?.tributacao,
        ),
      };
    })
    .sort((left, right) => right.revenue - left.revenue);
};

export const listCategoryClassifications = async (): Promise<CategoryClassification[]> => {
  assertAccess();
  const companyId = requireCompanyId();

  const [categories, classifications, products] = await Promise.all([
    supabase.from('categories').select('id, name').eq('company_id', companyId),
    supabase
      .from('product_tax_classification')
      .select('category_id, anexo, tributacao')
      .eq('company_id', companyId)
      .not('category_id', 'is', null),
    supabase.from('products').select('category_id').eq('company_id', companyId).eq('is_active', true),
  ]);

  const counts = new Map<string, number>();
  for (const product of products.data ?? []) {
    const categoryId = product.category_id ? String(product.category_id) : null;
    if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
  }

  const byCategory = new Map(
    (classifications.data ?? []).map((row) => [
      String(row.category_id),
      {
        anexo: (row.anexo ?? null) as SimplesAnexo | null,
        tributacao: (row.tributacao ?? null) as TributacaoFiscal | null,
      },
    ]),
  );

  return (categories.data ?? []).map((category) => {
    const categoryId = String(category.id);
    const classification = byCategory.get(categoryId);
    return {
      categoryId,
      categoryName: String(category.name),
      anexo: classification?.anexo ?? null,
      tributacao: classification?.tributacao ?? null,
      productCount: counts.get(categoryId) ?? 0,
    };
  });
};

export interface ClassificationInput {
  anexo: SimplesAnexo | null;
  tributacao: TributacaoFiscal | null;
}

/**
 * Grava ou remove a classificação. Sem nenhum atributo definido, a linha é
 * apagada em vez de gravada vazia — o CHECK do banco proíbe registro sem
 * conteúdo e uma linha vazia significaria "classificado", não "herda".
 */
const upsertClassification = async (
  target: { productId?: string; categoryId?: string },
  input: ClassificationInput,
): Promise<void> => {
  assertAccess();
  const companyId = requireCompanyId();
  const userId = useAuthStore.getState().profile?.id ?? null;

  const column = target.productId ? 'product_id' : 'category_id';
  const value = target.productId ?? target.categoryId;

  if (!input.anexo && !input.tributacao) {
    const { error } = await supabase
      .from('product_tax_classification')
      .delete()
      .eq('company_id', companyId)
      .eq(column, value as string);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('product_tax_classification').upsert(
    {
      company_id: companyId,
      product_id: target.productId ?? null,
      category_id: target.categoryId ?? null,
      anexo: input.anexo,
      tributacao: input.tributacao,
      updated_by: userId,
    },
    { onConflict: target.productId ? 'company_id,product_id' : 'company_id,category_id' },
  );

  if (error) throw new Error(error.message);
};

export const classifyProduct = (productId: string, input: ClassificationInput) =>
  upsertClassification({ productId }, input);

export const classifyCategory = (categoryId: string, input: ClassificationInput) =>
  upsertClassification({ categoryId }, input);

/** Aplica a mesma classificação a vários produtos de uma vez. */
export const classifyProductsInBulk = async (
  productIds: string[],
  input: ClassificationInput,
): Promise<void> => {
  assertAccess();
  const companyId = requireCompanyId();
  const userId = useAuthStore.getState().profile?.id ?? null;

  if (productIds.length === 0) return;

  if (!input.anexo && !input.tributacao) {
    const { error } = await supabase
      .from('product_tax_classification')
      .delete()
      .eq('company_id', companyId)
      .in('product_id', productIds);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from('product_tax_classification').upsert(
    productIds.map((productId) => ({
      company_id: companyId,
      product_id: productId,
      category_id: null,
      anexo: input.anexo,
      tributacao: input.tributacao,
      updated_by: userId,
    })),
    { onConflict: 'company_id,product_id' },
  );

  if (error) throw new Error(error.message);
};
