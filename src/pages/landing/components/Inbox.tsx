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

const labels = [
  { name: 'Notas fiscais', color: '#00d2ff' },
  { name: 'Fornecedores', color: '#A4F4FD' },
  { name: 'Financeiro', color: '#f59e0b' },
  { name: 'Clientes', color: '#10b981' },
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
        transition={{ duration: 0.8, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0e1014]/90 backdrop-blur-2xl"
      >
        <div className="h-11 flex items-center px-4 border-b border-white/10 relative">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
          </div>
          <span className="absolute left-1/2 -translate-x-1/2 text-xs text-white/50">
            Gestly — E-mail Inteligente
          </span>
        </div>

        <div className="grid grid-cols-12 h-[520px]">
          {/* Sidebar */}
          <div className="col-span-3 border-r border-white/10 bg-black/30 p-4 flex flex-col">
            <button className="rounded-lg bg-white text-black text-xs font-semibold px-3 py-2 flex items-center justify-center gap-2 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Analisar com IA
            </button>

            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium ${
                    item.active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </span>
                  {item.count && <span className="text-white/40">{item.count}</span>}
                </div>
              ))}
            </nav>

            <div className="mt-8">
              <div className="text-[10px] uppercase tracking-wider text-white/40 px-2.5 mb-2">
                Categorias
              </div>
              <div className="flex flex-col gap-1">
                {labels.map((label) => (
                  <div
                    key={label.name}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-white/60 hover:bg-white/5"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: label.color }}
                    />
                    {label.name}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Message list */}
          <div className="col-span-4 border-r border-white/10 flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 text-white/40 text-xs">
              <Search className="w-3.5 h-3.5" />
              <span>Buscar e-mails</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {messages.map((msg) => (
                <div
                  key={msg.subject}
                  className={`px-4 py-3 border-b border-white/5 cursor-pointer ${
                    msg.active ? 'bg-white/5' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs ${
                        msg.unread ? 'text-white font-semibold' : 'text-white/70 font-medium'
                      }`}
                    >
                      {msg.name}
                    </span>
                    <span className="text-[10px] text-white/40">{msg.time}</span>
                  </div>
                  <div
                    className={`text-xs mt-0.5 ${
                      msg.unread ? 'text-white/90' : 'text-white/60'
                    }`}
                  >
                    {msg.subject}
                  </div>
                  <div className="text-[11px] text-white/40 mt-0.5 truncate">{msg.preview}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Reader */}
          <div className="col-span-5 flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <div className="flex items-center gap-1">
                {toolbarIcons.map((Icon, i) => (
                  <button
                    key={i}
                    className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center"
                  >
                    <Icon className="w-3.5 h-3.5 text-white/60" />
                  </button>
                ))}
              </div>
              <button className="w-7 h-7 rounded-md hover:bg-white/5 flex items-center justify-center">
                <MoreHorizontal className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <h3 className="text-base font-semibold text-white">
                Nota fiscal detectada no seu e-mail
              </h3>
              <div className="flex items-center gap-2 mt-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#00d2ff] to-[#0B2551] flex items-center justify-center text-xs font-semibold">
                  G
                </div>
                <div className="text-xs">
                  <span className="text-white font-medium">Gestly IA</span>
                  <span className="text-white/40"> · para você · 9:41 AM</span>
                </div>
                <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/60">
                  Financeiro
                </span>
              </div>

              <div className="liquid-glass rounded-lg p-3 mt-5 flex gap-2 items-start">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: '#A4F4FD' }} />
                <div>
                  <div className="text-xs font-semibold text-white">Resumo pela IA Gestly</div>
                  <div className="text-xs text-white/60 mt-1 leading-relaxed">
                    Identificamos uma nota fiscal de R$ 1.500 do fornecedor Silva Materiais.
                    Deseja anexar automaticamente ao sistema?
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-xs text-white/80 leading-relaxed">
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
                <p className="text-white/50">— Equipe Gestly</p>
              </div>

              <div className="mt-5 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs text-white/70">
                <Paperclip className="w-3.5 h-3.5" />
                nota-fiscal-1500.pdf
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
