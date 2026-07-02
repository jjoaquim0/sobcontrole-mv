import { useState } from 'react'
import { Link } from 'react-router-dom'

type Plan = {
  tier: string
  monthlyPrice: string
  yearlyPrice: string
  description: string
  features: string[]
  pro?: boolean
}

const plans: Plan[] = [
  {
    tier: 'Essencial',
    monthlyPrice: 'Grátis',
    yearlyPrice: 'Grátis',
    description: 'Para pequenos negócios que estão organizando a casa financeira.',
    features: [
      '1 usuário',
      'Clientes, caixa e estoque',
      'Leitura automática de XML (até 20 notas/mês)',
      'Dashboard básico',
      'Suporte por e-mail',
    ],
  },
  {
    tier: 'Profissional',
    monthlyPrice: 'R$ 97/mês',
    yearlyPrice: 'R$ 970/ano',
    description: 'Para PMEs que querem lucrar mais com decisões guiadas por IA.',
    features: [
      'Até 5 usuários',
      'XML e planilhas ilimitados',
      'Diagnóstico de lucro por IA',
      'Monitoramento automático de e-mail (notas e boletos)',
      'Exportação para Power BI',
    ],
  },
  {
    tier: 'Empresarial',
    monthlyPrice: 'R$ 197/mês',
    yearlyPrice: 'R$ 1.970/ano',
    description: 'Para empresas em crescimento que precisam de inteligência total.',
    features: [
      'Usuários ilimitados',
      'Chatbot consultivo com IA',
      'Módulo de marketing (copys + sugestão de tráfego)',
      'Dashboards avançados no Power BI',
      'Suporte prioritário e onboarding dedicado',
    ],
    pro: true,
  },
]

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17L4 12"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Pricing() {
  const [yearly, setYearly] = useState(false)

  return (
    <section className="c3-pricing-section">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="c3-noise-pricing">
          <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves={2} stitchTiles="stitch" />
          <feComponentTransfer>
            <feFuncA type="linear" slope={0.075} />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" result="noise" />
          <feBlend in="SourceGraphic" in2="noise" mode="overlay" />
        </filter>
      </svg>

      <div className="c3-watermark-container">
        <div className="c3-watermark-main">
          <span className="c3-watermark-line-1">Sua gestão.</span>
          <span className="c3-watermark-line-2">Reinventada</span>
        </div>
      </div>

      <div className="c3-grid">
        {plans.map((plan) => (
          <div key={plan.tier} className={`c3-card ${plan.pro ? 'c3-card-pro' : ''}`}>
            <div className="c3-tier-small">{plan.tier}</div>
            <div className="c3-tier-large">{yearly ? plan.yearlyPrice : plan.monthlyPrice}</div>
            <div className="c3-desc">{plan.description}</div>
            <ul className="c3-list">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span className="c3-check">
                    <CheckIcon />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <Link to="/register" className="c3-btn">
              Escolher plano
            </Link>
          </div>
        ))}
      </div>

      <div className="c3-toggle-wrap">
        <span className="c3-toggle-label">Anual</span>
        <button
          className={`c3-toggle ${yearly ? 'active' : ''}`}
          onClick={() => setYearly((v) => !v)}
          aria-pressed={yearly}
        >
          <span className="c3-toggle-knob" />
        </button>
      </div>
    </section>
  )
}
