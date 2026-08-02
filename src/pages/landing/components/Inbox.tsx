import { motion } from 'framer-motion'
import {
  Sparkles,
  Search,
  Inbox as InboxIcon,
  Star,
  Send,
  FileText,
  Archive,
  Trash2,
  Reply,
  Forward,
  MoreHorizontal,
  Paperclip,
} from 'lucide-react'

const navItems = [
  { icon: InboxIcon, label: 'Caixa de entrada', count: 12, active: true },
  { icon: Star, label: 'Importantes', count: 3 },
  { icon: Send, label: 'Enviados' },
  { icon: FileText, label: 'Rascunhos', count: 2 },
  { icon: Archive, label: 'Arquivo' },
  { icon: Trash2, label: 'Lixeira' },
]

// Pontos de categoria: classes de token em vez de hex fixo, para manter
// contraste suficiente sobre a superfície clara.
const labels = [
  { name: 'Notas fiscais', dotClass: 'bg-landing-brand' },
  { name: 'Fornecedores', dotClass: 'bg-landing-accent' },
  { name: 'Financeiro', dotClass: 'bg-landing-warning' },
  { name: 'Clientes', dotClass: 'bg-landing-success' },
]

const messages = [
  {
    name: 'Gestly IA',
    subject: 'Nota fiscal detectada no seu e-mail',
    preview: 'Encontramos um boleto de R$ 1.500 do fornecedor Silva Materiais...',
    time: '9:41 AM',
    unread: true,
    active: true,
  },
  {
    name: 'Silva Materiais',
    subject: 'Re: Cobrança referente a novembro',
    preview: 'Segue em anexo o boleto atualizado com o novo vencimento...',
    time: '8:12 AM',
    unread: true,
  },
  {
    name: 'Contabilidade',
    subject: 'Comentário sobre o balanço mensal',
    preview: 'O fechamento deste mês ficou consistente com o caixa.',
    time: 'Ontem',
  },
  {
    name: 'Banco Itaú',
    subject: 'Recebimento de R$ 12.480,00 confirmado',
    preview: 'O valor já está disponível na sua conta corrente...',
    time: 'Ontem',
  },
  {
    name: 'Power BI',
    subject: 'Dashboard do Gestly atualizado',
    preview: 'Seus relatórios de vendas e estoque foram sincronizados.',
    time: 'Seg',
  },
  {
    name: 'Equipe Fiscal',
    subject: '[Gestly] Nota fiscal #482 conciliada',
    preview: 'A nota foi aprovada e vinculada ao centro de custo correto.',
    time: 'Seg',
  },
]

const toolbarIcons = [Reply, Forward, Archive, Trash2]

export default function Inbox() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-16 md:py-24">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl overflow-hidden border border-landing-border bg-landing-surface shadow-landing-lg"
      >
        <div className="h-11 flex items-center px-4 border-b border-landing-border bg-landing-surface-muted relative">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 text-xs text-landing-text-muted">
            Gestly — E-mail Inteligente
          </span>
        </div>

        <div className="grid grid-cols-12 h-[520px]">
          {/* Sidebar */}
          <div className="hidden sm:flex sm:col-span-4 lg:col-span-3 border-r border-landing-border bg-landing-surface-muted p-4 flex-col">
            <div className="rounded-lg bg-landing-brand text-white text-xs font-semibold px-3 py-2 flex items-center justify-center gap-2 mb-6">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              Analisar com IA
            </div>

            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium ${
                    item.active
                      ? 'bg-landing-brand/10 text-landing-brand'
                      : 'text-landing-text-secondary'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <item.icon className="w-3.5 h-3.5" aria-hidden="true" />
                    {item.label}
                  </span>
                  {item.count && <span className="text-landing-text-muted">{item.count}</span>}
                </div>
              ))}
            </nav>

            <div className="mt-8">
              <div className="text-[10px] uppercase tracking-wider text-landing-text-muted px-2.5 mb-2">
                Categorias
              </div>
              <div className="flex flex-col gap-1">
                {labels.map((label) => (
                  <div
                    key={label.name}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-landing-text-secondary"
                  >
                    <span className={`w-2 h-2 rounded-full ${label.dotClass}`} />
                    {label.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Message list */}
          <div className="col-span-12 sm:col-span-8 lg:col-span-4 border-r border-landing-border flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-landing-border text-landing-text-muted text-xs">
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Buscar e-mails</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.subject}
                  className={`px-4 py-3 border-b border-landing-border ${
                    msg.active ? 'bg-landing-brand/[0.07]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs ${
                        msg.unread
                          ? 'text-landing-text font-semibold'
                          : 'text-landing-text-secondary font-medium'
                      }`}
                    >
                      {msg.name}
                    </span>
                    <span className="text-[10px] text-landing-text-muted">{msg.time}</span>
                  </div>
                  <div
                    className={`text-xs mt-0.5 ${
                      msg.unread ? 'text-landing-text' : 'text-landing-text-secondary'
                    }`}
                  >
                    {msg.subject}
                  </div>
                  <div className="text-[11px] text-landing-text-muted mt-0.5 truncate">
                    {msg.preview}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Reader */}
          <div className="hidden lg:flex lg:col-span-5 flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-landing-border">
              <div className="flex items-center gap-1">
                {toolbarIcons.map((Icon, i) => (
                  <span
                    key={i}
                    className="w-7 h-7 rounded-md flex items-center justify-center"
                  >
                    <Icon className="w-3.5 h-3.5 text-landing-text-muted" aria-hidden="true" />
                  </span>
                ))}
              </div>
              <span className="w-7 h-7 rounded-md flex items-center justify-center">
                <MoreHorizontal className="w-3.5 h-3.5 text-landing-text-muted" aria-hidden="true" />
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="text-base font-semibold text-landing-text">
                Nota fiscal detectada no seu e-mail
              </h3>
              <div className="flex items-center gap-2 mt-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-landing-brand to-landing-text flex items-center justify-center text-xs font-semibold text-white">
                  G
                </div>
                <div className="text-xs">
                  <span className="text-landing-text font-medium">Gestly IA</span>
                  <span className="text-landing-text-muted"> · para você · 9:41 AM</span>
                </div>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-landing-border text-landing-text-secondary">
                  Financeiro
                </span>
              </div>

              <div className="landing-panel rounded-lg p-3 mt-5 flex gap-2 items-start">
                <Sparkles
                  className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-landing-brand"
                  aria-hidden="true"
                />
                <div>
                  <div className="text-xs font-semibold text-landing-text">Resumo pela IA Gestly</div>
                  <div className="text-xs text-landing-text-secondary mt-1 leading-relaxed">
                    Identificamos uma nota fiscal de R$ 1.500 do fornecedor Silva Materiais.
                    Deseja anexar automaticamente ao sistema?
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-xs text-landing-text-secondary leading-relaxed">
                <p>Olá,</p>
                <p>
                  Nosso motor de IA monitorou sua caixa de entrada e encontrou um novo documento
                  fiscal relevante para o seu fluxo de caixa.
                </p>
                <p>
                  Detectamos um boleto de fornecedor no valor de R$ 1.500,00, com vencimento em
                  10 dias. Ele já pode ser conciliado automaticamente com o seu estoque e centro
                  de custo.
                </p>
                <p>
                  Você pode revisar, editar ou aprovar o lançamento diretamente pelo Gestly.
                </p>
                <p className="text-landing-text-muted">— Equipe Gestly</p>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-landing-border text-xs text-landing-text-secondary">
                <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                nota-fiscal-1500.pdf
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
