import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { LogoMark, PrimaryButton } from './shared'

const links = ['Recursos', 'Planos', 'IA Financeira', 'Blog', 'Contato']

export default function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between"
    >
      <LogoMark className="w-8 h-8" />

      <div className="hidden md:flex gap-8">
        {links.map((link, i) => (
          <motion.a
            key={link}
            href="#"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 + i * 0.05 }}
            className="text-white/70 text-sm font-medium hover:text-white"
          >
            {link}
          </motion.a>
        ))}
      </div>

      <div className="hidden md:flex items-center gap-4">
        <Link to="/login" className="text-white/70 text-sm font-medium hover:text-white">
          Entrar
        </Link>
        <PrimaryButton />
      </div>

      <button className="md:hidden w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center">
        <Menu className="w-4 h-4 text-white" />
      </button>
    </motion.nav>
  )
}
