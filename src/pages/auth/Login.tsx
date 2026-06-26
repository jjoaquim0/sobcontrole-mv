import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { TrendingUp, Mail, Lock, Loader2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string()
    .min(1, 'O e-mail é obrigatório')
    .email('Insira um endereço de e-mail válido'),
  password: z.string()
    .min(6, 'A senha deve conter no mínimo 6 caracteres'),
});

type LoginFields = z.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const { signIn, isLoading, error, isAuthenticated, clearError } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  const onSubmit = async (data: LoginFields) => {
    await signIn(data.email, data.password);
  };

  return (
    <div className="min-h-screen bg-themeBg-light dark:bg-themeBg-dark flex items-center justify-center p-6 transition-colors duration-300">
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-xl p-8 max-w-md w-full transition-all duration-300">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-[#10b981] p-2 rounded-xl text-white mb-3 shadow-md shadow-emerald-500/10">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Gestly</h1>
          <p className="text-sm text-themeText-secondaryLight dark:text-themeText-secondaryDark mt-1">
            Entre no painel administrativo de sua empresa
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* Email field */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              E-mail corporativo
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                placeholder="nome@empresa.com"
                {...register('email')}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Sua senha
              </label>
              <a href="#" className="text-xs text-[#10b981] hover:underline" onClick={(e) => {
                e.preventDefault();
                toast.info('Para fins de demonstração, use a senha definida.');
              }}>
                Esqueceu a senha?
              </a>
            </div>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                {...register('password')}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-500 font-medium">{errors.password.message}</p>
            )}
          </div>

          {/* Submit CTA */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#10b981] hover:bg-[#059669] text-white rounded-xl py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Entrando no Gestly...
              </>
            ) : (
              'Acessar Sistema'
            )}
          </button>
        </form>

        {/* Demo credentials hint */}
        <div className="mt-6 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 text-xs text-center text-gray-500 dark:text-gray-400">
          Acesso rápido demonstrativo:<br />
          <span className="font-semibold text-gray-700 dark:text-gray-300">admin@gestly.com</span> / <span className="font-semibold text-gray-700 dark:text-gray-300">123456</span>
        </div>

        {/* Toggle signup link */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-6">
          Ainda não tem conta?{' '}
          <Link to="/register" className="text-[#10b981] font-semibold hover:underline">
            Cadastre sua PME
          </Link>
        </div>

      </div>
    </div>
  );
};
export default Login;
