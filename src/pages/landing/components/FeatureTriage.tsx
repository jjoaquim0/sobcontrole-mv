import { motion } from 'framer-motion'
import { SectionEyebrow } from './shared'

const chips = [
  'Diagnóstico automático',
  'Alertas de estoque parado',
  'Previsão de caixa',
  'Cruzamento de dados em tempo real',
]

// Escala de prioridade em tokens da marca (mais escuro = mais urgente),
// substituindo a antiga escala de cinzas pensada para fundo escuro.
const buckets = [
  {
    label: 'Prioridade',
    count: 4,
    dotClass: 'bg-landing-danger',
    items: ['Estoque parado — Produto X', 'Fluxo de caixa — atenção'],
  },
  {
    label: 'Acompanhar',
    count: 7,
    dotClass: 'bg-landing-warning',
    items: ['Fornecedor Y — pagamento em 3 dias', 'Cliente Z — repetição de compra'],
  },
  {
    label: 'Atualizações',
    count: 18,
    dotClass: 'bg-landing-brand',
    items: ['Nota fiscal importada', 'Planilha conciliada'],
  },
  {
    label: 'Arquivado',
    count: 13,
    dotClass: 'bg-landing-text-muted',
    items: ['Vendas concluídas · Recibos · Relatórios'],
  },
]

export default function FeatureTriage() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
        >
          <SectionEyebrow label="Diagnóstico" tag="IA nativa" />
          <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
            Entenda seu lucro
            <br />
            em um único olhar.
          </h2>
          <p className="mt-6 text-landing-text-secondary text-base leading-[1.6] max-w-md">
            O Gestly analisa clientes, estoque, vendas e caixa, e traduz tudo em respostas
            humanas. Nada de gráficos soltos — apenas decisões claras para aumentar sua margem.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className="text-xs text-landing-text-secondary px-3 py-1.5 rounded-full border border-landing-border bg-landing-surface"
              >
                {chip}
              </span>
            ))}
          </div>
        </motion.div>

        <div className="landing-card rounded-2xl p-5">
          <div className="text-xs text-landing-text-muted mb-4">
            Hoje · 128 lançamentos analisados pela IA
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {buckets.map((bucket) => (
              <div key={bucket.label} className="landing-panel rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-landing-text">
                    <span className={`w-2 h-2 rounded-full ${bucket.dotClass}`} />
                    {bucket.label}
                  </span>
                  <span className="text-xs text-landing-text-muted">{bucket.count}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {bucket.items.map((item) => (
                    <div key={item} className="text-[11px] text-landing-text-secondary truncate">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
