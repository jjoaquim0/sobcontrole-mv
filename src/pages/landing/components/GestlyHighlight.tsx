import { motion } from 'framer-motion'
import { CalendarClock, Info, Package, TrendingDown, Users, Wallet, type LucideIcon } from 'lucide-react'
import { SectionEyebrow } from './shared'

interface Insight {
  icon: LucideIcon
  tag: string
  text: string
}

const insights: Insight[] = [
  {
    icon: TrendingDown,
    tag: 'Pipeline',
    text: 'Um negócio importante está há 5 dias ou mais sem nenhuma interação registrada.',
  },
  {
    icon: Users,
    tag: 'Clientes',
    text: 'Um cliente ativo está sem comprar há mais tempo do que o habitual.',
  },
  {
    icon: Wallet,
    tag: 'Financeiro',
    text: 'Há contas a pagar ou a receber vencendo nos próximos dias.',
  },
  {
    icon: Package,
    tag: 'Estoque',
    text: 'Este produto está no estoque mínimo ou pode ficar em risco de ruptura.',
  },
  {
    icon: CalendarClock,
    tag: 'Agenda',
    text: 'Um compromisso importante está próximo ou já passou do horário.',
  },
]

export default function GestlyHighlight() {
  return (
    <section id="gestly" className="max-w-6xl mx-auto px-6 py-20 md:py-28 scroll-mt-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="max-w-xl"
      >
        <SectionEyebrow label="Gestly" tag="IA de gestão" />
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
          Gestly não mostra apenas dados.
          <br />
          Ela aponta o próximo passo.
        </h2>
        <p className="mt-6 text-white/60 text-base leading-[1.6]">
          A Gestly cruza vendas, clientes, estoque e financeiro para organizar prioridades,
          identificar riscos e transformar dados em ações — para você decidir mais rápido, com
          menos tempo procurando informação.
        </p>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight, i) => (
          <motion.div
            key={insight.text}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.06 }}
            className="liquid-glass rounded-2xl p-5"
          >
            <div className="flex items-center gap-2">
              <insight.icon className="w-4 h-4 text-[#A4F4FD]" aria-hidden="true" />
              <span className="text-xs font-semibold tracking-wide uppercase text-white/50">
                {insight.tag}
              </span>
            </div>
            <p className="mt-3 text-sm text-white/85 leading-[1.55]">&ldquo;{insight.text}&rdquo;</p>
          </motion.div>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.5 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="mt-6 flex items-start gap-2.5 text-xs text-white/50 border border-white/10 rounded-xl px-4 py-3 max-w-2xl"
      >
        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        <p>
          A Gestly organiza, prioriza e sugere. Toda ação sobre um alerta — criar uma tarefa,
          remarcar um compromisso, aprovar uma compra — depende sempre da sua confirmação.
        </p>
      </motion.div>
    </section>
  )
}
