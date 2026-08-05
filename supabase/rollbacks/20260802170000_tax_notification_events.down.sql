-- Rollback — Story 1.31: eventos e regras de notificação tributária

BEGIN;

DROP TRIGGER IF EXISTS trg_seed_tax_notification_rules ON companies;
DROP FUNCTION IF EXISTS public.seed_tax_notification_rules();

DELETE FROM notification_templates
 WHERE company_id IS NULL
   AND event_type IN (
     'tax_due_soon', 'tax_ceiling_warning', 'tax_bracket_change', 'tax_sublimit_warning',
     'tax_regime_changed', 'tax_coverage_low', 'tax_assessment_pending',
     'tax_regime_option_window'
   );

DELETE FROM notification_rules
 WHERE event_type IN (
   'tax_due_soon', 'tax_ceiling_warning', 'tax_bracket_change', 'tax_sublimit_warning',
   'tax_regime_changed', 'tax_coverage_low', 'tax_assessment_pending',
   'tax_regime_option_window'
 );

-- Eventos tributários já emitidos precisam sair antes de restaurar o CHECK
-- original, senão a constraint falha na validação.
DELETE FROM notification_events
 WHERE event_type LIKE 'tax\_%';

ALTER TABLE notification_events
  DROP CONSTRAINT IF EXISTS notification_events_type_check;

ALTER TABLE notification_events
  ADD CONSTRAINT notification_events_type_check CHECK (event_type IN (
    'appointment_upcoming', 'appointment_overdue', 'deal_stale', 'proposal_expiring',
    'sale_no_followup', 'customer_at_risk', 'payment_receivable_due', 'payment_payable_due',
    'low_stock', 'sales_goal_at_risk', 'team_event_created'
  ));

COMMIT;
