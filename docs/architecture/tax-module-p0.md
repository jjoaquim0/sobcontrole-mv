# Arquitetura P0 — Módulo Tributário (gerencial)

## Objetivo e fronteira

O Módulo Tributário estima, provisiona e organiza a carga tributária da empresa
a partir dos dados operacionais que o SobControle já armazena. Ele existe para
que o gestor saiba, antes do vencimento, **quanto vai pagar de imposto, quando
vence e se o caixa cobre**.

O módulo é **gerencial**. Ele não apura tributo com validade fiscal, não emite
documento fiscal, não transmite nada para órgão público e não substitui o
contador. Essa fronteira é a mesma já declarada na seção 13 da documentação do
produto e deve aparecer explicitamente na interface.

## Fora de escopo (decisão explícita)

- emissão e transmissão de NF-e, NFC-e e NFS-e;
- custódia de certificado digital A1/A3;
- integração com SEFAZ, prefeituras ou Receita Federal para transmissão;
- obrigações acessórias (SPED, EFD, DCTFWeb, DEFIS, GIA);
- retenções na fonte e regimes especiais estaduais/municipais.

Se a emissão fiscal for priorizada no futuro, a decisão de referência é
**integrar um provedor** (Focus NFe, PlugNotas, NFe.io, eNotas) em vez de
implementar comunicação com a SEFAZ.

---

## Parte 1 — Como o sistema sabe o regime

O regime **não é perguntado ao usuário**. Ele é derivado do CNPJ que já existe
em `companies.cnpj`, contra a base pública da Receita Federal, e depois
**confirmado** pelo usuário. Perguntar direto produz erro: boa parte dos
empresários não sabe o próprio anexo, e alguns nem sabem que foram excluídos do
Simples.

### Fonte

Consulta pública de CNPJ (BrasilAPI `/api/cnpj/v1/{cnpj}` como provedor
primário, com provedor alternativo configurável). Campos usados:

| Campo | Uso |
| --- | --- |
| `opcao_pelo_mei`, `data_opcao_pelo_mei`, `data_exclusao_do_mei` | Identifica MEI e a vigência. |
| `opcao_pelo_simples`, `data_opcao_pelo_simples`, `data_exclusao_do_simples` | Identifica Simples e a vigência. |
| `regime_tributario[]` (`ano`, `forma_de_tributacao`) | Histórico de Lucro Presumido/Real por ano. |
| `cnae_fiscal`, `cnae_fiscal_descricao`, `cnaes_secundarios[]` | Deriva o anexo provável e a natureza da atividade. |
| `uf`, `municipio`, `codigo_municipio_ibge` | Jurisdição de ICMS e ISS. |
| `porte`, `codigo_porte` | Verificação de coerência com o regime. |
| `situacao_cadastral`, `descricao_situacao_cadastral` | Alerta se o CNPJ não está ativo. |
| `razao_social`, `nome_fantasia` | Preenche o cadastro da empresa. |

### Regra de derivação

```text
opcao_pelo_mei = true e sem data_exclusao_do_mei vigente
  → MEI

opcao_pelo_simples = true e sem data_exclusao_do_simples vigente
  → Simples Nacional
  → anexo sugerido pelo cnae_fiscal via cnae_anexo_map

regime_tributario[] com forma_de_tributacao do ano corrente ou anterior
  → Lucro Presumido ou Lucro Real

nenhum dos anteriores, ou campos nulos
  → indeterminado: declaração manual assistida
```

**Campos nulos são comuns.** A base pública tem lacunas, e o retorno nulo não
significa "não optante". A interface nunca trata nulo como negativo: ela declara
"não foi possível determinar" e pede a confirmação.

### Confirmação obrigatória

O dado derivado **nunca é gravado direto** em `company_tax_profile`. A tela
mostra o que foi encontrado, a origem e a data do dado, e o usuário confirma ou
corrige. O que ficou indeterminado é preenchido à mão. Só então o perfil é
persistido, com `source` registrando se veio da Receita ou de declaração.

### Cache e revalidação

As respostas vão para `cnpj_registry_cache` (catálogo global por CNPJ, com
`fetched_at`), evitando repetir consulta e protegendo contra rate limit — a API
é pública, sem SLA e sem garantia de disponibilidade.

Uma revalidação periódica detecta **mudança de regime**: exclusão do Simples,
desenquadramento do MEI ou mudança de `forma_de_tributacao`. Isso vira alerta,
porque hoje o empresário costuma descobrir isso tarde demais.

---

## Parte 2 — Como o cálculo fica preciso

Saber o regime resolve *qual tabela usar*. Não resolve *qual receita entra em
qual anexo*, nem *quais produtos já tiveram o tributo recolhido antes*. Sem
isso, a estimativa erra de forma estrutural.

A precisão vem de classificar a receita, e isso exige tocar o cadastro de
produtos. É o custo real do módulo e está sendo assumido de forma consciente.

### Classificação em cascata

Nenhum cliente vai classificar 800 produtos no onboarding. A classificação é
herdada, com sobrescrita onde importa:

```text
produto            → classificação própria, quando definida
  ↓ herda de
categoria          → padrão da categoria
  ↓ herda de
perfil da empresa  → anexo derivado do CNAE principal
```

Assim o sistema funciona no dia 1 com zero classificação manual, e fica mais
preciso conforme o cliente refina — em vez de exigir tudo antes de servir para
alguma coisa.

### O que se classifica

| Atributo | Valores | Efeito no cálculo |
| --- | --- | --- |
| `anexo` | I a V | Segrega a receita: cada anexo tem RBT12 e alíquota efetiva próprios. |
| `tributacao` | `normal`, `st`, `monofasico`, `isento`, `exportacao` | Remove do DAS o percentual do tributo já recolhido ou não devido. |

Sem isso, uma farmácia, uma autopeças ou uma distribuidora de bebidas tem a
carga **superestimada** — e uma empresa mista de comércio e serviço tem a carga
simplesmente errada.

### Indicador de cobertura

A tela declara quanto da receita do mês está classificada:

> "92% da receita de agosto está classificada. 8% usa o padrão da empresa."

Isso transforma imprecisão em informação visível. O cliente sabe o quanto pode
confiar e sabe exatamente o que fazer para melhorar.

### Erro medido, não prometido

`tax_assessments` guarda a estimativa **e** o valor real, quando o contador
informa. Com dois meses de histórico o sistema calcula e exibe a própria
divergência:

> "Nos últimos 6 meses a estimativa ficou 3,2% abaixo do DAS real."

Essa é a resposta honesta para "como ele não erra": ele não promete acertar,
ele mede o próprio erro e mostra. Divergência persistente e alta é sinal de
classificação incompleta, e a tela aponta isso.

### O que continua fora de alcance

Registrado para que nada seja vendido como preciso quando não é:

- **Devoluções de venda** — não existe o conceito no schema; reduzem a receita
  bruta e não são capturadas.
- **ISS retido na fonte** — não há campo de retenção na venda.
- **Créditos de PIS/COFINS não cumulativos** — `purchase_items` não carrega
  tributo destacado.
- **Lucro Presumido e Lucro Real** — exigem apuração por atividade, créditos e
  despesas dedutíveis. Cadastráveis, com calendário e exportação, mas **sem
  estimativa**.

---

## Parte 3 — Reforma Tributária (EC 132/2023, LC 214/2025, CGSN 186/2026)

Pesquisa feita em 02/08/2026. Todas as datas e alíquotas abaixo **devem ser
reconfirmadas com contador** antes de alimentar alerta em produção — por isso
`tax_regime_option_windows.requires_validation` nasce `true`.

### 2026 — o módulo não é afetado

Optantes do Simples Nacional e MEI **não têm alteração em 2026**. Só passam a
destacar IBS e CBS em documento fiscal a partir de 2027. As alíquotas-teste de
**CBS 0,9% e IBS 0,1%** valem para o regime regular, e a Receita **dispensa o
recolhimento** de quem emitir corretamente os documentos fiscais — 2026 é ano
informativo, não arrecadatório.

Consequência para o produto: o motor de apuração está correto para a competência
corrente sem nenhuma alteração.

### Setembro/2026 — a janela que o cliente não pode perder

A Resolução CGSN nº 186/2026 abre, de **1º a 30 de setembro de 2026**, a opção
pelo Simples para 2027 e, para os já optantes, a opção pelo **regime regular de
IBS e CBS**. Efeitos a partir de 01/01/2027; cancelamento até o último dia de
novembro de 2026.

Essa janela é a razão de `tax_regime_option_windows` existir como tabela: o
alerta que avisa o cliente lê as datas de lá, nunca de constante em código.

### 2027 em diante — regime híbrido

O optante do Simples pode escolher apurar IBS e CBS **fora do DAS**, pelo regime
não cumulativo, mantendo IRPJ, CSLL, CPP e IPI dentro dele. A opção é semestral.

Isso força uma mudança estrutural no catálogo: a alíquota efetiva da faixa
precisa ser **decomposta por tributo** (`tax_bracket_components`), para que a
parcela de IBS/CBS possa ser removida. Aplicar a alíquota cheia a quem optou
pelo híbrido superestimaria o imposto.

**Decisão sobre o seed:** as tabelas de repartição da LC 123 não são semeadas.
Quando o regime híbrido está ativo e a repartição não foi cadastrada, o motor
devolve `reparticao_indisponivel` — recusa calcular em vez de estimar a fatia.
Um DAS plausível e errado é pior que a ausência de número.

### Fontes

- [Orientações da Reforma Tributária para 2026 — Receita Federal](https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/acoes-e-programas/programas-e-atividades/reforma-tributaria-do-consumo/orientacoes-2026)
- [Resolução CGSN nº 186/2026: janela de setembro para empresas do Simples — Conjur](https://www.conjur.com.br/2026-abr-26/resolucao-cgsn-no-186-2026-janela-de-setembro-para-empresas-do-simples/)
- [Simples Nacional: nova opção do IBS e CBS expõe controvérsias — Conjur](https://www.conjur.com.br/2026-abr-25/nova-opcao-do-ibs-e-cbs-no-simples-expoe-lacunas-e-controversias-juridicas/)
- [Novo marco da Reforma Tributária a partir de 03/08 — CGIBS](https://www.cgibs.gov.br/novo-marco-da-reforma-tributaria-inicia-em-03-de-agosto-com-preenchimento-obrigatorio-dos-campos-relativos-ao-ibs-e-a-cbs)
- [Reforma tributária: o que muda a partir de 2026 — Migalhas](https://www.migalhas.com.br/depeso/447217/reforma-tributaria-o-que-muda-a-partir-de-2026)

## Parte 4 — Governança do catálogo

Faixas, alíquotas, parcelas a deduzir, tetos e sublimites **mudam por lei**.
Nenhum desses valores pode ser constante em TypeScript.

Todos vivem em tabelas de catálogo global versionadas por `effective_from` /
`effective_to`, no padrão de `analytics_modules` e `notification_templates`:
sem `company_id`, leitura para usuário autenticado, escrita apenas por migração.
Toda apuração grava a versão usada em `tax_assessments.calculation_basis`,
tornando o número reproduzível meses depois.

Atualizar legislação passa a ser migração de dados, não deploy de lógica.

---

## Modelo de dados

### Catálogo global (sem `company_id`)

```sql
tax_brackets (
  id, regime, anexo, bracket_order,
  rbt12_min, rbt12_max,
  nominal_rate, deduction,
  effective_from, effective_to, legal_reference
)

tax_due_date_rules (
  id, regime, obligation_kind, day_of_month, month_offset,
  effective_from, effective_to
)

cnae_anexo_map (               -- CNAE → anexo sugerido
  id, cnae_code, anexo, confidence,   -- 'alta' | 'media' | 'requer_confirmacao'
  note, effective_from, effective_to
)

cnpj_registry_cache (
  id, cnpj UNIQUE, payload JSONB, source, fetched_at, expires_at
)
```

### Por empresa (com `company_id`, protegidas por RLS)

```sql
company_tax_profile (
  id, company_id UNIQUE,
  regime, simples_anexo, mei_activity_type,
  uf, municipio, codigo_municipio_ibge, iss_rate,
  revenue_basis,               -- 'competencia' | 'caixa'
  rbt12_initial, rbt12_initial_reference_month,
  fator_r_enabled,
  cnae_principal, cnaes_secundarios JSONB,
  source,                      -- 'receita' | 'manual' | 'receita_corrigido'
  source_fetched_at, confirmed_at, confirmed_by,
  opted_at, is_active, created_at, updated_at
)

company_payroll_entries (
  id, company_id, reference_month, payroll_amount,
  UNIQUE (company_id, reference_month)
)

product_tax_classification (
  id, company_id,
  product_id,                  -- exclusivo com category_id
  category_id,
  anexo, tributacao,
  note, created_at, updated_at,
  CHECK (num_nonnulls(product_id, category_id) = 1)
)

tax_assessments (
  id, company_id, reference_month,
  regime,
  revenue_by_anexo JSONB,      -- receita segregada por anexo
  rbt12_by_anexo JSONB,
  effective_rate_by_anexo JSONB,
  gross_revenue_month, estimated_tax,
  fator_r,
  classification_coverage,     -- % da receita classificada
  status,                      -- 'estimated' | 'confirmed'
  confirmed_amount, variance_pct,
  calculation_basis JSONB,
  UNIQUE (company_id, reference_month)
)

tax_obligations (
  id, company_id, assessment_id,
  kind, label, due_date, amount,
  status, paid_at,
  document_id, payable_id,
  created_at, updated_at
)
```

Todas as tabelas por empresa recebem RLS com `company_id` derivado de
`auth.uid()` **e** filtro explícito de tenant. Escrita restrita a `admin` e
`manager`, validada também no banco — mesmo reforço de
`20260729171032_reports_financial_access_guard.sql`.

---

## Motor de cálculo

Puro e determinístico, isolado em `src/services/taxCalculation.ts`, sem acesso a
rede ou banco. Mesmo padrão testável de `reportPeriod.ts`.

```text
para cada item de venda do mês
  resolve anexo e tributacao pela cascata produto → categoria → empresa
  agrupa a receita por anexo

RBT12 é ÚNICO E TOTAL, não por anexo
  RBT12 = receita bruta total dos 12 meses anteriores (todas as atividades)
          + parcela proporcional de rbt12_initial enquanto o histórico
            no sistema for menor que 12 meses

para cada anexo com receita no mês
  faixa = bracket do ANEXO onde rbt12_min <= RBT12 <= rbt12_max
          e effective_from <= reference_month < effective_to
  alíquota efetiva = RBT12 > 0 ? (RBT12 × nominal_rate − deduction) ÷ RBT12
                               : nominal_rate da primeira faixa
  base tributável = receita do anexo
                    − parcela dos itens 'st' / 'monofasico' / 'isento' / 'exportacao'
  imposto do anexo = base tributável × alíquota efetiva

Fator R (atividades sujeitas à regra, com fator_r_enabled)
  folha 12 meses ÷ RBT12 total
  >= 0,28 → tributa pelo Anexo III
  <  0,28 → tributa pelo Anexo V
  Anexo IV NUNCA é alcançado pela regra (a CPP é recolhida à parte)
  sem folha informada → Fator R indisponível, mantém anexo de origem

MEI
  sem estimativa — o DAS de valor fixo saiu do escopo (não aprovado pelo contador)
  regime segue cadastrável; calendário e exportação funcionam com lançamento manual
```

**Teto e sublimite não fazem parte do escopo.** Os valores não foram aprovados
pelo contador e as tabelas correspondentes foram removidas na migration
`20260803120000`. `findBracket` continua devolvendo `null` acima da última faixa
cadastrada — isso é limite da tabela, não acompanhamento de teto.

`RBT12 = 0`, ausência de faixa vigente ou regime sem estimativa retornam
resultado explícito de **não calculável** — nunca `NaN`, nunca zero silencioso.

---

## Integração com os módulos existentes

| Módulo | Integração |
| --- | --- |
| Financeiro | Cada `tax_obligations` gera espelho único em `account_payables` via `payable_id`, sem dupla contagem. A guia é a fonte da verdade. |
| Fluxo de caixa | `cashFlowForecastService.ts` passa a considerar guias pendentes como saída projetada. |
| DRE | Linha `(-) IMPOSTOS SOBRE VENDAS` do tipo `deduction`, que já existe em `reportIntelligenceService.ts:405`. A margem passa a ser real. |
| Estoque | Classificação fiscal no cadastro de produto, na categoria e na importação CSV. |
| Notificações | Novas regras e templates, sem infraestrutura nova. |
| Documentos | Guias e comprovantes via `document_id`, com a segurança da Story 1.16. |
| Gestly | Ferramenta somente leitura `get_tax_summary`, no registro fixo e tipado da arquitetura P1. |

### Regras de notificação previstas

| Evento | Gatilho |
| --- | --- |
| `tax_due_soon` | Guia vence em N dias; compara valor com o caixa projetado na data. |
| `tax_bracket_change` | RBT12 projetado muda a faixa no próximo mês. |
| `tax_regime_changed` | Revalidação do CNPJ detecta exclusão do Simples ou mudança de regime. |
| `tax_coverage_low` | Cobertura de classificação abaixo do limiar. |
| `tax_assessment_pending` | Mês encerrado sem apuração confirmada. |

---

## Página `/contabil` (aba Contábil isolada)

Rota dedicada dentro do `AppLayout`, protegida por `RoleRoute` com
`['admin', 'manager']` — padrão de `/financial` e `/purchases`. Entrada na
Sidebar no grupo de gestão, adjacente a Financeiro.

Sem `company_tax_profile` confirmado, exibe o onboarding de identificação e
**nenhum indicador numérico**.

Seções: cabeçalho com regime e competência · indicadores do mês · cobertura de
classificação e divergência medida · calendário
de obrigações · evolução da alíquota efetiva · insights determinísticos ·
exportação para o contador.

## Monetização

A página **não é add-on** na P0: ela corrige a precisão de indicadores já
vendidos (DRE, margem, fluxo de caixa). A monetização entra na P1 com o módulo
`tax_analytics` em `analytics_modules` (`is_addon = true`, `min_plan = 'pro'`),
cobrindo comparação de regimes, carga por produto e simulador da Reforma
Tributária. O gating e o modal de desbloqueio já existem.

## Roadmap

| Story | Entrega |
| --- | --- |
| 1.28 | Identificação do regime via CNPJ, catálogo versionado e perfil confirmado |
| 1.29 | Classificação fiscal de produtos e categorias |
| 1.30 | Motor de apuração, provisionamento e integrações |
| 1.31 | Página `/contabil`, calendário e alertas |
| 1.32 | Exportação para o contador |
| P1 | Painel Tributário como add-on, ferramenta Gestly, Modo Contador |
| P2 | Simulador da Reforma Tributária (CBS/IBS) |

## Riscos

| Risco | Mitigação |
| --- | --- |
| Estimativa lida como apuração oficial | Rótulo de estimativa gerencial em todo valor; campo separado para o valor confirmado. |
| Legislação muda e o número erra em silêncio | Catálogo versionado por vigência; alerta quando não há faixa vigente para a competência. |
| API pública de CNPJ fora do ar, lenta ou com campo nulo | Cache, provedor alternativo configurável, fallback manual e nulo nunca tratado como negativo. |
| Dado da Receita desatualizado | `source_fetched_at` exibido; revalidação periódica; usuário pode corrigir. |
| Classificação incompleta gera estimativa ruim | Cobertura exibida e divergência medida; alerta de cobertura baixa. |
| Dupla contagem entre guia e conta a pagar | Espelho único com `payable_id`. |
| Expectativa de emissão fiscal | Fora de escopo declarado na interface e na landing. |
