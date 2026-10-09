import { ReactNode, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, ClipboardList, FileWarning, Loader2, ShieldAlert, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { HowToPanel } from '@/components/shared/HowToPanel';
import { getOperationalPanelSources } from '@/services/operationalPanelService';
import { cardClass } from '@/pages/contracts/components/ContractPrimitives';
import { ChecklistBadge } from '@/pages/peopleDocs/components/PeopleDocsPrimitives';
import { describeDue } from '@/pages/demands/demandsDomain';
import { describeItemDue, formatCompetence, formatDate } from '@/pages/obligations/obligationsDomain';
import { todayIso } from '@/pages/contracts/contractsDomain';
import { buildOperationalPanel } from './operationalPanelDomain';

const Metric = ({ label, value, tone = 'text-gray-900 dark:text-white' }: { label: string; value: number; tone?: string }) => (
  <div>
    <p className={`text-2xl font-bold ${value > 0 ? tone : 'text-gray-900 dark:text-white'}`}>{value}</p>
    <p className="text-xs text-gray-500">{label}</p>
  </div>
);

const Block = ({ title, icon: Icon, to, linkLabel, children }: { title: string; icon: typeof Users; to: string; linkLabel: string; children: ReactNode }) => (
  <section className={`${cardClass} space-y-4`} aria-label={title}>
    <div className="flex items-center justify-between gap-2">
      <h2 className="inline-flex items-center gap-2 font-bold text-gray-900 dark:text-white"><Icon className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />{title}</h2>
      <Link to={to} className="text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300">{linkLabel}</Link>
    </div>
    {children}
  </section>
);

const red = 'text-red-600 dark:text-red-400';
const amber = 'text-amber-600 dark:text-amber-300';
const blue = 'text-blue-700 dark:text-blue-300';

export const OperationalPanelPage = () => {
  const today = todayIso();
  const sources = useQuery({ queryKey: ['operational-panel'], queryFn: getOperationalPanelSources });
  const panel = useMemo(() => (sources.data ? buildOperationalPanel(sources.data, today) : undefined), [sources.data, today]);

  if (sources.isLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-cyan-700" /></div>;
  if (sources.isError || !panel) {
    return <div role="alert" className={`${cardClass} p-10 text-center`}><h1 className="font-bold text-gray-900 dark:text-white">Não foi possível carregar o painel operacional.</h1><button type="button" onClick={() => sources.refetch()} className="mt-4 text-sm font-semibold text-cyan-700">Tentar de novo</button></div>;
  }

  const allClear = panel.demands.overdue + panel.demands.dueToday + panel.coverage.uncoveredPositions + panel.documents.pending
    + panel.documents.expired + panel.obligations.overdue === 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Painel operacional" subtitle="O que pede ação hoje: demandas, postos descobertos, documentos e obrigações." />
      <HowToPanel
        id="painel-operacional"
        steps={[
          'Comece o dia por aqui: números em vermelho pedem ação imediata.',
          'Clique no item para abrir a tela em que ele é resolvido.',
          'Itens sem responsável aparecem destacados: defina um dono antes de cobrar o prazo.',
        ]}
      />
      {allClear && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Nada atrasado ou descoberto agora.</p>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Block title="Demandas" icon={ClipboardList} to="/demandas" linkLabel="Abrir demandas">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Abertas" value={panel.demands.open} />
            <Metric label="Atrasadas" value={panel.demands.overdue} tone={red} />
            <Metric label="Vencem hoje" value={panel.demands.dueToday} tone={amber} />
            <Metric label="Sem responsável" value={panel.demands.withoutResponsible} tone={amber} />
          </div>
          {panel.demands.attention.length > 0 && (
            <ul className="divide-y divide-gray-100 text-sm dark:divide-white/5" aria-label="Demandas que pedem ação">
              {panel.demands.attention.map((demand) => (
                <li key={demand.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link to={`/demandas/${demand.id}`} className="font-semibold text-gray-900 hover:underline dark:text-white">#{demand.demandNumber} {demand.title}</Link>
                  <span className="text-xs text-gray-500">{demand.responsibleName || <span className={`font-semibold ${amber}`}>Sem responsável</span>} · {describeDue(demand, today)}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Cobertura dos postos" icon={Users} to="/contratos" linkLabel="Abrir contratos">
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Vagas descobertas" value={panel.coverage.uncoveredPositions} tone={red} />
            <Metric label="Postos com substituto" value={panel.coverage.coveredBySubstitute} tone={amber} />
          </div>
          {panel.coverage.contracts.length > 0 && (
            <ul className="divide-y divide-gray-100 text-sm dark:divide-white/5" aria-label="Contratos com vagas descobertas">
              {panel.coverage.contracts.map((contract) => (
                <li key={contract.id} className="flex items-center justify-between gap-2 py-2">
                  <Link to={`/contratos/${contract.id}`} className="font-semibold text-gray-900 hover:underline dark:text-white">{contract.title}</Link>
                  <span className={`text-xs font-semibold ${red}`}>{contract.uncoveredPositions} vaga(s)</span>
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Documentos" icon={FileWarning} to="/documentacao" linkLabel="Abrir documentação">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Não entregues ou recusados" value={panel.documents.pending} tone={red} />
            <Metric label="Vencidos" value={panel.documents.expired} tone={red} />
            <Metric label="Vencem em 30 dias" value={panel.documents.expiring} tone={amber} />
            <Metric label="Aguardando conferência" value={panel.documents.awaitingReview} tone={blue} />
          </div>
          {panel.documents.attention.length > 0 && (
            <ul className="divide-y divide-gray-100 text-sm dark:divide-white/5" aria-label="Documentos que pedem ação">
              {panel.documents.attention.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link to={item.employeeId ? `/documentacao?funcionario=${item.employeeId}` : '/documentacao'} className="font-semibold text-gray-900 hover:underline dark:text-white">{item.requirement.name} · {item.targetName}</Link>
                  <ChecklistBadge state={item.state} />
                </li>
              ))}
            </ul>
          )}
        </Block>

        <Block title="Obrigações" icon={CalendarClock} to="/obrigacoes?aba=agenda" linkLabel="Abrir agenda">
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Atrasadas" value={panel.obligations.overdue} tone={red} />
            <Metric label="Vencem em 7 dias" value={panel.obligations.dueSoon} tone={amber} />
            <Metric label="Aguardando conferência" value={panel.obligations.awaitingReview} tone={blue} />
          </div>
          {panel.obligations.notOpened.length > 0 && (
            <p className="flex flex-wrap items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="h-3.5 w-3.5" />Competência {formatCompetence(panel.obligations.competence)} não aberta em:
              {panel.obligations.notOpened.map((contract, index) => (
                <Link key={contract.id} to={`/obrigacoes?contrato=${contract.id}&competencia=${panel.obligations.competence.slice(0, 7)}`} className="font-semibold underline">{contract.title}{index < panel.obligations.notOpened.length - 1 ? ',' : ''}</Link>
              ))}
            </p>
          )}
          {panel.obligations.readyToSend.length > 0 && (
            <p className="flex flex-wrap items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-500/10 dark:text-blue-200">
              <ShieldAlert className="h-3.5 w-3.5" />Pacotes prontos aguardando envio:
              {panel.obligations.readyToSend.map((period, index) => (
                <Link key={period.id} to={`/obrigacoes?contrato=${period.contractId}&competencia=${period.competence.slice(0, 7)}`} className="font-semibold underline">{period.contractTitle} {formatCompetence(period.competence)}{index < panel.obligations.readyToSend.length - 1 ? ',' : ''}</Link>
              ))}
            </p>
          )}
          {panel.obligations.attention.length > 0 && (
            <ul className="divide-y divide-gray-100 text-sm dark:divide-white/5" aria-label="Obrigações que pedem ação">
              {panel.obligations.attention.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link to={`/obrigacoes?contrato=${item.contractId}&competencia=${item.competence.slice(0, 7)}`} className="font-semibold text-gray-900 hover:underline dark:text-white">{item.name} · {item.contractTitle}</Link>
                  <span className={`text-xs ${item.dueState === 'overdue' ? `font-semibold ${red}` : amber}`}>{formatDate(item.dueDate)} · {describeItemDue(item, today)}{item.responsibleName ? '' : ' · sem responsável'}</span>
                </li>
              ))}
            </ul>
          )}
        </Block>
      </div>
    </div>
  );
};
