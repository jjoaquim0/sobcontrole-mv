# BRIEF — Fechar a seção de extração de PDF do ADR com a decisão do usuário

**ID:** `aria-fechamento-rota-pdf`
**Versão:** v1
**De:** Orion (`@aiox-master`)
**Para:** Aria (`@architect`)
**Natureza:** arquitetura
**Arquivo autoritativo:** `.aiox/briefs/aria-fechamento-rota-pdf.md`
**Substitui:** nenhum
**Story/epic:** não aplicável — atualização de ADR anterior à existência do epic
**Branch:** `docs/importacao-inteligente-documentos`

---

## 1. Pedido original completo do usuário — OBRIGATÓRIO

Transcrição literal do pedido que originou toda esta linha de trabalho:

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento posterior dele, que alterou escopo:

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

**A decisão nova, que é o motivo deste brief.** Levei ao usuário as cinco opções que você apresentou na seção "Extração de PDF", com custo e trade-off de cada uma, exatamente como você pediu que fosse feito. Ele escolheu:

> **Opção E agora, Opção A depois.**

Ou seja: **v1 só com rota XML de NF-e, mais boleto por linha digitável colada ou digitada pelo usuário. Extração de PDF via pdf.js no navegador vem numa onda posterior.** Foi exatamente a sua recomendação da seção "Recomendação, para o usuário decidir" — ele concordou com ela.

## 2. Objetivo e contexto — OBRIGATÓRIO

**Objetivo:** o ADR deixar de declarar pendente uma decisão que já foi tomada.

**Por que agora:** `docs/architecture/ai-document-ingestion-p3.md:4` ainda diz *"Uma decisão de produto pendente (rota de extração de PDF, seção 'Extração de PDF')"*. Verifiquei hoje: continua lá. O ADR é o documento que Cistern, Helm e Loom vão ler para trabalhar — **e três agentes estão prestes a ler essa linha e desenhar em torno de uma pergunta que já tem resposta.** A Cistern está escrevendo o DDL neste momento e o Helm está escrevendo o epic. É defasagem de horas, mas com consequência real.

**Estado atual verificado por mim:** QA-1 a QA-4 estão corretamente marcadas como resolvidas no ADR. **A única defasagem é a rota de PDF.** O resto do documento não precisa de mudança.

**Relação com o pedido:** o usuário disse "quero isso funcionando". A Opção E é o caminho que entrega funcionamento primeiro, pela rota de maior fidelidade, sem contrair dívida de bundle, de licença nem de LGPD.

**Não-objetivos:** não é revisar o ADR inteiro, não é reabrir decisão nenhuma, não é escrever story ou epic.

## 3. Escopo esperado do entregável — OBRIGATÓRIO

**Artefato:** `docs/architecture/ai-document-ingestion-p3.md`, atualizado. **Seu arquivo, edição cirúrgica.**

**Profundidade:** decisão final registrada. É uma atualização pequena e deliberadamente contida.

**Deve conter:**

1. **Cabeçalho (linha 4):** trocar "uma decisão de produto pendente" pelo estado real. Nenhuma decisão de produto pendente agora.
2. **Seção "Extração de PDF":** registrar a escolha do usuário — **E agora, A depois** — com data (2026-08-14) e atribuição explícita a ele. **Preserve as cinco opções e a evidência do Lantern.** Elas não viram lixo por ter havido decisão: são o registro de por que a decisão é essa, e é o que impede alguém em três meses reabrir a discussão do zero. O padrão é o mesmo que você já usou em D7.
3. **Matriz por tipo (linhas 147-156):** a linha "DANFE de entrada (PDF)" hoje diz "depende da seção Extração de PDF". Agora ela depende de uma **onda posterior com pdf.js no navegador**. Diga isso.
4. **Risco R6:** deixou de ser "sem rota viável de PDF→texto" em aberto e passou a ter encaminhamento decidido. Atualize a mitigação. Se, na sua avaliação, R6 deve ser rebaixado ou reformulado, é decisão sua — declare.
5. **Sequência sugerida, passo 5:** hoje diz "bloqueada pela decisão do usuário". Não está mais bloqueada; está **agendada** como pdf.js no navegador.
6. **Consequência arquitetural da Opção A, e é aqui que quero seu julgamento, não só sua caneta.** Você mesmo escreveu que a Opção A "move responsabilidade para o frontend" e que "o servidor perde a capacidade de reconferir o texto contra o arquivo armazenado, o que enfraquece a trilha de auditoria". **Isso agora é decisão tomada, não hipótese.** Registre o que essa perda significa para o desenho — se muda algo no contrato de extração, se a proposta precisa marcar que o texto veio do cliente e não do servidor, e se isso interage com R1 (injeção de prompt), já que o texto passa a ser produzido em ambiente que o servidor não controla. **Se você concluir que isso exige salvaguarda nova, proponha — não implemente, e me diga se acha que muda a onda 1.**

**Fora do entregável:**

- Reabrir D1-D8 ou QA-1 a QA-4.
- Apagar as opções, a evidência do Lantern ou as ressalvas de LGPD e AGPL.
- Código, migration, story, epic.
- Editar arquivo de outro dono.

**Definição de pronto:** o ADR não declara mais decisão de produto pendente, a decisão do usuário está registrada com data e atribuição, os quatro pontos afetados estão coerentes entre si, e você me reportou.

## 4. Contexto verificado e uma correção de linguagem que eu te devo

| Afirmação | Fonte | Estado medido por mim hoje | Como reverificar |
|---|---|---|---|
| ADR ainda declara pendência | `docs/architecture/ai-document-ingestion-p3.md:4` | "Uma decisão de produto pendente" presente | ler a linha |
| QA-1 a QA-4 estão fechadas | mesmo arquivo, seção "Questões resolvidas" | as quatro resolvidas | ler a seção |
| Passo 5 marcado como bloqueado | mesmo arquivo, linha 334 | "bloqueada pela decisão do usuário" | ler a linha |

**A correção que eu te devo, sobre a linha 212.** O ADR diz hoje: *"AGPL contamina SaaS fechado. Isto é risco legal, não preferência técnica."* O Quill apontou, ao auditar meus briefs, que essa formulação é **conclusão jurídica** — e nem você nem eu somos autoridade para emiti-la. O conteúdo factual está certo e é importante: a AGPL-3.0 impõe obrigação de disponibilizar o código-fonte a quem usa o software pela rede, e a Artifex vende licença comercial exatamente para quem não quer essa obrigação. **Reformule para descrever a obrigação e encaminhar a avaliação a quem tem competência para dá-la**, em vez de afirmar o efeito jurídico como fato estabelecido. A recomendação prática — não usar `mupdf.js` sem licença — não muda em nada. A responsabilidade pela formulação anterior é minha tanto quanto sua: eu revisei o ADR e deixei passar.

**Este brief não é prova.** Reverifique tudo que sustentar sua decisão, inclusive o que afirmo ter medido.

## 5. Contratos fechados e liberdades

**Fechado:**

- A escolha é do usuário: **E agora, A depois.** Não é para reavaliar, mesmo que apareça evidência nova — evidência nova volta para mim e eu levo a ele.
- As cinco opções e a evidência do Lantern permanecem no documento.
- Nada de foto, escaneado, extrato ou NF-e de saída.

**Seu:**

- Como redigir e onde exatamente encaixar.
- Se R6 é rebaixado, reformulado ou mantido com mitigação nova.
- Se a perda de auditoria da Opção A exige salvaguarda — e qual, como **proposta**.
- Formulação nova do parágrafo da AGPL.

**Bloqueia:**

- Se concluir que a Opção A tem consequência que o usuário não foi informado ao decidir — **pare, me diga, eu levo a ele.** Ele decidiu com base nas suas cinco opções; se havia consequência não listada, ele decidiu com informação incompleta e precisa saber.

## 6. Fronteiras duras e autoridade

**Pode tocar:** `docs/architecture/ai-document-ingestion-p3.md` — seu arquivo, edição cirúrgica nos pontos da seção 3.

**Não pode tocar:**

- `supabase/` — a Cistern está trabalhando lá agora
- `src/` — nada
- `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` — da Uma
- `docs/research/...` — do Lantern
- Epic e stories — do Helm, do Loom, do Ledger
- Gate e QA Results — **exclusivos do Beacon (`@qa`)**
- `git push`, `gh pr create` — **exclusivos do Anchor (`@devops`)**
- **Nenhuma migration aplicada.** Nem no-op. Não é sua tarefa, e se virar, pare e me chame.

## 7. Gates

| Gate | Evidência | Baseline | Alvo |
|---|---|---:|---:|
| Decisões de produto pendentes no ADR | leitura da linha 4 | **1** | **0** |
| Pontos afetados atualizados | cabeçalho, seção PDF, matriz, R6, sequência | 0/5 | **5/5** |
| Opções e evidência do Lantern preservadas | leitura | 5 opções | 5 opções |
| Conclusão jurídica afirmada como fato | leitura do parágrafo AGPL | **1** | **0** |
| Arquivos de outros donos alterados | `git status --short` | — | **0** |

## 8. Formato do retorno a Orion

1. Resultado em uma frase.
2. Os pontos exatos que você alterou, por linha ou seção.
3. Sua conclusão sobre a perda de trilha de auditoria da Opção A: muda o desenho, exige salvaguarda, ou é aceitável como está — e se muda algo na onda 1.
4. O que você fez com R6.
5. A nova redação do parágrafo da AGPL.
6. O que reverificou deste brief e onde eu estava errado, se estive.
7. Questões abertas e riscos.

## 9. Nota de método

Este brief está em arquivo e o Maestri levou só o ponteiro. É a correção de uma falha minha da sessão passada: briefs longos enviados direto chegaram mutilados a você e ao Prism, sem erro e com exit 0 — você chegou a pedir "o resto do addendum". **Efeito confirmado; causa não provada.** Nunca separei falha de transporte de falha na composição do comando. Brief em arquivo resolve as duas hipóteses, e é por isso que a correção é boa mesmo sem o diagnóstico fechado.

Se este brief chegar incompleto ou fizer referência a algo que você não consegue localizar, **me avise antes de trabalhar em cima dele.**
