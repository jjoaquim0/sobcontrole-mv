# BRIEF — Escrever o epic da Importação Inteligente de Documentos, organizado em ondas

**ID:** `helm-epic-importacao-documentos`
**Versão:** v1
**De:** Orion (`@aiox-master`)
**Para:** Helm (`@pm`)
**Natureza:** produto
**Arquivo autoritativo:** `.aiox/briefs/helm-epic-importacao-documentos.md`
**Substitui:** nenhum
**Story/epic:** este brief **cria** o epic. Não existe ainda.
**Branch:** `docs/importacao-inteligente-documentos`

---

## 1. Pedido original completo do usuário — OBRIGATÓRIO

Transcrição literal. Não resumi, não corrigi a redação, não cortei nada.

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento posterior dele, que **alterou escopo**:

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Feedback dele sobre **método de delegação**, que é o motivo de este brief ter este formato:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar" — incluindo sempre (1) pedido original completo, (2) objetivo/contexto, (3) escopo do entregável.

**Duas frases do pedido merecem sua atenção especial ao escrever o epic:**

- **"quero isso funcionando"** — o usuário não pediu documento, pediu funcionalidade em uso. O epic precisa ter uma onda 1 que **entrega valor sozinha**, não uma que só prepara terreno. Se a onda 1 terminar e o usuário ainda não puder importar nada, o epic está mal cortado.
- **"pergunta se pode integrar"** — atendido como **tela de revisão com confirmação por clique**, não como turno de conversa com a IA. Não é preciosismo: um PDF é entrada não confiável e pode conter instrução injetada; consentimento em linguagem natural pelo mesmo canal do documento entrega o banco ao documento. Aria (ADR D3) e Uma (fluxo de UX) chegaram a isso de forma independente. A intenção do usuário está preservada; muda o meio.

**Decisões do usuário que fecham escopo** (todas dele, em `.aiox/briefs/decisoes-usuario-importacao-documentos.md`):

| Questão | Decisão |
|---|---|
| Tipos de documento | NF-e, boleto, contrato — em ondas. **Extrato ficou fora**: é conciliação bancária, vira epic próprio |
| Foto / PDF escaneado | Fora. Sem OCR, sem visão |
| Direção da NF-e | **Só entrada.** Saída rejeitada com aviso claro |
| Custo do produto | **Perguntar na tela**, por item: custo atual × custo da nota |
| Contrato comercial | Cria **cliente + oportunidade**, faltantes coletados na tela |
| Rota do PDF | **Opção E agora, A depois:** v1 só XML + boleto por linha digitável colada; PDF via pdf.js **no navegador** numa onda posterior |

**Sobre a última linha:** o ADR ainda diz, no cabeçalho, que a rota de PDF é "decisão de produto pendente". **Não está mais.** O usuário decidiu ontem, 2026-08-14. Pedi à Aria que atualize o ADR em paralelo a este trabalho. Se você ler o ADR e encontrar a contradição, é isso — **a decisão do usuário prevalece**, o documento é que está atrasado.

## 2. Objetivo e contexto — OBRIGATÓRIO

**Objetivo:** um epic que corte esta funcionalidade em ondas entregáveis, cada uma com valor próprio, na ordem que maximiza valor e minimiza risco.

**Por que agora:** o desenho está fechado e auditado — arquitetura, pesquisa e UX prontas e commitadas. A Cistern está escrevendo o DDL das tabelas de proposta em paralelo. Falta a estrutura de produto que organiza o que vem depois, para o Loom escrever stories em cima.

**Estado atual verificado** (medi eu mesmo):

- Infraestrutura de IA existe e é madura: gateway multiempresa, rate limit, auditoria, `store: false`.
- **A IA é read-only por invariante estrutural**, não por convenção: `supabase/functions/_shared/ai/tools/registry.ts:45` lança `configuration_error` se `mode !== 'read_only'`. Esta feature **não** remove essa trava — trabalha ao redor dela, via propostas.
- Upload de documento já funciona, bucket privado, versão imutável, `.xml` já aceito.
- `DOCUMENT_CATEGORIES` já tem `nota_fiscal`, `contrato`, `boleto`, `recibo`.
- `AiSiteIntegrationAction.tsx` é **placeholder** — só dispara um toast "em breve". É **outra** feature (alimentar a IA do site do cliente). O epic precisa dizer se convive, é renomeada ou é absorvida, para não sair uma UI com duas coisas parecidas e nomes confusos.

**Relação com o pedido:** o epic é o que transforma "quero isso funcionando" em uma sequência que chega lá sem quebrar nada no caminho.

**Não-objetivos:** não é escrever stories (é do Loom), não é decidir arquitetura (é da Aria, já decidida), não é conciliação bancária.

## 3. Escopo esperado do entregável — OBRIGATÓRIO

**Artefato:** um epic, no template e no local que o AIOX já usa no projeto. **Verifique a convenção real em `docs/stories/epics/`** e siga a que existe — não invente estrutura nova.

**Profundidade:** epic completo, com ondas nomeadas, objetivo e critério de conclusão por onda, dependências entre ondas e riscos de produto.

**Deve conter:**

- **Objetivo de negócio**, na linguagem do usuário, não na de arquitetura.
- **Ondas, com a sequência já decidida pelo ADR** (seção "Sequência sugerida"). Reordene se tiver argumento de produto melhor — mas **declare** que reordenou e por quê:
  1. Tabelas de proposta e RPCs de aplicação (Cistern, **já em andamento**)
  2. **Rota XML de NF-e de entrada** — determinística, sem IA, sem depender de decisão nenhuma pendente. Maior valor, menor risco
  3. UI de revisão e confirmação, incluindo decisão de custo por item
  4. Rota de boleto por linha digitável colada — determinística
  5. Rota de PDF via pdf.js no navegador
  6. Quota por feature e auditoria
  7. Contrato comercial → cliente + oportunidade
- **Critério de conclusão por onda**, falsificável. "Onda 2 pronta" precisa ter um teste que reprova.
- **Qual onda entrega valor ao usuário pela primeira vez**, explicitamente. Ele pediu funcionando.
- **Riscos de produto**, com destaque para **fadiga de revisão (R7 do ADR)**: a decisão do usuário de perguntar custo item a item significa que uma nota de trinta itens pode exigir até sessenta decisões humanas. Se a tela empurrar o usuário a aprovar em bloco sem ler, o controle de segurança inteiro vira teatro. Isso é risco de **produto**, não de engenharia.
- **Decisão sobre `AiSiteIntegrationAction`**: convive, renomeia ou absorve.
- **Encaminhamento do extrato bancário** como epic separado, para não se perder.

**Fora do entregável:**

- Stories (Loom escreve; Ledger valida Draft→Ready).
- Decisões de arquitetura, schema ou UI — já decididas ou pertencem a outros.
- Estimativa em horas ou datas. **Não temos velocity medida neste projeto e eu não vou repassar número que ninguém mediu.** Se quiser expressar tamanho, use tamanho relativo entre ondas e diga que é relativo.

**Definição de pronto:** o epic existe no caminho correto, com ondas, critérios falsificáveis e riscos, e você me reportou no formato da seção 9.

## 4. Fontes de verdade

| Documento | Autor | Sua ação |
|---|---|---|
| `docs/architecture/ai-document-ingestion-p3.md` | Aria (`@architect`) | **ler inteiro** — decisões D1-D8, matriz por tipo, riscos R1-R9, sequência |
| `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` | Uma (`@ux-design-expert`) | ler — a tela de revisão é o controle de segurança principal |
| `docs/research/2026-08-13-.../README.md` | Lantern (`@analyst`) | consultar — evidência sobre PDF, NF-e, boleto |
| `.aiox/briefs/decisoes-usuario-importacao-documentos.md` | Orion | ler — as decisões do usuário, na origem |
| `.aiox/handoffs/handoff-2026-08-14-importacao-documentos.md` | Orion | ler — estado da sessão |

**Este brief não é prova.** Reverifique o que sustentar sua decisão, inclusive o que eu afirmo ter medido. Se divergir, o código e os documentos originais ganham, e eu quero saber.

## 5. Duas armadilhas técnicas que precisam virar linha no epic

Não são detalhe de implementação. São coisas que, se ninguém escrever agora, quebram em produção sem levantar erro:

**O fator de vencimento do boleto reiniciou a contagem.** É um contador de dias desde 07/10/1997 que bateu o teto de 9999 em 21/02/2025 e voltou para 1000 no dia seguinte. Como estamos em agosto de 2026, **boletos das duas eras circulam ao mesmo tempo**. Quem não tratar as duas calcula vencimento errado — silenciosamente, com data plausível, numa conta a pagar. A onda do boleto precisa carregar isso como critério de aceitação explícito, com teste dos dois lados da virada.

**Boleto não é escrita isolada.** `AccountPayable.supplierId` é obrigatório (`src/types/index.ts:341`). Um boleto sem fornecedor resolvido não pode ser gravado. A onda do boleto inclui resolver ou criar fornecedor, ou pedir seleção na tela — não é "só ler o boleto".

E um terceiro, para a onda 7: **`Deal` exige `customerId`, `ownerId`, `stageId`, `title` e `value`** — cinco campos, e nem `title` nem `value` saem de forma confiável de um contrato. Foi por isso que o usuário escolheu coletar os faltantes na tela. É a única opção que funciona.

## 6. Contratos fechados e liberdades

**Fechado — não reinterpretar:**

- A IA nunca escreve no domínio. Propõe; o humano confirma; a escrita é RPC com o JWT do usuário sob RLS.
- Consentimento é ato de UI, nunca turno de conversa.
- Extrato fora. NF-e de saída rejeitada. Sem foto, sem escaneado.
- Migration só é aplicada com autorização explícita do usuário, uma a uma, inclusive no-op.

**Seu, e eu não vou palpitar:**

- Corte e nomeação das ondas; agrupar ou dividir, se tiver argumento.
- Ordem, se discordar do ADR — declarando o motivo.
- Formato do epic dentro da convenção do projeto.
- Como expressar tamanho relativo.

**Aberto, não bloqueia:**

- Nome comercial da feature na UI — proponha, o usuário decide depois.
- Destino de `AiSiteIntegrationAction` — proponha com justificativa.

**Bloqueia:**

- Se a convenção de epic do projeto for ambígua ou não existir: **pare, me pergunte.** Não invente estrutura nova.

## 7. Fronteiras duras e autoridade

**Pode tocar:** o arquivo de epic novo, no caminho da convenção do projeto.

**Não pode tocar:**

- `docs/architecture/ai-document-ingestion-p3.md` — da Aria
- `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` — da Uma
- `supabase/` — nada; a Cistern está trabalhando lá agora
- `src/` — nada
- Stories existentes — do Loom e do Ledger
- Gate e QA Results — **exclusivos do Beacon (`@qa`)**
- `git push`, `gh pr create` — **exclusivos do Anchor (`@devops`)**

**EXIGE APROVAÇÃO HUMANA EXPLÍCITA:** aplicar migration, push, PR, envio de código a serviço externo. Nada disso nesta tarefa; se aparecer, **pare e me chame**. Autorização anterior não vale para a próxima.

## 8. Gates

| Gate | Evidência | Baseline | Alvo |
|---|---|---:|---:|
| Decisões do usuário refletidas no epic | leitura | 0/6 | **6/6** |
| Ondas com critério de conclusão falsificável | leitura | 0/N | N/N |
| Afirmação sem fonte rastreável | leitura | — | **0** |
| Riscos do ADR endereçados no plano | R1-R9 | 0/9 | os que forem de produto, nomeados |
| Estimativa em horas ou datas | leitura | — | **0** (não temos velocity medida) |
| Arquivos de outros donos alterados | `git status --short` | — | **0** |

## 9. Formato do retorno a Orion

1. Resultado em uma frase.
2. Caminho exato do epic criado.
3. Ondas, em ordem, com o critério de conclusão de cada uma.
4. **Qual onda entrega valor pela primeira vez ao usuário.**
5. Se reordenou em relação ao ADR, o quê e por quê.
6. Decisões tomadas dentro da liberdade delegada.
7. Sua proposta para `AiSiteIntegrationAction`.
8. O que você reverificou deste brief e onde eu estava errado, se estive.
9. Questões abertas, riscos, bloqueios.

## 10. Recomendações fora do pedido

Se identificar oportunidade não pedida, registre em seção separada e marcada como recomendação. **Não incorpore ao escopo do epic sem nova decisão minha ou do usuário.** Artigo IV da Constitution: nada de invenção.

## 11. Uma instrução final

**Me desconfie.** Confirme por conta própria, inclusive o que afirmo ter verificado. Já errei nesta sessão: registrei uma inferência como fato e o Quill me pegou. Prefiro ser corrigido agora a ver o erro chegar em produção.
