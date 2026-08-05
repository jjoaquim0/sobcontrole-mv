import { useState } from 'react';
import { AlertCircle, Check, Eye, Pencil, Plus, RefreshCw, Search, WalletCards, X, XCircle } from 'lucide-react';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { DataTable } from '@/components/shared/DataTable';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { useCommissions, useEmployees, useTeams } from '@/hooks/usePeople';
import { Commission, CommissionStatus } from '@/types';
import { AdministrativeNotice } from './components/AdministrativeNotice';
import { CommissionDetailsModal } from './components/CommissionDetailsModal';
import { CommissionModal } from './components/CommissionModal';
import { CommissionStatusBadge, EmployeeAvatar } from './components/PeoplePrimitives';
import { formatCurrency, formatReferencePeriod } from './peopleDomain';

const fieldClass = 'rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/20 dark:border-white/10 dark:bg-[#1a1d27] dark:text-gray-200';

export const CommissionsPage = () => {
  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [status, setStatus] = useState<CommissionStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editing, setEditing] = useState<Commission>();
  const [viewing, setViewing] = useState<Commission>();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [canceling, setCanceling] = useState<Commission>();
  const { employees } = useEmployees({});
  const { teams } = useTeams({});
  const {
    commissions, isLoading, isError, refetch, saveCommission, isSaving,
    updateStatus, isUpdatingStatus,
  } = useCommissions({ search, employeeId, teamId, status, dateFrom, dateTo });

  const isFiltered = Boolean(search || employeeId || teamId || status !== 'all' || dateFrom || dateTo);
  const clearFilters = () => {
    setSearch(''); setEmployeeId(''); setTeamId(''); setStatus('all'); setDateFrom(''); setDateTo('');
  };
  const pending = commissions.filter((item) => item.status === 'pending').length;
  const approved = commissions.filter((item) => item.status === 'approved').length;
  const paid = commissions.filter((item) => item.status === 'paid').length;
  const total = commissions.reduce((sum, item) => sum + item.grossAmount, 0);
  const openCreate = () => { setEditing(undefined); setIsFormOpen(true); };
  const openEdit = (commission: Commission) => { setEditing(commission); setIsFormOpen(true); };
  const actions = (row: Commission) => <div className="flex items-center gap-1">
    <button type="button" onClick={() => setViewing(row)} title="Visualizar" aria-label={`Visualizar comissão de ${row.employeeName}`} className="rounded-lg p-2 text-gray-400 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 dark:hover:bg-cyan-400/10"><Eye className="h-4 w-4" /></button>
    <button type="button" onClick={() => openEdit(row)} disabled={row.status === 'canceled'} title="Editar" aria-label={`Editar comissão de ${row.employeeName}`} className="rounded-lg p-2 text-gray-400 hover:bg-cyan-50 hover:text-cyan-700 focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-30 dark:hover:bg-cyan-400/10"><Pencil className="h-4 w-4" /></button>
    {row.status === 'pending' && <button type="button" onClick={() => updateStatus({ id: row.id, value: 'approved' })} title="Aprovar" aria-label={`Aprovar comissão de ${row.employeeName}`} className="rounded-lg p-2 text-blue-500 hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-400/10"><Check className="h-4 w-4" /></button>}
    {row.status === 'approved' && <button type="button" onClick={() => updateStatus({ id: row.id, value: 'paid' })} title="Marcar como paga" aria-label={`Marcar comissão de ${row.employeeName} como paga`} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:hover:bg-emerald-400/10"><WalletCards className="h-4 w-4" /></button>}
    {['pending', 'approved'].includes(row.status) && <button type="button" onClick={() => setCanceling(row)} title="Cancelar" aria-label={`Cancelar comissão de ${row.employeeName}`} className="rounded-lg p-2 text-orange-500 hover:bg-orange-50 focus-visible:ring-2 focus-visible:ring-orange-500 dark:hover:bg-orange-400/10"><XCircle className="h-4 w-4" /></button>}
  </div>;
  const columns = [
    { key: 'employee', label: 'Funcionário', render: (row: Commission) => <div className="flex items-center gap-3"><EmployeeAvatar name={row.employeeName} /><span className="font-semibold text-gray-900 dark:text-white">{row.employeeName}</span></div> },
    { key: 'team', label: 'Equipe', render: (row: Commission) => row.teamName || 'Sem equipe' },
    { key: 'description', label: 'Descrição / origem' },
    { key: 'referencePeriod', label: 'Período', render: (row: Commission) => formatReferencePeriod(row.referencePeriod) },
    { key: 'grossAmount', label: 'Valor registrado', render: (row: Commission) => <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(row.grossAmount)}</span> },
    { key: 'status', label: 'Status', render: (row: Commission) => <CommissionStatusBadge status={row.status} /> },
    { key: 'createdAt', label: 'Responsável / data', render: (row: Commission) => <span className="text-xs">{row.createdByName || 'Não disponível'}<span className="block text-gray-400">{new Date(row.createdAt).toLocaleDateString('pt-BR')}</span></span> },
    { key: 'actions', label: 'Ações', render: actions },
  ];

  return <div className="space-y-5 animate-fade-in">
    <PageHeader title="Comissões" subtitle="Registre e acompanhe valores informados manualmente." action={<button type="button" onClick={openCreate} disabled={employees.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-800 focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:opacity-50"><Plus className="h-4 w-4" />Registrar comissão</button>} />
    <AdministrativeNotice />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Registros pendentes" value={pending} icon={<WalletCards className="h-5 w-5" />} accentColor="yellow" /><StatCard title="Registros aprovados" value={approved} icon={<Check className="h-5 w-5" />} accentColor="blue" /><StatCard title="Registros pagos" value={paid} icon={<Check className="h-5 w-5" />} accentColor="green" /><StatCard title="Total manual no período" value={formatCurrency(total)} icon={<WalletCards className="h-5 w-5" />} accentColor="purple" /></div>
    <section aria-label="Filtros de comissões" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#1a1d27]"><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="relative"><span className="sr-only">Buscar comissões</span><Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Funcionário ou descrição" className={`${fieldClass} w-full pl-9`} /></label><select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} aria-label="Filtrar por funcionário" className={fieldClass}><option value="">Todos os funcionários</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.fullName}</option>)}</select><select value={teamId} onChange={(event) => setTeamId(event.target.value)} aria-label="Filtrar por equipe" className={fieldClass}><option value="">Todas as equipes</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><select value={status} onChange={(event) => setStatus(event.target.value as CommissionStatus | 'all')} aria-label="Filtrar por status" className={fieldClass}><option value="all">Todos os status</option><option value="pending">Pendente</option><option value="approved">Aprovada</option><option value="paid">Paga</option><option value="canceled">Cancelada</option></select><input aria-label="Período inicial" type="month" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={fieldClass} /><input aria-label="Período final" type="month" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={fieldClass} /></div>{isFiltered && <button type="button" onClick={clearFilters} className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-cyan-700"><X className="h-3.5 w-3.5" />Limpar filtros</button>}</section>
    {employees.length === 0 && !isLoading ? <div className="rounded-2xl border border-cyan-100 bg-white p-8 text-center dark:border-cyan-400/15 dark:bg-[#1a1d27]"><h2 className="font-bold text-gray-900 dark:text-white">Cadastre um funcionário antes de registrar comissões.</h2></div> : isError ? <div role="alert" className="rounded-2xl border border-red-100 bg-white p-10 text-center dark:border-red-500/15 dark:bg-[#1a1d27]"><AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" /><h2 className="font-bold">Não foi possível carregar as comissões.</h2><button type="button" onClick={() => refetch()} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-700"><RefreshCw className="h-4 w-4" />Tentar novamente</button></div> : <><div className="hidden md:block"><DataTable columns={columns} data={commissions} isLoading={isLoading} emptyTitle={isFiltered ? 'Nenhuma comissão encontrada.' : 'Nenhuma comissão registrada.'} emptySubtitle={isFiltered ? 'Ajuste a busca ou limpe os filtros.' : 'Registre manualmente a primeira comissão.'} /></div><div className="grid grid-cols-1 gap-3 md:hidden">{commissions.map((commission) => <article key={commission.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-white/5 dark:bg-[#1a1d27]"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><EmployeeAvatar name={commission.employeeName} /><div><h2 className="font-bold text-gray-900 dark:text-white">{commission.employeeName}</h2><p className="text-xs text-gray-500">{commission.teamName || 'Sem equipe'} · {commission.description}</p></div></div><CommissionStatusBadge status={commission.status} /></div><div className="mt-4 flex items-end justify-between"><div><p className="text-xs text-gray-400">{formatReferencePeriod(commission.referencePeriod)}</p><p className="text-lg font-bold">{formatCurrency(commission.grossAmount)}</p></div>{actions(commission)}</div></article>)}</div></>}
    <CommissionModal isOpen={isFormOpen} commission={editing} employees={employees} isLoading={isSaving} onClose={() => setIsFormOpen(false)} onSave={async (input) => { await saveCommission({ input, id: editing?.id }); setIsFormOpen(false); }} />
    <CommissionDetailsModal commission={viewing} onClose={() => setViewing(undefined)} />
    <ConfirmModal isOpen={Boolean(canceling)} title="Cancelar comissão" message={`Confirma o cancelamento do registro de ${canceling?.employeeName || 'funcionário'}? O histórico será preservado e nenhum pagamento será realizado.`} confirmText="Cancelar registro" variant="danger" isLoading={isUpdatingStatus} onConfirm={async () => { if (canceling) await updateStatus({ id: canceling.id, value: 'canceled' }); setCanceling(undefined); }} onCancel={() => setCanceling(undefined)} />
  </div>;
};
