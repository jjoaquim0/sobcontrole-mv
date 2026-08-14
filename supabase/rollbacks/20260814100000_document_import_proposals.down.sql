-- Rollback — Importação Inteligente de Documentos: tabelas de proposta,
-- RLS e RPCs de aplicação (20260814100000_document_import_proposals.sql).
--
-- ATENÇÃO: dropa toda proposta/job/item existentes, aplicados ou não.
-- Nenhuma tabela de domínio (purchases, account_payables, products,
-- customers, deals, suppliers) é tocada aqui — o que essas RPCs já
-- gravaram nelas permanece; só a trilha da proposta que gerou o registro
-- é perdida (idempotency_key deixa de existir, então uma reimportação do
-- mesmo documento não seria mais detectada como duplicata).

BEGIN;

DROP TABLE IF EXISTS public.document_import_proposal_items CASCADE;
DROP TABLE IF EXISTS public.document_import_proposals CASCADE;
DROP TABLE IF EXISTS public.document_extraction_jobs CASCADE;

DROP FUNCTION IF EXISTS public.document_import_set_updated_at();

DROP FUNCTION IF EXISTS public.reject_document_import_proposal(UUID, TEXT);
DROP FUNCTION IF EXISTS public.apply_contract_deal_proposal(UUID);
DROP FUNCTION IF EXISTS public.apply_boleto_payable_proposal(UUID);
DROP FUNCTION IF EXISTS public.apply_nfe_purchase_proposal(UUID);
DROP FUNCTION IF EXISTS public.resolve_or_create_customer(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.resolve_or_create_supplier(UUID, TEXT, TEXT, TEXT, TEXT);

COMMIT;
