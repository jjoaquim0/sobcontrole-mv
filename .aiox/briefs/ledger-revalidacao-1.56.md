# Brief — revalidação da Story 1.56 (pré-condição agora satisfeita)

**De:** Orion (`@aiox-master`) · **Para:** Ledger (`@po`, Pax) · **Data:** 2026-08-24

---

## 1. Pedido do usuário, na íntegra

Linha de trabalho (2026-08-13):

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento que alterou escopo (2026-08-13):

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Método, exigido por ele e válido para todo brief:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar"

Sessão de 2026-08-22, literal:

> "pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

Hoje (2026-08-24) ele pediu apenas: *"continue a tarefa que estavamos fazendo"*.

## 2. Objetivo desta tarefa

Você já validou a Story 1.56 em 2026-08-22 e devolveu **NO-GO**, com uma única causa registrada
no Change Log dela:

> "Validation NO-GO — pré-condição do AC1 não satisfeita: Story 1.55 não está Done (foi promovida a Ready nesta rodada); permanece Draft"

**Essa causa deixou de existir.** A Story 1.55 fechou o ciclo em 2026-08-22 às 19:50.
Preciso que você **revalide a 1.56 do zero** — checklist completo, não só o item que travou —
e execute a transição de status que for consequência do seu veredito.

## 3. Estado que eu verifiquei nesta sessão

Confira tudo por conta própria. Não aceite de mim.

- `docs/stories/1.55.piloto-cabecalho-nfe-xml.story.md` — Status = **Done**.
- `docs/qa/gates/1.55-piloto-deterministico-cabecalho-nfe-xml.yml` — gate = **CONCERNS**,
  reviewer Quinn, `waiver.active: false`, quatro issues abertas de severidade
  medium/low (TEST-001, TEST-002, REL-001, TEST-003). Nenhuma delas é bloqueante e
  nenhuma delas invalida o Done — CONCERNS é veredito de passagem no ciclo do projeto.
- Change Log da 1.55 registra a transição `InReview → Done` assinada por `@qa`, versão 0.1.4.
- Os cinco arquivos da File List da 1.55 existem no disco: `nfe.ts`, `handler.ts`,
  `index.ts` da function `document-extraction`, e os dois testes em `src/services/`.
- **Nada disso está commitado.** O trabalho da 1.55 está na árvore como untracked, na branch
  `docs/importacao-inteligente-documentos`. O último commit é `3c13648`. Isso é fato para o
  seu julgamento, não pedido de ação — commit não é seu nem meu.
- Todos os agentes estavam ociosos ao início desta sessão. Ninguém está editando a 1.56.

## 4. Escopo do entregável

1. Rodar `*validate-story-draft` completo (10 pontos) sobre
   `docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md`.
2. Devolver veredito **GO** ou **NO-GO** com a pontuação e a justificativa por item que
   pesou na decisão.
3. **Se GO:** executar a transição `Draft → Ready` no arquivo da story e acrescentar a
   linha correspondente no Change Log, assinada `@po`, versão 0.1.2. A transição
   Draft→Ready é **sua**, não minha — por isso não a fiz.
4. **Se NO-GO:** listar as correções exigidas de forma acionável, indicando quem é o dono
   de cada uma (`@sm` para escopo/AC/título, `@architect` para contrato técnico, etc.).
   Não corrija você mesmo o que é de outro dono.

Atenção específica ao **AC1** da 1.56, que é a pré-condição formal: verifique que o texto do
AC continua correto agora que a 1.55 está Done, e que o gate CONCERNS com quatro issues abertas
não conflita com o que o AC1 exige.

Atenção também ao **AC13**: ele fixa baselines numéricos (lint 276 erros/2 warnings,
typecheck 24 diagnósticos, 510 testes de baseline, build PASS). O Dev Agent Record da 1.55
reporta que o total de testes subiu para **551** em 60 arquivos após a 1.55. Se o baseline
citado no AC13 da 1.56 ficou desatualizado por causa disso, é achado seu e deve entrar no
veredito — corrigir o texto do AC é do `@sm`, não seu.

## 5. Fronteiras duras

- Não edite AC, título, escopo ou descrição da 1.56 sem que isso seja o veredito registrado —
  esses campos são seus por autoridade, mas mudança silenciosa não vale; vá pelo Change Log.
- **Não toque** em `docs/stories/1.55...`, em `docs/qa/gates/`, nem em nenhum arquivo de
  código. Gate e QA Results são exclusivos do `@qa`.
- **Nada de** `git push`, `gh pr`, migration, `supabase db push`, deploy ou CodeRabbit.
  CodeRabbit transmite código para fora e exige autorização específica do usuário, por ocorrência.
- Não fale com outro agente. Devolva a mim.

## 6. Desconfie de mim

Tudo na seção 3 eu medi nesta sessão, mas confira. Se algum fato meu não bater, me avise
antes de concluir — prefiro corrigir a fonte a propagar erro meu para dentro de um veredito.

## 7. Se travar

Escale para mim com o ponto exato em que travou e o que faltou. Não invente pré-condição
satisfeita para destravar o fluxo.
