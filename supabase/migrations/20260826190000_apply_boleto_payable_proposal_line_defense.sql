-- Story 1.58, D16 + D19 (adendos de 2026-08-26 a docs/architecture/ai-document-ingestion-p3.md,
-- seções "D16 — QO-8" e "D19 — lacuna na D14: a regra de desambiguação de era do fator de
-- vencimento"). Pedido em .aiox/briefs/cistern-migrations-1.59-e-d16.md, Tarefa B, e ajuste
-- pedido pelo @aiox-master depois de revisar a primeira versão desta migration (achado dele,
-- confirmado e fechado pela @architect em D19, commit 716e4a0).
--
-- O achado original (D16): apply_boleto_payable_proposal usa payload.payable.amount/due_date
-- direto no INSERT de account_payables, sem comparar com idempotency_key (a linha digitável
-- protegida, só SELECT para authenticated; payload tem UPDATE). Confirmado por
-- pg_get_functiondef nesta sessão antes da primeira versão desta migration.
--
-- O achado sobre a PRIMEIRA versão desta migration (D19): ela aceitava devido_date do payload
-- batendo com QUALQUER uma das duas eras do fator (original ou reiniciada), para não inventar
-- uma heurística de desempate que a D14 nunca escreveu. Isso fechava manipulação arbitrária,
-- mas não fechava o vetor real: as duas datas candidatas de um mesmo fator estão SEMPRE
-- exatamente 9000 dias uma da outra (prova por varredura completa dos 9000 fatores possíveis,
-- em D19), então um payload adulterado para a era ERRADA (mas ainda assim uma decodificação
-- matematicamente "válida" da linha) passava pela defesa — até ~24,64 anos de erro no
-- vencimento de uma conta a pagar real, sem exceção nenhuma. A @architect fechou a lacuna:
--
-- REGRA DE DESAMBIGUAÇÃO (D19): calcular as duas datas candidatas; usar a que cair dentro de
-- uma janela de plausibilidade ancorada em document_import_proposals.created_at (a mesma
-- referência que o parser TypeScript vai usar quando D12 for implementado) — 730 dias no
-- passado, 1825 no futuro (largura total 2555 dias, 28% dos 9000 de folga — garantia
-- matemática de zero ambiguidade, não heurística, comprovada por D19 varrendo os 9000
-- fatores possíveis). Se NENHUMA das duas cair na janela, rejeitar a linha inteira (mesmo
-- padrão de falha explícita do AC1 da Story 1.58). Se, por qualquer motivo, as DUAS caírem
-- na janela (não deveria acontecer com largura < 9000 dias, mas o código não presume a prova
-- e falha fechado mesmo assim), também rejeita — ambíguo não é aceitável.
--
-- A âncora TEM que ser created_at da proposta, nunca now() calculado nesta RPC: se cada lado
-- (parser na criação, RPC na aplicação, dias depois) usasse seu próprio relógio, a janela
-- deslizaria entre os dois momentos — pequeno perto de 2555 dias, mas D19 exige garantia
-- exata, não "quase sempre". created_at já é NOT NULL DEFAULT now(), sem grant de UPDATE para
-- authenticated (só payload tem), portanto imutável pelo cliente — e já vem carregada em
-- v_proposal pelo SELECT * INTO ... FOR UPDATE existente, sem custo de consulta extra.
--
-- Decisão de forma, mantida (a), com o registro do que mudou: a @architect, em D19, reforçou
-- a inclinação dela para a opção (b) (coluna nova escrita pela Edge Function, só o parser
-- implementa a regra de desambiguação, a RPC só compara) — precisamente porque manter a regra
-- só na RPC (opção a) duplica mais lógica financeira sensível (created_at-como-âncora, janela,
-- rejeição) do que uma comparação direta. Ela registrou isso como preferência mais forte, não
-- como decisão — a forma continua minha. MANTENHO (a): o motivo que me fez escolher (a) na
-- primeira versão desta migration não mudou — (b) ainda dependeria da Edge Function do boleto
-- (D12 da Story 1.58), que ainda não existe (@dev não implementou; story Ready, não
-- implementada) — e ainda escreveria fora do que este brief autoriza sem escalar (mudança de
-- Edge Function/contrato de persistência). A regra de D19 (janela de plausibilidade ancorada
-- em created_at) é aritmética de data, não módulo 10/11 — o mesmo nível de simplicidade que já
-- tinha me feito preferir (a) da primeira vez; a duplicação que a @architect pesou contra (a)
-- é real, mas não muda o limite duro deste brief: (b) segue fora de alcance enquanto D12 não
-- existir. Se (b) vier a ser preferível quando D12 for implementado, é decisão para revisitar
-- depois, com a Edge Function já existindo — não hoje.
--
-- Validado por leitura pura (SELECT sem tocar tabela nenhuma), nesta sessão, contra as duas
-- Fixtures A/B da Story 1.58, com a janela de D19 aplicada e referência de teste 2026-08-26
-- (mesma referência que a @architect usou na varredura de D19):
--   Fixture A (fator 9926): due_original 2024-12-10 cai na janela [2024-08-26, 2031-08-25];
--   due_reiniciada 2049-08-01 não cai. Resolvido = 2024-12-10 — bate com o esperado.
--   Fixture B (fator 1021): due_original 2000-07-24 não cai na janela; due_reiniciada
--   2025-03-15 cai. Resolvido = 2025-03-15 — bate com o esperado.
--   As duas fixtures resolvem com exatamente uma candidata na janela, nenhuma ambiguidade.
--
-- Risco de regressão medido por leitura, nesta sessão: document_import_proposals tem 0 linhas
-- hoje; account_payables = 3, nenhuma com payment_method = 'bank_slip'. Nenhum dado legítimo
-- de produção é alcançado por esta mudança.
--
-- Reconciliação de versão — passo padrão agora, não conserto pontual (ver §10.4 de
-- docs/data/document-import-proposals-schema.md): apply_migration não aceita versão explícita
-- e gera a própria a partir do momento da chamada. Quem aplicar esta migration DEVE, no mesmo
-- relatório de verificação pós-aplicação, comparar list_migrations/schema_migrations contra o
-- nome deste arquivo e, se divergir, renomear os arquivos locais (migration + rollback) para
-- bater com a versão registrada.
--
-- Mesma assinatura, mesmo SECURITY INVOKER (implícito), preservando o resto do corpo
-- (autenticação, busca da proposta, fornecedor, transição de status) sem alteração. NÃO edita
-- nenhuma migration já aplicada. NÃO APLICADA por quem escreveu: sem apply_migration, sem
-- db push, sem migration repair. Autorização de aplicação é do usuário, uma migration por vez,
-- levada pelo @aiox-master.

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_boleto_payable_proposal(p_proposal_id UUID)
RETURNS public.document_import_proposals
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_proposal public.document_import_proposals%ROWTYPE;
  v_company_id UUID := (SELECT public.get_user_company_id());
  v_supplier_id UUID;
  v_payable JSONB;
  v_fator INT;
  v_amount_from_line NUMERIC(14, 2);
  v_reference_date DATE;
  v_window_start TIMESTAMPTZ;
  v_window_end TIMESTAMPTZ;
  v_due_original TIMESTAMPTZ;
  v_due_reiniciada TIMESTAMPTZ;
  v_original_in_window BOOLEAN;
  v_reiniciada_in_window BOOLEAN;
  v_due_from_line TIMESTAMPTZ;
  v_amount NUMERIC;
  v_due_date TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL OR v_company_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '28000', MESSAGE = 'autenticação necessária';
  END IF;

  SELECT * INTO v_proposal
  FROM public.document_import_proposals
  WHERE id = p_proposal_id
  FOR UPDATE;

  IF NOT FOUND OR v_proposal.company_id <> v_company_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'proposta não encontrada';
  END IF;
  IF v_proposal.document_category <> 'boleto' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'proposta não é de boleto';
  END IF;
  IF v_proposal.status <> 'pending' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = format('proposta não está pendente (status atual: %s)', v_proposal.status);
  END IF;
  IF v_proposal.expires_at < now() THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'proposta expirada; solicite nova extração';
  END IF;

  v_supplier_id := public.resolve_or_create_supplier(
    v_company_id,
    v_proposal.payload #>> '{supplier,document}',
    v_proposal.payload #>> '{supplier,name}',
    v_proposal.payload #>> '{supplier,email}',
    v_proposal.payload #>> '{supplier,phone}'
  );

  v_payable := v_proposal.payload -> 'payable';
  IF v_payable IS NULL OR NOT (v_payable ? 'amount') OR NOT (v_payable ? 'due_date') THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'payload da proposta não contém valor e vencimento do boleto';
  END IF;

  -- D16 + D19: payload.payable é editável por authenticated; idempotency_key (a linha
  -- digitável canônica, D13) só tem SELECT para authenticated e é a fonte independentemente
  -- verificável de amount/due_date (D14). D19 fecha a lacuna que a primeira versão desta
  -- migration deixava aberta: as duas eras do fator produzem datas sempre 9000 dias uma da
  -- outra, e aceitar "qualquer uma" deixava passar um payload adulterado para a era errada.
  -- A âncora da janela de plausibilidade é created_at da PRÓPRIA proposta — nunca now() desta
  -- RPC — para não divergir do instante que o parser usa na criação.
  IF v_proposal.idempotency_key !~ '^[0-9]{47}$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'linha digitável da proposta não está no formato esperado (47 dígitos)';
  END IF;

  v_fator := substr(v_proposal.idempotency_key, 34, 4)::INT;
  v_amount_from_line := (substr(v_proposal.idempotency_key, 38, 10)::NUMERIC) / 100;

  -- Era original (D14): data-base 07/10/1997 + fator. Era reiniciada: 22/02/2025 +
  -- (fator - 1000). Meia-noite UTC explícita, mesmo precedente de nfe.ts:362 citado em D15.
  v_due_original := ((DATE '1997-10-07' + v_fator)::text || 'T00:00:00Z')::TIMESTAMPTZ;
  v_due_reiniciada := ((DATE '2025-02-22' + (v_fator - 1000))::text || 'T00:00:00Z')::TIMESTAMPTZ;

  -- D19: janela de plausibilidade ancorada em created_at (UTC), não em now(). 730 dias no
  -- passado, 1825 no futuro — largura 2555 dias, garantidamente menor que os 9000 dias que
  -- sempre separam as duas datas candidatas, então no máximo uma delas cai na janela.
  v_reference_date := (v_proposal.created_at AT TIME ZONE 'UTC')::DATE;
  v_window_start := ((v_reference_date - 730)::text || 'T00:00:00Z')::TIMESTAMPTZ;
  v_window_end := ((v_reference_date + 1825)::text || 'T00:00:00Z')::TIMESTAMPTZ;

  v_original_in_window := v_due_original BETWEEN v_window_start AND v_window_end;
  v_reiniciada_in_window := v_due_reiniciada BETWEEN v_window_start AND v_window_end;

  IF v_original_in_window AND NOT v_reiniciada_in_window THEN
    v_due_from_line := v_due_original;
  ELSIF v_reiniciada_in_window AND NOT v_original_in_window THEN
    v_due_from_line := v_due_reiniciada;
  ELSE
    -- Nem uma nem outra plausível (ou, por alguma inconsistência futura na largura da janela,
    -- as duas ao mesmo tempo) — falha fechado, nunca escolhe por proximidade sem faixa.
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'vencimento decodificado da linha digitável está fora da janela de '
        'plausibilidade da proposta; verifique a linha';
  END IF;

  v_amount := (v_payable ->> 'amount')::NUMERIC;
  v_due_date := (v_payable ->> 'due_date')::TIMESTAMPTZ;

  IF v_amount <> v_amount_from_line THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'valor do boleto no payload não corresponde ao valor decodificado da linha digitável';
  END IF;
  IF v_due_date <> v_due_from_line THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'vencimento do boleto no payload não corresponde ao vencimento decodificado '
        '(e desambiguado por plausibilidade) da linha digitável';
  END IF;

  INSERT INTO public.account_payables (
    id, company_id, purchase_id, supplier_id, amount, due_date, status, payment_method, description
  ) VALUES (
    'PAG-' || upper(substr(md5(gen_random_uuid()::text), 1, 7)),
    v_company_id, NULL, v_supplier_id,
    v_amount_from_line,
    v_due_from_line,
    'pending',
    'bank_slip',
    COALESCE(NULLIF(btrim(v_payable ->> 'description'), ''), 'Boleto importado')
  );

  UPDATE public.document_import_proposals
  SET status = 'applied', applied_at = now(), applied_by = auth.uid()
  WHERE id = p_proposal_id
  RETURNING * INTO v_proposal;

  RETURN v_proposal;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_boleto_payable_proposal(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_boleto_payable_proposal(UUID) TO authenticated;

COMMENT ON FUNCTION public.apply_boleto_payable_proposal(UUID) IS
  'Aplica proposta de boleto: fornecedor e conta a pagar (payment_method=bank_slip); valor/vencimento validados contra a linha digitável protegida (idempotency_key), com a era do fator desambiguada por janela de plausibilidade ancorada em created_at (D16 + D19). SECURITY INVOKER + RLS.';

COMMIT;
