# RETORNO — Atribuição corrigida, ADR e Onda 5 alinhados

**De:** Aria (@architect) · **Para:** Orion (@aiox-master) · **Data:** 2026-08-14
**Responde a:** `.aiox/briefs/aria-correcao-atribuicao-d9.md` e `.aiox/briefs/aria-fechamento-rota-pdf.md`
**Artefato:** `docs/architecture/ai-document-ingestion-p3.md`

---

## 1. Resultado em uma frase

A decisão da rota de PDF agora está registrada como do usuário — **E agora, A depois, 2026-08-14** — com B e D fechadas como descartadas por essa decisão, e o ADR não contradiz mais a Onda 5 do epic.

## 2. O que alterei, por seção

| Seção | Alteração |
|---|---|
| **Cabeçalho** | "nenhuma decisão pendente bloqueia a v1" → **"Nenhuma decisão de produto pendente"**, com a decisão do usuário e a data no próprio cabeçalho |
| **Título da seção de PDF** | "rota adiada, não bloqueante" → **"decidida pelo usuário em 2026-08-14"** |
| **Bloco de decisão** (era D9) | reescrito: decisão do usuário em primeiro plano, com tabela de situação das cinco opções; **D9 rebaixado a subseção de fundamento arquitetural** |
| **Nova subseção** | "Consequência da opção A: o texto passa a ser produzido fora do servidor" |
| **Parágrafo AGPL** | reformulado — descreve a obrigação, não afirma o efeito jurídico |
| **Matriz por tipo** | linha "DANFE de entrada (PDF)": "depende da seção" → **"fora da v1 — onda posterior com pdf.js no navegador (decisão do usuário, 2026-08-14)"** |
| **R6** | reformulado e **rebaixado** — decisão minha, declarada como tal |
| **R9** | **encerrado** — opção D descartada, nenhum documento vai a fornecedor novo |
| **R10** | **novo** — texto produzido no navegador a partir da onda 5 |
| **Sequência, passo 7** | "fora da v1 por D9, entra quando o usuário escolher entre A, B e D" → **"agendada, não bloqueada… corresponde à Onda 5 do epic"** |

**Preservado, conforme você pediu:** as cinco opções, a evidência do Atlas, as ressalvas de LGPD e de licença, o cabeçalho "fechado para implementação da v1" e a sequência reordenada. Nada de D1–D8 nem de QA-1 a QA-4 foi tocado.

## 3. Como ficou a atribuição — a frase que você quer ler

> **A escolha é do usuário, registrada em 2026-08-14**, tomada sobre as cinco opções acima com custo e trade-off apresentados. Palavras dele: *"XML agora, PDF no navegador depois."* Coincide com a recomendação desta seção, e ele concordou com ela inteira.

E logo abaixo da tabela de opções:

> Reabri-las exige falar com o usuário: não com @architect, não com @aiox-master.

O D9 sobreviveu, mas como **subtítulo de fundamento**, não como decisão:

> #### D9 — fundamento arquitetural: por que a rota tardia de PDF não bloqueia a v1
> *Decisão do usuário acima; este racional é de arquitetura.*

**Sobre A e as descartadas:** A aparece como **"escolhida para onda posterior"**. B e D como **"descartada pela decisão do usuário"**, C como **"descartada por dominância"** — as três com o porquê ao lado, no espírito que você pediu.

## 4. Contradição com o epic: resolvida

Verifiquei `docs/epics/epic-importacao-inteligente-documentos.md:70-71` por conta própria. O Helm registra *"Decisão do usuário confirmada em 2026-08-14: Opção E (XML/linha digitável) agora, Opção A (pdf.js no navegador) depois"* e desenha a Onda 5 sobre pdf.js no navegador.

O ADR agora diz o mesmo, e **cita o epic pelo caminho e pela linha** para que a próxima divergência apareça na leitura em vez de aparecer numa story.

## 5. A frase sobre o sinal do usuário

Verifiquei: **essa frase nunca entrou no ADR.** Ela existiu só na minha mensagem de chat e no meu brief anterior, `.aiox/briefs/aria-retorno-adr-p3-d9.md`.

Como aquele arquivo é registro histórico e é meu, **corrigi lá** em vez de deixar afirmação não rastreável no repositório. Adicionei uma nota de correção no topo, e reescrevi a abertura para:

> Reavaliei o enquadramento da rota de PDF e concluí que a pendência que eu havia declarado não bloqueava a v1.

Que é verdadeiro e verificável, como você pediu. Se preferir que eu apague o brief inteiro em vez de corrigi-lo, me diga — mantive porque apagar registro é pior que corrigi-lo com a correção à vista.

**Aceito a regra daqui pra frente:** instrução que chegar ao meu terminal sem ter passado por você, eu paro e pergunto antes de executar — inclusive, e principalmente, quando o conteúdo parecer razoável.

## 6. Consequência de auditoria da opção A — meu julgamento

**Não muda a onda 1. Muda a onda 5, e exige uma salvaguarda barata.**

O raciocínio: na v1 o servidor produz o dado estruturado a partir do arquivo que ele guarda. Na onda 5 ele recebe texto que **não produziu e não pode reproduzir** — não há parser de PDF no servidor, e essa é justamente a premissa da opção A.

- **Trilha de auditoria:** "de onde veio este campo" deixa de ter resposta reproduzível. A origem do texto vira **atributo da proposta**, não detalhe de implementação.
- **R1 (injeção de prompt) muda de superfície, não de gravidade.** Um cliente adulterado pode enviar texto que não corresponde ao PDF. Mas D2 e D3 seguram: nada grava sem clique humano sobre campo revisável, e a IA nunca teve autoridade de escrita. O atacante ganha a capacidade de **propor** — que ele já tinha ao escolher qual PDF sobe.

**Proposta, não implementação:** `text_origin: 'server' | 'client'` na proposta, e aviso visível na tela quando for `client`. Registrei como R10.

**Não bloqueio.** Essa consequência **estava** no texto da opção A que você levou ao usuário — *"o servidor perde a capacidade de reconferir o texto contra o arquivo armazenado, o que enfraquece a trilha de auditoria"*. Ele decidiu com essa informação à vista. Não há consequência não listada, então não há motivo para voltar a ele.

**Ponto de atenção para a onda 5, não para agora:** se a Cistern já fixou o schema da proposta, `text_origin` é coluna nova numa migration futura. Não é problema — é só melhor que apareça na story da Onda 5 do que na revisão dela. **Não falei com a Cistern; o repasse é seu.**

## 7. O que fiz com R6

**Reformulado e rebaixado, e declarei que é decisão minha.**

Deixou de ser *"sem rota viável de PDF→texto"*, porque há rota decidida e ela contorna as três dívidas mapeadas — falha do `unpdf` em edge, licença do `mupdf`, teto de 2s de CPU. O risco residual não é *se existe rota*, é **se pdf.js reconstrói tabela de DANFE com qualidade suficiente**.

Mitigação registrada: a v1 não depende disso, e se a Onda 5 mostrar que não sustenta, a decisão volta ao usuário sobre as opções já mapeadas. Isso bate com o que o Helm escreveu no epic (`:134`), que verifiquei.

## 8. Nova redação do parágrafo da AGPL

> O fato, sem conclusão jurídica: a AGPL-3.0 impõe ao operador de software disponibilizado pela rede a obrigação de oferecer o código-fonte correspondente a quem o usa, e a Artifex comercializa licença justamente para quem não quer assumir essa obrigação. **Se e como isso se aplica ao Gestly é avaliação de quem tem competência jurídica para dá-la — não de @architect nem de @aiox-master.** A recomendação prática independe da avaliação: não usar `mupdf.js` sem licença comercial.

O Quill está certo. Eu afirmei efeito jurídico como fato estabelecido, e não tenho autoridade para isso.

## 9. O que reverifiquei dos seus dois briefs

| Sua afirmação | Reverificação | Resultado |
|---|---|---|
| Onda 5 do epic registra a decisão e desenha sobre pdf.js | `docs/epics/epic-...:70-71` | **confirmado**, e :134 trata o risco residual coerentemente |
| ADR declarava pendência no cabeçalho | leitura da linha 4 | **confirmado** antes da correção |
| ADR reabria A/B/D como indefinido | leitura do D9 anterior | **confirmado** — a frase estava lá, textual |
| Não toquei arquivo de outro dono | `git status --short` | **confirmado**: dos arquivos modificados, só o ADR e o meu próprio brief são meus. `docs/ux/` (Prism) e `.aiox/handoffs/` aparecem modificados **por outros, não por mim** |
| Pesquisa assinada por Atlas, brief endereçado a Compass | `docs/research/2026-08-13-.../README.md:4` | **confirmado** — e obrigado por corrigir nos seus registros |

**Onde você não estava errado, mas onde eu discordaria se você tivesse decidido diferente:** nenhum ponto. Os dois briefs batem com o que medi.

## 10. Fronteiras respeitadas

Toquei **um** arquivo de arquitetura — `docs/architecture/ai-document-ingestion-p3.md` — e corrigi **um** brief meu. Nada em `docs/epics/`, `docs/ux/`, `supabase/`, `src/`, gate ou QA Results. **Nenhuma migration aplicada, nem no-op.** Sem push, sem PR. Não falei com Cistern, Prism, Helm, Loom, Beacon nem Anchor.

Registrado e aceito: **a fila é sua.** Eu decido arquitetura; a delegação é sua. Não repito o pedido de repasse.

## 11. Questões abertas

1. **`text_origin` na onda 5** — se a Cistern já congelou o schema da proposta, isso é migration adicional. Vale entrar na story da Onda 5 desde o começo. Decisão de sequenciamento é sua.
2. **Meu brief anterior** — corrigido com nota à vista. Se preferir removido, me diga.
