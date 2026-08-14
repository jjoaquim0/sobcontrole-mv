# Padrão de brief de delegação AIOX

**Dono do padrão:** Orion (`@aiox-master`) · **Autor:** Quill (`@prompt-engineer`)

**Uso:** briefs enviados por Orion aos agentes do projeto SobControle

**Regra central:** um brief é bom quando o destinatário consegue executar corretamente sem recuperar contexto perdido, inventar contratos ou obedecer a uma autoridade indevida.

---

## 1. Como usar este padrão

Todo brief tem um único arquivo autoritativo em `.aiox/briefs/`. A mensagem enviada pelo Maestri contém somente o caminho desse arquivo e uma solicitação curta de confirmação semântica.

Três seções são obrigatórias em todo brief, por exigência expressa do usuário:

1. **Pedido original completo do usuário** — transcrição literal, sem resumo e sem reticências.
2. **Objetivo e contexto da tarefa** — resultado desejado, motivo, estado atual e relação com o pedido.
3. **Escopo esperado do entregável** — artefato, conteúdo, profundidade, formato, caminho e exclusões.

As demais seções são obrigatórias quando aplicáveis. Não deixe placeholders ou referências como “igual ao brief anterior”. Quando uma seção condicional não se aplicar, remova-a e registre a razão em uma linha de “Não aplicável”.

Se o pedido original completo não estiver disponível, **não escreva o brief**. Peça a Orion a fonte íntegra. Nunca reconstrua palavras do usuário por memória.

Não copie segredos, tokens ou dados pessoais desnecessários. Quando houver segredo no pedido, substitua somente o valor sensível por `[SEGREDO REDIGIDO]` e declare a redação.

## 2. Avaliação dos 10 atributos do charter de Orion

Nenhum dos 10 atributos da seção 11 de `docs/agents/orchestrator-charter.md` é supérfluo. Três são condicionais e um precisa de correção de formulação:

| # | Atributo atual | Tratamento neste padrão | Avaliação crítica |
|---|---|---|---|
| 1 | Contexto verificado | Manter, com fonte e método de reverificação | A justificativa “para ele não refazer” está errada. Contexto pré-verificado reduz descoberta redundante, mas não dispensa o executor de reverificar afirmações que afetam sua decisão. |
| 2 | Contratos fechados | Manter | Universal. O brief fecha o que já foi decidido e nomeia explicitamente o que o agente pode decidir. |
| 3 | Algoritmo determinístico | Condicional | Correto para execução com sequência definida. Em arquitetura, pesquisa ou UX, prescrever o algoritmo pode usurpar a decisão do especialista. |
| 4 | Fronteiras duras | Manter | Universal. Deve nomear arquivos, artefatos e operações proibidas. |
| 5 | Números de baseline | Manter, adaptado ao papel | Universal para gates mensuráveis. Não se inventa número para parecer preciso: primeiro se mede; em pesquisa, por exemplo, mede-se cobertura de claims/fontes e não “qualidade 10/10”. |
| 6 | Método proibido com substituto | Condicional | Obrigatório quando existe método arriscado conhecido. Sem risco concreto, vira ruído. |
| 7 | Restrições de autoridade | Manter e ampliar | Universal. Além de push/PR/migration, declarar o dono de story, gate, QA Results e decisões de arquitetura. |
| 8 | Transições de status | Condicional | Obrigatório em tarefas ligadas a story; não se aplica a uma pesquisa isolada ou documento exploratório sem story. |
| 9 | Verificação independente | Manter | Universal para fatos materiais recebidos de terceiros. |
| 10 | Bloqueio e escalada | Manter | Universal. Deve dizer qual lacuna bloqueia, o que pode continuar e que o retorno é sempre a Orion. |

Resultado da integração: **10/10 atributos preservados**; `#3`, `#6` e `#8` passam a ser condicionais, e `#1` deixa de sugerir confiança sem reverificação.

## 3. Template copiável

```markdown
# BRIEF — [verbo no infinitivo + resultado específico]

**ID:** [identificador estável]

**Versão:** [v1, v2...]

**De:** Orion (`@aiox-master`)

**Para:** [nome do terminal] ([@agente])

**Natureza:** [implementação | QA | arquitetura | pesquisa | UX | produto | dados | DevOps | prompt]

**Arquivo autoritativo:** `.aiox/briefs/[agente]-[assunto].md`

**Substitui:** [nenhum | caminho e versão substituídos]

**Story/epic:** [caminho e ID | não aplicável — motivo]

---

## 1. Pedido original completo do usuário — OBRIGATÓRIO

Transcrição literal e cronológica de todas as mensagens do usuário que criaram ou
alteraram o escopo. Não resumir, não corrigir a redação e não usar reticências.

> [pedido integral]

> [esclarecimento posterior integral, se alterou escopo ou decisão]

**Interpretação necessária:** [somente ambiguidades reais; separar interpretação de citação]

## 2. Objetivo e contexto — OBRIGATÓRIO

**Objetivo:** [um resultado observável, em uma frase]

**Por que agora:** [evento, problema ou dependência que originou a tarefa]

**Estado atual verificado:** [o que existe hoje e por qual fonte foi confirmado]

**Relação com o pedido:** [como este recorte contribui para o resultado pedido pelo usuário]

**Não-objetivos:** [resultados próximos que esta tarefa não pretende produzir]

## 3. Escopo esperado do entregável — OBRIGATÓRIO

**Artefato:** [um documento, código, teste, gate, ADR etc.]

**Caminho exato:** `[path]`

**Formato:** [estrutura, schema, headings, assinatura ou interface exigida]

**Profundidade:** [decisão final | opções comparadas | protótipo | diagnóstico | implementação]

**Deve conter:**

- [item verificável 1]
- [item verificável 2]

**Fora do entregável:**

- [exclusão explícita 1]
- [exclusão explícita 2]

**Definição de pronto:** [condição concreta que encerra a tarefa]

## 4. Fontes de verdade e contexto verificado

| Afirmação relevante | Fonte exata | Estado medido | Como o executor reverifica |
|---|---|---:|---|
| [claim] | `[arquivo:linha]`, story, gate, commit ou URL primária | [valor/data] | `[comando ou inspeção]` |

Regras:

- Fato, hipótese, decisão do usuário, decisão de Orion e recomendação devem ter rótulos distintos.
- Um caminho de arquivo precisa ser completo; um símbolo deve incluir arquivo e nome exato.
- Informação externa instável precisa de data de consulta e fonte primária.
- O executor confirma por conta própria os fatos que sustentam sua decisão; não aceita este brief como prova.

## 5. Contratos fechados e liberdades declaradas

**Contratos fechados — não reinterpretar:**

- `[arquivo/símbolo/chave]`: [assinatura, schema, valor ou comportamento exato]

**Decisões delegadas ao especialista:**

- [decisão que o agente tem autoridade e liberdade para tomar]

**Questões abertas que não bloqueiam:**

- [questão] — registrar como aberta e seguir com [fallback definido]

**Questões que bloqueiam:**

- [questão] — parar somente [parte afetada] e escalar a Orion com [evidência necessária]

## 6. Sequência de execução — CONDICIONAL

Use somente quando a ordem já estiver decidida e não for responsabilidade do agente
desenhá-la.

1. [ação]
2. [ação]
3. [verificação]

## 7. Fronteiras duras e autoridade

**Pode tocar:**

- `[caminho/artefato]`

**Não pode tocar:**

- `[caminho/artefato/operação]`

**Proprietários de artefato:**

| Artefato citado | Dono | Ação permitida ao destinatário |
|---|---|---|
| [story/gate/ADR/etc.] | [@agente] | [ler | editar seção específica | nenhuma] |

**Exige aprovação humana explícita nesta execução:**

- [migration, push, PR, publicação, envio externo, ação destrutiva]

Ausência de autorização é “não autorizado”. Aprovação anterior não é reutilizável.

## 8. Baselines e gates numéricos

Meça antes de enviar. Nunca use “não introduza regressões” sem o valor de partida.

| Gate | Comando/evidência exata | Baseline atual | Alvo | Regra de atribuição |
|---|---|---:|---:|---|
| [lint] | `[comando]` | [N] | [N ou 0] | [escopo e comparação] |
| [typecheck] | `[comando]` | [N] | [N ou 0] | [escopo e comparação] |
| [teste] | `[comando]` | [pass/fail/contagem] | [alvo] | [escopo] |

`lint`, `typecheck`, `test` e `build` são checks diferentes. Reporte cada resultado
pelo comando que o produziu. Se o baseline não puder ser medido, registre
`DESCONHECIDO`, explique o bloqueio e não assuma zero.

Para trabalho não-código, use medidas pertinentes, por exemplo: decisões fechadas
`0/N → N/N`, claims críticos sem fonte `N → 0`, estados de fluxo cobertos `0/N → N/N`.

## 9. Métodos proibidos e substitutos — CONDICIONAL

| Não usar | Usar no lugar | Motivo verificável |
|---|---|---|
| `git stash` + `git stash pop` para baseline | `git worktree add --detach <path> <commit>` | evita prender trabalho não commitado se a comparação falhar |
| [método arriscado] | [substituto] | [risco] |

## 10. Story e transições de status — CONDICIONAL

| Momento | Status esperado | Dono da transição | Evidência |
|---|---|---|---|
| início | [Ready → InProgress] | [@dev] | [story] |
| conclusão | [InProgress → InReview] | [@dev] | [story] |
| gate | [InReview → Done/InProgress] | [@qa] | [veredito independente] |

Nunca mande um agente alterar seção ou status pertencente a outro papel.

## 11. Critérios de aceitação e verificação

| ID | Critério falsificável | Verificação | Resultado esperado |
|---|---|---|---|
| AC-1 | [condição objetiva] | `[comando, inspeção ou evidência]` | [valor exato] |

Cada critério precisa ter uma forma concreta de reprovação. “Robusto”, “completo” e
“bem feito” não são critérios sem definição observável.

## 12. Bloqueios, escalada e aprovações

- Ao bloquear: não invente, preserve o trabalho válido e reporte a Orion.
- Informe: ponto exato, evidência, impacto, o que já foi tentado e menor decisão necessária.
- Continue apenas nas partes independentes do bloqueio.
- Não fale com outro agente. Orion coordena dependências e conflitos.
- Se uma ação exigir humano, pare antes da ação e peça a Orion que obtenha autorização.

## 13. Formato do retorno a Orion

1. Resultado em uma frase.
2. Caminhos dos artefatos criados ou alterados.
3. Baseline versus resultado de cada gate, com comandos separados.
4. Decisões tomadas dentro da liberdade delegada.
5. Questões abertas, riscos e bloqueios.
6. Ações que ainda exigem aprovação humana.

## 14. Recomendações fora do pedido

Somente itens não solicitados, separados do escopo obrigatório e identificados como
recomendação. Não implementar sem nova decisão de Orion/usuário.
```

## 4. Variações por tipo de agente

O corpo comum permanece. A tabela abaixo indica o que deve ganhar ênfase; não cria prompts paralelos nem reduz as três seções obrigatórias.

| Destinatário | Acrescentar ou enfatizar | Baseline/alvo típico | Fronteira ou autoridade crítica |
|---|---|---|---|
| `@prompt-engineer` (Quill) | fontes reais, executor final, falha que o prompt deve prevenir, formato de entrega a Orion | atributos cobertos `N/10 → 10/10`; critérios sem verificação `N → 0` | produz instruções; não implementa, não edita story/gate e não fala com executores |
| `@architect` (Aria/Compass) | decisões a fechar, constraints, opções a comparar, trade-offs, ADR e perguntas abertas | decisões fechadas `0/N → N/N`; claims sem fonte `N → 0` | decide arquitetura; não implementa e separa recomendação de requisito |
| `@analyst` (Atlas/Lantern) | perguntas de pesquisa, recorte temporal/geográfico, prioridade de fonte primária, matriz claim→fonte, achados `NÃO ENCONTRADO` | claims críticos com fonte primária `N/M → M/M`; claims sem fonte `N → 0` | pesquisa não vira decisão de produto/arquitetura; incerteza não vira fato |
| `@ux-design-expert` (Uma/Prism) | usuário e job, fluxos/estados/erros, padrões existentes, acessibilidade, decisão pedida versus exploração | estados cobertos `0/N → N/N`; requisitos de acessibilidade cobertos `0/N → N/N` | não implementar em `src/`; não congelar contrato de domínio ainda provisório |
| `@pm` (Morgan/Helm) | problema, resultado de negócio, segmentos, métricas, restrições e priorização | outcomes com baseline `N`; requisitos sem rastreio `N → 0` | não inventar solução técnica nem alterar gate |
| `@po` (Pax/Ledger) | PRD/epic fonte, rastreabilidade, AC falsificáveis, dependências, Definition of Ready | AC verificáveis `N/M → M/M`; ambiguidades bloqueantes `N → 0` | dono de escopo/AC e transição Draft→Ready; não implementa nem dá gate de QA |
| `@sm` (River/Loom) | fonte do requisito, decomposição, sequência, riscos e estrutura da story | requisitos rastreados `N/M → M/M`; tasks cobertas `N/M → M/M` | cria/refina story; não implementa e não aprova qualidade |
| `@dev` (Dex/Forge) | story exata, contratos de código, arquivos permitidos, algoritmo decidido, testes e baselines separados | lint/typecheck/test/build medidos individualmente; regressão nova `0` | sem push/PR/migration aplicada; não edita QA Results nem gate |
| `@qa` (Quinn/Beacon) | matriz requisito→teste, riscos, comandos, baseline de referência e independência de veredito | falhas por comando antes/depois; AC cobertos `N/M → M/M` | o brief nunca exige PASS/FAIL; `@qa` é dono do veredito, QA Results e gate |
| `@data-engineer` (Dara/Cistern) | snapshot do schema, DDL/RLS/RPC, tenant boundary, rollback e teste negativo cross-tenant | políticas/testes `N/M → M/M`; vazamentos cross-tenant aceitos `0` | pode propor migration; aplicar migration exige aprovação humana explícita sempre |
| `@devops` (Gage/Anchor) | branch, SHA, remote, ação remota exata, gates prévios e plano de recuperação | gates aprovados `N/M → M/M`; divergência local/remoto medida | único autorizado para push/PR/release/MCP; ainda precisa de autorização humana para publicar; não contornar o guard de identidade |

Orion é o operador deste padrão e a única rota entre agentes. Um brief para Orion não é delegação de executor; é entrega do Quill e segue o formato definido no charter do prompt engineer.

## 5. Checklist pré-envio

### Fonte e precisão

- [ ] Li integralmente o pedido original, story, gate, código, commit e documento citados que afetam a tarefa.
- [ ] Copiei o pedido original completo, inclusive esclarecimentos posteriores que mudaram o escopo.
- [ ] Separei citação, fato verificado, hipótese, decisão e recomendação.
- [ ] Todo caminho, símbolo, chave, comando e owner está escrito de forma exata.
- [ ] Não há referência órfã como “o brief anterior”, “os cinco Ds” ou “perguntas 1, 4, 5 e 6”.
- [ ] Afirmações externas instáveis têm fonte primária e data; afirmações não confirmadas estão marcadas como tal.

### Execução e autoridade

- [ ] O objetivo cabe em uma frase e descreve resultado, não atividade vaga.
- [ ] O artefato, caminho, formato, conteúdo e exclusões do entregável estão explícitos.
- [ ] Contratos fechados e liberdades do especialista estão separados.
- [ ] Arquivos e operações proibidos estão nomeados.
- [ ] O dono de cada story, gate, ADR, migration ou decisão citado está declarado.
- [ ] Ações que exigem aprovação humana estão explícitas.
- [ ] Bloqueios dizem o que parar, o que pode continuar e como escalar a Orion.

### Qualidade e medição

- [ ] Cada gate mensurável tem comando/evidência, baseline atual e alvo.
- [ ] `lint`, `typecheck`, `test` e `build` não foram misturados.
- [ ] O executor foi instruído a reverificar fatos materiais.
- [ ] Cada critério de aceitação pode falhar de modo observável.
- [ ] Método arriscado conhecido está proibido pelo nome, com substituto seguro ao lado.
- [ ] Se houver story, todas as transições têm status e dono explícitos.

### Transporte pelo Maestri

- [ ] O brief íntegro está salvo como UTF-8 em `.aiox/briefs/<agente>-<assunto>.md`.
- [ ] Existe um único arquivo autoritativo; a versão nova declara o que substitui.
- [ ] Nenhum outro agente está editando o mesmo artefato de saída.
- [ ] A mensagem enviada é curta e contém somente caminho, obrigação de leitura integral e confirmação semântica.
- [ ] Após enviar, executei `maestri check "<Agente>"`.
- [ ] Confirmei no terminal que o agente abriu o caminho correto e entendeu **objetivo, entregável e principal fronteira**.
- [ ] Se houve confusão, interrompi antes da execução e substituí o brief inteiro; não mandei fragmentos incrementais.

Mensagem curta recomendada:

```text
O brief íntegro e autoritativo está em .aiox/briefs/<arquivo>.md. Leia o arquivo
inteiro antes de agir. Primeiro confirme: BRIEF_OK | objetivo em 1 frase |
entregável | principal fronteira. Depois execute.
```

Confirmação pelo orquestrador:

```powershell
maestri check "<Agente>"
```

Exit code `0` do envio confirma somente que o comando terminou; não confirma recepção íntegra nem compreensão.

## 6. Antipadrões

| Antipadrão | Como faz o agente errar | Correção |
|---|---|---|
| Prompt longo direto no `maestri ask` | Pode chegar truncado sem erro visível | Brief em arquivo; envio só do ponteiro; `maestri check` depois |
| Addendum dependente do fragmento anterior | O complemento herda exatamente o contexto que pode ter se perdido | Reemitir um brief completo, versionado e autocontido, que substitui o anterior |
| “Pedido completo” que é apenas um trecho | O agente otimiza para uma versão reduzida da intenção | Copiar todas as falas que criaram ou alteraram escopo |
| Referência órfã (“cinco Ds”, “perguntas do brief original”) | Obriga recuperação de contexto ou invenção | Repetir a lista, contrato ou pergunta no arquivo autoritativo |
| Inferência promovida a requisito | Uma interpretação do orquestrador vira falsa decisão do usuário | Rotular como hipótese, mostrar evidência e delegar/solicitar decisão |
| Hipótese enviada a outro agente como fato | Trabalho paralelo parte de contratos contraditórios | Marcar contrato provisório e dependência; não congelar destino antes do dono validar |
| Contexto “verificado” sem caminho exato | A reverificação custa busca desnecessária e pode abrir o arquivo errado | Informar `path:linha`, símbolo e comando |
| “Não introduza regressão” sem baseline | Não há estado comparável e a atribuição vira opinião | Medir antes; escrever atual, alvo, comando e escopo |
| Misturar lint, typecheck, test e build | Erro de um gate é atribuído a outro | Uma linha por comando, com resultado separado |
| Mandar o `@qa` chegar a um veredito | Produz PASS obediente, não avaliação independente | Dar critérios e evidência; reservar o veredito ao `@qa` |
| Restrição sem dono do artefato | O executor pode “ajudar” editando gate, story ou decisão alheia | Nomear proprietário e ação permitida |
| Proibição sem substituto | O agente repete o risco por hábito ou improvisa outro | Proibir método pelo nome e oferecer caminho seguro |
| Status implícito | Story permanece no estado anterior mesmo após o gate | Incluir transição, momento e dono |
| “Se bloquear, avise” | Não define o que é bloqueio nem o conteúdo do reporte | Definir gatilho, escopo afetado, trabalho que continua e evidência exigida |
| Elogio ou narrativa operacional no meio da instrução | Aumenta volume sem mudar decisão e esconde contratos | Manter somente contexto causal, decisões e critérios acionáveis |
| Recomendação misturada ao pedido | Viola No Invention e parece requisito aprovado | Seção separada; nenhuma implementação sem nova decisão |

## 7. Auditoria dos briefs desta sessão

### Baseline da auditoria

Em 2026-08-13/14, a pasta continha quatro arquivos de instrução relevantes:

| Arquivo | Palavras | Caracteres | Seções obrigatórias completas |
|---|---:|---:|---:|
| `compass-addendum-importacao-documentos.md` | 843 | 5.356 | **1/3** |
| `prism-ux-importacao-documentos.md` | 810 | 5.196 | **2/3** |
| `compass-insumo-pesquisa-lantern.md` | 934 | 5.911 | **1/3** |
| `quill-template-de-brief.md` | 623 | 4.084 | **3/3** |

Critério da última coluna: pedido original realmente integral; objetivo/contexto autocontido; escopo do entregável autocontido. Presença de um heading ou de uma citação parcial não conta.

### `compass-addendum-importacao-documentos.md`

**O que funciona:** hipóteses são frequentemente rotuladas; há boas perguntas de decisão; fronteiras, No Invention e reverificação independente aparecem; a questão do extrato recebe fallback explícito para não bloquear tudo.

**Falhas que podem mudar o resultado:**

1. O pedido original completo não está presente. Há três fragmentos de falas do usuário, mas não o pedido que originou a feature.
2. O arquivo se chama “addendum completo”, porém depende de contexto ausente: “os cinco Ds” e “as perguntas 1, 4, 5 e 6 do brief original” não são reproduzidos. Se o primeiro envio foi truncado, o segundo preserva a dependência no material perdido.
3. A fala `"foto nao"` sustenta a exclusão de foto. Ela **não sustenta sozinha** a conclusão adicional “PDF escaneado está fora”. Isso pode estar correto, mas precisa de citação adicional ou deve permanecer hipótese a confirmar.
4. “O ganho que ele busca é custo de token” estreita a fala “sair mais barato pra IA ler”. Custo total e tokens são relacionados, não idênticos; a redação correta é tratar redução de tokens como hipótese de mecanismo.
5. Os quatro tipos e seus destinos aparecem como decisões, mas a origem de cada decisão não é transcrita. A tabela de destinos é rotulada como hipótese — corretamente — porém o brief de UX recebeu a mesma tabela como fato antes da validação arquitetural.
6. O entregável não tem outline autocontido nem critérios de aceitação. O destinatário precisa reconstruí-lo por referências externas.
7. Não há baseline/alvo documental, como `decisões fechadas 0/N → N/N` ou `claims materiais sem fonte N → 0`, nem forma objetiva de validar a completude do ADR.
8. “Pergunta excelente” é cortesia sem função operacional. Em um canal sujeito a truncamento, cada frase precisa justificar seu espaço.

**Correção estrutural:** substituir o addendum por uma versão `v2` integral contendo pedido, objetivo, todas as perguntas, outline do ADR, contratos provisórios e critérios de aceite. Não anexar mais fragmentos.

### `prism-ux-importacao-documentos.md`

**O que funciona:** a desambiguação de “cliente” é excelente; o brief foca o risco real da confirmação humana; pede estados felizes e de erro; exige decisão em vez de leque; inclui acessibilidade, tema, fronteiras e um entregável único.

**Falhas que podem mudar o resultado:**

1. A seção “nas palavras dele” não contém o pedido original completo. Ela omite o início (“preciso da criação da minha importação de documentos”) e o pedido de uso do time/Maestri/agentes.
2. `documentService.ts` e `documentDomain.ts` estão sem caminho. Os caminhos exatos são `src/services/documentService.ts` e `src/services/documentDomain.ts`. As afirmações de upload na linha 308, formatos e teto de 10 MB foram confirmadas nesses arquivos, mas o brief aumenta desnecessariamente o custo de reverificação ao omitir o path.
3. Repete a inferência não demonstrada “sem PDF escaneado” a partir de `"foto nao"`.
4. A tabela “vira o quê no sistema” transforma destinos ainda provisórios em contrato fechado. O ADR posterior encontrou correções materiais: boleto exige fornecedor; contrato não fornece `ownerId`/`stageId`; extrato não tem entidade de destino no schema atual. O UX recebeu certeza onde a arquitetura ainda tinha hipótese.
5. Por consequência, a instrução “você não depende deles” é forte demais. O desenho dos estados pode ser independente, mas os campos e ações de confirmação dependem do contrato de domínio validado. O brief deveria separar o que pode avançar agora do que espera o ADR.
6. O caminho é somente `docs/ux/`; o nome do arquivo não foi fechado e a liberdade de escolhê-lo também não foi declarada.
7. Não há critérios falsificáveis nem baseline/alvo para os estados pedidos. Exemplo melhor: estados principais `0/5 → 5/5`, cada um com ao menos um caminho de erro; quatro tipos `0/4 → 4/4`; requisitos de acessibilidade `0/4 → 4/4`.
8. Não define bloqueio/escalada caso o fluxo dependa de campo ou destino ainda não decidido.

**Correção estrutural:** preservar o foco e a desambiguação, mas rotular o mapa de entidades como provisório, fechar o nome/outline do entregável e dividir decisões UX independentes das dependências arquiteturais.

### `compass-insumo-pesquisa-lantern.md`

**O que funciona:** é o mais forte em rastreabilidade técnica. Aponta o documento-fonte, traz caminhos e linhas, separa medições de estimativas e instrui “pendente de protótipo” no lugar de chute.

**Falhas que podem mudar o resultado:**

1. Como novo brief/addendum, volta a omitir o pedido original completo e um objetivo autocontido.
2. “Fronteiras inalteradas” depende de outro arquivo. As fronteiras críticas precisam ser repetidas integralmente em todo arquivo autoritativo.
3. Não declara caminho/versão do ADR nem lista de seções a atualizar; “o que eu quero do ADR agora” deixa a extensão da revisão implícita.
4. A frase “AGPL contamina” é linguagem jurídica conclusiva e imprecisa para uma decisão de arquitetura. O brief deve descrever a obrigação identificada, citar a licença e exigir revisão jurídica/humana, sem transformar o arquiteto em autoridade legal.
5. Há números técnicos de entrada, mas não baseline/alvo de conclusão do trabalho, nem critérios para dizer que o ADR incorporou corretamente o insumo.

**Correção estrutural:** incorporar este conteúdo como seção de evidência da versão integral do brief do Compass, em vez de manter uma cadeia de addenda.

### `quill-template-de-brief.md`

**O que funciona:** é o único dos quatro que contém as três seções obrigatórias completas; delimita claramente que o produto é documentação; nomeia fontes, entregável, fronteiras e exige crítica real.

**Ponto a corrigir em briefs futuros:** pede confirmação independente da causa do truncamento, mas não fornece transcript, log ou caminho de evidência de transporte. O repositório confirma apenas que Orion registrou o mesmo diagnóstico em mais de um documento. Sem evidência do terminal, o correto é marcar a causa como **plausível e ainda não provada**, não fabricar uma confirmação.

## 8. Diagnóstico do truncamento

Há três afirmações consistentes nos documentos locais: o mesmo texto teria chegado inteiro ao Lantern, parcial ao Compass e reduzido a uma palavra ao Prism; o comando teria retornado exit code `0`; e o Prism teria reagido ao fragmento “cliente”. Não foi encontrado no repositório um transcript ou log independente do terminal que demonstre esses eventos.

Conclusão falsificável:

- **A redação integral do brief de Prism não explica uma recepção de uma palavra.** Se o terminal recebeu apenas “cliente”, houve falha de transporte ou de composição do comando antes da entrega.
- **Os arquivos disponíveis não provam qual dessas duas etapas falhou.** O diagnóstico “`maestri ask` trunca” permanece plausível e coerente com o relato, mas não verificado de forma independente nesta auditoria.
- **Há também falhas de redação reais**, porém diferentes: contexto incompleto, dependências órfãs e hipótese promovida a fato. Elas poderiam causar execução errada mesmo com transporte perfeito.

O controle correto cobre as duas classes: brief completo em arquivo para reduzir risco de transporte, e `maestri check` com confirmação semântica para provar recepção e entendimento.

## 9. Gate deste padrão

Baseline antes desta entrega:

- Template padrão em `docs/agents/`: `0 → 1`.
- Exigências obrigatórias formalizadas: `0/3 → 3/3`.
- Atributos da seção 11 avaliados e integrados: `0/10 → 10/10`.
- Tipos de agente com variação explícita: `0/11 → 11/11`.
- Briefs da pasta auditados: `0/4 → 4/4`.

Verificação mínima após qualquer alteração deste arquivo:

1. Confirmar que as três seções obrigatórias continuam no template.
2. Confirmar que os 10 atributos continuam avaliados.
3. Confirmar que as 11 variações de agente continuam presentes ou que a remoção tem justificativa.
4. Rodar `git diff --check -- docs/agents/brief-template.md`.
