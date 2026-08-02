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
    description: 'Dashboard executivo com indicadores realizados e comparação por período.',
    benefits: ['Indicadores consolidados', 'Comparação por período', 'Exportação dos resultados'],
    legacyTab: 'overview',
    defaultAccessStatus: 'available',
  },
  {
    moduleKey: 'gestly_insights',
    name: 'Central de Inteligência',
    path: '/relatorios/central-inteligencia',
    icon: Sparkles,
    description: 'Alertas e ações sugeridas a partir dos eventos registrados pela Gestly.',
    benefits: ['Alertas priorizados', 'Sinais operacionais', 'Ações vinculadas aos registros'],
    legacyTab: 'bi',
  },
  {
    moduleKey: 'sales_analytics',
    name: 'Vendas e Pipeline',
    path: '/relatorios/vendas-pipeline',
    icon: TrendingUp,
    description: 'Funil, conversão, ticket médio e desempenho comercial realizado.',
    benefits: ['Desempenho de vendas', 'Ticket médio pago', 'Pipeline por etapa'],
    legacyTab: 'sales',
  },
  {
    moduleKey: 'customer_analytics',
    name: 'Clientes',
    path: '/relatorios/clientes',
    icon: Users,
    description: 'Clientes ativos, receita, frequência e sinais objetivos de inatividade.',
    benefits: ['Clientes por receita', 'Evolução da base', 'Sinais de inatividade'],
    legacyTab: 'customers',
  },
  {
    moduleKey: 'financial_analytics',
    name: 'Financeiro',
    path: '/relatorios/financeiro',
    icon: Wallet,
    description: 'Contas a receber e pagar, inadimplência, agenda financeira e DRE gerencial.',
    benefits: ['Agenda financeira', 'Contas e inadimplência', 'Demonstrativo gerencial'],
    legacyTab: 'financial',
  },
  {
    moduleKey: 'inventory_analytics',
    name: 'Estoque e Compras',
    path: '/relatorios/estoque-compras',
    icon: Boxes,
    description: 'Rupturas, saídas registradas, produtos parados e desempenho de compras.',
    benefits: ['Alertas de ruptura', 'Movimentações de estoque', 'Produtos com mais saídas'],
    legacyTab: 'inventory',
  },
  {
    moduleKey: 'custom_reports',
    name: 'Relatórios Personalizados',
    path: '/relatorios/personalizados',
    icon: SlidersHorizontal,
    description: 'Construtor de relatórios em planejamento.',
    benefits: ['Recurso ainda não disponível', 'Sem dados ou configurações simuladas'],
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
