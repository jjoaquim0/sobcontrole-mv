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

-- =========================================================================
-- 2. HABILITAR SECURITY & RLS (Row Level Security)
-- =========================================================================
-- Opcional, mas altamente recomendado no ambiente Supabase real.

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_payables ENABLE ROW LEVEL SECURITY;

-- Exemplo simples de Políticas (Bypass para desenvolvimento ou Políticas de RLS Multi-tenant)
-- NOTA: Como as consultas usam sempre o `company_id` retornado da sessão do perfil logado,
-- as políticas reais do Supabase normalmente filtram com base no `company_id` do perfil do usuário logado.

-- Criar funções utilitárias ou políticas simplificadas caso queira reforço no Supabase:
-- CREATE POLICY multi_tenant_policy ON categories FOR ALL TO authenticated
-- USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));
