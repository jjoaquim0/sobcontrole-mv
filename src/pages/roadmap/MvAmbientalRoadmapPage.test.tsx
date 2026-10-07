import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MvAmbientalRoadmapPage } from './MvAmbientalRoadmapPage';
import { phases, scope } from './mvAmbientalRoadmap';

describe('MvAmbientalRoadmapPage', () => {
  it('apresenta as seis fases do cronograma de 12 semanas', () => {
    render(<MvAmbientalRoadmapPage />);
    expect(phases).toHaveLength(6);
    expect(phases[0].weekStart).toBe(1);
    expect(phases[phases.length - 1].weekEnd).toBe(12);
    phases.forEach((phase) => {
      expect(screen.getByRole('heading', { name: phase.name })).toBeInTheDocument();
    });
  });

  it('alterna o escopo entre P0, P1 e P2', () => {
    render(<MvAmbientalRoadmapPage />);
    const p0Tab = screen.getByRole('tab', { name: /P0/ });
    const p2Tab = screen.getByRole('tab', { name: /P2/ });
    expect(p0Tab).toHaveAttribute('aria-selected', 'true');

    fireEvent.click(p2Tab);
    expect(p2Tab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(scope.P2.items[0].title)).toBeVisible();
  });

  it('aciona a impressão do navegador para gerar PDF', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    render(<MvAmbientalRoadmapPage />);
    fireEvent.click(screen.getByRole('button', { name: /Imprimir \/ PDF/ }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});
