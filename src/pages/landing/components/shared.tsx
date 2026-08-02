import { Link } from 'react-router-dom'
import { ChevronRight, Sparkles } from 'lucide-react'
import { focusRing } from '../landingTheme'

// A landing é sempre tema claro (tokens `--landing-*` escopados em
// `.landing-theme`), mas a classe `.dark` do usuário continua no <html> — por
// isso aqui a variante da marca é sempre explícita, nunca `auto`.
export { Logo, LogoSymbol, LogoWordmark } from '../../../components/shared/brand'

export function PrimaryButton({
  label = 'Começar grátis',
  full = false,
  to = '/register',
}: {
  label?: string
  full?: boolean
  to?: string
}) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center justify-center gap-2 rounded-full bg-landing-brand text-white font-medium text-sm px-5 py-3 shadow-landing transition-all hover:bg-landing-brand-hover active:scale-[0.98] ${focusRing} ${
        full ? 'w-full' : ''
      }`}
    >
      <Sparkles className="w-4 h-4" aria-hidden="true" />
      <span>{label}</span>
      <ChevronRight
        className="w-4 h-4 transition-transform group-hover:translate-x-[1px]"
        aria-hidden="true"
      />
    </Link>
  )
}

/** CTA secundário: borda discreta sobre superfície clara, mesmo formato do primário. */
export function SecondaryButton({
  label,
  to,
  full = false,
}: {
  label: string
  to: string
  full?: boolean
}) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center justify-center gap-2 rounded-full border border-landing-border-strong bg-landing-surface text-landing-text font-medium text-sm px-5 py-3 transition-colors hover:bg-landing-surface-muted hover:border-landing-brand/40 ${focusRing} ${
        full ? 'w-full' : ''
      }`}
    >
      <span>{label}</span>
      <ChevronRight
        className="w-4 h-4 transition-transform group-hover:translate-x-[1px]"
        aria-hidden="true"
      />
    </Link>
  )
}

export function SectionEyebrow({ label, tag }: { label: string; tag?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-landing-brand" />
        <span className="text-sm font-medium text-landing-text-secondary">{label}</span>
      </div>
      {tag && (
        <span className="px-2 py-0.5 rounded-full border border-landing-border bg-landing-surface text-landing-text-muted text-xs">
          {tag}
        </span>
      )}
    </div>
  )
}
