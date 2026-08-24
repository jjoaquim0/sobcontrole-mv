import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Document } from '../../../types';

vi.mock('../../../hooks/useDocuments', () => ({
  useDocumentRelatedEntities: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('../../../services/documentService', () => ({
  DOCUMENT_CATEGORIES: [{ value: 'outros', label: 'Outros' }],
  formatFileSize: vi.fn(() => '1 KB'),
}));

vi.mock('../../../services/documentDomain', () => ({
  DOCUMENT_RELATION_TYPES: [],
  DOCUMENT_STORAGE_CONFIG: { accept: '.xml' },
  DOCUMENT_VISIBILITIES: [{ value: 'company', label: 'Empresa', description: 'Toda a empresa' }],
  validateDocumentFile: vi.fn(() => null),
}));

vi.mock('./CategoryIcon', () => ({ CategoryIcon: () => <span data-testid="category-icon" /> }));
vi.mock('./AiSiteIntegrationAction', () => ({ AiSiteIntegrationAction: () => <span data-testid="ai-site-action" /> }));
vi.mock('./DocumentImportAction', () => ({ DocumentImportAction: (props: { document: Document }) => <span data-testid="document-import-action">{props.document.id}</span> }));

import { DocumentUploadModal } from './DocumentUploadModal';

const uploadedDocument = {
  id: 'uploaded-document-1',
  category: 'nota_fiscal',
} as Document;

describe('DocumentUploadModal', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('passa o documento retornado ao CTA de importação após upload', async () => {
    const onUpload = vi.fn().mockResolvedValue(uploadedDocument);
    const { container } = render(<DocumentUploadModal isOpen onClose={vi.fn()} onUpload={onUpload} />);
    const file = new File(['<nfe />'], 'nota.xml', { type: 'application/xml' });
    const fileInput = container.querySelector('input[type="file"]');

    expect(fileInput).not.toBeNull();
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });
    expect(await screen.findByText('nota.xml')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enviar arquivos/ }));
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(file, expect.objectContaining({ category: 'outros' })));
    expect(await screen.findByTestId('document-import-action')).toHaveTextContent('uploaded-document-1');
  });
});
