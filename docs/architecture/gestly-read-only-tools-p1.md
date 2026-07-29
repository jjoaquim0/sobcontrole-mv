# Arquitetura P1 — Gestly com ferramentas de leitura

## Objetivo e fronteira

A P1 conecta o Gestly a dados reais de vendas, clientes, estoque e financeiro por seis ferramentas fixas, tipadas, limitadas e somente leitura.

Não existe endpoint genérico de consulta, SQL livre, escolha de tabela/coluna, seleção de empresa, exportação livre ou ferramenta de escrita. O provider de IA nunca recebe credenciais do banco nem acesso ao Supabase.

## Base P0 reutilizada

A implementação amplia, sem duplicar:

- `ai-gateway` e o alias `gestly-chat`;
- validação de JWT;
- configuração governada de provider/modelo;
- kill switches global e por empresa;
- reserva/finalização atômica de quota;
- provider registry;
- logs estruturados sem prompt/resposta;
- contrato de erros públicos.

O `service_role` continua restrito à reserva/finalização de uso e à gravação de metadados de auditoria. Consultas de negócio usam um cliente Supabase por request com o JWT do usuário e RLS ativa.

## Fluxo seguro

```text
Usuário autenticado
  → ChatPanel envia somente { role, content }
  → ai-gateway valida origem, método, tamanho e JWT
  → backend consulta o próprio profile com cliente JWT/RLS
  → backend cria SecurityContext e valida empresa/papel
  → P0 verifica kill switches, configuração e quota
  → provider recebe apenas o registro de ferramentas permitido
  → provider retorna zero ou uma chamada de ferramenta
  → registro valida nome fixo e argumentos exatos
  → ferramenta valida papel e limites
  → repository chama RPC específica SECURITY INVOKER com JWT/RLS
  → RPC deriva company_id de auth.uid() e também filtra explicitamente o tenant
  → ferramenta valida/minimiza a saída
  → provider recebe somente o resultado estruturado mínimo
  → provider redige a resposta final
  → gateway anexa período, fonte, critério e contagem
  → P0 finaliza uso e grava auditoria sem conteúdo
```

## SecurityContext

O contexto é criado uma vez por request:

```ts
interface SecurityContext {
  userId: string;
  companyId: string;
  role: 'admin' | 'manager' | 'employee';
  requestId: string;
  timezone: string;
  currency: string;
  limits: {
    maxCustomPeriodDays: 366;
    maxLowStockResults: 25;
    maxFinancialResults: 20;
    maxToolCalls: 1;
  };
}
```

Derivação e validação:

1. Extrair o bearer token do header.
2. Validar o token com `auth.getUser(token)`.
3. Criar um cliente Supabase isolado para o request, configurado com o mesmo bearer token.
4. Consultar somente `profiles.id = auth.user.id`; a RLS também exige o próprio usuário/tenant.
5. Validar `profiles.company_id`, papel conhecido e existência da empresa.
6. Ler timezone/moeda das configurações da própria empresa, com defaults persistidos do projeto quando ausentes.
7. Comparar o tenant derivado com o tenant retornado pela reserva P0; qualquer inconsistência bloqueia antes do provider.

`companyId` e `userId` não aparecem em schemas de ferramentas.

## Registro central de ferramentas

Cada contrato contém:

- nome fixo;
- descrição curta;
- `mode: 'read_only'`;
- JSON Schema estrito de entrada;
- validador de entrada com rejeição de chaves extras;
- JSON Schema e validador de saída;
- papéis permitidos;
- limite máximo;
- fonte e critério documentados;
- executor backend.

O provider recebe schemas com `strict: true`, todos os campos marcados como obrigatórios e campos opcionais representados por `null`. Chamadas paralelas são desabilitadas e o gateway executa no máximo uma ferramenta.

Nomes desconhecidos e argumentos inválidos são bloqueados no backend. Mesmo que uma mensagem tente sobrescrever permissões, pedir outra empresa, SQL, tabelas ou dados ocultos, o registro não oferece esses parâmetros nem essas capacidades.

## Ferramentas e fontes

### `get_sales_summary`

Fonte: `public.sales`.

Critério real do projeto:

- venda contabilizada no resumo: `payment_status = 'paid'`;
- valor: soma de `final_value`;
- quantidade: número de vendas pagas;
- ticket médio: total dividido pela quantidade, ou `null` quando não há venda;
- data: `created_at` dentro de intervalo inclusivo no início e exclusivo no fim.

Entradas:

- `current_month`;
- `previous_month`;
- `last_7_days`;
- `custom`, com datas ISO e máximo de 366 dias.

Saída para o provider: totais, contagem, ticket médio, período, fonte e critério. Nenhum ID, cliente, vendedor, observação ou item de venda.

### `get_customers_summary`

Fonte: `public.customers`.

Definições reais:

- cliente ativo: `is_active = true` no instante da consulta;
- novo cliente: registro com `created_at` dentro do período.

Saída: contagem de ativos, contagem de novos, período, fonte e critérios. Não envia nomes, documentos, e-mails, telefones ou endereços.

“Cliente sem interação” não é implementado porque o projeto não possui uma definição única e confiável.

### `get_low_stock_products`

Fonte: `public.products`.

Critério:

- `is_active = true`;
- `current_quantity <= min_quantity`;
- sem estoque (`current_quantity <= 0`) tem maior risco;
- demais itens são ordenados pela maior diferença para o mínimo;
- máximo de 25.

Saída mínima por item:

- nome;
- SKU;
- estoque atual;
- estoque mínimo;
- diferença para o mínimo;
- `out_of_stock` ou `low_stock`.

Não envia IDs, descrição, categoria, código de barras, preço de custo, preço de venda ou estoque máximo.

### `get_inventory_summary`

Fonte: `public.products`.

Critério:

- somente `is_active = true`;
- `active_products` é a contagem de produtos ativos;
- `total_units` é a soma de `current_quantity`;
- `out_of_stock_count` usa `current_quantity <= 0`;
- `low_stock_count` usa `current_quantity > 0 AND current_quantity <= min_quantity`;
- `healthy_count` usa `current_quantity > min_quantity`.

Não recebe argumentos. Responde a “quanto tenho de estoque?” e “quantos produtos eu tenho?”.

Não envia preço de custo, preço de venda nem valuation monetária: a P1 mantém preços fora de
qualquer saída entregue ao provider.

### `get_product_stock`

Fonte: `public.products`.

Critério:

- `is_active = true`;
- nome ou SKU contendo o termo informado;
- máximo de 10 resultados, com correspondência exata de nome primeiro.

Entrada: `product_name` entre 2 e 60 caracteres e `limit` entre 1 e 10. Responde a “quantos
{produto} eu tenho em estoque?”.

Os curingas `%`, `_` e `\` do termo são escapados antes do `ILIKE`, com `ESCAPE '\'`. Sem isso, um
termo como `%` transformaria a busca em um dump do catálogo. O comprimento mínimo de 2 caracteres e
o teto de 10 linhas reforçam o mesmo limite.

Saída mínima por item: nome, SKU, unidade, estoque atual, estoque mínimo e status
`out_of_stock`, `low_stock` ou `in_stock`. Não envia IDs, descrição, categoria, código de barras
nem preços.

### `get_overdue_financial_items`

Fontes: `public.account_receivables` e `public.account_payables`.

Autorização: somente `admin` e `manager`.

Critério:

- `status IN ('pending', 'late')`;
- `due_date` anterior ao instante de referência;
- tipo `receivable`, `payable` ou `both`;
- máximo de 20 itens.

Saída agregada:

- total e quantidade a receber;
- total e quantidade a pagar;
- total e quantidade combinados;
- data de referência;
- lista limitada com apenas tipo, valor, vencimento e dias vencidos.

Não envia IDs, descrições livres, venda/compra relacionada, nomes, documentos ou contatos. Um usuário sem papel financeiro é bloqueado antes da consulta e não recebe nem mesmo contagem zero.

## Banco, RLS e RPCs

As seis RPCs são específicas, `SECURITY INVOKER` e recebem somente período, tipo, termo de produto ou limite. Elas não recebem `company_id`, SQL, tabela, coluna ou filtros livres.

Cada RPC:

1. exige `auth.uid()`;
2. deriva `company_id` do próprio perfil;
3. aplica `WHERE company_id = v_company_id`;
4. valida seus limites novamente;
5. executa sob RLS do usuário.

As tabelas existentes permanecem com RLS. Para contas a receber/pagar, a P1 adiciona uma política `AS RESTRICTIVE TO authenticated` exigindo `get_user_role() IN ('admin', 'manager')`, corrigindo a diferença entre a proteção de rota atual e a política permissiva do banco.

Não são criadas views nem funções `SECURITY DEFINER` para consulta de negócio.

## Function calling e minimização

Primeira rodada:

- mensagens já validadas;
- instruções de escopo/autorização;
- quatro schemas estritos;
- `parallel_tool_calls = false`;
- `store = false`.

Se não houver tool call, somente texto honesto sem dados é aceito. Se houver tool call:

1. preservar os itens de saída exigidos pelo provider;
2. validar exatamente um nome registrado;
3. validar argumentos;
4. executar a ferramenta;
5. enviar o JSON minimizado como `function_call_output`;
6. fazer a rodada final com novas ferramentas desabilitadas.

Os usos de token das duas rodadas são somados antes da finalização P0.

## Resposta e metadados

Respostas baseadas em dados incluem:

```ts
interface GestlyDataContext {
  toolName: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  source: string;
  criteria: string;
  recordCount: number;
  truncated: boolean;
}
```

O texto final é redigido pelo provider a partir do resultado minimizado. Os metadados são anexados pelo backend, não pelo modelo, e exibidos discretamente no chat.

## Auditoria e privacidade

`ai_usage_logs` recebe apenas:

- ferramenta;
- início/fim do período;
- quantidade de registros retornados;
- indicador de truncamento;
- os metadados P0 já existentes.

Os logs estruturados usam os mesmos campos e nunca incluem:

- prompt, histórico ou resposta;
- resultado da ferramenta;
- SQL;
- IDs/descrições de itens;
- headers, JWTs ou secrets;
- erros brutos ou stack traces.

## Estados de erro

- sem autenticação: `unauthorized`;
- perfil/empresa ausente ou inconsistente: `company_not_found`;
- papel financeiro insuficiente: `financial_permission_denied`;
- nome de ferramenta desconhecido: `tool_unavailable`;
- argumentos fora do schema: `invalid_tool_arguments`;
- consulta falha: `tool_query_failed`;
- provider/timeout/quota/kill switch: contrato seguro já existente da P0.

Mensagens públicas não revelam se outro tenant, tabela ou registro existe.

## Referências verificadas em 2026-07-25

- Supabase — [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- Supabase — [Integrating Auth with Edge Functions](https://supabase.com/docs/guides/functions/auth-legacy-jwt)
- Supabase — [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- Supabase — [Securing your API](https://supabase.com/docs/guides/api/securing-your-api)
- Supabase — [Changelog: Edge Functions](https://supabase.com/changelog?tags=edge+functions)
- OpenAI — [Function calling](https://developers.openai.com/api/docs/guides/function-calling)

As decisões aplicadas dessas fontes são: cliente Supabase criado no escopo de cada request com o bearer token; RLS em tabelas expostas; filtros explícitos além da RLS; `SECURITY INVOKER` para consultas; menor privilégio; schemas estritos; preservação dos itens de tool call; `function_call_output`; e chamadas paralelas desabilitadas.

## Capacidades ainda fora de escopo

- principais clientes, ranking por receita ou lista de clientes;
- clientes sem compra/interação;
- comparação automática com período anterior;
- filtros, dimensões, agrupamentos ou exportações livres;
- consultas a tabelas/fontes diferentes das quatro ferramentas registradas;
- qualquer criação, edição, exclusão, envio, aprovação ou automação de dados.
