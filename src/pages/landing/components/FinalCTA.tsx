import { motion } from 'framer-motion'
import { PrimaryButton, SecondaryButton } from './shared'

export default function FinalCTA() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-32">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="landing-card relative overflow-hidden rounded-3xl px-8 py-16 md:py-24 text-center shadow-landing-lg"
      >
        {/* Brilho decorativo em ciano da marca, extremamente sutil sobre o branco. */}
        <div
          aria-hidden="true"
          className="landing-hero-glow absolute inset-x-0 top-0 h-64 pointer-events-none opacity-70"
        />
        <div className="relative">
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02] text-landing-text">
            Pare de perder lucro.
            <br />
            Comece a decidir certo.
          </h2>
          <p className="mt-6 text-landing-text-secondary max-w-md mx-auto text-sm leading-[1.6]">
            Junte-se aos empreendedores que trocaram planilhas bagunçadas e decisões no escuro
            por uma gestão inteligente, automática e sem burocracia.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <PrimaryButton label="Começar grátis" />
            <SecondaryButton label="Já tenho conta" to="/login" />
          </div>
        </div>
      </motion.div>
    </section>
  )
}
