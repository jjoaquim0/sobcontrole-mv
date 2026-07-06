import React, { useMemo, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  CalendarDays,
  CalendarRange,
  List,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { StatCard } from '../../components/shared/StatCard';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { CalendarMonthView } from './components/CalendarMonthView';
import { CalendarWeekView } from './components/CalendarWeekView';
import { CalendarDayView } from './components/CalendarDayView';
import { AppointmentModal, AppointmentSavePayload } from './components/AppointmentModal';
import { useAppointments, useAppointmentMutations } from '../../hooks/useAgenda';
import { useSettings } from '../../hooks/useSettings';
import { useCustomers } from '../../hooks/useCustomers';
import { isAppointmentOverdue } from '../../services/agendaService';
import { Appointment, AppointmentStatus, AppointmentType } from '../../types';
import {
  addDays,
  formatDayLabel,
  formatMonthLabel,
  formatWeekLabel,
  getMonthGridDays,
  isSameLocalDay,
  startOfWeek,
  toDateInputValue,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_TYPE_LABELS,
} from './utils';

type ViewMode = 'month' | 'week' | 'day';

export const AgendaPage: React.FC = () => {
  const [view, setView] = useState<ViewMode>('month');
  const [anchor, setAnchor] = useState(() => new Date());

  const [assignedUserFilter, setAssignedUserFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<AppointmentType | ''>('');
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | ''>('');
  const [customerFilter, setCustomerFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | undefined>(undefined);
  const [createDate, setCreateDate] = useState<Date | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | undefined>(undefined);

  const { teamMembers } = useSettings();
  const { customers } = useCustomers({ status: 'active' });

  const range = useMemo(() => {
    if (view === 'month') {
      const days = getMonthGridDays(anchor);
      return { start: days[0], end: addDays(days[days.length - 1], 1) };
    }
    if (view === 'week') {
      const start = startOfWeek(anchor);
      return { start, end: addDays(start, 7) };
    }
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
    return { start, end: addDays(start, 1) };
  }, [view, anchor]);

  const filters = {
    rangeStart: range.start.toISOString(),
    rangeEnd: range.end.toISOString(),
    assignedUserId: assignedUserFilter || undefined,
    type: (typeFilter || 'all') as AppointmentType | 'all',
    status: (statusFilter || 'all') as AppointmentStatus | 'all',
    customerId: customerFilter || undefined,
  };

  const { appointments, isLoading, isError, refetch } = useAppointments(filters);
  const { createAppointment, isCreating, updateAppointment, isUpdating, deleteAppointment, isDeleting } = useAppointmentMutations();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const summary = useMemo(() => {
    const today = new Date();
    const todayCount = appointments.filter((a) => isSameLocalDay(new Date(a.startAt), today)).length;
    const overdueCount = appointments.filter(isAppointmentOverdue).length;
    const pendingCount = appointments.filter((a) => a.status === 'pendente' || a.status === 'agendado').length;
    const doneCount = appointments.filter((a) => a.status === 'concluido').length;
    return { total: appointments.length, todayCount, overdueCount, pendingCount, doneCount };
  }, [appointments]);

  const handleOpenCreate = (date?: Date) => {
    setSelectedAppointment(undefined);
    setCreateDate(date || anchor);
    setIsModalOpen(true);
  };

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setCreateDate(undefined);
    setIsModalOpen(true);
  };

  const handleSave = async (data: AppointmentSavePayload) => {
    if (selectedAppointment) {
      await updateAppointment({ id: selectedAppointment.id, data });
    } else {
      await createAppointment(data);
    }
  };

  const handleToggleDone = async (appointment: Appointment) => {
    await updateAppointment({
      id: appointment.id,
      data: { status: appointment.status === 'concluido' ? 'agendado' : 'concluido' },
    });
  };

  const handleRequestDelete = () => {
    if (!selectedAppointment) return;
    setDeleteTarget(selectedAppointment);
    setIsModalOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteAppointment(deleteTarget.id);
    setDeleteTarget(undefined);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    if (!overId.startsWith('day:')) return;
    const targetDateStr = overId.slice(4);

    const appointment = appointments.find((a) => a.id === active.id);
    if (!appointment) return;

    const currentDateStr = toDateInputValue(appointment.startAt);
    if (currentDateStr === targetDateStr) return;

    const [ty, tm, td] = targetDateStr.split('-').map(Number);
    const oldStart = new Date(appointment.startAt);
    const oldEnd = new Date(appointment.endAt);
    const dayDelta = Math.round(
      (new Date(ty, tm - 1, td).getTime() - new Date(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate()).getTime()) / 86400000
    );

    const newStart = addDays(oldStart, dayDelta);
    const newEnd = addDays(oldEnd, dayDelta);

    updateAppointment({
      id: appointment.id,
      data: { startAt: newStart.toISOString(), endAt: newEnd.toISOString() },
    });
  };

  const handlePrev = () => {
    if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
    else if (view === 'week') setAnchor(addDays(anchor, -7));
    else setAnchor(addDays(anchor, -1));
  };

  const handleNext = () => {
    if (view === 'month') setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
    else if (view === 'week') setAnchor(addDays(anchor, 7));
    else setAnchor(addDays(anchor, 1));
  };

  const handleToday = () => setAnchor(new Date());

  const periodLabel =
    view === 'month' ? formatMonthLabel(anchor) : view === 'week' ? formatWeekLabel(startOfWeek(anchor)) : formatDayLabel(anchor);

  const isFiltered = assignedUserFilter !== '' || typeFilter !== '' || statusFilter !== '' || customerFilter !== '';
  const handleClearFilters = () => {
    setAssignedUserFilter('');
    setTypeFilter('');
    setStatusFilter('');
    setCustomerFilter('');
  };

  return (
    <div className="flex flex-col h-full space-y-5 animate-fade-in">
      <PageHeader
        title="Agenda"
        subtitle={`${summary.total} compromissos no período`}
        action={
          <button
            onClick={() => handleOpenCreate()}
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10"
          >
            <Plus className="w-4.5 h-4.5" />
            Novo Compromisso
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 shrink-0">
        <StatCard title="Hoje" value={summary.todayCount} icon={<CalendarDays className="w-5 h-5" />} accentColor="blue" />
        <StatCard title="Pendentes" value={summary.pendingCount} icon={<Clock className="w-5 h-5" />} accentColor="yellow" />
        <StatCard title="Atrasados" value={summary.overdueCount} icon={<AlertCircle className="w-5 h-5" />} accentColor="red" />
        <StatCard title="Concluídos" value={summary.doneCount} icon={<CheckCircle2 className="w-5 h-5" />} accentColor="green" />
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors duration-300 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-colors duration-200"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
          >
            Hoje
          </button>
          <button
            onClick={handleNext}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 dark:text-gray-400 transition-colors duration-200"
          >
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
          <span className="text-sm font-bold text-gray-800 dark:text-white capitalize ml-2">{periodLabel}</span>
        </div>

        <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 self-start lg:self-auto">
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors duration-200 ${
              view === 'month' ? 'bg-white dark:bg-[#1a1d27] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <CalendarRange className="w-3.5 h-3.5" /> Mês
          </button>
          <button
            onClick={() => setView('week')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors duration-200 ${
              view === 'week' ? 'bg-white dark:bg-[#1a1d27] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" /> Semana
          </button>
          <button
            onClick={() => setView('day')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors duration-200 ${
              view === 'day' ? 'bg-white dark:bg-[#1a1d27] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            <List className="w-3.5 h-3.5" /> Dia
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 shadow-sm flex flex-wrap items-center gap-3 shrink-0">
        <select
          value={assignedUserFilter}
          onChange={(e) => setAssignedUserFilter(e.target.value)}
          className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
        >
          <option value="">Todos os Responsáveis</option>
          {teamMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as AppointmentType | '')}
          className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
        >
          <option value="">Todos os Tipos</option>
          {(Object.keys(APPOINTMENT_TYPE_LABELS) as AppointmentType[]).map((t) => (
            <option key={t} value={t}>
              {APPOINTMENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | '')}
          className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
        >
          <option value="">Todos os Status</option>
          {(Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[]).map((s) => (
            <option key={s} value={s}>
              {APPOINTMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="px-4 py-2.5 pr-8 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer"
        >
          <option value="">Todos os Clientes</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
            </option>
          ))}
        </select>

        {isFiltered && (
          <button
            onClick={handleClearFilters}
            className="text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white flex items-center gap-1 py-2 px-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-all duration-200"
          >
            <X className="w-3.5 h-3.5" />
            Limpar Filtros
          </button>
        )}
      </div>

      {isError ? (
        <div className="flex flex-col items-center justify-center bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-10 shadow-sm transition-colors duration-300 text-center animate-fade-in">
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-full text-red-500 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-lg mb-1">Não foi possível carregar a agenda</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-6">
            Ocorreu um problema ao conectar com o banco de dados. Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={() => refetch()}
            className="bg-red-500 hover:bg-red-600 text-white rounded-xl px-5 py-2.5 text-sm font-medium transition-colors duration-200 shadow-md shadow-red-500/10 active:scale-95"
          >
            Tentar novamente
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          {view === 'month' && (
            <CalendarMonthView
              anchor={anchor}
              appointments={appointments}
              onDayClick={handleOpenCreate}
              onAppointmentClick={handleAppointmentClick}
              onToggleDone={handleToggleDone}
            />
          )}
          {view === 'week' && (
            <CalendarWeekView
              weekStart={startOfWeek(anchor)}
              appointments={appointments}
              onDayClick={handleOpenCreate}
              onAppointmentClick={handleAppointmentClick}
              onToggleDone={handleToggleDone}
            />
          )}
          {view === 'day' && (
            <CalendarDayView
              day={anchor}
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
              onToggleDone={handleToggleDone}
            />
          )}
        </DndContext>
      )}

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        appointment={selectedAppointment}
        defaultDate={createDate}
        onSave={handleSave}
        isSaving={isCreating || isUpdating}
        onDelete={selectedAppointment ? handleRequestDelete : undefined}
      />

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Excluir compromisso"
        message={`Tem certeza que deseja excluir "${deleteTarget?.title}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(undefined)}
        isLoading={isDeleting}
        confirmText="Excluir"
        variant="danger"
      />
    </div>
  );
};
