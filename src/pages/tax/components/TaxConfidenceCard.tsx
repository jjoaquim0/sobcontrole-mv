import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Info } from 'lucide-react';

export interface TaxConfidenceCardProps {
  /** Fração de 0 a 1 da receita com classificação fiscal explícita. */
  coverage: number | null;
  varianceAvailable: boolean;
  averageVariancePct: number | null;
  varianceSampleSize: number;
  requiresCatalogValidation: boolean;
}

const formatPercent = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value);

/**
 * O bloco de confiança é o que separa este módulo de um chute com aparência de
 * precisão. Ele responde três perguntas antes que o cliente precise fazê-las:
 * quanto da receita está classificada, o quanto a estimativa tem acertado, e se
 * as alíquotas já foram conferidas por um profissional.
 */
export const TaxConfidenceCard: React.FC<TaxConfidenceCardProps> = ({
  coverage,
  varianceAvailable,
  averageVariancePct,
  varianceSampleSize,
  requiresCatalogValidation,
}) => {
  const lowCoverage = coverage !== null && coverage < 0.7;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 rounded-xl p-2 ${
            lowCoverage || requiresCatalogValidation
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {lowCoverage || requiresCatalogValidation ? (
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              O quanto você pode confiar neste número
            </h3>
            <p className="text-xs text-gray-500 dark:text-white/60">
              Estimativa gerencial. Não substitui a apuração do seu contador.
            </p>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500 dark:text-white/60">
                Cobertura de classificação
              </dt>
              <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                {coverage === null ? 'Sem receita no período' : formatPercent(coverage)}
              </dd>
              {coverage !== null && coverage < 1 && (
                <p className="mt-1 text-xs text-gray-500 dark:text-white/60">
                  A receita não classificada usa o anexo padrão da empresa.{' '}
                  <Link
                    to="/contabil/classificacao"
                    className="font-medium text-[#0089b0] underline dark:text-[#53dcff]"
                  >
                    Classificar produtos
                  </Link>
                </p>
              )}
            </div>

            <div>
              <dt className="text-xs text-gray-500 dark:text-white/60">Erro medido</dt>
              <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                {varianceAvailable && averageVariancePct !== null
                  ? `${averageVariancePct > 0 ? '+' : ''}${averageVariancePct.toFixed(1)}%`
                  : 'Ainda não medido'}
              </dd>
              <p className="mt-1 text-xs text-gray-500 dark:text-white/60">
                {varianceAvailable
                  ? `Média das últimas ${varianceSampleSize} competências confirmadas com o contador.`
                  : 'Informe o valor real do DAS por pelo menos duas competências para medir.'}
              </p>
            </div>
          </dl>

          {requiresCatalogValidation && (
            <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                As alíquotas e faixas usadas neste cálculo ainda não foram conferidas contra a
                publicação oficial por um profissional habilitado. Valide com o seu contador antes
                de usar o valor para decisão.
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
