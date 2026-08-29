export type PdfTextExtractionErrorCode = 'pdf_scanned' | 'pdf_text_extraction_failed';

export const PDF_SCANNED_MESSAGE = 'Não conseguimos ler o texto deste arquivo. Ele parece ser uma imagem escaneada, e no momento não lemos PDFs escaneados.';

export class PdfTextExtractionError extends Error {
  readonly code: PdfTextExtractionErrorCode;

  constructor(code: PdfTextExtractionErrorCode, message = code === 'pdf_scanned' ? PDF_SCANNED_MESSAGE : 'Não foi possível ler o texto deste PDF. Tente novamente ou salve só o arquivo.') {
    super(message);
    this.name = 'PdfTextExtractionError';
    this.code = code;
  }
}

export interface PdfTextExtractionResult {
  text: string;
  pageCount: number;
  nonWhitespaceCharacters: number;
}

interface PdfTextContentItem {
  str?: unknown;
}

export interface PdfTextDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{ getTextContent: () => Promise<{ items: PdfTextContentItem[] }> }>;
  destroy: () => Promise<void>;
}

export const extractPdfTextFromDocument = async (pdf: PdfTextDocument): Promise<PdfTextExtractionResult> => {
  const pageCount = pdf.numPages;
  const pageTexts: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pageTexts.push(content.items
        .map((item) => typeof item.str === 'string' ? item.str.trim() : '')
        .join(' '));
    }
  } finally {
    await pdf.destroy();
  }

  const text = pageTexts.join('\n');
  const nonWhitespaceCharacters = text.replace(/\s/g, '').length;
  if (nonWhitespaceCharacters === 0) throw new PdfTextExtractionError('pdf_scanned');

  return { text, pageCount, nonWhitespaceCharacters };
};

export const extractPdfText = async (file: Blob): Promise<PdfTextExtractionResult> => {
  try {
    const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/build/pdf.mjs');
    GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString();

    const loadingTask = getDocument({ data: await file.arrayBuffer() });
    const pdf = await loadingTask.promise;
    return await extractPdfTextFromDocument(pdf);
  } catch (error) {
    if (error instanceof PdfTextExtractionError) throw error;
    throw new PdfTextExtractionError('pdf_text_extraction_failed');
  }
};
