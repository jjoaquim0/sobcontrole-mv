-- SQL Schema para Inicialização do Banco de Dados Gestly no Supabase
-- Copie e cole este script no editor SQL do seu console do Supabase.

-- =========================================================================
-- 1. EXTENSÕES & TABELAS CENTRAIS
-- =========================================================================

-- Tabela: Empresas (Companies)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    cnpj TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Assinaturas (Subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'enterprise'
    status TEXT NOT NULL DEFAULT 'inactive', -- 'active', 'trialing', 'inactive'
    current_period_end TIMESTAMPTZ NOT NULL,
    usage_limit INTEGER NOT NULL DEFAULT 100,
    usage_current INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Configurações da Empresa (Company Settings)
-- Nota: relação 1:1 com companies (company_id UNIQUE).
CREATE TABLE IF NOT EXISTS company_settings (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE UNIQUE NOT NULL,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    currency TEXT DEFAULT 'BRL',
    language TEXT DEFAULT 'pt-BR',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    logo_url TEXT DEFAULT '',
    primary_color TEXT DEFAULT '#10b981',
    email_notifications BOOLEAN DEFAULT true,
    push_notifications BOOLEAN DEFAULT true,
    whatsapp_notifications BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Perfis de Usuários (Profiles)
-- Nota: id é vinculado à tabela auth.users do Supabase
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee', -- 'admin', 'manager', 'employee'
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Categorias de Produtos (Categories)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Produtos (Products)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    sku TEXT NOT NULL,
    barcode TEXT DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'Unidade',
    cost_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    sale_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    current_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    min_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    max_quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Clientes (Customers)
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    full_name TEXT NOT NULL,
    document TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '{}' NOT NULL, -- Armazena JSON de CEP/Rua/Num etc.
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Fornecedores (Suppliers)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    document TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Compras (Purchases)
CREATE TABLE IF NOT EXISTS purchases (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT NOT NULL,
    total_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    fee NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    final_value NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    status TEXT NOT NULL, -- 'paid', 'pending', 'canceled'
    payment_method TEXT NOT NULL,
    notes TEXT DEFAULT '',
    created_by UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Itens da Compra (Purchase Items)
CREATE TABLE IF NOT EXISTS purchase_items (
    id TEXT PRIMARY KEY,
    purchase_id TEXT REFERENCES purchases(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
    quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    unit_cost NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    subtotal NUMERIC(12, 2) DEFAULT 0.00 NOT NULL
);

-- Tabela: Vendas (Sales)
CREATE TABLE IF NOT EXISTS sales (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
    seller_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    total NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    fee NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    final_value NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    payment_method TEXT NOT NULL, -- 'cash', 'credit_card', 'debit_card', 'pix', etc.
    payment_status TEXT NOT NULL, -- 'paid', 'pending', 'cancelled'
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Itens da Venda (Sale Items)
CREATE TABLE IF NOT EXISTS sale_items (
    id TEXT PRIMARY KEY,
    sale_id TEXT REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
    quantity NUMERIC(12, 3) DEFAULT 0.000 NOT NULL,
    unit_price NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    subtotal NUMERIC(12, 2) DEFAULT 0.00 NOT NULL
);

-- Tabela: Contas a Receber (Account Receivables)
CREATE TABLE IF NOT EXISTS account_receivables (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    sale_id TEXT REFERENCES sales(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- 'paid', 'pending', 'late', 'canceled'
    description TEXT
);

-- Tabela: Contas a Pagar (Account Payables)
CREATE TABLE IF NOT EXISTS account_payables (
    id TEXT PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- 'paid', 'pending', 'late', 'canceled'
    description TEXT
);

-- Módulo Financeiro (Story 1.2): novas colunas de método de pagamento e data
-- de quitação em contas a receber/pagar, e vínculo de contas a pagar com a
-- compra/fornecedor de origem. IF NOT EXISTS mantém a migração reversível e
-- não destrutiva sobre dados legados.
ALTER TABLE account_receivables
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE account_payables
  ADD COLUMN IF NOT EXISTS purchase_id TEXT REFERENCES purchases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Tabela: Categorias Financeiras (Financial Categories) — Story 1.2
CREATE TABLE IF NOT EXISTS financial_categories (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense', -- 'revenue', 'expense'
    color TEXT DEFAULT '#10b981',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Etapas do Pipeline de Vendas (Pipeline Stages) — Story 1.3
-- Nota: position é DOUBLE PRECISION (não INTEGER) para permitir reordenação
-- por inserção de ponto médio sem renumerar as demais linhas.
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#10b981',
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Negócios/Oportunidades (Deals) — Story 1.3
-- Nota: status é independente de stage_id — o board do Kanban exibe apenas
-- negócios 'open'; marcar como Ganho/Perdido fecha o negócio.
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE RESTRICT NOT NULL,
    owner_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    stage_id UUID REFERENCES pipeline_stages(id) ON DELETE RESTRICT NOT NULL,
    value NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'won', 'lost'
    expected_close_date DATE,
    position DOUBLE PRECISION NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    lost_reason TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Histórico de Movimentação de Etapa (Deal Stage History) — Story 1.3
CREATE TABLE IF NOT EXISTS deal_stage_history (
    id UUID PRIMARY KEY,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    from_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE RESTRICT NOT NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tabela: Documentos (GED)
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    url TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'outros',
    mime_type TEXT DEFAULT '',
    size INTEGER DEFAULT 0, -- em bytes
    storage_path TEXT NOT NULL, -- caminho no Supabase Storage
    related_type TEXT, -- 'sale', 'purchase', 'customer', 'supplier', null
    related_id TEXT, -- ID do registro relacionado
    status TEXT DEFAULT 'active' NOT NULL, -- 'active', 'archived'
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- =========================================================================
-- 2. HABILITAR SECURITY & RLS (Row Level Security)
-- =========================================================================

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 3. FUNÇÕES UTILITÁRIAS DE SEGURANÇA (SECURITY DEFINER)
-- =========================================================================
-- Estas funções rodam com privilégios do criador do banco (bypassing RLS),
-- evitando recursão infinita nas políticas.

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Estas duas funções são chamadas DIRETAMENTE dentro das políticas de RLS
-- abaixo (companies/profiles/subscriptions/sale_items), que se aplicam a
-- todos os roles, inclusive anon (o front-end faz um SELECT em `companies`
-- como anon só para checar conectividade antes do login). EXECUTE precisa
-- ficar liberado para anon/authenticated para essas políticas funcionarem;
-- isso é seguro porque a função sempre retorna NULL quando auth.uid() é
-- nulo, então nenhuma linha real é exposta.
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated;

-- Função atômica de cadastro: cria empresa + perfil + assinatura numa
-- única transação. SECURITY DEFINER para poder inserir nas 3 tabelas, mas
-- exige auth.uid() (usuário já autenticado, ou seja, e-mail confirmado) e
-- sempre cria o profile para o próprio usuário chamador — nunca aceita
-- company_id arbitrário vindo do cliente, o que impede um usuário de se
-- vincular à empresa de outro (RLS "always true" antigo permitia isso).
CREATE OR REPLACE FUNCTION public.complete_company_signup(
  p_company_name TEXT,
  p_cnpj TEXT,
  p_user_name TEXT,
  p_user_email TEXT
)
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  company_cnpj TEXT,
  company_created_at TIMESTAMPTZ,
  company_updated_at TIMESTAMPTZ,
  profile_role TEXT,
  subscription_id UUID,
  subscription_plan TEXT,
  subscription_status TEXT,
  subscription_current_period_end TIMESTAMPTZ,
  subscription_usage_limit INTEGER,
  subscription_usage_current INTEGER,
  subscription_created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_company_id UUID;
  v_subscription_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado. Confirme seu e-mail e faça login antes de concluir o cadastro.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid) THEN
    RAISE EXCEPTION 'Este usuário já possui um cadastro concluído.';
  END IF;

  v_company_id := gen_random_uuid();
  v_subscription_id := gen_random_uuid();

  INSERT INTO public.companies (id, name, cnpj)
  VALUES (v_company_id, p_company_name, p_cnpj);

  INSERT INTO public.profiles (id, email, name, role, company_id)
  VALUES (v_uid, p_user_email, p_user_name, 'manager', v_company_id);

  INSERT INTO public.subscriptions (id, company_id, plan, status, current_period_end, usage_limit, usage_current)
  VALUES (v_subscription_id, v_company_id, 'pro', 'active', now() + interval '14 days', 200, 0);

  -- Etapas padrão do Pipeline de Vendas (Story 1.3) para toda empresa nova
  INSERT INTO public.pipeline_stages (id, company_id, name, color, position)
  VALUES
    (gen_random_uuid(), v_company_id, 'Novo Contato', '#6366f1', 0),
    (gen_random_uuid(), v_company_id, 'Qualificação', '#3b82f6', 1),
    (gen_random_uuid(), v_company_id, 'Proposta Enviada', '#f59e0b', 2),
    (gen_random_uuid(), v_company_id, 'Negociação', '#f97316', 3),
    (gen_random_uuid(), v_company_id, 'Fechamento', '#10b981', 4);

  RETURN QUERY
  SELECT c.id, c.name, c.cnpj, c.created_at, c.updated_at,
         'manager'::TEXT,
         s.id, s.plan, s.status, s.current_period_end, s.usage_limit, s.usage_current, s.created_at
  FROM public.companies c
  JOIN public.subscriptions s ON s.company_id = c.id
  WHERE c.id = v_company_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_company_signup(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.complete_company_signup(TEXT, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_company_signup(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =========================================================================
-- 4. POLÍTICAS DE RLS
-- =========================================================================

-- POLÍTICAS: Empresas (Companies)
-- Nota: não existe política de INSERT direta. A criação de empresas só
-- acontece através da função SECURITY DEFINER complete_company_signup(),
-- que valida auth.uid() e nunca permite vincular um profile a uma empresa
-- alheia. Isso evita que qualquer usuário (autenticado ou não) insira
-- companies/profiles/subscriptions arbitrários via REST direto.

CREATE POLICY "Usuários podem ver a própria empresa" ON companies
FOR SELECT USING (
  id = get_user_company_id()
  OR
  (auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid()))
);

CREATE POLICY "Usuários podem atualizar a própria empresa" ON companies
FOR UPDATE USING (id = get_user_company_id());

-- POLÍTICAS: Perfis (Profiles)
CREATE POLICY "Usuários podem ver perfis da mesma empresa" ON profiles
FOR SELECT USING (company_id = get_user_company_id() OR id = auth.uid());

CREATE POLICY "Usuários podem atualizar próprio perfil ou gestores da empresa" ON profiles
FOR UPDATE USING (
  id = auth.uid()
  OR
  (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'))
);

-- POLÍTICAS: Assinaturas (Subscriptions)
CREATE POLICY "Usuários podem ver assinatura da empresa" ON subscriptions
FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Gestores podem atualizar assinatura da empresa" ON subscriptions 
FOR UPDATE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

-- POLÍTICAS COMPARTILHADAS (Multi-tenant): Acesso total baseado no company_id
CREATE POLICY "Acesso total dos membros da empresa às configurações" ON company_settings
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa às categorias" ON categories
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa aos produtos" ON products
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa aos clientes" ON customers
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa aos fornecedores" ON suppliers
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa às compras" ON purchases
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total aos itens de compras da empresa" ON purchase_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.purchases
    WHERE purchases.id = purchase_items.purchase_id
      AND purchases.company_id = get_user_company_id()
  )
);

CREATE POLICY "Acesso total dos membros da empresa às vendas" ON sales
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa às contas a receber" ON account_receivables
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa às contas a pagar" ON account_payables
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa às categorias financeiras" ON financial_categories
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa aos documentos" ON documents
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa às etapas do pipeline" ON pipeline_stages
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa aos negócios" ON deals
FOR ALL USING (company_id = get_user_company_id());

-- POLÍTICAS: Histórico de Negócios (Deal Stage History)
CREATE POLICY "Acesso total ao histórico de negócios da empresa" ON deal_stage_history
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.deals
    WHERE deals.id = deal_stage_history.deal_id
      AND deals.company_id = get_user_company_id()
  )
);

-- POLÍTICAS: Itens de Vendas (Sale Items)
CREATE POLICY "Acesso total aos itens de vendas da empresa" ON sale_items
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.sales
    WHERE sales.id = sale_items.sale_id
      AND sales.company_id = get_user_company_id()
  )
);

-- =========================================================================
-- 5. DEFESA EM PROFUNDIDADE: REMOVER ACESSO ANÔNIMO
-- =========================================================================
-- O app só acessa dados de negócio com o usuário já logado (role
-- authenticated). O Supabase concede privilégios amplos ao role anon por
-- padrão; removemos isso explicitamente para que o RLS não seja a única
-- camada de proteção.
REVOKE ALL ON companies, company_settings, profiles, subscriptions, categories,
  products, customers, suppliers, purchases, purchase_items, sales, sale_items,
  account_receivables, account_payables, financial_categories, documents,
  pipeline_stages, deals, deal_stage_history
FROM anon;

-- Exceção: o front-end faz um SELECT em `companies` (e, por consequência
-- da política de RLS, também precisa acessar `profiles`) como usuário
-- anônimo apenas para checar conectividade antes de exibir a tela de
-- login (ver src/main.tsx). O RLS de SELECT dessas tabelas exige
-- auth.uid() IS NOT NULL, então nenhuma linha real é retornada para quem
-- não está autenticado — só concedemos o privilégio de tentar a consulta.
GRANT SELECT ON public.companies TO anon;
GRANT SELECT ON public.profiles TO anon;

-- =========================================================================
-- 6. STORAGE — BUCKET DE DOCUMENTOS (GED)
-- =========================================================================
-- Bucket público (URLs diretas), mas gravação/exclusão restritas por RLS
-- em storage.objects à pasta {company_id}/ de cada empresa. Já aplicado
-- via migration supabase/migrations/20260703000000_documents_module_schema.sql
-- — mantido aqui apenas como referência/documentação do schema completo.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/xml',
    'application/xml'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Membros da empresa podem enviar documentos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_company_id()::text);

CREATE POLICY "Membros da empresa podem ver documentos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_company_id()::text);

CREATE POLICY "Membros da empresa podem excluir documentos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = get_user_company_id()::text);
