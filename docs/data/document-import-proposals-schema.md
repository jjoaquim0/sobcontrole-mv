# Nota de desenho — Tabelas de proposta da importação inteligente de documentos

**Autor:** @data-engineer (Dara) · **Data:** 2026-08-14
**Brief:** `.aiox/briefs/cistern-ddl-propostas-importacao.md`
**ADR:** `docs/architecture/ai-document-ingestion-p3.md` (Aria)
**Status:** DDL escrito, **nada aplicado no banco** (NFR-2 do ADR; ver seção "Verificação" abaixo)

Artefatos desta entrega:

| Arquivo | O quê |
|---|---|
| `supabase/migrations/20260814100000_document_import_proposals.sql` | Tabelas de job/proposta/item, RLS, RPCs de aplicação e de rejeição |
| `supabase/rollbacks/20260814100000_document_import_proposals.down.sql` | Reverte a migration acima |
| `supabase/migrations/20260814101500_ai_usage_feature_dimension.sql` | Dimensão `feature` em `ai_usage_windows`/`ai_usage_logs` — **migration separada** |
| `supabase/rollbacks/20260814101500_ai_usage_feature_dimension.down.sql` | Reverte a migration acima |

---

## 1. Visão geral do schema

```
document_extraction_jobs (1) ──< document_import_proposals (1) ──< document_import_proposal_items
        │                                  │
        └── document_version_id            └── company_id, idempotency_key (UNIQUE), payload, field_origins
```

- **`document_extraction_jobs`** — unidade assíncrona de trabalho (D1/D8 do ADR). `status`: `queued → running → (failed | done)`. Sobrevive a timeout; retry usa a mesma `idempotency_key`.
- **`document_import_proposals`** — o que foi extraído, ainda não aplicado. `status`: `pending → (applied | rejected | expired)`. `payload` (cabeçalho) e `field_origins` (proveniência por campo, D5) são JSONB — formato depende de `document_category`, documentado na seção 6.
- **`document_import_proposal_items`** — N itens por proposta (NF-e multi-item). `update_cost_decision` é a decisão por item da QA-2.

Nenhuma tabela de domínio (`purchases`, `account_payables`, `products`, `customers`, `deals`, `suppliers`) foi alterada — só recebem `INSERT`/`UPDATE` de linhas através das RPCs de aplicação, exatamente como o app já faz hoje pelo cliente.

## 2. Decisões de desenho e por quê

### 2.1 — `job.idempotency_key` nullable, `proposal.idempotency_key` `NOT NULL` + `UNIQUE`

A trava de dedup (D8) mora só na proposta, por decisão fechada do brief. O job carrega a mesma chave *quando ela já é conhecida de forma síncrona* — chave de acesso extraída do XML da NF-e, linha digitável colada pelo usuário no boleto — para permitir correlacionar retries antes de existir proposta. Para contrato, não há chave natural (tabela D8 do ADR); a proposta usa `document_version_id` como chave sintética. O job **não** tem `UNIQUE` sobre essa coluna: um reenvio legítimo do mesmo documento pode gerar um novo job (ex.: job anterior falhou), e é a proposta resultante — não o job — que barra a duplicata.

### 2.2 — `company_id` denormalizado em proposta e item

Evita join obrigatório em toda política de RLS e é o que permite a `UNIQUE (company_id, idempotency_key)` existir sem tocar `document_extraction_jobs`. Mesmo padrão já usado em `document_versions`/`document_permissions` (`documents_module` e `document_library_security.sql`).

### 2.3 — Teto de itens: `CHECK (position < 200)`, nomeado e parametrizável

Brief pediu "deixe a coluna e o CHECK parametrizáveis" porque o número real sai de protótipo (R7 do ADR: uma NF-e de 30 itens já vira 60 decisões humanas). 200 é *placeholder* generoso, não um número medido. Para mudar depois:

```sql
ALTER TABLE document_import_proposal_items
  DROP CONSTRAINT document_import_proposal_items_max_position,
  ADD CONSTRAINT document_import_proposal_items_max_position CHECK (position < <novo_valor>);
```

### 2.3a — `text_origin` (adendo 2026-08-14, salvaguarda R10)

Coluna nova em `document_import_proposals.text_origin`, `TEXT` nullable, `CHECK (text_origin IS NULL OR text_origin IN ('server', 'client'))`, adicionada à migration `20260814100000` antes de qualquer aplicação (o architect propôs no ADR — `ai-document-ingestion-p3.md:342` — supondo o schema congelado; verificado que não estava, então entrou de graça em vez de virar migration própria na onda 5). Declara de onde veio o texto que alimentou a extração — não confundir com `field_origins`, que é por campo. Fica **nula na v1**: rota XML e linha digitável de boleto não convertem texto nenhum, não há origem a declarar. Só passa a receber `'client'` a partir da onda de pdf.js no navegador (onda 5), quando o servidor recebe texto que não produziu e não pode reconferir contra o PDF guardado — é quando a tela de revisão precisa avisar o revisor disso. É atributo do **documento inteiro** (uma proposta usou um único pipeline de produção de texto), por isso mora na proposta, não no item. O rollback não precisou de edição: `DROP TABLE ... CASCADE` já reverte a coluna junto com o resto.

### 2.4 — Expiração: coluna + default, sem job agendado

Brief pediu recomendação, não bloqueou. Adicionei `expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')` e todas as RPCs de aplicação/rejeição recusam agir sobre proposta expirada. **Não implementei** o job periódico que viraria `status` para `'expired'` — isso é Edge Function/cron, fora desta entrega. Recomendação registrada na seção 8.

### 2.5 — RPC de aplicação: uma por tipo de documento, não genérica

NF-e, boleto e contrato escrevem em conjuntos de tabelas disjuntos com regras de negócio próprias (parcelas de NF-e × pagamento único de boleto × defaults de etapa/responsável do contrato — QA-3). Uma função genérica com `CASE document_category` misturaria três domínios de negócio numa função monolítica, contra o padrão já provado do projeto (uma função por read-only tool em `gestly_read_only_tools_p1.sql`). O contrato do ADR (D4) já declara `applyRpc` por tipo — isto é o espelho do lado de escrita. `reject_document_import_proposal` é a exceção: é compartilhada porque rejeitar não toca domínio nenhum, é só a outra saída do mesmo ato de UI (D3).

### 2.6 — `SECURITY INVOKER` sem checagem de papel duplicada

As RPCs de aplicação não reimplementam autorização por papel. Elas rodam como o usuário (`SECURITY INVOKER` + `auth.uid()`), então um `INSERT INTO purchases` dentro da função passa pela RLS de `purchases` exatamente como se o cliente tivesse feito o insert direto. Se a política de RLS de `purchases`/`products`/`suppliers` não permitir o papel do usuário, a instrução falha e a exceção propaga — a proposta continua `pending` (o corpo da função inteiro é uma transação). Isto é o argumento estrutural, não só estilístico, para `SECURITY INVOKER`: reaproveita autorização que já existe em vez de duplicá-la e arriscar divergência.

### 2.7 — IDs de `purchases`/`purchase_items`/`account_payables` são `TEXT`, não `UUID`

Reverifiquei em `src/services/purchaseService.ts:191` (não é suposição): essas três tabelas usam string com prefixo gerada no cliente (`CMP-`, `CMPIT-`, `PAG-` + 7 caracteres). `suppliers`, `customers`, `products`, `deals` usam `UUID` (`crypto.randomUUID()` em `supplierService.ts`, `customerService.ts`, `dealsService.ts`). A RPC de aplicação reproduz o mesmo formato de ID no servidor (`'CMP-' || upper(substr(md5(gen_random_uuid()::text), 1, 7))`) — mesmo estilo, não porque o app exija esse algoritmo exato, só para não introduzir dois formatos de ID na mesma tabela.

### 2.8 — Helpers `resolve_or_create_supplier`/`resolve_or_create_customer` expostos a `authenticated`

São `SECURITY INVOKER` chamados de dentro de outra `SECURITY INVOKER` — o Postgres exige que o *chamador original* (o usuário autenticado, não a função) tenha `EXECUTE` na função aninhada, então não dá para deixá-los "privados". Isso não abre privilégio novo: `suppliers` e `customers` já são graváveis diretamente pelo usuário via RLS hoje (insert direto em `supplierService.ts`/`customerService.ts`, sem RPC gate nenhuma). Verifiquei isso antes de decidir — não assumi.

### 2.9 — Novo produto na RPC de NF-e: exige dados completos, nunca inventa

`Product.categoryId` e `Product.salePrice` são obrigatórios (`src/types/index.ts:248-265`) e nenhum dos dois é extraível de uma nota de **compra** (categoria e preço de venda são decisão comercial, não dado fiscal). Quando um item não casa por GTIN/barcode, a RPC **exige** `new_product_category_id`, `new_product_name`, `new_product_unit` e `new_product_sale_price` no payload do item e lança exceção clara se algum faltar — nunca aplica um default inventado (Artigo IV). Isso empurra a coleta desses campos para a tela de revisão, que é território da Uma, não meu.

## 3. O que decidi CONTRA

- **Contra RLS por trigger para travar transição de status.** Cheguei a considerar um `BEFORE UPDATE` que comparasse `OLD.status`/`NEW.status` para permitir só `pending → rejected` via update direto do cliente. Descartei: a combinação já usada no projeto (`GRANT UPDATE (colunas específicas)` + RLS `USING/WITH CHECK status = 'pending'`) já impede o cliente de sequer tentar mudar `status` — a coluna nem está no `GRANT`. Um trigger a mais seria redundante e mais uma coisa para manter sincronizada com a lista de colunas do `GRANT`.
- **Contra enum nativo Postgres.** O projeto inteiro usa `TEXT + CHECK` (`ai_usage_logs.status`, `documents.visibility`, `account_payables.status`, etc.). Segui o padrão — troquei consistência por nada.
- **Contra auditoria de aplicação nesta entrega.** O ADR lista "Quota por feature e **auditoria**" como passo 6 da sequência sugerida, depois da rota XML, da UI e da rota de boleto — não passo 1. Não criei `document_import_audit_events` nem instrumentei as RPCs para logar (ao contrário de `document_audit_events`, que o módulo de documentos já tem). Registrado como recomendação (seção 8), não implementado por conta própria.
- **Contra atualizar `updated_at` do item ao trocar `matched_product_id` dentro da RPC de aplicação.** A RPC já faz isso via `UPDATE ... SET matched_product_id = ...` sem tocar `updated_at` manualmente — o trigger `trg_document_import_proposal_items_updated_at` cuida disso sozinho. Não dupliquei a lógica.

## 4. A dimensão `feature` — a comparação pedida

A seção 5 do brief pedia para eu não decidir sozinha caso concluísse que `feature` não vale o risco agora, e trazer a comparação. **Eu implementei** (não estou escalando uma alternativa), mas há uma tensão real que registro para vocês decidirem o *timing* de aplicar, não o desenho:

**O próprio ADR (seção "Sequência sugerida") não coloca `feature` no passo 1:**

```
1. Tabelas de proposta e RPCs de aplicação        ← esta entrega
2. Rota XML de NF-e
3. UI de revisão e confirmação
4. Rota linha digitável de boleto
5. Rota PDF
6. Quota por feature e auditoria                   ← aqui
7. Contrato/proposta comercial
8. Extrato
```

Ou seja: nenhum caminho de extração vai existir antes do passo 2, e nada consome quota de IA antes disso. Tecnicamente, `feature` só passa a ter efeito prático quando uma Edge Function de importação começar a chamar `reserve_ai_usage` com `p_feature='document_import'` — o que só acontece a partir do passo 2+.

**Por que entreguei mesmo assim, em vez de escalar "não fazer agora":**

1. **Nada disto é aplicado.** O risco de produção só existe no momento do `apply_migration`/`db push`, que exige autorização humana explícita, uma a uma (seção 7 do brief). Escrever a migration agora não antecipa risco nenhum — só antecipa trabalho de revisão.
2. **Separar em migration própria já resolve o problema real**, que é acoplamento de aprovação: vocês podem aplicar `20260814100000` (tabelas de proposta, risco zero de regressão) sem aplicar `20260814101500` (toca `reserve_ai_usage` em produção) até o passo 2+ estar perto de existir.
3. **Reescrever depois, sob pressão de cronograma, é o cenário mais arriscado**, não o mais seguro — a pessoa que mexer em `reserve_ai_usage` no futuro herda os três fatos encadeados da seção 5 goela abaixo, sem o tempo de investigação que eu tive agora.

**O que eu recomendo:** apliquem `20260814100000` quando forem começar o passo 2. Segurem `20260814101500` até estarem perto do passo 6 (ou adiantem, mas com o protocolo de verificação da seção 5 abaixo seguido à risca, em banco descartável, antes de produção). Isso é uma recomendação de sequenciamento de aplicação, não de desenho — o DDL da migration de `feature` está completo e revisável hoje.

### 4.1 — O que a reescrita de `reserve_ai_usage` cobre (os três fatos)

- **Fato 1** (definição viva ≠ repositório): a migration reescreve `reserve_ai_usage` por **texto literal completo** via `CREATE OR REPLACE`, preservando o `ON CONFLICT DO NOTHING` genérico que `20260725123000_fix_ai_usage_conflict.sql` introduziu em runtime — não usei `pg_get_functiondef`/`EXECUTE` para gerar a nova versão, então não herdo o mesmo tipo de risco daquela técnica.
- **Fato 2/3** (conflito calado + `SELECT`/`UPDATE` sem `feature` no filtro): toda leitura e escrita de `ai_usage_windows` dentro de `reserve_ai_usage` e `finalize_ai_usage` ganhou `AND ... feature = ...` explícito. Sem isso, um `UPDATE` sem filtro de `feature` teria incrementado o contador de chat **e** de import juntos a cada chamada — não só lido a linha errada, como also inflado as duas.

### 4.2 — Assinatura: por que `p_feature TEXT DEFAULT 'chat'` e não `ALTER` de coluna

Postgres não troca a lista de parâmetros de uma função via `CREATE OR REPLACE` — teria criado uma segunda função em overload, deixando a `reserve_ai_usage(uuid,uuid,integer)` original viva e **sem** consciência de `feature` ao lado da nova. Por isso a migration faz `DROP FUNCTION` + `CREATE FUNCTION` com a assinatura de 4 parâmetros, o último com `DEFAULT 'chat'`.

Isso importa para a fronteira do brief (**não posso tocar `supabase/functions/`**): a chamada existente do Edge Function do chat usa notação nomeada via PostgREST (`p_user_id => ..., p_request_id => ..., p_estimated_input_tokens => ...`), que resolve contra a nova assinatura de 4 parâmetros preenchendo `p_feature` pelo default — **sem precisar editar o Edge Function**. Verifiquei esse comportamento (chamada nomeada com parâmetro faltante resolvendo por `DEFAULT`) como propriedade padrão de PostgreSQL/PostgREST, não assumi.

**Dependência que fica registrada para quem implementar a Edge Function de importação (passo 2+):** ela precisa passar `p_feature='document_import'` explicitamente na chamada a `reserve_ai_usage`. Se chamar sem esse parâmetro, cai no default `'chat'` e volta a consumir a janela do chat — silenciosamente, do jeito que esta migration inteira existe para evitar. Isso não é um bug da migration; é um contrato que o próximo agente a mexer no Edge Function precisa conhecer.

### 4.3 — Limites: mesmo teto para as duas features, isolado por janela

`document_import` usa os mesmos `company_request_limit`/`company_token_limit`/`company_cost_limit_micros` de `ai_global_settings`/`ai_company_settings` que o chat usa — cada feature com sua própria janela, cada uma com direito ao teto **inteiro** (não dividido). Resolve o pedido do ADR ("importação não consome a janela do chat") sem inventar colunas de limite por feature. Se no futuro for necessário um teto **menor** para import do que para chat, isso exige nova migration em `ai_global_settings`/`ai_company_settings` — fora deste escopo, registrado na seção 8.

## 5. Verificação antes de aplicar (eu não posso rodar isto — NFR-2)

Análise estática: li os dois arquivos por inteiro, contei pares de `$$` (7 na migration 1, 3 na migration 2 e no rollback — batem com o número de corpos de função + blocos `DO $$`), confirmei que nenhum `ALTER TABLE` toca `purchases`/`account_payables`/`products`/`customers`/`deals`/`suppliers`, e revisei manualmente balanceamento de `BEGIN`/`END`/parênteses. **Não tenho banco descartável neste ambiente** (sem `psql`, `docker` ou `supabase` CLI disponíveis — verifiquei antes de afirmar isso) — então não rodei nem `EXPLAIN`, nem uma transação de teste. Isto é uma lacuna real, não estou escondendo.

Antes de aplicar `20260814101500_ai_usage_feature_dimension.sql` em qualquer ambiente:

1. `SELECT pg_get_functiondef('public.reserve_ai_usage(uuid,uuid,integer)'::regprocedure);` — confirmar que a definição viva bate com a base que reproduzi (20260725120000 + o patch do Fato 1) antes de assumir que o `CREATE OR REPLACE`/`DROP+CREATE` está substituindo o que eu penso.
2. Em transação de teste com `ROLLBACK` no final: chamar `reserve_ai_usage` uma vez com `p_feature` no default (`'chat'`) e uma vez com `p_feature='document_import'`, mesmo usuário/empresa, mesma janela. Esperado: **duas** linhas em `ai_usage_windows` por escopo (`company` e `user`), uma por feature, cada uma com `request_count = 1` — não uma linha só com `request_count = 2`.
3. Chamar `finalize_ai_usage` para as duas e conferir, por `rowcount`, que cada `UPDATE` mexeu numa única linha — "não deu erro" não é validação aqui (seção 9 do brief: a falha desta área é silenciosa por construção).

Antes de aplicar `20260814100000_document_import_proposals.sql`: menor risco (tabelas novas, nada referencia ainda), mas recomendo pelo menos `\d document_import_proposals` após aplicar em ambiente de teste para conferir que as `CHECK` e a `UNIQUE` vieram como esperado.

## 6. Contratos de payload (para quem escrever a Edge Function e a UI)

Formato esperado de `document_import_proposals.payload`, por `document_category`. Isto **não** é o JSON Schema formal do contrato de extração (D4 do ADR — isso é responsabilidade de quem implementar `document-extraction`); é o contrato mínimo que as RPCs de aplicação desta entrega leem.

**`nota_fiscal`:**
```json
{
  "supplier": { "document": "CNPJ", "name": "...", "email": "...", "phone": "..." },
  "purchase": {
    "total_amount": 0, "discount": 0, "fee": 0, "final_value": 0,
    "payment_method": "...", "notes": "...",
    "installments": [ { "amount": 0, "due_date": "2026-09-01T00:00:00Z" } ]
  }
}
```
Item (`document_import_proposal_items.payload`):
```json
{
  "quantity": 0, "document_unit_cost": 0, "barcode": "...",
  "new_product_category_id": "uuid", "new_product_name": "...",
  "new_product_unit": "...", "new_product_sale_price": 0, "sku": "..."
}
```
Os quatro campos `new_product_*` só são obrigatórios quando o item **não** casa por `barcode` nem já tem `matched_product_id`.

**`boleto`:**
```json
{
  "supplier": { "document": "CNPJ", "name": "...", "email": "...", "phone": "..." },
  "payable": { "amount": 0, "due_date": "2026-09-01T00:00:00Z", "description": "..." }
}
```

**`contrato`:**
```json
{
  "customer": { "document": "CPF/CNPJ", "full_name": "...", "email": "...", "phone": "...", "address": "..." },
  "deal": {
    "title": "...", "value": 0, "stage_id": "uuid (opcional)",
    "owner_id": "uuid (opcional, default: quem confirma)",
    "expected_close_date": "2026-09-01 (opcional)", "notes": "..."
  }
}
```
`title` e `value` são obrigatórios, sem default (QA-3). `stage_id`/`owner_id` têm default definido pela RPC quando ausentes ou inválidos para a empresa.

## 7. Baselines × resultado (seção 8 do brief)

| Gate | Comando | Baseline | Resultado |
|---|---|---:|---:|
| Migrations existentes | `ls supabase/migrations/ \| wc -l` | 32 | **34** (32 + 2 novas; nenhuma existente alterada — `git status --short supabase/migrations/` mostra só as 2 novas como `??`) |
| Rollback correspondente | `ls supabase/rollbacks/ \| wc -l` | 16 | **18** (1:1 com as 2 migrations novas) |
| Tabelas do domínio alteradas | `grep "ALTER TABLE"` nos 2 arquivos novos | 0 | **0** (confirmado: todo `ALTER TABLE` mira `ai_usage_windows`/`ai_usage_logs`, nenhum em `purchases`/`account_payables`/`products`/`customers`/`deals`/`suppliers`) |
| Migrations aplicadas nesta execução | — | 0 | **0** — nenhuma ferramenta de banco foi chamada |
| Decisões de desenho registradas | esta nota | 0 | todas, com trade-off (seções 2-4) |

## 8. Recomendações fora do pedido (Artigo IV — não implementadas)

1. **Job periódico de expiração.** A coluna `expires_at` existe e as RPCs a respeitam, mas nada vira `status='expired'` sozinho. Precisa de um cron/Edge Function — fora do escopo de DDL.
2. **Auditoria de aplicação de proposta.** O ADR coloca isso no passo 6, junto com `feature`. Um `document_import_audit_events` espelhando `document_audit_events` seria natural quando chegar a hora.
3. **Limite por feature diferenciado.** Hoje `document_import` herda o teto inteiro de `ai_global_settings`/`ai_company_settings`, igual ao chat. Se uma importação de contrato de 12k tokens puder consumir o mesmo teto que o chat inteiro da empresa num dia, pode valer a pena um teto próprio — decisão de produto, não my call.
4. **`UNIQUE` em `products.barcode` por empresa.** A RPC de NF-e faz `SELECT ... WHERE barcode = ...` sem `LIMIT`/`ORDER BY` determinístico; se houver barcodes duplicados na mesma empresa (não vi nenhuma constraint que impeça isso), o casamento pega "um" produto, não necessariamente o certo. Não é o mesmo tipo de falha silenciosa da seção 5 (não é dinheiro, é vínculo de produto, revisável na tela), mas é do mesmo gênero. Registrado, não implementado — `products` é tabela de domínio fora da minha fronteira de alteração.
5. **Coluna de chave de acesso em `purchases`.** Já é recomendação da Aria no ADR (seção "Recomendações", item 1) — repito aqui só para não se perder: ajudaria auditoria fiscal, mas D8 já resolve idempotência sem isso.

## 9. O que reverifiquei do brief, e onde diverge

- **Baseline de 32 migrations / rollbacks com convenção viva:** confirmado, `ls` bate exatamente com o que o brief afirmou.
- **`registry.ts:45` lança `configuration_error` se `mode !== 'read_only'`:** confirmado, li o arquivo.
- **`ai_usage_windows` `UNIQUE` de 5 colunas em `20260725120000_ai_secure_gateway.sql:74`:** confirmado — é a linha 74 do arquivo, exatamente como o brief citou.
- **Fato 1 (reescrita em runtime de `reserve_ai_usage`):** confirmado lendo `20260725123000_fix_ai_usage_conflict.sql` por inteiro — o mecanismo é exatamente `pg_get_functiondef` + `replace()` + `EXECUTE`, como descrito.
- **Onde fui além do brief, não contra ele:** o brief não mencionou que `purchases`/`purchase_items`/`account_payables` usam ID `TEXT` com prefixo em vez de `UUID` — isso não está em nenhuma das fontes de verdade listadas na seção 4. Descobri lendo `src/services/purchaseService.ts` (leitura, não edição — respeitei a fronteira de `src/`) porque sem isso a RPC de aplicação teria gerado DDL estruturalmente incompatível com o schema vivo. Registro isso como o achado mais importante que o brief não continha.
- **Não encontrei divergência onde o brief afirmou algo que se provou errado.** As três fontes que reverifiquei bateram.
