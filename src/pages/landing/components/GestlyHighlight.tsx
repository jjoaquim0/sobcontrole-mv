import { motion } from 'framer-motion'
import {
  BarChart3,
  Clock,
  Gauge,
  Package,
  Sparkles,
  TrendingDown,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { SectionEyebrow } from './shared'

interface ValuePoint {
  icon: LucideIcon
  title: string
  description: string
}

interface Insight {
  icon: LucideIcon
  area: string
  text: string
  future?: boolean
}

const valuePoints: ValuePoint[] = [
  {
    icon: Gauge,
    title: 'Enxergue o que exige atenção',
    description:
      'Identifique oportunidades paradas, contas vencidas, clientes sem retorno e produtos com risco de falta.',
  },
  {
    icon: Clock,
    title: 'Reduza desperdícios e retrabalho',
    description:
      'Menos tempo conferindo planilhas e procurando informações; mais organização para sua equipe trabalhar.',
  },
  {
    icon: BarChart3,
    title: 'Tome decisões com dados reais',
    description:
      'Receba análises, alertas e recomendações baseadas no andamento real da sua operação.',
  },
]

const insights: Insight[] = [
  {
    icon: TrendingDown,
    area: 'Pipeline',
    text: '5 oportunidades estão sem atualização há mais de 10 dias.',
  },
  {
    icon: Package,
    area: 'Estoque',
    text: 'Seu estoque de um produto pode ficar abaixo do mínimo em breve.',
  },
  {
    icon: Wallet,
    area: 'Financeiro',
    text: 'Existem contas vencidas que precisam de atenção.',
  },
  {
    icon: BarChart3,
    area: 'Desempenho',
    text: 'Sua receita do período está abaixo da meta definida.',
    future: true,
  },
]

export default function GestlyHighlight() {
  return (
    <section id="gestly" className="max-w-6xl mx-auto px-6 py-20 md:py-28 scroll-mt-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-3xl mx-auto"
      >
        <div className="flex justify-center">
          <SectionEyebrow label="INTELIGÊNCIA PARA DECIDIR MELHOR" />
        </div>
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
          Pare de perder dinheiro por falta de visão da sua empresa.
        </h2>
        <p className="mt-6 text-landing-text-secondary text-base leading-[1.6] max-w-2xl mx-auto">
          Quando vendas, estoque, financeiro e clientes estão espalhados, decisões importantes
          viram achismo. O SobControle centraliza sua operação, enquanto o Gestly transforma dados
          do dia a dia em sinais claros para você agir no momento certo.
        </p>
        <p className="mt-8 inline-flex rounded-full border border-landing-border-strong bg-landing-surface px-5 py-2.5 text-sm font-semibold text-landing-text shadow-landing-sm">
          O SobControle organiza a empresa. O Gestly ajuda a empresa a agir.
        </p>
      </motion.div>

      <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {valuePoints.map((point, index) => (
          <motion.article
            key={point.title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className="landing-card rounded-2xl p-5 md:p-6"
          >
            <span className="w-10 h-10 rounded-xl bg-landing-brand/10 flex items-center justify-center">
              <point.icon className="w-4.5 h-4.5 text-landing-brand" aria-hidden="true" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-landing-text">{point.title}</h3>
            <p className="mt-2 text-sm text-landing-text-secondary leading-[1.6]">
              {point.description}
            </p>
          </motion.article>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        className="landing-card mt-14 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-landing-lg"
      >
        <div
          aria-hidden="true"
          className="landing-hero-glow absolute inset-x-0 top-0 h-72 pointer-events-none opacity-70"
        />

        <div className="relative grid grid-cols-1 lg:grid-cols-[0.88fr_1.12fr] gap-10 lg:gap-14 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-landing-brand/20 bg-landing-brand/10 px-3 py-1.5 text-xs font-semibold text-landing-brand">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Insights baseados na operação
            </div>
            <h3 className="mt-5 text-2xl md:text-4xl font-semibold tracking-tight leading-[1.08] text-landing-text">
              Gestly: seu copiloto operacional
            </h3>
            <p className="mt-5 text-sm md:text-base text-landing-text-secondary leading-[1.7]">
              Em vez de procurar problemas em planilhas, o Gestly ajuda você a enxergar o que
              merece atenção: vendas que precisam de acompanhamento, estoque que pode faltar,
              contas que estão vencendo e oportunidades para melhorar seus resultados.
            </p>
            <p className="mt-5 text-xs text-landing-text-muted leading-[1.6]">
              Os exemplos ao lado ilustram sinais que podem ser destacados conforme os dados e os
              recursos disponíveis na sua operação.
            </p>
          </div>

          <ul className="space-y-3" aria-label="Exemplos de insights operacionais">
            {insights.map((insight, index) => (
              <motion.li
                key={insight.text}
                initial={{ opacity: 0, x: 12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: 0.12 + index * 0.07 }}
                className="landing-panel rounded-2xl p-4 sm:p-5"
              >
                <div className="flex items-start gap-3.5">
                  <span className="w-9 h-9 rounded-xl bg-landing-surface flex items-center justify-center shrink-0 shadow-landing-sm">
                    <insight.icon className="w-4 h-4 text-landing-brand" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-landing-text-muted">
                        {insight.area}
                      </span>
                      {insight.future && (
                        <span className="rounded-full border border-landing-warning/25 bg-landing-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-landing-warning">
                          Visão futura
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-landing-text-secondary leading-[1.55]">
                      {insight.text}
                    </p>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.65 }}
        className="mt-14 border-t border-landing-border pt-10 grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-5 md:gap-12"
      >
        <h3 className="text-2xl md:text-3xl font-semibold tracking-tight leading-[1.12] text-landing-text">
          Inteligência de dados para empresas que querem crescer com controle.
        </h3>
        <p className="text-sm md:text-base text-landing-text-secondary leading-[1.7]">
          O SobControle foi pensado para dar à sua empresa uma visão mais clara da operação. Com
          dados centralizados e o apoio do Gestly, sua equipe deixa de gastar horas montando
          relatórios básicos e passa a ter informações prontas para decidir, priorizar e agir.
        </p>
      </motion.div>
    </section>
  )
}
