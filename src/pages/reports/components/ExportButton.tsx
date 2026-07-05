import React from 'react';
import { Download } from 'lucide-react';

interface ExportButtonProps {
  onExport: () => void;
  disabled?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ onExport, disabled }) => {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={disabled}
      className="border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300 transition-colors duration-200 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Download className="w-4 h-4" />
      Exportar
    </button>
  );
};
