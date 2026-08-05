import React, { useState } from 'react';
import { X, Download, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

export interface AccountantExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMonth: string;
}

interface ExportSuccess {
  url: string;
  files: number;
  bytes: number;
  omissions: string[];
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const AccountantExportModal: React.FC<AccountantExportModalProps> = ({
  isOpen,
  onClose,
  defaultMonth,
}) => {
  const [fromMonth, setFromMonth] = useState(defaultMonth);
  const [toMonth, setToMonth] = useState(defaultMonth);
  const [includeDocuments, setIncludeDocuments] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportSuccess | null>(null);

  if (!isOpen) return null;

  const invalidRange = fromMonth > toMonth;

  const handleGenerate = async () => {
    if (invalidRange) return;
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) throw new Error('Sessão expirada. Entre novamente.');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accountant-export`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ fromMonth, toMonth, includeDocuments }),
        },
      );

      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.error?.message ?? 'Não foi possível gerar o pacote.');
      }

      setResult({
        url: String(body.url),
        files: Number(body.files ?? 0),
        bytes: Number(body.bytes ?? 0),
        omissions: Array.isArray(body.omissions) ? body.omissions : [],
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha inesperada.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-[#0f1729]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="accountant-export-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="accountant-export-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Exportar para o contador
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-white/60">
              Gera um pacote com apuração, vendas, compras, movimentação financeira, guias e
              documentos do período.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 dark:hover:bg-white/10"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-gray-700 dark:text-white/80">Competência inicial</span>
            <input
              type="month"
              value={fromMonth}
              onChange={(event) => setFromMonth(event.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-gray-700 dark:text-white/80">Competência final</span>
            <input
              type="month"
              value={toMonth}
              onChange={(event) => setToMonth(event.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </label>
        </div>

        {invalidRange && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            A competência inicial precisa ser anterior ou igual à final.
          </p>
        )}

        <label className="mt-4 flex items-start gap-3 rounded-xl border border-gray-200 p-3 dark:border-white/10">
          <input
            type="checkbox"
            className="mt-1"
            checked={includeDocuments}
            onChange={(event) => setIncludeDocuments(event.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium text-gray-900 dark:text-white">Incluir documentos</span>
            <span className="mt-0.5 block text-xs text-gray-500 dark:text-white/60">
              Notas fiscais, boletos e comprovantes do período. Desmarque se o pacote ficar grande
              demais.
            </span>
          </span>
        </label>

        {error && (
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        {result && (
          <div className="mt-4 rounded-xl bg-emerald-500/10 p-4">
            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
              Pacote pronto: {result.files} arquivos, {formatBytes(result.bytes)}.
            </p>
            {result.omissions.length > 0 && (
              <details className="mt-2 text-xs text-emerald-800/80 dark:text-emerald-200/80">
                <summary className="cursor-pointer">
                  {result.omissions.length} documento(s) não puderam ser incluídos
                </summary>
                <ul className="mt-1 space-y-0.5">
                  {result.omissions.map((omission) => (
                    <li key={omission}>• {omission}</li>
                  ))}
                </ul>
              </details>
            )}
            <a
              href={result.url}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Baixar pacote
            </a>
            <p className="mt-2 text-xs text-emerald-800/70 dark:text-emerald-200/70">
              O link expira em 10 minutos por segurança.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500 dark:text-white/50">
            Pacote gerencial. Não é arquivo de obrigação acessória.
          </p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || invalidRange}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B2551] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0B2551]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {isGenerating ? 'Gerando…' : 'Gerar pacote'}
          </button>
        </div>
      </div>
    </div>
  );
};
