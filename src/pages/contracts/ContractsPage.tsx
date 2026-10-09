import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, AlertTriangle, CalendarClock, Eye, FileSignature, Pencil, Plus, RefreshCw, Search, ShieldAlert, X } from 'lucide-react';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { HowToPanel } from '@/components/shared/HowToPanel';
import { useContracts } from '@/hooks/useContracts';
import { ContractListItem } from '@/services/contractsService';
import { ContractValidationStatus, ServiceContractStatus } from '@/types';
import { CONTRACT_STATUS_LABELS, formatDate, getContractValidity, VALIDATION_STATUS_LABELS } from './contractsDomain';
import { ContractModal } from './components/ContractModal';
import { cardClass, ContractStatusBadge, primaryButtonClass, ValidityBadge } from './components/ContractPrimitives';

const selectClass = 'rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/20 dark:border-white/10 dark:bg-[#1a1d27] dark:text-gray-200';
const iconButtonClass = 'rounded-lg p-2 text-gray-400 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-cyan-400/10';

const period = (contract: ContractListItem) =>
  contract.startDate || contract.endDate ? `${formatDate(contract.startDate)} até ${formatDate(contract.endDate)}` : 'Período não informado';

const Coverage = ({ contract }: { contract: ContractListItem }) => {
  if (contract.activePosts === 0) return <span className="text-xs text-gray-400">Sem postos ativos</span>;
  return (
    <span className="text-sm">
      <span className="block font-medium text-gray-800 dark:text-gray-200">{contract.activePosts} posto(s) · {contract.requiredHeadcount} vaga(s)</span>
      {contract.uncoveredPositions > 0
        ? <span className="block text-xs font-semibold text-red-600 dark:text-red-400">{contract.uncoveredPositions} vaga(s) descoberta(s)</span>
        : contract.postsCoveredBySubstitute > 0
          ? <span className="block text-xs font-semibold text-amber-700 dark:text-amber-300">{contract.postsCoveredBySubstitute} posto(s) com substituto</span>
          : <span className="block text-xs text-emerald-700 dark:text-emerald-300">Todos cobertos</span>}
    </span>
  );
};

export const ContractsPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<ServiceContractStatus | 'all'>('all');
  const [validationStatus, setValidationStatus] = useState<ContractValidationStatus | 'all'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selected, setSelected] = useState<ContractListItem>();

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search), 250); return () => clearTimeout(timer); }, [search]);
  const { contracts, isLoading, isError, refetch, saveContract, isSaving } = useContracts({ search: debouncedSearch, status, validationStatus });

  const summary = useMemo(() => {
    const validities = contracts.map((contract) => ({ contract, validity: getContractValidity(contract) }));
    return {
      active: contracts.filter((contract) => contract.status === 'active').length,
      expiring: validities.filter(({ contract, validity }) => contract.status === 'active' && (validity.kind === 'expiring' || validity.kind === 'expired')).length,
      unconfirmed: contracts.filter((contract) => contract.validationStatus === 'pending').length,
      uncovered: contracts.reduce((total, contract) => total + contract.uncoveredPositions, 0),
    };
  }, [contracts]);

  const isFiltered = Boolean(search || status !== 'all' || validationStatus !== 'all');
  const clearFilters = () => { setSearch(''); setStatus('all'); setValidationStatus('all'); };
  const openCreate = () => { setSelected(undefined); setIsModalOpen(true); };
  const openEdit = (contract: ContractListItem) => { setSelected(contract); setIsModalOpen(true); };
  const openDetail = (contract: ContractListItem) => navigate(`/contratos/${contract.id}`);

  const columns = [
    { key: 'contract', label: 'Contrato', render: (row: ContractListItem) => <button type="button" onClick={() => openDetail(row)} className="rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"><span className="block font-semibold text-gray-900 dark:text-white">{row.title}</span><span className="block text-xs text-gray-400">{row.clientName}{row.contractNumber ? ` · Nº ${row.contractNumber}` : ''}</span></button> },
    { key: 'period', label: 'Vigência', render: (row: ContractListItem) => <span><span className="block text-xs text-gray-500">{period(row)}</span><span className="mt-1 block"><ValidityBadge validity={getContractValidity(row)} /></span></span> },
    { key: 'status', label: 'Status', render: (row: ContractListItem) => <ContractStatusBadge status={row.status} /> },
    { key: 'coverage', label: 'Postos', render: (row: ContractListItem) => <Coverage contract={row} /> },
    { key: 'actions', label: 'Ações', render: (row: ContractListItem) => <div className="flex items-center gap-1"><button type="button" title="Visualizar" aria-label={`Visualizar ${row.title}`} onClick={() => openDetail(row)} className={iconButtonClass}><Eye className="h-4 w-4" /></button><button type="button" title="Editar" aria-label={`Editar ${row.title}`} onClick={() => openEdit(row)} className={iconButtonClass}><Pencil className="h-4 w-4" /></button></div> },
  ];

  const summaryCards = [
    { label: 'Contratos ativos', value: summary.active, icon: FileSignature, tone: 'text-cyan-700 dark:text-cyan-300' },
    { label: 'Ativos vencendo ou vencidos', value: summary.expiring, icon: CalendarClock, tone: summary.expiring ? 'text-amber-600 dark:text-amber-300' : 'text-gray-400' },
    { label: 'Vigência a confirmar', value: summary.unconfirmed, icon: ShieldAlert, tone: summary.unconfirmed ? 'text-amber-600 dark:text-amber-300' : 'text-gray-400' },
    { label: 'Vagas descobertas hoje', value: summary.uncovered, icon: AlertTriangle, tone: summary.uncovered ? 'text-red-600 dark:text-red-400' : 'text-gray-400' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Contratos" subtitle="Contratos de serviço, postos de trabalho e quem está alocado em cada um." action={<button type="button" onClick={openCreate} className={primaryButtonClass}><Plus className="h-4 w-4" />Cadastrar contrato</button>} />
      <HowToPanel
        id="contratos"
        steps={[
          'Cadastre o contrato com o arquivo de origem e a vigência. Ele só fica ativo depois que a vigência for conferida.',
          'Registre aditivos na aba Versões; o histórico nunca é sobrescrito.',
          'Na aba Postos, cadastre cada posto com função, escala e quantidade, e aloque titulares e substitutos.',
          'Posto descoberto aparece em vermelho. Abra a demanda de reposição direto do posto.',
        ]}
      />

      <p className="rounded-xl border border-cyan-100 bg-cyan-50/60 px-4 py-3 text-xs text-cyan-900 dark:border-cyan-400/15 dark:bg-cyan-400/5 dark:text-cyan-100">
        As datas e regras vêm do que o gestor informa. O sistema não interpreta convenções coletivas nem declara conformidade trabalhista.
      </p>

      {!isError && (
        <section aria-label="Resumo dos contratos" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className={`${cardClass} !p-4`}>
              <card.icon className={`h-5 w-5 ${card.tone}`} />
              <p className={`mt-2 text-2xl font-bold ${card.tone}`}>{isLoading ? '—' : card.value}</p>
              <p className="text-xs text-gray-500">{card.label}</p>
            </div>
          ))}
        </section>
      )}

      <section aria-label="Filtros de contratos" className={`${cardClass} !p-4`}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <label className="relative md:col-span-2"><span className="sr-only">Buscar contratos</span><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título, cliente, número ou local" className={`${selectClass} w-full pl-9`} /></label>
          <select aria-label="Filtrar por status" value={status} onChange={(event) => setStatus(event.target.value as ServiceContractStatus | 'all')} className={selectClass}><option value="all">Todos os status</option>{Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <select aria-label="Filtrar por situação da vigência" value={validationStatus} onChange={(event) => setValidationStatus(event.target.value as ContractValidationStatus | 'all')} className={selectClass}><option value="all">Toda situação de vigência</option>{Object.entries(VALIDATION_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </div>
        {isFiltered && <button type="button" onClick={clearFilters} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"><X className="h-3.5 w-3.5" />Limpar filtros</button>}
      </section>

      {isError ? (
        <div role="alert" className="flex flex-col items-center rounded-2xl border border-red-100 bg-white px-6 py-12 text-center dark:border-red-500/15 dark:bg-[#1a1d27]"><AlertCircle className="mb-3 h-9 w-9 text-red-500" /><h2 className="font-bold text-gray-900 dark:text-white">Não foi possível carregar os contratos.</h2><button type="button" onClick={() => refetch()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold dark:border-white/10"><RefreshCw className="h-4 w-4" />Tentar novamente</button></div>
      ) : !isLoading && contracts.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm dark:border-white/5 dark:bg-[#1a1d27]">
          <div className="mb-4 rounded-full bg-cyan-50 p-4 text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-300">{isFiltered ? <Search className="h-8 w-8" /> : <FileSignature className="h-8 w-8" />}</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{isFiltered ? 'Nenhum contrato encontrado.' : 'Nenhum contrato cadastrado.'}</h2>
          <p className="mt-1 max-w-md text-sm text-gray-500">{isFiltered ? 'Tente ajustar a busca ou limpar os filtros.' : 'Cadastre o primeiro contrato para organizar postos, escalas e alocações.'}</p>
          {!isFiltered && <button type="button" onClick={openCreate} className={`${primaryButtonClass} mt-5`}><Plus className="h-4 w-4" />Cadastrar primeiro contrato</button>}
        </div>
      ) : (
        <>
          <div className="hidden md:block"><DataTable columns={columns} data={contracts} isLoading={isLoading} /></div>
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {isLoading ? Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-2xl bg-gray-100 dark:bg-white/5" />) : contracts.map((contract) => (
              <article key={contract.id} className={`${cardClass} !p-4`}>
                <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-gray-900 dark:text-white">{contract.title}</h2><p className="text-xs text-gray-500">{contract.clientName}</p></div><ContractStatusBadge status={contract.status} /></div>
                <div className="mt-3 space-y-2"><p className="text-xs text-gray-500">{period(contract)}</p><ValidityBadge validity={getContractValidity(contract)} /><Coverage contract={contract} /></div>
                <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3 dark:border-white/5"><button type="button" onClick={() => openDetail(contract)} className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold dark:border-white/10">Visualizar</button><button type="button" onClick={() => openEdit(contract)} className="flex-1 rounded-xl bg-cyan-700 px-3 py-2 text-xs font-semibold text-white">Editar</button></div>
              </article>
            ))}
          </div>
        </>
      )}

      <ContractModal isOpen={isModalOpen} contract={selected} isLoading={isSaving} onClose={() => setIsModalOpen(false)} onSave={async (input) => { await saveContract({ input, id: selected?.id }); setIsModalOpen(false); }} />
    </div>
  );
};
