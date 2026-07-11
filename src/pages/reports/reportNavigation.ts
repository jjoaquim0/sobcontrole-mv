import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { AnalyticsModuleAccessStatus } from '../../types';

export interface ReportNavigationItem {
  moduleKey: string;
  name: string;
  path: string;
  icon: LucideIcon;
  description: string;
  benefits: readonly string[];
  legacyTab?: string;
  defaultAccessStatus?: AnalyticsModuleAccessStatus;
}

export const REPORTS_ROOT_PATH = '/relatorios';

export const REPORT_NAVIGATION_ITEMS: readonly ReportNavigationItem[] = [
  {
    moduleKey: 'dashboard_executivo',
    name: 'Visão Geral',
    path: '/relatorios/visao-geral',
    icon: LayoutDashboard,
    description: 'Dashboard resumido com os principais indicadores da empresa.',
    benefits: ['Indicadores consolidados', 'Comparação por período', 'Exportação dos resultados'],
    legacyTab: 'overview',
    defaultAccessStatus: 'available',
  },
  {
    moduleKey: 'gestly_insights',
    name: 'Central de Inteligência',
    path: '/relatorios/central-inteligencia',
    icon: Sparkles,
    description: 'Insights, alertas, oportunidades e ações sugeridas pela Gestly.',
    benefits: ['Alertas priorizados', 'Oportunidades em destaque', 'Ações sugeridas pela Gestly'],
    legacyTab: 'bi',
  },
  {
    moduleKey: 'sales_analytics',
    name: 'Vendas e Pipeline',
    path: '/relatorios/vendas-pipeline',
    icon: TrendingUp,
    description: 'Funil, conversão, ticket médio, previsão e desempenho comercial.',
    benefits: ['Desempenho de vendas', 'Ticket médio', 'Visão do pipeline comercial'],
    legacyTab: 'sales',
  },
  {
    moduleKey: 'customer_analytics',
    name: 'Clientes',
    path: '/relatorios/clientes',
    icon: Users,
    description: 'Clientes ativos, rentabilidade, segmentação e risco de churn.',
    benefits: ['Clientes mais rentáveis', 'Segmentação da base', 'Sinais de inatividade'],
    legacyTab: 'customers',
  },
  {
    moduleKey: 'financial_analytics',
    name: 'Financeiro',
    path: '/relatorios/financeiro',
    icon: Wallet,
    description: 'Receitas, contas a receber, inadimplência, fluxo de caixa e DRE.',
    benefits: ['Fluxo de caixa', 'Contas e inadimplencia', 'Demonstrativo de resultados'],
    legacyTab: 'financial',
  },
  {
    moduleKey: 'inventory_analytics',
    name: 'Estoque e Compras',
    path: '/relatorios/estoque-compras',
    icon: Boxes,
    description: 'Giro de estoque, rupturas, produtos parados e fornecedores.',
    benefits: ['Alertas de ruptura', 'Movimentações de estoque', 'Produtos com maior giro'],
    legacyTab: 'inventory',
  },
  {
    moduleKey: 'custom_reports',
    name: 'Relatórios Personalizados',
    path: '/relatorios/personalizados',
    icon: SlidersHorizontal,
    description: 'Crie, salve, exporte e agende relatórios sob medida.',
    benefits: ['Construtor personalizado', 'Agendamento recorrente', 'Exportação configurável'],
    defaultAccessStatus: 'coming_soon',
  },
] as const;

export const getReportNavigationItem = (moduleKey: string) =>
  REPORT_NAVIGATION_ITEMS.find((item) => item.moduleKey === moduleKey);

export const getLegacyReportPath = (tab: string | null) => {
  if (tab === 'dre') return '/relatorios/financeiro?view=dre';
  return REPORT_NAVIGATION_ITEMS.find((item) => item.legacyTab === tab)?.path || '/relatorios/visao-geral';
};

export const ReportsMenuIcon = BarChart3;
