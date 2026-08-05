import { describe, expect, it } from 'vitest';
import {
  buildClassificationSources,
  calculateClassificationCoverage,
  EMPTY_CLASSIFICATION_SOURCES,
  resolveClassification,
  type ClassificationSourceRow,
} from './taxClassification';

const sources = (rows: ClassificationSourceRow[], companyAnexo: 'I' | 'III' | null = 'I') =>
  buildClassificationSources(rows, companyAnexo);

describe('resolveClassification — cascata', () => {
  it('usa o perfil da empresa quando nada está classificado', () => {
    const result = resolveClassification(
      { productId: 'p1', categoryId: 'c1' },
      sources([]),
    );

    expect(result.anexo).toBe('I');
    expect(result.anexoOrigin).toBe('empresa');
    expect(result.tributacao).toBe('normal');
    expect(result.isExplicit).toBe(false);
  });

  it('herda o anexo da categoria', () => {
    const result = resolveClassification(
      { productId: 'p1', categoryId: 'c1' },
      sources([{ productId: null, categoryId: 'c1', anexo: 'III', tributacao: null }]),
    );

    expect(result.anexo).toBe('III');
    expect(result.anexoOrigin).toBe('categoria');
    expect(result.isExplicit).toBe(true);
  });

  it('faz o produto sobrescrever a categoria', () => {
    const result = resolveClassification(
      { productId: 'p1', categoryId: 'c1' },
      sources([
        { productId: null, categoryId: 'c1', anexo: 'III', tributacao: null },
        { productId: 'p1', categoryId: null, anexo: 'II', tributacao: null },
      ]),
    );

    expect(result.anexo).toBe('II');
    expect(result.anexoOrigin).toBe('produto');
  });

  it('herda ATRIBUTO A ATRIBUTO: anexo da categoria, tributação do produto', () => {
    // O caso que justifica a herança por atributo — o cliente não deve precisar
    // redigitar o anexo só para marcar um produto como monofásico.
    const result = resolveClassification(
      { productId: 'p1', categoryId: 'c1' },
      sources([
        { productId: null, categoryId: 'c1', anexo: 'III', tributacao: null },
        { productId: 'p1', categoryId: null, anexo: null, tributacao: 'monofasico' },
      ]),
    );

    expect(result.anexo).toBe('III');
    expect(result.anexoOrigin).toBe('categoria');
    expect(result.tributacao).toBe('monofasico');
    expect(result.tributacaoOrigin).toBe('produto');
  });

  it('herda tributação da categoria quando o produto não define', () => {
    const result = resolveClassification(
      { productId: 'p1', categoryId: 'c1' },
      sources([{ productId: null, categoryId: 'c1', anexo: null, tributacao: 'st' }]),
    );

    expect(result.tributacao).toBe('st');
    expect(result.tributacaoOrigin).toBe('categoria');
    expect(result.anexo).toBe('I');
    expect(result.anexoOrigin).toBe('empresa');
  });

  it('ignora a categoria quando o item não tem categoria', () => {
    const result = resolveClassification(
      { productId: 'p1', categoryId: null },
      sources([{ productId: null, categoryId: 'c1', anexo: 'III', tributacao: null }]),
    );

    expect(result.anexo).toBe('I');
    expect(result.anexoOrigin).toBe('empresa');
  });

  it('devolve anexo nulo quando nem a empresa tem anexo definido', () => {
    const result = resolveClassification(
      { productId: 'p1', categoryId: null },
      EMPTY_CLASSIFICATION_SOURCES(null),
    );

    expect(result.anexo).toBeNull();
    expect(result.tributacao).toBe('normal');
  });
});

describe('buildClassificationSources — dados inválidos', () => {
  it('descarta anexo desconhecido em vez de propagar para o motor', () => {
    const result = resolveClassification(
      { productId: 'p1', categoryId: null },
      sources([{ productId: 'p1', categoryId: null, anexo: 'VI', tributacao: null }]),
    );

    expect(result.anexo).toBe('I');
    expect(result.anexoOrigin).toBe('empresa');
    expect(result.isExplicit).toBe(false);
  });

  it('descarta tributação desconhecida e mantém o default', () => {
    const result = resolveClassification(
      { productId: 'p1', categoryId: null },
      sources([{ productId: 'p1', categoryId: null, anexo: null, tributacao: 'inventado' }]),
    );

    expect(result.tributacao).toBe('normal');
    expect(result.isExplicit).toBe(false);
  });

  it('ignora linha sem produto e sem categoria', () => {
    const built = sources([{ productId: null, categoryId: null, anexo: 'III', tributacao: null }]);
    expect(built.byProduct.size).toBe(0);
    expect(built.byCategory.size).toBe(0);
  });
});

describe('calculateClassificationCoverage', () => {
  it('pondera por receita, não por contagem de produtos', () => {
    // Um produto classificado que representa 90% da receita entrega 90% de
    // cobertura, mesmo com nove produtos irrelevantes sem classificação.
    const items = [
      { productId: 'grande', categoryId: null, amount: 9000 },
      ...Array.from({ length: 9 }, (_, index) => ({
        productId: `pequeno-${index}`,
        categoryId: null,
        amount: 1000 / 9,
      })),
    ];

    const result = calculateClassificationCoverage(
      items,
      sources([{ productId: 'grande', categoryId: null, anexo: 'I', tributacao: null }]),
    );

    expect(result.coverage).toBeCloseTo(0.9, 5);
    expect(result.unclassifiedProductIds).toHaveLength(9);
    expect(result.isCalculable).toBe(true);
  });

  it('conta cobertura total quando tudo está classificado', () => {
    const result = calculateClassificationCoverage(
      [
        { productId: 'p1', categoryId: 'c1', amount: 500 },
        { productId: 'p2', categoryId: 'c1', amount: 500 },
      ],
      sources([{ productId: null, categoryId: 'c1', anexo: 'III', tributacao: null }]),
    );

    expect(result.coverage).toBe(1);
    expect(result.unclassifiedProductIds).toEqual([]);
  });

  it('marca como não calculável quando não há receita no período', () => {
    const result = calculateClassificationCoverage([], sources([]));

    expect(result.isCalculable).toBe(false);
    expect(result.coverage).toBe(0);
  });

  it('não calcula cobertura a partir de receita zerada', () => {
    const result = calculateClassificationCoverage(
      [{ productId: 'p1', categoryId: null, amount: 0 }],
      sources([]),
    );

    expect(result.isCalculable).toBe(false);
  });

  it('trata valor inválido ou negativo como zero, sem quebrar a fração', () => {
    const result = calculateClassificationCoverage(
      [
        { productId: 'p1', categoryId: null, amount: Number.NaN },
        { productId: 'p2', categoryId: null, amount: -100 },
        { productId: 'p3', categoryId: null, amount: 200 },
      ],
      sources([{ productId: 'p3', categoryId: null, anexo: 'I', tributacao: null }]),
    );

    expect(result.totalAmount).toBe(200);
    expect(result.coverage).toBe(1);
  });

  it('não duplica produto na lista de não classificados', () => {
    const result = calculateClassificationCoverage(
      [
        { productId: 'p1', categoryId: null, amount: 100 },
        { productId: 'p1', categoryId: null, amount: 100 },
      ],
      sources([]),
    );

    expect(result.unclassifiedProductIds).toEqual(['p1']);
  });
});
