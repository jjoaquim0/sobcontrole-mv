import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Document } from '../../../types';

const mocks = vi.hoisted(() => ({
  isEligible: vi.fn(),
}));

vi.mock('../../../services/documentImportService', () => ({
  isNfeDocumentImportEligible: mocks.isEligible,
}));

vi.mock('./DocumentImportReviewModal', () => ({
  DocumentImportReviewModal: (props: { isOpen: boolean }) => props.isOpen ? <div data-testid="import-review-modal" /> : null,
}));

import { DocumentImportAction } from './DocumentImportAction';

const document = { id: 'document-1', category: 'nota_fiscal' } as Document;

describe('DocumentImportAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isEligible.mockReturnValue(true);
  });

  it('exibe o CTA próprio do Gestly e abre a revisão', () => {
    render(<DocumentImportAction document={document} />);

    expect(screen.getByRole('button', { name: 'Importar com Gestly' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Importar com Gestly' }));
    expect(screen.getByTestId('import-review-modal')).toBeInTheDocument();
  });

  it('não renderiza para documentos inelegíveis', () => {
    mocks.isEligible.mockReturnValue(false);

    render(<DocumentImportAction document={document} />);

    expect(screen.queryByRole('button', { name: 'Importar com Gestly' })).not.toBeInTheDocument();
  });
});
