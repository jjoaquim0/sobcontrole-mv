# Epic — Evolução do Pipeline de Vendas

> **Status:** Draft
> **Owner:** @pm (Morgan)
> **Data:** 2026-08-12
> **Fonte:** `.ai/pipeline-upgrade-brief.md` (Orion, base commit `11fda03`)
> **Método:** Story Development Cycle completo (@pm → @architect/@data-engineer → @sm → @po → @dev → @qa)

---

## 1. Objetivo de negócio e problema

O usuário pediu para elevar o módulo Pipeline de Vendas a um patamar competitivo ("mais opções, algo bem top"). O levantamento técnico (brief, seção 2-3) mostrou que o módulo hoje cobre bem o essencial — kanban com drag-and-drop, StatCards, filtros, ganhar/perder, histórico de etapas — mas tem seis lacunas que limitam seu uso real em operação:

| # | Lacuna | Impacto no negócio |
|---|--------|---------------------|
| 1 | Etapas do funil não são configuráveis pela UI (mensagem manda "contatar o suporte") | Cliente não consegue adaptar o funil ao próprio processo de vendas — bloqueio operacional grave |
| 2 | Só existe visão kanban de negócios abertos (`status='open'`) | Negócios ganhos/perdidos ficam invisíveis; sem visão histórica ou analítica |
| 3 | Zero inteligência (sem probabilidade, forecast, conversão, tempo em etapa, estagnação, ranking, motivos de perda) | Gestão às cegas — não há previsibilidade de receita nem diagnóstico de funil |
| 4 | Deal é uma ilha — não converte em venda, não linka produtos, não gera compromisso na agenda, não usa o e-mail transacional (Story 1.34) | Retrabalho manual entre módulos que já existem e já se conectam via schema (`Appointment.dealId`) |
| 5 | Busca/filtro 100% client-side, sem paginação nem virtualização | Não escala com volume — degrada conforme a base de negócios cresce |
| 6 | `updateDeal()` não grava `stage_id`, contornado com chamada extra a `moveDeal` | Dívida técnica que aumenta risco de bug em qualquer evolução da etapa |

**Objetivo do epic:** eliminar as seis lacunas através de quatro frentes de trabalho aprovadas pelo usuário, transformando o pipeline de um kanban básico em um CRM funcional: configurável, escalável, com inteligência de forecast e integrado ao resto do sistema (vendas, estoque, agenda, e-mail).

---

## 2. Requisitos Funcionais

### Frente A — Configuração de etapas

- **FR-1.** O usuário deve poder criar, renomear e arquivar etapas do pipeline pela UI, substituindo o estado atual em que `PipelinePage.tsx` exibe apenas a mensagem de contato com suporte quando não há etapas configuradas.
- **FR-2.** O usuário deve poder reordenar etapas por drag-and-drop, preservando a estratégia de `position` como `DOUBLE PRECISION` (reposicionamento por ponto médio, sem renumerar a coluna inteira).
- **FR-3.** O usuário deve poder definir/alterar a cor de cada etapa.
- **FR-4.** Cada etapa deve ter um campo de probabilidade de fechamento (%), usado como base do forecast ponderado (Frente C).
- **FR-5.** Cada etapa deve suportar um limite WIP (quantidade máxima de negócios abertos); ao ultrapassar o limite, a UI deve sinalizar visualmente o excesso.
- **FR-6.** Cada etapa deve permitir configurar campos obrigatórios (ex.: valor, data prevista de fechamento) que bloqueiam o avanço do negócio para a etapa seguinte enquanto não preenchidos.
- **FR-7.** O usuário deve poder marcar uma etapa como "etapa de ganho" ou "etapa de perda", de modo que mover um negócio para ela atualize automaticamente `status` (`won`/`lost`), substituindo a necessidade de fluxo manual dedicado para esse caso.
- **FR-8.** `updateDeal()` deve persistir `stage_id` diretamente, eliminando a chamada dupla a `moveDeal` hoje contornada em `PipelinePage.tsx` (linhas 98-102).

### Frente B — Visões e produtividade

- **FR-9.** O usuário deve poder alternar entre visão kanban (atual), visão em lista/tabela e visão timeline dos negócios.
- **FR-10.** A visão em lista/tabela deve suportar ordenação por colunas (valor, data prevista, nome, responsável, etapa).
- **FR-11.** O módulo deve oferecer uma aba (ou filtro de status) para visualizar negócios Ganhos e Perdidos, hoje invisíveis porque `getDeals()` filtra `status='open'` por padrão.
- **FR-12.** As visões devem suportar agrupamento por responsável (`ownerId`).
- **FR-13.** O usuário deve poder salvar combinações de filtros (busca, responsável, etapa, status) com um nome, para reaplicação posterior.
- **FR-14.** O usuário deve poder selecionar múltiplos negócios (na visão lista) e aplicar ações em massa: mudar etapa, reatribuir responsável, excluir.
- **FR-15.** A busca e os filtros de negócios devem ser resolvidos no servidor (Supabase), com paginação, substituindo o filtro client-side atual de `getDeals()` que busca tudo e filtra em JS.

### Frente C — Inteligência e forecast

> Pré-requisito: FR-4 (probabilidade por etapa) e FR-15 (busca server-side).

- **FR-16.** O módulo deve exibir forecast ponderado: soma do valor dos negócios abertos multiplicado pela probabilidade da respectiva etapa (FR-4).
- **FR-17.** O módulo deve exibir um gráfico de funil com a taxa de conversão etapa a etapa, calculada a partir de `deal_stage_history`.
- **FR-18.** O módulo deve calcular e exibir o tempo médio que os negócios permanecem em cada etapa, a partir de `deal_stage_history`.
- **FR-19.** O módulo deve identificar e destacar negócios estagnados (sem movimentação de etapa há mais que um limite configurável de dias).
- **FR-20.** O módulo deve exibir um ranking de responsáveis por valor fechado, taxa de conversão e ciclo médio de venda.
- **FR-21.** O módulo deve exibir uma análise agregada dos motivos de perda (`lost_reason`) dos negócios com `status='lost'`.

### Frente D — Ações e integrações

- **FR-22.** O usuário deve poder registrar e concluir atividades/tarefas vinculadas a um negócio.
- **FR-23.** O usuário deve poder converter um negócio com etapa de ganho (FR-7) em uma venda no módulo `sales`, reaproveitando `createSale()`.
- **FR-24.** O usuário deve poder vincular produtos do módulo `inventory` a um negócio (item, quantidade, preço), compondo seu valor.
- **FR-25.** O usuário deve poder criar um compromisso na agenda a partir de um negócio, usando o campo `Appointment.dealId` já previsto no schema.
- **FR-26.** O usuário deve poder enviar um e-mail a partir de um negócio, usando o módulo de e-mail transacional da Story 1.34 (`useEmailSender`).
- **FR-27.** O negócio deve ter uma timeline rica de eventos, unificando histórico de etapa, atividades, compromissos de agenda e e-mails enviados em uma única linha do tempo cronológica.

**Total: 27 Requisitos Funcionais (FR-1 a FR-27).**

---

## 3. Requisitos Não-Funcionais

- **NFR-1 (Multi-tenant/RLS).** Toda tabela nova criada por este epic deve ter `company_id`, política RLS `company_id = get_user_company_id()` e `REVOKE ALL ... FROM anon`. Nenhuma query no frontend deve enviar `company_id` — sempre resolvido no backend/RLS.
- **NFR-2 (Migrations com aprovação manual).** Toda migration deve vir acompanhada do rollback correspondente em `supabase/rollbacks/`. Nenhuma migration deste epic é aplicada sem autorização explícita do usuário (conforme decisão registrada no commit `d8d8a47`).
- **NFR-3 (Compatibilidade com dados existentes).** Toda coluna nova deve ter default seguro. Empresas e negócios já existentes (incluindo o seed de 5 etapas padrão) não podem quebrar ou perder dados com nenhuma migration deste epic.
- **NFR-4 (Performance com volume).** As visões (kanban, lista, timeline) e os filtros devem operar com paginação/consulta server-side (FR-15) e não podem degradar perceptivelmente com o crescimento do volume de negócios de uma empresa.
- **NFR-5 (Acessibilidade).** Componentes novos (CRUD de etapas, tabela, funil, seleção em massa, drag-and-drop) devem seguir os padrões de acessibilidade já usados no repo — labels, foco visível, navegação por teclado nas interações de reordenação.
- **NFR-6 (Dark mode).** Toda UI nova usa classes `dark:` do Tailwind de forma consistente com o restante do app, sem elementos que quebrem em tema escuro.
- **NFR-7 (Padrões do repo).** React Query para estado servidor, `sonner` para toasts, verde da marca `#10b981` como cor de destaque, componentes compartilhados reaproveitados de `src/components/shared/`, testes Vitest ao lado do arquivo testado.
- **NFR-8 (Estratégia de posicionamento).** Qualquer nova entidade ordenável introduzida por este epic (ex.: filtros salvos, se ordenáveis) deve preservar a estratégia já validada de `position DOUBLE PRECISION` com reposicionamento por ponto médio — não deve ser reintroduzida uma estratégia de renumeração sequencial.

**Total: 8 Requisitos Não-Funcionais (NFR-1 a NFR-8).**

---

## 4. Quebra em stories propostas

> Numeração a partir de **1.35** (última story do repo: 1.34 — email-transacional-multiempresa). Esta é uma **proposta de quebra**; a redação formal de cada story é responsabilidade do @sm.

### Frente A — Configuração de etapas

| Story | Título | FRs | Dependências | Tamanho |
|-------|--------|-----|---------------|---------|
| 1.35 | CRUD de etapas do pipeline + correção do bug `stage_id` | FR-1, FR-3, FR-8 | — | M |
| 1.36 | Reordenação de etapas por drag-and-drop | FR-2 | 1.35 | P |
| 1.37 | Probabilidade por etapa e etapas de ganho/perda customizadas | FR-4, FR-7 | 1.35 | M |
| 1.38 | Limite WIP e campos obrigatórios por etapa | FR-5, FR-6 | 1.35 | M |

### Frente B — Visões e produtividade

| Story | Título | FRs | Dependências | Tamanho |
|-------|--------|-----|---------------|---------|
| 1.39 | Busca e filtros server-side com paginação (fundação de escala) | FR-15 | — | G |
| 1.40 | Visão em lista/tabela com ordenação | FR-9, FR-10 | 1.39 | M |
| 1.41 | Aba Ganhos/Perdidos e agrupamento por responsável | FR-11, FR-12 | 1.39 | M |
| 1.42 | Visão timeline de negócios | FR-9 | 1.39 | M |
| 1.43 | Filtros salvos | FR-13 | 1.39, 1.40 | P |
| 1.44 | Seleção múltipla e ações em massa | FR-14 | 1.40 | M |

### Frente C — Inteligência e forecast

| Story | Título | FRs | Dependências | Tamanho |
|-------|--------|-----|---------------|---------|
| 1.45 | Forecast ponderado por probabilidade | FR-16 | 1.37 | M |
| 1.46 | Funil de conversão e tempo médio por etapa | FR-17, FR-18 | 1.35 | G |
| 1.47 | Detecção de negócios estagnados | FR-19 | 1.46 | P |
| 1.48 | Ranking de responsáveis e análise de motivos de perda | FR-20, FR-21 | 1.39 | M |

### Frente D — Ações e integrações

| Story | Título | FRs | Dependências | Tamanho |
|-------|--------|-----|---------------|---------|
| 1.49 | Atividades/tarefas no negócio | FR-22 | 1.35 | M |
| 1.50 | Converter negócio ganho em venda | FR-23 | 1.37 | M |
| 1.51 | Vincular produtos do estoque ao negócio | FR-24 | 1.35 | M |
| 1.52 | Criar compromisso na agenda a partir do negócio | FR-25 | 1.35 | P |
| 1.53 | Enviar e-mail a partir do negócio | FR-26 | 1.35 | P |
| 1.54 | Timeline rica de eventos do negócio | FR-27 | 1.49, 1.52, 1.53 | G |

**Total: 20 stories propostas (1.35 a 1.54).**

---

## 5. Sequenciamento recomendado

O sequenciamento segue a dependência técnica real, não a ordem numérica das frentes do brief:

1. **Onda 1 — Fundação A (1.35).** CRUD de etapas e correção do bug de `stage_id` primeiro: é pré-requisito direto ou indireto de 16 das 20 stories propostas, e resolve a lacuna mais grave (#1) e a dívida técnica (#6) antes de qualquer coisa ser construída em cima delas.
2. **Onda 2 — Restante da Frente A (1.36, 1.37, 1.38).** Podem rodar em paralelo entre si após 1.35. **1.37 (probabilidade) é o pré-requisito explícito da Frente C** — sem ela não há forecast ponderado (FR-16) nem etapa de ganho automatizada (FR-23 depende de FR-7).
3. **Onda 3 — Fundação B (1.39).** Busca/filtro server-side é pré-requisito de toda a Frente B e também de análises da Frente C que dependem de consulta agregada (ranking, motivos de perda). Feita antes das visões para evitar retrabalho (construir visão sobre filtro client-side e depois migrar).
4. **Onda 4 — Restante da Frente B (1.40 a 1.44).** Podem rodar em paralelo após 1.39; 1.43 (filtros salvos) e 1.44 (ações em massa) dependem da visão em tabela (1.40).
5. **Onda 5 — Frente C (1.45, 1.46, 1.48 em paralelo; 1.47 depois de 1.46).** Forecast (1.45) depende de 1.37; funil/tempo em etapa (1.46) depende apenas do histórico já existente desde 1.35; estagnação (1.47) reaproveita o cálculo de tempo em etapa de 1.46; ranking/motivos (1.48) depende da consulta server-side de 1.39.
6. **Onda 6 — Frente D (1.49 a 1.53 em paralelo).** Todas dependem apenas da fundação da Frente A (1.35); não têm dependência entre si, podem ser paralelizadas por especialidade (agenda, e-mail, estoque, vendas, atividades).
7. **Onda 7 — Fechamento (1.54).** Timeline rica é a última por natureza: agrega eventos de atividades (1.49), agenda (1.52) e e-mail (1.53), portanto só pode ser implementada depois que essas três existirem.

---

## 6. Riscos

- **Escopo grande (20 stories, 4 frentes).** Risco de estouro de prazo se tratado como epic monolítico; mitigado pelo sequenciamento em ondas, que permite entregas incrementais e validação por frente.
- **Migrations com aprovação manual (NFR-2).** Cada onda que introduz colunas/tabelas novas (probabilidade, WIP, campos obrigatórios, atividades, filtros salvos) depende de aprovação humana antes de aplicar — pode introduzir espera não trivial no cronograma.
- **Dívida de lint/typecheck pré-existente.** `npm run lint` e `npm run typecheck` globais já falham por dívida anterior à Story 1.34; @qa precisa validar de forma focada nos arquivos tocados por cada story, com risco de mascarar regressões novas se a validação focada não for rigorosa.
- **Volume real de dados desconhecido.** FR-15 (paginação server-side) precisa ser calibrada (índices, tamanho de página) com dados reais de produção — o dimensionamento correto só pode ser validado após a Onda 3.
- **Dependência cruzada com outros módulos.** A Frente D integra com `sales`, `inventory`, `agenda` e o módulo de e-mail (Story 1.34). Mudanças de contrato nesses módulos por outras iniciativas em paralelo podem quebrar as integrações — recomenda-se congelar/coordenar interfaces desses módulos durante a Onda 6.
- **Reposicionamento por ponto flutuante (`position DOUBLE PRECISION`).** Decisão preservada por exigência do brief; reordenações muito frequentes ao longo do tempo podem, em tese, aproximar valores de `position` até o limite de precisão do tipo — não é um risco novo introduzido por este epic, mas se agrava com o uso mais intenso de drag-and-drop (FR-2) e deve ser monitorado.

## 7. Fora de escopo

- Automação de regras de negócio (SLA automático, atribuição automática de responsável por regra).
- Importação/exportação em massa de negócios (CSV ou similar).
- Múltiplos pipelines por empresa — o modelo atual (um pipeline, várias etapas) é preservado; o brief não pede multi-pipeline.
- Integrações externas além do e-mail transacional já existente (outros CRMs, WhatsApp, redes sociais).
- Exportação/relatório em PDF do forecast ou funil — o brief pede visualização em tela (gráfico de funil), não exportação de documento.
- Aplicativo mobile nativo para o pipeline.
