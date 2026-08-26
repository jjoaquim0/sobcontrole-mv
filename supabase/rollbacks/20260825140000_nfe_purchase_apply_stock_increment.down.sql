-- Rollback — D10 (adendo 2026-08-25 a docs/architecture/ai-document-ingestion-p3.md):
-- desfaz 20260825140000_nfe_purchase_apply_stock_increment.sql.
--
-- Restaura public.apply_nfe_purchase_proposal ao texto literal de
-- 20260814100000_document_import_proposals.sql:437-539 (sem o UPDATE de
-- current_quantity nem a variável v_item_quantity), reproduzido aqui por
-- texto — não por pg_get_functiondef/EXECUTE — mesmo padrão já usado em
-- supabase/rollbacks/20260814101500_ai_usage_feature_dimension.down.sql.
--
-- ATENÇÃO: depois deste rollback, apply_nfe_purchase_proposal volta a criar
-- compra/itens/parcelas SEM tocar products.current_quantity — o produto
-- recém-criado volta a nascer com estoque 0 e o produto casado não recebe
-- incremento nenhum. Isso reabre a lacuna que a migration existia para
-- fechar (achado do adendo: nem a RPC nem nenhum trigger tocavam estoque).
-- Só reverta isto se a intenção for voltar ao comportamento de piloto do
-- AC9 da Story 1.56 (zero mudança de estoque na importação).

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_nfe_purchase_proposal(p_proposal_id UUID)
RETURNS public.document_import_proposals
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.document_import_proposals%ROWTYPE;
  v_company_id UUID := (SELECT public.get_user_company_id());
  v_supplier_id UUID;
  v_purchase_id TEXT;
  v_purchase JSONB;
  v_installment JSONB;
  v_item RECORD;
  v_product_id UUID;
  v_subtotal NUMERIC(14, 4);
  v_installment_count INTEGER := 0;
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
  IF v_proposal.document_category <> 'nota_fiscal' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'proposta não é de nota fiscal de entrada';
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

  v_purchase := v_proposal.payload -> 'purchase';
  IF v_purchase IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'payload da proposta não contém dados da compra';
  END IF;

  -- Segue a convenção já usada pelo app (purchaseService.ts): purchases.id é
  -- TEXT com prefixo, não UUID. Reproduzido aqui no server para manter o
  -- mesmo formato, não porque o app exija especificamente este algoritmo.
  v_purchase_id := 'CMP-' || upper(substr(md5(gen_random_uuid()::text), 1, 7));

  INSERT INTO public.purchases (
    id, company_id, supplier_id, total_amount, discount, fee, final_value,
    status, payment_method, notes, created_by
  ) VALUES (
    v_purchase_id, v_company_id, v_supplier_id,
    COALESCE((v_purchase ->> 'total_amount')::NUMERIC, 0),
    COALESCE((v_purchase ->> 'discount')::NUMERIC, 0),
    COALESCE((v_purchase ->> 'fee')::NUMERIC, 0),
    COALESCE((v_purchase ->> 'final_value')::NUMERIC, 0),
    'pending',
    COALESCE(NULLIF(btrim(v_purchase ->> 'payment_method'), ''), 'other'),
    COALESCE(v_purchase ->> 'notes', ''),
    auth.uid()
  );

  FOR v_item IN
    SELECT * FROM public.document_import_proposal_items
    WHERE proposal_id = p_proposal_id
    ORDER BY position
    FOR UPDATE
  LOOP
    v_product_id := v_item.matched_product_id;

    IF v_product_id IS NULL
       AND v_item.payload ? 'barcode'
       AND length(btrim(v_item.payload ->> 'barcode')) > 0 THEN
      SELECT product.id INTO v_product_id
      FROM public.products AS product
      WHERE product.company_id = v_company_id
        AND product.barcode = btrim(v_item.payload ->> 'barcode');
    END IF;

    IF v_product_id IS NULL THEN
      -- Sem casamento de GTIN/SKU: exige dados completos de um produto novo,
      -- coletados na tela de revisão. Nunca inventa categoria, unidade ou
      -- preço de venda — nenhum desses é extraível do documento de compra.
      IF NOT (v_item.payload ? 'new_product_category_id')
         OR NOT (v_item.payload ? 'new_product_name')
         OR NOT (v_item.payload ? 'new_product_sale_price')
         OR NOT (v_item.payload ? 'new_product_unit') THEN
        RAISE EXCEPTION USING ERRCODE = '22023',
          MESSAGE = format(
            'item %s da proposta não tem produto vinculado nem dados completos '
            'para cadastrar um novo (categoria, nome, unidade e preço de venda)',
            v_item.position
          );
      END IF;

      v_product_id := gen_random_uuid();
      INSERT INTO public.products (
        id, company_id, category_id, name, sku, barcode, unit,
        cost_price, sale_price, current_quantity, min_quantity, max_quantity, is_active
      ) VALUES (
        v_product_id, v_company_id, (v_item.payload ->> 'new_product_category_id')::UUID,
        btrim(v_item.payload ->> 'new_product_name'),
        COALESCE(NULLIF(btrim(v_item.payload ->> 'sku'), ''), 'IMP-' || upper(substr(v_product_id::text, 1, 6))),
        NULLIF(btrim(v_item.payload ->> 'barcode'), ''),
        btrim(v_item.payload ->> 'new_product_unit'),
        COALESCE((v_item.payload ->> 'document_unit_cost')::NUMERIC, 0),
        (v_item.payload ->> 'new_product_sale_price')::NUMERIC,
        0, 0, 0, true
      );
    ELSIF v_item.update_cost_decision = 'update' THEN
      -- QA-2: decisão por item. Só atualiza o custo do cadastro, nunca outro
      -- campo do produto.
      UPDATE public.products
      SET cost_price = COALESCE((v_item.payload ->> 'document_unit_cost')::NUMERIC, cost_price)
      WHERE id = v_product_id AND company_id = v_company_id;
    END IF;

    v_subtotal := COALESCE((v_item.payload ->> 'quantity')::NUMERIC, 0)
      * COALESCE((v_item.payload ->> 'document_unit_cost')::NUMERIC, 0);

    INSERT INTO public.purchase_items (id, purchase_id, product_id, quantity, unit_cost, subtotal)
    VALUES (
      'CMPIT-' || upper(substr(md5(gen_random_uuid()::text), 1, 7)),
      v_purchase_id, v_product_id,
      COALESCE((v_item.payload ->> 'quantity')::NUMERIC, 0),
      COALESCE((v_item.payload ->> 'document_unit_cost')::NUMERIC, 0),
      v_subtotal
    );

    UPDATE public.document_import_proposal_items
    SET matched_product_id = v_product_id
    WHERE id = v_item.id;
  END LOOP;

  -- NF-e pode trazer várias parcelas (cobr>dup no XML — D6). Uma proposta sem
  -- nenhuma parcela é estado de negócio inválido: não inventa vencimento.
  FOR v_installment IN
    SELECT * FROM jsonb_array_elements(COALESCE(v_purchase -> 'installments', '[]'::jsonb))
  LOOP
    v_installment_count := v_installment_count + 1;
    INSERT INTO public.account_payables (
      id, company_id, purchase_id, supplier_id, amount, due_date, status, description
    ) VALUES (
      'PAG-' || upper(substr(md5(gen_random_uuid()::text), 1, 7)),
      v_company_id, v_purchase_id, v_supplier_id,
      (v_installment ->> 'amount')::NUMERIC,
      (v_installment ->> 'due_date')::TIMESTAMPTZ,
      'pending',
      format('Compra %s — importação de NF-e', v_purchase_id)
    );
  END LOOP;

  IF v_installment_count = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'payload da proposta não contém nenhuma parcela (purchase.installments) '
        'para gerar contas a pagar';
  END IF;

  UPDATE public.document_import_proposals
  SET status = 'applied', applied_at = now(), applied_by = auth.uid()
  WHERE id = p_proposal_id
  RETURNING * INTO v_proposal;

  RETURN v_proposal;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_nfe_purchase_proposal(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_nfe_purchase_proposal(UUID) TO authenticated;

COMMENT ON FUNCTION public.apply_nfe_purchase_proposal(UUID) IS
  'Aplica proposta de NF-e de entrada: fornecedor, compra, itens (com dedup de produto por GTIN) e parcelas. SECURITY INVOKER + RLS.';

COMMIT;
