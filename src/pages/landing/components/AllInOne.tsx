import { motion } from 'framer-motion'
import {
  CalendarDays,
  FileText,
  KanbanSquare,
  Package,
  Sparkles,
  Truck,
  Users,
  Wallet,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { SectionEyebrow } from './shared'

const areas: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: KanbanSquare, title: 'Vendas e Pipeline', description: 'Oportunidades, propostas e negociações do primeiro contato ao fechamento.' },
  { icon: Users, title: 'Clientes', description: 'Histórico e relacionamento centralizados em um só lugar.' },
  { icon: CalendarDays, title: 'Agenda e Tarefas', description: 'Compromissos e prazos organizados em um só calendário.' },
  { icon: Wallet, title: 'Financeiro', description: 'Contas a pagar, a receber e fluxo de caixa sob controle.' },
  { icon: BarChart3, title: 'DRE e Relatórios', description: 'Demonstrativo de resultado e indicadores para decidir melhor.' },
  { icon: Package, title: 'Estoque', description: 'Quantidade atual, mínima e máxima sempre atualizadas.' },
  { icon: Truck, title: 'Compras e Fornecedores', description: 'Histórico de compras e recomendações de reposição.' },
  { icon: FileText, title: 'Documentos', description: 'Biblioteca privada e organizada da sua empresa.' },
  { icon: Sparkles, title: 'Insights da Gestly', description: 'Alertas e próximos passos priorizados a partir dos seus dados.' },
]

export default function AllInOne() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-2xl mx-auto"
      >
        <div className="flex justify-center">
          <SectionEyebrow label="Visão geral" tag="Tudo integrado" />
        </div>
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
          Uma gestão completa,
          <br />
          sem planilhas espalhadas.
        </h2>
        <p className="mt-6 text-white/60 text-base leading-[1.6]">
          O SobControle reúne toda a sua operação em um único sistema. Nada de arquivos soltos,
          controles paralelos ou informação espalhada entre ferramentas diferentes.
        </p>
      </motion.div>

      <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 gap-4">
        {areas.map((area, i) => (
          <motion.div
            key={area.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="liquid-glass rounded-2xl p-5"
          >
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <area.icon className="w-4 h-4 text-white" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-white">{area.title}</h3>
            <p className="mt-1 text-xs text-white/50 leading-[1.5]">{area.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
