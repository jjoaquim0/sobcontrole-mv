import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Package,
  Users,
  WalletCards,
} from 'lucide-react';
import { Logo } from '@/components/shared/brand';
import { focusRing } from '@/pages/landing/landingTheme';

interface AuthLayoutProps {
  children: ReactNode;
  eyebrow: string;
}

const productAreas = [
  { label: 'Vendas', detail: 'Pipeline em dia', icon: BarChart3 },
  { label: 'Clientes', detail: 'Relacionamento centralizado', icon: Users },
  { label: 'Financeiro', detail: 'Caixa sob controle', icon: WalletCards },
  { label: 'Estoque', detail: 'Reposição inteligente', icon: Package },
];

export function AuthLayout({ children, eyebrow }: AuthLayoutProps) {
  return (
    <main className="auth-theme relative min-h-screen overflow-hidden bg-landing-bg text-landing-text">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_top_right,rgb(var(--landing-brand-glow)/0.38),transparent_58%)]"
      />

      <Link
        to="/"
        className={`absolute left-4 top-5 z-20 inline-flex min-h-11 items-center gap-2 rounded-full border border-landing-border bg-landing-surface/90 px-4 text-sm font-semibold text-landing-text-secondary shadow-landing-sm backdrop-blur-sm transition-colors hover:border-landing-brand/35 hover:text-landing-brand sm:left-6 lg:left-8 ${focusRing}`}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para o site
      </Link>

      <div className="relative mx-auto grid min-h-screen w-full max-w-[90rem] lg:grid-cols-[minmax(0,1fr)_minmax(30rem,0.78fr)]">
        <section
          aria-labelledby="auth-value-title"
          className="hidden px-12 pb-12 pt-28 lg:flex lg:flex-col xl:px-20 xl:pb-16"
        >
          <Logo
            variant="cor"
            symbolClassName="h-10 w-10"
            wordmarkClassName="text-[1.65rem]"
          />

          <div className="my-auto max-w-2xl py-14">
            <div className="inline-flex items-center gap-2 rounded-full border border-landing-border bg-landing-surface px-3 py-1.5 text-xs font-semibold text-landing-brand shadow-landing-sm">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {eyebrow}
            </div>
            <h2
              id="auth-value-title"
              className="mt-6 max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-landing-text xl:text-5xl"
            >
              Sua empresa inteira, em uma visão clara.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-landing-text-secondary xl:text-lg">
              Centralize vendas, clientes, financeiro e estoque para transformar a rotina da sua
              equipe em decisões mais rápidas e seguras.
            </p>

            <div className="mt-10 rounded-3xl border border-landing-border bg-landing-surface p-5 shadow-landing-lg">
              <div className="flex items-center justify-between border-b border-landing-border pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-landing-text-muted">
                    Visão da operação
                  </p>
                  <p className="mt-1 text-sm font-semibold text-landing-text">Tudo conectado</p>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-landing-success/10 px-3 py-1.5 text-xs font-semibold text-landing-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-landing-success" aria-hidden="true" />
                  Atualizado agora
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {productAreas.map(({ label, detail, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-landing-border bg-landing-surface-muted p-4"
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-landing-surface text-landing-brand shadow-landing-sm">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="mt-4 text-sm font-semibold text-landing-text">{label}</p>
                    <p className="mt-1 text-xs leading-5 text-landing-text-muted">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-xs leading-5 text-landing-text-muted">
            Gestão simples para PMEs que querem crescer com controle.
          </p>
        </section>

        <section className="flex min-h-screen items-center px-4 pb-8 pt-24 sm:px-8 sm:pb-12 lg:border-l lg:border-landing-border lg:bg-landing-surface/55 lg:px-8 xl:px-12 2xl:px-16">
          <div className="mx-auto w-full max-w-xl">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <Logo
                variant="cor"
                symbolClassName="h-9 w-9"
                wordmarkClassName="text-2xl"
              />
              <span className="h-5 w-px bg-landing-border" aria-hidden="true" />
              <p className="text-xs leading-5 text-landing-text-secondary">
                Gestão integrada para sua empresa.
              </p>
            </div>

            <div className="rounded-3xl border border-landing-border bg-landing-surface p-6 shadow-landing-lg sm:p-8 xl:p-10">
              {children}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
