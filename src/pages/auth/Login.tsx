import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, CircleAlert, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { focusRing } from '@/pages/landing/landingTheme';
import { AuthLayout } from './components/AuthLayout';
import { AuthField, PasswordField } from './components/AuthField';
import { getFriendlyAuthError } from './authMessages';

const loginSchema = z.object({
  email: z.string()
    .min(1, 'O e-mail é obrigatório')
    .email('Insira um endereço de e-mail válido'),
  password: z.string()
    .min(6, 'A senha deve conter no mínimo 6 caracteres'),
});

type LoginFields = z.infer<typeof loginSchema>;

interface LoginLocationState {
  emailConfirmationRequired?: boolean;
}

export const Login: React.FC = () => {
  const { signIn, isLoading, error, isAuthenticated, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFields>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
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

  const onSubmit = async (data: LoginFields) => {
    await signIn(data.email, data.password);
  };

  const busy = isLoading || isSubmitting;
  const friendlyError = getFriendlyAuthError(error, 'login');
  const locationState = location.state as LoginLocationState | null;

  return (
    <AuthLayout eyebrow="Acesso seguro ao SobControle">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-landing-brand">
          Área do cliente
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-landing-text sm:text-4xl">
          Bem-vindo de volta
        </h1>
        <p className="mt-3 text-sm leading-6 text-landing-text-secondary sm:text-base">
          Entre para acompanhar sua operação e continuar de onde parou.
        </p>
      </header>

      {locationState?.emailConfirmationRequired && (
        <div
          role="status"
          className="mt-6 flex items-start gap-3 rounded-xl border border-landing-success/25 bg-landing-success/10 p-4 text-sm leading-6 text-landing-success"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p>
            Cadastro recebido. Confira seu e-mail para confirmar a conta antes de entrar.
          </p>
        </div>
      )}

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
        <AuthField
          id="login-email"
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

        <PasswordField
          id="login-password"
          label="Senha"
          placeholder="Digite sua senha"
          autoComplete="current-password"
          disabled={busy}
          error={errors.password?.message}
          {...register('password')}
        />

        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-landing-brand px-4 text-sm font-semibold text-white shadow-landing transition-colors hover:bg-landing-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-landing-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Entrando...
            </>
          ) : (
            'Entrar'
          )}
        </button>
      </form>

      <p className="mt-7 border-t border-landing-border pt-6 text-center text-sm text-landing-text-secondary">
        Ainda não tem conta?{' '}
        <Link
          to="/register"
          className={`rounded-sm font-semibold text-landing-brand transition-colors hover:text-landing-brand-hover ${focusRing}`}
        >
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
};

export default Login;
