/**
 * Story 1.28 — Provedor de consulta cadastral de CNPJ.
 *
 * A minimização acontece AQUI, não na borda: o handler nunca devolve o payload
 * bruto do provedor. O retorno traz apenas os campos que a derivação consome,
 * já normalizados para string, evitando que dado cadastral não utilizado
 * trafegue até o navegador ou fique armazenado no cache.
 */

import type { CnpjRegistrySnapshot } from './cnpj-lookup.ts';

export const DEFAULT_REGISTRY_ENDPOINT = 'https://brasilapi.com.br/api/cnpj/v1';

const asString = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

/**
 * Booleano de três estados. `null` significa "a base não informou" e é
 * semanticamente diferente de `false` — a derivação depende dessa distinção
 * para não classificar empresa optante como não optante.
 */
const asNullableBoolean = (value: unknown): boolean | null => {
  if (value === true || value === false) return value;
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'sim', 's', '1'].includes(normalized)) return true;
    if (['false', 'nao', 'não', 'n', '0'].includes(normalized)) return false;
  }
  return null;
};

const asNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const minimizeRegistryPayload = (raw: unknown): CnpjRegistrySnapshot => {
  const source = (raw ?? {}) as Record<string, unknown>;

  const regimeTributario = Array.isArray(source.regime_tributario)
    ? (source.regime_tributario as Array<Record<string, unknown>>).map((entry) => ({
        ano: asNullableNumber(entry?.ano),
        forma_de_tributacao: asString(entry?.forma_de_tributacao),
      }))
    : [];

  const cnaesSecundarios = Array.isArray(source.cnaes_secundarios)
    ? (source.cnaes_secundarios as Array<Record<string, unknown>>).map((entry) => ({
        codigo: asString(entry?.codigo),
        descricao: asString(entry?.descricao),
      }))
    : [];

  return {
    cnpj: asString(source.cnpj),
    razao_social: asString(source.razao_social),
    nome_fantasia: asString(source.nome_fantasia),
    opcao_pelo_mei: asNullableBoolean(source.opcao_pelo_mei),
    data_opcao_pelo_mei: asString(source.data_opcao_pelo_mei),
    data_exclusao_do_mei: asString(source.data_exclusao_do_mei),
    opcao_pelo_simples: asNullableBoolean(source.opcao_pelo_simples),
    data_opcao_pelo_simples: asString(source.data_opcao_pelo_simples),
    data_exclusao_do_simples: asString(source.data_exclusao_do_simples),
    regime_tributario: regimeTributario,
    cnae_fiscal: asString(source.cnae_fiscal),
    cnae_fiscal_descricao: asString(source.cnae_fiscal_descricao),
    cnaes_secundarios: cnaesSecundarios,
    uf: asString(source.uf),
    municipio: asString(source.municipio),
    codigo_municipio_ibge: asString(source.codigo_municipio_ibge),
    porte: asString(source.porte),
    situacao_cadastral: asString(source.situacao_cadastral),
    descricao_situacao_cadastral: asString(source.descricao_situacao_cadastral),
  };
};

export interface RegistryProviderOptions {
  endpoint?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export const createRegistryProvider = (options: RegistryProviderOptions = {}) => {
  const endpoint = options.endpoint ?? DEFAULT_REGISTRY_ENDPOINT;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const fetchImpl = options.fetchImpl ?? fetch;

  return async (cnpj: string): Promise<CnpjRegistrySnapshot> => {
    // Timeout explícito: a API é pública e sem SLA. Sem isso, o onboarding do
    // cliente fica pendurado esperando um serviço de terceiro.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(`${endpoint}/${cnpj}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`registry responded with status ${response.status}`);
      }

      return minimizeRegistryPayload(await response.json());
    } finally {
      clearTimeout(timer);
    }
  };
};
