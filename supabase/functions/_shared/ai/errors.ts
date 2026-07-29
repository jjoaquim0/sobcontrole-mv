import type { SafeErrorCode } from './types.ts';

const PROVIDER_ERROR_MESSAGES: Record<
  Extract<SafeErrorCode, 'provider_unavailable' | 'rate_limited' | 'timeout' | 'invalid_request'>,
  string
> = {
  provider_unavailable: 'provider unavailable',
  rate_limited: 'provider rate limited',
  timeout: 'provider timeout',
  invalid_request: 'provider rejected request',
};

export class AIServiceError extends Error {
  readonly code: SafeErrorCode;

  constructor(code: SafeErrorCode) {
    super(code);
    this.name = 'AIServiceError';
    this.code = code;
  }
}

export class AIProviderError extends Error {
  readonly code: Extract<
    SafeErrorCode,
    'provider_unavailable' | 'rate_limited' | 'timeout' | 'invalid_request'
  >;

  constructor(code: AIProviderError['code']) {
    super(PROVIDER_ERROR_MESSAGES[code]);
    this.name = 'AIProviderError';
    this.code = code;
  }
}

export interface PublicError {
  code: SafeErrorCode;
  message: string;
  status: number;
}

const LIMIT_CODES = new Set<SafeErrorCode>([
  'user_request_limit',
  'company_request_limit',
  'company_token_limit',
  'company_cost_limit',
  'usage_limit_exceeded',
]);

export const toPublicError = (code: SafeErrorCode): PublicError => {
  if (LIMIT_CODES.has(code)) {
    return {
      code: 'usage_limit_exceeded',
      message:
        'O limite de uso da IA foi atingido. Tente novamente mais tarde ou fale com o administrador da empresa.',
      status: 429,
    };
  }

  switch (code) {
    case 'unauthorized':
      return { code, message: 'Autenticação necessária.', status: 401 };
    case 'company_not_found':
      return { code, message: 'Não foi possível validar sua empresa.', status: 403 };
    case 'permission_denied':
      return { code, message: 'Você não tem permissão para usar a assistente de IA.', status: 403 };
    case 'financial_permission_denied':
      return {
        code,
        message: 'Somente administradores e gerentes podem consultar informações financeiras.',
        status: 403,
      };
    case 'global_disabled':
      return {
        code,
        message: 'A assistente de IA está temporariamente indisponível.',
        status: 503,
      };
    case 'company_disabled':
      return {
        code,
        message: 'O uso da assistente de IA está desativado para esta empresa.',
        status: 403,
      };
    case 'invalid_request':
      return { code, message: 'Envie uma mensagem válida.', status: 400 };
    case 'invalid_tool_arguments':
      return {
        code,
        message: 'Não foi possível validar os parâmetros da consulta.',
        status: 400,
      };
    case 'tool_unavailable':
      return {
        code,
        message:
          'Ainda não consigo consultar esse tipo de informação. Posso ajudar com vendas, clientes, estoque baixo e contas vencidas.',
        status: 400,
      };
    case 'rate_limited':
      return {
        code,
        message: 'A assistente está temporariamente ocupada. Tente novamente em instantes.',
        status: 503,
      };
    case 'tool_query_failed':
      return {
        code,
        message: 'Não foi possível consultar os dados agora. Tente novamente.',
        status: 503,
      };
    case 'timeout':
    case 'provider_unavailable':
    case 'configuration_error':
    case 'internal_error':
    default:
      return {
        code: code === 'configuration_error' ? 'configuration_error' : 'internal_error',
        message: 'Não foi possível conversar com a Gestly agora. Tente novamente.',
        status: 503,
      };
  }
};

export const normalizeServiceError = (error: unknown): SafeErrorCode => {
  if (error instanceof AIProviderError || error instanceof AIServiceError) {
    return error.code;
  }

  if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError') {
    return 'timeout';
  }

  return 'internal_error';
};
