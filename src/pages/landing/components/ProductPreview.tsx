import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  LayoutDashboard,
  KanbanSquare,
  Wallet,
  Package,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { SectionEyebrow } from './shared'

type TabKey = 'dashboard' | 'pipeline' | 'financeiro' | 'estoque' | 'gestly'

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'pipeline', label: 'Pipeline', icon: KanbanSquare },
  { key: 'financeiro', label: 'Financeiro', icon: Wallet },
  { key: 'estoque', label: 'Estoque', icon: Package },
  { key: 'gestly', label: 'Central de Inteligência', icon: Sparkles },
]

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="liquid-glass rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-white/40">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  )
}

function DashboardPanel() {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Receita do Mês" value="R$ 24.000" />
        <Tile label="Total de Vendas" value="12" />
        <Tile label="Ticket Médio" value="R$ 2.000" />
        <Tile label="Estoque Baixo" value="2 produtos" />
      </div>
      <div className="mt-4 liquid-glass rounded-xl p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/50">Próximas Ações</div>
        <ul className="mt-2 space-y-2">
          <li className="text-xs text-white/70 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            Revise o estoque baixo
          </li>
          <li className="text-xs text-white/70 flex items-center gap-2">
            <ArrowDownCircle className="w-3.5 h-3.5 text-red-400 shrink-0" aria-hidden="true" />
            Acompanhe os recebimentos vencidos
          </li>
        </ul>
      </div>
    </div>
  )
}

function PipelinePanel() {
  const columns = [
    { name: 'Novo contato', deals: ['Empresa Alfa', 'Cliente B'] },
    { name: 'Em negociação', deals: ['Empresa Delta'] },
    { name: 'Proposta enviada', deals: ['Cliente C', 'Empresa Ômega'] },
    { name: 'Fechado', deals: ['Cliente D'] },
  ]
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {columns.map((col) => (
          <div key={col.name} className="liquid-glass rounded-xl p-3">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{col.name}</div>
            <div className="space-y-1.5">
              {col.deals.map((deal) => (
                <div key={deal} className="text-xs text-white/75 bg-white/5 rounded-lg px-2 py-1.5">
                  {deal}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-white/35">Etapas totalmente personalizáveis pela sua equipe.</p>
    </div>
  )
}

function FinanceiroPanel() {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Tile label="A Receber" value="R$ 9.000" />
        <Tile label="A Pagar" value="R$ 3.500" />
        <Tile label="Vencidos a Receber" value="R$ 1.200" />
      </div>
      <div className="mt-4 liquid-glass rounded-xl p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/50">Atenções no Caixa</div>
        <div className="mt-2 flex items-center gap-2 text-xs text-white/70">
          <ArrowUpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          Contas a pagar vencendo nos próximos dias
        </div>
      </div>
    </div>
  )
}

function EstoquePanel() {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Tile label="Risco de Ruptura" value="3 produtos" />
        <Tile label="Recomendações Críticas" value="1" />
        <Tile label="Produtos Parados" value="5" />
      </div>
      <div className="mt-4 liquid-glass rounded-xl p-4">
        <div className="text-xs font-semibold uppercase tracking-wider text-white/50">Recomendação</div>
        <p className="mt-2 text-xs text-white/70 leading-[1.5]">
          Planejar compra para atingir a cobertura alvo, com fornecedor sugerido a partir do
          histórico de compras do produto.
        </p>
      </div>
    </div>
  )
}

function GestlyPanel() {
  const metrics = ['Negócios parados', 'Clientes em risco', 'Cobranças atrasadas', 'Ações sugeridas pela Gestly']
  return (
    <div>
      <p className="text-xs text-white/60 leading-[1.6] max-w-md">
        Central de alertas e recomendações inteligentes, priorizadas a partir dos dados reais da
        sua operação.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {metrics.map((metric) => (
          <span
            key={metric}
            className="text-xs text-white/70 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03]"
          >
            {metric}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function ProductPreview() {
  const [active, setActive] = useState<TabKey>('dashboard')

  return (
    <section id="interface-produto" className="max-w-6xl mx-auto px-6 py-20 md:py-28 scroll-mt-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-xl mx-auto"
      >
        <div className="flex justify-center">
          <SectionEyebrow label="Interface" tag="Prévia" />
        </div>
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
          Uma prévia fiel do que
          <br />
          você vai usar todos os dias.
        </h2>
        <p className="mt-6 text-white/60 text-base leading-[1.6]">
          Os mesmos módulos, indicadores e recomendações que aparecem dentro do sistema — com
          dados ilustrativos apenas para esta prévia.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10 rounded-2xl overflow-hidden border border-white/10 bg-[#0e1014]/90 backdrop-blur-2xl"
      >
        <div className="h-11 flex items-center px-4 border-b border-white/10 relative">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 text-xs text-white/50">SobControle</span>
        </div>

        <div role="tablist" aria-label="Módulos do SobControle" className="flex flex-wrap gap-1 p-3 border-b border-white/10">
          {TABS.map((tab) => {
            const isActive = tab.key === active
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`preview-tab-${tab.key}`}
                aria-selected={isActive}
                aria-controls={`preview-panel-${tab.key}`}
                onClick={() => setActive(tab.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00d2ff] ${
                  isActive ? 'bg-white text-black' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="p-5 min-h-[220px]">
          {TABS.map((tab) => (
            <div
              key={tab.key}
              role="tabpanel"
              id={`preview-panel-${tab.key}`}
              aria-labelledby={`preview-tab-${tab.key}`}
              hidden={tab.key !== active}
            >
              {tab.key === 'dashboard' && <DashboardPanel />}
              {tab.key === 'pipeline' && <PipelinePanel />}
              {tab.key === 'financeiro' && <FinanceiroPanel />}
              {tab.key === 'estoque' && <EstoquePanel />}
              {tab.key === 'gestly' && <GestlyPanel />}
            </div>
          ))}
        </div>
      </motion.div>
    </section>
  )
}
