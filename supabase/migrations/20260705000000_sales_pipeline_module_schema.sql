-- Story 1.3 — Kanban / Pipeline de Vendas
-- Cria as tabelas pipeline_stages (etapas do funil, por empresa), deals
-- (oportunidades/negócios) e deal_stage_history (histórico de movimentação
-- entre etapas), com RLS multi-tenant espelhando o padrão das demais
-- tabelas do schema (company_id = get_user_company_id()).
--
-- pipeline_stages.position/deals.position usam DOUBLE PRECISION (não
-- INTEGER) para permitir reordenação manual por inserção de ponto médio
-- (ex.: mover um card entre as posições 1 e 2 grava 1.5) sem precisar
-- renumerar as demais linhas da coluna a cada drag and drop.
--
-- deals.status ('open'|'won'|'lost') é independente da etapa (stage_id):
-- o board do Kanban exibe apenas negócios 'open'; marcar como Ganho/Perdido
-- fecha o negócio e o remove do board, mantendo o histórico no banco.

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

CREATE TABLE IF NOT EXISTS deal_stage_history (
    id UUID PRIMARY KEY,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    from_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    to_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE RESTRICT NOT NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total dos membros da empresa às etapas do pipeline" ON pipeline_stages
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total dos membros da empresa aos negócios" ON deals
FOR ALL USING (company_id = get_user_company_id());

CREATE POLICY "Acesso total ao histórico de negócios da empresa" ON deal_stage_history
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.deals
    WHERE deals.id = deal_stage_history.deal_id
      AND deals.company_id = get_user_company_id()
  )
);

REVOKE ALL ON pipeline_stages, deals, deal_stage_history FROM anon;

-- Seed de etapas padrão para empresas já existentes (novas empresas recebem
-- as mesmas etapas via complete_company_signup(), atualizada abaixo).
INSERT INTO pipeline_stages (id, company_id, name, color, position)
SELECT gen_random_uuid(), c.id, s.name, s.color, s.position
FROM companies c
CROSS JOIN (
  VALUES
    ('Novo Contato', '#6366f1', 0),
    ('Qualificação', '#3b82f6', 1),
    ('Proposta Enviada', '#f59e0b', 2),
    ('Negociação', '#f97316', 3),
    ('Fechamento', '#10b981', 4)
) AS s(name, color, position)
WHERE NOT EXISTS (
  SELECT 1 FROM pipeline_stages ps WHERE ps.company_id = c.id
);

-- Atualiza complete_company_signup() para também semear as 5 etapas padrão
-- do pipeline de vendas para empresas criadas a partir de agora, mantendo
-- o restante da função idêntico (RETURN QUERY/assinatura inalterados).
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
