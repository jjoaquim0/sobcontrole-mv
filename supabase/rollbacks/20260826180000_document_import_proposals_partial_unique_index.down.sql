-- Rollback — Story 1.59 (D18): desfaz
-- 20260826180000_document_import_proposals_partial_unique_index.sql.
--
-- Restaura a UNIQUE (company_id, idempotency_key) incondicional, com o MESMO nome que a
-- constraint original tinha (document_import_proposals_company_id_idempotency_key_key),
-- para que pg_constraint volte a mostrar exatamente o que mostrava antes desta migration.
--
-- ATENÇÃO — este rollback pode FALHAR depois que a migration estiver em uso real (não no
-- momento em que foi escrito, quando a tabela tinha 0 linhas): se, enquanto o índice parcial
-- estava em vigor, duas propostas 'rejected' e/ou 'expired' da MESMA empresa acumularem a
-- MESMA idempotency_key (exatamente o que a migration passou a permitir de propósito),
-- ADD CONSTRAINT UNIQUE falha com 23505 (duplicate key) ao tentar reconstruir a trava
-- incondicional sobre dados que já a violam. Quem for reverter precisa checar antes:
--
--   SELECT company_id, idempotency_key, count(*)
--   FROM public.document_import_proposals
--   GROUP BY company_id, idempotency_key
--   HAVING count(*) > 1;
--
-- Se essa consulta retornar alguma linha, o rollback não pode ser aplicado sem antes decidir
-- o que fazer com essas propostas mortas duplicadas (não é este arquivo que decide isso).

BEGIN;

DROP INDEX public.document_import_proposals_company_id_idempotency_key_key;

ALTER TABLE public.document_import_proposals
  ADD CONSTRAINT document_import_proposals_company_id_idempotency_key_key
  UNIQUE (company_id, idempotency_key);

COMMIT;
