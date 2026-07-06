import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CheckSquare, Square, AlertCircle } from 'lucide-react';
import { Appointment } from '../../../types';
import { isAppointmentOverdue } from '../../../services/agendaService';
import { APPOINTMENT_TYPE_COLORS, toTimeInputValue } from '../utils';

export interface AppointmentChipProps {
  appointment: Appointment;
  onClick: () => void;
  onToggleDone?: () => void;
  draggable?: boolean;
}

export const AppointmentChip: React.FC<AppointmentChipProps> = ({ appointment, onClick, onToggleDone, draggable = false }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: appointment.id,
    disabled: !draggable,
  });

  const colors = APPOINTMENT_TYPE_COLORS[appointment.type];
  const overdue = isAppointmentOverdue(appointment);
  const isTask = appointment.type === 'tarefa';

  return (
    <div
      ref={setNodeRef}
      {...(draggable ? { ...attributes, ...listeners } : {})}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: isDragging ? 40 : undefined } : undefined}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-semibold cursor-pointer truncate transition-colors duration-150 ${colors.bg} ${colors.text} ${
        isDragging ? 'opacity-50' : ''
      } ${overdue ? 'ring-1 ring-red-400' : ''}`}
      title={appointment.title}
    >
      {isTask && onToggleDone && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone();
          }}
          className="shrink-0 hover:scale-110 transition-transform duration-150"
        >
          {appointment.status === 'concluido' ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
        </button>
      )}
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
      <span className="truncate flex-1">
        {!appointment.allDay && `${toTimeInputValue(appointment.startAt)} `}
        {appointment.title}
      </span>
      {overdue && <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />}
    </div>
  );
};
