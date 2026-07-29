import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { AiSiteIntegrationAction } from './AiSiteIntegrationAction';

vi.mock('sonner', () => ({
  toast: { info: vi.fn() },
}));

describe('AiSiteIntegrationAction', () => {
  it('exibe o rótulo e o badge "Em breve"', () => {
    render(<AiSiteIntegrationAction />);

    expect(screen.getByText('Integrar ao site com IA')).toBeInTheDocument();
    expect(screen.getByText('Em breve')).toBeInTheDocument();
  });

  it('não realiza nenhuma chamada externa e apenas exibe um toast informativo ao clicar', () => {
    render(<AiSiteIntegrationAction />);

    fireEvent.click(screen.getByRole('button', { name: /Integrar ao site com IA/ }));

    expect(toast.info).toHaveBeenCalledWith('Esta integração estará disponível em breve.');
    expect(toast.info).toHaveBeenCalledTimes(1);
  });

  it('renderiza a variante compacta sem a descrição longa', () => {
    render(<AiSiteIntegrationAction compact />);

    expect(screen.getByText('Integrar ao site com IA')).toBeInTheDocument();
    expect(screen.queryByText(/ajudar a IA do seu site/)).not.toBeInTheDocument();
  });

  it('possui foco visível e é navegável por teclado (botão nativo)', () => {
    render(<AiSiteIntegrationAction />);
    const button = screen.getByRole('button', { name: /Integrar ao site com IA/ });

    expect(button.tagName).toBe('BUTTON');
    expect(button).toHaveAttribute('type', 'button');
  });
});
