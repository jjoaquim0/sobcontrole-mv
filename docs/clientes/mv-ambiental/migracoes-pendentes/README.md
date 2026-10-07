# Migrações pendentes — MV Ambiental

**NÃO copiar para `supabase/migrations/` enquanto o banco novo da MV Ambiental não existir.**

Estes arquivos ficam fora de `supabase/migrations/` de propósito, para não serem aplicados
no banco principal. Quando o projeto Supabase novo for criado:

1. Aplicar no banco novo todas as migrações base de `supabase/migrations/`.
2. Aplicar `20261007120000_service_contracts_foundation.sql` (Story 1.62 — contratos, postos e alocações).

A migração foi validada num Postgres 16 descartável com stubs do Supabase (RLS, isolamento entre
empresas, regras de vigência, alocação e auditoria).
