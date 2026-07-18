import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmModal } from './ConfirmModal';

const renderModal = (overrides: Partial<Parameters<typeof ConfirmModal>[0]> = {}) => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmModal
      isOpen
      title="Excluir oportunidade"
      message='Tem certeza que deseja excluir "Negócio X"?'
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onConfirm, onCancel };
};

describe('ConfirmModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('expõe role="dialog", aria-modal e aria-labelledby apontando para o título', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: 'Excluir oportunidade' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('foca automaticamente o botão Cancelar ao abrir', async () => {
    renderModal();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus());
  });

  it('chama onCancel ao pressionar Escape', () => {
    const { onCancel } = renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('não chama onCancel via Escape enquanto isLoading está ativo', () => {
    const { onCancel } = renderModal({ isLoading: true });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('desabilita Cancelar e o botão de confirmação durante isLoading', () => {
    renderModal({ isLoading: true, confirmText: 'Excluir oportunidade' });
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Excluir oportunidade' })).toBeDisabled();
  });

  it('chama onConfirm ao clicar no botão de confirmação', () => {
    const { onConfirm } = renderModal({ confirmText: 'Excluir oportunidade' });
    fireEvent.click(screen.getByRole('button', { name: 'Excluir oportunidade' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('não renderiza nada quando isOpen é false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
