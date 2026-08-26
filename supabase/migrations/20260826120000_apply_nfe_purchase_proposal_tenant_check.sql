-- SEC-001 do gate da Story 1.57 (docs/qa/gates/1.57-itens-produtos-estoque-nfe.yml,
-- severidade medium) — confirmado como vetor real pela @architect no adendo de
-- 2026-08-26 a docs/architecture/ai-document-ingestion-p3.md (seção "SEC-001 —
-- achado confirmado real"). Pedido em .aiox/briefs/cistern-migration-sec-001-cross-tenant.md.
--
-- O problema: dentro do laço de itens de apply_nfe_purchase_proposal,
-- v_product_id := v_item.matched_product_id atribui o produto casado sem checar
-- a empresa dona dele. matched_product_id é preenchido pelo próprio usuário via
-- saveNfeProposalItem, sob a RLS de document_import_proposal_items — que valida
-- apenas a empresa do ITEM, nunca a do produto referenciado (FK sem escopo de
-- empresa). O INSERT em purchase_items que usa v_product_id não tem nenhum
-- filtro de empresa (a tabela não tem coluna company_id, e a RLS dela só olha
-- purchase_id). As duas escritas em products (cost_price e current_quantity, D10)
-- já são seguras porque ambas filtram WHERE id = v_product_id AND
-- company_id = v_company_id — para produto de outra empresa afetam zero linhas,
-- silenciosamente, sem avisar. Resultado: um usuário da empresa A pode gravar em
-- seu próprio item um matched_product_id de produto da empresa B, e a aplicação
-- da proposta grava em purchase_items uma linha cujo purchase_id é de A e cujo
-- product_id é de B — quebrando, sem erro, o invariante "todo
-- purchase_items.product_id pertence à mesma empresa da purchase_id". A RLS
-- normal do app não expõe isso (products de B continua ilegível para A), mas
-- qualquer caminho que não passe por ela (service_role, relatório, export,
-- feature futura) confiaria nesse invariante quebrado.
--
-- A correção, no desenho da @architect: dentro do mesmo laço, validar
-- EXISTS (SELECT 1 FROM products WHERE id = v_product_id AND company_id =
-- v_company_id) e, se falhar, RAISE EXCEPTION rejeitando a proposta inteira —
-- não pular o item, não aplicar parcialmente. A validação foi colocada logo
-- após v_product_id ser resolvido por matched_product_id OU por GTIN/barcode
-- (os dois ramos que já podem tê-lo preenchido neste ponto do laço) e ANTES do
-- ramo que cadastra produto novo — que ainda não rodou aqui, então não precisa
-- ser revalidado (acabou de ser inserido com company_id = v_company_id, na
-- própria transação). O ramo de GTIN já filtra product.company_id =
-- v_company_id no próprio SELECT, então já era seguro; valida-lo de novo aqui é
-- só simetria (decisão da Dara, deixada em aberto pela @architect), não conserta
-- um buraco adicional.
--
-- Verificado por leitura, nesta sessão, no projeto qxcchymwswontqcwqogm, antes
-- de escrever este arquivo:
--   - pg_get_functiondef confirmou que o corpo remoto de
--     apply_nfe_purchase_proposal é idêntico, linha a linha, ao texto de
--     20260825140000_nfe_purchase_apply_stock_increment.sql (a última aplicada);
--     este CREATE OR REPLACE parte exatamente desse corpo, sem reconstrução de
--     memória.
--   - SELECT cruzando purchase_items -> purchases -> products por company_id
--     não encontrou nenhuma linha existente com purchases.company_id <>
--     products.company_id: nenhuma compra em produção já viola o invariante.
--   - SELECT cruzando document_import_proposal_items -> document_import_proposals
--     -> products (via matched_product_id) não encontrou nenhum item, pendente
--     ou não, cujo produto casado seja de empresa diferente da proposta.
--   - Ou seja: NENHUM dado legítimo hoje em produção seria rejeitado pela nova
--     validação. Risco de regressão: nenhum encontrado.
--
-- NÃO edita 20260814100000_document_import_proposals.sql nem
-- 20260825140000_nfe_purchase_apply_stock_increment.sql — as duas já estão
-- aplicadas em produção. Mesma assinatura, mesmo SECURITY INVOKER (implícito —
-- pg_get_functiondef remoto não lista SECURITY DEFINER, e a definição abaixo
-- também não o faz), preservando todo o resto do corpo, inclusive o incremento
-- de estoque da D10.
--
-- ATENÇÃO — esta migration nasce ESCRITA, mas NÃO APLICADA e NÃO AUTORIZADA.
-- Quem escreveu (@data-engineer / Dara) não aplica: sem apply_migration, sem
-- db push, sem execute_sql de escrita. A autorização é do usuário, levada por
-- @aiox-master (Orion) especificamente para esta migration.

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

    -- SEC-001 (adendo 2026-08-26 a docs/architecture/ai-document-ingestion-p3.md):
    -- v_product_id, neste ponto do laço, só pode ter vindo de
    -- matched_product_id (sem escopo de empresa — o vetor real) ou do SELECT
    -- por GTIN acima (já escopado por company_id = v_company_id, mas
    -- revalidado aqui por simetria). O ramo de produto novo, abaixo, ainda não
    -- rodou. Rejeita a proposta inteira — mesmo padrão de falha alta que os
    -- demais RAISE EXCEPTION desta função — em vez de pular o item ou deixar
    -- o vínculo cross-tenant entrar silenciosamente em purchase_items.
    IF v_product_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.products
         WHERE id = v_product_id AND company_id = v_company_id
       ) THEN
      RAISE EXCEPTION USING ERRCODE = '22023',
        MESSAGE = format(
          'item %s da proposta referencia um produto que não pertence à empresa',
          v_item.position
        );
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
  'Aplica proposta de NF-e de entrada: fornecedor, compra, itens (com dedup de produto por GTIN, validação de empresa em matched_product_id — SEC-001) e parcelas; incrementa current_quantity do produto casado/recém-criado no mesmo laço (D10). SECURITY INVOKER + RLS.';

COMMIT;
