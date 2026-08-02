import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { SectionEyebrow } from './shared'

const profiles = [
  'Pequenos e médios negócios',
  'Gestores comerciais',
  'Empresas que vendem produtos',
  'Empresas de serviços',
  'Times que precisam parar de depender de planilhas',
  'Empresas que querem centralizar operação e financeiro',
]

export default function TargetAudience() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
        >
          <SectionEyebrow label="Para quem é" />
          <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
            Feito para quem
            <br />
            gere de verdade.
          </h2>
          <p className="mt-6 text-landing-text-secondary text-base leading-[1.6] max-w-md">
            O SobControle foi construído para o dia a dia de quem toma decisão — não para
            planilhas paradas ou painéis que ninguém olha.
          </p>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="landing-card rounded-2xl p-6 space-y-4"
        >
          {profiles.map((profile) => (
            <li key={profile} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-landing-brand flex items-center justify-center shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-white" aria-hidden="true" />
              </span>
              <span className="text-sm text-landing-text-secondary">{profile}</span>
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
