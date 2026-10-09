import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CalendarCheck, CalendarClock, Check, ClipboardList, ExternalLink, FolderOpen, History, ListChecks, Loader2, Lock,
  Pencil, Plus, RefreshCw, Send, Undo2, Upload, X,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { HowToPanel } from '@/components/shared/HowToPanel';
import { useObligations } from '@/hooks/useObligations';
import { ObligationItem, ObligationItemStatus, ObligationPeriodStatus, ObligationTemplate } from '@/types';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/pages/contracts/components/ContractPrimitives';
import { ReasonModal } from '@/pages/demands/components/DemandFormModals';
import { Badge } from '@/pages/peopleDocs/components/PeopleDocsPrimitives';
import {
  computeDueDate,
  currentWorkingCompetence,
  describeItemDue,
  describeSchedule,
  formatCompetence,
  formatDate,
  getItemDueState,
  isItemDone,
  isSafeHttpsUrl,
  ITEM_STATUS_LABELS,
  ItemDueState,
  OBLIGATION_EVENT_LABELS,
  PERIOD_STATUS_LABELS,
  sortItemsForAgenda,
  summarizeItems,
  templateApplies,
  toCompetence,
  todayIso,
} from './obligationsDomain';
import { AddItemModal, EditItemModal, EvidenceModal, SendPeriodModal, TemplateModal } from './components/ObligationModals';

type Tab = 'period' | 'agenda' | 'templates' | 'history';
const tabs: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
  { key: 'period', label: 'Competência', icon: FolderOpen },
  { key: 'agenda', label: 'Agenda', icon: CalendarClock },
  { key: 'templates', label: 'Obrigações', icon: ListChecks },
  { key: 'history', label: 'Histórico', icon: History },
];

const itemStatusColor: Record<ObligationItemStatus, 'gray' | 'blue' | 'green' | 'red' | 'amber'> = {
  pending: 'gray', submitted: 'blue', verified: 'green', rejected: 'red', waived: 'gray',
};
const periodStatusColor: Record<ObligationPeriodStatus, 'amber' | 'blue' | 'green'> = { open: 'amber', ready: 'blue', sent: 'green' };
const dueTone: Record<ItemDueState, string> = {
  overdue: 'font-semibold text-red-600 dark:text-red-400',
  due_soon: 'font-semibold text-amber-700 dark:text-amber-300',
  ok: 'text-gray-500',
  done: 'text-gray-500',
};

const smallButton = 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50';

const OpenLink = ({ url, label }: { url?: string; label: string }) =>
  url && isSafeHttpsUrl(url)
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300">{label}<ExternalLink className="h-3 w-3" /></a>
    : null;

const Empty = ({ children }: { children: string }) => <div className={`${cardClass} py-10 text-center text-sm text-gray-500`}>{children}</div>;

export const ObligationsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayIso();
  const tab: Tab = tabs.some((item) => item.key === searchParams.get('aba')) ? searchParams.get('aba') as Tab : 'period';
  const competence = /^\d{4}-\d{2}$/.test(searchParams.get('competencia') || '') ? `${searchParams.get('competencia')}-01` : currentWorkingCompetence(today);

  const [templateModal, setTemplateModal] = useState<{ open: boolean; template?: ObligationTemplate }>({ open: false });
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<ObligationItem>();
  const [submittingItem, setSubmittingItem] = useState<ObligationItem>();
  const [rejectingItem, setRejectingItem] = useState<ObligationItem>();
  const [waivingItem, setWaivingItem] = useState<ObligationItem>();
  const [reopening, setReopening] = useState(false);
  const [sending, setSending] = useState(false);

  const {
    overview, saveTemplate, isSavingTemplate, openPeriod, isOpeningPeriod, addItem, isAddingItem, updateItem, isUpdatingItem,
    submitItem, isSubmittingItem, reviewItem, isReviewingItem, waiveItem, isWaivingItem, markReady, isMarkingReady,
    reopenPeriod, isReopening, markSent, isMarkingSent,
  } = useObligations();
  const data = overview.data;

  const activeContracts = useMemo(() => (data?.contracts || []).filter((contract) => contract.status === 'active'), [data]);
  const contractId = searchParams.get('contrato') || activeContracts[0]?.id || '';
  const contract = data?.contracts.find((item) => item.id === contractId);
  const period = data?.periods.find((item) => item.contractId === contractId && item.competence === competence);
  const periodItems = useMemo(
    () => sortItemsForAgenda((data?.items || []).filter((item) => item.periodId === period?.id), today),
    [data, period, today],
  );
  const summary = summarizeItems(periodItems, today);

  const updateParams = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => { if (value) next.set(key, value); else next.delete(key); });
    setSearchParams(next, { replace: true });
  };

  if (overview.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-700" /></div>;
  if (overview.isError || !data) {
    return <div role="alert" className={`${cardClass} p-10 text-center`}><h1 className="font-bold text-gray-900 dark:text-white">Não foi possível carregar as obrigações.</h1><button type="button" onClick={() => overview.refetch()} className="mt-4 text-sm font-semibold text-cyan-700">Tentar de novo</button></div>;
  }

  const periodById = new Map(data.periods.map((item) => [item.id, item]));
  const applicableTemplates = data.templates
    .filter((template) => template.isActive && (!template.contractId || template.contractId === contractId) && templateApplies(template, competence));
  const missingTemplates = period?.status === 'open'
    ? applicableTemplates.filter((template) => !periodItems.some((item) => item.templateId === template.id))
    : [];
  const agendaItems = sortItemsForAgenda(
    data.items.filter((item) => !isItemDone(item) && periodById.get(item.periodId)?.status === 'open'),
    today,
  );
  const periodTitle = period ? `${contract?.title || period.contractTitle} · ${formatCompetence(period.competence)}` : undefined;
  const isOpen = period?.status === 'open';

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Obrigações e competências" subtitle="Agenda de obrigações por contrato e pacote de comprovação mensal com conferência e envio." />

      <nav aria-label="Seções" className="flex overflow-x-auto border-b border-gray-200 dark:border-white/10">
        {tabs.map((item) => <button key={item.key} type="button" onClick={() => updateParams({ aba: item.key === 'period' ? undefined : item.key })} aria-current={tab === item.key ? 'page' : undefined} className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${tab === item.key ? 'border-cyan-700 text-cyan-700 dark:text-cyan-300' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}><item.icon className="h-4 w-4" />{item.label}</button>)}
      </nav>

      {tab === 'period' && (
        <section className="space-y-4">
          <HowToPanel
            id="obrigacoes-competencia"
            steps={[
              'Escolha o contrato e o mês da competência e clique em "Abrir competência". Os itens vêm das obrigações cadastradas.',
              'Para cada item, quem cumpre registra o link da evidência no Drive.',
              'Quem confere aprova ou recusa com motivo. Item que não se aplica no mês é dispensado com justificativa.',
              'Com tudo conferido ou dispensado, feche o pacote e registre o envio com data, destinatário e comprovante.',
            ]}
            note="O sistema não declara conformidade sozinho: cada item depende da conferência de uma pessoa."
          />
          <section className={`${cardClass} grid grid-cols-1 gap-3 sm:grid-cols-2`} aria-label="Filtros">
            <label><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Contrato</span>
              <select className={inputClass} value={contractId} onChange={(event) => updateParams({ contrato: event.target.value })}>
                {activeContracts.length === 0 && <option value="">Nenhum contrato ativo</option>}
                {activeContracts.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.clientName}</option>)}
              </select>
            </label>
            <label><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Competência</span>
              <input type="month" className={inputClass} value={competence.slice(0, 7)} onChange={(event) => event.target.value && updateParams({ competencia: event.target.value })} />
            </label>
          </section>

          {!contractId ? <Empty>Ative um contrato (vigência conferida) para controlar as competências dele.</Empty> : !period ? (
            <div className={`${cardClass} space-y-4`}>
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">{formatCompetence(competence)} ainda não foi aberta</h2>
                <p className="mt-1 text-sm text-gray-500">{applicableTemplates.length ? `Ao abrir, entram ${applicableTemplates.length} item(ns):` : 'Nenhuma obrigação cadastrada vale para este mês. Cadastre na aba Obrigações ou inclua itens à mão depois de abrir.'}</p>
                {applicableTemplates.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                    {applicableTemplates.map((template) => <li key={template.id}>• {template.name} <span className="text-xs text-gray-500">(prazo {formatDate(computeDueDate(competence, template.dueDay, template.dueMonthOffset))})</span></li>)}
                  </ul>
                )}
              </div>
              <button type="button" disabled={isOpeningPeriod} onClick={() => openPeriod({ contractId, competence }).catch(() => undefined)} className={primaryButtonClass}>{isOpeningPeriod ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}Abrir competência</button>
            </div>
          ) : (
            <>
              <div className={`${cardClass} space-y-3`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-gray-900 dark:text-white">{periodTitle}</h2><Badge color={periodStatusColor[period.status]}>{PERIOD_STATUS_LABELS[period.status]}</Badge></div>
                    <p className="mt-1 text-sm text-gray-500" aria-label="Progresso da competência">{summary.done} de {summary.total} item(ns) conferido(s) ou dispensado(s){summary.awaitingReview ? ` · ${summary.awaitingReview} aguardando conferência` : ''}{summary.overdue ? ` · ${summary.overdue} atrasado(s)` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isOpen && <button type="button" onClick={() => setAddingItem(true)} className={secondaryButtonClass}><Plus className="h-4 w-4" />Incluir item</button>}
                    {isOpen && <button type="button" disabled={isMarkingReady || summary.total === 0 || summary.done < summary.total} title={summary.done < summary.total ? 'Confira ou dispense todos os itens antes de fechar.' : undefined} onClick={() => markReady({ periodId: period.id }).catch(() => undefined)} className={primaryButtonClass}><Lock className="h-4 w-4" />Fechar pacote</button>}
                    {period.status === 'ready' && <button type="button" onClick={() => setReopening(true)} className={secondaryButtonClass}><Undo2 className="h-4 w-4" />Reabrir</button>}
                    {period.status === 'ready' && <button type="button" onClick={() => setSending(true)} className={primaryButtonClass}><Send className="h-4 w-4" />Registrar envio</button>}
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10" role="progressbar" aria-valuenow={summary.percent} aria-valuemin={0} aria-valuemax={100} aria-label="Itens concluídos">
                  <div className="h-full rounded-full bg-cyan-600" style={{ width: `${summary.percent}%` }} />
                </div>
                {period.status === 'sent' && (
                  <p className="flex flex-wrap items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CalendarCheck className="h-4 w-4" />Enviado em {formatDate(period.sentOn)} para {period.sentTo}{period.sentByName ? ` por ${period.sentByName}` : ''}. <OpenLink url={period.sentProofUrl} label="Comprovante" /></p>
                )}
                {period.notes && <p className="text-xs text-gray-500">Observação: {period.notes}</p>}
                {missingTemplates.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                    {missingTemplates.length} obrigação(ões) cadastrada(s) depois da abertura ainda não está(ão) nesta competência.
                    <button type="button" disabled={isOpeningPeriod} onClick={() => openPeriod({ contractId, competence }).catch(() => undefined)} className="inline-flex items-center gap-1 font-semibold underline"><RefreshCw className="h-3 w-3" />Incluir agora</button>
                  </div>
                )}
              </div>

              {periodItems.length === 0 ? <Empty>Nenhum item nesta competência. Inclua os itens exigidos pelo contrato.</Empty> : (
                <ul className="space-y-2" aria-label="Itens da competência">
                  {periodItems.map((item) => {
                    const dueState = getItemDueState(item, today);
                    return (
                      <li key={item.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-3 !p-4`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3><Badge color={itemStatusColor[item.status]}>{ITEM_STATUS_LABELS[item.status]}</Badge></div>
                          <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            <span className={dueTone[dueState]}>Prazo {formatDate(item.dueDate)}{dueState !== 'done' ? ` · ${describeItemDue(item, today)}` : ''}</span>
                            <span className={item.responsibleName ? 'text-gray-500' : 'font-semibold text-amber-700 dark:text-amber-300'}>{item.responsibleName ? `Responsável: ${item.responsibleName}` : 'Sem responsável'}</span>
                            <OpenLink url={item.evidenceUrl} label="Evidência" />
                          </p>
                          {item.description && <p className="mt-1 text-xs text-gray-500">{item.description}</p>}
                          {item.submissionNote && <p className="mt-1 text-xs text-gray-500">Obs.: {item.submissionNote}</p>}
                          {item.reviewNote && <p className={`mt-1 text-xs ${item.status === 'rejected' ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>{item.status === 'rejected' ? 'Motivo da recusa' : item.status === 'waived' ? 'Dispensado' : 'Conferência'}: {item.reviewNote}</p>}
                          {item.reviewedByName && (item.status === 'verified' || item.status === 'waived') && <p className="mt-1 text-xs text-gray-400">Por {item.reviewedByName}</p>}
                        </div>
                        {isOpen && (
                          <div className="flex flex-wrap gap-2">
                            {item.status === 'submitted' && (
                              <>
                                <button type="button" disabled={isReviewingItem} onClick={() => reviewItem({ itemId: item.id, approve: true }).catch(() => undefined)} className={`${smallButton} bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300`}><Check className="h-3.5 w-3.5" />Conferir</button>
                                <button type="button" onClick={() => setRejectingItem(item)} className={`${smallButton} text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10`}><X className="h-3.5 w-3.5" />Recusar</button>
                              </>
                            )}
                            {(item.status === 'pending' || item.status === 'rejected') && (
                              <button type="button" onClick={() => setSubmittingItem(item)} className={`${smallButton} text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300`}><Upload className="h-3.5 w-3.5" />Registrar evidência</button>
                            )}
                            {!isItemDone(item) && (
                              <>
                                <button type="button" onClick={() => setEditingItem(item)} className={`${smallButton} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5`}><Pencil className="h-3.5 w-3.5" />Prazo/responsável</button>
                                <button type="button" onClick={() => setWaivingItem(item)} className={`${smallButton} text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5`}>Não se aplica</button>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'agenda' && (
        <section className="space-y-4">
          <div className={cardClass}>
            <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-white">Competências</h2>
            {data.periods.length === 0 ? <p className="text-sm text-gray-500">Nenhuma competência aberta ainda.</p> : (
              <ul className="divide-y divide-gray-100 dark:divide-white/5" aria-label="Competências">
                {data.periods.slice(0, 24).map((item) => {
                  const itemsSummary = summarizeItems(data.items.filter((entry) => entry.periodId === item.id), today);
                  return (
                    <li key={item.id}>
                      <button type="button" onClick={() => updateParams({ aba: undefined, contrato: item.contractId, competencia: item.competence.slice(0, 7) })} className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/5">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.contractTitle} · {formatCompetence(item.competence)}</span>
                        <span className="flex items-center gap-2 text-xs text-gray-500">{itemsSummary.done}/{itemsSummary.total}{itemsSummary.overdue ? <span className="font-semibold text-red-600">{itemsSummary.overdue} atrasado(s)</span> : null}<Badge color={periodStatusColor[item.status]}>{PERIOD_STATUS_LABELS[item.status]}</Badge></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {agendaItems.length === 0 ? <Empty>Nenhum item pendente nas competências abertas.</Empty> : (
            <ul className="space-y-2" aria-label="Agenda de obrigações">
              {agendaItems.map((item) => {
                const owner = periodById.get(item.periodId)!;
                const dueState = getItemDueState(item, today);
                return (
                  <li key={item.id} className={`${cardClass} flex flex-wrap items-center justify-between gap-3 !p-4`}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900 dark:text-white">{item.name}</h3><Badge color={itemStatusColor[item.status]}>{ITEM_STATUS_LABELS[item.status]}</Badge></div>
                      <p className="mt-0.5 text-xs text-gray-500">{owner.contractTitle} · {formatCompetence(owner.competence)} · {item.responsibleName || 'Sem responsável'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs ${dueTone[dueState]}`}>{formatDate(item.dueDate)} · {describeItemDue(item, today)}</span>
                      <button type="button" onClick={() => updateParams({ aba: undefined, contrato: owner.contractId, competencia: owner.competence.slice(0, 7) })} className={`${smallButton} text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300`}>Abrir</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'templates' && (
        <section className="space-y-3">
          <HowToPanel
            id="obrigacoes-modelos"
            steps={[
              'Cadastre cada obrigação que o contrato cobra (ponto, guias, relatórios) com a recorrência e o prazo.',
              'Sem contrato, a obrigação vale para todos os contratos ativos.',
              'Defina o responsável padrão para que os itens já nasçam com dono.',
            ]}
            note="Prazos legais e regras de convenção precisam ser conferidos pelo RH/DP ou pela assessoria; o sistema só guarda o que foi cadastrado."
          />
          <div className="flex justify-end"><button type="button" onClick={() => setTemplateModal({ open: true })} className={primaryButtonClass}><Plus className="h-4 w-4" />Nova obrigação</button></div>
          {data.templates.length === 0 ? <Empty>Nenhuma obrigação cadastrada.</Empty> : (
            <ul className="space-y-2" aria-label="Obrigações cadastradas">
              {data.templates.map((template) => (
                <li key={template.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-3 !p-4`}>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900 dark:text-white">{template.name}</h3>{!template.isActive && <Badge color="gray">Inativa</Badge>}</div>
                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{describeSchedule(template)}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{template.contractTitle || 'Todos os contratos ativos'} · {template.defaultResponsibleName || 'Responsável definido na competência'} · {template.requiresEvidence ? 'Exige evidência' : 'Evidência opcional'}</p>
                  </div>
                  <button type="button" onClick={() => setTemplateModal({ open: true, template })} className={secondaryButtonClass}><Pencil className="h-4 w-4" />Editar</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'history' && (
        <section className={cardClass}>
          {data.events.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhum evento registrado.</p> : (
            <ol className="space-y-4">
              {data.events.map((event) => {
                const owner = event.periodId ? periodById.get(event.periodId) : undefined;
                return (
                  <li key={event.id} className="relative border-l-2 border-cyan-100 pl-5 dark:border-cyan-400/20">
                    <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-cyan-600" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{OBLIGATION_EVENT_LABELS[event.eventType] || event.eventType}{owner ? ` · ${owner.contractTitle} ${formatCompetence(owner.competence)}` : ''}</h3>
                    <p className="mt-1 text-xs text-gray-500">{event.actorName} · {new Date(event.createdAt).toLocaleString('pt-BR')}</p>
                    {event.note && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{event.note}</p>}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}

      <TemplateModal isOpen={templateModal.open} template={templateModal.template} options={data} isLoading={isSavingTemplate} onClose={() => setTemplateModal({ open: false })} onSave={async (input) => { await saveTemplate({ input, id: templateModal.template?.id }); setTemplateModal({ open: false }); }} />
      <AddItemModal isOpen={addingItem} periodId={period?.id} competence={period?.competence || toCompetence(today)} people={data.people} isLoading={isAddingItem} onClose={() => setAddingItem(false)} onSave={async (input) => { await addItem(input); setAddingItem(false); }} />
      <EditItemModal item={editingItem} people={data.people} isLoading={isUpdatingItem} onClose={() => setEditingItem(undefined)} onSave={async (dueDate, responsibleId) => { if (editingItem) await updateItem({ itemId: editingItem.id, dueDate, responsibleId }); setEditingItem(undefined); }} />
      <EvidenceModal item={submittingItem} isLoading={isSubmittingItem} onClose={() => setSubmittingItem(undefined)} onSave={async (evidenceUrl, note) => { if (submittingItem) await submitItem({ itemId: submittingItem.id, evidenceUrl, note }); setSubmittingItem(undefined); }} />
      <ReasonModal isOpen={Boolean(rejectingItem)} title="Recusar item" subtitle={rejectingItem?.name} label="Motivo da recusa" submitLabel="Recusar" isLoading={isReviewingItem} onClose={() => setRejectingItem(undefined)} onSave={async (note) => { if (rejectingItem) await reviewItem({ itemId: rejectingItem.id, approve: false, note }); setRejectingItem(undefined); }} />
      <ReasonModal isOpen={Boolean(waivingItem)} title="Item não se aplica nesta competência" subtitle={waivingItem?.name} label="Justificativa" submitLabel="Dispensar item" isLoading={isWaivingItem} onClose={() => setWaivingItem(undefined)} onSave={async (reason) => { if (waivingItem) await waiveItem({ itemId: waivingItem.id, reason }); setWaivingItem(undefined); }} />
      <ReasonModal isOpen={reopening} title="Reabrir competência" subtitle={periodTitle} label="Motivo" submitLabel="Reabrir" isLoading={isReopening} onClose={() => setReopening(false)} onSave={async (reason) => { if (period) await reopenPeriod({ periodId: period.id, reason }); setReopening(false); }} />
      <SendPeriodModal periodId={sending ? period?.id : undefined} title={periodTitle} isLoading={isMarkingSent} onClose={() => setSending(false)} onSave={async (input) => { await markSent(input); setSending(false); }} />
    </div>
  );
};
