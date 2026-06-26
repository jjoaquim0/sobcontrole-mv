import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { toast } from 'sonner';
import { TrendingUp, Mail, Lock, Building2, User, FileDigit, Loader2 } from 'lucide-react';

const registerSchema = z.object({
  companyName: z.string()
    .min(3, 'O nome da empresa deve ter no mínimo 3 caracteres'),
  cnpj: z.string()
    .min(14, 'O CNPJ deve ter no mínimo 14 números')
    .max(18, 'O CNPJ está muito longo')
    .refine((val) => {
      // Remove pontos, barras e traço para validar tamanho limpo
      const cleanVal = val.replace(/\D/g, '');
      return cleanVal.length === 14;
    }, 'O CNPJ deve conter exatamente 14 dígitos numéricos'),
  name: z.string()
    .min(3, 'Seu nome deve conter no mínimo 3 caracteres'),
  email: z.string()
    .min(1, 'O e-mail é obrigatório')
    .email('Insira um e-mail corporativo válido'),
  password: z.string()
    .min(6, 'A senha deve conter no mínimo 6 caracteres'),
});

type RegisterFields = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { signUp, isLoading, error, isAuthenticated, clearError } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: '',
      cnpj: '',
      name: '',
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

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 14) value = value.slice(0, 14);
    
    // Máscara CNPJ: 00.000.000/0000-00
    if (value.length > 12) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    } else if (value.length > 8) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
    }
    
    setValue('cnpj', value, { shouldValidate: true });
  };

  const onSubmit = async (data: RegisterFields) => {
    // Limpar o CNPJ antes de mandar pro back
    const cleanCnpj = data.cnpj.replace(/\D/g, '');
    await signUp(data.email, data.password, data.name, data.companyName, cleanCnpj);
    toast.success('Empresa e conta criadas com sucesso!');
  };

  return (
    <div className="min-h-screen bg-themeBg-light dark:bg-themeBg-dark flex items-center justify-center p-6 transition-colors duration-300">
      <div className="bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-xl p-8 max-w-lg w-full transition-all duration-300">
        
        {/* Logo Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="bg-[#10b981] p-2 rounded-xl text-white mb-3 shadow-md shadow-emerald-500/10">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Criar Conta Gestly</h1>
          <p className="text-sm text-themeText-secondaryLight dark:text-themeText-secondaryDark mt-1">
            Cadastre sua empresa e comece a gerenciar hoje mesmo
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Company Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Nome da Empresa
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <Building2 className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Razão Social ou Fantasia"
                  {...register('companyName')}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
                />
              </div>
              {errors.companyName && (
                <p className="text-xs text-red-500 font-medium">{errors.companyName.message}</p>
              )}
            </div>

            {/* CNPJ */}
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                CNPJ
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                  <FileDigit className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  onChange={handleCnpjChange}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
                />
              </div>
              {errors.cnpj && (
                <p className="text-xs text-red-500 font-medium">{errors.cnpj.message}</p>
              )}
            </div>
          </div>

          <hr className="border-gray-100 dark:border-white/5 my-2" />

          {/* User Name */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Nome Completo do Gestor
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <User className="w-4 h-4" />
              </span>
              <input
                type="text"
                placeholder="Seu nome completo"
                {...register('name')}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
              />
            </div>
            {errors.name && (
              <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              E-mail de Acesso
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                placeholder="seu-email@empresa.com"
                {...register('email')}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-500 font-medium">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Escolha uma senha
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                placeholder="Mínimo 6 caracteres"
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
            className="w-full bg-[#10b981] hover:bg-[#059669] text-white rounded-xl py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-50 mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Criando inquilino multi-tenant...
              </>
            ) : (
              'Concluir Cadastro'
            )}
          </button>
        </form>

        {/* Toggle signin link */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-white/5 pt-6">
          Já possui empresa cadastrada?{' '}
          <Link to="/login" className="text-[#10b981] font-semibold hover:underline">
            Faça login
          </Link>
        </div>

      </div>
    </div>
  );
};
export default Register;
