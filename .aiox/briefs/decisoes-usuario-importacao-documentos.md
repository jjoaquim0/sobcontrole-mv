# DECISÕES DO USUÁRIO — Importação Inteligente de Documentos

**Registrado por:** Orion (@aiox-master) · **Data:** 2026-08-14
**Origem:** respostas diretas do usuário às questões abertas QA-1 a QA-4 do ADR `docs/architecture/ai-document-ingestion-p3.md`.

Estas são decisões **do usuário**, não minhas. Todas as quatro questões em aberto do ADR estão resolvidas.

---

## QA-4 — Direção da NF-e → **RESOLVIDA: só entrada**

**Decisão:** importar apenas nota de **entrada** (CNPJ do destinatário = CNPJ da empresa → compra).
Nota de **saída** deve ser **rejeitada com aviso claro** ao usuário — nunca ignorada em silêncio.

A regra de direção que você desenhou continua valendo integralmente; muda só o desfecho do ramo "saída": em vez de gerar venda, rejeita com mensagem. O ramo "nenhum dos dois CNPJs bate" continua sendo rejeição por suspeita de erro ou de cruzamento entre tenants.

## QA-2 — Custo do produto → **RESOLVIDA: perguntar na tela de revisão**

**Decisão:** mostrar **custo atual do cadastro e custo da nota lado a lado**, e o usuário decide **por item**.

Nem sobrescrever sempre, nem nunca. Consequências que o ADR precisa absorver:

- O contrato de extração de NF-e precisa carregar `costPrice` atual **e** o da nota por item.
- A proposta precisa de um campo de decisão por item (atualizar custo: sim/não).
- Isso aumenta a carga da tela de revisão — **conecta direto com o risco R7 (fadiga de revisão)**. Uma nota com muitos itens vira muitas decisões. O teto de itens por proposta ganha importância.

## QA-1 — Extrato bancário → **RESOLVIDA: é conciliação. Sua suspeita estava certa.**

**Decisão:** o usuário quer **conciliar com títulos já cadastrados** — casar cada linha do extrato com uma conta a pagar/receber existente e dar baixa.

Como você mesmo escreveu, isso **não cabe nesta arquitetura**: exige tabelas e regras que não existem no schema (confirmei: não há nenhuma tabela bancária, de movimentação ou de conciliação em todo o projeto).

**Portanto:**
- **Extrato sai do escopo desta P3.** Remova-o da matriz por tipo, ou marque explicitamente como "fora de escopo — epic próprio".
- Registre no ADR que a decisão foi do usuário e que o destino é **conciliação bancária como epic separado**.
- A recomendação de criar a categoria `extrato_bancario` em `DOCUMENT_CATEGORIES` fica **suspensa** até esse epic existir.
- **Mantenha** o contrato de extração capaz de comportar N itens por documento — a NF-e multi-item já exige isso de qualquer forma. Não desfaça essa generalidade; ela deixou de ser por causa do extrato e passou a ser por causa da nota.

## QA-3 — Contrato/proposta → **RESOLVIDA: cliente + oportunidade, faltantes na tela**

**Decisão:** criar **cliente e oportunidade**, com a tela de revisão pedindo o que o documento não fornece.

Você apontou que `Deal` exige `customerId`, `ownerId` e `stageId`. **Verifiquei e confirmo — e acrescento dois que você não citou: `title` e `value` também são obrigatórios** (`src/types/index.ts:444-462`), e nenhum dos dois sai de forma confiável de um contrato.

Então a tela precisa coletar, no mínimo: **etapa, responsável e valor**. O usuário está ciente disso e escolheu assim mesmo. Convenções que sugiro e você decide: `ownerId` default = usuário que confirma; `stageId` default = primeira etapa do pipeline; `value` sem default, porque chutar valor de negócio é pior que pedir.

---

## Insumo de pesquisa pendente

O arquivo `.aiox/briefs/compass-insumo-pesquisa-lantern.md` continua válido e **ainda não foi absorvido pelo ADR** — o envio anterior falhou porque seu terminal mudou de nome de "Compass" para "Aria". Leia-o também.

O ponto central de lá: sua seção "Extração de PDF em Deno — pendente de evidência" e o risco **R6** agora têm evidência, e ela é ruim. `unpdf` tem relato real de falha em produção no Supabase Edge Functions; `mupdf.js` é **AGPL-3.0** e exige licença paga da Artifex para SaaS fechado; e há **teto de 2 s de CPU por request** na Edge Function, sem benchmark publicado de parsing WASM nesse limite.

**Se a extração de PDF em edge não se sustentar, não decida sozinho.** Me entregue as opções com custo e trade-off — extração no cliente, licença paga, ou serviço externo com implicação de LGPD Art. 33 — e **eu levo ao usuário**. Nem você nem eu decidimos o que sai da máquina do cliente.

## O que quero do ADR atualizado

1. QA-1 a QA-4 marcadas como resolvidas, com a decisão de cada uma e a atribuição ao usuário.
2. Extrato fora de escopo, com o encaminhamento para epic próprio.
3. Matriz por tipo revista: NF-e entrada, boleto, contrato. Sem extrato, sem NF-e de saída.
4. Seção de extração de PDF fechada com a evidência do Lantern — ou com as opções para eu levar ao usuário.
5. Sequência de implementação revista à luz de tudo isso.

**Nota sobre a sequência:** você propôs começar pelas tabelas de proposta (@data-engineer) e depois a rota XML da NF-e. Concordo com a ordem. Mas registre com todas as letras que **migration só é aplicada com autorização explícita do usuário, uma a uma** — mesmo migration no-op. É NFR-2 do projeto e não abro exceção.

Fronteiras inalteradas: sem código de implementação, sem migration, sem push, sem PR.
Continue me desconfiando: confirme por conta própria, inclusive o que eu afirmo ter verificado.
