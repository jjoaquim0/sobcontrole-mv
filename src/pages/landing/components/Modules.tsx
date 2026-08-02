import { motion } from 'framer-motion'
import { ArrowRight, CalendarDays, CreditCard, KanbanSquare, Package, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { SectionEyebrow } from './shared'
import { focusRing } from '../landingTheme'

interface ModuleItem {
  icon: LucideIcon
  name: string
  description: string
  benefit: string
  anchor: string
  anchorLabel: string
}

const modules: ModuleItem[] = [
  {
    icon: Users,
    name: 'CRM e Clientes',
    description: 'Histórico, relacionamento e oportunidades organizados por cliente.',
    benefit: 'Nunca mais perca o histórico de uma negociação.',
    anchor: '#interface-produto',
    anchorLabel: 'Saiba mais',
  },
  {
    icon: KanbanSquare,
    name: 'Vendas e Pipeline',
    description: 'Etapas, responsáveis e acompanhamento comercial em um pipeline visual.',
    benefit: 'Saiba exatamente em que fase cada negócio está.',
    anchor: '#interface-produto',
    anchorLabel: 'Saiba mais',
  },
  {
    icon: CreditCard,
    name: 'Financeiro',
    description: 'Contas a pagar e a receber, DRE, relatórios e previsão de fluxo de caixa.',
    benefit: 'Veja o caixa dos próximos dias antes que aperte.',
    anchor: '#interface-produto',
    anchorLabel: 'Saiba mais',
  },
  {
    icon: Package,
    name: 'Estoque e Compras',
    description: 'Controle de produtos, fornecedores e recomendações de reposição.',
    benefit: 'Saiba o que comprar, quanto e de qual fornecedor.',
    anchor: '#interface-produto',
    anchorLabel: 'Saiba mais',
  },
  {
    icon: CalendarDays,
    name: 'Agenda e Operação',
    description: 'Reuniões, compromissos e tarefas organizados em um só lugar.',
    benefit: 'Menos prazos esquecidos, mais previsibilidade no dia a dia.',
    anchor: '#interface-produto',
    anchorLabel: 'Saiba mais',
  },
  {
    icon: Sparkles,
    name: 'Gestly, sua IA de gestão',
    description: 'Alertas, prioridades e ações sugeridas a partir dos dados reais da operação.',
    benefit: 'Saiba o que precisa da sua atenção agora, sem caçar informação.',
    anchor: '#gestly',
    anchorLabel: 'Saiba mais sobre a Gestly',
  },
]

export default function Modules() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="max-w-md"
      >
        <SectionEyebrow label="Módulos" tag="Visão por dentro" />
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
          Conheça o SobControle
          <br />
          por dentro.
        </h2>
        <p className="mt-6 text-landing-text-secondary text-base leading-[1.6]">
          Cada módulo resolve uma parte real da operação — e todos conversam entre si, sem
          exportar planilha ou repetir cadastro.
        </p>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {modules.map((mod, i) => (
          <motion.div
            key={mod.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: i * 0.06 }}
            className="landing-card rounded-2xl p-6 flex flex-col"
          >
            <div className="w-10 h-10 rounded-xl bg-landing-brand/10 flex items-center justify-center">
              <mod.icon className="w-4.5 h-4.5 text-landing-brand" aria-hidden="true" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-landing-text">{mod.name}</h3>
            <p className="mt-2 text-sm text-landing-text-secondary leading-[1.55]">{mod.description}</p>
            <p className="mt-3 text-xs text-landing-text-muted leading-[1.5]">{mod.benefit}</p>
            <a
              href={mod.anchor}
              className={`group mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-landing-brand hover:text-landing-brand-hover rounded w-fit ${focusRing}`}
            >
              {mod.anchorLabel}
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
