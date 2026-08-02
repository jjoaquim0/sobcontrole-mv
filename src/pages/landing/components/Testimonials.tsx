const highlights = [
  {
    quote:
      'Perder horas digitando XML de nota fiscal e organizando planilhas bagunçadas todo santo dia.',
    outcome: 'Ingestão automática de dados',
    detail: 'Leitura de XML de NF-e e importação inteligente de planilhas, sem digitação.',
    tag: 'ZERO DIGITAÇÃO',
  },
  {
    quote: 'Olhar pro gráfico de vendas e não entender por que o lucro caiu esse mês.',
    outcome: 'Diagnóstico de lucro por IA',
    detail: 'Respostas em linguagem humana sobre o que está drenando sua margem.',
    tag: 'IA FINANCEIRA',
  },
  {
    quote: 'Ter estoque parado e não saber como transformar isso em vendas.',
    outcome: 'Marketing conectado ao estoque',
    detail: 'A IA gera posts e sugere público-alvo com base no que precisa vender.',
    tag: 'MARKETING COM IA',
  },
]

export default function Testimonials() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-landing-border">
      <div className="grid md:grid-cols-3 gap-6">
        {highlights.map((h) => (
          <figure key={h.outcome} className="landing-card rounded-2xl p-6">
            <blockquote className="text-sm text-landing-text-secondary leading-[1.6]">
              &ldquo;{h.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 pt-5 border-t border-landing-border">
              <div className="text-sm font-semibold text-landing-text">{h.outcome}</div>
              <div className="text-xs text-landing-text-muted">{h.detail}</div>
              <div className="text-xs text-landing-brand font-semibold tracking-wide uppercase mt-1">
                {h.tag}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
