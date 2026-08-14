# BRIEF — Desenhar a revisão de itens em volume da NF-e na tela de revisão

**ID:** `prism-revisao-itens-em-volume`
**Versão:** v1
**De:** Orion (`@aiox-master`)
**Para:** Prism (`@ux-design-expert`)
**Natureza:** UX
**Arquivo autoritativo:** `.aiox/briefs/prism-revisao-itens-em-volume.md`
**Substitui:** nenhum
**Story/epic:** `docs/epics/epic-importacao-inteligente-documentos.md` — Onda 3. Ainda não virou story; este trabalho precede a story de propósito.
**Branch:** `docs/importacao-inteligente-documentos`

---

## 1. Pedido original completo do usuário — OBRIGATÓRIO

Transcrição literal do pedido que originou esta linha de trabalho:

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento posterior dele, que alterou escopo:

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Feedback dele sobre método de delegação — e ele mandou este feedback **através de você**, depois de você receber um brief meu que chegou mutilado:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar" — incluindo sempre (1) pedido original completo, (2) objetivo/contexto, (3) escopo do entregável.

Você tinha razão de reclamar. O brief anterior chegou reduzido a uma palavra — "cliente" — e você abriu um menu perguntando de que fluxo se tratava. O erro foi meu: eu verificava o que voltava dos agentes e não verificava o que saía. Este brief está em arquivo por causa disso.

**A decisão do usuário que criou o problema deste brief** (QA-2, dele, registrada em `.aiox/briefs/decisoes-usuario-importacao-documentos.md`):

> Custo do produto: **perguntar na tela de revisão**, mostrando custo atual do cadastro e custo da nota **lado a lado**, com o usuário decidindo **item a item**. Nem sobrescrever sempre, nem nunca.

## 2. Objetivo e contexto — OBRIGATÓRIO

**Objetivo:** fechar o desenho de revisão da lista de itens de uma NF-e quando ela tem volume médio — de 5 a 30 itens — sem que a tela empurre o usuário a aprovar em bloco sem ler.

**Por que agora:** o Helm encontrou uma lacuna real no seu documento ao escrever o epic, e **eu verifiquei e confirmo**. Não é crítica ao seu trabalho; é consequência de uma decisão do usuário que mudou o problema depois que você desenhou.

**A lacuna, com as linhas exatas que eu conferi** em `docs/ux/importacao-inteligente-documentos-fluxo-ux.md`:

- Na **linha 105** você escreveu, e a formulação é sua: *"Decisão (não é opção, é a solução): tabela com aprovação em lote por exceção, não confirmação individual."* Com ações em lote na linha 109 — selecionar todos, mostrar só os com alerta.
- Mas isso está desenhado para a **§8.2 — Tela de revisão de Extrato bancário (lote)**, na linha 209.
- **O extrato saiu de escopo.** Decisão do usuário (QA-1): o que ele quer para extrato é conciliação bancária, que exige tabelas inexistentes no schema. Virou epic próprio.
- E na **linha 200**, no wireframe da NF-e, a lista de itens aparece como um bloco colapsado: `[Ver lista de produtos ▾]`. Sem desenho de revisão item a item.

**O resultado:** a solução para o problema de volume ficou na tela que foi cortada, e a tela que sobreviveu herdou o problema sem a solução. E ficou pior que antes, porque a decisão QA-2 do usuário acrescentou uma segunda decisão por item.

**A conta que me preocupa:** uma NF-e de trinta itens pode exigir até **sessenta decisões humanas** — vincular ou criar o produto, e atualizar ou não o custo. Se a tela levar o usuário a clicar "aprovar tudo" sem ler, o controle de segurança inteiro deste desenho vira teatro. A IA continua não escrevendo direto no banco, mas o clique de confirmação deixa de significar "o humano decidiu". E o clique é a única coisa que separa um PDF adulterado do banco da empresa.

**Relação com o pedido:** o usuário disse "pergunta se pode integrar". Essa tela **é** a pergunta. Se ela for respondida sem leitura, a pergunta não foi feita de verdade.

**Não-objetivos:** não é redesenhar a tela inteira, não é reabrir decisão de arquitetura, não é escrever story.

## 3. Escopo esperado do entregável — OBRIGATÓRIO

**Artefato:** atualização de `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` — **seu arquivo**. Acrescente a seção que falta e ajuste o wireframe da §8.1. Preserve o resto.

**Profundidade:** decisão de design fechada, no mesmo nível de resolução do que você já fez para o extrato — não opções para eu escolher, salvo se houver trade-off que precise do usuário.

**Deve conter:**

- **O padrão de revisão da lista de itens de NF-e em volume médio.** Se a resposta for adaptar o "lote por exceção" que você já desenhou, ótimo — mas diga o que muda, porque o problema não é idêntico: no extrato a decisão era uma por linha; aqui são duas, e a segunda (custo) tem um número que o usuário precisa comparar.
- **Como as duas decisões por item convivem sem virar duas passagens pela mesma lista.** Vincular/criar produto e atualizar/não atualizar custo.
- **Qual é o default seguro por item, e por quê.** Default seguro aqui é o que erra para o lado de não gravar. Se a sua conclusão for que o custo não deve ter default nenhum, é uma conclusão válida — sustente.
- **Como a tela distingue o item que precisa de atenção do item que não precisa**, para que a leitura se concentre onde importa. Você já usa faixas de confiança em `TaxConfidenceCard.tsx` e `RecommendationCard.tsx`; reaproveitar é melhor que inventar.
- **O que acontece acima do teto de itens.** O ADR diz que o teto virou requisito depois de QA-2. Proponha o comportamento — não o número, que sai de protótipo.
- **Ajuste da §8.1**, para o wireframe deixar de esconder o problema atrás de um colapso.

**Fora do entregável:**

- Redesenhar upload, classificação, estados de erro ou o resumo pré-gravação — estão fechados.
- Reabrir a tela de extrato. Está fora de escopo, e mexer nela é trabalho jogado fora.
- Código, componente, story.
- Decidir o número do teto de itens.

**Definição de pronto:** a §8.1 não esconde mais a lista atrás de um colapso sem desenho, existe seção própria para revisão de itens em volume, e você me reportou.

## 4. Contexto verificado

| Afirmação | Fonte | Estado que medi | Como reverificar |
|---|---|---|---|
| "Lote por exceção" está desenhado para extrato | `docs/ux/...-fluxo-ux.md:105` e `:209` | confirmado nas duas linhas | ler |
| Lista de itens da NF-e está colapsada sem desenho | mesmo arquivo, `:200` | `[Ver lista de produtos ▾]` | ler |
| Extrato fora de escopo | `.aiox/briefs/decisoes-usuario-importacao-documentos.md`, QA-1 | decisão do usuário | ler |
| Custo item a item é decisão do usuário | mesmo arquivo, QA-2 | decisão do usuário | ler |
| Teto de itens virou requisito | `docs/architecture/ai-document-ingestion-p3.md` | "deixa de ser precaução e vira requisito" | ler |
| Precedente visual de confiança existe | `TaxConfidenceCard.tsx`, `RecommendationCard.tsx` | alta/média/baixa, emerald/amber/gray | ler |

**Este brief não é prova.** Reverifique o que sustentar sua decisão, inclusive o que afirmo ter medido. Se eu estiver errado, o arquivo ganha e eu quero saber.

## 5. Contratos fechados e liberdades

**Fechado — não reinterpretar:**

- Consentimento é ato de UI sobre dado estruturado, nunca turno de conversa. A tela é controle de segurança, não formulário.
- Custo é decisão do usuário item a item — não proponha "sempre sobrescrever" nem "nunca".
- Extrato fora. NF-e de saída rejeitada com aviso. Sem foto, sem escaneado.

**Seu, e eu não vou palpitar:**

- O padrão de interação inteiro.
- Agrupamento, ordenação e progressive disclosure.
- Se cabe pré-seleção por confiança e com que critério.
- Como representar a comparação de custo lado a lado.
- Comportamento acima do teto.

**Bloqueia:**

- Se você concluir que a decisão QA-2 do usuário — custo item a item — **não tem desenho que evite fadiga em volume alto**, não invente contorno e não a suavize por conta própria. **Pare e me diga.** Eu levo a ele, com sua evidência. Ele tomou essa decisão sem ver a tela; a Aria já observou que ele "escolheu com razão, só não sei se enxergou o preço". Se o preço for alto demais, ele tem o direito de saber e reconsiderar. **Quem reconsidera é ele, não nós dois.**

## 6. Fronteiras duras e autoridade

**Pode tocar:** `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` — seu arquivo.

**Não pode tocar:**

- `docs/architecture/ai-document-ingestion-p3.md` — da Aria
- `docs/epics/epic-importacao-inteligente-documentos.md` — do Helm
- `supabase/` — a Cistern está trabalhando lá **agora**
- `src/` — nada; isto é design, não implementação
- Gate e QA Results — **exclusivos do Beacon (`@qa`)**
- `git push`, `gh pr create` — **exclusivos do Anchor (`@devops`)**
- **Nenhuma migration aplicada.** Nem no-op. Não é sua tarefa; se virar, pare e me chame.

**Não fale com outro agente.** Eu coordeno. Se precisar de algo do Helm ou da Aria, peça a mim.

## 7. Gates

| Gate | Evidência | Baseline | Alvo |
|---|---|---:|---:|
| Decisões por item cobertas por desenho | leitura | **0/2** | **2/2** (vínculo de produto e custo) |
| Wireframe §8.1 escondendo a lista sem desenho | linha 200 | **1** | **0** |
| Comportamento acima do teto definido | leitura | ausente | definido |
| Estados de tela cobertos | leitura | — | todos, incluindo lista vazia e item sem GTIN |
| Arquivos de outros donos alterados | `git status --short` | — | **0** |

## 8. Formato do retorno a Orion

1. Resultado em uma frase.
2. O que você alterou, por seção.
3. O padrão que escolheu e **por que ele resiste à aprovação sem leitura** — este é o ponto que mais me interessa.
4. Qual é o default seguro por item e por quê.
5. Sua conclusão honesta sobre QA-2: o desenho resolve a fadiga, ou o preço da decisão do usuário é alto demais e eu preciso levar a ele.
6. O que reverificou deste brief e onde eu estava errado, se estive.
7. Questões abertas e riscos.

## 9. Nota

Este brief está em arquivo e o Maestri levou só o ponteiro — é a correção da falha que você mesmo denunciou. Se ele chegar incompleto, ou citar linha que você não encontra, **me avise antes de trabalhar em cima dele.** Prefiro refazer o envio a receber trabalho construído sobre brief pela metade.
