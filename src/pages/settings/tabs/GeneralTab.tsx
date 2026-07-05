import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Building2 } from 'lucide-react';
import { useSettings } from '../../../hooks/useSettings';
import { useAuth } from '../../../hooks/useAuth';

const generalSchema = z.object({
  name: z.string().min(1, 'Informe o nome da empresa'),
  timezone: z.string().min(1, 'Selecione um fuso horário'),
  currency: z.enum(['BRL', 'USD', 'EUR']),
  language: z.enum(['pt-BR', 'en', 'es']),
  dateFormat: z.enum(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']),
});

type GeneralForm = z.infer<typeof generalSchema>;

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { value: 'America/Recife', label: 'Recife (GMT-3)' },
  { value: 'America/Belem', label: 'Belém (GMT-3)' },
  { value: 'America/Bahia', label: 'Salvador (GMT-3)' },
  { value: 'America/Campo_Grande', label: 'Campo Grande (GMT-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { value: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
];

const labelClass = 'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';
const controlClass =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200';

export const GeneralTab: React.FC = () => {
  const { company } = useAuth();
  const { settings, isLoading, updateSettings, isSavingSettings, updateCompanyName, isSavingCompanyName } =
    useSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GeneralForm>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      name: '',
      timezone: 'America/Sao_Paulo',
      currency: 'BRL',
      language: 'pt-BR',
      dateFormat: 'DD/MM/YYYY',
    },
  });

  useEffect(() => {
    if (settings) {
      reset({
        name: company?.name || '',
        timezone: settings.timezone,
        currency: (['BRL', 'USD', 'EUR'].includes(settings.currency) ? settings.currency : 'BRL') as GeneralForm['currency'],
        language: (['pt-BR', 'en', 'es'].includes(settings.language) ? settings.language : 'pt-BR') as GeneralForm['language'],
        dateFormat: (['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'].includes(settings.dateFormat)
          ? settings.dateFormat
          : 'DD/MM/YYYY') as GeneralForm['dateFormat'],
      });
    }
  }, [settings, company, reset]);

  const onSubmit = async (values: GeneralForm) => {
    const { name, ...regional } = values;
    try {
      if (name.trim() !== (company?.name || '')) {
        await updateCompanyName(name.trim());
      }
      await updateSettings(regional);
    } catch {
      return;
    }
  };

  const isSaving = isSavingSettings || isSavingCompanyName;

  const formatCnpj = (cnpj: string) => {
    const clean = (cnpj || '').replace(/\D/g, '');
    if (clean.length !== 14) return cnpj || '—';
    return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  return (
    <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
        <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
          <Building2 className="w-5 h-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Configurações Gerais</h2>
          <p className="text-sm text-gray-500 dark:text-white/50">Dados e preferências regionais da empresa</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className={labelClass}>Nome da Empresa</label>
              <input type="text" {...register('name')} className={controlClass} />
              {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>CNPJ</label>
              <input
                type="text"
                value={formatCnpj(company?.cnpj || '')}
                disabled
                className={`${controlClass} opacity-70 cursor-not-allowed font-mono`}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Fuso Horário</label>
              <select {...register('timezone')} className={controlClass}>
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              {errors.timezone && <p className="text-xs text-red-500 font-medium">{errors.timezone.message}</p>}
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Moeda</label>
              <select {...register('currency')} className={controlClass}>
                <option value="BRL">Real Brasileiro (R$)</option>
                <option value="USD">Dólar Americano (US$)</option>
                <option value="EUR">Euro (€)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Idioma</label>
              <select {...register('language')} className={controlClass}>
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en">Inglês</option>
                <option value="es">Espanhol</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className={labelClass}>Formato de Data</label>
              <select {...register('dateFormat')} className={controlClass}>
                <option value="DD/MM/YYYY">DD/MM/AAAA</option>
                <option value="MM/DD/YYYY">MM/DD/AAAA</option>
                <option value="YYYY-MM-DD">AAAA-MM-DD</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end border-t border-gray-100 dark:border-white/5 pt-5">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-70"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
