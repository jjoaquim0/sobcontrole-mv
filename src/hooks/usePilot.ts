import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { capturePilotSnapshot, getPilotIndicators, getPilotOverview, PilotSnapshotInput, setPilotCriterion } from '@/services/pilotService';

const onError = (error: Error) => toast.error(error.message);

export const usePilot = (period: { from: string; to: string }, isPeriodValid: boolean) => {
  const queryClient = useQueryClient();
  const indicators = useQuery({
    queryKey: ['pilot', 'indicators', period.from, period.to],
    queryFn: () => getPilotIndicators(period.from, period.to),
    enabled: isPeriodValid,
  });
  const overview = useQuery({ queryKey: ['pilot', 'overview'], queryFn: getPilotOverview });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pilot'] });

  const snapshot = useMutation({
    mutationFn: (input: PilotSnapshotInput) => capturePilotSnapshot(input),
    onSuccess: () => { invalidate(); toast.success('Medição salva.'); },
    onError,
  });
  const criterion = useMutation({
    mutationFn: ({ number, confirmed, note }: { number: number; confirmed: boolean; note?: string }) => setPilotCriterion(number, confirmed, note),
    onSuccess: (_, variables) => { invalidate(); toast.success(variables.confirmed ? 'Critério confirmado.' : 'Confirmação retirada.'); },
    onError,
  });

  return {
    indicators,
    overview,
    captureSnapshot: snapshot.mutateAsync,
    isCapturing: snapshot.isPending,
    setCriterion: criterion.mutateAsync,
    isSettingCriterion: criterion.isPending,
  };
};
