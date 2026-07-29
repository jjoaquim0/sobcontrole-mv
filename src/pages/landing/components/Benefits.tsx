import { motion } from 'framer-motion'
import {
  Boxes,
  Clock,
  Gauge,
  LayoutGrid,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { SectionEyebrow } from './shared'

const benefits: { icon: LucideIcon; text: string }[] = [
  { icon: Clock, text: 'Menos tempo procurando informações' },
  { icon: Users, text: 'Mais controle sobre vendas e clientes' },
  { icon: Boxes, text: 'Estoque mais organizado' },
  { icon: Wallet, text: 'Financeiro mais previsível' },
  { icon: Gauge, text: 'Decisões mais rápidas' },
  { icon: TrendingUp, text: 'Menos dependência de planilhas' },
  { icon: LayoutGrid, text: 'Toda a operação em uma única plataforma' },
]

export default function Benefits() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-24 border-t border-white/10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-xl mx-auto"
      >
        <div className="flex justify-center">
          <SectionEyebrow label="Benefícios" />
        </div>
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
          O que muda no dia a dia.
        </h2>
      </motion.div>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {benefits.map((benefit, i) => (
          <motion.div
            key={benefit.text}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            className="flex items-center gap-3 border border-white/10 rounded-xl p-4"
          >
            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <benefit.icon className="w-4 h-4 text-white" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium text-white/85">{benefit.text}</span>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
