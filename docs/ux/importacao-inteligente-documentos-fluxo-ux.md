# Fluxo de UX — Importação Inteligente de Documentos

**Autora:** Uma / Prism (@ux-design-expert) · **Para:** Orion (@aiox-master)
**Origem:** `.aiox/briefs/prism-ux-importacao-documentos.md`
**Natureza:** design de fluxo. Não contém código, não altera nada em `src/`.
**Status:** pronto para arquitetura (Compass) e extração técnica (Lantern) validarem viabilidade.

---

## 0. Pedido, na íntegra

> "cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema"

Leitura operacional: a "pergunta se pode integrar" do usuário **não é um sim/não de chat**. Virar um "sim" único cobrindo nota fiscal + fornecedor + compra + estoque + contas a pagar de uma vez é exatamente o risco que o próprio brief aponta — aprovar dado errado sem enxergar campo a campo. Por isso a "pergunta" é operacionalizada como **a tela de revisão** (seção 3), não como uma mensagem de chat com dois botões.

---

## 1. Contexto confirmado por conta própria

Não aceitei o contexto do Orion sem checar. Confirmei e encontrei mais:

| Do brief | Confirmado | Adicional que encontrei |
|---|---|---|
| Módulo Documentos existe | ✅ `src/pages/documents/` | Upload já valida tipo/tamanho em `documentDomain.ts` (`validateDocumentFile`), 10 MB, 9 MIME types |
| `AiSiteIntegrationAction` é placeholder | ✅ | Renderiza no slot exato `item.state === 'success'` do `DocumentUploadModal` (linha 155) — é o gancho natural para a nova ação |
| Categorias de documento | — | `DOCUMENT_CATEGORIES` já tem `nota_fiscal`, `boleto`, `contrato`. **Não existe `extrato`** — precisa ser criada na taxonomia (ver §10) |
| Tipos de relação | — | `DOCUMENT_RELATION_TYPES` já cobre `customer`→Cliente, `supplier`→Fornecedor, `purchase`→Compra, `deal`→Oportunidade — o vocabulário dos 4 tipos de documento já existe no domínio |
| Tema claro/escuro | ✅ | — |
| IA Gestly já existe | ✅ `GestlyPage.tsx` | Marca visual própria: gradiente `#0B2551 → #00d2ff`, ícone `Sparkles`, distinta do verde `#10b981` usado no resto de Documentos |
| Padrão de confiança | não mencionado no brief | **Já existe precedente no código**, duas vezes: `TaxConfidenceCard.tsx` (cobertura/erro medido) e `RecommendationCard.tsx` (`alta`/`média`/`baixa`, emerald/amber/gray). Vou reaproveitar esse vocabulário visual, com um ajuste justificado (§3.3) |
| Padrão de preview de documento | não mencionado | `DocumentPreviewModal.tsx` já renderiza o arquivo (PDF/imagem) — a visualização lado a lado reaproveita esse componente, não recria um viewer |

---

## 2. Fluxo completo em estados

```
 [ocioso] ──upload──▶ [enviando] ──sucesso──▶ [classificando] ──▶ [extraindo] ──▶ [revisão] ──confirmar──▶ [gravando] ──▶ [concluído]
     │                    │                        │                  │              │                        │
     │                falha upload            não reconhece      falha leitura    (usuário edita          falha na escrita
     │                (reaproveita erro         o tipo de doc     (PDF sem texto,   e resolve alertas        (ver §4 — escrita
     │                 já existente do           │                 corrompido,      antes de habilitar        deve ser atômica)
     │                 DocumentUploadModal)      ▼                 vazio)           "Gravar")                  │
     │                                    [tipo manual]              │                  │                       ▼
     │                                    usuário escolhe        [erro de leitura] │              [erro de gravação]
     │                                    nota fiscal/boleto/     "salvar só o          │              "nada foi gravado,
     │                                    extrato/contrato        arquivo, sem           │               tente novamente"
     │                                    ou "não sei, salvar     dados" ou              │              + link para o doc
     │                                    só o arquivo"           "tentar de novo"       │              já salvo intacto
     └────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                                     documento sempre fica salvo, mesmo se a IA falhar
```

| Estado | O que a tela mostra | Transição de saída | Caminho de erro |
|---|---|---|---|
| **Ocioso** | Documentos: botão "Importar com IA" ao lado do upload normal. Gestly (chat): clipe de anexo na composer. Ver §7 sobre a convivência com "Integrar ao site com IA". | Arquivo solto/selecionado | — |
| **Enviando** | Reaproveita 100% o `DocumentUploadModal` atual (drag&drop, barra de progresso, `aria-live="polite"`). Nada novo aqui. | Upload concluído | Erro de tipo/tamanho já tratado hoje por `validateDocumentFile` — sem mudança |
| **Classificando** | Selo "Detectando tipo de documento…" sobre o preview do arquivo já salvo. Rápido (segundos); pode ser fundido visualmente com "Extraindo" se a IA fizer as duas coisas numa chamada só — **decisão de implementação de Lantern/Compass, não minha** | IA identifica o tipo com confiança suficiente | Confiança baixa ou nenhum tipo bate → **estado "Tipo manual"**: chip com os 4 tipos + "Não sei / salvar só o arquivo". Usuário nunca fica travado sem saída |
| **Extraindo** | Preview do documento à esquerda (already-rendered, componente do `DocumentPreviewModal`), lado direito com skeleton nos campos esperados para aquele tipo de documento (já sabemos o formato antes da IA terminar) | Extração retorna (mesmo que parcial) | PDF sem camada de texto (imagem escaneada) → mensagem direta: **"Não conseguimos ler o texto deste arquivo. Ele parece ser uma imagem escaneada, e no momento não lemos PDFs escaneados."** com "Salvar só o arquivo" — nunca tentar "melhorar a imagem" (restrição do brief). Timeout/serviço indisponível → "Tentar novamente" ou "Salvar só o arquivo" |
| **Revisão** | **Seção 3 inteira.** Tela mais importante do fluxo. | Usuário clica "Gravar" após resolver alertas obrigatórios | Campo obrigatório vazio ou inválido bloqueia o botão "Gravar" (não é um erro pós-clique, é prevenção — ver §4) |
| **Gravando** | Estado curto, botão com spinner, tela travada (mesmo padrão de `canClose` do upload atual) | Escrita concluída | Ver §4 sobre atomicidade — se falhar, nada deve ficar pela metade |
| **Concluído** | Resumo do que foi criado/vinculado, com links diretos para os registros (fornecedor, compra, conta a pagar, etc.) | Usuário fecha ou importa outro documento | — |

**Princípio que atravessa todos os estados:** o arquivo é salvo no Storage assim que o upload termina (já é o comportamento hoje, `documentService.ts:308`), **antes** de qualquer tentativa de IA. Se a extração falhar, o pior caso é "documento salvo, sem dados estruturados" — nunca "documento perdido". Isso simplifica todos os caminhos de erro de leitura: o usuário nunca perde o arquivo, só perde a automação.

---

## 3. Tela de revisão — decisões

### 3.1 Lado a lado + rastreabilidade da origem

Decisão: **split view**, preview do documento à esquerda (reaproveita o componente de visualização do `DocumentPreviewModal` — não recriar um viewer), painel de campos extraídos à direita. Em telas estreitas, empilha (preview colapsa para um botão "Ver documento original").

Rastreabilidade tem dois níveis de fidelidade, porque não sei ainda qual a Lantern vai entregar:

- **Nível ideal:** ao focar/passar o mouse num campo, destaca a região correspondente no preview do PDF (precisa de coordenadas/bounding box na extração).
- **Nível mínimo aceitável:** se não houver coordenadas, cada campo tem um "Ver trecho original" que expande a citação exata do texto de onde o valor saiu (ex.: *"CNPJ: 12.345.678/0001-90"*). Isso não depende de coordenadas, só do texto bruto.

**Meu requisito não-negociável para Lantern/Compass:** mesmo sem bounding box, a extração precisa devolver o **trecho de texto de origem por campo**, não só o valor final. Sem isso não dá para responder "de onde veio" e a tela vira uma caixa-preta — o oposto do que o brief pede.

### 3.2 Edição — obrigatória, mas com atrito nos campos de risco

Confirmo a hipótese do Orion: sim, editável, sempre. Mas não como formulário totalmente aberto desde o início — isso convida a pular direto para "Gravar" sem ler.

Decisão: **dois comportamentos por tipo de campo**

- **Campos de baixo risco** (descrição, categoria, observações): já nascem como input editável comum, igual ao padrão do `DocumentUploadModal` hoje.
- **Campos financeiros/críticos** (valor, CNPJ/CPF, datas, quantidade, chave de acesso): nascem como um "chip de revisão" — valor extraído + selo de confiança, **somente leitura até o usuário tocar** ("toque para editar" com ícone de lápis visível, não escondido). Isso força uma leitura consciente do valor antes de qualquer edição ou confirmação, sem impedir a edição.
- Um toggle "Editar todos os campos" no topo da tela vira todos os chips em inputs de uma vez, para quem já revisou e só quer ajustar rápido — sem remover a barreira default.

### 3.3 Confiança por campo

Reaproveito o vocabulário visual que **já existe no projeto** (`RecommendationCard.tsx`, `TaxConfidenceCard.tsx`), com um ajuste que declaro explicitamente:

| Estado | Cor/ícone (herdado do projeto) | Comportamento |
|---|---|---|
| **Confirmado pela IA** (alta confiança) | Emerald, `CheckCircle2` — igual ao padrão existente | Chip somente-leitura, colapsado |
| **Revisar** (confiança média **ou** baixa) | Amber, `AlertCircle` | Chip já nasce **expandido em modo edição** — o usuário não precisa nem tocar, o campo já está pedindo atenção |
| **Não identificado** | Vermelho/rose, `FileWarning`, campo vazio | Obrigatório preencher — bloqueia "Gravar" enquanto vazio |

**Ajuste que faço conscientemente:** no `RecommendationCard`, "baixa confiança" é cinza neutro (significa "baixa prioridade de ação" — contexto de recomendação de compra). Aqui, colapsar média e baixa confiança na mesma cor amber é proposital: nesta tela, as duas exigem exatamente a mesma ação do usuário (olhar antes de confiar), então não faz sentido gastar duas cores para uma distinção que não muda o comportamento. Cinza para "baixa confiança" num contexto financeiro pareceria "sem problema", o oposto do que queremos sinalizar.

### 3.4 Extrato bancário — 80 lançamentos não se confirma um a um

Decisão (não é opção, é a solução): **tabela com aprovação em lote por exceção**, não confirmação individual.

- Todos os lançamentos chegam **pré-selecionados** para importar, **exceto** os que caem em confiança baixa/média ou parecem duplicados — esses vêm **desmarcados**, destacados em amber, e precisam ser abertos e resolvidos (editar e marcar, ou excluir da importação) antes de habilitar "Gravar".
- Cabeçalho fixo com o resumo: *"76 de 80 lançamentos com leitura de alta confiança. 4 precisam da sua atenção."*
- Ações em lote: "Selecionar todos", "Desmarcar todos", "Mostrar só os com alerta".
- Rodapé fixo (sticky) sempre visível durante o scroll da tabela: contagem do que será importado + valor total somado — a pessoa nunca aprova uma tabela de 80 linhas sem ver o total antes de gravar.
- Linhas de alta confiança são **display-only por padrão** (não abrem inputs de edição, só um clique em "editar" por linha se necessário) — evita 80 inputs renderizados ao mesmo tempo.

Isso resolve o requisito do brief sem pedir 80 decisões humanas: o humano decide sobre as 4 exceções, não sobre as 80 linhas.

### 3.5 Criado × Vinculado — sinalização visual

Cada bloco de dado extraído carrega um selo claro:

- 🆕 **"Novo — será criado"** (badge azul/violeta, cor nova e neutra, não usada em nenhum outro selo desta tela para não colidir com confiança) — ex.: um fornecedor que não existe na base.
- 🔗 **"Vinculado a [Nome do Fornecedor Existente]"** (badge com o nome do registro batido, clicável — abre uma prévia rápida do registro existente para confirmar que é o mesmo) — com uma ação secundária **"não é este? buscar outro"** que troca o vínculo por um seletor manual, e uma opção "criar novo mesmo assim" para o caso raro de homônimo.

Isso evita o erro mais silencioso do fluxo: vincular a compra a um fornecedor errado por coincidência de nome, sem o usuário perceber que era um vínculo automático.

### 3.6 NF-e — lista de itens em volume médio (5 a 30)

O padrão da §3.4 (lote por exceção) foi desenhado para o extrato, que saiu de escopo — mas o princípio central sobrevive e se aplica aqui: **a maioria dos itens não deveria custar uma decisão nenhuma; só a exceção custa.** A diferença é que aqui a exceção não é um booleano só. Cada item carrega duas perguntas independentes — **vincular a um produto existente ou criar um novo** e, se vinculado, **atualizar ou manter o custo do cadastro** —, e a segunda só existe quando a primeira aponta para um produto que já tem custo cadastrado e esse custo diverge do da nota.

Essa dependência entre as duas perguntas é o que evita a conta de "trinta itens, sessenta cliques" do brief: a decisão de custo não é universal, ela só aparece quando há de fato algo para decidir.

#### 3.6.1 Uma linha, as duas decisões juntas

Cada item é uma linha da tabela de itens (wireframe 8.1b). As duas decisões aparecem lado a lado na mesma linha, nunca em telas ou filtros separados — revisar um item cobre as duas perguntas dele de uma vez, não em duas passagens pela lista. O filtro "Mostrar só os com alerta" é uma **união**: entra na lista filtrada qualquer item que precise de decisão de vínculo **ou** de custo, então a passagem de exceção continua sendo uma só.

#### 3.6.2 Estados da linha

| Estado | Quando acontece | O que a tela mostra | Bloqueia "Gravar"? |
|---|---|---|---|
| **Resolvido, sem ação** | Vínculo de alta confiança e custo da nota igual ao do cadastro (ou produto ainda sem custo cadastrado) | Linha display-only, colapsada, ícone ✓ | Não |
| **Novo produto** | Sem correspondência confiável no cadastro | Chip "🆕 novo produto"; custo inicial = valor da nota — não é decisão, é a única fonte possível na primeira vez | Não |
| **Vínculo a revisar** | Correspondência de confiança média/baixa, **ou item sem GTIN** (nome/descrição sozinhos nunca bastam para vínculo automático — ver 3.6.3) | Linha expandida: candidato sugerido + "aceitar vínculo" / "buscar outro" / "criar novo mesmo assim" | Sim, até resolvida |
| **Custo divergente** | Item vinculado a produto existente e custo da nota ≠ custo do cadastro | Linha expandida: custo atual e custo da nota lado a lado, decisão obrigatória "manter" ou "atualizar" — **sem opção pré-marcada** | Sim, até resolvida |
| **Vínculo a revisar + custo divergente** | As duas condições acima, no mesmo item | Uma única linha expandida com as duas decisões empilhadas — nunca duas linhas | Sim, até as duas resolvidas |
| **Lista vazia** | IA não extraiu nenhum item da nota (ex.: nota de serviço, ou falha isolada na leitura da tabela de itens) | Cartão: "Não foi possível identificar itens nesta nota. Revise o restante dos dados — produtos podem ser lançados manualmente depois." | Não — itens são aditivos; não travam fornecedor, compra ou contas a pagar |

#### 3.6.3 Default seguro por item, e por quê

- **Vínculo:** confiança alta pré-seleciona "vinculado"; qualquer coisa abaixo disso — incluindo item sem GTIN, onde o casamento só pode se apoiar em nome/descrição — pré-seleciona **"criar novo produto"**. É o lado que erra para não gravar em cima de um registro existente por engano: um produto duplicado é um erro barato e reversível (mescla depois); um vínculo errado silencioso contamina estoque e histórico de custo de um produto que não tem nada a ver com a nota.
- **Custo, sem divergência:** nada a decidir — "sem alteração" é fato, não escolha.
- **Custo, com divergência:** **sem default.** Decisão obrigatória por item. Um default fixo — sempre atualizar ou nunca atualizar — resolveria a fadiga às custas do próprio risco que o brief chama de pior resultado possível: em qualquer um dos dois sentidos, algum subconjunto de notas vai deixar o custo do cadastro silenciosamente errado. Custa mais toques; é a conclusão que sustento.
- **Produto novo:** custo inicial = valor da nota. Não é "default de sobrescrever" — não há o que sobrescrever, é a primeira fonte.

#### 3.6.4 Por que resiste à aprovação sem leitura

Duas coisas, juntas:

1. **A tabela nunca deixa a exceção real invisível.** Diferente do extrato, aqui não existe um "selecionar todos" que varre a decisão de custo, porque essa decisão não tem estado pré-marcado para varrer. Um item com custo divergente só sai do caminho de "Gravar" bloqueado com um toque explícito naquele item.
2. **Atalho de lote só depois de uma decisão humana real, nunca antes dela.** No pior caso — um fornecedor reajusta o preço de tudo numa entrega, e os trinta itens divergem ao mesmo tempo — a regra "sem default" sozinha viraria trinta decisões idênticas. Resolvo isso sem inventar um default: depois que o usuário decide o **primeiro** item de um grupo de divergências no mesmo sentido (todas para cima, ou todas para baixo), a tela oferece, como sugestão — nunca como pré-marcação — **"Isso também vale para os outros N itens com o mesmo tipo de aumento? [Aplicar aos N] [Não, decidir um a um]"**. A decisão continua sendo do usuário: ele decide uma vez, de forma consciente, e escolhe estender essa decisão; o sistema nunca decide primeiro. Cada linha afetada continua individualmente reabrível antes de "Gravar".

#### 3.6.5 Acima do teto

Sem propor o número: acima do teto, a tela não tenta decompor os itens automaticamente. Fornecedor, compra e contas a pagar continuam sendo criados normalmente — não dependem dos itens. Um aviso declara o corte, no mesmo espírito de honestidade do campo `truncated` já usado para texto truncado na extração: *"Esta nota tem [N] itens, acima do que revisamos automaticamente aqui. Fornecedor e contas a pagar foram lançados; os produtos não foram adicionados ao estoque — lance-os manualmente."* Nenhum produto é criado ou vinculado sem revisão acima do teto; a degradação corta a automação do estoque, nunca a integridade dos outros dados.

**Acessibilidade:** a tabela de itens segue a mesma regra já fechada para a tabela de extrato em §6 — semântica de `<table>` real, não `<div>`s disfarçadas de tabela.

---

## 4. Prevenção de erro

O brief é direto: "valor financeiro errado aprovado por engano é o pior resultado possível." As decisões acima já carregam a maior parte da prevenção; reforçando o que é atrito **deliberado**:

1. **Campos financeiros nascem em modo leitura até serem tocados** (§3.2) — força olhar antes de decidir.
2. **Confiança média/baixa nasce expandida, nunca escondida atrás de um clique** (§3.3) — o usuário não pode ignorar por omissão.
3. **Tela de resumo antes de gravar**, separada da tela de edição de campos: *"Vou criar: 1 fornecedor, 1 compra, 3 produtos no estoque. Vou lançar: R$ 4.230,00 em contas a pagar."* Só depois desse resumo o botão final "Confirmar e gravar" aparece. Custa uma tela extra por importação (não por campo) — proporcional ao risco descrito no brief.
4. **Escrita atômica é requisito de UX, não só técnico:** os quatro tipos de documento gravam em múltiplas entidades (nota fiscal = fornecedor + compra + contas a pagar + produtos). Se a gravação falhar no meio, o usuário não pode ficar com metade dos registros criados e metade não — isso é pior que a falha original, porque ele não vai saber auditar o que ficou pela metade. **Repasso como requisito duro para o ADR da Compass:** a operação de gravação tem que ser tudo-ou-nada (transação única). Do lado da UX, o estado de erro de gravação assume que isso é verdade e diz sempre "nada foi gravado, o documento continua salvo, tente novamente."

O que **não** proponho: confirmação por digitação de valor ("digite R$ 4.230,00 para confirmar") ou segunda senha. É atrito desproporcional para o volume esperado (documentos administrativos recorrentes, não uma transação bancária única). As três camadas acima já cobrem o risco descrito.

---

## 5. Duplicidade

Dois níveis de confiança na detecção, com comportamento de interface diferente para cada um — porque tratar os dois como "duplicata" com a mesma força gera alarme falso:

- **Duplicata forte** (chave de acesso da NF-e repetida, linha digitável do boleto repetida, ou combinação data+valor+descrição idêntica numa linha de extrato): banner **bloqueante** no topo da tela de revisão, cor de alerta forte, com "Ver documento anterior" (abre o já existente) e "Enviar mesmo assim" como ação explícita separada do botão principal — nunca um checkbox discreto que passa despercebido.
- **Duplicata provável** (nome do cliente/fornecedor + valor parecidos, mas não uma chave exata — típico de contrato/proposta): banner **não bloqueante**, tom "atenção" em vez de "erro": *"Isto se parece com [Proposta X, enviada em 12/03]. Ainda assim é um documento novo?"* — dispensável com um clique, sem exigir justificativa.

A checagem acontece **depois** da extração (não no upload), porque a chave de comparação (chave de acesso, linha digitável, valor) só existe depois que o campo foi lido.

---

## 6. Acessibilidade

- **Teclado:** ordem de tab segue a ordem visual de leitura (campos antes do preview, com um link "Ver documento original" pulável no topo — quem usa teclado/leitor de tela não deveria precisar navegar pelo preview do PDF para revisar dados). Na tabela de extrato: setas para navegar entre linhas, Enter expande/edita a linha focada, Esc cancela a edição em andamento.
- **Leitor de tela:** cada transição de estado usa `aria-live="polite"` — mesmo padrão já usado no `DocumentUploadModal` hoje (`aria-live="polite"` na lista de itens). Ao entrar na tela de revisão, foco é movido programaticamente para o heading da tela ou para o primeiro campo sinalizado como "revisar" (o que precisa de atenção primeiro). Cada selo de confiança expõe o texto por `aria-describedby` — nunca só cor (o projeto já segue esse padrão em `RecommendationCard`, mantenho).
- **Contraste:** reaproveito as cores já validadas no projeto (emerald/amber/vermelho sobre fundo claro e escuro, classes `dark:` já testadas em `TaxConfidenceCard` e `RecommendationCard`) — não introduzo tons novos, exceto o azul/violeta do selo "Novo" (§3.5), que precisa ser validado contra WCAG AA em ambos os temas antes de virar código.
- **Tabela de extrato:** semântica de tabela real (`<table>`/`role="row"`/`role="gridcell"`) — não uma lista de `<div>`s disfarçada de tabela, para que leitor de tela anuncie linha/coluna corretamente durante a navegação em 80 itens.

---

## 7. Destino do `AiSiteIntegrationAction` — minha recomendação

O Orion pediu recomendação, não leque. Recomendo: **dois recursos que convivem, sem reaproveitar nem renomear o componente atual.**

Motivo: são domínios diferentes por trás de uma UI parecida. "Integrar ao site com IA" alimenta a base de conhecimento pública que responde perguntas de visitantes do site do cliente — a IA lê o documento para *conversar sobre ele*. "Importar com IA" (este brief) extrai dados estruturados para *virar registros no sistema* — fornecedor, compra, conta a pagar. Fundir os dois sob o mesmo rótulo confundiria o usuário sobre o que vai acontecer com o documento dele.

O que faço, então:

- **Mantenho `AiSiteIntegrationAction` intocado** — mesmo rótulo, mesmo ícone `Bot`, mesmo verde `#10b981`, ainda "Em breve".
- **Novo componente irmão**, mesma família visual (`rounded-xl`, mesmo slot de pós-upload onde `AiSiteIntegrationAction compact` já renderiza hoje em `item.state === 'success'`), mas com identidade própria emprestada da marca Gestly já existente no projeto: ícone `Sparkles`, acento no gradiente `#0B2551 → #00d2ff` (o mesmo do cabeçalho do `GestlyPage.tsx`) em vez do verde genérico de Documentos. Rótulo sugerido: **"Importar com Gestly"**.
- As duas ações convivem lado a lado no card de item enviado com sucesso — visualmente distintas o suficiente (cor, ícone) para que o usuário não confunda uma com a outra, mesmo estando na mesma posição da tela.

Isso é recomendação de design; a implementação (nome de arquivo, props) é decisão do @dev quando a story for criada.

---

## 8. Wireframes (ASCII)

### 8.1 Tela de revisão — Nota Fiscal (documento único)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✕  Revisar importação — Nota Fiscal (DANFE) detectada          [Trocar tipo] │
├───────────────────────────────┬───────────────────────────────────────────────┤
│                                │  🆕 Novo: Fornecedor                          │
│      [ preview do PDF ]       │  ┌─────────────────────────────────────────┐  │
│                                │  │ Razão social      ✓ Alta confiança      │  │
│   (rolável, com highlight     │  │ ACME Distribuidora Ltda                 │  │
│    da região do campo em      │  ├─────────────────────────────────────────┤  │
│    foco quando disponível)    │  │ CNPJ              ⚠ Revisar             │  │
│                                │  │ [12.345.678/0001-XX_______] ✎ editando  │  │
│  [Ver trecho original ▾]      │  │ "Ver trecho original: ...CNPJ:12.345..."│  │
│                                │  └─────────────────────────────────────────┘  │
│                                │  🔗 Vinculado: Compra → nenhuma anterior      │
│                                │  ┌─────────────────────────────────────────┐  │
│                                │  │ Valor total        ✓ Alta confiança     │  │
│                                │  │ R$ 4.230,00                    [toque]  │  │
│                                │  │ Data de emissão    ✕ Não identificado   │  │
│                                │  │ [__/__/____] obrigatório                │  │
│                                │  └─────────────────────────────────────────┘  │
│                                │  🆕 3 novos · 🔗 12 vinculados · ⚠ 5 revisar  │
│                                │  [Revisar itens (18) ▸]                       │
│                                │                                                │
│                                │  ⚠ Parece semelhante à NF 00123, enviada em   │
│                                │    03/03. [Ver documento anterior] [Enviar    │
│                                │    mesmo assim]                               │
└───────────────────────────────┴───────────────────────────────────────────────┘
                              [Editar todos os campos]        [Ver resumo e gravar →]
```

Antes, esse bloco escondia a lista inteira atrás de `[Ver lista de produtos ▾]`, sem desenho por trás do colapso. Agora o cartão já mostra a contagem por estado (novo/vinculado/revisar — §3.6.2) antes de qualquer clique, e "Revisar itens" expande para o wireframe 8.1b abaixo, não para uma lista genérica.

### 8.1b Itens expandidos — revisão em volume médio (§3.6)

Ao clicar em "Revisar itens", a tabela ocupa a largura toda (o preview do PDF recolhe para um botão "Ver documento", igual ao comportamento em tela estreita de §3.1), porque uma tabela de 5 a 30 linhas com duas decisões por linha não cabe na metade da tela sem voltar a virar colapso disfarçado.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ‹ Voltar aos campos          Itens da nota (18)         [Ver documento original] │
│ 🆕 3 novos · 🔗 12 vinculados · ⚠ 5 revisar          [Mostrar só os com alerta ☐] │
├────┬───────────────────────────┬──────┬─────────────┬─────────────┬──────────────┤
│    │ Produto                   │ Qtd  │ Custo nota  │ Custo atual │ Decisão      │
├────┼───────────────────────────┼──────┼─────────────┼─────────────┼──────────────┤
│ ✓  │ 🔗 Parafuso M6 (SKU 118)  │ 200  │ R$ 0,42     │ R$ 0,42     │ sem alteração│
│ ✓  │ (11 itens resolvidos, display-only — mesmo padrão da linha acima)           │
│ ⚠  │ 🔗 Porca sextavada        │ 300  │ R$ 0,15     │ R$ 0,11     │ ○ manter     │
│    │    (SKU 204)              │      │             │             │ ● atualizar  │
│ ⚠  │ 🔗? "Fita isolante 3M"    │ 40   │ R$ 6,90     │ —           │ vínculo com  │
│    │    parece: Fita isolante  │      │             │             │ confiança    │
│    │    preta (SKU 301)        │      │             │             │ média — [aceitar] [buscar outro] [criar novo] │
│ 🆕 │ Broca aço rápido 6mm      │ 15   │ R$ 3,20     │ —           │ custo inicial│
│    │ (sem correspondência)     │      │             │             │ (nada a decidir) │
│ ⚠  │ 🔗 Rebite alumínio        │ 600  │ R$ 0,09     │ R$ 0,06     │ ○ manter     │
│    │    (SKU 077)              │      │             │             │ ● atualizar  │
│    │ Isso também vale para os outros 2 itens com o mesmo tipo de aumento?        │
│    │ [Aplicar aos 2]  [Não, decidir um a um]                                     │
├────┴───────────────────────────┴──────┴─────────────┴─────────────┴──────────────┤
│ 15 produtos sem alteração · 3 novos · 2 vínculos e 3 custos ainda pendentes        │
│                                        [Voltar aos campos]  [Ver resumo e gravar →]│
└─────────────────────────────────────────────────────────────────────────────────┘
```

Estado de lista vazia (§3.6.2), quando a IA não extrai nenhum item:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  Não foi possível identificar itens nesta nota.                                  │
│  Revise o restante dos dados — produtos podem ser lançados manualmente depois.   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Acima do teto de itens (§3.6.5), no lugar da tabela:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ⚠ Esta nota tem 47 itens, acima do que revisamos automaticamente aqui.          │
│  Fornecedor e contas a pagar foram lançados; os produtos não foram adicionados   │
│  ao estoque — lance-os manualmente.                                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Tela de revisão — Extrato bancário (lote)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ✕  Revisar importação — Extrato bancário · 80 lançamentos detectados          │
│    76 com leitura de alta confiança · 4 precisam da sua atenção               │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Selecionar todos] [Desmarcar todos] [Mostrar só com alerta ✓]                │
├──┬────────────┬──────────────────────────────┬────────────┬───────────────────┤
│☑ │ 03/03/2026 │ PIX RECEBIDO - JOÃO SILVA     │ R$ 350,00  │ ✓ alta            │
│☑ │ 03/03/2026 │ TARIFA MANUTENÇÃO CONTA       │ -R$ 29,90  │ ✓ alta            │
│☐ │ 04/03/2026 │ TRANSF ENVIADA - ???          │ -R$ 1.200… │ ⚠ revisar  [abrir] │
│☐ │ 05/03/2026 │ PIX RECEBIDO - JOÃO SILVA     │ R$ 350,00  │ ⚠ possível         │
│  │            │                                │            │   duplicata [ver]  │
│☑ │ ...        │ (76 linhas de alta confiança, display-only)                     │
├──┴────────────┴──────────────────────────────┴────────────┴───────────────────┤
│ 76 lançamentos serão importados · Total: R$ 12.340,50                          │
│                                          [Editar todos]   [Ver resumo e gravar →]│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Resumo final (segundo passo de confirmação, §4.3)

```
┌───────────────────────────────────────────────┐
│  Confirmar importação                          │
│                                                  │
│  Vou criar:                                     │
│   • 1 fornecedor novo — ACME Distribuidora Ltda │
│   • 1 compra                                    │
│   • 3 produtos no estoque                       │
│                                                  │
│  Vou lançar:                                    │
│   • R$ 4.230,00 em contas a pagar               │
│                                                  │
│  Nenhum campo pendente de revisão.              │
│                                                  │
│         [Voltar e revisar]  [Confirmar e gravar]│
└───────────────────────────────────────────────┘
```

---

## 9. Recomendações (fora do que foi pedido — Artigo IV)

Nada abaixo é requisito; são sugestões, e devem ser tratadas separadas do que o brief pediu:

- **Alerta de valor anômalo:** se o valor extraído for muito fora do padrão histórico da empresa para aquele tipo de lançamento, mostrar um aviso brando adicional. Não desenhei isso em detalhe porque depende de dado histórico agregado que não foi confirmado como disponível — ficaria a cargo de uma story própria.
- **Atalho de teclado global** para "confirmar campo e ir para o próximo pendente" (tipo `Ctrl+Enter`) na tela de revisão — acelera revisão de documentos com muitos campos sinalizados, mas não é essencial para o MVP.

---

## 10. Dependências e riscos para outros agentes

- **Compass (ADR de arquitetura):** a extração precisa devolver o **trecho de texto de origem por campo** (mínimo) e idealmente coordenadas/bounding box (ideal) — sem isso, §3.1 não é implementável como desenhado. A gravação final precisa ser **transacional/atômica** (§4.4) — não é opcional do ponto de vista de UX, é o que evita o pior cenário do brief (dado pela metade).
- **Taxonomia de documento:** `DOCUMENT_CATEGORIES` não tem valor para "extrato bancário" hoje (só `nota_fiscal`, `contrato`, `boleto`, `recibo`, `empresa`, `cliente`, `fornecedor`, `outros`). Alguém precisa decidir se cria a categoria `extrato` ou se ela entra como `outros` com metadado próprio — não é decisão de UX, mas bloqueia a tela de classificação (§2, estado "Classificando") se não for resolvida.
- **Lantern (extração):** este documento assume que dá para saber, por campo, o texto de origem e um score de confiança de 3 níveis (alta/média/baixa) por campo — a granularidade da tela de revisão inteira depende disso existir na resposta da extração.
- **Contrato de extração de item de NF-e (§3.6):** por item, a extração precisa devolver GTIN quando existir (a ausência muda o default de vínculo — §3.6.3), o `costPrice` atual do cadastro **e** o valor unitário da nota lado a lado (já registrado como decisão do usuário em `decisoes-usuario-importacao-documentos.md`, QA-2), e uma confiança de casamento de produto separada da confiança dos demais campos do item. Sem os três, §3.6.2 não é implementável como desenhado.

Não falei com Compass nem Lantern diretamente — como pedido, todo tráfego passa pelo Orion.
