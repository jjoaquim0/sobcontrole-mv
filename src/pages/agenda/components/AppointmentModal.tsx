import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CalendarClock, Trash2 } from 'lucide-react';
import { Appointment, AppointmentStatus, AppointmentType } from '../../../types';
import { useCustomers } from '../../../hooks/useCustomers';
import { useSettings } from '../../../hooks/useSettings';
import { useDeals } from '../../../hooks/usePipeline';
import { useAuthStore } from '../../../store/authStore';
import { combineDateTime, toDateInputValue, toTimeInputValue, APPOINTMENT_TYPE_LABELS, APPOINTMENT_STATUS_LABELS } from '../utils';

const appointmentSchema = z
  .object({
    title: z.string().min(3, 'O título deve conter pelo menos 3 caracteres'),
    description: z.string().optional().or(z.literal('')),
    type: z.enum(['reuniao', 'tarefa', 'ligacao', 'visita', 'lembrete']),
    status: z.enum(['agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu', 'pendente']),
    customerId: z.string().optional().or(z.literal('')),
    dealId: z.string().optional().or(z.literal('')),
    assignedUserId: z.string().min(1, 'Responsável é obrigatório'),
    startDate: z.string().min(1, 'Data de início é obrigatória'),
    startTime: z.string().optional().or(z.literal('')),
    endDate: z.string().min(1, 'Data de término é obrigatória'),
    endTime: z.string().optional().or(z.literal('')),
    allDay: z.boolean(),
    location: z.string().optional().or(z.literal('')),
    notes: z.string().optional().or(z.literal('')),
  })
  .refine((data) => data.allDay || (!!data.startTime && !!data.endTime), {
    message: 'Informe hora de início e término, ou marque "Dia inteiro"',
    path: ['startTime'],
  })
  .refine(
    (data) => {
      const start = new Date(`${data.startDate}T${data.allDay ? '00:00' : data.startTime}:00`);
      const end = new Date(`${data.endDate}T${data.allDay ? '23:59' : data.endTime}:00`);
      return end.getTime() >= start.getTime();
    },
    { message: 'O término deve ser igual ou posterior ao início', path: ['endDate'] }
  );

type AppointmentForm = z.infer<typeof appointmentSchema>;

export interface AppointmentSavePayload {
  title: string;
  description?: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  allDay: boolean;
  customerId?: string;
  dealId?: string;
  assignedUserId: string;
  location?: string;
  notes?: string;
}

export interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: Appointment;
  defaultDate?: Date;
  onSave: (data: AppointmentSavePayload) => Promise<void>;
  isSaving?: boolean;
  onDelete?: () => void | Promise<void>;
  isDeleting?: boolean;
}

const inputClass =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200';

const selectClass =
  'w-full px-3 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-[#1a1d27] text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] appearance-none cursor-pointer';

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  appointment,
  defaultDate,
  onSave,
  isSaving = false,
  onDelete,
  isDeleting = false,
}) => {
  const { customers } = useCustomers({ status: 'active' });
  const { teamMembers } = useSettings();
  const { deals } = useDeals();
  const currentProfileId = useAuthStore((s) => s.profile?.id);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      title: '',
      description: '',
      type: 'reuniao',
      status: 'agendado',
      customerId: '',
      dealId: '',
      assignedUserId: '',
      startDate: '',
      startTime: '09:00',
      endDate: '',
      endTime: '10:00',
      allDay: false,
      location: '',
      notes: '',
    },
  });

  const allDay = watch('allDay');

  useEffect(() => {
    if (!isOpen) return;

    if (appointment) {
      reset({
        title: appointment.title,
        description: appointment.description || '',
        type: appointment.type,
        status: appointment.status,
        customerId: appointment.customerId || '',
        dealId: appointment.dealId || '',
        assignedUserId: appointment.assignedUserId,
        startDate: toDateInputValue(appointment.startAt),
        startTime: toTimeInputValue(appointment.startAt),
        endDate: toDateInputValue(appointment.endAt),
        endTime: toTimeInputValue(appointment.endAt),
        allDay: appointment.allDay,
        location: appointment.location || '',
        notes: appointment.notes || '',
      });
    } else {
      const base = defaultDate || new Date();
      const dateStr = toDateInputValue(base);
      reset({
        title: '',
        description: '',
        type: 'reuniao',
        status: 'agendado',
        customerId: '',
        dealId: '',
        assignedUserId: currentProfileId || '',
        startDate: dateStr,
        startTime: '09:00',
        endDate: dateStr,
        endTime: '10:00',
        allDay: false,
        location: '',
        notes: '',
      });
    }
  }, [appointment, isOpen, defaultDate, currentProfileId, reset]);

  const onSubmit = async (formValues: AppointmentForm) => {
    await onSave({
      title: formValues.title,
      description: formValues.description,
      type: formValues.type,
      status: formValues.status,
      startAt: combineDateTime(formValues.startDate, formValues.allDay ? '00:00' : formValues.startTime || '00:00'),
      endAt: combineDateTime(formValues.endDate, formValues.allDay ? '23:59' : formValues.endTime || '23:59'),
      allDay: formValues.allDay,
      customerId: formValues.customerId || undefined,
      dealId: formValues.dealId || undefined,
      assignedUserId: formValues.assignedUserId,
      location: formValues.location,
      notes: formValues.notes,
    });
    onClose();
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    await onDelete();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isSaving || isDeleting ? undefined : onClose}
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="relative bg-white dark:bg-[#1a1d27] rounded-2xl border border-gray-100 dark:border-white/5 shadow-2xl p-6 w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto transition-colors duration-300"
          >
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2 text-gray-900 dark:text-white">
                <CalendarClock className="w-5.5 h-5.5 text-[#10b981]" />
                <div>
                  <h3 className="text-lg font-bold">{appointment ? 'Editar Compromisso' : 'Novo Compromisso'}</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {appointment ? 'Atualize os dados deste compromisso' : 'Cadastre um novo compromisso na agenda'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Título *
                </label>
                <input
                  type="text"
                  placeholder="Ex: Reunião de alinhamento - Cliente XPTO"
                  {...register('title')}
                  className={inputClass}
                />
                {errors.title && <p className="text-xs text-red-500 font-medium">{errors.title.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Tipo *
                  </label>
                  <select {...register('type')} className={selectClass}>
                    {(Object.keys(APPOINTMENT_TYPE_LABELS) as AppointmentType[]).map((t) => (
                      <option key={t} value={t}>
                        {APPOINTMENT_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Status *
                  </label>
                  <select {...register('status')} className={selectClass}>
                    {(Object.keys(APPOINTMENT_STATUS_LABELS) as AppointmentStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {APPOINTMENT_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Cliente
                  </label>
                  <select {...register('customerId')} className={selectClass}>
                    <option value="">Nenhum</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Negócio Relacionado
                  </label>
                  <select {...register('dealId')} className={selectClass}>
                    <option value="">Nenhum</option>
                    {deals.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Responsável *
                </label>
                <select {...register('assignedUserId')} className={selectClass}>
                  <option value="">Selecione</option>
                  {teamMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                {errors.assignedUserId && <p className="text-xs text-red-500 font-medium">{errors.assignedUserId.message}</p>}
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                <input type="checkbox" {...register('allDay')} className="w-4 h-4 rounded accent-[#10b981]" />
                Dia inteiro
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Início *
                  </label>
                  <div className="flex gap-2">
                    <input type="date" {...register('startDate')} className={`${inputClass} dark:[color-scheme:dark]`} />
                    {!allDay && (
                      <input type="time" {...register('startTime')} className={`${inputClass} dark:[color-scheme:dark] w-28 shrink-0`} />
                    )}
                  </div>
                  {errors.startDate && <p className="text-xs text-red-500 font-medium">{errors.startDate.message}</p>}
                  {errors.startTime && <p className="text-xs text-red-500 font-medium">{errors.startTime.message}</p>}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Término *
                  </label>
                  <div className="flex gap-2">
                    <input type="date" {...register('endDate')} className={`${inputClass} dark:[color-scheme:dark]`} />
                    {!allDay && (
                      <input type="time" {...register('endTime')} className={`${inputClass} dark:[color-scheme:dark] w-28 shrink-0`} />
                    )}
                  </div>
                  {errors.endDate && <p className="text-xs text-red-500 font-medium">{errors.endDate.message}</p>}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Local
                </label>
                <input type="text" placeholder="Ex: Escritório, Google Meet, cliente..." {...register('location')} className={inputClass} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Descrição
                </label>
                <textarea placeholder="Detalhes do compromisso..." rows={2} {...register('description')} className={`${inputClass} resize-none`} />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Observações
                </label>
                <textarea placeholder="Notas internas, próximos passos..." rows={2} {...register('notes')} className={`${inputClass} resize-none`} />
              </div>

              <div className="flex justify-between items-center gap-3 border-t border-gray-100 dark:border-white/5 pt-4 mt-2">
                {appointment && onDelete ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSaving || isDeleting}
                    className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Excluir
                  </button>
                ) : (
                  <span />
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSaving || isDeleting}
                    className="border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || isDeleting}
                    className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-50"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isSaving ? 'Salvando...' : appointment ? 'Salvar Alterações' : 'Criar Compromisso'}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
