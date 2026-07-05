import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Shield, KeyRound, Fingerprint, Monitor } from 'lucide-react';
import { useSettings } from '../../../hooks/useSettings';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z.string().min(8, 'A nova senha deve ter pelo menos 8 caracteres'),
    confirmPassword: z.string().min(1, 'Confirme a nova senha'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type PasswordForm = z.infer<typeof passwordSchema>;

const cardClass = 'bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm p-6';
const labelClass = 'text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400';
const controlClass =
  'w-full px-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-[#10b981] transition-all duration-200';

export const SecurityTab: React.FC = () => {
  const { changePassword, isChangingPassword } = useSettings();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (values: PasswordForm) => {
    const ok = await changePassword({
      currentPassword: values.currentPassword,
      newPassword: values.newPassword,
    })
      .then(() => true)
      .catch(() => false);
    if (ok) reset();
  };

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <KeyRound className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Alterar Senha</h2>
            <p className="text-sm text-gray-500 dark:text-white/50">Atualize a senha de acesso da sua conta</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-md">
          <div className="space-y-1">
            <label className={labelClass}>Senha Atual</label>
            <input type="password" autoComplete="current-password" {...register('currentPassword')} className={controlClass} />
            {errors.currentPassword && <p className="text-xs text-red-500 font-medium">{errors.currentPassword.message}</p>}
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Nova Senha</label>
            <input type="password" autoComplete="new-password" {...register('newPassword')} className={controlClass} />
            {errors.newPassword && <p className="text-xs text-red-500 font-medium">{errors.newPassword.message}</p>}
          </div>

          <div className="space-y-1">
            <label className={labelClass}>Confirmar Nova Senha</label>
            <input type="password" autoComplete="new-password" {...register('confirmPassword')} className={controlClass} />
            {errors.confirmPassword && <p className="text-xs text-red-500 font-medium">{errors.confirmPassword.message}</p>}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-70"
            >
              {isChangingPassword && <Loader2 className="w-4 h-4 animate-spin" />}
              {isChangingPassword ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-300">
              <Fingerprint className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Autenticação em Dois Fatores (2FA)</h3>
              <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">
                Adicione uma camada extra de segurança ao seu login.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
            Em breve
          </span>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-4">
          <span className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-300">
            <Monitor className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Sessões Ativas</h3>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">Gerencie os dispositivos conectados.</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <Shield className="w-8 h-8 text-gray-300 dark:text-white/20 mb-2" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Em desenvolvimento</p>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1 max-w-xs">
            O gerenciamento de sessões ativas estará disponível em breve.
          </p>
        </div>
      </div>
    </div>
  );
};
