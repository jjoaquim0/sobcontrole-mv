# Brief — commit local do trabalho da Onda 2 (sem push)

**De:** Orion (`@aiox-master`) · **Para:** Forge (`@dev`, Dex) · **Data:** 2026-08-24

---

## 1. Pedido do usuário, na íntegra

Linha de trabalho (2026-08-13):

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Método, exigido por ele e válido para todo brief:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar"

Hoje (2026-08-24) eu reportei a ele que dez dias de trabalho da Onda 2 estavam sem commit e
perguntei se podia pedir um commit local, sem push. Resposta dele, literal:

> "pode pedir, continue ai"

**Esta autorização cobre commit local e nada além disso.** Não cobre push, PR, deploy nem
envio externo — cada um desses exige autorização nova e específica dele, uma por ocorrência.

## 2. Objetivo desta tarefa

O código que **você** implementou na Story 1.55 está na árvore de trabalho como untracked,
desde 2026-08-22. São dez dias de trabalho sem rede de proteção: se essa árvore se perder,
perde-se a Onda 2 inteira. O único objetivo aqui é **tirar esse trabalho do limbo**.

Nenhuma linha de código muda. Nenhum teste muda. Só o git.

## 3. Estado que eu verifiquei nesta sessão — desconfie e confira

- Branch: `docs/importacao-inteligente-documentos`. Último commit: `3c13648`.
- **`npm test` = 60 arquivos / 551 testes / 0 falhas.** Eu rodei nesta sessão, exit code 0.
  A árvore está verde. Você não precisa rodar de novo antes de commitar, mas **rode se
  quiser** — eu prefiro que você confira do que aceite de mim.
- Story 1.55 = `Done`. Gate = `CONCERNS`, `waiver.active: false`, quatro issues abertas
  (TEST-001, TEST-002, REL-001, TEST-003). **Não mexa em nenhuma delas.** Fechar issue de
  gate é do `@qa` e é outra story. Commitar CONCERNS é correto — o veredito é o que é.

## 4. Escopo do entregável

**Dois commits locais**, nesta ordem. Nada de push.

### Commit 1 — o código da Onda 2

Arquivos, todos untracked hoje:

- `supabase/functions/_shared/document-import/nfe.ts`
- `supabase/functions/_shared/document-import/handler.ts`
- `supabase/functions/document-extraction/index.ts`
- `src/services/documentImportNfe.test.ts`
- `src/services/documentExtractionSecurity.test.ts`

Mensagem, seguindo a convenção do projeto (conventional commit + ID da story):

```
feat(document-import): rota XML de NF-e de entrada [Story 1.55]
```

No corpo, descreva o que a rota faz de fato: parser determinístico de cabeçalho do leiaute
4.00 com mapeamento manual, validação da chave de acesso por módulo 11, regra de direção pelo
CNPJ, gravação de proposta `pending`, **zero chamada de IA e zero escrita em tabela de
domínio**. Registre também que o gate fechou em CONCERNS com quatro issues não bloqueantes.

### Commit 2 — os registros

- `docs/stories/1.55.piloto-cabecalho-nfe-xml.story.md` (modificado/untracked)
- `docs/qa/gates/1.55-piloto-deterministico-cabecalho-nfe-xml.yml`
- `docs/data/document-import-proposals-schema.md` (modificado — ganhou a §10, ver seção 6)
- Todos os arquivos `.aiox/briefs/*.md` que estiverem untracked

Mensagem:

```
docs: story 1.55, gate CONCERNS, adendo de schema e briefs da onda 2
```

No corpo, mencione que a §10 da nota de schema documenta uma divergência de versão de
migration **ainda não reconciliada**, e que ela é achado documentado, não correção aplicada.

## 5. Fronteiras duras — o que fica de fora, por nome

**NÃO commite, não adicione ao index, não toque:**

- `.claude/launch.json` — modificado antes desta linha de trabalho. **Não é nosso.**
- `vite.config.ts` — mesma coisa. **Não é nosso.**
- `.claude/settings.local.json.bak` — lixo de backup local. Deixe untracked.
- **`docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md`** — o Loom (`@sm`) está
  editando este arquivo **agora, neste momento**. Ele fica para o próximo commit, depois que
  o Loom terminar. Se você commitar por cima, o trabalho dele entra pela metade.

Use `git add` com caminhos explícitos. **Nada de `git add -A`, `git add .` ou `git commit -a`** —
qualquer um dos três varre os arquivos que não são nossos para dentro do commit.

**Nunca** `git stash`/`git stash pop`. Se algo falhar entre os dois, trabalho não commitado
fica preso no stash.

## 6. Contexto do adendo de schema (§10) — leia antes de escrever a mensagem

A Cistern (`@data-engineer`) documentou um achado que ainda está aberto: a migration
`20260814100000_document_import_proposals.sql` foi aplicada no remoto em 2026-08-22 via MCP,
e a tabela de rastreamento gravou `version=20260822182249` — o timestamp da chamada, não o do
nome do arquivo. O arquivo local continua `20260814100000`. Mesma migration, duas identidades.

Ela **apurou e não corrigiu**, corretamente: reconciliar é mutação e exige autorização própria
do usuário. Sua mensagem de commit deve deixar isso explícito, para que quem ler o histórico
não conclua que já foi resolvido. **Você também não corrige.** Não rode `migration repair`,
não rode `UPDATE` em `schema_migrations`, não renomeie o arquivo.

## 7. Restrições de autoridade

- **Sem `git push`.** A autorização do usuário cobre commit local e mais nada.
  `git push` é exclusivo do `@devops` (Anchor) **e** exige autorização nova dele.
- Sem `gh pr create`, sem `gh pr merge`.
- Sem migration, sem `supabase db push`, sem `supabase migration repair`, sem `execute_sql`
  de mutação, sem deploy de Edge Function.
- Sem CodeRabbit — transmite código para fora e exige autorização específica por ocorrência.
- Não altere Status de story nenhuma. Não escreva em QA Results nem em arquivo de gate:
  ambos são exclusivos do `@qa`.
- Não fale com outro agente. Devolva a mim.

## 8. Como medir se deu certo

Depois dos dois commits, me mostre a saída literal de:

```
git log --oneline -4
git status --short
```

`git status --short` tem de continuar mostrando **exatamente** estes quatro, e nada mais:
`.claude/launch.json` (M), `vite.config.ts` (M), `.claude/settings.local.json.bak` (??),
`docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md` (??).

Se aparecer qualquer outra coisa, ou se algum desses quatro tiver sumido, você commitou o que
não devia — me avise **antes** de tentar consertar sozinho.

Confirme também que `git ls-remote --heads origin docs/importacao-inteligente-documentos`
continua vazio: o remoto não pode conhecer esta branch.

## 9. Desconfie de mim

Tudo na seção 3 eu medi nesta sessão. Confira mesmo assim — a lista de arquivos, o estado do
`git status`, quem está editando o quê. Se algo meu não bater, me avise antes de commitar.

## 10. Se travar

Escale para mim com o ponto exato e o comando que falhou. Não force. Um commit adiado não
custa nada; um commit errado no histórico custa uma limpeza.
