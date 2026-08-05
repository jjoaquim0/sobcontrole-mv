import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CircleAlert, FileDigit, Loader2, Mail, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { focusRing } from '@/pages/landing/landingTheme';
import { AuthLayout } from './components/AuthLayout';
import { AuthField, PasswordField } from './components/AuthField';
import { getFriendlyAuthError } from './authMessages';

const registerSchema = z.object({
  companyName: z.string()
    .min(3, 'O nome da empresa deve ter no mínimo 3 caracteres'),
  cnpj: z.string()
    .min(14, 'O CNPJ deve ter no mínimo 14 números')
    .max(18, 'O CNPJ está muito longo')
    .refine((value) => value.replace(/\D/g, '').length === 14, 'O CNPJ deve conter exatamente 14 dígitos numéricos'),
  name: z.string()
    .min(3, 'Seu nome deve conter no mínimo 3 caracteres'),
  email: z.string()
    .min(1, 'O e-mail é obrigatório')
    .email('Insira um e-mail corporativo válido'),
  password: z.string()
    .min(6, 'A senha deve conter no mínimo 6 caracteres'),
  confirmPassword: z.string()
    .min(1, 'Confirme a senha escolhida'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

type RegisterFields = z.infer<typeof registerSchema>;

export const Register: React.FC = () => {
  const { signUp, isLoading, error, isAuthenticated, clearError } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFields>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      companyName: '',
      cnpj: '',
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    clearError();
  }, [clearError]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleCnpjChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value = event.target.value.replace(/\D/g, '').slice(0, 14);

    if (value.length > 12) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    } else if (value.length > 8) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4})$/, '$1.$2.$3/$4');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{3})(\d{1,3})$/, '$1.$2.$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{1,3})$/, '$1.$2');
    }

    setValue('cnpj', value, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (data: RegisterFields) => {
    const cleanCnpj = data.cnpj.replace(/\D/g, '');
    const result = await signUp(data.email, data.password, data.name, data.companyName, cleanCnpj);

    if (result?.needsEmailConfirmation) {
      navigate('/login', {
        replace: true,
        state: { emailConfirmationRequired: true },
      });
    }
  };

  const busy = isLoading || isSubmitting;
  const friendlyError = getFriendlyAuthError(error, 'register');
  const cnpjRegistration = register('cnpj');

  return (
    <AuthLayout eyebrow="Comece com uma operação organizada">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-landing-brand">
          Nova conta
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-landing-text sm:text-4xl">
          Crie sua conta
        </h1>
        <p className="mt-3 text-sm leading-6 text-landing-text-secondary sm:text-base">
          Cadastre sua empresa e prepare seu espaço de gestão em poucos minutos.
        </p>
      </header>

      {friendlyError && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-xl border border-landing-danger/25 bg-landing-danger/10 p-4 text-sm leading-6 text-landing-danger"
        >
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>{friendlyError}</p>
        </div>
      )}

      <form
        noValidate
        aria-busy={busy}
        onSubmit={handleSubmit(onSubmit)}
        className="mt-7 space-y-5"
      >
        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
          <AuthField
            id="register-company"
            type="text"
            label="Nome da empresa"
            placeholder="Sua empresa"
            autoComplete="organization"
            icon={Building2}
            disabled={busy}
            error={errors.companyName?.message}
            {...register('companyName')}
          />

          <AuthField
            id="register-cnpj"
            type="text"
            label="CNPJ"
            placeholder="00.000.000/0000-00"
            inputMode="numeric"
            autoComplete="off"
            maxLength={18}
            icon={FileDigit}
            disabled={busy}
            error={errors.cnpj?.message}
            {...cnpjRegistration}
            onChange={handleCnpjChange}
          />
        </div>

        <AuthField
          id="register-name"
          type="text"
          label="Nome completo"
          placeholder="Seu nome completo"
          autoComplete="name"
          icon={User}
          disabled={busy}
          error={errors.name?.message}
          {...register('name')}
        />

        <AuthField
          id="register-email"
          type="email"
          label="E-mail"
          placeholder="nome@empresa.com"
          autoComplete="email"
          inputMode="email"
          icon={Mail}
          disabled={busy}
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
          <PasswordField
            id="register-password"
            label="Senha"
            placeholder="Mínimo de 6 caracteres"
            autoComplete="new-password"
            disabled={busy}
            error={errors.password?.message}
            hint="Use pelo menos 6 caracteres."
            {...register('password')}
          />

          <PasswordField
            id="register-password-confirmation"
            label="Confirmar senha"
            placeholder="Digite novamente"
            autoComplete="new-password"
            disabled={busy}
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-landing-brand px-4 text-sm font-semibold text-white shadow-landing transition-colors hover:bg-landing-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Criando sua conta...
            </>
          ) : (
            'Criar minha conta'
          )}
        </button>
      </form>

      <p className="mt-7 border-t border-landing-border pt-6 text-center text-sm text-landing-text-secondary">
        Já possui uma conta?{' '}
        <Link
          to="/login"
          className={`rounded-sm font-semibold text-landing-brand transition-colors hover:text-landing-brand-hover ${focusRing}`}
        >
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Register;
