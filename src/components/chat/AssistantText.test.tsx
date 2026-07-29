import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AssistantText } from './AssistantText';
import { parseAssistantBlocks } from './assistantFormat';

describe('AssistantText', () => {
  it('separa parágrafos e listas sem exibir hífens ou asteriscos crus', () => {
    const blocks = parseAssistantBlocks(
      'Você tem **9 produtos** ativos.\n\n- Casadinho — 12 un (mínimo 5)\n- Brigadeiro — 3 un (mínimo 5)',
    );

    expect(blocks).toEqual([
      { type: 'paragraph', text: 'Você tem **9 produtos** ativos.' },
      {
        type: 'list',
        items: ['Casadinho — 12 un (mínimo 5)', 'Brigadeiro — 3 un (mínimo 5)'],
      },
    ]);
  });

  it('trata marcadores alternativos e ignora linhas vazias', () => {
    expect(
      parseAssistantBlocks('Resumo:\n\n• Item A\n* Item B\n\n\nFim.'),
    ).toEqual([
      { type: 'paragraph', text: 'Resumo:' },
      { type: 'list', items: ['Item A', 'Item B'] },
      { type: 'paragraph', text: 'Fim.' },
    ]);
  });

  it('renderiza negrito como elemento e não como texto literal', () => {
    render(<AssistantText content="Você vendeu **R$ 12.450,00** neste mês." />);

    expect(screen.getByText('R$ 12.450,00').tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).toBeNull();
  });

  it('renderiza cada item da lista como li sem o marcador textual', () => {
    render(<AssistantText content={'Produtos em falta:\n- Casadinho — 0 un\n- Beijinho — 0 un'} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Casadinho — 0 un');
    expect(items[0].textContent?.startsWith('-')).toBe(false);
  });

  it('mantém o texto original quando não há estrutura reconhecida', () => {
    render(<AssistantText content="Olá! Sou a Gestly." />);
    expect(screen.getByText('Olá! Sou a Gestly.')).toBeInTheDocument();
  });
});
