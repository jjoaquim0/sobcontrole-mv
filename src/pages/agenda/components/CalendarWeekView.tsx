import React from 'react';
import { Appointment } from '../../../types';
import { addDays, isSameLocalDay } from '../utils';
import { AppointmentChip } from './AppointmentChip';

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export interface CalendarWeekViewProps {
  weekStart: Date;
  appointments: Appointment[];
  onDayClick: (day: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onToggleDone: (appointment: Appointment) => void;
}

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  weekStart,
  appointments,
  onDayClick,
  onAppointmentClick,
  onToggleDone,
}) => {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="flex-1 grid grid-cols-1 md:grid-cols-7 gap-3 overflow-y-auto pb-2 items-start">
      {days.map((day) => {
        const dayAppointments = appointments
          .filter((a) => {
            const start = new Date(a.startAt);
            const end = new Date(a.endAt);
            return isSameLocalDay(start, day) || (a.allDay && start <= day && end >= day);
          })
          .sort((a, b) => a.startAt.localeCompare(b.startAt));
        const isToday = isSameLocalDay(day, new Date());

        return (
          <div
            key={day.toISOString()}
            onClick={() => onDayClick(day)}
            className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-3 flex flex-col gap-2 min-h-[220px] cursor-pointer shadow-sm"
          >
            <div className="flex items-center justify-between shrink-0">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {WEEKDAY_LABELS[day.getDay()]}
              </span>
              <span
                className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-[#10b981] text-white' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {day.getDate()}
              </span>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              {dayAppointments.length === 0 ? (
                <span className="text-[11px] text-gray-300 dark:text-gray-600 italic">Sem compromissos</span>
              ) : (
                dayAppointments.map((a) => (
                  <AppointmentChip
                    key={a.id}
                    appointment={a}
                    onClick={() => onAppointmentClick(a)}
                    onToggleDone={a.type === 'tarefa' ? () => onToggleDone(a) : undefined}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
