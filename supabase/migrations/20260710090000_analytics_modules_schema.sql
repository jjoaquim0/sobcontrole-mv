-- Módulo de Central de Inteligência (Gestly BI) — Story 1.6
-- 3 tabelas novas (analytics_modules, company_analytics_modules,
-- company_analytics_module_history). Nenhuma delas existia antes desta story
-- (confirmado via mcp__supabase__list_tables antes da implementação).

-- =========================================================================
-- 1. Tabelas
-- =========================================================================

-- analytics_modules: catálogo global de módulos analíticos (sem company_id —
-- referência do sistema, mesmo padrão de notification_templates com
-- company_id IS NULL). Gerenciado via seed/migration, não pelo cliente.
CREATE TABLE IF NOT EXISTS analytics_modules (
    id UUID PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    min_plan TEXT,
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

-- company_analytics_modules: add-ons contratados por empresa, além do que o
-- plano já inclui por padrão (comparação de plano é feita no frontend, ver
-- resolveModuleAccess). UNIQUE(company_id, module_key) evita duplicidade.
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

-- company_analytics_module_history: log de auditoria, somente leitura para o
-- cliente — populada exclusivamente pelo trigger da seção 3 (SECURITY
-- DEFINER), nunca por INSERT direto do usuário autenticado.
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
-- 2. Row Level Security
-- =========================================================================

ALTER TABLE analytics_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_analytics_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_analytics_module_history ENABLE ROW LEVEL SECURITY;

-- analytics_modules: leitura liberada a qualquer usuário autenticado (dado não
-- sensível — nome/categoria/plano mínimo do catálogo). Sem política de
-- escrita para authenticated: o catálogo é gerenciado via seed/migration.
CREATE POLICY "Usuários autenticados leem o catálogo de módulos" ON analytics_modules
FOR SELECT TO authenticated USING (true);

-- company_analytics_modules: leitura restrita à própria empresa; escrita
-- restrita a admin/manager da própria empresa (mesmo padrão de
-- notification_rules) — pronta para uma futura tela de contratação/billing;
-- nenhuma tela desta story escreve nesta tabela (ver Scope Decision 2 da
-- story: CTAs de módulo bloqueado apenas abrem modal/redirecionam).
CREATE POLICY "Empresa lê os próprios módulos contratados" ON company_analytics_modules
FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Admin/gerente contrata módulos" ON company_analytics_modules
FOR INSERT WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admin/gerente atualiza módulos contratados" ON company_analytics_modules
FOR UPDATE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admin/gerente remove módulos contratados" ON company_analytics_modules
FOR DELETE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

-- company_analytics_module_history: leitura restrita à própria empresa; sem
-- política de INSERT/UPDATE/DELETE para authenticated — a única via de
-- escrita é o trigger SECURITY DEFINER da seção 3.
CREATE POLICY "Empresa lê o próprio histórico de módulos" ON company_analytics_module_history
FOR SELECT USING (company_id = get_user_company_id());

REVOKE ALL ON analytics_modules, company_analytics_modules, company_analytics_module_history FROM anon;

-- =========================================================================
-- 3. Auditoria automática (trigger)
-- =========================================================================

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

-- =========================================================================
-- 4. Seed do catálogo (6 módulos)
-- =========================================================================
-- min_plan = NULL -> incluído em qualquer plano ativo. Os demais exigem
-- 'enterprise': toda empresa nasce no plano 'pro' (complete_company_signup),
-- então aparecem como "Bloqueado" por padrão — demonstrando o funil de
-- upsell descrito no brief (mostrar valor antes de mostrar a restrição). Uma
-- empresa já no plano 'enterprise' os recebe automaticamente como
-- "Disponível", sem precisar de linha em company_analytics_modules.

INSERT INTO analytics_modules (id, key, name, category, min_plan, is_addon, is_coming_soon, is_active, route_path, display_order)
VALUES
  (gen_random_uuid(), 'dashboard_executivo', 'Dashboard Executivo', 'geral', NULL, false, false, true, '/dashboard', 0),
  (gen_random_uuid(), 'sales_analytics', 'Analytics de Vendas', 'vendas', 'enterprise', true, false, true, '/reports?tab=sales', 1),
  (gen_random_uuid(), 'customer_analytics', 'Analytics de Clientes', 'clientes', 'enterprise', true, false, true, '/reports?tab=customers', 2),
  (gen_random_uuid(), 'financial_analytics', 'Analytics Financeiro', 'financeiro', 'enterprise', true, false, true, '/reports?tab=financial', 3),
  (gen_random_uuid(), 'inventory_analytics', 'Analytics de Estoque e Compras', 'estoque', 'enterprise', true, false, true, '/reports?tab=inventory', 4),
  (gen_random_uuid(), 'gestly_insights', 'Gestly Insights', 'ia', 'enterprise', true, false, true, '/notifications', 5)
ON CONFLICT (key) DO NOTHING;
