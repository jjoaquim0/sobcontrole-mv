import React from 'react';
import { Loader2, Database, Download, Upload, Trash2 } from 'lucide-react';
import { useSettings } from '../../../hooks/useSettings';

const cardClass = 'bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl shadow-sm p-6';

export const DataTab: React.FC = () => {
  const { exportData, isExporting } = useSettings();

  const handleExport = async () => {
    await exportData().catch(() => undefined);
  };

  return (
    <div className="space-y-6">
      <div className={cardClass}>
        <div className="flex items-center gap-3 border-b border-gray-100 dark:border-white/5 pb-4 mb-6">
          <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
            <Database className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dados</h2>
            <p className="text-sm text-gray-500 dark:text-white/50">Exporte, importe e gerencie os dados da empresa</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-gray-100 dark:border-white/5 bg-gray-50/60 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-white dark:bg-white/5 text-gray-500 dark:text-gray-300 border border-gray-100 dark:border-white/5">
              <Download className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Exportar Tudo</h3>
              <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">Baixe todos os seus dados em formato JSON.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="bg-[#10b981] hover:bg-[#059669] text-white rounded-xl px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 transition-colors duration-200 shadow-md shadow-emerald-500/10 disabled:opacity-70 shrink-0"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Exportando...' : 'Exportar Tudo'}
          </button>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-4">
          <span className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-300">
            <Upload className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Importar Dados</h3>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">Restaure dados a partir de um arquivo de backup.</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <Upload className="w-8 h-8 text-gray-300 dark:text-white/20 mb-2" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Em breve</p>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1 max-w-xs">
            A importação de dados estará disponível em breve.
          </p>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center gap-3 mb-4">
          <span className="p-2 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-300">
            <Trash2 className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Limpar Dados de Teste</h3>
            <p className="text-xs text-gray-500 dark:text-white/50 mt-0.5">
              Remova os dados de demonstração para começar com uma base limpa.
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-200 dark:border-white/10 rounded-2xl">
          <Trash2 className="w-8 h-8 text-gray-300 dark:text-white/20 mb-2" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Em breve</p>
          <p className="text-xs text-gray-500 dark:text-white/50 mt-1 max-w-xs">
            A limpeza de dados de teste estará disponível em breve.
          </p>
        </div>
      </div>
    </div>
  );
};
