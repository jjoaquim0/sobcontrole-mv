-- Módulo Contábil — remoção do teto/sublimite e do DAS de valor fixo do MEI
--
-- Decisão do produto: esses dois conjuntos de valores não foram aprovados pelo
-- contador e saem do escopo. O que permanece e continua valendo:
--   • tax_brackets            — faixas dos Anexos I a V
--   • cnae_anexo_map          — mapa CNAE -> anexo
--   • tax_regime_option_windows — datas da janela de opção (Reforma Tributária)
--   • tax_due_date_rules      — vencimento da guia do Simples
--
-- Consequência para o MEI: sem tabela de valor fixo, o regime passa a ser
-- apenas cadastrável. A apuração devolve "não calculável" com motivo próprio,
-- do mesmo modo que Lucro Presumido e Lucro Real — nunca zero silencioso.

BEGIN;

-- =========================================================================
-- 1. ALERTAS DEPENDENTES DO TETO
-- =========================================================================

DELETE FROM notification_templates
 WHERE company_id IS NULL
   AND event_type IN ('tax_ceiling_warning', 'tax_sublimit_warning');

DELETE FROM notification_rules
 WHERE event_type IN ('tax_ceiling_warning', 'tax_sublimit_warning');

-- Eventos já emitidos precisam sair antes do novo CHECK, senão a constraint
-- falha ao validar as linhas existentes.
DELETE FROM notification_events
 WHERE event_type IN ('tax_ceiling_warning', 'tax_sublimit_warning');

ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_type_check CHECK (event_type IN (
    'appointment_upcoming', 'appointment_overdue', 'deal_stale', 'proposal_expiring',
    'sale_no_followup', 'customer_at_risk', 'payment_receivable_due', 'payment_payable_due',
    'low_stock', 'sales_goal_at_risk', 'team_event_created',
    'tax_due_soon', 'tax_bracket_change', 'tax_regime_changed',
    'tax_coverage_low', 'tax_assessment_pending', 'tax_regime_option_window'
  ));

-- O seed de regras por empresa criado na 20260802170000 também não deve mais
-- distribuir as regras de teto para empresas novas.
CREATE OR REPLACE FUNCTION public.seed_tax_notification_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.notification_rules
    (id, company_id, event_type, is_active, default_priority, cooldown_minutes, threshold_value)
  SELECT gen_random_uuid(), NEW.id, rule.event_type, true, rule.priority, rule.cooldown, rule.threshold
  FROM (
    VALUES
      ('tax_due_soon',             'alta',        1440, 5),
      ('tax_bracket_change',       'media',      10080, NULL),
      ('tax_regime_changed',       'critica',     1440, NULL),
      ('tax_coverage_low',         'media',      43200, 0.70),
      ('tax_assessment_pending',   'media',      10080, NULL),
      ('tax_regime_option_window', 'critica',    10080, 30)
  ) AS rule(event_type, priority, cooldown, threshold)
  ON CONFLICT (company_id, event_type) DO NOTHING;

  RETURN NEW;
END;
$$;

-- =========================================================================
-- 2. REMOÇÃO DAS TABELAS
-- =========================================================================

DROP TABLE IF EXISTS tax_limits;
DROP TABLE IF EXISTS tax_fixed_amounts;

-- O MEI deixa de ter vencimento gerado, já que não há mais valor a recolher
-- calculado pelo sistema. A regra do Simples permanece.
DELETE FROM tax_due_date_rules WHERE regime = 'mei';

COMMIT;
