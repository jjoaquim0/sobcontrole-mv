import React from 'react';
import { CalendarX2, MapPin, User, CheckSquare, Square, AlertCircle } from 'lucide-react';
import { Appointment } from '../../../types';
import { isAppointmentOverdue } from '../../../services/agendaService';
import { isSameLocalDay, formatTimeRange, APPOINTMENT_TYPE_LABELS, APPOINTMENT_STATUS_LABELS, APPOINTMENT_TYPE_COLORS } from '../utils';

export interface CalendarDayViewProps {
  day: Date;
  appointments: Appointment[];
  onAppointmentClick: (appointment: Appointment) => void;
  onToggleDone: (appointment: Appointment) => void;
}

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({ day, appointments, onAppointmentClick, onToggleDone }) => {
  const dayAppointments = appointments
    .filter((a) => {
      const start = new Date(a.startAt);
      const end = new Date(a.endAt);
      return isSameLocalDay(start, day) || (a.allDay && start <= day && end >= day);
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  if (dayAppointments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-10 shadow-sm text-center">
        <CalendarX2 className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
        <h3 className="font-semibold text-gray-700 dark:text-gray-300">Nenhum compromisso neste dia</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Clique em "Novo Compromisso" para agendar.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-2 overflow-y-auto pb-2">
      {dayAppointments.map((a) => {
        const colors = APPOINTMENT_TYPE_COLORS[a.type];
        const overdue = isAppointmentOverdue(a);
        return (
          <div
            key={a.id}
            onClick={() => onAppointmentClick(a)}
            className={`bg-white dark:bg-[#1a1d27] border rounded-2xl p-4 shadow-sm cursor-pointer transition-colors duration-150 hover:border-[#10b981]/40 ${
              overdue ? 'border-red-300 dark:border-red-500/30' : 'border-gray-100 dark:border-white/5'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {a.type === 'tarefa' && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleDone(a);
                    }}
                    className="mt-0.5 text-gray-400 hover:text-[#10b981] transition-colors duration-150 shrink-0"
                  >
                    {a.status === 'concluido' ? <CheckSquare className="w-5 h-5 text-[#10b981]" /> : <Square className="w-5 h-5" />}
                  </button>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                      {APPOINTMENT_TYPE_LABELS[a.type]}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {formatTimeRange(a.startAt, a.endAt, a.allDay)}
                    </span>
                    {overdue && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                  </div>
                  <h4 className="font-semibold text-gray-900 dark:text-white mt-1 truncate">{a.title}</h4>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                    {a.customer && (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {a.customer.fullName}
                      </span>
                    )}
                    {a.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {a.location}
                      </span>
                    )}
                    <span>Resp.: {a.assignedUserName}</span>
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 shrink-0">
                {APPOINTMENT_STATUS_LABELS[a.status]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
