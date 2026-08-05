import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdministrativeNotice } from './AdministrativeNotice';

describe('AdministrativeNotice', () => {
  it('is permanent, informative and does not invent legal links', () => {
    render(<AdministrativeNotice />);
    expect(screen.getByRole('complementary', { name: /aviso sobre o uso administrativo/i })).toBeVisible();
    expect(screen.getByText(/não realiza cálculos de folha de pagamento/i)).toBeVisible();
    expect(screen.getByText(/valide as informações com o profissional responsável/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /fechar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
