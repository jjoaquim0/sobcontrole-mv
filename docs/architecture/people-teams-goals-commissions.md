# Pessoas — Equipes, Metas e Comissões

**Versão:** 1.0  
**Data:** 2026-08-04  
**Status:** Implementação aprovada pelos requisitos da Story 1.33

## Objetivo e limites

Evoluir o módulo brownfield de Pessoas sem recriar a navegação ou a base existente. O módulo organiza equipes, metas de vendas e registros administrativos de comissão, sempre isolados por empresa e auditáveis.

Não fazem parte do módulo: folha de pagamento, cálculo de comissão, prêmio automático, impostos, encargos, valor líquido, holerite, eSocial, pagamento bancário ou lançamento financeiro.

## Estado atual mapeado

- React, TypeScript, Vite, React Router e TanStack Query no frontend.
- Supabase com `profiles.company_id`, `get_user_company_id()` e `get_user_role()`.
- Funcionários, dados sensíveis, comissões e auditoria já existem na Story 1.33.
- Vendas reais pertencem a `sales` e são atribuídas a `profiles.seller_id`; funcionários administrativos não tinham vínculo explícito com `profiles`.
- Escritas sensíveis existentes usam RPCs sem receber `company_id` do cliente.

## Decisões

1. **Evolução aditiva do domínio existente.** `teams` e `sales_goals` são novas tabelas; `employees`, `commissions` e `people_audit_events` recebem somente colunas e eventos adicionais.
2. **Vínculo explícito com vendas.** `employees.sales_profile_id` permite que um administrador associe o funcionário ao usuário vendedor real da mesma empresa. Sem vínculo compatível, a meta permanece manual e a UI informa a indisponibilidade da fonte automática.
3. **Comissão continua manual.** `commissions.team_id` registra a equipe administrativa validada contra o funcionário. Nenhum valor é derivado de venda, meta ou salário.
4. **Progresso real no banco.** Uma RPC somente leitura calcula metas automáticas com vendas pagas reais, dentro do período e do tenant. Metas personalizadas e alvos sem vendedor vinculado usam resultado manual.
5. **Autorização em profundidade.** Rotas, RLS e RPCs exigem `admin` ou `manager`; toda RPC deriva o tenant da sessão e valida referências compostas por empresa.

## Fluxo

```text
Admin/gestor
  -> UI existente de Pessoas
  -> serviço com selects explícitos / RPC sem company_id
  -> people_assert_manager()
  -> valida tenant, papel e referências
  -> teams / employees / sales_goals / commissions
  -> trigger de auditoria sem CPF nem valores anteriores
```

## Modelo de dados

```text
teams 1 ---- n employees
employees 1 ---- n employees (gestor responsável)
employees 0..1 ---- 1 profiles (vendedor real vinculado)
teams/employees 1 ---- n sales_goals (alvo exclusivo)
employees/teams 1 ---- n commissions (registro administrativo)
people_audit_events <- teams, employees, goals, commissions
```

## Regras de progresso

- `sales_value`: soma de `sales.final_value` com status `paid`.
- `sales_count`: quantidade de vendas com status `paid`.
- `new_customers`: clientes cuja primeira venda válida ocorreu no período e foi atribuída a vendedor elegível.
- `custom`: atualização exclusivamente manual.
- Fonte automática só é usada quando existe ao menos um `sales_profile_id` válido no alvo.
- Meta nunca cria comissão, prêmio, pagamento ou lançamento.
- O status exibido pode indicar risco por prazo/progresso, mas somente o status persistido é alterado por ação administrativa.

## UX e acessibilidade

- Reuso de `PageHeader`, `DataTable`, `StatCard`, alertas, modais, tokens e estados atuais.
- Tabelas no desktop e cards no mobile.
- Barras de progresso com texto percentual e sem dependência exclusiva de cor.
- Rótulos explícitos, foco visível, botões semânticos e navegação por teclado.
- Aviso legal obrigatório no topo de Funcionários, Equipes, Metas e Comissões.

## Estratégia de testes

- Contrato SQL: RLS, RPCs sem `company_id`, constraints, auditoria e vínculo entre tenants.
- Domínio: períodos, progresso, risco, vazio e resultado manual.
- Serviços: payloads sem tenant, selects sem CPF e mapeamento de equipes/metas/comissões.
- UI: permissões/rotas, aviso legal, filtros, estados vazios e navegação.
- Gates: `npm run lint`, `npm run typecheck`, `npm test` e `npm run build`.

## Rollback

O rollback remove funções, policies, triggers e tabelas novas; depois remove as colunas aditivas de `employees`, `commissions` e `people_audit_events`. Dados anteriores da Story 1.33 permanecem preservados.
