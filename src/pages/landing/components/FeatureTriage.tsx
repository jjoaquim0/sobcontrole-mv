import { motion } from 'framer-motion'
import { SectionEyebrow } from './shared'

const chips = [
  'Diagnóstico automático',
  'Alertas de estoque parado',
  'Previsão de caixa',
  'Cruzamento de dados em tempo real',
]

const buckets = [
  {
    label: 'Prioridade',
    count: 4,
    color: '#ffffff',
    items: ['Estoque parado — Produto X', 'Fluxo de caixa — atenção'],
  },
  {
    label: 'Acompanhar',
    count: 7,
    color: '#e5e5e5',
    items: ['Fornecedor Y — pagamento em 3 dias', 'Cliente Z — repetição de compra'],
  },
  {
    label: 'Atualizações',
    count: 18,
    color: '#a3a3a3',
    items: ['Nota fiscal importada', 'Planilha conciliada'],
  },
  {
    label: 'Arquivado',
    count: 13,
    color: '#525252',
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
          <p className="mt-6 text-white/60 text-base leading-[1.6] max-w-md">
            O Gestly analisa clientes, estoque, vendas e caixa, e traduz tudo em respostas
            humanas. Nada de gráficos soltos — apenas decisões claras para aumentar sua margem.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={chip}
                className="text-xs text-white/70 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03]"
              >
                {chip}
              </span>
            ))}
          </div>
        </motion.div>

        <div className="liquid-glass rounded-2xl p-5">
          <div className="text-xs text-white/50 mb-4">Hoje · 128 lançamentos analisados pela IA</div>
          <div className="grid grid-cols-2 gap-3">
            {buckets.map((bucket) => (
              <div key={bucket.label} className="liquid-glass rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-white">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: bucket.color }}
                    />
                    {bucket.label}
                  </span>
                  <span className="text-xs text-white/40">{bucket.count}</span>
                </div>
                <div className="mt-2 space-y-1">
                  {bucket.items.map((item) => (
                    <div key={item} className="text-[11px] text-white/50 truncate">
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
