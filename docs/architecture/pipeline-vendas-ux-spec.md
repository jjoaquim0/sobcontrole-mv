# Especificação de UX/UI — Evolução do Pipeline de Vendas

> **Autor:** @ux-design-expert (Uma)
> **Data:** 2026-08-12
> **Fonte:** `.ai/pipeline-upgrade-brief.md`, `docs/epics/epic-pipeline-vendas-avancado.md` (FR-1 a FR-27, NFR-1 a NFR-8)
> **Escopo deste documento:** especificação de UX/UI. Não contém código de produção — apenas wireframes, decisões de layout/fluxo e justificativa. Implementação é responsabilidade de @dev por story.
> **Rastreabilidade:** cada seção referencia os FRs/NFRs que especifica. Nenhuma decisão aqui introduz requisito não previsto no epic (Artigo IV — No Invention).

---

## 0. Decisões de arquitetura de tela (resumo)

| Decisão | Onde mora | Por quê |
|---|---|---|
| Configuração de etapas | **Dentro do módulo Pipeline**, painel lateral (drawer), não em Configurações | Config operacional editada com frequência pelo time de vendas, acoplada à leitura visual do kanban — ver §1 |
| Alternância de visões | Segmented control no topo do módulo, ao lado dos filtros | Um único estado de filtros compartilhado por todas as visões — ver §2 |
| Painel de Inteligência | 4ª opção do mesmo segmented control ("Inteligência"), não página separada | Herda os mesmos filtros das outras visões sem reimplementar filtro — ver §5 |
| Negócio expandido | Modal atual **mantido** para edição rápida; nova **DealDetailPage** (`/pipeline/deals/:id`) para atividades/produtos/agenda/e-mail/timeline | Segue o precedente de `CustomerDetailPage`/`SaleDetailPage`; evita sobrecarregar um modal com 6 seções novas — ver §6 |

---

## 1. Configuração de Etapas (FR-1 a FR-7)

### 1.1 Onde mora

**Dentro do módulo Pipeline**, não em Configurações (`SettingsSidebar.tsx`). Três motivos:

1. **Natureza do dado.** Os 9 tabs de `SettingsSidebar` (Geral, Aparência, Notificações, Segurança, Integrações, Envio de e-mails, Equipe, Assinatura, Dados) são preferências transversais da empresa, configuradas raramente. Etapas do funil são um artefato operacional do processo de vendas — o time de vendas ajusta nomes, cores e limites de WIP com frequência, conforme a operação evolui. Misturar os dois no mesmo container sobrecarrega Configurações com algo que não é "configuração da empresa", é "configuração do processo".
2. **Precedente já existente no código.** É o próprio `PipelinePage.tsx` (linha 312-315) que hoje informa a ausência de etapas — a ligação entre a tela e a config de etapas já existe no fluxo, só falta a ação. Manter a config no módulo fecha esse loop sem introduzir um novo destino mental ("onde eu configuro isso?").
3. **Necessidade de contexto visual.** Renomear/reordenar/recolorir etapa é uma tarefa que se beneficia de ver o kanban ao lado (quantos negócios tem cada etapa, cor atual). Uma tela de Configurações fora do módulo perde esse contexto.

**Ponto de entrada:** ícone de engrenagem (`Settings2`, mesmo ícone do tab "Geral") no cabeçalho do Pipeline, ao lado do botão "Novo Negócio". Abre um **drawer lateral** (painel deslizante da direita, `w-full max-w-md`, mesmo padrão visual de modal já usado no repo — fundo `bg-black/55 backdrop-blur-sm` + painel branco/`#1a1d27`), não uma rota nova — drawer preserva o kanban visível/esmaecido atrás, reforçando que é config *daquele* funil.

```
┌──────────────────────────────────────────────────────────────────┐
│  Pipeline de Vendas                              [⚙ Etapas] [+Novo]│
│  32 oportunidades ativas no funil                                  │
├──────────────────────────────────────────────────────────────────┤
│  [Kanban] [Lista] [Timeline] [Inteligência]     🔍 ⌄Resp ⌄Etapa    │
├────────────┬────────────┬────────────┬────────────┬───────────────┘
│ ● Novo     │ ● Qualif.  │ ● Proposta │ ...        │  (kanban ao fundo,
│  Contato   │            │  Enviada   │            │   esmaecido quando
│  8 · R$..  │  5 · R$..  │  3 · R$..  │            │   drawer abre)
```

### 1.2 O painel de gerenciamento de etapas

Título do drawer: **"Gerenciar Etapas do Pipeline"**, subtítulo "Etapas ativas aparecem como colunas no kanban".

```
┌───────────────────────────────────────────┐  ×
│  Gerenciar Etapas do Pipeline               │
│  Etapas ativas aparecem como colunas        │
│  no kanban                                  │
├───────────────────────────────────────────┤
│  ⠿ ● Novo Contato              8 negócios  ⌄│
│  ⠿ ● Qualificação              5 negócios  ⌄│
│  ⠿ ● Proposta Enviada          3 negócios  ⌄│
│  ⠿ ● Negociação                4 negócios  ⌄│
│  ⠿ ● Fechamento                2 negócios  ⌄│
│  ─────────────────────────────────────────  │
│  📁 Ver etapas arquivadas (2)                │
│                                              │
│              [+ Nova Etapa]                 │
└───────────────────────────────────────────┘
```

- **Lista com linhas compactas** (não um formulário por etapa de cara) — cada linha mostra: alça de arraste (`⠿`, ícone `GripVertical`), dot de cor, nome, contagem de negócios, chevron de expandir. Isso resolve diretamente a preocupação do brief de "não virar um formulário intimidante": a maioria das edições (renomear, reordenar, recolorir) acontece sem nunca abrir o accordion.
- **Reordenar (FR-2):** drag-and-drop na própria lista, reaproveitando `@dnd-kit` (já é dependência do projeto, usado em `PipelineColumn`/`DealCard`). Ao soltar, calcula nova `position` por ponto médio entre vizinhos — mesma estratégia já usada em `PipelinePage.handleDragEnd` (`DOUBLE PRECISION`, sem renumerar a coluna). **Navegação por teclado (NFR-5):** cada alça é focável (`tabIndex=0`, `role="button"`, `aria-roledescription="Reordenável"`); com foco na alça, `Space` ativa o "modo de arraste" (`aria-grabbed="true"` + anúncio via `aria-live` "Novo Contato selecionado, posição 1 de 5. Use as setas para mover."), setas ↑/↓ trocam a posição, `Space`/`Enter` confirma, `Esc` cancela. Segue o padrão de teclado que `@dnd-kit`'s `KeyboardSensor` já oferece nativamente (já configurado em `PipelinePage.tsx:55` para o kanban) — aqui é a mesma sensor aplicada a uma lista vertical.
- **Renomear (FR-1):** clique no nome transforma em `<input>` inline (mesmo padrão "clique para editar"), sem abrir modal. `Enter` confirma, `Esc` cancela, blur salva.
- **Cor (FR-3):** clique no dot abre um popover pequeno com paleta de 10 cores predefinidas (as mesmas famílias usadas em `StatCard`'s `colorMap` — emerald, blue, amber, red, purple — mais 5 tons neutros) em grade 5×2, sem color-picker livre (evita inconsistência visual com o resto do app).
- **Criar etapa (FR-1):** botão "+ Nova Etapa" no rodapé abre a mesma linha em modo de edição, inserida ao final da lista com posição = última + 1.
- **Arquivar (FR-1):** cada linha expandida tem ação "Arquivar etapa" (ícone `Archive`) em vez de excluir — etapas arquivadas saem do kanban mas negócios históricos preservam a referência (não há FR de exclusão física de etapa, e excluir quebraria `deal_stage_history`). Se a etapa tiver negócios abertos, o botão fica desabilitado com tooltip: "Mova os N negócios abertos desta etapa antes de arquivá-la." Etapas arquivadas ficam ocultas atrás do link "Ver etapas arquivadas (N)" — colapsado por padrão para não poluir a lista ativa; expandido mostra as mesmas linhas em cinza com ação "Reativar".

### 1.3 Accordion de etapa (probabilidade, WIP, campos obrigatórios, ganho/perda)

Ao clicar no chevron (ou na linha fora da alça/nome), a linha expande **inline** revelando os campos avançados — não navega para outra tela. Só uma etapa expandida por vez (accordion, não todas simultâneas), para manter a lista curta:

```
│  ⠿ ● Proposta Enviada          3 negócios  ⌃│
│  ┌─────────────────────────────────────────┐│
│  │ Probabilidade de fechamento               ││
│  │ [────●──────────────] 40%                 ││
│  │                                            ││
│  │ Limite WIP (negócios abertos simultâneos)  ││
│  │ [ 8 ▾]  ☐ Sem limite                       ││
│  │                                            ││
│  │ Campos obrigatórios para avançar           ││
│  │ ☑ Valor estimado   ☐ Data de fechamento    ││
│  │                                            ││
│  │ Tipo de etapa                              ││
│  │ ( ) Etapa normal                           ││
│  │ ( ) Etapa de ganho 🏆                      ││
│  │ ( ) Etapa de perda ⛔                      ││
│  │                                            ││
│  │ [Arquivar etapa]                           ││
│  └─────────────────────────────────────────┘│
```

- **Probabilidade (FR-4):** slider de 0–100% com valor numérico ao lado (não só slider — permite digitar direto para precisão). Default sugerido por posição (etapa 1 = 10%, última etapa antes de ganho ≈ 80%) apenas como placeholder inicial, nunca gravado automaticamente sem o usuário confirmar.
- **Limite WIP (FR-5):** input numérico + checkbox "Sem limite" (estado padrão para não forçar configuração). Quando não "sem limite", o valor é obrigatório e > 0.
- **Campos obrigatórios (FR-6):** checkboxes simples para os dois campos candidatos que já existem no `Deal` (valor, data de fechamento — os únicos campos opcionais hoje no `dealSchema`). Copy explicativa abaixo: "O negócio não poderá avançar para a etapa seguinte enquanto os campos marcados aqui não estiverem preenchidos" — evita o usuário achar que bloqueia a etapa atual, e sim a promoção a partir dela.
- **Ganho/perda (FR-7):** radio group de 3 estados exclusivos (normal / ganho / perda). Só pode existir **uma** etapa de ganho e **uma** de perda por pipeline — ao marcar uma etapa como ganho, a UI deve mostrar aviso inline se outra etapa já tiver essa flag: "Isto substituirá 'Fechamento' como etapa de ganho." (confirmação simples, sem modal extra). Mover um negócio para essa etapa (drag-and-drop ou troca de etapa no modal) dispara `status: won/lost` automaticamente no backend — a UI do kanban deve refletir isso fechando o card do fluxo aberto (ver §6.4 sobre o modal de fechamento manual continuar existindo para os casos em que a empresa não configurou etapa de ganho/perda).

### 1.4 Estados do drawer

- **Vazio real (novo pipeline sem etapas):** não deveria mais acontecer após esta story, mas se a empresa arquivar todas as etapas, mostra o mesmo padrão de empty state do `DataTable` (ícone `Layers`, "Nenhuma etapa ativa", botão "+ Nova Etapa" centralizado).
- **Carregando:** skeleton de 5 linhas cinza pulsando (mesmo padrão do `DataTable`).
- **Erro ao salvar:** toast `sonner` de erro (padrão do repo, `NFR-7`) + linha permanece em modo de edição para nova tentativa (mesmo padrão de `handleConfirmDelete` em `PipelinePage.tsx`).
- **Sem permissão:** ver §7 (regra transversal).

---

## 2. Alternância de Visões (FR-9)

### 2.1 Onde fica

**Segmented control** (4 opções: Kanban · Lista · Timeline · Inteligência) posicionado na barra de filtros existente, à esquerda da busca — não em um submenu ou tabs separados por baixo do header, para ficar sempre visível junto dos filtros que ele compartilha:

```
┌──────────────────────────────────────────────────────────────────────┐
│ [🗂 Kanban] [☰ Lista] [🕐 Timeline] [✨ Inteligência]                  │
│                                                                        │
│  🔍 Pesquisar...      ⌄ Todos Responsáveis  ⌄ Todas Etapas  ⌄ Status  │
└──────────────────────────────────────────────────────────────────────┘
```

Visualmente: pill group com fundo `bg-gray-100 dark:bg-white/5 rounded-xl p-1`, opção ativa com `bg-white dark:bg-[#1a1d27] shadow-sm text-gray-900 dark:text-white`, inativas `text-gray-500`. Mesmo padrão de "segmented control" já visto implicitamente nos botões de ação do `DealModal` (par de botões ganho/perda) — reaproveita a linguagem visual, não introduz um terceiro estilo de toggle.

### 2.2 Como preserva filtros ao trocar de visão

O estado de filtros (`search`, `ownerId`, `stageId`, e o novo `status` de FR-11) sobe para o componente pai `PipelinePage` (já é o caso hoje — `searchInput`, `ownerFilter`, `stageFilter` já vivem em `PipelinePage`, não nas visões). A troca de visão é **apenas** uma troca de qual componente de renderização de dados é montado (`<KanbanView>` / `<ListView>` / `<TimelineView>` / `<IntelligencePanel>`), todos recebendo os mesmos `deals`/`filters` já carregados — a visão não refaz fetch nem reseta filtro.

Persistência sugerida: `?view=list&stage=...` como **query params** da rota `/pipeline` (via `useSearchParams`), não apenas estado local — isso permite compartilhar link para uma visão+filtro específicos e sobrevive a F5, coerente com o fato de a Frente B mover a busca para server-side (FR-15) e precisar de estado sincronizável com paginação.

### 2.3 Estado vazio/erro/carregando

Comuns a todas as visões — especificados uma vez em §7 e reaplicados; cada visão implementa o **mesmo contrato visual** (ícone + título + subtítulo + ação), trocando apenas o ícone e a cópia por visão (kanban usa `Handshake`, lista usa `Table`/`Rows`, timeline usa `Clock`, inteligência usa `Sparkles`/`BarChart3`).

---

## 3. Visão Lista/Tabela (FR-10, FR-12, FR-14)

Reaproveita `DataTable` (`src/components/shared/DataTable.tsx`) como base, estendendo-o com 3 capacidades que ele não tem hoje: cabeçalho ordenável, agrupamento visual e seleção com checkbox. Especificação funcional (implementação decide se estende `DataTable` genérico ou cria wrapper `PipelineListView` que compõe `<table>` similar):

### 3.1 Colunas (FR-10)

| Coluna | Ordenável | Conteúdo |
|---|---|---|
| ☐ (seleção) | não | checkbox — ver §3.3 |
| Negócio | sim (nome) | título + nome do cliente abaixo, truncado (mesmo padrão do `DealCard`) |
| Etapa | sim | dot de cor + nome, clicável → abre `<select>` inline para mudar etapa sem abrir modal (ação rápida) |
| Valor | sim (padrão desc.) | formatado BRL, alinhado à direita |
| Previsão | sim | data; se atrasado, mesmo badge vermelho + `AlertCircle` do `DealCard` |
| Responsável | sim | avatar de iniciais (mesmo padrão do `DealCard`) + nome |
| Status | não (ver FR-11) | `StatusBadge` reaproveitado (`ativo`→open mapeia visualmente a "Aberto"; adicionar variantes `won`/`lost` ao componente compartilhado, ver §3.5) |

Clique em qualquer célula fora da etapa/checkbox abre o `DealModal` (mesmo comportamento de clique no card do kanban) — consistência entre visões.

### 3.2 Ordenação (FR-10)

Clique no cabeçalho ordena; segundo clique inverte; terceiro clique volta ao padrão (posição/etapa). Indicador: seta `ChevronUp`/`ChevronDown` de 12px ao lado do label do cabeçalho ativo, cinza nos inativos. Como FR-15 move a busca para server-side, a ordenação também deve ser resolvida no servidor (parâmetro de query), não client-side — a UI apenas reflete o estado (`sortBy`, `sortDir` nos query params da URL, junto com os filtros de §2.2).

### 3.3 Agrupamento por responsável (FR-12)

Toggle "Agrupar por Responsável" (ícone `Users`) ao lado do segmented control de visões, **desligado por padrão** (tabela plana). Quando ligado, a tabela vira uma sequência de seções colapsáveis, uma por responsável:

```
┌────────────────────────────────────────────────────────────┐
│ ▾ Ana Ferreira · 8 negócios · R$ 142.500,00                  │
├──┬──────────────┬───────────┬──────────┬──────────┬─────────┤
│☐ │ Negócio       │ Etapa     │ Valor    │ Previsão │ Status  │
│☐ │ ERP Cliente X │ ● Proposta│ R$ 45.000│ 12/09    │ Aberto  │
│☐ │ ...           │           │          │          │         │
├──┴──────────────┴───────────┴──────────┴──────────┴─────────┤
│ ▸ Bruno Costa · 5 negócios · R$ 88.000,00                     │
└────────────────────────────────────────────────────────────┘
```

Cabeçalho de grupo mostra contagem e soma de valor do grupo (reaproveita o padrão já usado no header de `PipelineColumn`: nome + contagem + valor total). Grupos sem negócios do filtro atual não aparecem. Ordenação (§3.2) se aplica **dentro** de cada grupo.

### 3.4 Seleção múltipla e ações em massa (FR-14)

- Checkbox por linha + checkbox no cabeçalho (seleciona todos os visíveis na página atual, não todos os registros — evita ação em massa acidental sobre milhares de registros não carregados, coerente com paginação de FR-15).
- Ao selecionar ≥ 1 linha, surge uma **barra de ações fixa no rodapé da viewport** (`sticky bottom-0`, mesmo padrão de elevação usado nos modais — `shadow-2xl`, fundo `bg-white dark:bg-[#1a1d27]`), não um dropdown por linha — mais visível e permite ação sobre múltiplas linhas de uma vez:

```
┌──────────────────────────────────────────────────────────────┐
│  ✓ 4 negócios selecionados            [Limpar seleção]         │
│                                                                  │
│  [⌄ Mudar etapa]  [⌄ Reatribuir responsável]  [🗑 Excluir]      │
└──────────────────────────────────────────────────────────────┘
```

- "Mudar etapa" e "Reatribuir responsável" abrem um popover pequeno com `<select>` + botão "Aplicar" (não modal cheio — ação rápida). "Excluir" reaproveita `ConfirmModal` já existente, mas com mensagem plural: "Tem certeza que deseja excluir 4 oportunidades? Esta ação não pode ser desfeita." — mesmo componente, apenas o texto varia por contagem.
- Se a mudança de etapa em massa envolver mover negócios para uma etapa com limite WIP (FR-5) que estouraria o limite, a UI **não bloqueia** (WIP é sinalização, não trava — ver §4), mas o popover mostra aviso inline: "Isso levará 'Negociação' a 12 negócios (limite: 8)."

### 3.5 `StatusBadge` — extensão necessária

FR-11 (aba Ganhos/Perdidos) e a coluna Status da lista precisam de variantes `won`/`open`/`lost` no componente compartilhado `StatusBadge.tsx`, que hoje não cobre esse domínio (`pago/pendente/atrasado/cancelado/ativo/inativo`). Recomendo adicionar ao mapa existente: `open` → mesma classe visual de `ativo` (verde), `won` → verde mais forte com ícone de troféu embutido no texto ("Ganho"), `lost` → mesma classe de `cancelado` (laranja) com texto "Perdido". Extensão aditiva ao componente existente, não um novo componente.

---

## 4. Sinalização de WIP e Estagnação (FR-5, FR-19)

Princípio geral: **sinalizar sem bloquear e sem redesenhar o kanban.** Ambos os sinais usam o mesmo vocabulário visual já presente no kanban (badges pequenos, cores de estado), nada de banners ou modais de aviso.

### 4.1 Excesso de WIP na coluna (FR-5)

No cabeçalho de `PipelineColumn`, o contador de negócios (`{deals.length}`, hoje um badge cinza neutro) muda de cor quando a coluna ultrapassa o limite WIP configurado (§1.3):

```
Estado normal (5/8):          Estado excedido (11/8):
┌──────────────────────┐      ┌──────────────────────┐
│ ● Negociação      [5]│      │ ● Negociação    [11 ⚠]│
│ R$ 84.000,00          │      │ R$ 210.000,00          │
└──────────────────────┘      └──────────────────────┘
     badge cinza                   badge âmbar + ícone
```

- Badge muda de `bg-gray-100 text-gray-500` para `bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400`, com um ícone `AlertTriangle` de 10px antes do número.
- `title`/tooltip no badge: "11 negócios — limite configurado: 8". Acessível via `aria-label` no mesmo elemento (NFR-5).
- **Sem bloqueio:** dropar um card numa coluna no limite continua funcionando — é sinalização de gestão, não trava operacional (nenhum FR pede bloqueio; inventá-lo violaria Artigo IV).
- Etapas sem limite (`☐ Sem limite` marcado em §1.3) nunca mostram esse estado.

### 4.2 Negócio estagnado no card (FR-19)

Cada card no kanban (e cada linha na lista) recebe um indicador discreto quando o negócio está sem movimentação de etapa há mais que o limite configurável de dias (o limite é uma configuração global do pipeline — proponho campo simples em nível de pipeline, não por etapa, já que FR-19 não associa a etapa específica; ver Dev Notes da story correspondente para decidir onde esse número mora no schema).

```
┌───────────────────────────────┐
│ ERP Cliente XPTO          🕐14d│  ← badge de estagnação, canto sup. direito
│ Cliente XPTO Ltda               │
│ R$ 45.000,00              [AF] │
│ 🕐 Previsão: 12/09              │
└───────────────────────────────┘
```

- Badge pequeno (`text-[10px] font-semibold`, ícone `Clock` 10px) no canto superior direito do card, cor `text-amber-600 dark:text-amber-400` sobre fundo sutil `bg-amber-50 dark:bg-amber-500/10`, texto "14d" (dias desde a última mudança de etapa, arredondado). Não ocupa uma linha inteira do card — cabe ao lado do título, sem competir com o badge de atraso (`isOverdue`) que já existe no rodapé do card e trata de outro dado (data prevista de fechamento, não estagnação).
- Tooltip completo: "Sem movimentação de etapa há 14 dias (desde 29/07/2026)."
- Limite configurável exposto como um campo simples nas configurações de etapas (§1, rodapé do drawer, fora do accordion por etapa — é uma configuração do pipeline como um todo): "Considerar negócio estagnado após `[14]` dias sem mudança de etapa", com default sugerido de 14 dias caso o campo não seja implementado como obrigatório na primeira story.
- Na visão Lista (§3), a mesma informação vira uma coluna opcional "Dias parado" (ordenável), permitindo priorizar por estagnação sem depender de escanear o kanban visualmente.

---

## 5. Painel de Inteligência (FR-16 a FR-21)

### 5.1 Decisão: aba do mesmo seletor de visões, não painel lateral nem página separada

Três alternativas foram consideradas:

| Opção | Descontinuada por quê |
|---|---|
| Painel lateral (drawer permanente) | Compete por espaço horizontal com o kanban, que já usa scroll horizontal para colunas — um painel fixo reduziria ainda mais o espaço útil das colunas |
| Página separada (nova rota fora de `/pipeline`) | Duplicaria a barra de filtros e quebraria a garantia de FR-9 ("preservar filtros ao trocar de visão") — o usuário perderia o filtro de responsável/etapa ao navegar para uma rota diferente |
| **Aba "Inteligência" no segmented control (escolhida)** | Reaproveita o mesmo estado de filtros já construído para FR-9, mesmo padrão de navegação que o usuário já aprendeu para Kanban/Lista/Timeline |

A aba "Inteligência" respeita os mesmos filtros ativos (responsável, etapa, busca) — ex.: filtrar por um responsável e abrir "Inteligência" mostra o forecast e o funil *daquele* responsável, não da empresa toda. Isso é consistente com FR-12 (agrupamento por responsável) e FR-20 (ranking de responsáveis) operando sobre a mesma base de dados filtrável.

### 5.2 Layout

Grid responsivo de cards de análise, sem tabs internas adicionais (evita nested navigation) — a aba já é o nível de navegação suficiente:

```
┌──────────────────────────────────────────────────────────────────┐
│ [🗂 Kanban] [☰ Lista] [🕐 Timeline] [✨ Inteligência]               │
├──────────────────────────────────────────────────────────────────┤
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│ │ Forecast    │ │ Ciclo médio │ │ Estagnados │ │ Conversão   │      │  ← 4 StatCards
│ │ Ponderado   │ │ de Venda    │ │            │ │ Geral       │      │
│ │ R$ 186.400  │ │ 22 dias     │ │ 6 negócios │ │ 24%         │      │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘      │
│                                                                     │
│ ┌──────────────────────────────┐ ┌───────────────────────────┐   │
│ │ Funil de Conversão             │ │ Tempo Médio por Etapa       │   │
│ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 40 (100%) │ │  Novo Contato    ▓▓▓ 3d     │   │
│ │  ▓▓▓▓▓▓▓▓▓▓▓▓▓ 26 (65%)       │ │  Qualificação    ▓▓▓▓▓▓ 6d  │   │
│ │  ▓▓▓▓▓▓▓ 14 (35%)              │ │  Proposta        ▓▓▓▓▓▓▓▓ 9d│   │
│ │  ▓▓▓ 6 (15%)                   │ │  Negociação      ▓▓▓▓ 5d    │   │
│ └──────────────────────────────┘ └───────────────────────────┘   │
│                                                                     │
│ ┌──────────────────────────────┐ ┌───────────────────────────┐   │
│ │ Ranking de Responsáveis        │ │ Motivos de Perda            │   │
│ │ 🥇 Ana Ferreira  R$142k · 68%  │ │ Preço alto        ▓▓▓▓▓ 40% │   │
│ │ 🥈 Bruno Costa   R$ 88k · 52%  │ │ Concorrência      ▓▓▓ 25%   │   │
│ │ 🥉 Clara Nunes   R$ 61k · 44%  │ │ Sem orçamento     ▓▓ 18%    │   │
│ └──────────────────────────────┘ └───────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

- **Linha 1 (FR-16, parte de FR-18/20/21 resumidos em StatCards):** 4 `StatCard`s reaproveitados como estão (`accentColor` verde para forecast, azul para ciclo médio, âmbar para estagnados, roxo para conversão) — mesma grade `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5` já usada em `PipelinePage.tsx:203`.
- **Funil de conversão (FR-17):** gráfico de barras horizontais decrescentes (funil), uma barra por etapa ativa, com contagem absoluta e percentual relativo à primeira etapa. Cor das barras usa a cor de cada etapa (`stage.color`) — reforça a identidade visual já estabelecida no kanban, em vez de uma paleta genérica de biblioteca de gráficos.
- **Tempo médio por etapa (FR-18):** barras horizontais, uma por etapa, valor em dias. Compartilha o card de estagnação (§4.2) como fonte do mesmo dado de `deal_stage_history`, evitando computar duas vezes a mesma métrica em lugares diferentes do produto.
- **Ranking de responsáveis (FR-20):** lista top-N (sugestão: 5, com link "ver todos" se houver mais) ordenada por valor fechado, com medalha visual para top-3 e métricas secundárias (taxa de conversão, ciclo médio) como texto secundário — não uma tabela `DataTable` completa aqui (é um resumo, a versão completa pode ser a mesma visão Lista agrupada por responsável de §3.3, ordenada por valor).
- **Motivos de perda (FR-21):** gráfico de barras horizontais simples com o texto livre de `lost_reason` agrupado (case-insensitive/trim) e percentual. Se `lost_reason` estiver vazio/nulo em muitos registros, incluir categoria "Não informado" — nunca omitir dados por falta de motivo preenchido.
- Todos os 6 blocos secundários seguem o mesmo container visual já usado (`bg-white dark:bg-[#1a1d27] border border-gray-100 dark:border-white/5 rounded-2xl p-4 sm:p-5 shadow-sm`), grid `md:grid-cols-2 gap-5`.

### 5.3 Estados

- **Vazio (nenhum negócio no filtro atual):** cada card individualmente mostra seu próprio empty state curto ("Sem dados suficientes para este período/filtro") em vez de esconder o painel inteiro — mantém a aba navegável mesmo com poucos dados, e ajuda o usuário a entender que precisa ajustar o filtro.
- **Carregando:** skeleton nos 4 `StatCard`s (mesmo shimmer já usado em `DataTable`) + placeholders de barra cinza nos 2 gráficos.
- **Erro:** mesmo padrão de erro de §7, por card afetado (um gráfico pode falhar sem derrubar os outros, já que cada bloco provavelmente é uma query React Query independente).

---

## 6. Negócio Expandido (FR-22 a FR-27)

### 6.1 Decisão

**Não** cabe no `DealModal` atual. FR-22 a FR-27 adicionam 5 seções de conteúdo substancial (atividades com estado próprio, produtos vinculados com cálculo de valor, agendamento, envio de e-mail com histórico, timeline unificada) — o modal hoje já tem scroll interno (`max-h-[90vh] overflow-y-auto`) só para os campos básicos + histórico de etapa. Empilhar mais 5 seções no mesmo modal violaria a essência de um modal (ação rápida e contida) e pioraria a usabilidade em mobile.

**Decisão:** criar `DealDetailPage` em `/pipeline/deals/:id`, seguindo o mesmo padrão estrutural de `CustomerDetailPage.tsx` e `SaleDetailPage.tsx` já existentes no repo (header com botão voltar, StatCards de resumo, seções de conteúdo, modais de edição específicos abertos a partir da página). O `DealModal` **é mantido como está**, para os dois fluxos onde uma ação rápida em modal continua sendo a melhor UX:

1. **Criar negócio** (`+Novo Negócio`, `+` na coluna do kanban) — criação rápida sem sair do kanban.
2. **Edição rápida de campos básicos + fechar negócio** a partir do clique no card do kanban/lista — continua abrindo o modal atual, sem navegação, para o caso comum de "só mudar valor/etapa/data e seguir organizando o funil".

Dentro do modal, adiciona-se um link/botão "Ver negócio completo →" (estilo texto, canto superior do modal, ao lado do título) que navega para `DealDetailPage`. Esse link só aparece quando `deal` existe (edição, não criação).

### 6.2 Wireframe da `DealDetailPage`

```
┌────────────────────────────────────────────────────────────────────┐
│ ← Voltar ao Pipeline                                                 │
│                                                                       │
│ 🤝 ERP Cliente XPTO                              [✎ Editar] [🏆 Ganho]│
│    Cliente XPTO Ltda · Ana Ferreira · Etapa: Proposta Enviada        │
├────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                 │
│ │ Valor     │ │ Probab.   │ │ Previsão  │ │ Tempo na  │                 │
│ │ R$ 45.000 │ │ 40%       │ │ 12/09     │ │ etapa: 9d │                 │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                 │
├────────────────────────────────────────────────────────────────────┤
│ [Visão Geral] [Produtos] [Atividades] [Agenda] [E-mails] [Timeline]   │
├────────────────────────────────────────────────────────────────────┤
│  (conteúdo da seção ativa)                                           │
└────────────────────────────────────────────────────────────────────┘
```

- **Header:** mesmo padrão de `SaleDetailPage`/`CustomerDetailPage` (botão "← Voltar", ícone do domínio, título grande, metadados secundários em linha). Ação primária contextual: se o pipeline tem etapa de ganho configurada (FR-7) e o negócio ainda está aberto, botão "Converter em Venda" (FR-23, `accentColor` verde, ícone `ShoppingCart`) fica visível diretamente no header assim que o negócio está na etapa de ganho ou já `status='won'` — não escondido dentro de uma sub-aba, por ser a ação de maior valor de negócio da página.
- **StatCards de resumo:** reaproveita `StatCard`, 4 cards com os dados que já existem no `Deal` + `PipelineStage` (valor, probabilidade da etapa atual, previsão de fechamento, tempo na etapa atual — este último reaproveita o cálculo de `deal_stage_history` já necessário para FR-18).
- **Sub-navegação por abas** (não accordion nem scroll único) — 6 seções, volume de conteúdo por seção justifica abas independentes ao contrário do drawer de etapas (§1) onde o conteúdo por item é pequeno. Abas seguem o mesmo estilo visual do segmented control de §2 para consistência entre as duas alternâncias de contexto do módulo.

### 6.3 Conteúdo de cada aba

- **Visão Geral:** os campos hoje editáveis no `DealModal` (título, cliente, responsável, valor, previsão, observações) em modo leitura, com botão "Editar" reabrindo o `DealModal` centralizado sobre a página — reaproveita 100% do modal existente para edição, a página só adiciona a leitura formatada.
- **Produtos (FR-24):** tabela (reaproveita `DataTable`) de itens vinculados — produto (busca no módulo `inventory`), quantidade, preço unitário, subtotal — com rodapé de "Total em produtos" e ação "+ Adicionar produto" abrindo um modal simples de busca+quantidade. Se o valor calculado dos produtos divergir do campo `value` do negócio, mostrar aviso inline não bloqueante: "O valor dos produtos (R$ X) é diferente do valor estimado do negócio (R$ Y)." — decisão de reconciliar ou não é do usuário, sem sobrescrever automaticamente.
- **Atividades (FR-22):** lista de tarefas com checkbox de concluído, título, responsável, data de vencimento — mesmo padrão visual de lista simples (sem drag, sem tabela), com "+ Nova Atividade" no topo. Atividades vencidas usam o mesmo vermelho de `isOverdue` já padronizado no `DealCard`.
- **Agenda (FR-25):** se já existe compromisso vinculado (`Appointment.dealId`), mostra um card de resumo (data, horário, título) com link "Ver na Agenda"; se não existe, CTA "+ Criar compromisso" que abre o fluxo de criação de compromisso do módulo `agenda` pré-preenchido com `dealId` e título sugerido a partir do negócio.
- **E-mails (FR-26):** histórico de e-mails enviados a partir deste negócio (reaproveitando `useEmailSender` da Story 1.34) + botão "Enviar e-mail" abrindo o compositor já existente do módulo de e-mail transacional, pré-preenchido com o e-mail do cliente vinculado ao negócio.
- **Timeline (FR-27):** feed cronológico único (mais recente no topo) unificando: mudanças de etapa (`deal_stage_history`), atividades concluídas/criadas, compromissos de agenda criados, e-mails enviados. Cada entrada tem um ícone por tipo de evento (troca de etapa usa o mesmo ícone `History` do modal atual; atividade usa `CheckSquare`; agenda usa `Calendar`; e-mail usa `Mail`) e timestamp relativo + absoluto no tooltip. Reaproveita visualmente o padrão de lista de histórico que já existe no `DealModal` atual (linha 356-368), só que como feed principal da aba em vez de uma lista secundária de 28px de altura.

### 6.4 Compatibilidade com o fluxo de fechar negócio já existente

O `DealModal` continua com os botões "Marcar como Ganho"/"Marcar como Perdido" para empresas que não configuraram etapas de ganho/perda (FR-7 é opcional — nem toda empresa precisa configurar). Quando a etapa de ganho/perda **está** configurada, mover o card para essa coluna no kanban (drag-and-drop) já fecha o negócio automaticamente — nesse caso, os botões manuais do modal ficam desabilitados com nota: "Este pipeline já usa etapas de ganho/perda automáticas. Mova o negócio para a etapa correspondente." — evita os dois mecanismos conflitarem.

---

## 7. Estados: vazio, carregando, erro e sem permissão

Contrato visual único reaplicado em todas as telas novas (drawer de etapas, 4 visões, `DealDetailPage`), pelos mesmos motivos de consistência já aplicados no restante do repo (`PipelinePage.tsx:287-316` já estabelece o padrão para vazio/carregando/erro do kanban — as telas novas seguem o mesmo, não inventam um quarto padrão).

| Estado | Padrão visual | Exemplo por tela |
|---|---|---|
| **Carregando** | `Loader2` verde girando (`text-[#10b981] animate-spin`), centralizado, ou skeleton de linhas quando há uma tabela (`DataTable` já tem skeleton pronto) | Lista/Timeline: skeleton de linhas; Inteligência: skeleton nos `StatCard`s; Drawer de etapas: skeleton de 5 linhas |
| **Vazio** | Ícone temático 48px + título em negrito + subtítulo cinza + CTA quando aplicável, container `bg-white dark:bg-[#1a1d27] border rounded-2xl p-10 text-center` (idêntico ao bloco de `stages.length === 0` já existente) | Lista sem negócios no filtro: "Nenhum negócio encontrado com esses filtros" + botão "Limpar filtros" (reaproveita `handleClearFilters`); Timeline sem eventos: "Nenhuma movimentação registrada ainda"; Atividades sem itens: "Nenhuma atividade registrada" + "+ Nova Atividade" |
| **Erro** | Ícone `AlertCircle` vermelho em círculo (`bg-red-50 dark:bg-red-950/20`) + título + subtítulo + botão "Tentar novamente" chamando `refetch()` (idêntico ao bloco `isError` já existente em `PipelinePage.tsx:288-304`) | Aplicado por card na aba Inteligência (§5.3) quando a query daquele bloco específico falha, sem derrubar os demais |
| **Sem permissão** | Ícone `Lock` cinza + "Acesso negado" + subtítulo explicando o requisito, mesmo padrão já usado em `StockRecommendationsPage.tsx:149-155` | Ver §7.1 |

### 7.1 Sem permissão — regra específica do pipeline

O schema de `Profile.role` já define `'admin' | 'manager' | 'employee'` (`src/types/index.ts`). Nenhum FR do epic define explicitamente uma matriz de permissões por role para o pipeline — por Artigo IV (No Invention), esta especificação **não inventa** uma matriz nova. A única superfície nova que claramente exige elevação de privilégio, por analogia direta ao padrão já usado no repo para configurações que afetam a empresa toda (`SettingsPage` já é implicitamente restrita a quem tem acesso ao menu Configurações), é:

- **Drawer "Gerenciar Etapas" (§1):** ícone de engrenagem só aparece para `role !== 'employee'` (ou seja, `admin`/`manager`), mesma granularidade que os demais tabs administrativos do app. Um `employee` que tentar acessar a rota/ação diretamente vê o estado "Acesso negado" com subtítulo: "Apenas administradores e gerentes podem configurar as etapas do pipeline." Esta é uma recomendação de UX alinhada ao padrão existente, não uma obrigação do epic — @architect/@po devem confirmar a regra de autorização exata na story de FR-1 antes da implementação.
- As demais telas (Lista, Timeline, Inteligência, `DealDetailPage`) seguem a mesma visibilidade que o kanban já tem hoje — nenhuma restrição adicional inventada.

---

## 8. Componentes compartilhados — reaproveitados vs. novos

### Reaproveitados sem alteração
`PageHeader`, `StatCard`, `ConfirmModal`, `DataTable` (base), `DealModal` (mantido, com uma adição pontual de link — ver §6.1).

### Reaproveitados com extensão aditiva
- **`StatusBadge`** — adicionar variantes `open`/`won`/`lost` (§3.5). Extensão de um mapa existente, não quebra os usos atuais em `financial`/`sales`/etc.

### Novos componentes compartilhados recomendados (por reaproveitamento potencial fora do pipeline)
1. **`SegmentedControl`** (§2) — o padrão de "pill group" para alternância de visão é genérico o suficiente para ser reaproveitado em outros módulos com múltiplas visões no futuro (ex.: relatórios). Recomendo criar em `src/components/shared/SegmentedControl.tsx` em vez de deixar local ao pipeline.
2. **`BulkActionBar`** (§3.4) — barra fixa de ações em massa para seleção múltipla em tabela; o padrão (contagem + limpar + ações) é reaproveitável em qualquer `DataTable` futura com seleção (ex.: clientes, produtos). Recomendo `src/components/shared/BulkActionBar.tsx`.
3. **`HorizontalBarChart`** (§5.2, usado no funil, tempo por etapa e motivos de perda) — um componente simples de barras horizontais com label + valor + cor customizável por barra, sem dependência de biblioteca de gráficos pesada, reaproveitável em qualquer outro painel de analytics do app. Recomendo `src/components/shared/HorizontalBarChart.tsx`.

### Específicos do módulo Pipeline (não compartilhados)
`StageManagerDrawer`, `PipelineListView`, `PipelineTimelineView`, `PipelineIntelligencePanel`, `DealDetailPage` + suas sub-seções (`DealProductsTab`, `DealActivitiesTab`, `DealAgendaTab`, `DealEmailsTab`, `DealTimelineTab`).

---

## 9. Acessibilidade e dark mode — checklist transversal (NFR-5, NFR-6)

- Todo novo elemento interativo (checkbox de seleção, alça de arraste, aba, segmented control) precisa de `aria-label` ou texto visível associado — nenhum ícone sozinho sem `title`/`aria-label`, seguindo o padrão já presente em `PipelineColumn.tsx:43` (`title="Novo negócio nesta etapa"`).
- Reordenação por teclado especificada em §1.2 é a única interação de drag-and-drop nova introduzida por este epic (drawer de etapas); o drag-and-drop do kanban já tem suporte a teclado via `KeyboardSensor` (`PipelinePage.tsx:55`) — deve ser preservado, não é novo.
- Todas as cores novas (badges de WIP âmbar, estagnação âmbar, barras do funil coloridas por etapa) devem manter contraste mínimo AA sobre fundo claro e escuro — reaproveitar exatamente os tokens de cor já validados no repo (`amber-600`/`amber-400` já usados em outros lugares do app) em vez de introduzir novos tons.
- Toda superfície nova precisa de par `dark:` completo — nenhuma cor hardcoded sem contraparte escura, seguindo 100% o padrão já onipresente no código atual (`bg-white dark:bg-[#1a1d27]`, `border-gray-100 dark:border-white/5`).
- Foco visível (`focus:ring-2 focus:ring-[#10b981]`) obrigatório em todo novo input/select/botão, replicando o padrão já usado em `PipelinePage.tsx` e `DealModal.tsx`.
