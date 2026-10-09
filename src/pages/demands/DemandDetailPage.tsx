import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Ban, CheckCircle2, ExternalLink, Link2, Loader2, MessageSquare, Pencil, Undo2, UserCog } from 'lucide-react';
import { z } from 'zod';
import { PageHeader } from '@/components/shared/PageHeader';
import { useDemandDetails, useDemandLinkOptions } from '@/hooks/useDemands';
import { FieldValue } from '@/pages/people/components/PeoplePrimitives';
import { useAuthStore } from '@/store/authStore';
import { DemandStage } from '@/types';
import { commentSchema, evidenceSchema } from './demandSchemas';
import {
  activeStages,
  checkTransition,
  DEMAND_EVENT_LABELS,
  DEMAND_FIELD_LABELS,
  formatDate,
  getNextStage,
  getPreviousStages,
  isSafeHttpsUrl,
  todayIso,
} from './demandsDomain';
import { AssignModal, DemandEditModal, ReasonModal } from './components/DemandFormModals';
import { cardClass, inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/pages/contracts/components/ContractPrimitives';
import { DemandStatusBadge, DueBadge, FieldError, PriorityBadge } from './components/DemandPrimitives';

type CommentForm = z.infer<typeof commentSchema>;
type EvidenceForm = z.infer<typeof evidenceSchema>;

const dateTime = (value: string) => new Date(value).toLocaleString('pt-BR');

export const DemandDetailPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const profileId = useAuthStore((state) => state.profile?.id);
  const today = todayIso();
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [returningTo, setReturningTo] = useState<DemandStage>();
  const [returnStageId, setReturnStageId] = useState('');

  const {
    details, updateDemand, isUpdating, assignDemand, isAssigning, moveDemand, isMoving,
    cancelDemand, isCanceling, addComment, isCommenting, addEvidence, isAddingEvidence,
  } = useDemandDetails(id);
  const { options } = useDemandLinkOptions();

  const commentForm = useForm<CommentForm>({ resolver: zodResolver(commentSchema), defaultValues: { body: '' } });
  const evidenceForm = useForm<EvidenceForm>({ resolver: zodResolver(evidenceSchema), defaultValues: { label: '', url: '' } });

  if (details.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-700" /></div>;
  if (details.isError || !details.data) {
    return <div role="alert" className="rounded-2xl border border-red-100 bg-white p-10 text-center dark:border-red-500/15 dark:bg-[#1a1d27]"><h1 className="font-bold text-gray-900 dark:text-white">Demanda não encontrada.</h1><button type="button" onClick={() => navigate('/demandas')} className="mt-4 text-sm font-semibold text-cyan-700">Voltar para demandas</button></div>;
  }

  const { demand, type, comments, evidences, events } = details.data;
  const isOpen = demand.status === 'open';
  const stages = activeStages(type.stages);
  const currentStage = type.stages.find((stage) => stage.id === demand.stageId);
  const next = getNextStage(type.stages, demand.stageId);
  const nextCheck = next ? checkTransition(demand, type.stages, next.id, profileId) : undefined;
  const previous = getPreviousStages(type.stages, demand.stageId);
  const isReview = currentStage?.category === 'review';

  return (
    <div className="space-y-5 animate-fade-in">
      <button type="button" onClick={() => navigate('/demandas')} className="inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"><ArrowLeft className="h-4 w-4" />Demandas</button>
      <PageHeader
        title={`#${demand.demandNumber} · ${demand.title}`}
        subtitle={`${type.name} · aberta em ${dateTime(demand.createdAt)}`}
        action={isOpen ? <button type="button" onClick={() => setEditing(true)} className={secondaryButtonClass}><Pencil className="h-4 w-4" />Editar</button> : undefined}
      />

      <section aria-label="Situação da demanda" className={`${cardClass} space-y-4`}>
        <div className="flex flex-wrap items-center gap-2">
          <DemandStatusBadge status={demand.status} />
          <PriorityBadge priority={demand.priority} />
          <DueBadge demand={demand} today={today} />
        </div>
        <ol aria-label="Etapas do fluxo" className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {stages.map((stage, index) => {
            const isCurrent = stage.id === demand.stageId;
            const isPast = currentStage ? stage.position < currentStage.position : false;
            return (
              <li key={stage.id} aria-current={isCurrent ? 'step' : undefined} className="flex items-center gap-2">
                <span className={`rounded-full px-3 py-1 ${isCurrent ? 'bg-cyan-700 text-white' : isPast ? 'bg-cyan-50 text-cyan-800 dark:bg-cyan-500/10 dark:text-cyan-200' : 'bg-gray-100 text-gray-500 dark:bg-white/5'}`}>{stage.name}</span>
                {index < stages.length - 1 && <ArrowRight className="h-3 w-3 text-gray-300" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        {isOpen && (
          <div className="flex flex-wrap items-start gap-3 border-t border-gray-100 pt-4 dark:border-white/5">
            {next && (
              <div>
                <button
                  type="button"
                  disabled={!nextCheck?.allowed || isMoving}
                  onClick={() => moveDemand({ toStageId: next.id }).catch(() => undefined)}
                  className={primaryButtonClass}
                >
                  {isMoving ? <Loader2 className="h-4 w-4 animate-spin" /> : next.category === 'done' ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  {next.category === 'done' ? 'Aprovar conferência e encerrar' : `Avançar para ${next.name}`}
                </button>
                {nextCheck && !nextCheck.allowed && <p className="mt-1 max-w-sm text-xs text-amber-700 dark:text-amber-300">{nextCheck.reason}</p>}
              </div>
            )}
            {previous.length > 0 && (
              <div className="flex items-center gap-2">
                <select aria-label="Etapa para devolver" value={returnStageId} onChange={(event) => setReturnStageId(event.target.value)} className={`${inputClass} w-44`}>
                  <option value="">{isReview ? 'Devolver para…' : 'Voltar para…'}</option>
                  {previous.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
                </select>
                <button type="button" disabled={!returnStageId} onClick={() => setReturningTo(previous.find((stage) => stage.id === returnStageId))} className={secondaryButtonClass}><Undo2 className="h-4 w-4" />Devolver</button>
              </div>
            )}
            <button type="button" onClick={() => setCanceling(true)} className="ml-auto inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-500/10"><Ban className="h-4 w-4" />Cancelar demanda</button>
          </div>
        )}
        {demand.status === 'closed' && <p className="border-t border-gray-100 pt-4 text-sm text-emerald-700 dark:border-white/5 dark:text-emerald-300">Conferida por {demand.approvedByName || 'aprovador'} em {demand.approvedAt ? dateTime(demand.approvedAt) : formatDate(demand.closedAt)}.</p>}
        {demand.status === 'canceled' && <p className="border-t border-gray-100 pt-4 text-sm text-gray-600 dark:border-white/5 dark:text-gray-300">Cancelada em {demand.closedAt ? dateTime(demand.closedAt) : '—'}: {demand.cancelReason}</p>}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className={cardClass}>
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Dados da demanda</h3>
            <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><FieldValue label="Descrição">{demand.description}</FieldValue></div>
              <FieldValue label="Contrato">{demand.contractId ? <Link to={`/contratos/${demand.contractId}`} className="font-semibold text-cyan-700 hover:underline dark:text-cyan-300">{demand.contractTitle || 'Abrir contrato'}</Link> : undefined}</FieldValue>
              <FieldValue label="Posto">{demand.postName}</FieldValue>
              <FieldValue label="Funcionário">{demand.employeeName}</FieldValue>
              <FieldValue label="Prazo">{demand.dueDate ? formatDate(demand.dueDate) : undefined}</FieldValue>
            </dl>
          </section>

          <section className={cardClass} aria-label="Evidências">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white"><Link2 className="h-4 w-4" />Evidências ({evidences.length})</h3>
            {evidences.length === 0 ? <p className="text-sm text-gray-500">Nenhuma evidência anexada.</p> : (
              <ul className="divide-y divide-gray-100 dark:divide-white/5">
                {evidences.map((evidence) => (
                  <li key={evidence.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {isSafeHttpsUrl(evidence.url)
                        ? <a href={evidence.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-cyan-700 hover:underline dark:text-cyan-300">{evidence.label}<ExternalLink className="h-3.5 w-3.5" /></a>
                        : <span className="font-semibold text-gray-900 dark:text-white">{evidence.label}</span>}
                    </span>
                    <span className="text-xs text-gray-500">{evidence.addedByName} · {evidence.stageName ? `${evidence.stageName} · ` : ''}{dateTime(evidence.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
            {isOpen && (
              <form
                noValidate
                className="mt-4 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 dark:border-white/5 sm:grid-cols-[1fr_1.4fr_auto]"
                onSubmit={evidenceForm.handleSubmit(async (values) => { await addEvidence(values).then(() => evidenceForm.reset({ label: '', url: '' })).catch(() => undefined); })}
              >
                <label><span className={labelClass}>Descrição</span><input className={inputClass} placeholder="Ex.: ASO admissional" {...evidenceForm.register('label')} /><FieldError message={evidenceForm.formState.errors.label?.message} /></label>
                <label><span className={labelClass}>Link (https)</span><input className={inputClass} placeholder="https://drive.google.com/…" {...evidenceForm.register('url')} /><FieldError message={evidenceForm.formState.errors.url?.message} /></label>
                <button type="submit" disabled={isAddingEvidence} className={`${secondaryButtonClass} self-end`}>Anexar</button>
              </form>
            )}
          </section>

          <section className={cardClass} aria-label="Comentários">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white"><MessageSquare className="h-4 w-4" />Comentários ({comments.length})</h3>
            {comments.length === 0 ? <p className="text-sm text-gray-500">Nenhum comentário.</p> : (
              <ul className="space-y-3">
                {comments.map((comment) => (
                  <li key={comment.id} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-white/5">
                    <p className="whitespace-pre-line text-sm text-gray-800 dark:text-gray-100">{comment.body}</p>
                    <p className="mt-1 text-[11px] text-gray-500">{comment.authorName} · {dateTime(comment.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            <form
              noValidate
              className="mt-4 space-y-2 border-t border-gray-100 pt-4 dark:border-white/5"
              onSubmit={commentForm.handleSubmit(async (values) => { await addComment(values.body).then(() => commentForm.reset({ body: '' })).catch(() => undefined); })}
            >
              <label className="block"><span className="sr-only">Novo comentário</span><textarea rows={2} className={inputClass} placeholder="Registre o andamento, um retorno do DP ou uma pendência" {...commentForm.register('body')} /></label>
              <FieldError message={commentForm.formState.errors.body?.message} />
              <div className="flex justify-end"><button type="submit" disabled={isCommenting} className={secondaryButtonClass}>Comentar</button></div>
            </form>
          </section>
        </div>

        <div className="space-y-5">
          <section className={cardClass}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Responsabilidades</h3>
              {isOpen && <button type="button" onClick={() => setAssigning(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-cyan-700 hover:bg-cyan-500/10"><UserCog className="h-3.5 w-3.5" />Alterar</button>}
            </div>
            <dl className="space-y-4">
              <FieldValue label="Responsável (executa)">{demand.responsibleName}</FieldValue>
              <FieldValue label="Aprovador (confere)">{demand.approverName}</FieldValue>
            </dl>
          </section>

          <section className={cardClass} aria-label="Histórico">
            <h3 className="mb-4 text-sm font-bold text-gray-900 dark:text-white">Histórico</h3>
            {events.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">Nenhum evento registrado.</p> : (
              <ol className="space-y-4">
                {events.map((event) => (
                  <li key={event.id} className="relative border-l-2 border-cyan-100 pl-5 dark:border-cyan-400/20">
                    <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-cyan-600" />
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{DEMAND_EVENT_LABELS[event.eventType] || event.eventType}</h4>
                    {(event.fromStageName || event.toStageName) && event.eventType !== 'evidence_added' && <p className="text-xs text-gray-600 dark:text-gray-300">{event.fromStageName ? `${event.fromStageName} → ` : ''}{event.toStageName}</p>}
                    {event.note && <p className="mt-1 text-xs italic text-gray-600 dark:text-gray-300">“{event.note}”</p>}
                    {event.changedFields.length > 0 && event.eventType !== 'stage_changed' && event.eventType !== 'demand_closed' && <p className="mt-1 text-[11px] text-gray-400">Campos: {event.changedFields.map((field) => DEMAND_FIELD_LABELS[field] || field).join(', ')}</p>}
                    <p className="mt-1 text-[11px] text-gray-500">{event.actorName} · {dateTime(event.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      <DemandEditModal isOpen={editing} demand={demand} isLoading={isUpdating} onClose={() => setEditing(false)} onSave={async (input) => { await updateDemand(input); setEditing(false); }} />
      <AssignModal isOpen={assigning} demand={demand} people={options?.people || []} isLoading={isAssigning} onClose={() => setAssigning(false)} onSave={async (input) => { await assignDemand(input); setAssigning(false); }} />
      <ReasonModal
        isOpen={Boolean(returningTo)}
        title="Devolver demanda"
        subtitle={returningTo ? `A demanda volta para "${returningTo.name}".` : undefined}
        label="Motivo da devolução"
        submitLabel="Devolver"
        isLoading={isMoving}
        onClose={() => setReturningTo(undefined)}
        onSave={async (reason) => {
          if (!returningTo) return;
          await moveDemand({ toStageId: returningTo.id, note: reason });
          setReturningTo(undefined);
          setReturnStageId('');
        }}
      />
      <ReasonModal isOpen={canceling} title="Cancelar demanda" subtitle="A demanda sai do fluxo e o motivo fica no histórico." label="Motivo do cancelamento" submitLabel="Cancelar demanda" isLoading={isCanceling} onClose={() => setCanceling(false)} onSave={async (reason) => { await cancelDemand(reason); setCanceling(false); }} />
    </div>
  );
};
