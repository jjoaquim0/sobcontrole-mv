# Brief — Ledger validar as stories 1.55 e 1.56

**De:** Orion (`@aiox-master`) · **Para:** Ledger (`@po`, Pax) · **Data:** 2026-08-22

---

## 1. Pedido original do usuário, na íntegra

Pedido de 2026-08-13 que originou a linha de trabalho:

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento de 2026-08-13:

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Pedido de 2026-08-22:

> "pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

## 2. Objetivo desta tarefa

Validar duas stories em `Draft` e emitir veredito. Você é o dono exclusivo da validação e da transição `Draft → Ready`.

- `docs/stories/1.55.piloto-cabecalho-nfe-xml.story.md`
- `docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md`

Autor: Loom (`@sm`), a partir de `.aiox/briefs/loom-stories-1.55-1.56.md`.

## 3. LEIA ISTO ANTES DE COMPARAR COM O EPIC — evita um NO-GO indevido

Este é o ponto mais importante do brief.

O epic `docs/epics/epic-importacao-inteligente-documentos.md` descreve as **Ondas 2 e 3 completas**, com itens de NF-e, vínculo de produtos, decisão de custo item a item e atualização de estoque. **As duas stories cobrem deliberadamente MENOS que isso.** Se você comparar story contra epic sem este contexto, vai encontrar uma lacuna real e concluir NO-GO por escopo incompleto — e estaria reprovando por uma diferença que foi decidida, não por um defeito.

**O que aconteceu, na ordem:**

1. O coorquestrador (Vega) analisou a viabilidade e concluiu que Ondas 2+3 completas não caberiam no dia "sem transformar QA e consentimento em fachada".
2. Ele apontou três bloqueios. **Eu verifiquei os três pessoalmente e todos procedem:**
   - A RPC `apply_nfe_purchase_proposal` aplica a proposta mesmo com `update_cost_decision = 'pending'` (DDL `20260814100000`, linha 483: só age em `'update'`). A UI bloquearia; o servidor não garante a decisão humana.
   - Não existe nenhum arquivo `.xsd` no repositório, embora o ADR (`ai-document-ingestion-p3.md:72`) exija validação XSD como camada estrutural.
   - O teto de itens é requisito sem número: o ADR (linha 122) diz que "vira requisito"; o UX `§3.6.5` diz literalmente *"Sem propor o número"*. A story não pode inventar um valor.
3. **O usuário decidiu o corte** e aprovou o piloto de cabeçalho.

**O corte não é invenção, e é isso que sustenta o Artigo IV.** O comportamento entregue é exatamente o estado degradado que a Uma (`@ux-design-expert`) já desenhou e commitou em `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` `§3.6.5` (linha 161), com wireframe na linha 291:

> *"Fornecedor, compra e contas a pagar continuam sendo criados normalmente — não dependem dos itens... 'os produtos não foram adicionados ao estoque — lance-os manualmente.' Nenhum produto é criado ou vinculado sem revisão acima do teto; a degradação corta a automação do estoque, nunca a integridade dos outros dados."*

**Portanto, ao validar rastreabilidade:** cada AC deve rastrear para a decisão do usuário, para `D*`/`QA*`/`R*` do ADR, ou para o `§3.6.5` do UX. Um AC que rastreie para `§3.6.5` está **corretamente** rastreado, não órfão.

**O que você deve verificar de escopo é o oposto do que pareceria:** que as stories **não excedem** o piloto. Se alguma AC reintroduzir itens, produtos, estoque, decisão de custo, chips de confiança ou XSD, isso **é** defeito e justifica NO-GO.

## 4. Fatos que eu verifiquei pessoalmente hoje — reconfira, não aceite de mim

- Migration aplicada: as 3 tabelas existem, RLS **3/3**, `text_origin` presente, `UNIQUE (company_id, idempotency_key)` testada sob inserção real pela Cistern.
- RPC `apply_nfe_purchase_proposal(p_proposal_id UUID)` existe (DDL linha 362), com `GRANT EXECUTE ... TO authenticated` (linha 768).
- `PaymentMethod` em `src/types/index.ts:5` inclui `'other'`.
- `AccountPayable.supplierId` é obrigatório, sem opcional (`src/types/index.ts:341`).
- IDs `1.55`/`1.56`: a faixa `1.37–1.54` está reservada pelo epic de Pipeline de Vendas (linhas 100-132), com `1.45` e `1.50` dependendo explicitamente de `1.37`. Eu havia mandado usar 1.37/1.38 e **estava errado** — o Quill pegou.

**Baseline dos quatro gates, medida por mim hoje:**

| Gate | Comando | Hoje | Tipo |
|---|---|---|---|
| Test | `npm test` | 510 passam / 0 falham (58 arquivos) | **Duro** — 0 falhas |
| Build | `npm run build` | PASS | **Duro** |
| Typecheck | `npm run typecheck` | 24 erros | Não-regressão |
| Lint | `npm run lint` | 276 erros, 2 warnings | Não-regressão |

O lint **não passa hoje**, apesar do `--max-warnings 0`. Uma story que exigisse "lint limpo" mandaria o `@dev` consertar 276 erros alheios. Se as stories tratam isso como não-regressão, está **correto** — não penalize.

## 5. O que eu quero de volta

Sua validação padrão (checklist de 10 pontos), com veredito **GO** ou **NO-GO** por story, separadamente. Elas podem receber vereditos diferentes.

Preste atenção especial a:

1. **Escopo não excedido** — nenhuma AC reintroduz itens/produtos/estoque/custo/XSD (seção 3 acima).
2. **Falsificabilidade** — cada AC tem verificação por comando ou teste concreto, não prosa.
3. **Dependência declarada** — a 1.56 depende da 1.55 em `Done`.
4. **Separação dos quatro gates** — lint, typecheck, test e build nomeados pelo comando que os produz, sem mistura. Confundir lint com typecheck já custou uma arbitragem inteira aqui.
5. **Donos de seção corretos** — `QA Results` reservado ao `@qa`; `Dev Agent Record`/`File List` do `@dev`.

## 6. Fronteiras e autoridade

- **Você é o dono** de título, descrição, AC e escopo. Se precisar corrigir, corrija — é sua autoridade, não do `@sm` nem minha.
- **A transição `Draft → Ready` é sua, e só em GO.** Registre-a explicitamente. Já tivemos uma story parada em `Draft` com GO 10/10 registrado porque ninguém fez a transição — não repita.
- **Não** edite `QA Results` nem arquivo de gate: exclusivos do Beacon (`@qa`).
- **Não** aplique migration, não rode `supabase db push`, não faça push, não abra PR, não acione CodeRabbit (transmite código para fora). Tudo isso exige autorização do usuário, uma por ocorrência.
- **`supabase db push` está proibido para todos** até a divergência de histórico da migration ser reconciliada (documentada em `docs/data/document-import-proposals-schema.md`, seção 10).

## 7. Desconfie de mim

Tudo na seção 4 eu medi hoje, mas **não aceite de mim** — reconfira o que for sustentar seu veredito. Dois agentes já me corrigiram nesta sessão e ambos estavam certos. Se o seu resultado divergir do meu, o seu vale; me avise antes de fechar o veredito.

Se algo estiver ambíguo a ponto de você não conseguir decidir GO/NO-GO com honestidade, **escale para mim em vez de chutar**. Prefiro decidir com você do que receber um GO frouxo.
