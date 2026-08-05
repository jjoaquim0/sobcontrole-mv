import React from 'react';
import { Link } from 'react-router-dom';
import { FileSearch, ArrowRight, AlertTriangle } from 'lucide-react';

export interface TaxOnboardingNoticeProps {
  needsReconfirmation?: boolean;
  reconfirmationReason?: string | null;
}

/**
 * Sem perfil tributário confirmado, a página NÃO mostra indicador numérico.
 * Exibir zeros ou traços aqui convidaria o cliente a interpretar ausência de
 * configuração como ausência de imposto.
 */
export const TaxOnboardingNotice: React.FC<TaxOnboardingNoticeProps> = ({
  needsReconfirmation = false,
  reconfirmationReason = null,
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center dark:border-white/10 dark:bg-white/5">
    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#00a8d8]/10 text-[#0089b0] dark:text-[#53dcff]">
      {needsReconfirmation ? (
        <AlertTriangle className="h-7 w-7" aria-hidden="true" />
      ) : (
        <FileSearch className="h-7 w-7" aria-hidden="true" />
      )}
    </div>

    <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
      {needsReconfirmation
        ? 'Seu regime tributário mudou'
        : 'Vamos identificar o regime tributário da sua empresa'}
    </h2>

    <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600 dark:text-white/70">
      {needsReconfirmation ? (
        <>
          {reconfirmationReason ??
            'A consulta ao cadastro da Receita indica mudança no seu regime.'}{' '}
          Confirme o perfil para que a apuração volte a refletir a realidade da empresa.
        </>
      ) : (
        <>
          O sistema consulta o CNPJ cadastrado na sua empresa e descobre sozinho se você é MEI,
          optante do Simples Nacional ou de outro regime. Você só precisa confirmar — não é
          necessário saber o seu anexo de cor.
        </>
      )}
    </p>

    <Link
      to="/contabil/configuracao"
      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#0B2551] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B2551]/90"
    >
      {needsReconfirmation ? 'Reconfirmar perfil' : 'Identificar meu regime'}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>

    <p className="mt-4 text-xs text-gray-500 dark:text-white/50">
      Os valores apresentados aqui são gerenciais e não substituem a apuração do seu contador.
    </p>
  </div>
);
