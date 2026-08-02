import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Logo, PrimaryButton } from './shared'
import { focusRing } from '../landingTheme'

const links = ['Recursos', 'Planos', 'IA Financeira', 'Blog', 'Contato']

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  // Estado de scroll do header: mantém o fundo claro e adiciona apenas uma
  // separação visual leve (borda + sombra discreta) quando a página rola.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? 'bg-landing-surface/85 backdrop-blur-xl border-b border-landing-border shadow-landing-sm'
          : 'bg-landing-bg/70 backdrop-blur-sm border-b border-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link to="/" className={`rounded ${focusRing}`}>
          <Logo
            variant="cor"
            symbolClassName="w-8 h-8"
            wordmarkClassName="text-[22px]"
            label="SobControle — início"
          />
        </Link>

        <div className="hidden md:flex gap-8">
          {links.map((link, i) => (
            <motion.a
              key={link}
              href="#"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }}
              className={`text-landing-text-secondary text-sm font-medium rounded transition-colors hover:text-landing-brand ${focusRing}`}
            >
              {link}
            </motion.a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <Link
            to="/login"
            className={`text-landing-text-secondary text-sm font-medium rounded transition-colors hover:text-landing-brand ${focusRing}`}
          >
            Entrar
          </Link>
          <PrimaryButton />
        </div>

        <button
          type="button"
          aria-label="Abrir menu"
          className={`md:hidden w-10 h-10 rounded-full border border-landing-border bg-landing-surface flex items-center justify-center transition-colors hover:bg-landing-surface-muted ${focusRing}`}
        >
          <Menu className="w-4 h-4 text-landing-text" aria-hidden="true" />
        </button>
      </div>
    </motion.nav>
  )
}
