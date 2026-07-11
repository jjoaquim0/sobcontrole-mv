-- Correção de pré-requisito descoberta durante a Story 1.5 (Notificações
-- Inteligentes): a tabela company_settings já é referenciada extensivamente
-- pelo frontend (src/services/settingsService.ts, src/types/index.ts,
-- Settings > Notificações/Aparência) e já está documentada em
-- supabase_schema.sql desde a Story 1.1, mas NUNCA foi de fato aplicada a
-- este projeto Supabase remoto (confirmado ausente via
-- mcp__supabase__list_tables e information_schema.tables antes desta
-- migration). Sem ela, a Story 1.5 não pode adicionar sms_notifications, e a
-- aba "Notificações" de Configurações estaria falhando silenciosamente em
-- produção (getSettings()/updateSettings() lançariam "relation does not
-- exist"). DDL abaixo replica exatamente o que já constava em
-- supabase_schema.sql, sem inventar nenhuma coluna nova.

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

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão das demais tabelas 1:1 por empresa (leitura ampla, escrita
-- restrita a admin/manager), consistente com o que updateSettings()/getSettings()
-- já assumiam no código existente.
CREATE POLICY "Acesso da empresa às próprias configurações" ON company_settings
FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Empresa cria as próprias configurações" ON company_settings
FOR INSERT WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Admin/gerente atualiza as configurações da empresa" ON company_settings
FOR UPDATE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

REVOKE ALL ON company_settings FROM anon;
