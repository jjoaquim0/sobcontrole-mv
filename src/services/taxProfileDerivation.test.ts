import { describe, expect, it } from 'vitest';
import {
  deriveTaxProfile,
  normalizeCnae,
  resolveAnexoByCnae,
  type CnaeAnexoMapEntry,
  type CnpjRegistryPayload,
} from './taxProfileDerivation';

/** Espelha o seed de cnae_anexo_map da migration 20260802120000. */
const CNAE_MAP: CnaeAnexoMapEntry[] = [
  { cnaePrefix: '47', anexo: 'I', confidence: 'alta', note: 'Comércio varejista' },
  { cnaePrefix: '46', anexo: 'I', confidence: 'alta', note: 'Comércio por atacado' },
  { cnaePrefix: '10', anexo: 'II', confidence: 'alta', note: 'Alimentos' },
  { cnaePrefix: '56', anexo: 'III', confidence: 'alta', note: 'Alimentação' },
  { cnaePrefix: '62', anexo: 'III', confidence: 'media', note: 'TI — sujeito a Fator R' },
  { cnaePrefix: '41', anexo: 'IV', confidence: 'alta', note: 'Construção' },
  { cnaePrefix: '6911', anexo: 'IV', confidence: 'alta', note: 'Advocacia' },
  { cnaePrefix: '6920', anexo: 'V', confidence: 'requer_confirmacao', note: 'Contabilidade' },
  { cnaePrefix: '01', anexo: 'II', confidence: 'media', note: 'Agricultura' },
];

const REFERENCE = new Date(Date.UTC(2026, 7, 2)); // 02/08/2026

const derive = (payload: CnpjRegistryPayload, referenceDate = REFERENCE) =>
  deriveTaxProfile({ payload, cnaeAnexoMap: CNAE_MAP, referenceDate });

describe('normalizeCnae', () => {
  it('preserva o zero à esquerda que o JSON numérico perde', () => {
    // 0111301 (cultivo de arroz) chega da API como number 111301. Sem padding,
    // casaria com o prefixo '11' (bebidas) em vez de '01' (agricultura).
    expect(normalizeCnae(111301)).toBe('0111301');
    expect(normalizeCnae('0111301')).toBe('0111301');
  });

  it('remove máscara e mantém sete dígitos', () => {
    expect(normalizeCnae('47.12-1-00')).toBe('4712100');
    expect(normalizeCnae(9430800)).toBe('9430800');
  });

  it('devolve string vazia para entrada ausente ou sem dígito', () => {
    expect(normalizeCnae(null)).toBe('');
    expect(normalizeCnae(undefined)).toBe('');
    expect(normalizeCnae('sem numero')).toBe('');
  });
});

describe('resolveAnexoByCnae', () => {
  it('faz o prefixo mais longo vencer o mais curto', () => {
    // 6911 (advocacia, Anexo IV) precisa vencer qualquer prefixo genérico.
    expect(resolveAnexoByCnae('6911701', CNAE_MAP)?.anexo).toBe('IV');
    expect(resolveAnexoByCnae('6920601', CNAE_MAP)?.anexo).toBe('V');
  });

  it('resolve pela divisão quando não há prefixo específico', () => {
    expect(resolveAnexoByCnae('4712100', CNAE_MAP)?.anexo).toBe('I');
  });

  it('devolve null sem mapeamento', () => {
    expect(resolveAnexoByCnae('9999999', CNAE_MAP)).toBeNull();
    expect(resolveAnexoByCnae('', CNAE_MAP)).toBeNull();
  });

  it('respeita o zero à esquerda ao casar prefixo', () => {
    expect(resolveAnexoByCnae(normalizeCnae(111301), CNAE_MAP)?.anexo).toBe('II');
  });
});

describe('deriveTaxProfile — MEI', () => {
  it('identifica MEI antes de Simples, porque todo MEI também é optante do Simples', () => {
    const result = derive({
      opcao_pelo_mei: true,
      data_opcao_pelo_mei: '2020-03-01',
      opcao_pelo_simples: true,
      data_opcao_pelo_simples: '2020-03-01',
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('mei');
    expect(result.regimeConfidence).toBe('alta');
    expect(result.optedAt).toBe('2020-03-01');
  });

  it('sugere tipo de atividade combinado quando há CNAE de comércio e de serviço', () => {
    const result = derive({
      opcao_pelo_mei: true,
      cnae_fiscal: 4712100,
      cnaes_secundarios: [{ codigo: 5611201, descricao: 'Restaurante' }],
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('mei');
    expect(result.suggestedMeiActivityType).toBe('comercio_servicos');
    expect(result.suggestedAnexo).toBeNull();
  });

  it('não classifica como MEI quando o desenquadramento já produziu efeito', () => {
    const result = derive({
      opcao_pelo_mei: true,
      data_exclusao_do_mei: '2025-12-31',
      opcao_pelo_simples: true,
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('simples_nacional');
    expect(result.warnings.map((w) => w.code)).toContain('desenquadrado_do_mei');
  });
});

describe('deriveTaxProfile — Simples Nacional', () => {
  it('identifica Simples e sugere o anexo pelo CNAE principal', () => {
    const result = derive({
      opcao_pelo_simples: true,
      data_opcao_pelo_simples: '2019-01-01',
      cnae_fiscal: 4712100,
      cnae_fiscal_descricao: 'Comércio varejista de mercadorias',
      situacao_cadastral: 2,
      uf: 'SP',
      municipio: 'SAO PAULO',
      codigo_municipio_ibge: 3550308,
    });

    expect(result.regime).toBe('simples_nacional');
    expect(result.suggestedAnexo).toBe('I');
    expect(result.anexoConfidence).toBe('alta');
    expect(result.uf).toBe('SP');
    expect(result.codigoMunicipioIbge).toBe('3550308');
  });

  it('exige confirmação quando o CNAE não determina o anexo com segurança', () => {
    const result = derive({
      opcao_pelo_simples: true,
      cnae_fiscal: 6920601,
      situacao_cadastral: 2,
    });

    expect(result.suggestedAnexo).toBe('V');
    expect(result.anexoConfidence).toBe('requer_confirmacao');
    expect(result.warnings.map((w) => w.code)).toContain('anexo_requer_confirmacao');
  });

  it('avisa sobre atividade mista quando os secundários apontam outro anexo', () => {
    const result = derive({
      opcao_pelo_simples: true,
      cnae_fiscal: 4712100, // Anexo I
      cnaes_secundarios: [{ codigo: 5611201, descricao: 'Restaurante' }], // Anexo III
      situacao_cadastral: 2,
    });

    expect(result.hasMixedActivity).toBe(true);
    const mixed = result.warnings.find((w) => w.code === 'atividade_mista');
    expect(mixed?.message).toContain('III');
  });

  it('não acusa atividade mista quando os secundários caem no mesmo anexo', () => {
    const result = derive({
      opcao_pelo_simples: true,
      cnae_fiscal: 4712100,
      cnaes_secundarios: [{ codigo: 4611700, descricao: 'Atacado' }],
      situacao_cadastral: 2,
    });

    expect(result.hasMixedActivity).toBe(false);
    expect(result.warnings.map((w) => w.code)).not.toContain('atividade_mista');
  });

  it('avisa quando o CNAE não tem mapeamento', () => {
    const result = derive({
      opcao_pelo_simples: true,
      cnae_fiscal: 9999999,
      situacao_cadastral: 2,
    });

    expect(result.suggestedAnexo).toBeNull();
    expect(result.warnings.map((w) => w.code)).toContain('cnae_sem_mapeamento');
  });
});

describe('deriveTaxProfile — vigência da exclusão', () => {
  it('trata exclusão passada como efetiva e derruba a opção', () => {
    const result = derive({
      opcao_pelo_simples: true,
      data_exclusao_do_simples: '2024-12-31',
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('indeterminado');
    expect(result.warnings.map((w) => w.code)).toContain('excluido_do_simples');
  });

  it('mantém a opção quando a exclusão está agendada para o futuro, mas avisa', () => {
    const result = derive({
      opcao_pelo_simples: true,
      data_exclusao_do_simples: '2026-12-31',
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('simples_nacional');
    expect(result.warnings.map((w) => w.code)).toContain('exclusao_agendada');
  });

  it('trata exclusão na própria data de referência como efetiva', () => {
    const result = derive({
      opcao_pelo_simples: true,
      data_exclusao_do_simples: '2026-08-02',
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('indeterminado');
  });

  it('ignora data de exclusão malformada em vez de derrubar a opção', () => {
    const result = derive({
      opcao_pelo_simples: true,
      data_exclusao_do_simples: '31/12/2024',
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('simples_nacional');
  });
});

describe('deriveTaxProfile — campos nulos', () => {
  it('NÃO trata null como "não optante": cai em indeterminado com aviso', () => {
    // Este é o erro mais caro possível neste módulo. A base pública devolve
    // null com frequência para empresa ativa e optante.
    const result = derive({
      opcao_pelo_simples: null,
      opcao_pelo_mei: null,
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('indeterminado');
    expect(result.regimeConfidence).toBe('requer_confirmacao');
    expect(result.warnings.map((w) => w.code)).toContain('dado_ausente');
  });

  it('distingue "não optante declarado" de "dado ausente"', () => {
    const declared = derive({
      opcao_pelo_simples: false,
      opcao_pelo_mei: false,
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(declared.regime).toBe('indeterminado');
    expect(declared.warnings.map((w) => w.code)).not.toContain('dado_ausente');
    expect(declared.regimeReason).toContain('não consta como optante');
  });

  it('tolera payload completamente vazio sem lançar', () => {
    const result = derive({});

    expect(result.regime).toBe('indeterminado');
    expect(result.cnaePrincipal).toBe('');
    expect(result.cnaesSecundarios).toEqual([]);
    expect(result.registrationActive).toBe(false);
  });
});

describe('deriveTaxProfile — Lucro Presumido e Lucro Real', () => {
  it('identifica Lucro Presumido pelo ano mais recente', () => {
    const result = derive({
      opcao_pelo_simples: false,
      regime_tributario: [
        { ano: 2024, forma_de_tributacao: 'LUCRO REAL' },
        { ano: 2025, forma_de_tributacao: 'LUCRO PRESUMIDO' },
      ],
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('lucro_presumido');
    expect(result.regimeReason).toContain('2025');
  });

  it('não confunde LUCRO REAL com PRESUMIDO por conter a palavra REAL', () => {
    const result = derive({
      opcao_pelo_simples: false,
      regime_tributario: [{ ano: 2025, forma_de_tributacao: 'LUCRO REAL' }],
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('lucro_real');
  });

  it('normaliza acento e caixa da forma de tributação', () => {
    const result = derive({
      opcao_pelo_simples: false,
      regime_tributario: [{ ano: 2025, forma_de_tributacao: 'Lucro Presumído' }],
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('lucro_presumido');
  });

  it('não sugere anexo para regimes sem apuração por anexo', () => {
    const result = derive({
      opcao_pelo_simples: false,
      regime_tributario: [{ ano: 2025, forma_de_tributacao: 'LUCRO PRESUMIDO' }],
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.suggestedAnexo).toBeNull();
  });

  it('ignora entradas do histórico sem ano ou sem forma de tributação', () => {
    const result = derive({
      opcao_pelo_simples: false,
      regime_tributario: [
        { ano: null, forma_de_tributacao: 'LUCRO REAL' },
        { ano: 2025, forma_de_tributacao: null },
      ],
      cnae_fiscal: 4712100,
      situacao_cadastral: 2,
    });

    expect(result.regime).toBe('indeterminado');
  });
});

describe('deriveTaxProfile — situação cadastral', () => {
  it('avisa quando o CNPJ não está ativo', () => {
    const result = derive({
      opcao_pelo_simples: true,
      cnae_fiscal: 4712100,
      situacao_cadastral: 8,
      descricao_situacao_cadastral: 'BAIXADA',
    });

    expect(result.registrationActive).toBe(false);
    expect(result.warnings.map((w) => w.code)).toContain('registro_inativo');
  });

  it('reconhece situação 2 como ativa', () => {
    const result = derive({
      opcao_pelo_simples: true,
      cnae_fiscal: 4712100,
      situacao_cadastral: '2',
      descricao_situacao_cadastral: 'ATIVA',
    });

    expect(result.registrationActive).toBe(true);
    expect(result.warnings.map((w) => w.code)).not.toContain('registro_inativo');
  });

  it('não acusa inatividade quando a situação não foi informada', () => {
    const result = derive({ opcao_pelo_simples: true, cnae_fiscal: 4712100 });

    expect(result.warnings.map((w) => w.code)).not.toContain('registro_inativo');
    expect(result.registrationStatusLabel).toBe('Não informada');
  });
});
