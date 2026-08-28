-- Story 1.59 (D18 do adendo de 2026-08-26 a docs/architecture/ai-document-ingestion-p3.md,
-- seção "D18 — QO-10"). Pedido em .aiox/briefs/cistern-migrations-1.59-e-d16.md, Tarefa A.
--
-- O defeito: a unicidade de (company_id, idempotency_key) em document_import_proposals é
-- incondicional. Uma proposta 'rejected' ou 'expired' nunca vira registro de domínio, mas
-- continua ocupando a chave para sempre — reenviar o mesmo documento (NF-e desde a Story
-- 1.55, boleto na 1.58) esbarra em 23505 e o handler mapeia isso como duplicata, quando na
-- verdade não há duplicata nenhuma: só uma chave morta bloqueando uma tentativa legítima.
--
-- Verificado por leitura, nesta sessão, no projeto qxcchymwswontqcwqogm, antes de escrever:
--   - É CONSTRAINT (contype='u'), não índice solto: pg_constraint mostra
--     document_import_proposals_company_id_idempotency_key_key,
--     UNIQUE (company_id, idempotency_key), sem predicado. pg_indexes confirma o índice
--     homônimo que a sustenta. Bate com o que a Story 1.59 e o adendo da @architect
--     descrevem — não presumi, conferi.
--   - document_import_proposals tem 0 linhas hoje. Nenhum dado legítimo existente seria
--     afetado pela troca; DROP CONSTRAINT/CREATE INDEX não têm bloco de linha nenhum para
--     rejeitar ou aceitar retroativamente.
--   - handler.ts:171-180 (supabase/functions/_shared/document-import/handler.ts) trata
--     SQLSTATE 23505 de forma reativa (tenta inserir, captura o erro, mapeia para mensagem),
--     sem qualquer consulta prévia de status. Troca de índice muda QUANDO o 23505 dispara
--     (só contra proposta 'pending'/'applied' da mesma chave), não COMO o app reage a ele —
--     o catch continua funcionando sem alteração. Confirmo a leitura da @architect: esta
--     migration NÃO exige mudança em handler.ts.
--
-- A correção: trocar a UNIQUE incondicional por um índice único PARCIAL, escopado a
-- status IN ('pending', 'applied'). 'applied' PERMANECE no escopo — é o que segura o R3
-- (duplicidade de conta a pagar/compra: reenviar o mesmo documento DEPOIS de já ter virado
-- negócio real não pode criar um segundo registro de domínio). Só 'rejected' e 'expired'
-- saem da trava, porque nunca chegaram a virar domínio.
--
-- Janela de proteção durante a troca: DROP CONSTRAINT toma ACCESS EXCLUSIVE LOCK na tabela,
-- mantido até COMMIT (não uso CONCURRENTLY). Como as duas instruções (DROP CONSTRAINT e
-- CREATE UNIQUE INDEX) rodam na mesma transação BEGIN/COMMIT, qualquer INSERT/UPDATE
-- concorrente em document_import_proposals fica bloqueado esperando o lock — não passa
-- "por baixo" enquanto a troca está em andamento, e não há instante em que a tabela fique
-- sem nenhuma unicidade ativa. Se qualquer instrução do bloco falhar, o BEGIN/COMMIT reverte
-- tudo — a trava incondicional original permanece intacta, nunca fica pela metade.
--
-- CREATE INDEX (sem CONCURRENTLY) é a escolha certa aqui, não CONCURRENTLY: a tabela tem
-- 0 linhas hoje (build instantâneo, sem custo de lock prolongado a evitar) e CONCURRENTLY
-- não pode rodar dentro de transação — exigiria abrir mão do BEGIN/COMMIT único que garante
-- a ausência de janela desprotegida acima. Com 0 linhas, não há motivo para pagar essa troca.
--
-- Rollback pareado (
-- supabase/rollbacks/20260827020502_document_import_proposals_partial_unique_index.down.sql) restaura a constraint
-- UNIQUE incondicional, com o MESMO nome original — reversível sem perda de dado enquanto
-- nenhuma linha 'rejected'/'expired' tiver sido criada com uma chave já ocupada por outra
-- linha 'rejected'/'expired' da mesma empresa (ver aviso no arquivo de rollback: isso deixa
-- de ser garantido a partir do momento em que esta migration entra em uso real).
--
-- Reconciliação de versão — passo padrão agora, não conserto pontual (ver §10.4 de
-- docs/data/document-import-proposals-schema.md): apply_migration não aceita versão
-- explícita e gera a própria a partir do momento da chamada. Quem aplicar esta migration
-- DEVE, no mesmo relatório de verificação pós-aplicação, comparar list_migrations/
-- schema_migrations contra o nome deste arquivo e, se divergir, renomear os arquivos
-- locais (migration + rollback) para bater com a versão registrada — não deixar acumular
-- para descobrir depois.
--
-- NÃO edita 20260814100000, 20260825140000 nem 20260826230250 — as três já estão aplicadas
-- em produção. NÃO APLICADA por quem escreveu: sem apply_migration, sem db push, sem
-- migration repair. Autorização de aplicação é do usuário, uma migration por vez, levada
-- pelo @aiox-master.

BEGIN;

ALTER TABLE public.document_import_proposals
  DROP CONSTRAINT document_import_proposals_company_id_idempotency_key_key;

CREATE UNIQUE INDEX document_import_proposals_company_id_idempotency_key_key
  ON public.document_import_proposals (company_id, idempotency_key)
  WHERE status IN ('pending', 'applied');

COMMENT ON INDEX public.document_import_proposals_company_id_idempotency_key_key IS
  'D18 (Story 1.59): unicidade de (company_id, idempotency_key) restrita a pending/applied. rejected/expired liberam a chave para reimportação legítima; applied permanece protegido (R3).';

COMMIT;
