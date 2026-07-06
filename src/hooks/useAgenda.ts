import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  AppointmentFilters,
  CreateAppointmentInput,
  UpdateAppointmentInput,
} from '../services/agendaService';

import { toast } from 'sonner';

export const useAppointments = (filters?: AppointmentFilters) => {
  const appointmentsQuery = useQuery({
    queryKey: ['appointments', filters],
    queryFn: () => getAppointments(filters),
  });

  return {
    appointments: appointmentsQuery.data || [],
    isLoading: appointmentsQuery.isLoading,
    isError: appointmentsQuery.isError,
    refetch: appointmentsQuery.refetch,
  };
};

export const useAppointmentMutations = () => {
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['appointments'] });
  };

  const createMutation = useMutation({
    mutationFn: (data: CreateAppointmentInput) => createAppointment(data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Compromisso criado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao criar compromisso.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAppointmentInput }) => updateAppointment(id, data),
    onSuccess: () => {
      invalidateAll();
      toast.success('Compromisso atualizado com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao atualizar compromisso.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAppointment(id),
    onSuccess: () => {
      invalidateAll();
      toast.success('Compromisso excluído com sucesso!');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Erro ao excluir compromisso.');
    },
  });

  return {
    createAppointment: createMutation.mutateAsync,
    isCreating: createMutation.isPending,

    updateAppointment: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,

    deleteAppointment: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
};
