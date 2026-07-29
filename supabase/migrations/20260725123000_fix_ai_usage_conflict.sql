-- Story 1.20 - Corrige ambiguidade entre a coluna de retorno company_id
-- e a coluna homônima usada na inferência de conflito da janela de uso.
--
-- A reescrita mantém a função e seus privilégios; apenas troca as duas
-- cláusulas por ON CONFLICT DO NOTHING, que preserva a idempotência esperada.

BEGIN;

DO $migration$
DECLARE
  v_signature REGPROCEDURE :=
    'public.reserve_ai_usage(uuid,uuid,integer)'::REGPROCEDURE;
  v_definition TEXT;
  v_rewritten TEXT;
  v_ambiguous_clause CONSTANT TEXT :=
    'ON CONFLICT (company_id, scope, subject_id, window_start, window_seconds) DO NOTHING';
  v_safe_clause CONSTANT TEXT := 'ON CONFLICT DO NOTHING';
BEGIN
  SELECT pg_get_functiondef(v_signature)
  INTO v_definition;

  v_rewritten := replace(v_definition, v_ambiguous_clause, v_safe_clause);

  IF v_rewritten = v_definition THEN
    IF position(v_safe_clause IN v_definition) = 0 THEN
      RAISE EXCEPTION
        'reserve_ai_usage has an unexpected definition; conflict clause was not changed';
    END IF;

    RETURN;
  END IF;

  EXECUTE v_rewritten;
END
$migration$;

COMMIT;
