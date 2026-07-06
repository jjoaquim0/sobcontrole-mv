import React, { useMemo } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Appointment } from '../../../types';
import { getMonthGridDays, isSameLocalDay, toDateInputValue } from '../utils';
import { AppointmentChip } from './AppointmentChip';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_VISIBLE_PER_DAY = 3;

interface DayCellProps {
  day: Date;
  appointments: Appointment[];
  isCurrentMonth: boolean;
  onDayClick: (day: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onToggleDone: (appointment: Appointment) => void;
}

const DayCell: React.FC<DayCellProps> = ({ day, appointments, isCurrentMonth, onDayClick, onAppointmentClick, onToggleDone }) => {
  const dayKey = toDateInputValue(day);
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dayKey}` });
  const isToday = isSameLocalDay(day, new Date());
  const visible = appointments.slice(0, MAX_VISIBLE_PER_DAY);
  const overflow = appointments.length - visible.length;

  return (
    <div
      ref={setNodeRef}
      onClick={() => onDayClick(day)}
      className={`min-h-[110px] p-1.5 border border-gray-100 dark:border-white/5 flex flex-col gap-1 cursor-pointer transition-colors duration-150 ${
        isCurrentMonth ? 'bg-white dark:bg-[#1a1d27]' : 'bg-gray-50/60 dark:bg-white/[0.02]'
      } ${isOver ? 'ring-2 ring-[#10b981] ring-inset' : ''}`}
    >
      <span
        className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full shrink-0 ${
          isToday
            ? 'bg-[#10b981] text-white'
            : isCurrentMonth
            ? 'text-gray-700 dark:text-gray-300'
            : 'text-gray-300 dark:text-gray-600'
        }`}
      >
        {day.getDate()}
      </span>
      <div className="flex-1 flex flex-col gap-1 overflow-hidden">
        {visible.map((a) => (
          <AppointmentChip
            key={a.id}
            appointment={a}
            draggable
            onClick={() => onAppointmentClick(a)}
            onToggleDone={a.type === 'tarefa' ? () => onToggleDone(a) : undefined}
          />
        ))}
        {overflow > 0 && <span className="text-[10px] text-gray-400 dark:text-gray-500 px-1">+{overflow} mais</span>}
      </div>
    </div>
  );
};

export interface CalendarMonthViewProps {
  anchor: Date;
  appointments: Appointment[];
  onDayClick: (day: Date) => void;
  onAppointmentClick: (appointment: Appointment) => void;
  onToggleDone: (appointment: Appointment) => void;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  anchor,
  appointments,
  onDayClick,
  onAppointmentClick,
  onToggleDone,
}) => {
  const days = useMemo(() => getMonthGridDays(anchor), [anchor]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    appointments.forEach((a) => {
      const start = new Date(a.startAt);
      const end = new Date(a.endAt);
      let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      let guard = 0;
      while (cursor.getTime() <= endDay.getTime() && guard < 60) {
        const key = toDateInputValue(cursor);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
        guard++;
      }
    });
    map.forEach((list) => list.sort((a, b) => a.startAt.localeCompare(b.startAt)));
    return map;
  }, [appointments]);

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-white/5 shrink-0">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {days.map((day) => (
          <DayCell
            key={day.toISOString()}
            day={day}
            appointments={appointmentsByDay.get(toDateInputValue(day)) || []}
            isCurrentMonth={day.getMonth() === anchor.getMonth()}
            onDayClick={onDayClick}
            onAppointmentClick={onAppointmentClick}
            onToggleDone={onToggleDone}
          />
        ))}
      </div>
    </div>
  );
};
