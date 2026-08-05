import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Landing } from './index';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

// A landing usa `whileInView` (framer-motion) e `MotionConfig reducedMotion="user"`;
// o jsdom não implementa IntersectionObserver nem matchMedia.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
  );

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  );
});

afterAll(() => {
  vi.unstubAllGlobals();
});

const renderLanding = () =>
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  );

describe('Landing — tema claro', () => {
  it('aplica o escopo landing-theme e os tokens claros no root', () => {
    const { container } = renderLanding();
    const root = container.querySelector('.landing-theme');

    expect(root).not.toBeNull();
    expect(root).toHaveClass('bg-landing-bg', 'text-landing-text');
  });

  it('não deixa resíduo do tema escuro anterior na árvore da landing', () => {
    const { container } = renderLanding();

    // O tema escuro dependia destas classes/cores fixas; nenhuma deve sobrar.
    expect(container.querySelector('.liquid-glass')).toBeNull();
    expect(container.querySelector('[class*="bg-[#0c0c0c]"]')).toBeNull();
    expect(container.querySelector('[class*="text-white/"]')).toBeNull();
    expect(container.querySelector('[class*="border-white/"]')).toBeNull();
  });

  it('mantém o CTA principal apontando para o cadastro', () => {
    renderLanding();

    const ctas = screen.getAllByRole('link', { name: /Começar grátis/i });
    expect(ctas.length).toBeGreaterThan(0);
    expect(ctas[0]).toHaveAttribute('href', '/register');
  });

  it('mantém o accordion do FAQ acessível e funcional no tema claro', () => {
    renderLanding();

    const first = screen.getByRole('button', {
      name: 'O SobControle é indicado para qual tipo de empresa?',
    });
    const second = screen.getByRole('button', {
      name: 'Posso gerenciar vendas, clientes e financeiro no mesmo sistema?',
    });

    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(second).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('apresenta a gestão inteligente depois dos módulos e sinaliza o insight futuro', () => {
    renderLanding();

    const modulesHeading = screen.getByRole('heading', {
      name: /Conheça o SobControle por dentro/i,
    });
    const intelligenceHeading = screen.getByRole('heading', {
      name: 'Pare de perder dinheiro por falta de visão da sua empresa.',
    });
    const modulesSection = modulesHeading.closest('section');
    const intelligenceSection = intelligenceHeading.closest('section');

    expect(modulesSection).not.toBeNull();
    expect(intelligenceSection).toHaveAttribute('id', 'gestly');
    expect(
      modulesSection!.compareDocumentPosition(intelligenceSection!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      screen.getByText('O SobControle organiza a empresa. O Gestly ajuda a empresa a agir.')
    ).toBeInTheDocument();

    const futureInsight = screen
      .getByText('Sua receita do período está abaixo da meta definida.')
      .closest('li');

    expect(futureInsight).not.toBeNull();
    expect(within(futureInsight!).getByText('Visão futura')).toBeInTheDocument();
  });
});
