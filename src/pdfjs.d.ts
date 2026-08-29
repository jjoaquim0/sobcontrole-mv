declare module 'pdfjs-dist/build/pdf.mjs' {
  interface PdfTextContent {
    items: Array<{ str?: unknown }>;
  }

  interface PdfPage {
    getTextContent: () => Promise<PdfTextContent>;
  }

  interface PdfDocument {
    numPages: number;
    getPage: (pageNumber: number) => Promise<PdfPage>;
    destroy: () => Promise<void>;
  }

  interface PdfLoadingTask {
    promise: Promise<PdfDocument>;
  }

  export const GlobalWorkerOptions: { workerSrc: string };
  export const getDocument: (options: { data: ArrayBuffer }) => PdfLoadingTask;
}
