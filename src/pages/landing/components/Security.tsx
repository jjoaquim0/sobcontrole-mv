import { motion } from 'framer-motion'
import { Building2, History, KeyRound, ShieldCheck, type LucideIcon } from 'lucide-react'
import { SectionEyebrow } from './shared'

const points: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Building2,
    title: 'Empresas separadas com segurança',
    description: 'Os dados de cada empresa ficam isolados dos dados de outras empresas do sistema.',
  },
  {
    icon: KeyRound,
    title: 'Controle de acesso por usuário',
    description: 'Permissões por papel definem o que cada pessoa da equipe pode ver e fazer.',
  },
  {
    icon: ShieldCheck,
    title: 'Dados centralizados',
    description: 'Vendas, clientes, estoque e financeiro organizados em uma única fonte de verdade.',
  },
  {
    icon: History,
    title: 'Histórico de informações',
    description: 'Ações importantes ficam registradas, com data e responsável.',
  },
]

export default function Security() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 border-t border-landing-border">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="max-w-xl"
      >
        <SectionEyebrow label="Segurança" />
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
          Organização e segurança
          <br />
          por padrão.
        </h2>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {points.map((point, i) => (
          <motion.div
            key={point.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="landing-card flex items-start gap-3.5 rounded-xl p-4"
          >
            <span className="w-9 h-9 rounded-lg bg-landing-brand/10 flex items-center justify-center shrink-0">
              <point.icon className="w-4 h-4 text-landing-brand" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-landing-text">{point.title}</h3>
              <p className="mt-1 text-xs text-landing-text-muted leading-[1.5]">{point.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
