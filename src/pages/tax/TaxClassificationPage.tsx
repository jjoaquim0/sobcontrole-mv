import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Layers, Search, Info } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { DashboardSection } from '../reports/components/DashboardSection';
import { formatCurrency } from '../reports/reportFormatters';
import { useAuthStore } from '../../store/authStore';
import {
  classifyCategory,
  classifyProductsInBulk,
  listCategoryClassifications,
  listClassifiableProducts,
} from '../../services/taxClassificationService';
import { ANEXO_VALUES, TRIBUTACAO_VALUES, type TributacaoFiscal } from '../../services/taxClassification';
import type { SimplesAnexo } from '../../services/taxProfileDerivation';

const TRIBUTACAO_LABELS: Record<TributacaoFiscal, string> = {
  normal: 'Tributação normal',
  st: 'Substituição tributária (ICMS-ST)',
  monofasico: 'Monofásico (PIS/COFINS)',
  isento: 'Isento',
  exportacao: 'Exportação',
};

const selectClass =
  'rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5 dark:text-white';

const periodBounds = (): { from: string; to: string } => {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  return { from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
};

export const TaxClassificationPage: React.FC = () => {
  const queryClient = useQueryClient();
  const companyId = useAuthStore((state) => state.company?.id);
  const [search, setSearch] = useState('');
  const [onlyUnclassified, setOnlyUnclassified] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAnexo, setBulkAnexo] = useState<SimplesAnexo | ''>('');
  const [bulkTributacao, setBulkTributacao] = useState<TributacaoFiscal | ''>('');

  const period = useMemo(periodBounds, []);

  const productsQuery = useQuery({
    queryKey: ['tax', 'classifiable-products', companyId, period.from, period.to],
    queryFn: () => listClassifiableProducts(period.from, period.to),
    enabled: Boolean(companyId),
  });

  const categoriesQuery = useQuery({
    queryKey: ['tax', 'category-classifications', companyId],
    queryFn: listCategoryClassifications,
    enabled: Boolean(companyId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tax'] });
  };

  const bulkMutation = useMutation({
    mutationFn: () =>
      classifyProductsInBulk([...selected], {
        anexo: bulkAnexo || null,
        tributacao: bulkTributacao || null,
      }),
    onSuccess: () => {
      toast.success(`${selected.size} produto(s) classificado(s).`);
      setSelected(new Set());
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Não foi possível classificar.'),
  });

  const categoryMutation = useMutation({
    mutationFn: ({
      categoryId,
      anexo,
      tributacao,
    }: {
      categoryId: string;
      anexo: SimplesAnexo | null;
      tributacao: TributacaoFiscal | null;
    }) => classifyCategory(categoryId, { anexo, tributacao }),
    onSuccess: () => {
      toast.success('Categoria classificada.');
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : 'Não foi possível classificar.'),
  });

  const products = productsQuery.data ?? [];
  const filtered = products.filter((product) => {
    if (onlyUnclassified && product.isExplicit) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term)
    );
  });

  const toggle = (productId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const totalRevenue = products.reduce((sum, product) => sum + product.revenue, 0);
  const classifiedRevenue = products
    .filter((product) => product.isExplicit)
    .reduce((sum, product) => sum + product.revenue, 0);
  const coverage = totalRevenue > 0 ? classifiedRevenue / totalRevenue : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classificação fiscal"
        subtitle="Define qual anexo se aplica a cada produto e o que já teve o tributo recolhido na origem."
      />

      <div className="flex items-start gap-3 rounded-2xl bg-[#00a8d8]/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#0089b0] dark:text-[#53dcff]" aria-hidden="true" />
        <div className="text-sm text-gray-700 dark:text-white/80">
          <p>
            A classificação é <strong>herdada em cascata</strong>: produto → categoria → perfil da
            empresa. Você não precisa classificar tudo — a lista abaixo está ordenada por receita,
            então classificar os primeiros itens já resolve a maior parte da precisão.
          </p>
          {coverage !== null && (
            <p className="mt-2">
              Cobertura atual dos últimos 6 meses:{' '}
              <strong>
                {new Intl.NumberFormat('pt-BR', {
                  style: 'percent',
                  maximumFractionDigits: 1,
                }).format(coverage)}
              </strong>{' '}
              da receita.
            </p>
          )}
          <p className="mt-2 text-xs text-gray-600 dark:text-white/60">
            Na dúvida sobre substituição tributária ou monofásico, confirme com o seu contador —
            ele consegue responder isso a partir do pacote de exportação.
          </p>
        </div>
      </div>

      <DashboardSection
        title="Padrão por categoria"
        description="Vale para todos os produtos da categoria que não tiverem classificação própria."
        icon={<Layers className="h-5 w-5" aria-hidden="true" />}
      >
        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
          <table className="w-full min-w-[600px] text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-white/60">
              <tr>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Produtos</th>
                <th className="px-4 py-3">Anexo</th>
                <th className="px-4 py-3">Tributação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {(categoriesQuery.data ?? []).map((category) => (
                <tr key={category.categoryId}>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                    {category.categoryName}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-white/60">
                    {category.productCount}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className={selectClass}
                      value={category.anexo ?? ''}
                      aria-label={`Anexo da categoria ${category.categoryName}`}
                      onChange={(event) =>
                        categoryMutation.mutate({
                          categoryId: category.categoryId,
                          anexo: (event.target.value || null) as SimplesAnexo | null,
                          tributacao: category.tributacao,
                        })
                      }
                    >
                      <option value="">Herda da empresa</option>
                      {ANEXO_VALUES.map((anexo) => (
                        <option key={anexo} value={anexo}>Anexo {anexo}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className={selectClass}
                      value={category.tributacao ?? ''}
                      aria-label={`Tributação da categoria ${category.categoryName}`}
                      onChange={(event) =>
                        categoryMutation.mutate({
                          categoryId: category.categoryId,
                          anexo: category.anexo,
                          tributacao: (event.target.value || null) as TributacaoFiscal | null,
                        })
                      }
                    >
                      <option value="">Herda (normal)</option>
                      {TRIBUTACAO_VALUES.map((value) => (
                        <option key={value} value={value}>{TRIBUTACAO_LABELS[value]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Produtos por relevância de receita"
        description="Os primeiros da lista são os que mais afetam o imposto apurado."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou SKU"
              aria-label="Buscar produto"
              className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/70">
            <input
              type="checkbox"
              checked={onlyUnclassified}
              onChange={(event) => setOnlyUnclassified(event.target.checked)}
            />
            Mostrar só os não classificados
          </label>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-[#0B2551]/5 p-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {selected.size} selecionado(s)
            </span>
            <select
              className={selectClass}
              value={bulkAnexo}
              aria-label="Anexo a aplicar em lote"
              onChange={(event) => setBulkAnexo(event.target.value as SimplesAnexo | '')}
            >
              <option value="">Anexo: manter herança</option>
              {ANEXO_VALUES.map((anexo) => (
                <option key={anexo} value={anexo}>Anexo {anexo}</option>
              ))}
            </select>
            <select
              className={selectClass}
              value={bulkTributacao}
              aria-label="Tributação a aplicar em lote"
              onChange={(event) => setBulkTributacao(event.target.value as TributacaoFiscal | '')}
            >
              <option value="">Tributação: manter herança</option>
              {TRIBUTACAO_VALUES.map((value) => (
                <option key={value} value={value}>{TRIBUTACAO_LABELS[value]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => bulkMutation.mutate()}
              disabled={bulkMutation.isPending}
              className="rounded-xl bg-[#0B2551] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
            >
              Aplicar aos selecionados
            </button>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-white/60">
              <tr>
                <th className="w-10 px-4 py-3" />
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Receita (6 meses)</th>
                <th className="px-4 py-3">Anexo</th>
                <th className="px-4 py-3">Tributação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/10">
              {filtered.map((product) => (
                <tr key={product.productId}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(product.productId)}
                      onChange={() => toggle(product.productId)}
                      aria-label={`Selecionar ${product.name}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900 dark:text-white">{product.name}</span>
                    {!product.isExplicit && (
                      <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-white/10 dark:text-white/70">
                        herdando
                      </span>
                    )}
                    <span className="block text-xs text-gray-500 dark:text-white/50">{product.sku}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-white/70">{product.categoryName}</td>
                  <td className="px-4 py-3">{formatCurrency(product.revenue)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/70">
                    {product.ownAnexo
                      ? `Anexo ${product.ownAnexo}`
                      : product.inheritedAnexo
                        ? `Anexo ${product.inheritedAnexo} (categoria)`
                        : 'Da empresa'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 dark:text-white/70">
                    {product.ownTributacao
                      ? TRIBUTACAO_LABELS[product.ownTributacao]
                      : product.inheritedTributacao
                        ? `${TRIBUTACAO_LABELS[product.inheritedTributacao]} (categoria)`
                        : 'Normal'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardSection>
    </div>
  );
};
