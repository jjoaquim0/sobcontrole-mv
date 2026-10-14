import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithPassword = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword: (...args: unknown[]) => signInWithPassword(...args) } },
}));

import { useAuthStore } from './authStore';

describe('authStore.signIn', () => {
  beforeEach(() => {
    signInWithPassword.mockReset();
    useAuthStore.setState({ isLoading: false, error: null, user: null });
  });

  it('mantém o formulário montado e guarda o erro de credencial inválida', async () => {
    const loadingStates: boolean[] = [];
    const unsubscribe = useAuthStore.subscribe((state) => loadingStates.push(state.isLoading));
    signInWithPassword.mockResolvedValue({ data: null, error: new Error('Invalid login credentials') });

    await useAuthStore.getState().signIn('a@b.com', 'errada');
    unsubscribe();

    expect(loadingStates).not.toContain(true);
    expect(useAuthStore.getState().error).toBe('Invalid login credentials');
  });
});
