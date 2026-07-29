import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCashFlowForecast } from '../services/cashFlowForecastService';

export type ForecastPeriodPreset = '7' | '30' | '60' | '90' | 'custom';

const PRESET_DAYS: Record<Exclude<ForecastPeriodPreset, 'custom'>, number> = {
  '7': 7,
  '30': 30,
  '60': 60,
  '90': 90,
};

const DEFAULT_CUSTOM_DAYS = 30;

export interface UseCashFlowForecastParams {
  preset: ForecastPeriodPreset;
  /** Data final no formato yyyy-mm-dd (input type="date"), usada apenas quando preset === 'custom'. */
  customEndDate?: string;
}

const resolveEndDate = (preset: ForecastPeriodPreset, customEndDate: string | undefined): Date => {
  const today = new Date();

  if (preset === 'custom') {
    if (customEndDate) {
      const parsed = new Date(`${customEndDate}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    const fallback = new Date(today);
    fallback.setDate(fallback.getDate() + DEFAULT_CUSTOM_DAYS - 1);
    return fallback;
  }

  const end = new Date(today);
  end.setDate(end.getDate() + PRESET_DAYS[preset] - 1);
  return end;
};

const toDateKey = (date: Date): string => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export const useCashFlowForecast = (params: UseCashFlowForecastParams) => {
  const endDate = useMemo(
    () => resolveEndDate(params.preset, params.customEndDate),
    [params.preset, params.customEndDate],
  );
  const endDateKey = toDateKey(endDate);

  const query = useQuery({
    queryKey: ['financial', 'cashFlowForecast', params.preset, endDateKey],
    queryFn: () => getCashFlowForecast({ endDate }),
  });

  return {
    forecast: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    refetch: query.refetch,
    dataUpdatedAt: query.dataUpdatedAt,
  };
};
