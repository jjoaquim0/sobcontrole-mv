-- Módulo de Notificações Inteligentes — Story 1.5
-- 8 tabelas novas (notification_events, notifications, notification_preferences,
-- notification_push_subscriptions, notification_deliveries, notification_templates,
-- notification_rules, notification_actions) + 1 coluna nova em company_settings
-- (sms_notifications, espelhando email_notifications/push_notifications já existentes).
-- Nenhuma dessas tabelas existia antes desta story (confirmado via
-- mcp__supabase__list_tables antes da implementação).

-- =========================================================================
-- 0. Extensão de company_settings (switch mestre da empresa por canal)
-- =========================================================================

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS sms_notifications BOOLEAN DEFAULT false;

-- =========================================================================
-- 1. Tabelas
-- =========================================================================

-- notification_events: sinais brutos detectados pelo scanner periódico (ou por
-- trigger, no caso de team_event_created) antes de virarem notificações por
-- usuário. dedup_key + índice único parcial (resolved_at IS NULL) evitam
-- recriar o mesmo evento em aberto a cada execução do cron.
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

-- notifications: entrega "de vitrine" por destinatário. Um mesmo event pode
-- gerar 0, 1 ou várias notifications (ex.: estoque baixo notifica todos os
-- usuários da empresa). channels é uma cópia desnormalizada dos canais
-- aprovados para filtro rápido na Central sem precisar de JOIN em
-- notification_deliveries.
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
    CONSTRAINT notifications_category_check CHECK (category IN (
        'agenda', 'pipeline', 'vendas', 'clientes', 'financeiro', 'estoque', 'metas', 'equipe'
    )),
    CONSTRAINT notifications_priority_check CHECK (priority IN (
        'informativa', 'baixa', 'media', 'alta', 'critica'
    )),
    CONSTRAINT notifications_status_check CHECK (status IN (
        'unread', 'read', 'resolved', 'archived'
    )),
    CONSTRAINT notifications_action_check CHECK (action_taken IS NULL OR action_taken IN (
        'send_message', 'create_task', 'schedule_meeting', 'open_customer', 'open_deal',
        'reassign', 'snooze', 'resolve', 'dismiss'
    )),
    CONSTRAINT notifications_suggested_action_check CHECK (ai_suggested_action IS NULL OR ai_suggested_action IN (
        'send_message', 'create_task', 'schedule_meeting', 'open_customer', 'open_deal',
        'reassign', 'snooze', 'resolve', 'dismiss'
    ))
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON notifications(company_id, recipient_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(event_id);

-- notification_preferences: 1 linha por usuário. channels/categorias/prioridade
-- mínima/horário de silêncio/frequência de resumo/consentimento — tudo o que o
-- PRÓPRIO usuário controla. Políticas gerais da empresa continuam em
-- company_settings (email_notifications/push_notifications/sms_notifications),
-- que atuam como switch mestre acima destas preferências individuais.
CREATE TABLE IF NOT EXISTS notification_preferences (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    push_enabled BOOLEAN NOT NULL DEFAULT true,
    email_enabled BOOLEAN NOT NULL DEFAULT true,
    sms_enabled BOOLEAN NOT NULL DEFAULT false,
    categories_enabled TEXT[] NOT NULL DEFAULT ARRAY[
        'agenda', 'pipeline', 'vendas', 'clientes', 'financeiro', 'estoque', 'metas', 'equipe'
    ],
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
    CONSTRAINT notification_preferences_quiet_hours_check CHECK (
        (quiet_hours_start IS NULL AND quiet_hours_end IS NULL) OR
        (quiet_hours_start IS NOT NULL AND quiet_hours_end IS NOT NULL)
    )
);

-- notification_push_subscriptions: tabela própria (não uma coluna em
-- notification_preferences) porque um usuário pode ter várias assinaturas Web
-- Push ativas (navegadores/dispositivos diferentes); cada endpoint é único.
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

-- notification_deliveries: 1 linha por (notification, canal) — funciona como a
-- fila de envio (status='queued' + next_retry_at) E como o histórico de
-- entrega exibido ao usuário. UNIQUE(notification_id, channel) garante
-- idempotência (nunca duas linhas de fila para o mesmo canal da mesma
-- notificação); retries reaproveitam a mesma linha (attempt_count++).
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

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_pending
  ON notification_deliveries(status, next_retry_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_recipient
  ON notification_deliveries(company_id, recipient_user_id);

-- notification_templates: company_id NULL = template padrão do sistema
-- (visível a todas as empresas); company_id preenchido = override daquela
-- empresa. A política de SELECT libera as duas; ALL fica restrito à própria
-- empresa, então uma empresa nunca edita/apaga o template global.
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

-- notification_rules: overrides por empresa dos limites/cooldown usados pelo
-- scanner (generate_notification_events/fanout_notification_events). Ausência
-- de linha para (company_id, event_type) = usa os defaults hardcoded nas
-- funções abaixo. Não há tela de administração destas regras nesta story
-- (ver Dev Notes/limitações) — a tabela e a leitura pelo backend já existem
-- para uma story futura habilitar o ajuste fino via UI sem mudar o schema.
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
    CONSTRAINT notification_rules_priority_check CHECK (
        default_priority IS NULL OR default_priority IN ('informativa', 'baixa', 'media', 'alta', 'critica')
    )
);

-- notification_actions: log de auditoria das ações executadas (sugeridas pela
-- IA ou não) sobre uma notification — atende ao requisito de auditoria das
-- automações e ao "ação executada pelo usuário" pedido no brief.
CREATE TABLE IF NOT EXISTS notification_actions (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE NOT NULL,
    action_type TEXT NOT NULL,
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    performed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT notification_actions_type_check CHECK (action_type IN (
        'send_message', 'create_task', 'schedule_meeting', 'open_customer', 'open_deal',
        'reassign', 'snooze', 'resolve', 'dismiss'
    ))
);

CREATE INDEX IF NOT EXISTS idx_notification_actions_notification ON notification_actions(notification_id);

-- Índices auxiliares nas tabelas de origem para os scans do detector (predicado
-- casa exatamente a condição usada em generate_notification_events()).
CREATE INDEX IF NOT EXISTS idx_deals_stale_scan ON deals(company_id, status, updated_at) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_products_low_stock_scan ON products(company_id) WHERE is_active AND current_quantity <= min_quantity;

-- =========================================================================
-- 2. Row Level Security
-- =========================================================================

ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_actions ENABLE ROW LEVEL SECURITY;

-- notification_events: uso interno do backend (scanner/fanout rodam como
-- SECURITY DEFINER e ignoram RLS); política por empresa existe apenas como
-- defesa em profundidade, o frontend não consulta esta tabela diretamente.
CREATE POLICY "Acesso da empresa aos eventos de notificação" ON notification_events
FOR ALL USING (company_id = get_user_company_id());

-- notifications: cada usuário só vê/edita as próprias notificações dentro da
-- própria empresa. Não existe política de INSERT para authenticated —
-- inserção só acontece via função SECURITY DEFINER (fanout_notification_events).
CREATE POLICY "Usuário vê apenas suas notificações" ON notifications
FOR SELECT USING (company_id = get_user_company_id() AND recipient_user_id = auth.uid());

CREATE POLICY "Usuário atualiza apenas suas notificações" ON notifications
FOR UPDATE USING (company_id = get_user_company_id() AND recipient_user_id = auth.uid());

-- notification_preferences: cada usuário gerencia só a própria linha.
CREATE POLICY "Usuário gerencia as próprias preferências de notificação" ON notification_preferences
FOR ALL USING (company_id = get_user_company_id() AND user_id = auth.uid());

-- notification_push_subscriptions: idem, por dispositivo.
CREATE POLICY "Usuário gerencia as próprias assinaturas de push" ON notification_push_subscriptions
FOR ALL USING (company_id = get_user_company_id() AND user_id = auth.uid());

-- notification_deliveries: somente leitura para o próprio destinatário
-- (histórico de entrega); escrita é feita pelo backend (service role/SECURITY
-- DEFINER), nunca pelo cliente autenticado.
CREATE POLICY "Usuário lê o histórico de entrega das próprias notificações" ON notification_deliveries
FOR SELECT USING (company_id = get_user_company_id() AND recipient_user_id = auth.uid());

-- notification_templates: leitura liberada para templates da própria empresa
-- OU globais (company_id IS NULL); escrita restrita à própria empresa, o que
-- automaticamente bloqueia edição/exclusão dos templates globais pelo cliente.
CREATE POLICY "Empresa lê templates próprios e globais" ON notification_templates
FOR SELECT USING (company_id = get_user_company_id() OR company_id IS NULL);

CREATE POLICY "Empresa gerencia os próprios templates" ON notification_templates
FOR INSERT WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Empresa atualiza os próprios templates" ON notification_templates
FOR UPDATE USING (company_id = get_user_company_id());

CREATE POLICY "Empresa remove os próprios templates" ON notification_templates
FOR DELETE USING (company_id = get_user_company_id());

-- notification_rules: leitura para a empresa toda; escrita restrita a
-- admin/manager (mesmo padrão de company_settings).
CREATE POLICY "Empresa lê as próprias regras de notificação" ON notification_rules
FOR SELECT USING (company_id = get_user_company_id());

CREATE POLICY "Admin/gerente gerencia as regras de notificação" ON notification_rules
FOR INSERT WITH CHECK (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admin/gerente atualiza as regras de notificação" ON notification_rules
FOR UPDATE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

CREATE POLICY "Admin/gerente remove as regras de notificação" ON notification_rules
FOR DELETE USING (company_id = get_user_company_id() AND get_user_role() IN ('admin', 'manager'));

-- notification_actions: usuário só vê/insere ações que ele próprio executou.
CREATE POLICY "Usuário gerencia as próprias ações de notificação" ON notification_actions
FOR ALL USING (company_id = get_user_company_id() AND performed_by = auth.uid())
WITH CHECK (company_id = get_user_company_id() AND performed_by = auth.uid());

REVOKE ALL ON notification_events FROM anon;
REVOKE ALL ON notifications FROM anon;
REVOKE ALL ON notification_preferences FROM anon;
REVOKE ALL ON notification_push_subscriptions FROM anon;
REVOKE ALL ON notification_deliveries FROM anon;
REVOKE ALL ON notification_templates FROM anon;
REVOKE ALL ON notification_rules FROM anon;
REVOKE ALL ON notification_actions FROM anon;

-- =========================================================================
-- 3. Funções utilitárias
-- =========================================================================

-- Ordinal de prioridade, usado para comparar contra o mínimo configurado por
-- canal em notification_preferences (ex.: min_priority_sms = 'critica').
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

-- Horário de silêncio é avaliado no fuso da empresa (company_settings.timezone),
-- não em UTC — primeiro uso real desta coluna no projeto (existia desde a
-- Story 1.1 mas nenhum cálculo de data a consultava até aqui).
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

-- Próximo instante (UTC) em que o horário de silêncio termina, usado como
-- next_retry_at das entregas represadas durante o silêncio.
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

-- =========================================================================
-- 4. Geração de conteúdo (Gestly) — motor determinístico baseado em templates
-- =========================================================================
-- Produz resumo/justificativa/ação sugerida/prazo/texto de contato a partir do
-- event_type + payload, no mesmo formato dos exemplos do brief ("Este lead
-- está há 5 dias sem interação..."). É determinístico (sem chamada a LLM) por
-- decisão de escopo documentada na story — a assinatura desta função é o
-- "seam" onde uma geração via LLM real poderia substituir o corpo no futuro
-- sem alterar nenhum consumidor (fanout_notification_events, frontend, etc.).
CREATE OR REPLACE FUNCTION public.build_notification_content(
  p_event_type TEXT,
  p_payload JSONB
)
RETURNS TABLE (
  category TEXT,
  title TEXT,
  message TEXT,
  ai_summary TEXT,
  ai_priority_reason TEXT,
  ai_suggested_action TEXT,
  ai_suggested_deadline TIMESTAMPTZ,
  ai_suggested_message TEXT,
  base_priority TEXT
)
LANGUAGE plpgsql AS $$
DECLARE
  v_customer_name TEXT := COALESCE(p_payload->>'customerName', 'o cliente');
  v_days INTEGER;
  v_amount NUMERIC;
BEGIN
  CASE p_event_type
    WHEN 'appointment_upcoming' THEN
      RETURN QUERY SELECT
        'agenda'::TEXT,
        format('Compromisso em breve: %s', p_payload->>'title'),
        format('"%s" começa às %s.', p_payload->>'title', to_char((p_payload->>'startAt')::timestamptz, 'HH24:MI')),
        format('Você tem "%s" agendado para %s.', p_payload->>'title', to_char((p_payload->>'startAt')::timestamptz, 'HH24:MI')),
        'Compromisso prestes a começar.'::TEXT,
        NULL::TEXT,
        (p_payload->>'startAt')::timestamptz,
        NULL::TEXT,
        (CASE WHEN (p_payload->>'startAt')::timestamptz - now() <= INTERVAL '30 minutes' THEN 'alta' ELSE 'media' END)::TEXT;

    WHEN 'appointment_overdue' THEN
      v_days := GREATEST(0, EXTRACT(DAY FROM now() - (p_payload->>'endAt')::timestamptz)::int);
      RETURN QUERY SELECT
        'agenda'::TEXT,
        format('Compromisso atrasado: %s', p_payload->>'title'),
        format('"%s" deveria ter terminado em %s e ainda não foi concluído.', p_payload->>'title', to_char((p_payload->>'endAt')::timestamptz, 'DD/MM HH24:MI')),
        format('"%s" está atrasado há %s.', p_payload->>'title', CASE WHEN v_days <= 0 THEN 'algumas horas' ELSE v_days || ' dia(s)' END),
        'Prazo do compromisso já passou sem conclusão.'::TEXT,
        NULL::TEXT,
        now() + INTERVAL '1 hour',
        NULL::TEXT,
        (CASE WHEN v_days >= 3 THEN 'critica' WHEN v_days >= 1 THEN 'alta' ELSE 'media' END)::TEXT;

    WHEN 'deal_stale' THEN
      v_days := COALESCE((p_payload->>'daysStale')::int, 0);
      v_amount := COALESCE((p_payload->>'value')::numeric, 0);
      RETURN QUERY SELECT
        'pipeline'::TEXT,
        format('Negócio parado: %s', p_payload->>'title'),
        format('"%s" (%s) está há %s dia(s) sem movimentação na etapa "%s".', p_payload->>'title', v_customer_name, v_days, COALESCE(p_payload->>'stageName', 'atual')),
        format('Este negócio está há %s dias sem interação. Recomenda-se enviar um follow-up hoje.', v_days),
        format('%s dia(s) parado na etapa "%s", R$ %s em jogo.', v_days, COALESCE(p_payload->>'stageName', 'atual'), round(v_amount, 2)),
        'send_message'::TEXT,
        now() + INTERVAL '1 day',
        format('Olá %s, tudo bem? Vi que ainda não avançamos com "%s" — posso te ajudar com alguma dúvida para seguirmos?', v_customer_name, p_payload->>'title'),
        (CASE WHEN v_days >= 20 OR v_amount > 20000 THEN 'critica' WHEN v_days >= 10 OR v_amount > 10000 THEN 'alta' WHEN v_days >= 5 THEN 'media' ELSE 'baixa' END)::TEXT;

    WHEN 'proposal_expiring' THEN
      v_days := COALESCE((p_payload->>'daysUntilDue')::int, 0);
      v_amount := COALESCE((p_payload->>'value')::numeric, 0);
      RETURN QUERY SELECT
        'pipeline'::TEXT,
        format('Proposta vencendo: %s', p_payload->>'title'),
        CASE WHEN v_days < 0 THEN format('A proposta de "%s" venceu há %s dia(s).', p_payload->>'title', abs(v_days))
             WHEN v_days = 0 THEN format('A proposta de "%s" vence hoje.', p_payload->>'title')
             ELSE format('A proposta de "%s" vence em %s dia(s).', p_payload->>'title', v_days) END,
        CASE WHEN v_days <= 0 THEN 'A proposta venceu. Confirme o recebimento com o cliente.'
             ELSE format('A proposta vence em %s dia(s). Confirme o recebimento com o cliente.', v_days) END,
        format('Prazo esperado de fechamento: %s. Valor: R$ %s.', to_char((p_payload->>'expectedCloseDate')::date, 'DD/MM/YYYY'), round(v_amount, 2)),
        'send_message'::TEXT,
        COALESCE((p_payload->>'expectedCloseDate')::date, CURRENT_DATE)::timestamptz,
        format('Olá %s, passando para confirmar se você recebeu nossa proposta para "%s" e ver se ficou alguma dúvida.', v_customer_name, p_payload->>'title'),
        (CASE WHEN v_days < 0 AND v_amount > 20000 THEN 'critica' WHEN v_days < 0 THEN 'alta' WHEN v_days = 0 THEN 'alta' ELSE 'media' END)::TEXT;

    WHEN 'sale_no_followup' THEN
      v_days := COALESCE((p_payload->>'daysSinceSale')::int, 0);
      RETURN QUERY SELECT
        'vendas'::TEXT,
        format('Venda sem follow-up: %s', v_customer_name),
        format('A venda para %s há %s dia(s) ainda não teve contato de acompanhamento.', v_customer_name, v_days),
        format('%s comprou há %s dias e ainda não recebeu follow-up.', v_customer_name, v_days),
        'Nenhum compromisso de acompanhamento encontrado após a venda.'::TEXT,
        'send_message'::TEXT,
        now() + INTERVAL '1 day',
        format('Olá %s, tudo bem com o produto/serviço que você adquiriu? Qualquer dúvida, estou à disposição!', v_customer_name),
        (CASE WHEN v_days >= 7 THEN 'media' ELSE 'baixa' END)::TEXT;

    WHEN 'customer_at_risk' THEN
      v_days := COALESCE((p_payload->>'daysSinceLastSale')::int, 0);
      v_amount := COALESCE((p_payload->>'lifetimeValue')::numeric, 0);
      RETURN QUERY SELECT
        'clientes'::TEXT,
        format('Cliente inativo: %s', v_customer_name),
        format('%s não compra há %s dia(s).', v_customer_name, v_days),
        format('O cliente %s reduziu sua frequência de compras (%s dias sem comprar). Criar ação de reativação.', v_customer_name, v_days),
        format('Histórico de R$ %s em compras, sem atividade recente.', round(v_amount, 2)),
        'create_task'::TEXT,
        now() + INTERVAL '2 days',
        format('Olá %s! Sentimos sua falta por aqui — temos novidades que podem te interessar. Posso te ajudar com alguma coisa?', v_customer_name),
        (CASE WHEN v_amount > 5000 THEN 'alta' ELSE 'media' END)::TEXT;

    WHEN 'payment_receivable_due' THEN
      v_days := COALESCE((p_payload->>'daysUntilDue')::int, 0);
      v_amount := COALESCE((p_payload->>'amount')::numeric, 0);
      RETURN QUERY SELECT
        'financeiro'::TEXT,
        format('Recebimento %s: %s', CASE WHEN v_days < 0 THEN 'atrasado' ELSE 'a vencer' END, v_customer_name),
        CASE WHEN v_days < 0 THEN format('Recebimento de R$ %s de %s está atrasado há %s dia(s).', round(v_amount, 2), v_customer_name, abs(v_days))
             ELSE format('Recebimento de R$ %s de %s vence em %s dia(s).', round(v_amount, 2), v_customer_name, v_days) END,
        CASE WHEN v_days < 0 THEN format('Pagamento de %s está atrasado. Entre em contato para regularizar.', v_customer_name)
             ELSE format('Pagamento de %s vence em breve. Considere um lembrete amigável.', v_customer_name) END,
        format('Valor de R$ %s, vencimento em %s.', round(v_amount, 2), to_char((p_payload->>'dueDate')::timestamptz, 'DD/MM/YYYY')),
        'send_message'::TEXT,
        (p_payload->>'dueDate')::timestamptz,
        format('Olá %s, passando para lembrar sobre o pagamento no valor de R$ %s. Qualquer dúvida, é só chamar!', v_customer_name, round(v_amount, 2)),
        (CASE WHEN v_days < 0 AND v_amount > 5000 THEN 'critica' WHEN v_days < 0 THEN 'alta' WHEN v_days = 0 THEN 'alta' ELSE 'media' END)::TEXT;

    WHEN 'payment_payable_due' THEN
      v_days := COALESCE((p_payload->>'daysUntilDue')::int, 0);
      v_amount := COALESCE((p_payload->>'amount')::numeric, 0);
      RETURN QUERY SELECT
        'financeiro'::TEXT,
        format('Pagamento %s a %s', CASE WHEN v_days < 0 THEN 'atrasado' ELSE 'a vencer' END, COALESCE(p_payload->>'supplierName', 'fornecedor')),
        CASE WHEN v_days < 0 THEN format('Conta a pagar de R$ %s está atrasada há %s dia(s).', round(v_amount, 2), abs(v_days))
             ELSE format('Conta a pagar de R$ %s vence em %s dia(s).', round(v_amount, 2), v_days) END,
        format('Conta a pagar de R$ %s com vencimento em %s.', round(v_amount, 2), to_char((p_payload->>'dueDate')::timestamptz, 'DD/MM/YYYY')),
        'Evite juros/multa quitando antes do vencimento.'::TEXT,
        NULL::TEXT,
        (p_payload->>'dueDate')::timestamptz,
        NULL::TEXT,
        (CASE WHEN v_days < 0 AND v_amount > 5000 THEN 'critica' WHEN v_days < 0 THEN 'alta' WHEN v_days = 0 THEN 'alta' ELSE 'media' END)::TEXT;

    WHEN 'low_stock' THEN
      RETURN QUERY SELECT
        'estoque'::TEXT,
        format('Estoque baixo: %s', p_payload->>'productName'),
        format('"%s" (SKU %s) está com %s unidade(s), abaixo do mínimo de %s.', p_payload->>'productName', p_payload->>'sku', p_payload->>'currentQuantity', p_payload->>'minQuantity'),
        format('O produto "%s" está com estoque abaixo do mínimo configurado.', p_payload->>'productName'),
        'Quantidade atual menor ou igual à quantidade mínima cadastrada.'::TEXT,
        'create_task'::TEXT,
        now() + INTERVAL '2 days',
        NULL::TEXT,
        (CASE WHEN (p_payload->>'currentQuantity')::numeric <= 0 THEN 'critica' ELSE 'media' END)::TEXT;

    WHEN 'team_event_created' THEN
      RETURN QUERY SELECT
        'equipe'::TEXT,
        format('Novo compromisso da equipe: %s', p_payload->>'title'),
        format('%s criou "%s" para você, em %s.', COALESCE(p_payload->>'createdByName', 'Um colega'), p_payload->>'title', to_char((p_payload->>'startAt')::timestamptz, 'DD/MM HH24:MI')),
        format('%s agendou "%s" para você.', COALESCE(p_payload->>'createdByName', 'Um colega'), p_payload->>'title'),
        'Evento criado por outro membro da equipe.'::TEXT,
        NULL::TEXT,
        (p_payload->>'startAt')::timestamptz,
        NULL::TEXT,
        'informativa'::TEXT;

    ELSE
      RETURN QUERY SELECT
        'equipe'::TEXT, 'Notificação'::TEXT, ''::TEXT, ''::TEXT, ''::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TEXT, 'informativa'::TEXT;
  END CASE;
END;
$$;

-- =========================================================================
-- 5. Detecção de eventos (scanner periódico via pg_cron)
-- =========================================================================
-- Cobre 9 dos 11 event_type: 'team_event_created' é gerado por trigger (seção
-- 6); 'sales_goal_at_risk' não possui detector nesta story — não existe
-- módulo de metas/cotas no schema atual (ver Dev Notes da story, limitação
-- documentada). O valor do enum foi mantido para permitir que uma notificação
-- desta categoria seja criada manualmente ou por um módulo futuro de Metas.
CREATE OR REPLACE FUNCTION public.generate_notification_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_started_at TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- 5.1 Resolver eventos cuja condição de origem deixou de ser verdadeira
  UPDATE notification_events e SET resolved_at = now()
  WHERE e.resolved_at IS NULL AND (
    (e.event_type = 'appointment_upcoming' AND NOT EXISTS (
      SELECT 1 FROM appointments a WHERE a.id::text = e.entity_id
        AND a.status NOT IN ('concluido', 'cancelado') AND a.start_at BETWEEN now() AND now() + INTERVAL '2 hours'
    ))
    OR (e.event_type = 'appointment_overdue' AND NOT EXISTS (
      SELECT 1 FROM appointments a WHERE a.id::text = e.entity_id
        AND a.status NOT IN ('concluido', 'cancelado') AND a.end_at < now()
    ))
    OR (e.event_type = 'deal_stale' AND NOT EXISTS (
      SELECT 1 FROM deals d WHERE d.id::text = e.entity_id AND d.status = 'open'
    ))
    OR (e.event_type = 'proposal_expiring' AND NOT EXISTS (
      SELECT 1 FROM deals d WHERE d.id::text = e.entity_id AND d.status = 'open'
        AND d.expected_close_date IS NOT NULL AND d.expected_close_date <= CURRENT_DATE + INTERVAL '3 days'
    ))
    OR (e.event_type = 'sale_no_followup' AND NOT EXISTS (
      SELECT 1 FROM sales s WHERE s.id = e.entity_id AND s.payment_status NOT IN ('canceled', 'cancelled')
        AND NOT EXISTS (SELECT 1 FROM appointments ap WHERE ap.customer_id = s.customer_id AND ap.start_at > s.created_at)
    ))
    OR (e.event_type = 'customer_at_risk' AND NOT EXISTS (
      SELECT 1 FROM customers c
      CROSS JOIN LATERAL (SELECT MAX(s.created_at) AS last_sale_at FROM sales s WHERE s.customer_id = c.id) ls
      WHERE c.id::text = e.entity_id AND c.is_active = true AND ls.last_sale_at < now() - INTERVAL '30 days'
    ))
    OR (e.event_type = 'payment_receivable_due' AND NOT EXISTS (
      SELECT 1 FROM account_receivables r WHERE r.id = e.entity_id AND r.status = 'pending'
    ))
    OR (e.event_type = 'payment_payable_due' AND NOT EXISTS (
      SELECT 1 FROM account_payables p WHERE p.id = e.entity_id AND p.status = 'pending'
    ))
    OR (e.event_type = 'low_stock' AND NOT EXISTS (
      SELECT 1 FROM products pr WHERE pr.id::text = e.entity_id AND pr.is_active AND pr.current_quantity <= pr.min_quantity
    ))
  );

  -- 5.2 appointment_upcoming: compromissos nas próximas 2 horas
  INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
  SELECT gen_random_uuid(), a.company_id, 'appointment_upcoming', 'appointment', a.id::text,
    'appointment_upcoming:' || a.id::text,
    jsonb_build_object('title', a.title, 'startAt', a.start_at, 'assignedUserId', a.assigned_user_id,
      'customerId', a.customer_id, 'customerName', c.full_name, 'type', a.type),
    now()
  FROM appointments a
  LEFT JOIN customers c ON c.id = a.customer_id
  WHERE a.status NOT IN ('concluido', 'cancelado')
    AND a.start_at BETWEEN now() AND now() + INTERVAL '2 hours'
    AND NOT EXISTS (SELECT 1 FROM notification_events e WHERE e.company_id = a.company_id
      AND e.dedup_key = 'appointment_upcoming:' || a.id::text AND e.resolved_at IS NULL)
  ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;

  -- 5.3 appointment_overdue
  INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
  SELECT gen_random_uuid(), a.company_id, 'appointment_overdue', 'appointment', a.id::text,
    'appointment_overdue:' || a.id::text,
    jsonb_build_object('title', a.title, 'endAt', a.end_at, 'assignedUserId', a.assigned_user_id,
      'customerId', a.customer_id, 'customerName', c.full_name, 'type', a.type),
    now()
  FROM appointments a
  LEFT JOIN customers c ON c.id = a.customer_id
  WHERE a.status NOT IN ('concluido', 'cancelado')
    AND a.end_at < now()
    AND NOT EXISTS (SELECT 1 FROM notification_events e WHERE e.company_id = a.company_id
      AND e.dedup_key = 'appointment_overdue:' || a.id::text AND e.resolved_at IS NULL)
  ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;

  -- 5.4 deal_stale: aberto, sem mudança de etapa/atividade/compromisso há 5+ dias
  INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
  SELECT gen_random_uuid(), d.company_id, 'deal_stale', 'deal', d.id::text,
    'deal_stale:' || d.id::text,
    jsonb_build_object('title', d.title, 'value', d.value, 'stageId', d.stage_id, 'stageName', ps.name,
      'ownerId', d.owner_id, 'customerId', d.customer_id, 'customerName', c.full_name,
      'daysStale', EXTRACT(DAY FROM now() - la.ts)::int),
    now()
  FROM deals d
  JOIN customers c ON c.id = d.customer_id
  JOIN pipeline_stages ps ON ps.id = d.stage_id
  CROSS JOIN LATERAL (
    SELECT GREATEST(
      d.updated_at,
      COALESCE((SELECT MAX(h.changed_at) FROM deal_stage_history h WHERE h.deal_id = d.id), d.created_at),
      COALESCE((SELECT MAX(ap.start_at) FROM appointments ap WHERE ap.deal_id = d.id), 'epoch'::timestamptz)
    ) AS ts
  ) la
  WHERE d.status = 'open'
    AND la.ts < now() - INTERVAL '5 days'
    AND NOT EXISTS (SELECT 1 FROM notification_events e WHERE e.company_id = d.company_id
      AND e.dedup_key = 'deal_stale:' || d.id::text AND e.resolved_at IS NULL)
  ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;

  -- 5.5 proposal_expiring: aberto, com previsão de fechamento em até 3 dias (ou já vencida)
  INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
  SELECT gen_random_uuid(), d.company_id, 'proposal_expiring', 'deal', d.id::text,
    'proposal_expiring:' || d.id::text,
    jsonb_build_object('title', d.title, 'value', d.value, 'ownerId', d.owner_id, 'customerId', d.customer_id,
      'customerName', c.full_name, 'expectedCloseDate', d.expected_close_date,
      'daysUntilDue', (d.expected_close_date - CURRENT_DATE)),
    now()
  FROM deals d
  JOIN customers c ON c.id = d.customer_id
  WHERE d.status = 'open'
    AND d.expected_close_date IS NOT NULL
    AND d.expected_close_date <= CURRENT_DATE + INTERVAL '3 days'
    AND NOT EXISTS (SELECT 1 FROM notification_events e WHERE e.company_id = d.company_id
      AND e.dedup_key = 'proposal_expiring:' || d.id::text AND e.resolved_at IS NULL)
  ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;

  -- 5.6 sale_no_followup: venda há 3+ dias sem nenhum compromisso posterior com o cliente
  INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
  SELECT gen_random_uuid(), s.company_id, 'sale_no_followup', 'sale', s.id,
    'sale_no_followup:' || s.id,
    jsonb_build_object('saleId', s.id, 'sellerId', s.seller_id, 'customerId', s.customer_id,
      'customerName', c.full_name, 'finalValue', s.final_value, 'daysSinceSale', EXTRACT(DAY FROM now() - s.created_at)::int),
    now()
  FROM sales s
  JOIN customers c ON c.id = s.customer_id
  WHERE s.payment_status NOT IN ('canceled', 'cancelled')
    AND s.created_at < now() - INTERVAL '3 days'
    AND NOT EXISTS (SELECT 1 FROM appointments ap WHERE ap.customer_id = s.customer_id AND ap.start_at > s.created_at)
    AND NOT EXISTS (SELECT 1 FROM notification_events e WHERE e.company_id = s.company_id
      AND e.dedup_key = 'sale_no_followup:' || s.id AND e.resolved_at IS NULL)
  ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;

  -- 5.7 customer_at_risk: cliente ativo, já comprou antes, sem venda nos últimos 30 dias
  INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
  SELECT gen_random_uuid(), c.company_id, 'customer_at_risk', 'customer', c.id::text,
    'customer_at_risk:' || c.id::text,
    jsonb_build_object('customerId', c.id, 'customerName', c.full_name,
      'daysSinceLastSale', EXTRACT(DAY FROM now() - ls.last_sale_at)::int,
      'lifetimeValue', ls.lifetime_value, 'sellerId', ls.last_seller_id),
    now()
  FROM customers c
  CROSS JOIN LATERAL (
    SELECT MAX(s.created_at) AS last_sale_at, SUM(s.final_value) AS lifetime_value,
           (ARRAY_AGG(s.seller_id ORDER BY s.created_at DESC))[1] AS last_seller_id
    FROM sales s WHERE s.customer_id = c.id
  ) ls
  WHERE c.is_active = true
    AND ls.last_sale_at IS NOT NULL
    AND ls.last_sale_at < now() - INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM notification_events e WHERE e.company_id = c.company_id
      AND e.dedup_key = 'customer_at_risk:' || c.id::text AND e.resolved_at IS NULL)
  ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;

  -- 5.8 payment_receivable_due: pendente, vence em até 3 dias (ou já atrasado)
  INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
  SELECT gen_random_uuid(), r.company_id, 'payment_receivable_due', 'account_receivable', r.id,
    'payment_receivable_due:' || r.id,
    jsonb_build_object('receivableId', r.id, 'customerId', r.customer_id, 'customerName', c.full_name,
      'amount', r.amount, 'dueDate', r.due_date, 'daysUntilDue', EXTRACT(DAY FROM r.due_date - now())::int),
    now()
  FROM account_receivables r
  JOIN customers c ON c.id = r.customer_id
  WHERE r.status = 'pending'
    AND r.due_date <= now() + INTERVAL '3 days'
    AND NOT EXISTS (SELECT 1 FROM notification_events e WHERE e.company_id = r.company_id
      AND e.dedup_key = 'payment_receivable_due:' || r.id AND e.resolved_at IS NULL)
  ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;

  -- 5.9 payment_payable_due: pendente, vence em até 3 dias (ou já atrasado)
  INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
  SELECT gen_random_uuid(), p.company_id, 'payment_payable_due', 'account_payable', p.id,
    'payment_payable_due:' || p.id,
    jsonb_build_object('payableId', p.id, 'supplierName', s.name, 'purchaseId', p.purchase_id,
      'amount', p.amount, 'dueDate', p.due_date, 'daysUntilDue', EXTRACT(DAY FROM p.due_date - now())::int),
    now()
  FROM account_payables p
  LEFT JOIN suppliers s ON s.id = p.supplier_id
  WHERE p.status = 'pending'
    AND p.due_date <= now() + INTERVAL '3 days'
    AND NOT EXISTS (SELECT 1 FROM notification_events e WHERE e.company_id = p.company_id
      AND e.dedup_key = 'payment_payable_due:' || p.id AND e.resolved_at IS NULL)
  ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;

  -- 5.10 low_stock: ativo, quantidade atual <= mínima
  INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
  SELECT gen_random_uuid(), pr.company_id, 'low_stock', 'product', pr.id::text,
    'low_stock:' || pr.id::text,
    jsonb_build_object('productId', pr.id, 'productName', pr.name, 'sku', pr.sku,
      'currentQuantity', pr.current_quantity, 'minQuantity', pr.min_quantity),
    now()
  FROM products pr
  WHERE pr.is_active = true
    AND pr.current_quantity <= pr.min_quantity
    AND NOT EXISTS (SELECT 1 FROM notification_events e WHERE e.company_id = pr.company_id
      AND e.dedup_key = 'low_stock:' || pr.id::text AND e.resolved_at IS NULL)
  ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;

  SELECT COUNT(*) INTO v_count FROM notification_events WHERE created_at >= v_started_at;
  RETURN v_count;
END;
$$;

-- =========================================================================
-- 6. team_event_created — via trigger (não via scanner periódico)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_team_event_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL AND NEW.created_by <> NEW.assigned_user_id THEN
    INSERT INTO notification_events (id, company_id, event_type, entity_type, entity_id, dedup_key, payload, detected_at)
    SELECT gen_random_uuid(), NEW.company_id, 'team_event_created', 'appointment', NEW.id::text,
      'team_event_created:' || NEW.id::text,
      jsonb_build_object('title', NEW.title, 'startAt', NEW.start_at, 'assignedUserId', NEW.assigned_user_id,
        'createdBy', NEW.created_by, 'createdByName', (SELECT name FROM profiles WHERE id = NEW.created_by)),
      now()
    ON CONFLICT (company_id, dedup_key) WHERE resolved_at IS NULL DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_team_event_created ON appointments;
CREATE TRIGGER trg_appointments_team_event_created
AFTER INSERT ON appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_team_event_created();

-- =========================================================================
-- 7. Fan-out: event -> notifications (por destinatário) + deliveries (por canal)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.fanout_notification_events()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event RECORD;
  v_recipient RECORD;
  v_content RECORD;
  v_prefs RECORD;
  v_company_settings RECORD;
  v_rule RECORD;
  v_notification_id UUID;
  v_channels TEXT[];
  v_created INTEGER := 0;
  v_cooldown_minutes INTEGER;
  v_last_notified TIMESTAMPTZ;
  v_quiet_now BOOLEAN;
  v_timezone TEXT;
BEGIN
  FOR v_event IN
    SELECT * FROM notification_events WHERE processed_at IS NULL ORDER BY detected_at ASC LIMIT 500
  LOOP
    SELECT * INTO v_rule FROM notification_rules
      WHERE company_id = v_event.company_id AND event_type = v_event.event_type;

    IF v_rule.id IS NOT NULL AND NOT v_rule.is_active THEN
      UPDATE notification_events SET processed_at = now() WHERE id = v_event.id;
      CONTINUE;
    END IF;

    v_cooldown_minutes := COALESCE(v_rule.cooldown_minutes, 1440);

    SELECT * INTO v_company_settings FROM company_settings WHERE company_id = v_event.company_id;
    v_timezone := COALESCE(v_company_settings.timezone, 'America/Sao_Paulo');

    SELECT * INTO v_content FROM build_notification_content(v_event.event_type, v_event.payload);
    IF v_rule.default_priority IS NOT NULL THEN
      v_content.base_priority := v_rule.default_priority;
    END IF;

    -- Estratégia de destinatário por event_type: financeiro -> admin/gerente;
    -- estoque -> todos da empresa; demais -> usuário fixo indicado no payload
    -- (assignedUserId/ownerId/sellerId, nesta ordem de precedência).
    FOR v_recipient IN
      SELECT p.id AS user_id FROM profiles p
      WHERE p.company_id = v_event.company_id
        AND (
          (v_event.event_type IN ('payment_receivable_due', 'payment_payable_due') AND p.role IN ('admin', 'manager'))
          OR (v_event.event_type = 'low_stock')
          OR (v_event.event_type NOT IN ('payment_receivable_due', 'payment_payable_due', 'low_stock')
              AND p.id = COALESCE(
                    (v_event.payload->>'assignedUserId')::uuid,
                    (v_event.payload->>'ownerId')::uuid,
                    (v_event.payload->>'sellerId')::uuid
                  ))
        )
    LOOP
      SELECT * INTO v_prefs FROM notification_preferences WHERE user_id = v_recipient.user_id;

      IF v_prefs.id IS NOT NULL AND NOT (v_content.category = ANY (v_prefs.categories_enabled)) THEN
        CONTINUE;
      END IF;

      SELECT MAX(n.created_at) INTO v_last_notified
        FROM notifications n
        WHERE n.recipient_user_id = v_recipient.user_id
          AND n.event_type = v_event.event_type
          AND n.related_entity_id = v_event.entity_id
          AND n.created_at > now() - (v_cooldown_minutes || ' minutes')::interval;

      IF v_last_notified IS NOT NULL THEN
        CONTINUE;
      END IF;

      v_channels := ARRAY[]::TEXT[];

      IF COALESCE(v_company_settings.push_notifications, true)
         AND COALESCE(v_prefs.push_enabled, true)
         AND COALESCE(v_prefs.consent_push, false)
         AND priority_rank(v_content.base_priority) >= priority_rank(COALESCE(v_prefs.min_priority_push, 'baixa'))
      THEN
        v_channels := v_channels || 'push';
      END IF;

      IF COALESCE(v_company_settings.email_notifications, true)
         AND COALESCE(v_prefs.email_enabled, true)
         AND COALESCE(v_prefs.consent_email, true)
         AND priority_rank(v_content.base_priority) >= priority_rank(COALESCE(v_prefs.min_priority_email, 'media'))
      THEN
        v_channels := v_channels || (CASE WHEN COALESCE(v_prefs.digest_frequency, 'immediate') = 'immediate' THEN 'email' ELSE 'email_digest' END);
      END IF;

      IF COALESCE(v_company_settings.sms_notifications, false)
         AND COALESCE(v_prefs.sms_enabled, false)
         AND COALESCE(v_prefs.consent_sms, false)
         AND COALESCE(v_prefs.phone, '') <> ''
         AND priority_rank(v_content.base_priority) >= priority_rank(COALESCE(v_prefs.min_priority_sms, 'critica'))
      THEN
        v_channels := v_channels || 'sms';
      END IF;

      -- A notificação in-app é sempre criada (a Central nunca perde um evento),
      -- mesmo que nenhum canal externo esteja habilitado.
      v_notification_id := gen_random_uuid();

      INSERT INTO notifications (
        id, company_id, event_id, recipient_user_id, category, event_type, priority,
        title, message, ai_summary, ai_priority_reason, ai_suggested_action,
        ai_suggested_deadline, ai_suggested_message, related_entity_type, related_entity_id,
        channels, created_at
      ) VALUES (
        v_notification_id, v_event.company_id, v_event.id, v_recipient.user_id, v_content.category, v_event.event_type,
        v_content.base_priority, v_content.title, v_content.message, v_content.ai_summary, v_content.ai_priority_reason,
        v_content.ai_suggested_action, v_content.ai_suggested_deadline, v_content.ai_suggested_message,
        v_event.entity_type, v_event.entity_id, v_channels, now()
      );

      v_created := v_created + 1;

      v_quiet_now := v_prefs.id IS NOT NULL AND public.is_within_quiet_hours(v_prefs.quiet_hours_start, v_prefs.quiet_hours_end, v_timezone);

      IF array_length(v_channels, 1) > 0 THEN
        INSERT INTO notification_deliveries (id, company_id, notification_id, recipient_user_id, channel, status, next_retry_at)
        SELECT gen_random_uuid(), v_event.company_id, v_notification_id, v_recipient.user_id, ch, 'queued',
               CASE WHEN v_quiet_now THEN public.next_quiet_hours_end(v_prefs.quiet_hours_end, v_timezone) ELSE now() END
        FROM unnest(v_channels) AS ch
        ON CONFLICT (notification_id, channel) DO NOTHING;
      END IF;
    END LOOP;

    UPDATE notification_events SET processed_at = now() WHERE id = v_event.id;
  END LOOP;

  RETURN v_created;
END;
$$;

-- =========================================================================
-- 8. Agendamento (pg_cron) — detecção + fan-out a cada 15 minutos
-- =========================================================================
-- O envio efetivo (push/e-mail/SMS via Edge Function) é agendado em uma
-- migration separada, depois do deploy da função (ver
-- 20260706123000_notifications_delivery_cron.sql) — pg_net/vault não fazem
-- sentido antes de a função existir.
CREATE OR REPLACE FUNCTION public.run_notification_pipeline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.generate_notification_events();
  PERFORM public.fanout_notification_events();
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notification-pipeline') THEN
    PERFORM cron.unschedule('notification-pipeline');
  END IF;
END $$;

SELECT cron.schedule('notification-pipeline', '*/15 * * * *', 'SELECT public.run_notification_pipeline();');

-- =========================================================================
-- 9. Templates padrão (globais, company_id NULL)
-- =========================================================================
INSERT INTO notification_templates (id, company_id, event_type, channel, name, subject_template, body_template, is_active)
VALUES
  (gen_random_uuid(), NULL, NULL, 'email', 'Notificação padrão (e-mail)',
   '[{{priorityLabel}}] {{title}}',
   '<!doctype html><html><body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;">' ||
   '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0;">' ||
   '<tr><td align="center"><table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;">' ||
   '<tr><td style="background:linear-gradient(135deg,#0B2551,#00d2ff);padding:20px 28px;"><span style="color:#ffffff;font-size:18px;font-weight:bold;">Gestly · {{companyName}}</span></td></tr>' ||
   '<tr><td style="padding:28px;"><p style="margin:0 0 12px;color:#111827;font-size:16px;font-weight:bold;">{{title}}</p>' ||
   '<p style="margin:0 0 16px;color:#374151;font-size:14px;line-height:1.6;">{{message}}</p>' ||
   '<p style="margin:0 0 20px;color:#6b7280;font-size:13px;line-height:1.6;background:#f8fafc;border-radius:8px;padding:12px;">{{summary}}</p>' ||
   '<a href="{{link}}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:bold;">Ver na Central de Notificações</a>' ||
   '</td></tr><tr><td style="padding:16px 28px;background:#f8fafc;"><p style="margin:0;color:#9ca3af;font-size:11px;">Você recebeu este e-mail porque está inscrito em notificações de {{categoryLabel}} no SobControle. Ajuste suas preferências na Central de Notificações.</p></td></tr>' ||
   '</table></td></tr></table></body></html>',
   true),
  (gen_random_uuid(), NULL, NULL, 'sms', 'Notificação padrão (SMS)',
   NULL, 'SobControle: {{title}} - {{message}} Detalhes: {{link}}', true),
  (gen_random_uuid(), NULL, NULL, 'push', 'Notificação padrão (push)',
   NULL, '{{title}}|{{message}}', true)
ON CONFLICT DO NOTHING;
