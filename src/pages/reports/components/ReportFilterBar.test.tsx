import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReportFilterBar } from './ReportFilterBar';

describe('ReportFilterBar', () => {
  it('altera o período global e comunica a comparação aplicada', () => {
    const onChange = vi.fn();
    render(
      <ReportFilterBar
        period={{ type: 'current_month' }}
        onChange={onChange}
        appliedLabel="01 de jul. de 2026 – 29 de jul. de 2026"
      />
    );

    expect(screen.getByText('Comparado ao período anterior')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mês atual' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Filtro global de período').parentElement).toHaveClass(
      'flex-col',
      'xl:flex-row'
    );

    fireEvent.click(screen.getByRole('button', { name: 'Personalizado' }));
    expect(onChange).toHaveBeenCalledWith({
      type: 'custom',
      dateFrom: undefined,
      dateTo: undefined,
    });
  });

  it('edita as duas datas do período personalizado', () => {
    const onChange = vi.fn();
    render(
      <ReportFilterBar
        period={{ type: 'custom', dateFrom: '2026-07-01', dateTo: '2026-07-29' }}
        onChange={onChange}
        appliedLabel="01 de jul. de 2026 – 29 de jul. de 2026"
      />
    );

    fireEvent.change(screen.getByLabelText('Data inicial'), { target: { value: '2026-07-10' } });
    fireEvent.change(screen.getByLabelText('Data final'), { target: { value: '2026-07-25' } });

    expect(onChange).toHaveBeenNthCalledWith(1, {
      type: 'custom',
      dateFrom: '2026-07-10',
      dateTo: '2026-07-29',
    });
    expect(onChange).toHaveBeenNthCalledWith(2, {
      type: 'custom',
      dateFrom: '2026-07-01',
      dateTo: '2026-07-25',
    });
  });
});
