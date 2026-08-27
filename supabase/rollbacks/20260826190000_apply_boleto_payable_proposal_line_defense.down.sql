-- Rollback — Story 1.58 (D16): desfaz
-- 20260826190000_apply_boleto_payable_proposal_line_defense.sql.
--
-- Restaura public.apply_boleto_payable_proposal ao texto confirmado por
-- pg_get_functiondef nesta sessão, antes desta migration (sem a defesa de D16 — payload
-- volta a ser usado direto, sem comparação com idempotency_key), reproduzido aqui por
-- texto, mesmo padrão já usado nos demais rollbacks pareados deste projeto.
--
-- ATENÇÃO: depois deste rollback, apply_boleto_payable_proposal volta a confiar em
-- payload.payable.amount/due_date sem checagem — reabre o vetor D16 confirmado no adendo
-- de 2026-08-26 a docs/architecture/ai-document-ingestion-p3.md. Só reverta isto se a
-- intenção for voltar deliberadamente a esse estado.

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_boleto_payable_proposal(p_proposal_id UUID)
RETURNS public.document_import_proposals
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.document_import_proposals%ROWTYPE;
  v_company_id UUID := (SELECT public.get_user_company_id());
  v_supplier_id UUID;
  v_payable JSONB;
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'autenticação necessária';
  END IF;

  SELECT * INTO v_proposal
  FROM public.document_import_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposal.company_id <> v_company_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'proposta não encontrada';
  END IF;
  IF v_proposal.document_category <> 'boleto' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'proposta não é de boleto';
  END IF;
  IF v_proposal.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = format('proposta não está pendente (status atual: %s)', v_proposal.status);
  END IF;
  IF v_proposal.expires_at < now() THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'proposta expirada; solicite nova extração';
  END IF;

  v_supplier_id := public.resolve_or_create_supplier(
    v_company_id,
    v_proposal.payload #>> '{supplier,document}',
    v_proposal.payload #>> '{supplier,name}',
    v_proposal.payload #>> '{supplier,email}',
    v_proposal.payload #>> '{supplier,phone}'
  );

  v_payable := v_proposal.payload -> 'payable';
  IF v_payable IS NULL OR NOT (v_payable ? 'amount') OR NOT (v_payable ? 'due_date') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'payload da proposta não contém valor e vencimento do boleto';
  END IF;

  INSERT INTO public.account_payables (
    id, company_id, purchase_id, supplier_id, amount, due_date, status, payment_method, description
  ) VALUES (
    'PAG-' || upper(substr(md5(gen_random_uuid()::text), 1, 7)),
    v_company_id, NULL, v_supplier_id,
    (v_payable ->> 'amount')::NUMERIC,
    (v_payable ->> 'due_date')::TIMESTAMPTZ,
    'pending',
    'bank_slip',
    COALESCE(NULLIF(btrim(v_payable ->> 'description'), ''), 'Boleto importado')
  );

  UPDATE public.document_import_proposals
  SET status = 'applied', applied_at = now(), applied_by = auth.uid()
  WHERE id = p_proposal_id
  RETURNING * INTO v_proposal;

  RETURN v_proposal;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_boleto_payable_proposal(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_boleto_payable_proposal(UUID) TO authenticated;

COMMENT ON FUNCTION public.apply_boleto_payable_proposal(UUID) IS
  'Aplica proposta de boleto: fornecedor e conta a pagar (payment_method=bank_slip) a partir do payload da proposta. SECURITY INVOKER + RLS.';

COMMIT;
