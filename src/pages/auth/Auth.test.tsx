import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Login } from './Login';
import { Register } from './Register';

const auth = vi.hoisted(() => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
  clearError: vi.fn(),
  isLoading: false,
  error: null as string | null,
  isAuthenticated: false,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => auth,
}));

const renderWithRouter = (component: React.ReactNode) =>
  render(<MemoryRouter>{component}</MemoryRouter>);

const fillRegistration = (confirmation = 'segredo123') => {
  fireEvent.change(screen.getByLabelText('Nome da empresa'), {
    target: { value: 'Empresa Exemplo' },
  });
  fireEvent.change(screen.getByLabelText('CNPJ'), {
    target: { value: '12345678000190' },
  });
  fireEvent.change(screen.getByLabelText('Nome completo'), {
    target: { value: 'Maria Gestora' },
  });
  fireEvent.change(screen.getByLabelText('E-mail'), {
    target: { value: 'maria@empresa.com' },
  });
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: 'segredo123' },
  });
  fireEvent.change(screen.getByLabelText('Confirmar senha'), {
    target: { value: confirmation },
  });
};

describe('Experiência de autenticação', () => {
  beforeEach(() => {
    auth.signIn.mockReset().mockResolvedValue(undefined);
    auth.signUp.mockReset().mockResolvedValue({ needsEmailConfirmation: false });
    auth.clearError.mockReset();
    auth.isLoading = false;
    auth.error = null;
    auth.isAuthenticated = false;
  });

  it('oferece navegação segura, campos acessíveis e visibilidade de senha no login', () => {
    renderWithRouter(<Login />);

    expect(screen.getByRole('heading', { name: 'Bem-vindo de volta' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voltar para o site' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/register');
    expect(screen.queryByText(/Esqueceu|Esqueci/i)).not.toBeInTheDocument();

    const email = screen.getByLabelText('E-mail');
    const password = screen.getByLabelText('Senha');

    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('envia as credenciais válidas pelo fluxo de login existente', async () => {
    renderWithRouter(<Login />);

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'gestora@empresa.com' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'segredo123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(auth.signIn).toHaveBeenCalledWith('gestora@empresa.com', 'segredo123');
    });
  });

  it('apresenta erro de login seguro sem repassar detalhes técnicos', () => {
    auth.error = 'Invalid login credentials: provider response 400';

    renderWithRouter(<Login />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Não foi possível entrar. Confira seu e-mail e sua senha e tente novamente.'
    );
    expect(screen.queryByText(/provider response 400/i)).not.toBeInTheDocument();
  });

  it('informa quando o cadastro depende da confirmação por e-mail', () => {
    render(
      <MemoryRouter
        initialEntries={[
          { pathname: '/login', state: { emailConfirmationRequired: true } },
        ]}
      >
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Cadastro recebido. Confira seu e-mail para confirmar a conta antes de entrar.'
    );
  });

  it('impede cadastro quando a confirmação de senha diverge', async () => {
    renderWithRouter(<Register />);
    fillRegistration('outra-senha');

    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));

    expect(await screen.findByText('As senhas não coincidem')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmar senha')).toHaveAttribute('aria-invalid', 'true');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('preserva os dados reais do cadastro e envia o CNPJ normalizado', async () => {
    renderWithRouter(<Register />);
    fillRegistration();

    expect(screen.getByLabelText('CNPJ')).toHaveValue('12.345.678/0001-90');
    fireEvent.click(screen.getByRole('button', { name: 'Criar minha conta' }));

    await waitFor(() => {
      expect(auth.signUp).toHaveBeenCalledWith(
        'maria@empresa.com',
        'segredo123',
        'Maria Gestora',
        'Empresa Exemplo',
        '12345678000190'
      );
    });
  });
});
