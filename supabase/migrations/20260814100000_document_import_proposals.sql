-- Importação Inteligente de Documentos — camada de persistência de propostas.
-- P3 (docs/architecture/ai-document-ingestion-p3.md), passo 1 da sequência sugerida.
--
-- Esta migration cria APENAS a camada de "propose-then-apply" (D2/D3 do ADR):
-- job assíncrono de extração, proposta com origem por campo, itens com decisão
-- de custo (QA-2), e as RPCs de aplicação que transformam proposta em registro
-- de domínio. A IA nunca escreve aqui — ela grava proposta 'pending'; quem
-- escreve no domínio é o clique do usuário, via RPC SECURITY INVOKER, sob RLS.
--
-- NÃO mexe em ai_usage_windows/ai_usage_logs (dimensão `feature`): ver
-- 20260814101500_ai_usage_feature_dimension.sql, migration separada por
-- decisão registrada em docs/data/document-import-proposals-schema.md.
--
-- NÃO altera purchases, account_payables, products, customers, deals,
-- suppliers — apenas grava linhas neles através das RPCs de aplicação,
-- sob o mesmo regime de RLS que o usuário já tem para essas tabelas hoje.

BEGIN;

-- =============================================================================
-- 1. TABELAS
-- =============================================================================

-- Job de extração: unidade assíncrona de trabalho. Sobrevive a timeout da Edge
-- Function e permite retry sob a mesma idempotency_key (D8). A categoria é a
-- escolhida pelo usuário no upload (D4) — o documento não escolhe o próprio
-- contrato de escrita.
CREATE TABLE IF NOT EXISTS public.document_extraction_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES public.document_versions(id) ON DELETE CASCADE,
  document_category TEXT NOT NULL CHECK (document_category IN ('nota_fiscal', 'boleto', 'contrato')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'failed', 'done')),
  -- Conhecida de forma síncrona no momento da criação do job para NF-e (chave
  -- extraída do XML) e boleto (linha digitável colada pelo usuário); sintética
  -- a partir de document_version_id para contrato, que não tem chave natural
  -- (ver tabela D8 do ADR). Nula apenas se a extração ainda não a determinou.
  -- NÃO é a trava de deduplicação — essa mora em document_import_proposals
  -- (ver comentário na coluna correspondente). Aqui serve só para correlação
  -- de retry.
  idempotency_key TEXT,
  error TEXT,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CHECK (status <> 'failed' OR error IS NOT NULL)
);

-- Proposta: o que a IA/parser extraiu, ainda não aplicado. `payload` carrega os
-- dados de cabeçalho (fornecedor, compra, parcelas, cliente, negócio — o
-- formato exato depende de document_category e é validado pela Edge Function
-- contra o JSON Schema do contrato, não aqui). `field_origins` é um mapa
-- campo -> 'deterministic' | 'model', para a tela mostrar proveniência (D5).
CREATE TABLE IF NOT EXISTS public.document_import_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.document_extraction_jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  document_category TEXT NOT NULL CHECK (document_category IN ('nota_fiscal', 'boleto', 'contrato')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'rejected', 'expired')),
  -- Trava de idempotência (D8). Chave de acesso de 44 dígitos (NF-e) ou linha
  -- digitável de 47 dígitos (boleto), ambas validáveis offline por módulo
  -- 10/11; para contrato, document_version_id (não há chave natural). Mora
  -- aqui — e não em purchases/account_payables — para não poluir o domínio
  -- com campo de proveniência (decisão fechada do brief).
  idempotency_key TEXT NOT NULL CHECK (length(btrim(idempotency_key)) > 0),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  field_origins JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(field_origins) = 'object'),
  -- Salvaguarda R10 (docs/architecture/ai-document-ingestion-p3.md:342):
  -- de onde veio o TEXTO que alimentou a extração — não confundir com
  -- field_origins, que é por campo (determinístico x modelo). NULL na v1:
  -- rota XML e linha digitável de boleto não passam por conversão de texto
  -- nenhuma, não há origem a declarar. Só passa a ser preenchida com
  -- 'client' a partir da onda de pdf.js no navegador (onda 5) — quando o
  -- servidor recebe texto que ele não produziu e não pode reconferir contra
  -- o PDF guardado, e a tela de revisão precisa avisar o revisor disso.
  -- 'server' fica reservado para uma eventual rota de texto produzida no
  -- servidor, que não existe hoje. É atributo do documento inteiro, por
  -- isso mora na proposta e não no item.
  text_origin TEXT CHECK (text_origin IS NULL OR text_origin IN ('server', 'client')),
  -- Documento truncado pelo teto de entrada gera proposta parcial DECLARADA
  -- (mesmo padrão de honestidade de ToolResponseMetadata), nunca silenciosa.
  truncated BOOLEAN NOT NULL DEFAULT false,
  applied_at TIMESTAMPTZ,
  applied_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  -- Política de expiração é RECOMENDAÇÃO, registrada aqui como coluna e
  -- default; nenhum job agendado a aplica nesta migration (ver nota de
  -- desenho, seção "Questões abertas"). As RPCs de aplicação recusam propor
  -- aplicar/rejeitar proposta expirada.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, idempotency_key),
  CHECK (status <> 'applied' OR (applied_at IS NOT NULL AND applied_by IS NOT NULL)),
  CHECK (status <> 'rejected' OR (rejected_at IS NOT NULL AND rejected_by IS NOT NULL))
);

-- Item de proposta: N itens por documento (NF-e multi-item exige — QA-1
-- reposicionou esta necessidade para a NF-e depois que extrato saiu de
-- escopo). `update_cost_decision` é a decisão por item da QA-2: o usuário
-- escolhe, item a item, se o custo da nota substitui o custo atual do
-- cadastro. O teto de itens (position < 200) é PLACEHOLDER até prototipagem
-- medir o número real (ver nota de desenho) — para alterar depois:
--   ALTER TABLE document_import_proposal_items
--     DROP CONSTRAINT document_import_proposal_items_max_position,
--     ADD CONSTRAINT document_import_proposal_items_max_position
--       CHECK (position < <novo_valor>);
CREATE TABLE IF NOT EXISTS public.document_import_proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.document_import_proposals(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  field_origins JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(field_origins) = 'object'),
  -- Dedup por GTIN/barcode (ADR, seção "Deduplicação por entidade"). NULL até
  -- a extração ou a tela resolverem o vínculo; a RPC de aplicação tenta
  -- casar por barcode se ainda nulo, e exige dados completos de novo produto
  -- caso não haja casamento algum.
  matched_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  current_cost NUMERIC(14, 4) CHECK (current_cost IS NULL OR current_cost >= 0),
  document_cost NUMERIC(14, 4) CHECK (document_cost IS NULL OR document_cost >= 0),
  update_cost_decision TEXT NOT NULL DEFAULT 'pending'
    CHECK (update_cost_decision IN ('pending', 'update', 'keep')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, position),
  CONSTRAINT document_import_proposal_items_max_position CHECK (position < 200)
);

CREATE INDEX IF NOT EXISTS idx_document_extraction_jobs_company_status
  ON public.document_extraction_jobs(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_extraction_jobs_document_version
  ON public.document_extraction_jobs(document_version_id);
CREATE INDEX IF NOT EXISTS idx_document_extraction_jobs_idempotency
  ON public.document_extraction_jobs(company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_document_import_proposals_company_status
  ON public.document_import_proposals(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_import_proposals_job
  ON public.document_import_proposals(job_id);

CREATE INDEX IF NOT EXISTS idx_document_import_proposal_items_proposal
  ON public.document_import_proposal_items(proposal_id, position);

-- =============================================================================
-- 2. updated_at automático (padrão já usado no módulo de impostos: função de
--    trigger escopada ao módulo, não compartilhada globalmente)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.document_import_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_document_extraction_jobs_updated_at
  BEFORE UPDATE ON public.document_extraction_jobs
  FOR EACH ROW EXECUTE FUNCTION public.document_import_set_updated_at();

CREATE TRIGGER trg_document_import_proposals_updated_at
  BEFORE UPDATE ON public.document_import_proposals
  FOR EACH ROW EXECUTE FUNCTION public.document_import_set_updated_at();

CREATE TRIGGER trg_document_import_proposal_items_updated_at
  BEFORE UPDATE ON public.document_import_proposal_items
  FOR EACH ROW EXECUTE FUNCTION public.document_import_set_updated_at();

-- =============================================================================
-- 3. RLS — mesmo padrão do projeto (company_id = get_user_company_id()).
--    Mutação de status (pending -> applied/rejected) e escrita de domínio só
--    acontecem pelas RPCs abaixo. A tela de revisão edita `payload` e a
--    decisão por item diretamente, sob RLS, enquanto a proposta segue
--    pendente — sem poder tocar `status`, que não está no GRANT de coluna.
-- =============================================================================

ALTER TABLE public.document_extraction_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_import_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_import_proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jobs de extração visíveis aos membros da empresa"
  ON public.document_extraction_jobs
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()));

CREATE POLICY "Propostas visíveis aos membros da empresa"
  ON public.document_import_proposals
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()));

CREATE POLICY "Propostas pendentes editáveis pelos membros da empresa"
  ON public.document_import_proposals
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()) AND status = 'pending')
  WITH CHECK (company_id = (SELECT public.get_user_company_id()) AND status = 'pending');

CREATE POLICY "Itens de proposta visíveis aos membros da empresa"
  ON public.document_import_proposal_items
  FOR SELECT TO authenticated
  USING (company_id = (SELECT public.get_user_company_id()));

CREATE POLICY "Itens de proposta pendente editáveis pelos membros da empresa"
  ON public.document_import_proposal_items
  FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT public.get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.document_import_proposals proposal
      WHERE proposal.id = document_import_proposal_items.proposal_id
        AND proposal.status = 'pending'
    )
  )
  WITH CHECK (
    company_id = (SELECT public.get_user_company_id())
    AND EXISTS (
      SELECT 1 FROM public.document_import_proposals proposal
      WHERE proposal.id = document_import_proposal_items.proposal_id
        AND proposal.status = 'pending'
    )
  );

-- service_role (Edge Function assíncrona) não é tocado abaixo: mantém
-- privilégio implícito de projeto, mesmo padrão de ai_usage_windows/logs.
REVOKE ALL ON TABLE public.document_extraction_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.document_extraction_jobs TO authenticated;

REVOKE ALL ON TABLE public.document_import_proposals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.document_import_proposals TO authenticated;
GRANT UPDATE (payload) ON TABLE public.document_import_proposals TO authenticated;

REVOKE ALL ON TABLE public.document_import_proposal_items FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.document_import_proposal_items TO authenticated;
GRANT UPDATE (payload, matched_product_id, update_cost_decision)
  ON TABLE public.document_import_proposal_items TO authenticated;

-- =============================================================================
-- 4. Helpers de dedup — reaproveitados pelas RPCs de aplicação. Expostos
--    diretamente a authenticated: isso não abre privilégio novo, porque
--    suppliers e customers já são graváveis diretamente pelo usuário sob RLS
--    hoje (supplierService.ts / customerService.ts fazem INSERT direto via
--    supabase-js). SECURITY INVOKER: rodam sob RLS de suppliers/customers.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_or_create_supplier(
  p_company_id UUID,
  p_document TEXT,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_supplier_id UUID;
BEGIN
  IF p_document IS NULL OR length(btrim(p_document)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'documento do fornecedor é obrigatório para aplicar a proposta';
  END IF;

  SELECT supplier.id INTO v_supplier_id
  FROM public.suppliers AS supplier
  WHERE supplier.company_id = p_company_id
    AND supplier.document = btrim(p_document);

  IF FOUND THEN
    RETURN v_supplier_id;
  END IF;

  IF p_name IS NULL OR length(btrim(p_name)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'nome do fornecedor é obrigatório para cadastrar um novo fornecedor';
  END IF;

  v_supplier_id := gen_random_uuid();
  INSERT INTO public.suppliers (id, company_id, name, email, phone, document, status)
  VALUES (
    v_supplier_id, p_company_id, btrim(p_name),
    COALESCE(p_email, ''), COALESCE(p_phone, ''), btrim(p_document), 'active'
  );

  RETURN v_supplier_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_or_create_customer(
  p_company_id UUID,
  p_document TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_address TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_id UUID;
BEGIN
  IF p_document IS NULL OR length(btrim(p_document)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'documento do cliente é obrigatório para aplicar a proposta';
  END IF;

  SELECT customer.id INTO v_customer_id
  FROM public.customers AS customer
  WHERE customer.company_id = p_company_id
    AND customer.document = btrim(p_document);

  IF FOUND THEN
    RETURN v_customer_id;
  END IF;

  IF p_full_name IS NULL OR length(btrim(p_full_name)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'nome do cliente é obrigatório para cadastrar um novo cliente';
  END IF;

  v_customer_id := gen_random_uuid();
  INSERT INTO public.customers (id, company_id, full_name, document, email, phone, address, is_active)
  VALUES (
    v_customer_id, p_company_id, btrim(p_full_name), btrim(p_document),
    COALESCE(p_email, ''), COALESCE(p_phone, ''), COALESCE(p_address, ''), true
  );

  RETURN v_customer_id;
END;
$$;

-- =============================================================================
-- 5. RPCs de aplicação — uma por tipo de documento (não genérica).
--
-- Justificativa: NF-e, boleto e contrato escrevem em conjuntos de tabelas
-- disjuntos com regras de negócio próprias (parcelas de NF-e x pagamento
-- único de boleto x default de etapa/responsável de contrato — QA-3). Uma
-- função genérica com switch por categoria misturaria três domínios de
-- negócio em uma função monolítica, contra o padrão já provado do projeto
-- (uma função por read-only tool). O contrato (D4) já declara `applyRpc`
-- por tipo — isso é o espelho, do lado de escrita.
--
-- Todas: SECURITY INVOKER, auth.uid(), operam inteiramente sob RLS das
-- tabelas de domínio. Nenhuma reimplementa checagem de papel — se o usuário
-- não tiver INSERT em purchases/account_payables/products/suppliers pela
-- RLS já existente, a instrução falha e a exceção propaga, e a proposta
-- permanece 'pending' (corpo de função é atômico dentro da transação do
-- chamador).
-- =============================================================================

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

  -- AccountPayable.supplierId é obrigatório (types/index.ts:341) — boleto não
  -- é escrita isolada, precisa de fornecedor resolvido ou criado.
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

CREATE OR REPLACE FUNCTION public.apply_contract_deal_proposal(p_proposal_id UUID)
RETURNS public.document_import_proposals
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.document_import_proposals%ROWTYPE;
  v_company_id UUID := (SELECT public.get_user_company_id());
  v_customer_id UUID;
  v_deal JSONB;
  v_deal_id UUID;
  v_stage_id UUID;
  v_owner_id UUID;
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
  IF v_proposal.document_category <> 'contrato' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'proposta não é de contrato';
  END IF;
  IF v_proposal.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = format('proposta não está pendente (status atual: %s)', v_proposal.status);
  END IF;
  IF v_proposal.expires_at < now() THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'proposta expirada; solicite nova extração';
  END IF;

  v_customer_id := public.resolve_or_create_customer(
    v_company_id,
    v_proposal.payload #>> '{customer,document}',
    v_proposal.payload #>> '{customer,full_name}',
    v_proposal.payload #>> '{customer,email}',
    v_proposal.payload #>> '{customer,phone}',
    v_proposal.payload #>> '{customer,address}'
  );

  v_deal := v_proposal.payload -> 'deal';
  -- QA-3: title e value são obrigatórios (Deal exige os cinco:
  -- customerId/ownerId/stageId/title/value). value NUNCA tem default — chutar
  -- valor de negócio contamina previsão de receita (decisão explícita do
  -- usuário).
  IF v_deal IS NULL
     OR COALESCE(length(btrim(v_deal ->> 'title')), 0) = 0
     OR NOT (v_deal ? 'value') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'payload da proposta não contém título e valor da oportunidade '
        '(QA-3: sem default para valor)';
  END IF;

  -- ownerId — default: o usuário que confirma (QA-3, decisão do usuário).
  v_owner_id := COALESCE(NULLIF(v_deal ->> 'owner_id', '')::UUID, auth.uid());

  -- stageId — default: primeira etapa ativa do pipeline (QA-3, decisão do
  -- usuário), se a tela não tiver enviado uma etapa válida da própria empresa.
  IF v_deal ? 'stage_id' AND length(btrim(v_deal ->> 'stage_id')) > 0 THEN
    SELECT stage.id INTO v_stage_id
    FROM public.pipeline_stages AS stage
    WHERE stage.id = (v_deal ->> 'stage_id')::UUID
      AND stage.company_id = v_company_id
      AND stage.is_active;
  END IF;
  IF v_stage_id IS NULL THEN
    SELECT stage.id INTO v_stage_id
    FROM public.pipeline_stages AS stage
    WHERE stage.company_id = v_company_id AND stage.is_active
    ORDER BY stage.position ASC
    LIMIT 1;
  END IF;
  IF v_stage_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'empresa não tem etapa de pipeline ativa para receber a oportunidade';
  END IF;

  v_deal_id := gen_random_uuid();
  INSERT INTO public.deals (
    id, company_id, title, customer_id, owner_id, stage_id, value, status,
    expected_close_date, notes
  ) VALUES (
    v_deal_id, v_company_id, btrim(v_deal ->> 'title'), v_customer_id, v_owner_id, v_stage_id,
    (v_deal ->> 'value')::NUMERIC, 'open',
    NULLIF(v_deal ->> 'expected_close_date', '')::DATE,
    COALESCE(v_deal ->> 'notes', '')
  );

  UPDATE public.document_import_proposals
  SET status = 'applied', applied_at = now(), applied_by = auth.uid()
  WHERE id = p_proposal_id
  RETURNING * INTO v_proposal;

  RETURN v_proposal;
END;
$$;

-- Compartilhada pelas três categorias: rejeitar não toca o domínio, é só a
-- outra saída do mesmo ato de UI (D3). Não precisa de uma função por tipo.
CREATE OR REPLACE FUNCTION public.reject_document_import_proposal(
  p_proposal_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.document_import_proposals
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.document_import_proposals%ROWTYPE;
  v_company_id UUID := (SELECT public.get_user_company_id());
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
  IF v_proposal.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = format('proposta não está pendente (status atual: %s)', v_proposal.status);
  END IF;

  UPDATE public.document_import_proposals
  SET status = 'rejected', rejected_at = now(), rejected_by = auth.uid(),
      rejection_reason = NULLIF(btrim(p_reason), '')
  WHERE id = p_proposal_id
  RETURNING * INTO v_proposal;

  RETURN v_proposal;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_or_create_supplier(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_or_create_customer(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_nfe_purchase_proposal(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_boleto_payable_proposal(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_contract_deal_proposal(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_document_import_proposal(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.resolve_or_create_supplier(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_or_create_customer(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_nfe_purchase_proposal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_boleto_payable_proposal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_contract_deal_proposal(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_document_import_proposal(UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.document_extraction_jobs IS
  'Job assíncrono de extração de documento (D1/D8 do ADR P3). A IA nunca escreve domínio a partir daqui.';
COMMENT ON TABLE public.document_import_proposals IS
  'Proposta gerada por extração determinística/IA (D2/D5). status=pending até o usuário confirmar ou rejeitar (D3).';
COMMENT ON COLUMN public.document_import_proposals.idempotency_key IS
  'Trava de deduplicação (D8): UNIQUE (company_id, idempotency_key). Chave de acesso NF-e, linha digitável de boleto, ou document_version_id para contrato.';
COMMENT ON COLUMN public.document_import_proposals.text_origin IS
  'Salvaguarda R10: origem do texto que alimentou a extração (server|client). NULL na v1 (XML/linha digitável não convertem texto); client a partir da onda de pdf.js no navegador.';
COMMENT ON TABLE public.document_import_proposal_items IS
  'Itens de uma proposta (NF-e multi-item). update_cost_decision é a decisão por item da QA-2.';
COMMENT ON FUNCTION public.apply_nfe_purchase_proposal(UUID) IS
  'Aplica proposta de NF-e de entrada: fornecedor, compra, itens (com dedup de produto por GTIN) e parcelas. SECURITY INVOKER + RLS.';
COMMENT ON FUNCTION public.apply_boleto_payable_proposal(UUID) IS
  'Aplica proposta de boleto: fornecedor e conta a pagar (payment_method=bank_slip). SECURITY INVOKER + RLS.';
COMMENT ON FUNCTION public.apply_contract_deal_proposal(UUID) IS
  'Aplica proposta de contrato: cliente e oportunidade, com defaults de ownerId/stageId da QA-3. SECURITY INVOKER + RLS.';
COMMENT ON FUNCTION public.reject_document_import_proposal(UUID, TEXT) IS
  'Rejeita proposta pendente; não toca tabela de domínio nenhuma. SECURITY INVOKER + RLS.';

COMMIT;
