import { motion } from 'framer-motion'
import { ClipboardList, LayoutDashboard, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'
import { SectionEyebrow } from './shared'

interface Step {
  icon: LucideIcon
  title: string
  description: string
}

const steps: Step[] = [
  {
    icon: ClipboardList,
    title: 'Registre sua operação',
    description: 'Vendas, produtos, clientes, compras e financeiro em um só cadastro.',
  },
  {
    icon: LayoutDashboard,
    title: 'Acompanhe em tempo real',
    description: 'Dashboard, pipeline, agenda, estoque e relatórios sempre atualizados.',
  },
  {
    icon: Sparkles,
    title: 'Receba recomendações',
    description: 'Alertas, riscos e próximos passos sugeridos pela Gestly.',
  },
  {
    icon: ShieldCheck,
    title: 'Decida com segurança',
    description: 'Relatórios, DRE, fluxo de caixa e indicadores claros para decidir.',
  },
]

export default function ValueFlow() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-xl mx-auto"
      >
        <div className="flex justify-center">
          <SectionEyebrow label="Como funciona" />
        </div>
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
          Da operação à decisão.
        </h2>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="landing-card rounded-2xl p-5"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-full bg-landing-brand text-white text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <step.icon className="w-4 h-4 text-landing-accent" aria-hidden="true" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-landing-text">{step.title}</h3>
            <p className="mt-1.5 text-xs text-landing-text-muted leading-[1.5]">{step.description}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
