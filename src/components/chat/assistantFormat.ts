export type AssistantBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] };

const LIST_MARKER = /^[-•*]\s+/;

/**
 * Converte o texto da Gestly em blocos simples de parágrafo e lista.
 *
 * O provider é instruído a responder em texto curto com listas em "- ", então
 * aqui não há um parser de Markdown completo: apenas o suficiente para o chat
 * não exibir hífens e asteriscos crus, como acontecia antes.
 */
export const parseAssistantBlocks = (content: string): AssistantBlock[] => {
  const blocks: AssistantBlock[] = [];
  let paragraph: string[] = [];
  let items: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };

  const flushList = () => {
    if (items.length > 0) {
      blocks.push({ type: 'list', items });
      items = [];
    }
  };

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (LIST_MARKER.test(line)) {
      flushParagraph();
      const item = line.replace(LIST_MARKER, '').trim();
      if (item) items.push(item);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();

  return blocks;
};

/** Divide o texto em trechos normais e trechos marcados com **negrito**. */
export const splitBoldSegments = (text: string): { bold: boolean; text: string }[] =>
  text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter((part) => part !== '')
    .map((part) =>
      part.length > 4 && part.startsWith('**') && part.endsWith('**')
        ? { bold: true, text: part.slice(2, -2) }
        : { bold: false, text: part },
    );
