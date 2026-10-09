# Migrações pendentes — MV Ambiental

**NÃO copiar para `supabase/migrations/`** — esta pasta existe para que nada daqui seja aplicado
no banco principal (SobControle, `qxcchymwswontqcwqogm`). O banco principal nunca deve ser alterado.

## Banco da MV Ambiental

Projeto Supabase **sobcontrole-mv** (`auljcdljjkplupgebewy`).

| Item | Situação |
|------|----------|
| Estrutura clonada do banco principal (tabelas, índices, policies, triggers, grants, cron) | ✅ Aplicada e conferida |
| 6 funções que a ferramenta não conseguiu aplicar | ✅ `clone_pendente_sql_editor.sql` rodado no SQL Editor do sobcontrole-mv em 2026-10-09 (6 funções e permissões conferidas) |
| `20261007120000_service_contracts_foundation.sql` (Story 1.62 — contratos, postos e alocações) | ✅ Aplicada e conferida (5 tabelas com RLS, 5 policies, 8 triggers, 5 RPCs) |
| `20261008120000_service_demands.sql` (Story 1.63 — demandas, etapas, comentários, evidências e histórico) | ✅ Aplicada no sobcontrole-mv em 2026-10-09 em 6 partes (6 tabelas com RLS, 6 policies, 8 triggers, 10 RPCs) |
| `20261009120000_service_people_documents.sql` (Story 1.64 — checklist de documentos, férias/afastamentos, uniformes/EPIs e transferência) | ✅ Aplicada no sobcontrole-mv em 2026-10-09 em 5 partes (5 tabelas com RLS, 5 policies, 8 triggers, 8 RPCs só para authenticated) |

Fora do clone (configurar no painel do projeto novo quando o app for apontado para ele):
Edge Functions e seus secrets, configurações de Auth (URLs de redirecionamento, SMTP) e arquivos do Storage.

O schema `_descartar` no projeto novo guarda sobras de tentativas de limpeza; não é exposto
(sem permissão de uso para `anon`/`authenticated`) e pode ser apagado pelo SQL Editor quando quiser.

A migração de contratos foi validada antes num Postgres 16 descartável com stubs do Supabase
(RLS, isolamento entre empresas, regras de vigência, alocação e auditoria).
