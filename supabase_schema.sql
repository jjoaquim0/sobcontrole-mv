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

-- Tabela: Compromissos da Agenda (Appointments) — Story 1.4
-- customer_id/deal_id são opcionais (compromisso pode ser puramente
-- operacional); assigned_user_id (responsável) é obrigatório.
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    type TEXT NOT NULL DEFAULT 'reuniao', -- 'reuniao', 'tarefa', 'ligacao', 'visita', 'lembrete'
    status TEXT NOT NULL DEFAULT 'agendado', -- 'agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu', 'pendente'
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN NOT NULL DEFAULT false,
    location TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT appointments_end_after_start CHECK (end_at >= start_at),
    CONSTRAINT appointments_type_check CHECK (type IN ('reuniao', 'tarefa', 'ligacao', 'visita', 'lembrete')),
    CONSTRAINT appointments_status_check CHECK (status IN ('agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu', 'pendente'))
);

CREATE INDEX IF NOT EXISTS idx_appointments_company_start ON appointments(company_id, start_at);
CREATE INDEX IF NOT EXISTS idx_appointments_assigned_user ON appointments(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_deal ON appointments(deal_id);

-- =========================================================================
-- Módulo de Notificações Inteligentes — Story 1.5
-- =========================================================================
-- company_settings ganha switch mestre de SMS (email/push já existiam desde
-- a Story 1.1). NOTA: company_settings em si nunca havia sido de fato
-- aplicada a este projeto Supabase remoto até esta story — corrigido em
-- supabase/migrations/20260706115000_company_settings_missing_table.sql.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS notification_events (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    dedup_key TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    detected_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    processed_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT notification_events_type_check CHECK (event_type IN (
        'appointment_upcoming', 'appointment_overdue', 'deal_stale', 'proposal_expiring',
        'sale_no_followup', 'customer_at_risk', 'payment_receivable_due', 'payment_payable_due',
        'low_stock', 'sales_goal_at_risk', 'team_event_created'
    ))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_events_dedup_open
  ON notification_events(company_id, dedup_key) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notification_events_unprocessed
  ON notification_events(company_id) WHERE processed_at IS NULL;

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    event_id UUID REFERENCES notification_events(id) ON DELETE SET NULL,
    recipient_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    category TEXT NOT NULL,
    event_type TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'media',
    title TEXT NOT NULL,
    message TEXT NOT NULL DEFAULT '',
    ai_summary TEXT DEFAULT '',
    ai_priority_reason TEXT DEFAULT '',
    ai_suggested_action TEXT,
    ai_suggested_deadline TIMESTAMPTZ,
    ai_suggested_message TEXT,
    related_entity_type TEXT,
    related_entity_id TEXT,
    channels TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'unread',
    snoozed_until TIMESTAMPTZ,
    action_taken TEXT,
    action_taken_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT notifications_category_check CHECK (category IN ('agenda', 'pipeline', 'vendas', 'clientes', 'financeiro', 'estoque', 'metas', 'equipe')),
    CONSTRAINT notifications_priority_check CHECK (priority IN ('informativa', 'baixa', 'media', 'alta', 'critica')),
    CONSTRAINT notifications_status_check CHECK (status IN ('unread', 'read', 'resolved', 'archived')),
    CONSTRAINT notifications_action_check CHECK (action_taken IS NULL OR action_taken IN ('send_message', 'create_task', 'schedule_meeting', 'open_customer', 'open_deal', 'reassign', 'snooze', 'resolve', 'dismiss')),
    CONSTRAINT notifications_suggested_action_check CHECK (ai_suggested_action IS NULL OR ai_suggested_action IN ('send_message', 'create_task', 'schedule_meeting', 'open_customer', 'open_deal', 'reassign', 'snooze', 'resolve', 'dismiss'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(company_id, recipient_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(event_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    sms_enabled BOOLEAN NOT NULL DEFAULT false,
    categories_enabled TEXT[] NOT NULL DEFAULT ARRAY['agenda', 'pipeline', 'vendas', 'clientes', 'financeiro', 'estoque', 'metas', 'equipe'],
    min_priority_push TEXT NOT NULL DEFAULT 'baixa',
    min_priority_email TEXT NOT NULL DEFAULT 'media',
    min_priority_sms TEXT NOT NULL DEFAULT 'critica',
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    digest_frequency TEXT NOT NULL DEFAULT 'immediate',
    phone TEXT DEFAULT '',
    notification_email TEXT DEFAULT '',
    consent_push BOOLEAN NOT NULL DEFAULT false,
    consent_push_at TIMESTAMPTZ,
    consent_email BOOLEAN NOT NULL DEFAULT true,
    consent_email_at TIMESTAMPTZ,
    consent_sms BOOLEAN NOT NULL DEFAULT false,
    consent_sms_at TIMESTAMPTZ,
    gestly_recommendations_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT notification_preferences_min_push_check CHECK (min_priority_push IN ('informativa', 'baixa', 'media', 'alta', 'critica')),
    CONSTRAINT notification_preferences_min_email_check CHECK (min_priority_email IN ('informativa', 'baixa', 'media', 'alta', 'critica')),
    CONSTRAINT notification_preferences_min_sms_check CHECK (min_priority_sms IN ('informativa', 'baixa', 'media', 'alta', 'critica')),
    CONSTRAINT notification_preferences_digest_check CHECK (digest_frequency IN ('immediate', 'daily', 'weekly', 'none')),
    CONSTRAINT notification_preferences_quiet_hours_check CHECK ((quiet_hours_start IS NULL AND quiet_hours_end IS NULL) OR (quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS notification_push_subscriptions (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    user_agent TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON notification_push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS notification_deliveries (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE NOT NULL,
    recipient_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    provider TEXT,
    provider_message_id TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ DEFAULT now(),
    queued_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT notification_deliveries_channel_check CHECK (channel IN ('push', 'email', 'email_digest', 'sms')),
    CONSTRAINT notification_deliveries_status_check CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'skipped')),
    CONSTRAINT notification_deliveries_unique_channel UNIQUE (notification_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_pending ON notification_deliveries(status, next_retry_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient ON notification_deliveries(company_id, recipient_user_id);

CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    event_type TEXT,
    channel TEXT NOT NULL,
    name TEXT NOT NULL,
    subject_template TEXT,
    body_template TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT notification_templates_channel_check CHECK (channel IN ('push', 'email', 'email_digest', 'sms'))
);

CREATE TABLE IF NOT EXISTS notification_rules (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    event_type TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    default_priority TEXT,
    cooldown_minutes INTEGER NOT NULL DEFAULT 1440,
    threshold_value NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT notification_rules_unique_event UNIQUE (company_id, event_type),
    CONSTRAINT notification_rules_priority_check CHECK (default_priority IS NULL OR default_priority IN ('informativa', 'baixa', 'media', 'alta', 'critica'))
);

CREATE TABLE IF NOT EXISTS notification_actions (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE NOT NULL,
    action_type TEXT NOT NULL,
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT notification_actions_type_check CHECK (action_type IN ('send_message', 'create_task', 'schedule_meeting', 'open_customer', 'open_deal', 'reassign', 'snooze', 'resolve', 'dismiss'))
);
CREATE INDEX IF NOT EXISTS idx_notification_actions_notification ON notification_actions(notification_id);

CREATE INDEX IF NOT EXISTS idx_deals_stale_scan ON deals(company_id, status, updated_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_products_low_stock_scan ON products(company_id) WHERE is_active AND current_quantity <= min_quantity;

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

-- Módulo de Central de Inteligência (Gestly BI) — Story 1.6
-- analytics_modules: catálogo global (sem company_id, mesmo padrão de
-- notification_templates com company_id IS NULL).
CREATE TABLE IF NOT EXISTS analytics_modules (
    id UUID PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'geral', 'vendas', 'clientes', 'financeiro', 'estoque', 'ia'
    min_plan TEXT, -- NULL = incluído em qualquer plano ativo; 'pro'/'enterprise'
    is_addon BOOLEAN NOT NULL DEFAULT false,
    is_coming_soon BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    route_path TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT analytics_modules_category_check CHECK (category IN ('geral', 'vendas', 'clientes', 'financeiro', 'estoque', 'ia')),
    CONSTRAINT analytics_modules_min_plan_check CHECK (min_plan IS NULL OR min_plan IN ('free', 'pro', 'enterprise'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_modules_active ON analytics_modules(is_active, display_order);

-- company_analytics_modules: add-ons contratados por empresa além do que o
-- plano já inclui por padrão.
CREATE TABLE IF NOT EXISTS company_analytics_modules (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    module_key TEXT REFERENCES analytics_modules(key) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    activated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deactivated_at TIMESTAMPTZ,
    activated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT company_analytics_modules_status_check CHECK (status IN ('active', 'inactive')),
    CONSTRAINT company_analytics_modules_unique UNIQUE (company_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_company_analytics_modules_company ON company_analytics_modules(company_id, status);

-- company_analytics_module_history: log de auditoria, populado apenas pelo
-- trigger SECURITY DEFINER (ver seção 8) — somente leitura para o cliente.
CREATE TABLE IF NOT EXISTS company_analytics_module_history (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    module_key TEXT NOT NULL,
    action TEXT NOT NULL,
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    note TEXT,
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT company_analytics_module_history_action_check CHECK (action IN ('activated', 'deactivated'))
);

CREATE INDEX IF NOT EXISTS idx_company_analytics_module_history_company ON company_analytics_module_history(company_id, performed_at DESC);

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
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Módulo de Notificações Inteligentes — Story 1.5
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_actions ENABLE ROW LEVEL SECURITY;

-- Módulo de Central de Inteligência (Gestly BI) — Story 1.6
ALTER TABLE analytics_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_analytics_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_analytics_module_history ENABLE ROW LEVEL SECURITY;

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
-- company_settings: leitura para toda a empresa, mas escrita (INSERT do
-- registro padrão / UPDATE de política) segue o mesmo padrão de
-- subscriptions abaixo — restrita a admin/manager para UPDATE, e liberada
-- para INSERT porque getSettings() cria o registro padrão na primeira visita
-- de qualquer usuário (ver supabase/migrations/20260706115000_company_settings_missing_table.sql).
CREATE POLICY "Acesso da empresa às próprias configurações" ON company_settings
FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Empresa cria as próprias configurações" ON company_settings
FOR INSERT WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Admin/gerente atualiza as configurações da empresa" ON company_settings
FOR UPDATE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

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

-- POLÍTICAS: Agenda (Appointments)
CREATE POLICY "Acesso total dos membros da empresa aos compromissos" ON appointments
FOR ALL USING (company_id = get_user_company_id());

-- POLÍTICAS: Notificações Inteligentes (Story 1.5)
CREATE POLICY "Acesso da empresa aos eventos de notificação" ON notification_events
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Usuário vê apenas suas notificações" ON notifications
FOR SELECT USING (company_id = get_user_company_id() AND recipient_user_id = auth.uid());

CREATE POLICY "Usuário atualiza apenas suas notificações" ON notifications
FOR UPDATE USING (company_id = get_user_company_id() AND recipient_user_id = auth.uid());

CREATE POLICY "Usuário gerencia as próprias preferências de notificação" ON notification_preferences
FOR ALL USING (company_id = get_user_company_id() AND user_id = auth.uid());

CREATE POLICY "Usuário gerencia as próprias assinaturas de push" ON notification_push_subscriptions
FOR ALL USING (company_id = get_user_company_id() AND user_id = auth.uid());

CREATE POLICY "Usuário lê o histórico de entrega das próprias notificações" ON notification_deliveries
FOR SELECT USING (company_id = get_user_company_id() AND recipient_user_id = auth.uid());

CREATE POLICY "Empresa lê templates próprios e globais" ON notification_templates
FOR SELECT USING (company_id = get_user_company_id() OR company_id IS NULL);

CREATE POLICY "Empresa gerencia os próprios templates" ON notification_templates
FOR INSERT WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Empresa atualiza os próprios templates" ON notification_templates
FOR UPDATE USING (company_id = get_user_company_id());

CREATE POLICY "Empresa remove os próprios templates" ON notification_templates
FOR DELETE USING (company_id = get_user_company_id());

CREATE POLICY "Empresa lê as próprias regras de notificação" ON notification_rules
FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Admin/gerente gerencia as regras de notificação" ON notification_rules
FOR INSERT WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admin/gerente atualiza as regras de notificação" ON notification_rules
FOR UPDATE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admin/gerente remove as regras de notificação" ON notification_rules
FOR DELETE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Usuário gerencia as próprias ações de notificação" ON notification_actions
FOR ALL USING (company_id = get_user_company_id() AND performed_by = auth.uid())
WITH CHECK (company_id = get_user_company_id() AND performed_by = auth.uid());

-- POLÍTICAS: Central de Inteligência / Gestly BI (Story 1.6)
CREATE POLICY "Usuários autenticados leem o catálogo de módulos" ON analytics_modules
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Empresa lê os próprios módulos contratados" ON company_analytics_modules
FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Admin/gerente contrata módulos" ON company_analytics_modules
FOR INSERT WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admin/gerente atualiza módulos contratados" ON company_analytics_modules
FOR UPDATE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admin/gerente remove módulos contratados" ON company_analytics_modules
FOR DELETE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Empresa lê o próprio histórico de módulos" ON company_analytics_module_history
FOR SELECT USING (company_id = get_user_company_id());

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
  pipeline_stages, deals, deal_stage_history, appointments
FROM anon;

REVOKE ALL ON notification_events, notifications, notification_preferences,
  notification_push_subscriptions, notification_deliveries, notification_templates,
  notification_rules, notification_actions
FROM anon;

REVOKE ALL ON analytics_modules, company_analytics_modules, company_analytics_module_history FROM anon;

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

-- =========================================================================
-- 7. NOTIFICAÇÕES INTELIGENTES — FUNÇÕES, TRIGGER, CRON, TEMPLATES (Story 1.5)
-- =========================================================================
-- Já aplicado via migration
-- supabase/migrations/20260706120000_notifications_module_schema.sql —
-- mantido aqui apenas como referência/documentação do schema completo.

CREATE OR REPLACE FUNCTION public.priority_rank(p_priority TEXT)
RETURNS INTEGER
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_priority
    WHEN 'informativa' THEN 0
    WHEN 'baixa' THEN 1
    WHEN 'media' THEN 2
    WHEN 'alta' THEN 3
    WHEN 'critica' THEN 4
    ELSE 2
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_within_quiet_hours(p_start TIME, p_end TIME, p_timezone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_local_time TIME;
BEGIN
  IF p_start IS NULL OR p_end IS NULL THEN
    RETURN false;
  END IF;
  v_local_time := (now() AT TIME ZONE COALESCE(NULLIF(p_timezone, ''), 'America/Sao_Paulo'))::time;
  IF p_start <= p_end THEN
    RETURN v_local_time BETWEEN p_start AND p_end;
  ELSE
    RETURN v_local_time >= p_start OR v_local_time <= p_end;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.next_quiet_hours_end(p_end TIME, p_timezone TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_tz TEXT := COALESCE(NULLIF(p_timezone, ''), 'America/Sao_Paulo');
  v_local_now TIMESTAMP;
BEGIN
  IF p_end IS NULL THEN
    RETURN now();
  END IF;
  v_local_now := now() AT TIME ZONE v_tz;
  IF v_local_now::time <= p_end THEN
    RETURN (date_trunc('day', v_local_now) + p_end) AT TIME ZONE v_tz;
  ELSE
    RETURN (date_trunc('day', v_local_now) + INTERVAL '1 day' + p_end) AT TIME ZONE v_tz;
  END IF;
END;
$$;

-- build_notification_content/generate_notification_events/notify_team_event_created/
-- fanout_notification_events/run_notification_pipeline: corpo completo (motor
-- determinístico da Gestly, detecção de 9 event_type, trigger de
-- team_event_created e fan-out com preferências/cooldown/horário de
-- silêncio/digest) mantido apenas na migration para evitar duplicar ~400
-- linhas de PL/pgSQL em dois arquivos e correr risco de divergência —
-- ver supabase/migrations/20260706120000_notifications_module_schema.sql
-- para o corpo completo das funções, do trigger trg_appointments_team_event_created
-- e do agendamento via pg_cron ('notification-pipeline', a cada 15 minutos).

-- =========================================================================
-- 8. CENTRAL DE INTELIGÊNCIA / GESTLY BI — TRIGGER DE AUDITORIA E SEED (Story 1.6)
-- =========================================================================
-- Já aplicado via migration
-- supabase/migrations/20260710090000_analytics_modules_schema.sql —
-- mantido aqui apenas como referência/documentação do schema completo.

CREATE OR REPLACE FUNCTION public.log_analytics_module_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO company_analytics_module_history (id, company_id, module_key, action, performed_by)
    VALUES (gen_random_uuid(), NEW.company_id, NEW.module_key, CASE WHEN NEW.status = 'active' THEN 'activated' ELSE 'deactivated' END, NEW.activated_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO company_analytics_module_history (id, company_id, module_key, action, performed_by)
    VALUES (gen_random_uuid(), NEW.company_id, NEW.module_key, CASE WHEN NEW.status = 'active' THEN 'activated' ELSE 'deactivated' END, NEW.activated_by);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_analytics_modules_history ON company_analytics_modules;
CREATE TRIGGER trg_company_analytics_modules_history
AFTER INSERT OR UPDATE ON company_analytics_modules
FOR EACH ROW EXECUTE FUNCTION public.log_analytics_module_change();

-- Seed do catálogo (6 módulos). min_plan = NULL -> incluído em qualquer plano
-- ativo. Os demais exigem 'enterprise': toda empresa nasce no plano 'pro'
-- (complete_company_signup), então aparecem como "Bloqueado" por padrão —
-- demonstrando o funil de upsell (mostrar valor antes de mostrar a restrição).
INSERT INTO analytics_modules (id, key, name, category, min_plan, is_addon, is_coming_soon, is_active, route_path, display_order)
VALUES
  (gen_random_uuid(), 'dashboard_executivo', 'Dashboard Executivo', 'geral', NULL, false, false, true, '/dashboard', 0),
  (gen_random_uuid(), 'sales_analytics', 'Analytics de Vendas', 'vendas', 'enterprise', true, false, true, '/reports?tab=sales', 1),
  (gen_random_uuid(), 'customer_analytics', 'Analytics de Clientes', 'clientes', 'enterprise', true, false, true, '/reports?tab=customers', 2),
  (gen_random_uuid(), 'financial_analytics', 'Analytics Financeiro', 'financeiro', 'enterprise', true, false, true, '/reports?tab=financial', 3),
  (gen_random_uuid(), 'inventory_analytics', 'Analytics de Estoque e Compras', 'estoque', 'enterprise', true, false, true, '/reports?tab=inventory', 4),
  (gen_random_uuid(), 'gestly_insights', 'Gestly Insights', 'ia', 'enterprise', true, false, true, '/notifications', 5)
ON CONFLICT (key) DO NOTHING;

-- Story 1.7: rotas canonicas da navegacao modular de Relatorios.
UPDATE analytics_modules
SET route_path = CASE key
  WHEN 'dashboard_executivo' THEN '/relatorios/visao-geral'
  WHEN 'gestly_insights' THEN '/relatorios/central-inteligencia'
  WHEN 'sales_analytics' THEN '/relatorios/vendas-pipeline'
  WHEN 'customer_analytics' THEN '/relatorios/clientes'
  WHEN 'financial_analytics' THEN '/relatorios/financeiro'
  WHEN 'inventory_analytics' THEN '/relatorios/estoque-compras'
  ELSE route_path
END,
updated_at = now()
WHERE key IN ('dashboard_executivo', 'gestly_insights', 'sales_analytics', 'customer_analytics', 'financial_analytics', 'inventory_analytics');

INSERT INTO analytics_modules (id, key, name, category, min_plan, is_addon, is_coming_soon, is_active, route_path, display_order)
VALUES (gen_random_uuid(), 'custom_reports', 'Relatórios Personalizados', 'geral', 'enterprise', true, true, true, '/relatorios/personalizados', 6)
ON CONFLICT (key) DO UPDATE
SET route_path = EXCLUDED.route_path,
    is_coming_soon = EXCLUDED.is_coming_soon,
    display_order = EXCLUDED.display_order,
    updated_at = now();

INSERT INTO notification_templates (id, company_id, event_type, channel, name, subject_template, body_template, is_active)
VALUES
  (gen_random_uuid(), NULL, NULL, 'email', 'Notificação padrão (e-mail)',
   '[{{priorityLabel}}] {{title}}',
   '<!doctype html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0;"><tr><td align="center"><table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;"><tr><td style="background:linear-gradient(135deg,#0B2551,#00d2ff);padding:20px 28px;"><span style="color:#ffffff;font-size:18px;font-weight:bold;">Gestly · {{companyName}}</span></td></tr><tr><td style="padding:28px;"><p style="margin:0 0 12px;color:#111827;font-size:16px;font-weight:bold;">{{title}}</p><p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">{{message}}</p><p style="margin:0 0 20px;color:#6b7280;font-size:13px;line-height:1.6;background:#f8fafc;border-radius:8px;padding:12px;">{{summary}}</p><a href="{{link}}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:bold;">Ver na Central de Notificações</a></td></tr><tr><td style="padding:16px 28px;background:#f8fafc;"><p style="margin:0;color:#9ca3af;font-size:11px;">Você recebeu este e-mail porque está inscrito em notificações de {{categoryLabel}} no SobControle. Ajuste suas preferências na Central de Notificações.</p></td></tr></table></td></tr></table></body></html>',
   true),
  (gen_random_uuid(), NULL, NULL, 'sms', 'Notificação padrão (SMS)',
   NULL, 'SobControle: {{title}} - {{message}} Detalhes: {{link}}', true),
  (gen_random_uuid(), NULL, NULL, 'push', 'Notificação padrão (push)',
   NULL, '{{title}}|{{message}}', true)
ON CONFLICT DO NOTHING;

-- Story 1.15 — Previsão de Fluxo de Caixa
-- Índices para as consultas de saldo realizado (status = 'paid') e
-- lançamentos em aberto até o fim do período (company_id + status + due_date).
-- Também aplicado via supabase/migrations/20260719120000_cash_flow_forecast_indexes.sql
CREATE INDEX IF NOT EXISTS idx_account_receivables_company_status_due
  ON account_receivables(company_id, status, due_date);

CREATE INDEX IF NOT EXISTS idx_account_payables_company_status_due
  ON account_payables(company_id, status, due_date);

-- Story 1.16 — Recomendações de Estoque e Compras
-- As recomendações são calculadas em tempo real a partir de products +
-- sale_items + purchase_items já existentes. Estas duas tabelas persistem
-- apenas as ações do usuário (dispensar/adiar/resolver), com auditoria
-- append-only — nunca apagar recomendações anteriores sem histórico.
-- Também aplicado via supabase/migrations/20260719130000_stock_recommendations_schema.sql
CREATE TABLE IF NOT EXISTS stock_recommendation_states (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    recommendation_type TEXT NOT NULL, -- 'reposicao', 'estoque_parado'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'dismissed', 'postponed', 'resolved'
    postponed_until TIMESTAMPTZ,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT stock_recommendation_states_unique UNIQUE (company_id, product_id, recommendation_type),
    CONSTRAINT stock_recommendation_states_type_check CHECK (recommendation_type IN ('reposicao', 'estoque_parado')),
    CONSTRAINT stock_recommendation_states_status_check CHECK (status IN ('active', 'dismissed', 'postponed', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_stock_recommendation_states_company_status
  ON stock_recommendation_states(company_id, status);

ALTER TABLE stock_recommendation_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total dos membros da empresa aos estados de recomendação" ON stock_recommendation_states
FOR ALL USING (company_id = get_user_company_id());

CREATE TABLE IF NOT EXISTS stock_recommendation_actions (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    recommendation_type TEXT NOT NULL,
    action TEXT NOT NULL, -- 'dismissed', 'postponed', 'resolved'
    reason TEXT,
    snapshot_priority TEXT,
    snapshot_current_quantity NUMERIC(12, 3),
    snapshot_coverage_days NUMERIC(12, 2),
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT stock_recommendation_actions_type_check CHECK (recommendation_type IN ('reposicao', 'estoque_parado')),
    CONSTRAINT stock_recommendation_actions_action_check CHECK (action IN ('dismissed', 'postponed', 'resolved'))
);

CREATE INDEX IF NOT EXISTS idx_stock_recommendation_actions_company_product
  ON stock_recommendation_actions(company_id, product_id, performed_at DESC);

ALTER TABLE stock_recommendation_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total dos membros da empresa ao historico de recomendacoes" ON stock_recommendation_actions
FOR ALL USING (company_id = get_user_company_id());

REVOKE ALL ON stock_recommendation_states, stock_recommendation_actions FROM anon;

-- Story 1.24: defesa em profundidade para leituras financeiras em Relatórios.
CREATE OR REPLACE FUNCTION public.assert_report_financial_access()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_company_id UUID;
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'authentication required';
  END IF;

  SELECT profile.company_id, profile.role
    INTO v_company_id, v_role
  FROM public.profiles AS profile
  WHERE profile.id = auth.uid();

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'company context unavailable';
  END IF;

  IF v_role NOT IN ('admin', 'manager') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'financial permission denied';
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_report_financial_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_report_financial_access() TO authenticated;

COMMENT ON FUNCTION public.assert_report_financial_access() IS
  'Role guard for financial report reads. SECURITY INVOKER; admin/manager only.';
