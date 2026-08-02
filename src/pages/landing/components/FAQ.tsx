import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { SectionEyebrow } from './shared'
import { focusRing } from '../landingTheme'

const faqs = [
  {
    question: 'O SobControle é indicado para qual tipo de empresa?',
    answer:
      'Para pequenas e médias empresas que vendem produtos e/ou serviços e querem parar de depender de planilhas soltas para gerenciar vendas, estoque e financeiro.',
  },
  {
    question: 'Posso gerenciar vendas, clientes e financeiro no mesmo sistema?',
    answer:
      'Sim. Vendas, pipeline, clientes, agenda, financeiro, estoque, compras e documentos ficam no mesmo sistema, sem exportar planilha entre eles.',
  },
  {
    question: 'O sistema ajuda no controle de estoque?',
    answer:
      'Sim. Você acompanha quantidade atual, mínima e máxima por produto, histórico de compras e fornecedores, além de recomendações de reposição baseadas no consumo real.',
  },
  {
    question: 'A Gestly toma decisões automaticamente?',
    answer:
      'Não. A Gestly organiza prioridades, identifica riscos e sugere próximos passos. Toda ação — criar uma tarefa, remarcar um compromisso, aprovar uma compra — depende sempre da confirmação de um usuário.',
  },
  {
    question: 'Posso controlar permissões de usuários?',
    answer:
      'Sim. Cada usuário tem um papel (administrador, gerente ou colaborador) e áreas sensíveis, como Financeiro e Compras, ficam restritas conforme esse papel.',
  },
  {
    question: 'O SobControle substitui planilhas?',
    answer:
      'O objetivo é centralizar o que hoje fica espalhado em planilhas — vendas, estoque, financeiro e clientes — em um único sistema, reduzindo retrabalho manual e informação duplicada.',
  },
  {
    question: 'Existe período de teste ou demonstração?',
    answer:
      'Sim. O plano Essencial é gratuito e você pode criar sua conta em minutos, sem cartão de crédito, para conhecer o sistema na prática.',
  },
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-xl mx-auto"
      >
        <div className="flex justify-center">
          <SectionEyebrow label="Perguntas frequentes" />
        </div>
        <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
          Ainda com dúvidas?
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, delay: 0.15 }}
        className="mt-10 max-w-2xl mx-auto rounded-2xl border border-landing-border bg-landing-surface shadow-landing divide-y divide-landing-border overflow-hidden"
      >
        {faqs.map((faq, i) => {
          const isOpen = openIndex === i
          const panelId = `faq-panel-${i}`
          const buttonId = `faq-button-${i}`
          return (
            <div key={faq.question}>
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className={`w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-5 text-left transition-colors hover:bg-landing-surface-muted ${focusRing} focus-visible:ring-inset focus-visible:ring-offset-0`}
                >
                  <span className="text-sm sm:text-base font-medium text-landing-text">
                    {faq.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-landing-brand shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className="px-5 sm:px-6 pb-5"
              >
                <p className="text-sm text-landing-text-secondary leading-[1.6] max-w-xl">
                  {faq.answer}
                </p>
              </div>
            </div>
          )
        })}
      </motion.div>
    </section>
  )
}
