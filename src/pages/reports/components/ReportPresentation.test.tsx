import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChartCard } from './ChartCard';
import { ReportDataTable } from './ReportDataTable';
import { ReportEmptyState } from './ReportEmptyState';
import { ReportErrorState } from './ReportErrorState';

describe('componentes de apresentação dos relatórios', () => {
  it('distingue gráfico vazio de gráfico disponível', () => {
    const { rerender } = render(
      <ChartCard title="Receita" subtitle="Evolução diária" isEmpty>
        <div>gráfico</div>
      </ChartCard>
    );
    expect(screen.getByText('Dados insuficientes')).toBeInTheDocument();
    expect(screen.queryByText('gráfico')).not.toBeInTheDocument();

    rerender(
      <ChartCard title="Receita" subtitle="Evolução diária">
        <div>gráfico</div>
      </ChartCard>
    );
    expect(screen.getByText('gráfico')).toBeInTheDocument();
  });

  it('apresenta erro recuperável e negação financeira sem expor retry', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ReportErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalledOnce();

    rerender(<ReportErrorState denied onRetry={onRetry} />);
    expect(screen.getByText('Acesso financeiro não autorizado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument();
  });

  it('mantém estado vazio contextual e drilldown por linha', () => {
    const onRowClick = vi.fn();
    const columns = [{ key: 'name', label: 'Produto' }];
    const { rerender } = render(
      <ReportDataTable
        title="Produtos sem saída"
        columns={columns}
        data={[] as { name: string }[]}
        emptyTitle="Nenhum produto parado"
      />
    );
    expect(screen.getByText('Nenhum produto parado')).toBeInTheDocument();

    rerender(
      <ReportDataTable
        title="Produtos sem saída"
        columns={columns}
        data={[{ name: 'Café' }]}
        onRowClick={onRowClick}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    expect(onRowClick).toHaveBeenCalledWith({ name: 'Café' });
  });

  it('renderiza estado vazio sem criar dados demonstrativos', () => {
    render(
      <ReportEmptyState
        title="Nenhum dado no período"
        description="Registre operações para iniciar a análise."
      />
    );
    expect(screen.getByText('Nenhum dado no período')).toBeInTheDocument();
    expect(screen.getByText('Registre operações para iniciar a análise.')).toBeInTheDocument();
  });
});
