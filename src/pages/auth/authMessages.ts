export type AuthAction = 'login' | 'register';

export function getFriendlyAuthError(error: string | null, action: AuthAction): string | null {
  if (!error) return null;

  const normalized = error.toLocaleLowerCase('en-US');

  if (normalized.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar. Se necessário, verifique também a pasta de spam.';
  }

  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  if (action === 'login') {
    return 'Não foi possível entrar. Confira seu e-mail e sua senha e tente novamente.';
  }

  if (normalized.includes('password') && (normalized.includes('weak') || normalized.includes('short'))) {
    return 'A senha não atende aos requisitos de segurança. Revise as orientações e tente novamente.';
  }

  return 'Não foi possível criar sua conta. Revise os dados informados e tente novamente.';
}
