/**
 * Módulos que dependem de tabelas existentes só no banco da MV Ambiental
 * (projeto sobcontrole-mv). Ficam desligados por padrão para que o app ligado
 * ao banco principal não exiba telas sem tabelas por trás.
 */
export const isContractsModuleEnabled = (env: Record<string, unknown> = import.meta.env) =>
  env.VITE_ENABLE_CONTRACTS_MODULE === 'true';
