import React, {
  FormEvent,
  KeyboardEvent,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  FileText,
  KanbanSquare,
  Lightbulb,
  Package,
  Plus,
  Send,
  ShieldAlert,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Square,
  Target,
  Truck,
  Users,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { useAuth } from '@/hooks/useAuth';
import {
  GestlyConversationError,
  useGestlyConversation,
} from '@/hooks/useGestlyConversation';

interface SuggestedQuestion {
  domain: string;
  question: string;
  icon: LucideIcon;
  financial?: boolean;
}

interface Capability {
  name: string;
  description: string;
  icon: LucideIcon;
  status: 'available' | 'coming_soon' | 'financial';
}

const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  {
    domain: 'Visão geral',
    question: 'Como está minha empresa hoje?',
    icon: BarChart3,
  },
  {
    domain: 'Vendas',
    question: 'Quanto vendi este mês?',
    icon: ShoppingBag,
  },
  {
    domain: 'Pipeline',
    question: 'Como está meu pipeline este mês?',
    icon: KanbanSquare,
  },
  {
    domain: 'Clientes',
    question: 'Quantos clientes ativos eu tenho?',
    icon: Users,
  },
  {
    domain: 'Agenda',
    question: 'Quais tarefas tenho hoje?',
    icon: CalendarDays,
  },
  {
    domain: 'Estoque',
    question: 'Quais produtos estão com estoque baixo?',
    icon: Package,
  },
  {
    domain: 'Compras',
    question: 'Quais compras estão pendentes?',
    icon: ShoppingCart,
  },
  {
    domain: 'Fornecedores',
    question: 'Quais fornecedores estão ativos?',
    icon: Truck,
  },
  {
    domain: 'Documentos',
    question: 'Quantos documentos ativos eu tenho?',
    icon: FileText,
  },
  {
    domain: 'Financeiro',
    question: 'Quais contas estão vencidas?',
    icon: CircleDollarSign,
    financial: true,
  },
  {
    domain: 'Ajuda',
    question: 'Como cadastro uma venda?',
    icon: BookOpen,
  },
  {
    domain: 'Ajuda',
    question: 'Como adiciono um produto?',
    icon: BookOpen,
  },
];

const CAPABILITIES: Capability[] = [
  {
    name: 'Vendas',
    description: 'Consulte totais, quantidade e ticket médio por período.',
    icon: ShoppingBag,
    status: 'available',
  },
  {
    name: 'Pipeline',
    description: 'Acompanhe o resumo das oportunidades e etapas.',
    icon: KanbanSquare,
    status: 'available',
  },
  {
    name: 'Clientes',
    description: 'Veja clientes ativos e novos sem expor dados pessoais.',
    icon: Users,
    status: 'available',
  },
  {
    name: 'Agenda',
    description: 'Consulte compromissos de hoje e dos próximos dias.',
    icon: CalendarDays,
    status: 'available',
  },
  {
    name: 'Estoque',
    description: 'Consulte produtos, posição atual e itens com estoque baixo.',
    icon: Boxes,
    status: 'available',
  },
  {
    name: 'Compras',
    description: 'Acompanhe compras pagas, pendentes e canceladas.',
    icon: ShoppingCart,
    status: 'available',
  },
  {
    name: 'Fornecedores',
    description: 'Consulte a situação do cadastro de fornecedores.',
    icon: Truck,
    status: 'available',
  },
  {
    name: 'Documentos',
    description: 'Consulte contagens por categoria, sem acessar arquivos.',
    icon: FileText,
    status: 'available',
  },
  {
    name: 'Financeiro',
    description: 'Consulte visão financeira e contas vencidas permitidas.',
    icon: CircleDollarSign,
    status: 'financial',
  },
  {
    name: 'Relatórios',
    description: 'Receba explicações automáticas sobre seus indicadores.',
    icon: BarChart3,
    status: 'coming_soon',
  },
  {
    name: 'Ajuda sobre o sistema',
    description: 'Descubra como realizar tarefas no SobControle.',
    icon: BookOpen,
    status: 'available',
  },
];

const FUTURE_CAPABILITIES = [
  {
    title: 'Insights proativos',
    description:
      'Receba alertas sobre riscos e oportunidades antes de precisar perguntar.',
    icon: Lightbulb,
  },
  {
    title: 'Recomendações inteligentes',
    description:
      'Priorize contatos, compras, reposições e ações operacionais.',
    icon: Target,
  },
  {
    title: 'Relatórios explicados pela IA',
    description:
      'Entenda o que mudou nos seus indicadores e por quê.',
    icon: BarChart3,
  },
  {
    title: 'Ações assistidas',
    description:
      'Crie tarefas, agende reuniões e prepare mensagens com confirmação.',
    icon: WandSparkles,
  },
  {
    title: 'Conhecimento do seu site',
    description:
      'Use documentos autorizados para ajudar a IA do seu site.',
    icon: BookOpen,
  },
];

const ERROR_TITLES: Partial<
  Record<GestlyConversationError['code'], string>
> = {
  usage_limit_exceeded: 'Limite de uso atingido',
  company_disabled: 'IA desativada para esta empresa',
  global_disabled: 'Indisponibilidade temporária',
  rate_limited: 'Indisponibilidade temporária',
  configuration_error: 'Indisponibilidade temporária',
  tool_query_failed: 'Não foi possível consultar os dados',
  internal_error: 'Indisponibilidade temporária',
  permission_denied: 'Sem permissão',
  financial_permission_denied: 'Sem permissão para dados financeiros',
  unauthorized: 'Sessão não encontrada',
  tool_unavailable: 'Consulta ainda não disponível',
};

const statusStyles = {
  ready: {
    label: 'Pronta para ajudar',
    dot: 'bg-emerald-500',
    container:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200',
  },
  consulting: {
    label: 'Consultando dados da sua empresa',
    dot: 'bg-cyan-500 animate-pulse motion-reduce:animate-none',
    container:
      'bg-cyan-50 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-100',
  },
  unavailable: {
    label: 'Indisponível temporariamente',
    dot: 'bg-amber-500',
    container:
      'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-100',
  },
};

const capabilityStatus = (
  capability: Capability,
  canViewFinancial: boolean,
) => {
  if (capability.status === 'coming_soon') {
    return {
      label: 'Em breve',
      className:
        'bg-blue-50 text-blue-700 dark:bg-blue-400/10 dark:text-blue-200',
      icon: Clock3,
    };
  }

  if (capability.status === 'financial' && !canViewFinancial) {
    return {
      label: 'Sem permissão',
      className:
        'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-100',
      icon: ShieldAlert,
    };
  }

  return {
    label: 'Disponível',
    className:
      'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200',
    icon: Check,
  };
};

export const GestlyPage: React.FC = () => {
  const { company, profile, hasRole } = useAuth();
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstName = profile?.name?.trim().split(/\s+/)[0];
  const canViewFinancial = hasRole(['admin', 'manager']);
  const conversation = useGestlyConversation({
    companyId: company?.id,
    firstName,
  });
  const visibleQuestions = useMemo(
    () =>
      SUGGESTED_QUESTIONS.filter(
        (suggestion) => !suggestion.financial || canViewFinancial,
      ),
    [canViewFinancial],
  );
  const currentStatus = statusStyles[conversation.status];

  const sendMessage = async (content = input) => {
    if (!content.trim() || conversation.isSending) return;
    setInput('');
    await conversation.sendMessage(content);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const handleNewConversation = () => {
    setInput('');
    conversation.resetConversation();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSuggestion = (question: string) => {
    setInput(question);
    void sendMessage(question);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 pb-8">
      <header className="panel-glass relative overflow-hidden rounded-3xl p-6 md:p-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,210,255,0.14),transparent_55%)]"
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B2551] to-[#00d2ff] text-white shadow-lg shadow-cyan-500/15">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white md:text-3xl">
                Gestly
              </h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-white/60 md:text-base">
                Sua inteligência para decisões mais rápidas.
              </p>
              <div
                role="status"
                className={`mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${currentStatus.container}`}
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${currentStatus.dot}`}
                />
                {currentStatus.label}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewConversation}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-full bg-[#0B2551] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#0B2551]/15 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] focus-visible:ring-offset-2 dark:ring-offset-[#0a0b0e] lg:self-auto"
          >
            <Plus className="h-4 w-4" />
            Nova conversa
          </button>
        </div>
      </header>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section
          aria-labelledby="gestly-conversation-title"
          className="panel-glass flex min-h-[680px] flex-col rounded-3xl"
        >
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 dark:border-white/10 md:px-6">
            <div>
              <h2
                id="gestly-conversation-title"
                className="font-semibold text-gray-900 dark:text-white"
              >
                Conversa atual
              </h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-white/45">
                {conversation.hasConversation
                  ? 'O contexto fica apenas nesta sessão.'
                  : 'Nenhuma conversa ativa — escolha uma sugestão ou escreva abaixo.'}
              </p>
            </div>
            <Bot
              aria-hidden="true"
              className="h-5 w-5 text-[#00a8d8]"
            />
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6">
            {conversation.wasContextCleared && (
              <div
                role="status"
                className="mb-4 flex items-start gap-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900 dark:border-cyan-300/15 dark:bg-cyan-400/10 dark:text-cyan-100"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0" />
                O contexto da conversa foi limpo após a troca de empresa.
              </div>
            )}

            {conversation.error && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-900 dark:border-red-300/15 dark:bg-red-500/10 dark:text-red-100"
              >
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">
                    {ERROR_TITLES[conversation.error.code] ??
                      'Não foi possível continuar'}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed opacity-80">
                    {conversation.error.message}
                  </p>
                </div>
              </div>
            )}

            <ChatMessages
              messages={conversation.messages}
              isSending={conversation.isSending}
            />
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-black/5 p-4 dark:border-white/10 md:p-5"
          >
            <label
              htmlFor="gestly-message"
              className="sr-only"
            >
              Mensagem para a Gestly
            </label>
            <div className="flex items-end gap-2 rounded-2xl border border-black/10 bg-white p-2 shadow-sm transition focus-within:border-[#00a8d8]/60 focus-within:ring-2 focus-within:ring-[#00a8d8]/15 dark:border-white/10 dark:bg-white/[0.05]">
              <textarea
                ref={inputRef}
                id="gestly-message"
                rows={2}
                maxLength={2000}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                disabled={conversation.isSending}
                placeholder="Pergunte sobre sua empresa…"
                className="max-h-36 min-h-12 flex-1 resize-none bg-transparent px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 disabled:cursor-not-allowed disabled:opacity-60 dark:text-white dark:placeholder:text-white/30"
              />
              {conversation.isSending ? (
                <button
                  type="button"
                  onClick={conversation.stopResponse}
                  aria-label="Interromper resposta"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-900 text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] dark:bg-white dark:text-gray-900"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Enviar mensagem"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0B2551] to-[#00a8d8] text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-gray-400 dark:text-white/35">
              <span>Enter envia · Shift + Enter quebra a linha</span>
              <span>{input.length}/2000</span>
            </div>
          </form>
        </section>

        <aside className="space-y-6">
          <section
            aria-labelledby="gestly-suggestions-title"
            className="panel-glass rounded-3xl p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <Sparkles
                aria-hidden="true"
                className="h-4 w-4 text-[#00a8d8]"
              />
              <h2
                id="gestly-suggestions-title"
                className="text-sm font-semibold text-gray-900 dark:text-white"
              >
                Perguntas sugeridas
              </h2>
            </div>
            <div className="space-y-2">
              {visibleQuestions.map((suggestion) => (
                <button
                  key={`${suggestion.domain}-${suggestion.question}`}
                  type="button"
                  disabled={conversation.isSending}
                  onClick={() => handleSuggestion(suggestion.question)}
                  className="group flex w-full items-start gap-3 rounded-2xl border border-black/[0.05] bg-white/65 px-3.5 py-3 text-left transition hover:-translate-y-0.5 hover:border-[#00a8d8]/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a8d8] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none dark:border-white/[0.07] dark:bg-white/[0.035]"
                >
                  <suggestion.icon
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-[#00a8d8] dark:text-white/40"
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/35">
                      {suggestion.domain}
                    </span>
                    <span className="mt-0.5 block text-xs font-medium leading-relaxed text-gray-700 dark:text-white/75">
                      {suggestion.question}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="gestly-capabilities-title"
            className="panel-glass rounded-3xl p-5"
          >
            <div className="mb-4 flex items-center gap-2">
              <Bot
                aria-hidden="true"
                className="h-4 w-4 text-[#00a8d8]"
              />
              <h2
                id="gestly-capabilities-title"
                className="text-sm font-semibold text-gray-900 dark:text-white"
              >
                O que a Gestly pode fazer
              </h2>
            </div>
            <div className="divide-y divide-black/[0.05] dark:divide-white/[0.07]">
              {CAPABILITIES.map((capability) => {
                const status = capabilityStatus(
                  capability,
                  canViewFinancial,
                );
                const StatusIcon = status.icon;

                return (
                  <div
                    key={capability.name}
                    className="flex gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black/[0.035] text-gray-500 dark:bg-white/[0.06] dark:text-white/55">
                      <capability.icon
                        aria-hidden="true"
                        className="h-4 w-4"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-xs font-semibold text-gray-800 dark:text-white/85">
                          {capability.name}
                        </h3>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${status.className}`}
                        >
                          <StatusIcon
                            aria-hidden="true"
                            className="h-2.5 w-2.5"
                          />
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-gray-500 dark:text-white/45">
                        {capability.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>

      <section
        aria-labelledby="gestly-future-title"
        className="space-y-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0088ad] dark:text-[#53dcff]">
            Inteligência em evolução
          </p>
          <h2
            id="gestly-future-title"
            className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-white"
          >
            Em breve
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-white/50">
            Próximas capacidades planejadas, ainda sem ações automáticas.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {FUTURE_CAPABILITIES.map((capability) => (
            <article
              key={capability.title}
              className="panel-glass rounded-3xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0B2551]/10 to-[#00d2ff]/15 text-[#0088ad] dark:text-[#53dcff]">
                  <capability.icon
                    aria-hidden="true"
                    className="h-4 w-4"
                  />
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
                  Em breve
                </span>
              </div>
              <h3 className="mt-5 text-sm font-semibold text-gray-900 dark:text-white">
                {capability.title}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-white/50">
                {capability.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GestlyPage;
