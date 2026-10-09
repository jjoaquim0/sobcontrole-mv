import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle, CalendarClock, CalendarOff, Check, ClipboardList, ExternalLink, FileWarning, HardHat, History,
  Loader2, Pencil, Plus, ShieldCheck, Undo2, Upload, X,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { HowToPanel } from '@/components/shared/HowToPanel';
import { usePeopleDocs } from '@/hooks/usePeopleDocs';
import { DocumentRequirement, EmployeeAbsence, EquipmentDelivery } from '@/types';
import { cardClass, inputClass, primaryButtonClass, secondaryButtonClass } from '@/pages/contracts/components/ContractPrimitives';
import { ReasonModal } from '@/pages/demands/components/DemandFormModals';
import {
  ABSENCE_KIND_LABELS,
  AbsenceState,
  buildChecklist,
  ChecklistItem,
  describeExpiry,
  DOCUMENT_RECORD_STATUS_LABELS,
  DOCUMENT_TARGET_LABELS,
  EQUIPMENT_CATEGORY_LABELS,
  formatDate,
  getAbsenceState,
  getReplacementState,
  isSafeHttpsUrl,
  PEOPLE_EVENT_LABELS,
  summarizeChecklist,
  todayIso,
} from './peopleDocsDomain';
import { Badge, ChecklistBadge, ReplacementBadge } from './components/PeopleDocsPrimitives';
import { AbsenceModal, DeliveryModal, RejectDocumentModal, RequirementModal, ReturnDeliveryModal, SubmitDocumentModal } from './components/PeopleDocsModals';

type Tab = 'pending' | 'checklist' | 'absences' | 'equipment' | 'history';
const tabs: { key: Tab; label: string; icon: typeof ClipboardList }[] = [
  { key: 'pending', label: 'Pendências', icon: FileWarning },
  { key: 'checklist', label: 'Checklist', icon: ClipboardList },
  { key: 'absences', label: 'Férias e afastamentos', icon: CalendarOff },
  { key: 'equipment', label: 'Uniformes e EPIs', icon: HardHat },
  { key: 'history', label: 'Histórico', icon: History },
];

const absenceStateLabel: Record<AbsenceState, { label: string; color: 'amber' | 'blue' | 'gray' }> = {
  current: { label: 'Em curso', color: 'amber' },
  upcoming: { label: 'Agendada', color: 'blue' },
  finished: { label: 'Encerrada', color: 'gray' },
  canceled: { label: 'Cancelada', color: 'gray' },
};

const OpenLink = ({ url, label }: { url?: string; label: string }) =>
  url && isSafeHttpsUrl(url)
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300">{label}<ExternalLink className="h-3 w-3" /></a>
    : null;

const smallButton = 'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50';

const Empty = ({ children }: { children: string }) => <div className={`${cardClass} py-10 text-center text-sm text-gray-500`}>{children}</div>;

export const PeopleDocsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => (tabs.some((item) => item.key === searchParams.get('aba')) ? searchParams.get('aba') as Tab : 'pending'));
  const [contractFilter, setContractFilter] = useState('');
  const employeeFilter = searchParams.get('funcionario') || '';
  const [showValid, setShowValid] = useState(false);
  const [showPastAbsences, setShowPastAbsences] = useState(false);
  const [showReturned, setShowReturned] = useState(false);
  const [requirementModal, setRequirementModal] = useState<{ open: boolean; requirement?: DocumentRequirement }>({ open: false });
  const [submitting, setSubmitting] = useState<ChecklistItem>();
  const [rejecting, setRejecting] = useState<ChecklistItem>();
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [canceling, setCanceling] = useState<EmployeeAbsence>();
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [returning, setReturning] = useState<EquipmentDelivery>();

  const {
    overview, saveRequirement, isSavingRequirement, submitDocument, isSubmittingDocument, reviewDocument, isReviewingDocument,
    registerAbsence, isRegisteringAbsence, cancelAbsence, isCancelingAbsence, registerDelivery, isRegisteringDelivery,
    returnDelivery, isReturningDelivery,
  } = usePeopleDocs();
  const data = overview.data;
  const today = todayIso();

  const checklist = useMemo(() => (data ? buildChecklist({ ...data, today }) : []), [data, today]);
  const postById = useMemo(() => new Map((data?.posts || []).map((post) => [post.id, post])), [data]);
  const contractById = useMemo(() => new Map((data?.contracts || []).map((contract) => [contract.id, contract])), [data]);

  const setEmployeeFilter = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set('funcionario', value); else next.delete('funcionario');
    setSearchParams(next, { replace: true });
  };

  const employeeContracts = (employeeId: string) => new Set((data?.allocations || [])
    .filter((allocation) => allocation.employeeId === employeeId && (!allocation.endDate || allocation.endDate >= today))
    .map((allocation) => postById.get(allocation.postId)?.contractId)
    .filter(Boolean) as string[]);
  const matchesEmployee = (employeeId?: string) => !employeeFilter || employeeId === employeeFilter;
  const matchesContract = (employeeId: string) => !contractFilter || employeeContracts(employeeId).has(contractFilter);

  const filteredChecklist = checklist.filter((item) =>
    (!contractFilter || item.contractIds.includes(contractFilter)) && (!employeeFilter || item.employeeId === employeeFilter));
  const summary = summarizeChecklist(filteredChecklist);
  const visibleChecklist = filteredChecklist.filter((item) => showValid || item.state !== 'valid');

  if (overview.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-700" /></div>;
  if (overview.isError || !data) {
    return <div role="alert" className={`${cardClass} p-10 text-center`}><h1 className="font-bold text-gray-900 dark:text-white">Não foi possível carregar documentos, férias e EPIs.</h1><button type="button" onClick={() => overview.refetch()} className="mt-4 text-sm font-semibold text-cyan-700">Tentar de novo</button></div>;
  }

  const employeeName = (id: string) => data.employees.find((employee) => employee.id === id)?.fullName;
  const holderPostsLabel = (employeeId: string) => data.allocations
    .filter((allocation) => allocation.employeeId === employeeId && allocation.allocationRole === 'holder' && (!allocation.endDate || allocation.endDate >= today))
    .map((allocation) => {
      const post = postById.get(allocation.postId);
      const contract = post ? contractById.get(post.contractId) : undefined;
      return post ? `${post.name}${contract ? ` (${contract.title})` : ''}` : undefined;
    })
    .filter(Boolean)
    .join(', ');

  const absences = data.absences
    .filter((absence) => matchesEmployee(absence.employeeId) && matchesContract(absence.employeeId))
    .filter((absence) => showPastAbsences || ['current', 'upcoming'].includes(getAbsenceState(absence, today)))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const deliveries = data.deliveries
    .filter((delivery) => matchesEmployee(delivery.employeeId) && (!contractFilter || (delivery.postId ? postById.get(delivery.postId)?.contractId === contractFilter : employeeContracts(delivery.employeeId).has(contractFilter))))
    .filter((delivery) => showReturned || !delivery.returnedOn);
  const events = data.events.filter((event) => matchesEmployee(event.employeeId) && (!contractFilter || !event.contractId || event.contractId === contractFilter));
  const activeRequirements = data.requirements.filter((requirement) => requirement.isActive);

  const summaryCards = [
    { label: 'Não entregues ou recusados', value: summary.pending, icon: FileWarning, tone: 'text-red-600 dark:text-red-400' },
    { label: 'Vencidos', value: summary.expired, icon: AlertCircle, tone: 'text-red-600 dark:text-red-400' },
    { label: 'Aguardando conferência', value: summary.awaitingReview, icon: ShieldCheck, tone: 'text-blue-700 dark:text-blue-300' },
    { label: 'Vencem em 30 dias', value: summary.expiring, icon: CalendarClock, tone: 'text-amber-600 dark:text-amber-300' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Pessoas e documentos" subtitle="Documentos exigidos, férias e afastamentos, uniformes e EPIs dos funcionários alocados." />
      <HowToPanel
        id="documentacao"
        steps={[
          'Na aba Checklist, cadastre os documentos exigidos de cada funcionário alocado ou do contrato, com a validade.',
          'Em Pendências, registre a entrega (link do Drive) e confira ou recuse com motivo.',
          'Registre férias e afastamentos: o titular ausente deixa de cobrir o posto na tela do contrato.',
          'Registre entregas de uniforme e EPI com o CA e a data de troca.',
        ]}
        note="Não registre diagnóstico ou CID nas observações de afastamento."
      />

      <section className={`${cardClass} grid grid-cols-1 gap-3 sm:grid-cols-2`} aria-label="Filtros">
        <label><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Contrato</span>
          <select className={inputClass} value={contractFilter} onChange={(event) => setContractFilter(event.target.value)}>
            <option value="">Todos os contratos</option>
            {data.contracts.map((contract) => <option key={contract.id} value={contract.id}>{contract.title} · {contract.clientName}</option>)}
          </select>
        </label>
        <label><span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-300">Funcionário</span>
          <select className={inputClass} value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
            <option value="">Todos os funcionários</option>
            {data.employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}
          </select>
        </label>
      </section>

      <nav aria-label="Seções" className="flex overflow-x-auto border-b border-gray-200 dark:border-white/10">
        {tabs.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} aria-current={tab === item.key ? 'page' : undefined} className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${tab === item.key ? 'border-cyan-700 text-cyan-700 dark:text-cyan-300' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}><item.icon className="h-4 w-4" />{item.label}</button>)}
      </nav>

      {tab === 'pending' && (
        <section className="space-y-4">
          <div role="region" aria-label="Resumo dos documentos" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <div key={card.label} className={cardClass}>
                <card.icon className={`h-5 w-5 ${card.tone}`} aria-hidden="true" />
                <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
            ))}
          </div>
          {activeRequirements.length === 0 ? (
            <div className={`${cardClass} py-10 text-center`}>
              <p className="text-sm text-gray-500">Nenhum documento no checklist. Cadastre o que cada funcionário ou contrato precisa ter em dia.</p>
              <button type="button" onClick={() => setRequirementModal({ open: true })} className={`${primaryButtonClass} mt-4`}><Plus className="h-4 w-4" />Cadastrar documento</button>
            </div>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><input type="checkbox" checked={showValid} onChange={(event) => setShowValid(event.target.checked)} />Mostrar documentos em dia ({summary.valid})</label>
              {visibleChecklist.length === 0 ? <Empty>{filteredChecklist.length ? 'Nenhuma pendência. Tudo em dia.' : 'Nenhum funcionário alocado ou contrato ativo para cobrar estes documentos.'}</Empty> : (
                <ul className="space-y-2" aria-label="Pendências de documentos">
                  {visibleChecklist.map((item) => (
                    <li key={item.key} className={`${cardClass} flex flex-wrap items-start justify-between gap-3 !p-4`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900 dark:text-white">{item.requirement.name}</h3><ChecklistBadge state={item.state} /></div>
                        <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{item.target === 'employee' ? item.targetName : `Contrato: ${item.targetName}`}{item.context && <span className="text-gray-400"> · {item.context}</span>}</p>
                        {item.record && (
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                            <span>{DOCUMENT_RECORD_STATUS_LABELS[item.record.status]}{item.record.reviewedByName ? ` por ${item.record.reviewedByName}` : ''}</span>
                            <span className={item.state === 'expired' ? 'font-semibold text-red-600 dark:text-red-400' : item.state === 'expiring' ? 'font-semibold text-amber-700 dark:text-amber-300' : ''}>{describeExpiry(item.record.expiresOn, today)}{item.record.expiresOn ? ` (${formatDate(item.record.expiresOn)})` : ''}</span>
                            <OpenLink url={item.record.documentUrl} label="Abrir documento" />
                          </p>
                        )}
                        {item.state === 'rejected' && item.record?.reviewNote && <p className="mt-1 text-xs text-red-600 dark:text-red-400">Motivo da recusa: {item.record.reviewNote}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.state === 'awaiting_review' && item.record && (
                          <>
                            <button type="button" disabled={isReviewingDocument} onClick={() => reviewDocument({ recordId: item.record!.id, approve: true }).catch(() => undefined)} className={`${smallButton} bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300`}><Check className="h-3.5 w-3.5" />Conferir</button>
                            <button type="button" onClick={() => setRejecting(item)} className={`${smallButton} text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10`}><X className="h-3.5 w-3.5" />Recusar</button>
                          </>
                        )}
                        <button type="button" onClick={() => setSubmitting(item)} className={`${smallButton} text-cyan-700 hover:bg-cyan-500/10 dark:text-cyan-300`}><Upload className="h-3.5 w-3.5" />{item.record ? 'Nova entrega' : 'Registrar entrega'}</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      )}

      {tab === 'checklist' && (
        <section className="space-y-3">
          <div className="flex justify-end"><button type="button" onClick={() => setRequirementModal({ open: true })} className={primaryButtonClass}><Plus className="h-4 w-4" />Novo documento</button></div>
          {data.requirements.length === 0 ? <Empty>Nenhum documento cadastrado no checklist.</Empty> : data.requirements.map((requirement) => (
            <article key={requirement.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-3 ${requirement.isActive ? '' : 'opacity-60'}`}>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900 dark:text-white">{requirement.name}</h3>{!requirement.isActive && <Badge color="gray">Inativo</Badge>}</div>
                <p className="mt-0.5 text-sm text-gray-500">
                  {DOCUMENT_TARGET_LABELS[requirement.target]} · {requirement.contractTitle || 'todos os contratos'}{requirement.postName ? ` · ${requirement.postName}` : ''} · {requirement.validityMonths ? `validade de ${requirement.validityMonths} meses` : 'sem validade'}
                </p>
                {requirement.description && <p className="mt-1 text-xs text-gray-500">{requirement.description}</p>}
              </div>
              <button type="button" onClick={() => setRequirementModal({ open: true, requirement })} className={secondaryButtonClass}><Pencil className="h-4 w-4" />Editar</button>
            </article>
          ))}
        </section>
      )}

      {tab === 'absences' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><input type="checkbox" checked={showPastAbsences} onChange={(event) => setShowPastAbsences(event.target.checked)} />Mostrar encerradas e canceladas</label>
            <button type="button" onClick={() => setAbsenceOpen(true)} className={primaryButtonClass}><Plus className="h-4 w-4" />Registrar férias ou afastamento</button>
          </div>
          {absences.length === 0 ? <Empty>Nenhuma férias ou afastamento em curso ou agendado.</Empty> : (
            <ul className="space-y-2" aria-label="Férias e afastamentos">
              {absences.map((absence) => {
                const state = getAbsenceState(absence, today);
                const posts = holderPostsLabel(absence.employeeId);
                return (
                  <li key={absence.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-3 !p-4`}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900 dark:text-white">{absence.employeeName}</h3><Badge color={absenceStateLabel[state].color}>{absenceStateLabel[state].label}</Badge></div>
                      <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{ABSENCE_KIND_LABELS[absence.kind]} · {formatDate(absence.startDate)} até {formatDate(absence.endDate)}</p>
                      {posts && state !== 'canceled' && state !== 'finished' && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Titular em: {posts}. Confira o substituto na tela do contrato.</p>}
                      {absence.notes && <p className="mt-1 text-xs text-gray-500">{absence.notes}</p>}
                      {absence.cancelReason && <p className="mt-1 text-xs text-gray-500">Cancelada: {absence.cancelReason}</p>}
                    </div>
                    {(state === 'current' || state === 'upcoming') && <button type="button" onClick={() => setCanceling(absence)} className={`${smallButton} text-gray-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10`}><X className="h-3.5 w-3.5" />Cancelar</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {tab === 'equipment' && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><input type="checkbox" checked={showReturned} onChange={(event) => setShowReturned(event.target.checked)} />Mostrar devolvidos</label>
            <button type="button" onClick={() => setDeliveryOpen(true)} className={primaryButtonClass}><Plus className="h-4 w-4" />Registrar entrega</button>
          </div>
          {deliveries.length === 0 ? <Empty>Nenhum uniforme ou EPI em uso registrado.</Empty> : (
            <ul className="space-y-2" aria-label="Uniformes e EPIs">
              {deliveries.map((delivery) => (
                <li key={delivery.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-3 !p-4`}>
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-gray-900 dark:text-white">{delivery.itemName}</h3><Badge color="gray">{EQUIPMENT_CATEGORY_LABELS[delivery.category]}</Badge><ReplacementBadge state={getReplacementState(delivery, today)} /></div>
                    <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{delivery.employeeName}{delivery.postName ? ` · ${delivery.postName}` : ''}</p>
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-gray-500">
                      <span>{delivery.quantity} un.{delivery.size ? ` · tam. ${delivery.size}` : ''}{delivery.caNumber ? ` · CA ${delivery.caNumber}` : ''}</span>
                      <span>Entregue em {formatDate(delivery.deliveredOn)}</span>
                      {delivery.replaceBy && !delivery.returnedOn && <span>Trocar até {formatDate(delivery.replaceBy)}</span>}
                      {delivery.returnedOn && <span>Devolvido em {formatDate(delivery.returnedOn)}{delivery.returnNote ? ` · ${delivery.returnNote}` : ''}</span>}
                      <OpenLink url={delivery.evidenceUrl} label="Ficha de entrega" />
                    </p>
                  </div>
                  {!delivery.returnedOn && <button type="button" onClick={() => setReturning(delivery)} className={`${smallButton} text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5`}><Undo2 className="h-3.5 w-3.5" />Devolver</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'history' && (
        <section className={cardClass}>
          {events.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhum evento registrado.</p> : (
            <ol className="space-y-4">
              {events.map((event) => (
                <li key={event.id} className="relative border-l-2 border-cyan-100 pl-5 dark:border-cyan-400/20">
                  <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-cyan-600" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{PEOPLE_EVENT_LABELS[event.eventType] || event.eventType}{event.employeeName ? ` · ${event.employeeName}` : ''}</h3>
                  <p className="mt-1 text-xs text-gray-500">{event.actorName} · {new Date(event.createdAt).toLocaleString('pt-BR')}</p>
                  {event.note && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{event.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {employeeFilter && employeeName(employeeFilter) && (
        <p className="text-xs text-gray-500">Mostrando somente {employeeName(employeeFilter)}. <Link to={`/pessoas/funcionarios/${employeeFilter}`} className="font-semibold text-cyan-700 hover:underline">Abrir cadastro</Link></p>
      )}

      <RequirementModal isOpen={requirementModal.open} requirement={requirementModal.requirement} options={data} isLoading={isSavingRequirement} onClose={() => setRequirementModal({ open: false })} onSave={async (input) => { await saveRequirement({ input, id: requirementModal.requirement?.id }); setRequirementModal({ open: false }); }} />
      <SubmitDocumentModal item={submitting} isLoading={isSubmittingDocument} onClose={() => setSubmitting(undefined)} onSave={async (input) => { await submitDocument(input); setSubmitting(undefined); }} />
      <RejectDocumentModal item={rejecting} isLoading={isReviewingDocument} onClose={() => setRejecting(undefined)} onSave={async (note) => { if (rejecting?.record) await reviewDocument({ recordId: rejecting.record.id, approve: false, note }); setRejecting(undefined); }} />
      <AbsenceModal isOpen={absenceOpen} employees={data.employees} defaultEmployeeId={employeeFilter || undefined} isLoading={isRegisteringAbsence} onClose={() => setAbsenceOpen(false)} onSave={async (input) => { await registerAbsence(input); setAbsenceOpen(false); }} />
      <ReasonModal isOpen={Boolean(canceling)} title="Cancelar férias ou afastamento" subtitle={canceling ? `${canceling.employeeName} · ${formatDate(canceling.startDate)} até ${formatDate(canceling.endDate)}` : undefined} label="Motivo" submitLabel="Cancelar registro" isLoading={isCancelingAbsence} onClose={() => setCanceling(undefined)} onSave={async (reason) => { if (canceling) await cancelAbsence({ absenceId: canceling.id, reason }); setCanceling(undefined); }} />
      <DeliveryModal isOpen={deliveryOpen} options={data} defaultEmployeeId={employeeFilter || undefined} isLoading={isRegisteringDelivery} onClose={() => setDeliveryOpen(false)} onSave={async (input) => { await registerDelivery(input); setDeliveryOpen(false); }} />
      <ReturnDeliveryModal delivery={returning} isLoading={isReturningDelivery} onClose={() => setReturning(undefined)} onSave={async (input) => { await returnDelivery(input); setReturning(undefined); }} />
    </div>
  );
};
