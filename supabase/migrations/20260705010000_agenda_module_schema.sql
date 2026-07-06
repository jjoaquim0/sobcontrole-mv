-- Story 1.4 — Agenda / Calendário
-- Cria a tabela appointments (compromissos: reunião, tarefa, ligação, visita,
-- lembrete), usada tanto para atividades comerciais (vinculadas a customers/
-- deals) quanto operacionais leves (sem vínculo), com RLS multi-tenant
-- espelhando o padrão das demais tabelas do schema (company_id =
-- get_user_company_id()).
--
-- customer_id/deal_id são opcionais (ON DELETE SET NULL) porque um
-- compromisso pode ser puramente operacional (ex.: lembrete interno) sem
-- cliente ou negócio relacionado. assigned_user_id (responsável) é
-- obrigatório (ON DELETE RESTRICT) pois todo compromisso deve aparecer na
-- agenda de alguém.

CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    assigned_user_id UUID REFERENCES profiles(id) ON DELETE RESTRICT NOT NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    type TEXT NOT NULL DEFAULT 'reuniao',
    status TEXT NOT NULL DEFAULT 'agendado',
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

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total dos membros da empresa aos compromissos" ON appointments
FOR ALL USING (company_id = get_user_company_id());

REVOKE ALL ON appointments FROM anon;
