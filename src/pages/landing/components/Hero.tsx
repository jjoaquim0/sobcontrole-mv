import { motion } from 'framer-motion'
import { PrimaryButton } from './shared'
import { gradientStyle } from '../landingTheme'

export default function Hero() {
  return (
    <section className="relative pt-16 md:pt-28 pb-20 text-center flex flex-col items-center px-6">
      {/* Brilho ambiente do hero — gradiente sutil em ciano da marca, decorativo. */}
      <div
        aria-hidden="true"
        className="landing-hero-glow pointer-events-none absolute inset-x-0 top-0 h-[38rem] -z-10"
      />

      <motion.h1
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="text-4xl md:text-7xl font-semibold tracking-tight leading-[0.9]"
      >
        <span className="block text-landing-text">Sua gestão.</span>
        <span className="block animate-shiny" style={gradientStyle}>
          Reinventada
        </span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="mt-8 text-landing-text-secondary max-w-md text-base leading-[1.5]"
      >
        O Gestly é a plataforma de gestão feita para PMEs. Com Inteligência Artificial, transforma
        clientes, estoque, vendas e caixa em decisões de lucro reais — sem digitação e sem
        burocracia.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mt-10 flex flex-col items-center gap-3"
      >
        <PrimaryButton />
        <span className="text-xs text-landing-text-muted">
          Sem cartão de crédito · Configuração em minutos
        </span>
      </motion.div>
    </section>
  )
}
