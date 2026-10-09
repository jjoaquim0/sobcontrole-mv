import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRightLeft, ExternalLink, FileCheck2, FileStack, History, LayoutList, Loader2, Pencil, Plus, UserMinus, UserPlus, Users, UserRoundSearch } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useContractDetails } from '@/hooks/useContracts';
import { useEmployees } from '@/hooks/usePeople';
import { usePeopleDocs } from '@/hooks/usePeopleDocs';
import { ABSENCE_KIND_LABELS, getAbsentEmployeeIds } from '@/pages/peopleDocs/peopleDocsDomain';
import { FieldValue } from '@/pages/people/components/PeoplePrimitives';
import { PostAllocation, ServiceContractVersion, ServicePost } from '@/types';
import {
  ALLOCATION_ROLE_LABELS,
  CONTRACT_AUDIT_EVENT_LABELS,
  CONTRACT_FIELD_LABELS,
  formatDate,
  getContractValidity,
  getPostCoverage,
  isSafeHttpsUrl,
  todayIso,
  VALIDATION_STATUS_LABELS,
  VERSION_KIND_LABELS,
} from './contractsDomain';
import { AllocationModal, EndAllocationModal, TransferAllocationModal } from './components/AllocationModals';
import { ContractModal } from './components/ContractModal';
import { cardClass, ContractStatusBadge, CoverageBadge, primaryButtonClass, secondaryButtonClass, ValidityBadge } from './components/ContractPrimitives';
import { PostModal } from './components/PostModal';
import { VersionModal } from './components/VersionModal';

type Tab = 'overview' | 'posts' | 'versions' | 'history';
const tabs: { key: Tab; label: string; icon: typeof LayoutList }[] = [
  { key: 'overview', label: 'Visão geral', icon: LayoutList },
  { key: 'posts', label: 'Postos e alocações', icon: Users },
  { key: 'versions', label: 'Versões e aditivos', icon: FileStack },
  { key: 'history', label: 'Histórico', icon: History },
];

const SafeLink = ({ url, label }: { url?: string; label: string }) =>
  url && isSafeHttpsUrl(url)
    ? <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-cyan-700 hover:underline dark:text-cyan-300">{label}<ExternalLink className="h-3.5 w-3.5" /></a>
    : null;

const periodText = (start?: string, end?: string) => (start || end ? `${formatDate(start)} até ${formatDate(end)}` : undefined);

export const ContractDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [editingContract, setEditingContract] = useState(false);
  const [versionModal, setVersionModal] = useState<{ open: boolean; version?: ServiceContractVersion }>({ open: false });
  const [postModal, setPostModal] = useState<{ open: boolean; post?: ServicePost }>({ open: false });
  const [allocatingPost, setAllocatingPost] = useState<ServicePost>();
  const [endingAllocation, setEndingAllocation] = useState<PostAllocation>();
  const [transferringAllocation, setTransferringAllocation] = useState<PostAllocation>();
  const [showPastFor, setShowPastFor] = useState<Record<string, boolean>>({});

  const {
    details, saveContract, isSavingContract, saveVersion, isSavingVersion, savePost, isSavingPost,
    allocateEmployee, isAllocating, endAllocation, isEndingAllocation, transferAllocation, isTransferring,
  } = useContractDetails(id);
  const { overview: peopleDocs } = usePeopleDocs();
  const { employees } = useEmployees({});
  const today = todayIso();

  const data = details.data;
  const absentEmployeeIds = useMemo(() => getAbsentEmployeeIds(data?.absences || [], today), [data, today]);
  const coverageByPost = useMemo(() => new Map((data?.posts || []).map((post) => [post.id, getPostCoverage(post, data?.allocations || [], today, absentEmployeeIds)])), [data, today, absentEmployeeIds]);
  const transferDestinations = useMemo(() => {
    const contractTitles = new Map((peopleDocs.data?.contracts || []).map((item) => [item.id, item.title]));
    const source = peopleDocs.data?.posts || (data?.posts || []).map((post) => ({ ...post, contractId: post.contractId }));
    return source
      .filter((post) => post.status === 'active')
      .map((post) => ({ id: post.id, name: post.name, jobFunction: post.jobFunction, contractTitle: contractTitles.get(post.contractId) || data?.contract.title || '' }));
  }, [peopleDocs.data, data]);

  if (details.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-700" /></div>;
  if (details.isError || !data) {
    return <div role="alert" className="rounded-2xl border border-red-100 bg-white p-10 text-center dark:border-red-500/15 dark:bg-[#1a1d27]"><h1 className="font-bold text-gray-900 dark:text-white">Contrato não encontrado.</h1><button type="button" onClick={() => navigate('/contratos')} className="mt-4 text-sm font-semibold text-cyan-700">Voltar para contratos</button></div>;
  }

  const { contract, versions, posts, allocations, absences, audit } = data;
  const absenceOf = (employeeId: string) => absences.find((absence) => absence.employeeId === employeeId && absence.startDate <= today && absence.endDate >= today)
    || absences.find((absence) => absence.employeeId === employeeId && absence.startDate > today);
  const validity = getContractValidity(contract, today);
  const activePosts = posts.filter((post) => post.status === 'active');
  const coverages = activePosts.map((post) => coverageByPost.get(post.id)!);
  const totals = {
    required: coverages.reduce((sum, coverage) => sum + coverage.required, 0),
    holders: coverages.reduce((sum, coverage) => sum + coverage.holders, 0),
    absentHolders: coverages.reduce((sum, coverage) => sum + coverage.absentHolders, 0),
    substitutes: coverages.reduce((sum, coverage) => sum + coverage.substitutes, 0),
    uncovered: coverages.reduce((sum, coverage) => sum + coverage.uncovered, 0),
  };
  const hasOriginal = versions.some((version) => version.kind === 'original');
  const openAllocations = (postId: string) => allocations.filter((allocation) => allocation.postId === postId && (!allocation.endDate || allocation.endDate >= today));
  const pastAllocations = (postId: string) => allocations.filter((allocation) => allocation.postId === postId && allocation.endDate && allocation.endDate < today);

  return (
    <div className="space-y-5 animate-fade-in">
      <button type="button" onClick={() => navigate('/contratos')} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"><ArrowLeft className="h-4 w-4" />Contratos</button>
      <PageHeader title={contract.title} subtitle={`${contract.clientName}${contract.contractNumber ? ` · Nº ${contract.contractNumber}` : ''}`} action={<button type="button" onClick={() => setEditingContract(true)} className={primaryButtonClass}><Pencil className="h-4 w-4" />Editar contrato</button>} />

      <section className={`${cardClass} flex flex-wrap items-center gap-3`}>
        <ContractStatusBadge status={contract.status} />
        <ValidityBadge validity={validity} />
        <span className="text-sm text-gray-500">{periodText(contract.startDate, contract.endDate) || 'Período não informado'}</span>
        {contract.validationStatus === 'pending' && <span className="w-full text-xs text-amber-700 dark:text-amber-300">Confira as datas no contrato assinado e marque a vigência como conferida para ativar o contrato.</span>}
      </section>

      <nav aria-label="Seções do contrato" className="flex overflow-x-auto border-b border-gray-200 dark:border-white/10">
        {tabs.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} aria-current={tab === item.key ? 'page' : undefined} className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${tab === item.key ? 'border-cyan-700 text-cyan-700 dark:text-cyan-300' : 'border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white'}`}><item.icon className="h-4 w-4" />{item.label}</button>)}
      </nav>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <section className={`${cardClass} lg:col-span-2`}>
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Dados do contrato</h3>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FieldValue label="Cliente (tomador)">{contract.clientName}{contract.customerName && contract.customerName !== contract.clientName ? ` · cadastro: ${contract.customerName}` : ''}</FieldValue>
              <FieldValue label="Local de execução">{contract.location}</FieldValue>
              <FieldValue label="Vigência">{periodText(contract.startDate, contract.endDate)}</FieldValue>
              <FieldValue label="Situação da vigência">{VALIDATION_STATUS_LABELS[contract.validationStatus]}</FieldValue>
              <FieldValue label="Convenção coletiva (referência)">{contract.cctReference}</FieldValue>
              <FieldValue label="Documentos"><SafeLink url={contract.sourceDocumentsUrl} label="Abrir pasta de documentos" /></FieldValue>
              <div className="sm:col-span-2"><FieldValue label="Escopo">{contract.scopeSummary}</FieldValue></div>
              <div className="sm:col-span-2"><FieldValue label="Observações internas">{contract.internalNotes}</FieldValue></div>
            </dl>
          </section>
          <section className={cardClass}>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Cobertura hoje</h3>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <FieldValue label="Postos ativos">{String(activePosts.length)}</FieldValue>
              <FieldValue label="Vagas previstas">{String(totals.required)}</FieldValue>
              <FieldValue label="Titulares em serviço">{String(totals.holders)}{totals.absentHolders ? ` (+${totals.absentHolders} em férias/afastamento)` : ''}</FieldValue>
              <FieldValue label="Substitutos">{String(totals.substitutes)}</FieldValue>
            </dl>
            <p className={`mt-4 text-sm font-semibold ${totals.uncovered ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-300'}`}>{activePosts.length === 0 ? 'Nenhum posto ativo cadastrado.' : totals.uncovered ? `${totals.uncovered} vaga(s) descoberta(s)` : 'Todas as vagas cobertas'}</p>
            <button type="button" onClick={() => setTab('posts')} className={`${secondaryButtonClass} mt-4 w-full`}>Ver postos</button>
          </section>
        </div>
      )}

      {tab === 'posts' && (
        <section className="space-y-4">
          <div className="flex justify-end"><button type="button" onClick={() => setPostModal({ open: true })} className={primaryButtonClass}><Plus className="h-4 w-4" />Cadastrar posto</button></div>
          {posts.length === 0 ? (
            <div className={`${cardClass} py-10 text-center text-sm text-gray-500`}>Nenhum posto cadastrado neste contrato.</div>
          ) : posts.map((post) => {
            const coverage = coverageByPost.get(post.id)!;
            const current = openAllocations(post.id);
            const past = pastAllocations(post.id);
            return (
              <article key={post.id} className={cardClass} aria-label={`Posto ${post.name}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{post.name}</h3>
                    <p className="text-sm text-gray-500">{post.jobFunction} · {post.workSchedule}</p>
                    <p className="mt-1 text-xs text-gray-400">Responsável: {post.operationalManagerName || 'não informado'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CoverageBadge coverage={coverage} />
                    <span className="text-xs text-gray-500">{coverage.holders}/{coverage.required} titular(es) em serviço{coverage.absentHolders ? ` · ${coverage.absentHolders} em férias/afastamento` : ''}{coverage.substitutes ? ` · ${coverage.substitutes} substituto(s)` : ''}</span>
                  </div>
                </div>
                {post.requirements && <p className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300"><span className="font-semibold">Requisitos:</span> {post.requirements}</p>}

                <div className="mt-4 border-t border-gray-100 pt-3 dark:border-white/5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Alocados</h4>
                  {current.length === 0 ? <p className="mt-2 text-sm text-gray-500">Ninguém alocado.</p> : (
                    <ul className="mt-2 divide-y divide-gray-100 dark:divide-white/5">
                      {current.map((allocation) => (
                        <li key={allocation.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <span className="text-sm"><span className="font-semibold text-gray-900 dark:text-white">{allocation.employeeName}</span><span className="text-gray-500"> · {ALLOCATION_ROLE_LABELS[allocation.allocationRole]} · desde {formatDate(allocation.startDate)}</span>{allocation.endDate && <span className="text-amber-700 dark:text-amber-300"> · até {formatDate(allocation.endDate)}</span>}{allocation.startDate > today && <span className="text-blue-700 dark:text-blue-300"> · começa em breve</span>}{(() => {
                            const absence = absenceOf(allocation.employeeId);
                            if (!absence) return null;
                            return absence.startDate <= today
                              ? <span className="font-semibold text-amber-700 dark:text-amber-300"> · {ABSENCE_KIND_LABELS[absence.kind]} até {formatDate(absence.endDate)}</span>
                              : <span className="text-gray-500"> · {ABSENCE_KIND_LABELS[absence.kind]} a partir de {formatDate(absence.startDate)}</span>;
                          })()}</span>
                          {!allocation.endDate && (
                            <span className="flex flex-wrap gap-1">
                              {allocation.startDate < today && <button type="button" onClick={() => setTransferringAllocation(allocation)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-cyan-500/10"><ArrowRightLeft className="h-3.5 w-3.5" />Transferir</button>}
                              <button type="button" onClick={() => navigate(`/documentacao?funcionario=${allocation.employeeId}`)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-cyan-500/10"><FileCheck2 className="h-3.5 w-3.5" />Documentos</button>
                              <button type="button" onClick={() => setEndingAllocation(allocation)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-red-500/10"><UserMinus className="h-3.5 w-3.5" />Encerrar</button>
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {past.length > 0 && (
                    <div className="mt-2">
                      <button type="button" onClick={() => setShowPastFor((state) => ({ ...state, [post.id]: !state[post.id] }))} className="text-xs font-semibold text-gray-500 hover:text-cyan-700">{showPastFor[post.id] ? 'Ocultar' : 'Ver'} alocações encerradas ({past.length})</button>
                      {showPastFor[post.id] && <ul className="mt-2 space-y-1">{past.map((allocation) => <li key={allocation.id} className="text-xs text-gray-500">{allocation.employeeName} · {ALLOCATION_ROLE_LABELS[allocation.allocationRole]} · {formatDate(allocation.startDate)} até {formatDate(allocation.endDate)}{allocation.endReason ? ` · ${allocation.endReason}` : ''}</li>)}</ul>}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" disabled={post.status !== 'active'} title={post.status !== 'active' ? 'Ative o posto para alocar' : undefined} onClick={() => setAllocatingPost(post)} className={primaryButtonClass}><UserPlus className="h-4 w-4" />Alocar funcionário</button>
                  <button type="button" onClick={() => setPostModal({ open: true, post })} className={secondaryButtonClass}><Pencil className="h-4 w-4" />Editar posto</button>
                  <button type="button" disabled={post.status !== 'active'} onClick={() => navigate(`/demandas?nova=reposicao&posto=${post.id}`)} className={secondaryButtonClass}><UserRoundSearch className="h-4 w-4" />Abrir demanda de reposição</button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {tab === 'versions' && (
        <section className="space-y-3">
          <div className="flex justify-end"><button type="button" onClick={() => setVersionModal({ open: true })} className={primaryButtonClass}><Plus className="h-4 w-4" />{hasOriginal ? 'Registrar aditivo' : 'Registrar instrumento original'}</button></div>
          {versions.length === 0 ? <div className={`${cardClass} py-10 text-center text-sm text-gray-500`}>Nenhuma versão registrada. Comece pelo instrumento original.</div> : versions.map((version) => (
            <article key={version.id} className={`${cardClass} flex flex-wrap items-start justify-between gap-3`}>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Versão {version.versionNumber} · {VERSION_KIND_LABELS[version.kind]}</p>
                <h3 className="font-bold text-gray-900 dark:text-white">{version.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{periodText(version.effectiveStart, version.effectiveEnd) || 'Vigência não informada'}{version.signedAt ? ` · assinado em ${formatDate(version.signedAt)}` : ''}</p>
                {version.changeSummary && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{version.changeSummary}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs"><span className="text-gray-500">{VALIDATION_STATUS_LABELS[version.validationStatus]}</span><SafeLink url={version.documentUrl} label="Abrir documento" /></div>
              </div>
              <button type="button" onClick={() => setVersionModal({ open: true, version })} className={secondaryButtonClass}><Pencil className="h-4 w-4" />Editar</button>
            </article>
          ))}
        </section>
      )}

      {tab === 'history' && (
        <section className={cardClass}>
          {audit.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">Nenhum evento registrado.</p> : (
            <ol className="space-y-4">
              {audit.map((event) => (
                <li key={event.id} className="relative border-l-2 border-cyan-100 pl-5 dark:border-cyan-400/20">
                  <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-cyan-600" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{CONTRACT_AUDIT_EVENT_LABELS[event.eventType] || event.eventType}</h3>
                  <p className="mt-1 text-xs text-gray-500">{event.actorName} · {new Date(event.createdAt).toLocaleString('pt-BR')}</p>
                  {event.changedFields.length > 0 && <p className="mt-1 text-[11px] text-gray-400">Campos: {event.changedFields.map((field) => CONTRACT_FIELD_LABELS[field] || field).join(', ')}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      <ContractModal isOpen={editingContract} contract={contract} isLoading={isSavingContract} onClose={() => setEditingContract(false)} onSave={async (input) => { await saveContract(input); setEditingContract(false); }} />
      <VersionModal isOpen={versionModal.open} version={versionModal.version} hasOriginal={hasOriginal} isLoading={isSavingVersion} onClose={() => setVersionModal({ open: false })} onSave={async (input) => { await saveVersion({ input, versionId: versionModal.version?.id }); setVersionModal({ open: false }); }} />
      <PostModal isOpen={postModal.open} post={postModal.post} employees={employees} isLoading={isSavingPost} onClose={() => setPostModal({ open: false })} onSave={async (input) => { await savePost({ input, postId: postModal.post?.id }); setPostModal({ open: false }); }} />
      <AllocationModal isOpen={Boolean(allocatingPost)} post={allocatingPost} employees={employees} allocatedEmployeeIds={allocatingPost ? openAllocations(allocatingPost.id).map((allocation) => allocation.employeeId) : []} isLoading={isAllocating} onClose={() => setAllocatingPost(undefined)} onSave={async (input) => { await allocateEmployee(input); setAllocatingPost(undefined); }} />
      <TransferAllocationModal allocation={transferringAllocation} destinations={transferDestinations} isLoading={isTransferring} onClose={() => setTransferringAllocation(undefined)} onSave={async (input) => { await transferAllocation(input); setTransferringAllocation(undefined); }} />
      <EndAllocationModal allocation={endingAllocation} isLoading={isEndingAllocation} onClose={() => setEndingAllocation(undefined)} onSave={async (input) => { await endAllocation(input); setEndingAllocation(undefined); }} />
    </div>
  );
};
