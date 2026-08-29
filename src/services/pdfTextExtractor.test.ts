import { describe, expect, it, vi } from 'vitest';
import { PDF_SCANNED_MESSAGE, PdfTextExtractionError, extractPdfTextFromDocument } from './pdfTextExtractor';

const page = (items: Array<{ str?: unknown }>) => ({
  getTextContent: vi.fn(async () => ({ items })),
});

describe('extração de texto PDF no navegador', () => {
  it('lê todas as páginas e todos os itens, aplicando trim antes da junção', async () => {
    const pages = [page([{ str: '  CHAVE ' }, { str: ' DE ACESSO ' }]), page([{ str: 'Fornecedor' }, { str: '   ' }, { str: 'DANFE' }])];
    const destroy = vi.fn(async () => {});
    const result = await extractPdfTextFromDocument({ numPages: pages.length, getPage: vi.fn(async (number: number) => pages[number - 1]), destroy });

    expect(result).toEqual({ text: 'CHAVE DE ACESSO\nFornecedor  DANFE', pageCount: 2, nonWhitespaceCharacters: 28 });
    expect(pages[0].getTextContent).toHaveBeenCalledOnce();
    expect(pages[1].getTextContent).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('classifica como escaneado somente quando o total não contém caracteres não-espaço', async () => {
    const destroy = vi.fn(async () => {});
    const document = { numPages: 2, getPage: vi.fn(async () => page([{ str: '  ' }])), destroy };

    await expect(extractPdfTextFromDocument(document)).rejects.toMatchObject({ code: 'pdf_scanned', message: PDF_SCANNED_MESSAGE });
    expect(destroy).toHaveBeenCalledOnce();
  });

  it('preserva o erro de leitura de página para o wrapper público sanitizar', async () => {
    const destroy = vi.fn(async () => {});
    const document = { numPages: 1, getPage: vi.fn(async () => { throw new Error('parser detail'); }), destroy };

    await expect(extractPdfTextFromDocument(document)).rejects.toBeInstanceOf(Error);
    expect(destroy).toHaveBeenCalledOnce();
    expect(PdfTextExtractionError).toBeDefined();
  });
});
