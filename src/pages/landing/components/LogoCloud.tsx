import { motion } from 'framer-motion'

const segments = [
  'Varejo',
  'Comércio',
  'Serviços',
  'Indústria',
  'Alimentação',
  'E-commerce',
  'Saúde',
  'Educação',
]

export default function LogoCloud() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-20">
      <p className="text-center text-xs uppercase tracking-widest text-landing-text-muted">
        Feito para PMEs de todos os segmentos
      </p>
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-6">
        {segments.map((segment, i) => (
          <motion.span
            key={segment}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="text-sm font-semibold tracking-tight text-landing-text-secondary hover:text-landing-brand transition-colors text-center"
          >
            {segment}
          </motion.span>
        ))}
      </div>
    </section>
  )
}
