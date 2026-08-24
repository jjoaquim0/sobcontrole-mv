# Brief — aplicar a migration 20260814100000 (AUTORIZADA)

**De:** Orion (`@aiox-master`) · **Para:** Cistern (`@data-engineer`) · **Data:** 2026-08-22

---

## 1. Pedido original do usuário, na íntegra

Linha de trabalho (2026-08-13):

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Desta sessão (2026-08-22):

> "pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

## 2. Objetivo e contexto

O DDL que você escreveu no commit `ec59389` está no disco e **nunca foi aplicado**. Verifiquei o banco remoto nesta sessão: a última migration aplicada é `20260805232055_email_transactional_multi_tenant`. Sem as tabelas de proposta, a Onda 2 não tem onde gravar e a funcionalidade não fica de pé hoje.

**Escopo desta tarefa:** aplicar **uma** migration e me devolver a verificação. Nada além disso.

## 3. Autorização — leia o alcance com cuidado

O usuário autorizou explicitamente, nesta sessão, a aplicação de:

**`supabase/migrations/20260814100000_document_import_proposals.sql`** — e **somente** ela.

**Não autorizado, não aplique:**
- `20260814101500_ai_usage_feature_dimension.sql` — é da Onda 6, mexe no caminho de cota do chat Gestly que roda em produção hoje. O usuário decidiu deixar para depois.
- Nenhuma outra migration pendente do repositório.

A autorização é **uma por ocorrência**. Ela não se estende a uma segunda aplicação, a um retry com conteúdo alterado, nem a qualquer push. Se precisar aplicar qualquer coisa a mais, **pare e me escale** — eu levo ao usuário.

## 4. O que fazer

1. Antes de aplicar, releia o arquivo da migration e a sua própria nota `docs/data/document-import-proposals-schema.md`, seção 5 (os comandos de verificação que você mesma deixou para a revisão humana).
2. Aplique a migration no projeto remoto.
3. Verifique o resultado com os comandos da seção 5 da sua nota, e me devolva a saída real — não o resumo.

## 5. Verificação que eu quero de volta, item por item

Não aceito "aplicada com sucesso". Quero cada um destes confirmado por comando, com a saída:

- [ ] A migration aparece na lista de migrations aplicadas do banco
- [ ] As 3 tabelas novas existem (job de extração, proposta, itens)
- [ ] RLS **habilitada** nas 3, com as políticas presentes — 3/3, não 2/3
- [ ] A trava `UNIQUE (company_id, idempotency_key)` existe e **funciona**: tentar inserir duas propostas com a mesma chave na mesma empresa deve falhar por violação de unicidade. Este é o critério falsificável que o epic pede para a Onda 1 — teste, não presuma.
- [ ] As funções `SECURITY INVOKER` estão lá, com a contagem que você registrou (13)
- [ ] **Nenhuma tabela de domínio foi alterada** — confirme que nada fora do escopo mudou
- [ ] A coluna `text_origin` (salvaguarda R10) existe

## 6. Fronteiras duras

- **Não** aplique a segunda migration. Não é esquecimento meu — é decisão do usuário.
- **Não** faça `git push`, **não** abra PR. Isso é exclusivo do `@devops` (Anchor) e exige autorização própria do usuário.
- **Não** edite arquivo de story, gate ou QA Results.
- Se a aplicação falhar no meio, **não improvise correção no banco**. Pare, me reporte o erro exato, e me diga se o rollback `supabase/rollbacks/20260814100000_document_import_proposals.down.sql` precisa ser rodado. Rodar rollback é nova autorização — pergunte, não execute.

## 7. Se o MCP do Supabase não subir no seu terminal

Aconteceu com o Forge em 2026-08-14 (`MCP startup interrupted`). Foi falha de inicialização, não configuração deliberada.

Se acontecer com você: **me avise imediatamente em vez de tentar contornar**. Não invente caminho alternativo para escrever no banco. Eu decido como proceder.

## 8. Desconfie de mim

O estado que reportei na seção 2 eu verifiquei nesta sessão, mas **confirme por conta própria** antes de aplicar. Se você achar que o banco está em estado diferente do que eu descrevi, o seu resultado vale mais que o meu — me avise antes de agir.
