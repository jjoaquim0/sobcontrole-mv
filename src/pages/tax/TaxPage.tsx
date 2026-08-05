import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Coins,
  Landmark,
  Percent,
  TrendingUp,
  CalendarRange,
  Download,
} from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { MetricCard } from '../reports/components/MetricCard';
import { DashboardSection } from '../reports/components/DashboardSection';
import { ReportEmptyState } from '../reports/components/ReportEmptyState';
import { ReportErrorState } from '../reports/components/ReportErrorState';
import { formatCurrency } from '../reports/reportFormatters';
import {
  useRegimeOptionWindows,
  useTaxAssessment,
  useTaxObligations,
  useTaxProfile,
  useTaxVariance,
} from '../../hooks/useTax';
import { TaxConfidenceCard } from './components/TaxConfidenceCard';
import { TaxOnboardingNotice } from './components/TaxOnboardingNotice';
import { AccountantExportModal } from './components/AccountantExportModal';

const REGIME_LABELS: Record<string, string> = {
  mei: 'MEI',
  simples_nacional: 'Simples Nacional',
  lucro_presumido: 'Lucro Presumido',
  lucro_real: 'Lucro Real',
  indeterminado: 'Regime não determinado',
};

const currentMonth = (): string => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

const shiftMonth = (month: string, delta: number): string => {
  const [year, monthNumber] = month.split('-').map(Number);
  const index = year * 12 + (monthNumber - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
};

const formatPercentRate = (rate: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rate);

const formatDate = (value: string): string => {
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

export const TaxPage: React.FC = () => {
  const [referenceMonth, setReferenceMonth] = useState(currentMonth);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const profileQuery = useTaxProfile();
  const assessmentQuery = useTaxAssessment(referenceMonth);
  const varianceQuery = useTaxVariance();
  const windowsQuery = useRegimeOptionWindows();
  const obligationsQuery = useTaxObligations(shiftMonth(referenceMonth, -5), shiftMonth(referenceMonth, 1));

  const profile = profileQuery.data ?? null;
  const computation = assessmentQuery.data ?? null;
  const result = computation?.result ?? null;

  const monthOptions = useMemo(
    () => Array.from({ length: 12 }, (_, index) => shiftMonth(currentMonth(), -index)),
    [],
  );

  const monthLabel = (month: string): string => {
    const [year, monthNumber] = month.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
      new Date(Date.UTC(year, monthNumber - 1, 1)),
    );
  };

  // Sem perfil confirmado a página não exibe nenhum número: zero aqui seria
  // lido como "não tenho imposto a pagar".
  const needsOnboarding = !profile || !profile.isConfirmed || profile.needsReconfirmation;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Contábil"
        subtitle="Área contábil isolada: estimativa gerencial do imposto, classificação fiscal, calendário de guias e exportação para o contador."
        action={
          <button
            type="button"
            onClick={() => setIsExportOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/5"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar para o contador
          </button>
        }
      />

      <AccountantExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultMonth={referenceMonth}
      />

      {/* Janela legal de opção de regime — Reforma Tributária. Aparece mesmo sem
          perfil configurado, porque o prazo corre de qualquer forma. */}
      {(windowsQuery.data ?? []).map((window) => (
        <div
          key={`${window.optionKind}-${window.opensOn}`}
          className="rounded-2xl border border-[#00a8d8]/30 bg-[#00a8d8]/5 p-5"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-[#00a8d8]/15 p-2 text-[#0089b0] dark:text-[#53dcff]">
              <CalendarRange className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{window.label}</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-white/70">{window.description}</p>
              <p className="mt-2 text-xs text-gray-500 dark:text-white/60">
                Janela de {formatDate(window.opensOn)} a {formatDate(window.closesOn)} · efeitos a
                partir de {formatDate(window.effectStartsOn)}
                {window.cancellableUntil
                  ? ` · cancelamento até ${formatDate(window.cancellableUntil)}`
                  : ''}{' '}
                · {window.legalReference}
              </p>
              {window.requiresValidation && (
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Datas ainda não conferidas contra a publicação oficial. Confirme com o seu
                  contador antes de decidir.
                </p>
              )}
            </div>
          </div>
        </div>
      ))}

      {profileQuery.isError && (
        <ReportErrorState onRetry={() => profileQuery.refetch()} />
      )}

      {needsOnboarding && !profileQuery.isLoading && (
        <TaxOnboardingNotice
          needsReconfirmation={Boolean(profile?.needsReconfirmation)}
          reconfirmationReason={profile?.reconfirmationReason ?? null}
        />
      )}

      {!needsOnboarding && (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-[#0B2551] px-3 py-1 text-xs font-semibold text-white">
                {REGIME_LABELS[profile.regime] ?? profile.regime}
              </span>
              {profile.anexo && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-white/80">
                  Anexo {profile.anexo}
                </span>
              )}
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-white/80">
                Base: {profile.revenueBasis === 'caixa' ? 'regime de caixa' : 'competência'}
              </span>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-500 dark:text-white/60">Competência</span>
              <select
                value={referenceMonth}
                onChange={(event) => setReferenceMonth(event.target.value)}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
              >
                {monthOptions.map((month) => (
                  <option key={month} value={month}>
                    {monthLabel(month)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {assessmentQuery.isError && (
            <ReportErrorState onRetry={() => assessmentQuery.refetch()} />
          )}

          {/* Não calculável não é erro: é ausência de condição, e a mensagem diz
              exatamente o que fazer para destravar. */}
          {result?.status === 'not_calculable' && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Não é possível estimar o imposto desta competência
              </h3>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">{result.message}</p>
              <p className="mt-3 text-xs text-amber-700/80 dark:text-amber-300/80">
                Receita apurada no período: {formatCurrency(result.grossRevenueMonth)}
              </p>
            </div>
          )}

          {result?.status === 'calculated' && (
            <>
              <DashboardSection
                title="Apuração da competência"
                description="Valores gerenciais estimados a partir das vendas do período."
                icon={<Coins className="h-5 w-5" aria-hidden="true" />}
              >
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard
                    title="Receita do mês"
                    value={formatCurrency(result.grossRevenueMonth)}
                    icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
                    description="Receita bruta das vendas não canceladas na competência."
                    isLoading={assessmentQuery.isLoading}
                  />
                  <MetricCard
                    title="RBT12"
                    value={formatCurrency(result.rbt12)}
                    icon={<Landmark className="h-5 w-5" aria-hidden="true" />}
                    description={
                      result.rbt12MonthsFromSystem < 12
                        ? `Receita dos 12 meses anteriores. ${result.rbt12MonthsFromSystem} de 12 meses vêm do sistema; o restante, da carga inicial informada.`
                        : 'Receita bruta total dos 12 meses anteriores à competência.'
                    }
                    isLoading={assessmentQuery.isLoading}
                  />
                  <MetricCard
                    title="Alíquota efetiva"
                    value={
                      result.perAnexo.length === 1
                        ? formatPercentRate(result.perAnexo[0].appliedRate)
                        : result.perAnexo.length === 0
                          ? '—'
                          : 'Por anexo'
                    }
                    icon={<Percent className="h-5 w-5" aria-hidden="true" />}
                    description={
                      result.regime === 'mei'
                        ? 'O MEI recolhe valor fixo; não há alíquota sobre a receita.'
                        : '(RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12.'
                    }
                    isLoading={assessmentQuery.isLoading}
                  />
                  <MetricCard
                    title="Imposto estimado"
                    value={formatCurrency(result.estimatedTax)}
                    icon={<Coins className="h-5 w-5" aria-hidden="true" />}
                    description="Estimativa gerencial. Confirme o valor real com o seu contador."
                    accent="brand"
                    isLoading={assessmentQuery.isLoading}
                  />
                </div>
              </DashboardSection>

              {/* Com mais de um anexo, esconder a segregação atrás de um número
                  único apagaria justamente o que dá precisão ao cálculo. */}
              {result.perAnexo.length > 1 && (
                <DashboardSection
                  title="Detalhamento por anexo"
                  description="A receita do mês foi segregada pela classificação fiscal dos produtos."
                >
                  <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-white/60">
                        <tr>
                          <th className="px-4 py-3">Anexo</th>
                          <th className="px-4 py-3">Receita</th>
                          <th className="px-4 py-3">Fora da base</th>
                          <th className="px-4 py-3">Base tributável</th>
                          <th className="px-4 py-3">Alíquota</th>
                          <th className="px-4 py-3">Imposto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                        {result.perAnexo.map((entry) => (
                          <tr key={entry.anexo}>
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                              Anexo {entry.anexo}
                              {entry.fatorRApplied && (
                                <span className="ml-2 rounded-full bg-[#00a8d8]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0089b0] dark:text-[#53dcff]">
                                  Fator R → {entry.appliedAnexo}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">{formatCurrency(entry.grossRevenue)}</td>
                            <td className="px-4 py-3">{formatCurrency(entry.exemptRevenue)}</td>
                            <td className="px-4 py-3">{formatCurrency(entry.taxableBase)}</td>
                            <td className="px-4 py-3">{formatPercentRate(entry.appliedRate)}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                              {formatCurrency(entry.tax)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </DashboardSection>
              )}

              <TaxConfidenceCard
                coverage={computation?.classificationCoverage ?? null}
                varianceAvailable={varianceQuery.data?.available ?? false}
                averageVariancePct={varianceQuery.data?.averageVariancePct ?? null}
                varianceSampleSize={varianceQuery.data?.sampleSize ?? 0}
                requiresCatalogValidation={result.requiresCatalogValidation}
              />

              {result.warnings.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Observações sobre este cálculo
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-300">
                    {result.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <DashboardSection
            title="Calendário de obrigações"
            description="Guias geradas a partir das apurações, espelhadas no contas a pagar."
            icon={<CalendarClock className="h-5 w-5" aria-hidden="true" />}
          >
            {(obligationsQuery.data ?? []).length === 0 ? (
              <ReportEmptyState
                title="Nenhuma guia no período"
                description="As guias aparecem aqui assim que a apuração de uma competência é gravada."
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-white/5 dark:text-white/60">
                    <tr>
                      <th className="px-4 py-3">Guia</th>
                      <th className="px-4 py-3">Competência</th>
                      <th className="px-4 py-3">Vencimento</th>
                      <th className="px-4 py-3">Valor</th>
                      <th className="px-4 py-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/10">
                    {(obligationsQuery.data ?? []).map((obligation) => {
                      const overdue =
                        obligation.status === 'pending' &&
                        obligation.dueDate < new Date().toISOString().slice(0, 10);
                      return (
                        <tr key={obligation.id}>
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                            {obligation.label}
                          </td>
                          <td className="px-4 py-3">{obligation.referenceMonth}</td>
                          <td className="px-4 py-3">{formatDate(obligation.dueDate)}</td>
                          <td className="px-4 py-3">{formatCurrency(obligation.amount)}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                obligation.status === 'paid'
                                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                  : overdue
                                    ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                                    : 'bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white/80'
                              }`}
                            >
                              {obligation.status === 'paid'
                                ? 'Paga'
                                : overdue
                                  ? 'Vencida'
                                  : 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DashboardSection>
        </>
      )}

      <p className="rounded-2xl bg-gray-50 p-4 text-xs text-gray-500 dark:bg-white/5 dark:text-white/50">
        Os valores desta página são <strong>estimativas gerenciais</strong> calculadas a partir dos
        dados do seu sistema. Eles não constituem apuração fiscal, não têm validade declaratória e
        não substituem o trabalho do seu contador. O SobControle não emite nem transmite documentos
        fiscais.
      </p>
    </div>
  );
};
