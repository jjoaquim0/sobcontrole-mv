-- Story 1.58, D16 (adendo de 2026-08-26 a docs/architecture/ai-document-ingestion-p3.md,
-- seção "D16 — QO-8"). Pedido em .aiox/briefs/cistern-migrations-1.59-e-d16.md, Tarefa B.
--
-- O achado: apply_boleto_payable_proposal usa payload.payable.amount/due_date direto no
-- INSERT de account_payables, sem comparar com idempotency_key (a linha digitável
-- protegida). payload tem GRANT UPDATE para authenticated (mesmo grant do autosave da
-- tela) e idempotency_key só tem SELECT — um payload editado depois da criação da
-- proposta (autosave legítimo antes da UI travar os campos, cliente adulterado, ou
-- chamada direta ao Postgrest com o grant que já existe) diverge de idempotency_key sem
-- que a RPC perceba. Confirmado por pg_get_functiondef nesta sessão, linha a linha, antes
-- de escrever: a versão remota de apply_boleto_payable_proposal usa exatamente
-- (v_payable ->> 'amount')::NUMERIC e (v_payable ->> 'due_date')::TIMESTAMPTZ sem
-- nenhuma comparação. information_schema.column_privileges confirmou: payload tem
-- UPDATE para authenticated; idempotency_key só tem SELECT.
--
-- Decisão de forma (a @architect mapeou duas, sem escolher — decisão é minha):
--
--   (a) Recalcular em plpgsql dentro da própria RPC, a partir de idempotency_key.
--   (b) Coluna nova protegida, escrita pela Edge Function, fora do GRANT UPDATE do
--       cliente.
--
-- ESCOLHIDA: (a), inteiramente dentro da RPC — não (b). (b) exigiria a Edge Function do
-- boleto (D12 da Story 1.58) escrever essa coluna nova no momento da criação da proposta;
-- essa Edge Function AINDA NÃO EXISTE (D12 é tarefa do @dev, story ainda não
-- implementada) — migration que criasse a coluna hoje deixaria uma dependência não
-- decidida sobre um contrato de persistência que não é meu para fixar sozinha. (a) não
-- toca Edge Function, não cria coluna, não muda contrato de persistência nem AC nenhum:
-- fica inteiramente dentro do que este brief autoriza sem escalar.
--
-- IMPORTANTE — (a) NÃO é "recalcular e escolher uma era", é "validar contra as DUAS eras
-- sem escolher": a @architect (e o layout de D14/QO-3 da Story 1.58) descreve COMO
-- decodificar fator→data em cada era, mas não em lugar nenhum deste repositório decide
-- COMO desempatar qual das duas eras vale para uma linha específica (o próprio adendo
-- registra que "boletos das duas eras circulam ao mesmo tempo" hoje). Inventar essa
-- heurística de desempate aqui seria decidir uma peça do algoritmo do parser (D14) sem
-- que @architect/@dev tenham decidido — exatamente o tipo de invenção que o Artigo IV da
-- Constitution proíbe, e o pior lugar possível para inventar: R8 é "data plausível, porém
-- errada, sem levantar exceção". Por isso a defesa desta migration NÃO recalcula "a"
-- data: ela calcula as DUAS datas candidatas (era original e era reiniciada — aritmética
-- linear, sem ambiguidade nenhuma cada uma isolada) e aceita o due_date do payload se ele
-- bater com QUALQUER uma das duas; do contrário, rejeita a proposta inteira. Isso fecha o
-- vetor real (payload divergindo de qualquer decodificação legítima da linha) sem exigir
-- que esta migration decida, sozinha, qual era um dado boleto específico usa — decisão
-- que continua sendo do parser (TypeScript, @dev) quando D12 for implementado, sem risco
-- de esta RPC discordar dele por ter inventado sua própria heurística de era. amount não
-- tem essa ambiguidade (é direto, sem era) e é validado por igualdade simples.
--
-- Validado por leitura pura (SELECT sem tocar tabela nenhuma), nesta sessão, contra as
-- duas Fixtures A/B da Story 1.58 (docs/stories/1.58.boleto-linha-digitavel.story.md,
-- seção D14/QO-3), antes de escrever este arquivo:
--   Fixture A (linha 00190000090001234000605678901231599260000025000): fator calculado
--   9926, valor calculado 250.00, due_original calculado 2024-12-10T00:00:00Z — bate
--   exatamente com o esperado da fixture; due_reiniciada calculado 2049-08-01 (não bate,
--   e não deveria).
--   Fixture B (linha 34190000090009876000212345678903110210000123456): fator calculado
--   1021, valor calculado 1234.56, due_reiniciada calculado 2025-03-15T00:00:00Z — bate
--   exatamente; due_original calculado 2000-07-24 (não bate, e não deveria).
--   A reconstrução do código de barras de 44 posições a partir da linha de 47 (D14)
--   também foi conferida por igualdade de string contra o código de barras publicado nas
--   duas fixtures, e bateu nas duas.
--
-- NÃO reimplementa os três DVs de módulo 10 nem o DV geral de módulo 11 (D14/QO-3): essa
-- validação é responsabilidade do parser na criação da proposta (D12/D13, @dev, ainda não
-- implementado); idempotency_key só tem SELECT para authenticated (nunca UPDATE, conferido
-- acima), então depois de gravada pela extração ela não pode ser adulterada pelo cliente —
-- não há necessidade de reconferir o próprio formato/DV da linha aqui, só de impedir que
-- payload.payable divirja dela. Reimplementar os DVs aqui duplicaria exatamente a lógica
-- financeira mais arriscada (a preocupação original da @architect sobre (a)) sem reduzir o
-- risco que esta migration existe para fechar. Único cuidado adicional: um guard de
-- formato (regexp 47 dígitos) antes de qualquer substr(), para falhar com mensagem clara
-- em vez de erro de cast se idempotency_key não estiver no formato esperado.
--
-- Risco de regressão medido por leitura, nesta sessão: document_import_proposals tem 0
-- linhas hoje (mesma contagem já usada na Tarefa A) — nenhuma proposta de boleto existe
-- para esta validação rejeitar retroativamente. account_payables = 3, nenhuma com
-- payment_method = 'bank_slip' (a rota de boleto ainda não foi implementada por @dev) —
-- nenhum dado legítimo de produção é alcançado por esta mudança.
--
-- Reconciliação de versão — passo padrão agora, não conserto pontual (ver §10.4 de
-- docs/data/document-import-proposals-schema.md): apply_migration não aceita versão
-- explícita e gera a própria a partir do momento da chamada. Quem aplicar esta migration
-- DEVE, no mesmo relatório de verificação pós-aplicação, comparar list_migrations/
-- schema_migrations contra o nome deste arquivo e, se divergir, renomear os arquivos
-- locais (migration + rollback) para bater com a versão registrada.
--
-- Mesma assinatura, mesmo SECURITY INVOKER (implícito), preservando o resto do corpo
-- (autenticação, busca da proposta, fornecedor, transição de status) sem alteração. NÃO
-- edita nenhuma migration já aplicada. NÃO APLICADA por quem escreveu: sem apply_migration,
-- sem db push, sem migration repair. Autorização de aplicação é do usuário, uma migration
-- por vez, levada pelo @aiox-master.

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
  v_due_original TIMESTAMPTZ;
  v_due_reiniciada TIMESTAMPTZ;
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

  -- D16 (adendo 2026-08-26, seção D16): payload.payable é editável por authenticated;
  -- idempotency_key (a linha digitável canônica, D13) só tem SELECT para authenticated e é
  -- a fonte independentemente verificável de amount/due_date (D14). A defesa abaixo não
  -- escolhe uma era — calcula as duas datas candidatas e aceita o due_date do payload se
  -- ele bater com qualquer uma delas; do contrário rejeita a proposta inteira, no mesmo
  -- padrão de falha alta que os demais RAISE EXCEPTION desta função.
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

  v_amount := (v_payable ->> 'amount')::NUMERIC;
  v_due_date := (v_payable ->> 'due_date')::TIMESTAMPTZ;

  IF v_amount <> v_amount_from_line THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'valor do boleto no payload não corresponde ao valor decodificado da linha digitável';
  END IF;
  IF v_due_date <> v_due_original AND v_due_date <> v_due_reiniciada THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = 'vencimento do boleto no payload não corresponde a nenhuma decodificação válida '
        'da linha digitável (era original ou reiniciada)';
  END IF;

  INSERT INTO public.account_payables (
    id, company_id, purchase_id, supplier_id, amount, due_date, status, payment_method, description
  ) VALUES (
    'PAG-' || upper(substr(md5(gen_random_uuid()::text), 1, 7)),
    v_company_id, NULL, v_supplier_id,
    v_amount_from_line,
    CASE WHEN v_due_date = v_due_original THEN v_due_original ELSE v_due_reiniciada END,
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
  'Aplica proposta de boleto: fornecedor e conta a pagar (payment_method=bank_slip); valor/vencimento validados contra a linha digitável protegida (idempotency_key), aceitando due_date de qualquer uma das duas eras do fator (D16). SECURITY INVOKER + RLS.';

COMMIT;
