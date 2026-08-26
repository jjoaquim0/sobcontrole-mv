# Epic — Importação Inteligente de Documentos

> **Status:** Draft
> **Owner:** @pm (Morgan)
> **Data:** 2026-08-14
> **Fonte:** `.aiox/briefs/helm-epic-importacao-documentos.md` (Orion, base commit `f7c558f`)
> **Desenho:** `docs/architecture/ai-document-ingestion-p3.md` (Aria), `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` (Uma), `docs/research/2026-08-13-importacao-documentos-pdf-nfe-deno/README.md` (Lantern) — já fechados e commitados, este epic não os reabre
> **Método:** Story Development Cycle (@sm escreve as stories de cada onda a partir deste epic → @po valida → @dev implementa → @qa gate)

---

## 1. Objetivo de negócio e problema

O cliente joga um documento — nota fiscal, boleto, contrato — e hoje precisa digitar tudo à mão no sistema: cadastrar fornecedor, lançar a compra, dar entrada no estoque, criar a conta a pagar. É trabalho manual repetitivo sobre dado que já existe em algum lugar, estruturado ou não.

O usuário pediu: subir o documento, a IA lê os dados, **pergunta se pode integrar ao sistema**, e se sim, integra. Ele foi explícito — **"quero isso funcionando"** — não pediu documentação nem arquitetura, pediu a funcionalidade em uso.

A "pergunta se pode integrar" não vira uma pergunta de chat. Um PDF é um documento que o cliente não controla a origem — pode ter sido adulterado ou conter texto que tenta se passar por instrução. Se o "pode gravar?" for respondido em linguagem natural, no mesmo canal por onde o documento entrou, o documento passa a decidir o que é gravado no banco da empresa. Por isso a "pergunta" vira **uma tela de revisão com clique de confirmação** sobre dados estruturados e editáveis — a intenção do usuário (ele decide, não a IA) é preservada; o meio muda, por segurança. Aria e Uma chegaram a essa conclusão de forma independente, cada uma pelo seu lado.

**Este epic corta a construção da funcionalidade em ondas entregáveis**, na ordem que entrega o maior valor com o menor risco primeiro, para que o @sm escreva as stories em cima de uma sequência já decidida e com critério de pronto verificável em cada etapa.

## 2. Estado atual verificado

Reverifiquei pessoalmente, não só no brief — todos os pontos abaixo foram lidos direto no código nesta sessão:

- A IA é **read-only por invariante estrutural**: `ReadOnlyToolRegistry.register()` lança `configuration_error` se `mode !== 'read_only'` (`supabase/functions/_shared/ai/tools/registry.ts:45`). Este epic não remove essa trava — toda escrita passa por proposta + confirmação humana + RPC.
- O gateway de chat (`ai-gateway`) é texto puro com limite de 2.000 caracteres por mensagem (`_shared/ai/validation.ts`) — uma DANFE em markdown já estoura isso. É por isso que a extração de documento precisa de função própria, separada do chat.
- Upload de documento já funciona: bucket privado, versão imutável, `.xml` já aceito (`documentService.ts`).
- `DOCUMENT_CATEGORIES` já tem `nota_fiscal`, `contrato`, `boleto`, `recibo` (`documentService.ts:187-196`) — confirmado, sem `extrato_bancario` nem `extrato` (relevante para a seção 7).
- `AccountPayable.supplierId` é **obrigatório** (`src/types/index.ts:341`) — um boleto não pode ser gravado sem fornecedor resolvido.
- `Deal` exige **cinco** campos obrigatórios: `customerId`, `ownerId`, `stageId`, `title`, `value` (`src/types/index.ts:444-462`) — confirmei os cinco, não só os três citados no brief original do pedido. `title` e `value` não saem de forma confiável de um contrato.
- `AiSiteIntegrationAction.tsx` é placeholder puro: renderiza um badge "Em breve" e dispara `toast.info('Esta integração estará disponível em breve.')` — nenhuma lógica além disso (confirmado, inclusive no teste `AiSiteIntegrationAction.test.tsx`).

## 3. Ondas

A sequência segue a "Sequência sugerida" do ADR da Aria — não encontrei argumento de produto para reordenar. Os passos determinísticos (XML, linha digitável) não dependem de nenhuma decisão pendente, e é exatamente por isso que o ADR já os coloca na frente: maximizam valor, minimizam risco, e não esperam por ninguém.

### Onda 1 — Tabelas de proposta e RPCs de aplicação
**Em andamento — @data-engineer (Cistern).**

- **Objetivo:** fundação de dados. Tabela(s) de proposta com status `pending` / `applied` / `rejected`, trava `UNIQUE (company_id, idempotency_key)`, RLS por empresa, RPCs de aplicação `SECURITY INVOKER` com JWT do usuário, dimensão `feature` em `ai_usage_windows`/`ai_usage_logs` para separar quota da importação da quota do chat.
- **Depende de:** nada. Já em andamento.
- **Critério de conclusão (falsificável):** inserir duas propostas com a mesma `idempotency_key` na mesma empresa deve falhar por violação de unicidade; tentar aplicar uma proposta via RPC sem o JWT do dono da empresa (ou com JWT de outra empresa) deve ser barrado pela RLS, não pela lógica de aplicação.
- **Entrega valor ao usuário?** Não. É infraestrutura invisível — nenhuma tela nova, nenhum documento importável ainda.

### Onda 2 — Rota XML de NF-e de entrada
**Determinística, sem IA, sem depender de nenhuma decisão pendente.**

- **Objetivo:** dado um XML de NF-e, extrair emitente, itens, valores e vencimentos por parsing determinístico (leiaute 4.00, sem biblioteca de terceiros para NF-e — parser XML genérico com mapeamento manual, conforme D6 do ADR), validar a chave de acesso por módulo 11, aplicar a regra de direção (entrada segue, saída rejeita com aviso, nenhum CNPJ batendo rejeita por suspeita), e gravar proposta `pending`.
- **Depende de:** Onda 1 (precisa da tabela de proposta para gravar).
- **Critério de conclusão (falsificável):** um XML de NF-e de entrada válido gera proposta com fornecedor, itens e valores corretos, sem nenhuma chamada a IA. Um XML de NF-e de **saída** não gera proposta de compra — gera rejeição com aviso explícito. Um XML com dígito verificador da chave de acesso adulterado é rejeitado antes de virar proposta.
- **Entrega valor ao usuário?** **Ainda não, sozinha.** A proposta existe no banco, mas não há como o usuário vê-la, editá-la ou confirmá-la sem a Onda 3. Ver seção 4.

### Onda 3 — UI de revisão e confirmação
**A tela é o controle de segurança principal do desenho inteiro (D2/D3 do ADR).**

- **Objetivo:** tela split view (preview do documento + campos extraídos editáveis) que mostra a proposta `pending` gerada pela Onda 2, com origem por campo, distinção clara entre "será criado" e "vinculado a registro existente", decisão de custo item a item (custo atual × custo da nota, QA-2), tela de resumo antes de gravar ("vou criar X, vou lançar R$ Y"), e confirmação por clique que dispara a RPC de aplicação.
- **Depende de:** Onda 1 (RPC de aplicação) e Onda 2 (é a primeira rota que produz proposta para revisar).
- **Critério de conclusão (falsificável):** o usuário sobe um XML de NF-e de entrada, vê a proposta na tela de revisão com origem por campo, decide o custo de cada item, clica em "Gravar", e o sistema cria fornecedor (ou vincula o existente), compra, itens, conta a pagar e produtos no estoque. Proposta com campo obrigatório vazio mantém o botão "Gravar" desabilitado — não é erro pós-clique, é prevenção. Confirmar a mesma proposta duas vezes (duplo clique, F5 no meio do envio) não duplica os registros criados.
- **Entrega valor ao usuário?** **Sim — é aqui que o epic entrega, pela primeira vez, exatamente o que o usuário pediu.** Ver seção 4.
- **Status real (atualizado 2026-08-25):** na prática esta onda foi partida em duas fatias de story, não construída como unidade só. Piloto de cabeçalho (Stories 1.55 e 1.56 — fornecedor, compra, contas a pagar, sem itens/produtos/estoque por corte explícito de escopo) já está **Done**, com gates emitidos pelo @qa. A metade restante — itens, produtos e estoque, incluindo o fechamento de design de §3.6/§11 e a dependência de migration da D10 (seção 12) — está sendo escrita como story própria pelo @sm neste momento. Este epic não reabre a sequência de ondas nem decide como as próximas stories devem ser cortadas; registro só para quem for planejar em cima desta seção não presuma "Onda 3" como um único incremento indivisível.

### Onda 4 — Rota de boleto por linha digitável colada
**Determinística; não depende da decisão de PDF.**

- **Objetivo:** aceitar os 47 dígitos da linha digitável (colados ou digitados), validar dígitos verificadores (módulo 10 nos três campos, módulo 11 no código de barras), decodificar valor e vencimento **tratando as duas eras do fator de vencimento** (contagem original até 9999 em 21/02/2025, reiniciada em 1000 a partir de 22/02/2025 — as duas circulam simultaneamente em agosto de 2026), e resolver ou coletar na tela o fornecedor — `AccountPayable.supplierId` é obrigatório, não é gravação isolada.
- **Depende de:** Onda 1 (RPC de aplicação) e Onda 3 (reaproveita o padrão de revisão/confirmação).
- **Critério de conclusão (falsificável):** uma linha digitável válida de **antes** da virada do fator (21/02/2025) e uma de **depois** decodificam o vencimento corretamente — teste explícito dos dois lados da virada, não um caso genérico. Uma proposta de boleto sem fornecedor resolvido (nem vinculado nem criado na tela) não pode ser confirmada — a RPC de aplicação rejeita, e a UI nunca deixa "Gravar" habilitado nesse estado.
- **Entrega valor ao usuário?** Sim, incremental — estende a mesma tela de revisão para um segundo tipo de documento.

### Onda 5 — Rota de PDF via pdf.js no navegador
**Decisão do usuário confirmada em 2026-08-14: Opção E (XML/linha digitável) agora, Opção A (pdf.js no navegador) depois.**

- **Objetivo:** extrair o texto do PDF (DANFE ou outro) **no navegador do cliente**, via pdf.js, sem que o arquivo trafegue para nenhum serviço terceiro novo — só o texto extraído segue para o backend, no mesmo pipeline de proposta já validado nas Ondas 2-4. PDF sem camada de texto (escaneado) é fora de escopo por decisão do usuário — rejeitado com mensagem clara, nunca com falha silenciosa nem tentativa de OCR.
- **Depende de:** Onda 3 (a tela de revisão já precisa existir; esta onda só troca a origem do texto que alimenta o mesmo contrato de extração).
- **Critério de conclusão (falsificável):** um PDF de DANFE com camada de texto, processado no navegador, gera proposta com os mesmos campos-alvo da rota XML (fidelidade menor, aceitável, com origem rastreável por campo). Um PDF puramente escaneado (sem texto extraível) não gera proposta vazia nem parcial silenciosa — cai no estado de erro de leitura já desenhado pela Uma ("não conseguimos ler o texto deste arquivo... salvar só o arquivo").
- **Entrega valor ao usuário?** Sim, incremental — mesmo o usuário citou PDF como formato corrente ("geralmente vai jogar nfe, xml, pdf"); esta onda fecha esse caso.

### Onda 6 — Quota por feature e auditoria

- **Objetivo:** garantir que uma importação pesada (uma DANFE gasta entre 800 e 1.200 tokens estimados; um contrato de 10 páginas, 8.000 a 12.000) não consuma a janela de uso do chat Gestly da mesma empresa. Truncamento explícito do texto enviado ao modelo, com marcação `truncated` na proposta quando ocorrer — nunca proposta incompleta sem aviso.
- **Depende de:** Onda 1 (dimensão `feature` já criada na tabela de uso).
- **Critério de conclusão (falsificável):** simular uma importação de alto volume e confirmar que a janela de uso do chat da mesma empresa permanece intacta (dimensão `feature` separa as duas). Um documento que excede o teto de entrada gera proposta marcada `truncated: true`, nunca uma proposta que pareça completa sem ser.
- **Entrega valor ao usuário?** Indiretamente — protege o chat que ele já usa hoje de ser degradado pela nova feature. Não é uma tela nova.

### Onda 7 — Contrato comercial → cliente + oportunidade

- **Objetivo:** extrair dados de um contrato (texto → IA, é o único tipo desta lista que passa pelo modelo em vez de parser/DV), propor cliente (criado ou vinculado por CPF/CNPJ) e oportunidade, com a tela coletando os campos que o contrato não fornece de forma confiável: `title`, `value`, `stageId` (default: primeira etapa do pipeline), `ownerId` (default: usuário que confirma).
- **Depende de:** Onda 3 (mesma tela de revisão, mesmo padrão de confirmação).
- **Critério de conclusão (falsificável):** dado um contrato, a proposta final não permite "Gravar" enquanto `value` estiver vazio (sem default possível — chutar valor de negócio é pior que pedir) e enquanto `title` não tiver ao menos o sugerido a partir de nome do cliente + data. Confirmar a proposta cria (ou vincula) o cliente e cria a oportunidade com os cinco campos obrigatórios de `Deal` preenchidos.
- **Entrega valor ao usuário?** Sim, incremental — terceiro tipo de documento coberto.

---

## 4. Qual onda entrega valor pela primeira vez

**Onda 3.** Não a Onda 1 (infraestrutura invisível) nem a Onda 2 isolada (proposta gravada no banco, mas sem tela para o usuário ver, editar ou confirmar — o loop "sobe documento → sistema pergunta → confirma → dados no sistema" fica incompleto). É só ao final da Onda 3, com a Onda 2 já pronta por baixo, que o usuário consegue de fato subir uma NF-e XML, ver a pergunta em tela, clicar, e ver fornecedor/compra/conta a pagar/estoque aparecerem no sistema. **Esse é o ponto em que "quero isso funcionando" passa a ser verdade.**

Isso não é uma reordenação da sequência do ADR — a ordem de construção continua fazendo sentido de engenharia (extração testável isoladamente com fixtures antes de existir tela para consumi-la). É uma correção de expectativa: o epic só entrega valor de produto no fim da terceira onda, não da primeira, e é isso que fica registrado aqui para quem for planejar entregas.

## 5. Dependências entre ondas

```
Onda 1 (tabelas + RPCs)
  └─▶ Onda 2 (XML NF-e) ──┐
  └─▶ Onda 6 (quota)      │
                           ▼
                    Onda 3 (UI revisão) ◀── primeira entrega de valor
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        Onda 4 (boleto) Onda 5 (PDF) Onda 7 (contrato)
```

Ondas 4, 5 e 7 dependem apenas da Onda 3 existir (reaproveitam a mesma tela e o mesmo padrão de confirmação) — não têm dependência entre si e podem ser sequenciadas por prioridade de negócio, não por engenharia.

## 6. Tamanho relativo entre ondas

**Não é estimativa em horas nem data — não há velocity medida neste projeto.** É só ordem de grandeza relativa entre as ondas deste epic, para ajudar a priorizar, nada além disso:

| Onda | Tamanho relativo | Por quê |
|---|---|---|
| 1 — Tabelas e RPCs | M | schema novo + RLS + RPCs, sem UI |
| 2 — Rota XML NF-e | M | parser determinístico com mapeamento manual do leiaute 4.00, sem lib pronta |
| 3 — UI de revisão | **G** | é a peça mais densa: split view, chips de confiança por campo, decisão de custo por item, resumo pré-gravação, atomicidade da escrita |
| 4 — Boleto linha digitável | M | DV + as duas eras do fator de vencimento exigem atenção, mas reaproveita a UI da Onda 3 |
| 5 — PDF via pdf.js | M | integração de biblioteca no navegador + novo estado de erro (PDF escaneado); reaproveita UI e contrato de extração |
| 6 — Quota e auditoria | P | dimensão nova em tabela já existente + truncamento |
| 7 — Contrato → cliente/oportunidade | M | reaproveita UI da Onda 3; a IA entra sobre texto livre, exige tratamento de campos sem forma canônica |

## 7. Riscos de produto

- **Fadiga de revisão (R7 do ADR) — o mais importante.** A decisão do usuário de perguntar custo item a item (QA-2) significa que uma NF-e de trinta itens pode gerar até sessenta decisões humanas na Onda 3. Se a tela empurrar para aprovação em bloco sem leitura real, o controle de segurança inteiro (D2/D3 do ADR) vira teatro — a IA continua não escrevendo diretamente, mas o clique de confirmação deixa de significar "o humano decidiu".
  **Resolvido por desenho (atualizado 2026-08-25) — não estava aberto quando este epic foi escrito.** O fluxo de Uma desenha um padrão de "aprovação em lote por exceção" explicitamente para a tabela de **extrato bancário** (§3.4 do documento de UX) — que **saiu de escopo** por decisão do usuário (seção 8) — mas o problema de volume para os itens de uma NF-e grande **já tinha desenho equivalente na §3.6 do documento de UX desde 14/08**, no mesmo commit (`1be703d`) que fixou este texto do epic; a defasagem entre os dois nunca existiu de fato, só passou despercebida até a Prism (@ux-design-expert) apontar. §3.6 decide, por item, duas perguntas independentes (vincular a produto existente × manter/atualizar custo divergente), com default seguro que pré-seleciona "criar novo produto" abaixo de confiança alta, sem "selecionar todos" que varra decisão de custo, e com o wireframe 8.1b detalhando a linha expandida. O que de fato seguia pendente — cadastro de produto novo dentro da própria revisão e o número do corte de volume — foi fechado no adendo §11 do documento de UX (commit `e1854e6`, 2026-08-25): corte em **60 itens** (§11.4), com sub-aviso não bloqueante quando as decisões pendentes passam de 20 num documento abaixo do corte, e o wireframe do formulário de produto novo em §11.5. R7 continua sendo o risco de produto mais importante da Onda 3 — a mitigação de desenho existe, mas só a implementação (story em andamento) e o uso real confirmam se ela resiste na prática.
- **Rota de PDF pode não sustentar a qualidade esperada (R6 do ADR, parcialmente mitigado).** A decisão do usuário (Opção E agora, A depois) evita as duas dívidas mais caras — bundle+licença do processamento em edge e LGPD de serviço externo — mas não garante que pdf.js no navegador entregue qualidade de extração de tabela suficiente para uma DANFE real. Se a Onda 5 mostrar que não sustenta, a decisão volta ao usuário entre as opções já mapeadas pelo ADR (não é decisão deste epic nem deste agente).
- **Escopo de "todos os tipos em ondas" cria expectativa de cobertura total cedo.** O usuário sabe que NF-e, boleto e contrato vêm em ondas — mas se a comunicação de progresso não deixar claro que cada onda cobre um tipo por vez, existe risco de o usuário achar que "importação" já cobre tudo assim que a Onda 3 fechar (ela só cobre NF-e XML).
- **`AiSiteIntegrationAction` e a nova ação convivendo na mesma tela (ver seção 8).** Duas ações parecidas no mesmo card de documento, se mal diferenciadas visualmente, geram o mesmo tipo de erro silencioso que a arquitetura tenta evitar em outro lugar: o usuário clica na ação errada achando que é a mesma coisa.

## 8. Decisão sobre `AiSiteIntegrationAction`

**Proposta: convive.** Adoto a recomendação já fundamentada por Uma no fluxo de UX (seção 7 daquele documento), porque ela já resolveu isso com justificativa que se sustenta:

`AiSiteIntegrationAction` alimenta a base de conhecimento pública que responde perguntas de visitantes do site do cliente — a IA lê o documento para *conversar sobre ele*. A importação desta feature extrai dados estruturados para *virar registros no sistema* — fornecedor, compra, conta a pagar. São domínios diferentes atrás de uma UI parecida; fundir ou renomear um em cima do outro confundiria o usuário sobre o que vai acontecer com o documento dele.

Portanto: `AiSiteIntegrationAction` fica intocado (mesmo rótulo, mesmo ícone, "Em breve" continua valendo até virar outra iniciativa). A Onda 3 adiciona um **componente irmão**, no mesmo slot pós-upload, com identidade visual própria emprestada da marca Gestly já existente no projeto (gradiente `#0B2551 → #00d2ff`, ícone `Sparkles`) para ser visualmente inconfundível com o verde genérico de Documentos. Nome comercial sugerido por Uma: "Importar com Gestly" — proposta, não decisão; o usuário decide o rótulo final quando a story chegar nele.

## 9. Encaminhamento do extrato bancário

**Fora deste epic — decisão do usuário (QA-1), não recomendação.** O que o usuário quer para extrato é **conciliação bancária**: casar cada linha do extrato com um título já cadastrado (conta a pagar/receber) e dar baixa. Isso não é "ler um documento e propor registros novos" — é uma operação diferente, sobre tabelas e regras que não existem em nenhum ponto do schema hoje (confirmei: não há tabela bancária, de movimentação ou de conciliação em todo o projeto).

**Extrato vira epic próprio**, fora da sequência de ondas acima. Até esse epic existir, a categoria `extrato_bancario` (ou `extrato`) **não é criada** em `DOCUMENT_CATEGORIES` — criar categoria sem destino de escrita produz um caminho que só termina em erro para o usuário.

## 10. Fora de escopo deste epic

- Foto e PDF escaneado — sem OCR, sem modelo com visão, por decisão do usuário.
- NF-e de saída — rejeitada com aviso, nunca processada como venda.
- Extrato bancário / conciliação — epic próprio (seção 9).
- Redação das stories de cada onda — trabalho do @sm; validação Draft→Ready, do @po.
- Qualquer decisão de arquitetura, schema ou fluxo de UI — já fechadas por Aria e Uma; este epic não as reabre.
- Estimativa em horas ou datas — não há velocity medida neste projeto (seção 6 usa apenas tamanho relativo).

---

## 11. Recomendações (fora do pedido — Artigo IV, não incorporadas ao escopo)

- **Onda 3 merece uma decisão de design explícita para revisão de itens em volume médio (5-30 itens de NF-e)**, equivalente à que Uma já fez para extrato, antes de virar story — ver seção 7. Não decidido aqui porque é design de UX, não de produto; registro para não se perder.
- **Consulta de situação na SEFAZ e validação de assinatura digital** (camadas 2 e 3 de D6 no ADR) elevariam a confiança da rota XML de "bem formado" para "nota existe e não foi cancelada" — o ADR já registra isso como recomendação própria, fora desta P3; repito aqui só para não desaparecer entre os documentos.
- **Coluna de chave de acesso em `purchases`** (recomendação da Aria) ajudaria auditoria/contabilidade independentemente desta feature — decisão de schema, não de produto; não assumo aqui.

---

## 12. Questões abertas, riscos, bloqueios

- **Resolvido (2026-08-25):** o gap de design para revisão de itens em volume na Onda 3 (seção 7) — não estava aberto de fato desde 14/08 (§3.6 do documento de UX, mesmo commit deste epic); o que faltava (cadastro de produto novo na revisão, corte de volume) foi fechado pela Uma no adendo §11 do documento de UX (commit `e1854e6`). Corte de volume decidido: **60 itens**.
- **Bloqueio (novo, 2026-08-25) — dependência de migration da decisão D10:** a `@architect` (Aria) decidiu, em adendo ao ADR (`docs/architecture/ai-document-ingestion-p3.md`, commit `11417e6`), que a RPC `apply_nfe_purchase_proposal` passa a atualizar `products.current_quantity` na mesma transação da aplicação da proposta — isso supera o AC9 da Story 1.56, que hoje assume zero mudança de estoque como restrição do piloto. A decisão exige migration nova, que a `@data-engineer` (Cistern) está escrevendo agora, mas **ninguém pode aplicá-la** enquanto: (1) a reconciliação de versão pendente entre `schema_migrations` e a migration de 14/08 (`docs/data/document-import-proposals-schema.md` §10) não for resolvida — ela trava a fila de migrations pendentes antes de alcançar qualquer arquivo novo; e (2) o usuário não autorizar a aplicação explicitamente, uma a uma (NFR-2 do ADR) — e ele está ausente. Quem sequenciar a próxima story (itens/produtos/estoque, a metade restante da Onda 3 — ver seção 3) precisa saber que há um passo bloqueado no meio dela até o usuário voltar.
- **Aberto:** nome comercial final da feature na UI ("Importar com Gestly" é proposta de Uma, adotada aqui como sugestão, não fechada).
- **Sem bloqueio:** nenhuma dependência pendente impede o início da Onda 2 em paralelo à conclusão da Onda 1 — são times diferentes (Cistern no schema, qualquer implementação de parser XML não toca `supabase/`).
- **Risco de sequência, não de conteúdo:** a Onda 1 está em andamento por outro agente (Cistern) no momento em que este epic é escrito; qualquer mudança de contrato das tabelas/RPCs depois que a Onda 2 começar a ser implementada pode gerar retrabalho — vale o @sm confirmar que a Onda 1 fechou antes de abrir stories da Onda 2 que dependam do schema final.
