import { arrayMove } from '@dnd-kit/sortable';
import { PipelineStage } from '../../../types';

export interface StageReorderResult {
  stageId: string;
  position: number;
}

/**
 * Algoritmo determinístico de reordenação de etapas (Story 1.36, AC2).
 *
 * 1. Ordena as etapas ativas por `position` ASC.
 * 2. Usa `arrayMove` (mesma utilidade do @dnd-kit já usada no projeto) para
 *    remover a etapa arrastada da lista de trabalho e reinseri-la no índice
 *    final indicado pelo drop - equivalente a "remover e inserir no índice
 *    final" descrito na story, sem depender de reimplementar a semântica de
 *    índice do dnd-kit manualmente.
 * 3. A nova posição é sempre calculada a partir dos vizinhos finais (que
 *    mantêm sua `position` original - nenhuma etapa não afetada é
 *    renumerada): ponto médio entre vizinhas, `next.position - 1` no início,
 *    `previous.position + 1` no fim.
 * 4. Se o índice final coincidir com o original (ou, por segurança extra, se
 *    a posição calculada for igual à posição atual), retorna `null` - é
 *    no-op e nenhuma mutation deve ser chamada pelo chamador.
 *
 * Só a etapa arrastada é retornada para gravação; as demais nunca têm sua
 * `position` alterada por esta função.
 */
export function computeStageReorder(
  activeStages: PipelineStage[],
  activeId: string,
  overId: string
): StageReorderResult | null {
  const ordered = [...activeStages].sort((a, b) => a.position - b.position);
  const oldIndex = ordered.findIndex((s) => s.id === activeId);
  const newIndex = ordered.findIndex((s) => s.id === overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return null;

  const dragged = ordered[oldIndex];
  const reordered = arrayMove(ordered, oldIndex, newIndex);
  const finalIndex = reordered.findIndex((s) => s.id === activeId);
  const previous = reordered[finalIndex - 1];
  const next = reordered[finalIndex + 1];

  let position: number;
  if (previous && next) {
    position = (previous.position + next.position) / 2;
  } else if (!previous && next) {
    position = next.position - 1;
  } else if (previous && !next) {
    position = previous.position + 1;
  } else {
    // Lista com um único item ativo: não há vizinho para calcular midpoint,
    // então não há o que reordenar.
    return null;
  }

  if (position === dragged.position) return null;

  return { stageId: dragged.id, position };
}
