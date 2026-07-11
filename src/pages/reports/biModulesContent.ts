import { LucideIcon, LayoutDashboard, TrendingUp, Users, Wallet, Package, Sparkles } from 'lucide-react';
import { AnalyticsModuleCategory } from '../../types';

export interface BiModuleContent {
  description: string;
  benefits: [string, string, string];
  metrics: string[];
  icon: LucideIcon;
  recommended?: boolean;
}

export const BI_MODULE_CONTENT: Record<string, BiModuleContent> = {
  dashboard_executivo: {
    description:
      'Indicadores gerais de faturamento, vendas, clientes, pipeline, contas a receber e estoque em um único painel executivo.',
    benefits: [
      'Visão consolidada do negócio em tempo real',
      'Menos tempo procurando números em telas separadas',
      'Decisões mais rápidas com indicadores sempre atualizados',
    ],
    metrics: ['Faturamento do mês', 'Total de vendas', 'Saúde financeira', 'Estoque baixo'],
    icon: LayoutDashboard,
  },
  sales_analytics: {
    description:
      'Funil de vendas, conversão por etapa, ticket médio, tempo de negociação, motivos de perda, ranking de vendedores e previsão de receita.',
    benefits: [
      'Identifique em qual etapa o funil está travando',
      'Compare desempenho entre vendedores',
      'Antecipe a receita dos próximos meses',
    ],
    metrics: ['Funil de vendas por etapa', 'Ticket médio', 'Motivos de perda', 'Previsão de receita'],
    icon: TrendingUp,
    recommended: true,
  },
  customer_analytics: {
    description:
      'Clientes mais rentáveis, inativos, risco de churn, frequência de compra, segmentação, LTV estimado e última interação.',
    benefits: [
      'Priorize os clientes com maior potencial de receita',
      'Antecipe cancelamentos antes que aconteçam',
      'Segmente sua base para ações mais certeiras',
    ],
    metrics: ['Ranking de clientes rentáveis', 'Score de risco de churn', 'LTV estimado', 'Frequência de compra'],
    icon: Users,
  },
  financial_analytics: {
    description:
      'Receita realizada e prevista, inadimplência, contas a receber, fluxo de caixa projetado e evolução financeira.',
    benefits: [
      'Enxergue o caixa dos próximos meses antes que aperte',
      'Reduza a inadimplência com visibilidade antecipada',
      'Acompanhe a evolução financeira em um só lugar',
    ],
    metrics: ['Fluxo de caixa projetado', 'Inadimplência', 'Receita realizada vs. prevista', 'Evolução financeira'],
    icon: Wallet,
  },
  inventory_analytics: {
    description:
      'Giro de estoque, produtos parados, ruptura, produtos mais vendidos, desempenho de fornecedores e sugestão de reposição.',
    benefits: [
      'Evite capital parado em produtos sem giro',
      'Reduza rupturas dos itens mais vendidos',
      'Saiba quais fornecedores realmente entregam no prazo',
    ],
    metrics: ['Giro de estoque', 'Produtos parados', 'Ranking de fornecedores', 'Sugestão de reposição'],
    icon: Package,
  },
  gestly_insights: {
    description:
      'Central de alertas e recomendações inteligentes: oportunidades sem retorno, clientes em risco, metas ameaçadas, cobranças atrasadas e ações sugeridas.',
    benefits: [
      'Receba alertas antes que o problema aconteça',
      'Ação sugerida pronta para cada situação',
      'Nunca mais perca um follow-up importante',
    ],
    metrics: ['Negócios parados', 'Clientes em risco', 'Cobranças atrasadas', 'Ações sugeridas pela Gestly'],
    icon: Sparkles,
    recommended: true,
  },
};

export const BI_CATEGORY_LABELS: Record<'all' | AnalyticsModuleCategory, string> = {
  all: 'Todos',
  geral: 'Geral',
  vendas: 'Vendas',
  clientes: 'Clientes',
  financeiro: 'Financeiro',
  estoque: 'Estoque',
  ia: 'Inteligência Artificial',
};

export const BI_FILTER_CATEGORIES: ('all' | AnalyticsModuleCategory)[] = [
  'all',
  'vendas',
  'clientes',
  'financeiro',
  'estoque',
  'ia',
];
