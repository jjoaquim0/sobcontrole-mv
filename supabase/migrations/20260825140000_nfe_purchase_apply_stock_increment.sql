-- D10 do adendo (2026-08-25) a docs/architecture/ai-document-ingestion-p3.md
-- ("Adendo (2026-08-25) — onde e como o estoque entra na aplicação da
-- proposta de NF-e"): apply_nfe_purchase_proposal passa a incrementar
-- products.current_quantity dentro do próprio laço de itens, na mesma
-- transação da compra — opção A do leque da Aria, escolhida por preservar
-- atomicidade sem lock explícito adicional (UPDATE ... SET x = x + n é uma
-- única instrução; Postgres serializa updates concorrentes na mesma linha).
--
-- NÃO edita 20260814100000_document_import_proposals.sql — esse arquivo já
-- rodou em produção. Este é um CREATE OR REPLACE FUNCTION novo sobre a mesma
-- assinatura (mesmo padrão que 20260814101500_ai_usage_feature_dimension.sql
-- já usou para reserve_ai_usage/finalize_ai_usage), preservando o resto do
-- corpo da função sem alteração:
--
--   - dentro do LOOP de itens, depois de resolver v_product_id (produto
--     casado por matched_product_id/barcode OU recém-criado — os dois ramos
--     do IF), um UPDATE incondicional de estoque, FORA do
--     ELSIF update_cost_decision = 'update' (custo e quantidade são
--     independentes; não podem ficar aninhados um no outro);
--   - a quantidade é a mesma expressão já usada para v_subtotal
--     (COALESCE((v_item.payload ->> 'quantity')::NUMERIC, 0)), nomeada em
--     v_item_quantity para não repetir esse COALESCE dentro do UPDATE novo;
--   - o INSERT de produto novo CONTINUA gravando current_quantity = 0 —
--     não é tocado por esta migration. É o UPDATE incondicional que roda
--     depois, para os dois ramos do IF, que leva o produto recém-criado de
--     0 a 0 + v_item_quantity. Confirmado lendo o arquivo aplicado: o INSERT
--     de produto novo (20260814100000:470-482) usa `0, 0, 0` para
--     current_quantity/min_quantity/max_quantity — não há duplicação de
--     estoque para produto novo.
--
-- Fora de escopo desta migration, por decisão registrada no adendo: opção B
-- (trigger em purchase_items) foi descartada porque dobraria o estoque da
-- compra manual, que já incrementa current_quantity no cliente
-- (src/services/purchaseService.ts:236-248) — corrigir esse read-modify-write
-- não é pré-requisito técnico da opção A e fica fora desta onda.
--
-- ATENÇÃO — esta migration nasce ESCRITA E REVISADA, mas INAPLICÁVEL até a
-- reconciliação de docs/data/document-import-proposals-schema.md §10
-- acontecer. A migration 20260814100000 foi aplicada em 2026-08-22 e ficou
-- registrada em supabase_migrations.schema_migrations sob a versão
-- 20260822182249 (confirmado lendo a tabela nesta sessão: SELECT version,
-- name FROM supabase_migrations.schema_migrations ORDER BY version DESC
-- LIMIT 1 -> {"version":"20260822182249","name":"document_import_proposals"}),
-- não sob 20260814100000. Um `supabase db push` hoje tentaria rodar
-- 20260814100000 de novo antes de chegar a esta migration, e falharia nos
-- CREATE POLICY/CREATE TRIGGER sem IF NOT EXISTS daquele arquivo (SQLSTATE
-- 42710, duplicate_object) — travando a fila de pendentes antes de alcançar
-- esta. Reconciliar (opção A ou B do §10 daquele documento) é pré-requisito
-- de sequenciamento, não de mérito desta mudança. NÃO APLICAR sem que essa
-- reconciliação tenha acontecido E sem autorização explícita do usuário para
-- este push especificamente.

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
  v_item_quantity NUMERIC(14, 4);
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

    -- D10 (docs/architecture/ai-document-ingestion-p3.md, "Adendo
    -- 2026-08-25"): aplicar a proposta passa a mover estoque. Incondicional
    -- para os dois ramos do IF acima (produto casado ou recém-criado) e FORA
    -- do ELSIF de custo — quantidade e custo são decisões independentes.
    -- Produto recém-criado sai de 0 (INSERT acima, inalterado) para
    -- 0 + v_item_quantity; produto casado soma v_item_quantity ao que já
    -- tinha. Nenhum dos dois duplica: exatamente um UPDATE de estoque por
    -- item do laço.
    v_item_quantity := COALESCE((v_item.payload ->> 'quantity')::NUMERIC, 0);

    UPDATE public.products
    SET current_quantity = current_quantity + v_item_quantity
    WHERE id = v_product_id AND company_id = v_company_id;

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
  'Aplica proposta de NF-e de entrada: fornecedor, compra, itens (com dedup de produto por GTIN) e parcelas; incrementa current_quantity do produto casado/recém-criado no mesmo laço (D10). SECURITY INVOKER + RLS.';

COMMIT;
