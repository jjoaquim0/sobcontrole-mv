import { describe, expect, it } from 'vitest';
import { computeStageReorder } from './stageReorder';
import type { PipelineStage } from '../../../types';

const stage = (id: string, position: number): PipelineStage => ({
  id,
  companyId: 'company-1',
  name: `Etapa ${id}`,
  color: '#10b981',
  position,
  isActive: true,
  createdAt: '',
  updatedAt: '',
});

// Cinco etapas ativas fora de ordem de inserção, mas com position ASC
// coerente (0, 1, 2, 3, 4) - o mesmo cenário do wireframe do UX spec.
const fiveStages: PipelineStage[] = [
  stage('a', 0),
  stage('b', 1),
  stage('c', 2),
  stage('d', 3),
  stage('e', 4),
];

describe('computeStageReorder', () => {
  it('ordena por position ASC antes de calcular, independentemente da ordem recebida', () => {
    const shuffled = [fiveStages[3], fiveStages[0], fiveStages[4], fiveStages[1], fiveStages[2]];
    // Mover 'a' (posição 0) para o lugar de 'd' (posição 3, índice 3): o
    // resultado deve ser idêntico ao calculado a partir da lista já
    // ordenada, provando que a função reordena internamente por position.
    const result = computeStageReorder(shuffled, 'a', 'd');
    expect(result).toEqual(computeStageReorder(fiveStages, 'a', 'd'));
  });

  it('calcula o ponto médio entre vizinhas ao mover para frente (índice maior)', () => {
    // Mover 'a' (índice 0) para a posição de 'c' (índice 2): como no
    // arrayMove do @dnd-kit, arrastar para um índice MAIOR insere a
    // etapa DEPOIS do alvo do drop - resultado final fica entre 'c'
    // (position 2) e 'd' (position 3) -> midpoint 2.5.
    const result = computeStageReorder(fiveStages, 'a', 'c');
    expect(result).toEqual({ stageId: 'a', position: 2.5 });
  });

  it('calcula o ponto médio entre vizinhas ao mover para trás (índice menor)', () => {
    // Mover 'e' (índice 4) para a posição de 'c' (índice 2): arrastar para
    // um índice MENOR insere a etapa ANTES do alvo do drop - resultado
    // final fica entre 'b' (position 1) e 'c' (position 2) -> midpoint 1.5.
    const result = computeStageReorder(fiveStages, 'e', 'c');
    expect(result).toEqual({ stageId: 'e', position: 1.5 });
  });

  it('usa next.position - 1 quando a etapa arrastada vai para o início', () => {
    // Mover 'e' (posição 4, último) para o lugar de 'a' (posição 0, primeiro).
    const result = computeStageReorder(fiveStages, 'e', 'a');
    expect(result).toEqual({ stageId: 'e', position: -1 });
  });

  it('usa previous.position + 1 quando a etapa arrastada vai para o fim', () => {
    // Mover 'a' (posição 0, primeiro) para o lugar de 'e' (posição 4, último).
    const result = computeStageReorder(fiveStages, 'a', 'e');
    expect(result).toEqual({ stageId: 'a', position: 5 });
  });

  it('é no-op (retorna null) quando o índice final é igual ao original', () => {
    expect(computeStageReorder(fiveStages, 'b', 'b')).toBeNull();
  });

  it('é no-op quando activeId ou overId não existem na lista de etapas ativas', () => {
    expect(computeStageReorder(fiveStages, 'nao-existe', 'a')).toBeNull();
    expect(computeStageReorder(fiveStages, 'a', 'nao-existe')).toBeNull();
  });

  it('não renumera nem retorna as etapas não afetadas - somente a arrastada é incluída no resultado', () => {
    const result = computeStageReorder(fiveStages, 'a', 'c');
    // O contrato de retorno já é { stageId, position } de uma única etapa;
    // reforça explicitamente que b/c/d/e não aparecem no resultado.
    expect(result).not.toHaveProperty('b');
    expect(Object.keys(result ?? {})).toEqual(['stageId', 'position']);
  });

  it('com apenas uma etapa ativa, não há vizinho e o resultado é no-op', () => {
    const single = [stage('only', 0)];
    expect(computeStageReorder(single, 'only', 'only')).toBeNull();
  });

  it('etapas arquivadas fornecidas à parte não interferem (a função só enxerga o array recebido)', () => {
    // Reforça o contrato de fronteira: quem chama computeStageReorder deve
    // passar somente as etapas ativas (AC1 - "sem misturar etapas
    // arquivadas na operação"); a função em si não filtra por isActive,
    // então o teste prova que passar só as ativas é suficiente e correto.
    const onlyActive = fiveStages.filter((s) => s.id !== 'e');
    const result = computeStageReorder(onlyActive, 'a', 'c');
    expect(result).toEqual({ stageId: 'a', position: 2.5 });
  });
});
