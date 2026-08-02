import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MetricCard } from './MetricCard';

const renderCard = (props: Partial<React.ComponentProps<typeof MetricCard>> = {}) =>
  render(
    <MemoryRouter>
      <MetricCard
        title="Receita paga"
        value="R$ 12.345,67"
        icon={<span aria-hidden="true">$</span>}
        description="Soma do valor final das vendas pagas no período."
        {...props}
      />
    </MemoryRouter>
  );

describe('MetricCard', () => {
  it('exibe valor em BRL, definição, tendência e drilldown', () => {
    renderCard({
      trend: -12.5,
      href: '/relatorios/vendas-pipeline',
      actionLabel: 'Analisar vendas',
    });

    expect(screen.getByText('R$ 12.345,67')).toBeInTheDocument();
    expect(screen.getByLabelText(/Definição:/)).toHaveAttribute(
      'title',
      'Soma do valor final das vendas pagas no período.'
    );
    expect(screen.getByText('12,5%')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Analisar vendas/ })).toHaveAttribute(
      'href',
      '/relatorios/vendas-pipeline'
    );
  });

  it('não fabrica um valor quando a cobertura é insuficiente', () => {
    renderCard({ insufficientLabel: 'Custo não informado para parte do estoque' });

    expect(screen.getByText('Custo não informado para parte do estoque')).toBeInTheDocument();
    expect(screen.queryByText('R$ 12.345,67')).not.toBeInTheDocument();
  });

  it('oferece skeleton acessível durante o carregamento', () => {
    renderCard({ isLoading: true });
    expect(screen.getByRole('status', { name: 'Carregando Receita paga' })).toBeInTheDocument();
  });
});
