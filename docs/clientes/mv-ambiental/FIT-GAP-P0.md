# Fit-gap P0 — MV Ambiental × sistema atual

**Data:** 07/10/2026 · **Base:** branch `producao` · **Fonte:** `ROADMAP_MVP_MV_AMBIENTAL.md` §3 e §12

Legenda: **Já existe** (usar como está) · **Ajustar** (estender módulo existente) · **Criar** (módulo novo) · **Fora do MVP**.

| # | Item P0 do roadmap | O que o sistema já tem | Classificação | Observação |
|---|---|---|---|---|
| 1 | Cadastro de contratos e versões | Nada específico. `customers` cobre o cliente, sem vigência, aditivos nem CCT. | **Criar** | Fase 1 — Story 1.62 |
| 2 | Postos e equipes | `teams` (equipes de vendas) não tem escala, quantitativo nem requisitos. | **Criar** | Fase 1 — Story 1.62. Postos ficam ligados ao contrato, não às equipes de vendas. |
| 3 | Funcionários e alocações | `employees` com dados mínimos, CPF protegido (hash + 4 dígitos), status e auditoria. | **Já existe** + **Criar** alocações | Fase 1 — Story 1.62 cria `service_post_allocations` sobre `employees`. |
| 4 | Pipeline de demandas | `pipeline` é kanban de **vendas** (deals). | **Ajustar** / **Criar** | Fase 2. Avaliar na story se reaproveita o kanban (componentes dnd-kit) com entidade própria de demanda. |
| 5 | Responsabilidades | `employees.manager_employee_id`; nenhum executor/aprovador/substituto/prazo. | **Criar** | Fase 2, junto com o pipeline. |
| 6 | Gestão documental | `documents` (biblioteca com segurança por empresa) sem checklist, validade ou conferência. | **Ajustar** | Fase 3. Checklist por processo/contrato; arquivos continuam como link do Drive no piloto (P1). |
| 7 | Agenda de obrigações | `agenda` (eventos) e `tax_obligations` (obrigações fiscais) sem competência por contrato. | **Ajustar** | Fase 4. |
| 8 | Painel operacional | `dashboard` focado em vendas/financeiro. | **Criar** | Fase 4. Fase 1 já entrega indicadores de contratos/postos descobertos na tela de contratos. |
| 9 | Auditoria e permissões | Papéis `admin`/`manager`/`employee`, RLS por empresa, padrão de auditoria por trigger (`people_audit_events`). | **Já existe** + **Ajustar** | Fase 1 replica o padrão em `service_contract_audit_events`. |
| 10 | Treinamento operacional | Não há instruções contextuais. | **Criar** | Fase 4/5 — textos curtos dentro das telas. |

## Fora do MVP (confirmado pelo roadmap)

eSocial transmissor, folha/rescisões/benefícios, Open Finance, OCR/IA decidindo conformidade, substituição do Drive/Dix/Novio/recrutamento, app de campo/ponto próprio.

## Decisões pendentes com a MV Ambiental (não bloqueiam a Fase 1)

- Quais perfis acessam dados pessoais (hoje: somente `admin` e `manager`).
- Contrato e equipe do piloto (candidato: Laboratório de Astrofísica).
- Vigência atual de Luziânia (cadastrar como **vigência a confirmar** até receber os aditivos).
