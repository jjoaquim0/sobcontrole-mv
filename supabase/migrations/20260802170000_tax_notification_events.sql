-- Story 1.31 — Eventos e regras de notificação tributária
--
-- Reaproveita integralmente o motor de notificações existente: fila de entrega,
-- preferências de canal, prioridade mínima, horário silencioso e frequência de
-- resumo continuam valendo. Nenhuma infraestrutura nova.
--
-- Os eventos mais valiosos aqui — teto e janela de opção — dependem apenas de
-- receita acumulada e de datas legais, não da classificação fiscal. São, por
-- isso, os alertas mais confiáveis do módulo.

BEGIN;

-- =========================================================================
-- 1. NOVOS TIPOS DE EVENTO
-- =========================================================================

ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_type_check CHECK (event_type IN (
    'appointment_upcoming', 'appointment_overdue', 'deal_stale', 'proposal_expiring',
    'sale_no_followup', 'customer_at_risk', 'payment_receivable_due', 'payment_payable_due',
    'low_stock', 'sales_goal_at_risk', 'team_event_created',
    -- Módulo tributário
    'tax_due_soon', 'tax_ceiling_warning', 'tax_bracket_change', 'tax_sublimit_warning',
    'tax_regime_changed', 'tax_coverage_low', 'tax_assessment_pending',
    'tax_regime_option_window'
  ));

-- =========================================================================
-- 2. REGRAS POR EMPRESA
-- =========================================================================

-- notification_rules exige company_id, então as regras nascem por empresa.
-- Empresas existentes recebem agora; novas recebem pelo trigger abaixo.
INSERT INTO notification_rules (id, company_id, event_type, is_active, default_priority, cooldown_minutes, threshold_value)
SELECT gen_random_uuid(), c.id, rule.event_type, true, rule.priority, rule.cooldown, rule.threshold
FROM companies AS c
CROSS JOIN (
  VALUES
    -- Vencimento próximo: 5 dias antes, cruzando com o caixa projetado.
    ('tax_due_soon',             'alta',        1440, 5),
    -- Consumo do teto: dispara a partir de 70%.
    ('tax_ceiling_warning',      'critica',    10080, 0.70),
    ('tax_bracket_change',       'media',      10080, NULL),
    ('tax_sublimit_warning',     'alta',       10080, 0.90),
    -- Mudança de regime detectada na revalidação do CNPJ.
    ('tax_regime_changed',       'critica',     1440, NULL),
    -- Cobertura de classificação abaixo de 70% degrada a estimativa.
    ('tax_coverage_low',         'media',      43200, 0.70),
    ('tax_assessment_pending',   'media',      10080, NULL),
    -- Janela legal de opção de regime (Reforma Tributária): 30 dias antes.
    ('tax_regime_option_window', 'critica',    10080, 30)
) AS rule(event_type, priority, cooldown, threshold)
ON CONFLICT (company_id, event_type) DO NOTHING;

-- Empresas criadas depois desta migration também precisam das regras.
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
      ('tax_ceiling_warning',      'critica',    10080, 0.70),
      ('tax_bracket_change',       'media',      10080, NULL),
      ('tax_sublimit_warning',     'alta',       10080, 0.90),
      ('tax_regime_changed',       'critica',     1440, NULL),
      ('tax_coverage_low',         'media',      43200, 0.70),
      ('tax_assessment_pending',   'media',      10080, NULL),
      ('tax_regime_option_window', 'critica',    10080, 30)
  ) AS rule(event_type, priority, cooldown, threshold)
  ON CONFLICT (company_id, event_type) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_tax_notification_rules ON companies;
CREATE TRIGGER trg_seed_tax_notification_rules
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_tax_notification_rules();

-- =========================================================================
-- 3. TEMPLATES GLOBAIS
-- =========================================================================

-- company_id NULL = template global, mesmo padrão dos templates existentes.
INSERT INTO notification_templates (id, company_id, event_type, channel, name, subject_template, body_template, is_active)
VALUES
  (gen_random_uuid(), NULL, 'tax_due_soon', 'email',
   '{{title}}',
   'A guia {{obligationLabel}} da competência {{referenceMonth}} vence em {{dueDate}}, no valor de {{amount}}. {{cashWarning}} Valor gerencial — confirme com o seu contador.',
   true),
  (gen_random_uuid(), NULL, 'tax_ceiling_warning', 'email',
   '{{title}}',
   'A receita acumulada de {{accumulated}} já representa {{usagePercent}} do teto de {{limit}} do seu regime. {{projectionNote}} Ultrapassar o teto causa desenquadramento retroativo — fale com o seu contador.',
   true),
  (gen_random_uuid(), NULL, 'tax_regime_option_window', 'email',
   '{{title}}',
   '{{windowDescription}} A janela vai de {{opensOn}} a {{closesOn}}, com efeitos a partir de {{effectStartsOn}}. Base legal: {{legalReference}}. Avalie com o seu contador antes do prazo.',
   true),
  (gen_random_uuid(), NULL, 'tax_regime_changed', 'email',
   '{{title}}',
   'A consulta ao cadastro da Receita indica mudança de regime tributário: {{changeDetail}}. Confirme o perfil tributário para que a apuração volte a refletir a realidade da empresa.',
   true)
ON CONFLICT DO NOTHING;

COMMENT ON FUNCTION public.seed_tax_notification_rules() IS
  'Garante que empresas criadas após a Story 1.31 também recebam as regras de notificação tributária.';

COMMIT;
