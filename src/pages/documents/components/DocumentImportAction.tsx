import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Document } from '../../../types';
import { isNfeDocumentImportEligible } from '../../../services/documentImportService';
import { DocumentImportReviewModal } from './DocumentImportReviewModal';

export interface DocumentImportActionProps {
  document: Document;
  compact?: boolean;
  className?: string;
}

export const DocumentImportAction: React.FC<DocumentImportActionProps> = ({ document, compact = false, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!isNfeDocumentImportEligible(document)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Importar com Gestly"
        className={compact
          ? `inline-flex items-center gap-1.5 rounded-lg bg-[#0B2551] px-2.5 py-1.5 text-xs font-semibold text-white outline-none transition-colors hover:bg-[#12366f] focus-visible:ring-2 focus-visible:ring-cyan-400 dark:bg-cyan-950/70 dark:hover:bg-cyan-900/80 ${className}`
          : `flex w-full items-start gap-3 rounded-xl border border-cyan-200 bg-gradient-to-r from-[#0B2551] to-[#00a8d6] px-4 py-3 text-left text-white outline-none transition-colors hover:from-[#12366f] hover:to-[#00b9e8] focus-visible:ring-2 focus-visible:ring-cyan-400 ${className}`}
      >
        <Sparkles className={compact ? 'h-3.5 w-3.5 shrink-0' : 'mt-0.5 h-5 w-5 shrink-0'} />
        <span className={compact ? '' : 'min-w-0 flex-1'}>
          <span className={compact ? '' : 'block text-sm font-bold'}>Importar com Gestly</span>
          {!compact && <span className="mt-0.5 block text-xs text-cyan-50">Revise fornecedor, compra e contas a pagar antes de confirmar.</span>}
        </span>
      </button>
      <DocumentImportReviewModal isOpen={isOpen} onClose={() => setIsOpen(false)} document={document} />
    </>
  );
};
