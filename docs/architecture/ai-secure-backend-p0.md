# Arquitetura P0 — Camada Segura de IA no Backend

## Objetivo e limites

Esta P0 cria uma fronteira única e segura para chamadas de IA. Ela não consulta tabelas de negócio, não envia contexto interno da empresa ao modelo, não oferece ferramentas, não escreve no sistema e não armazena mensagens, prompts ou respostas.

## Fluxo atual auditado

```text
ChatPanel
  → src/services/chatService.ts
  → Supabase Edge Function gestly-chat
  → validação básica do JWT e das mensagens
  → OpenAI Responses API (provider e modelo acoplados)
  → resposta do assistente
```

O estado atual já mantém `OPENAI_API_KEY` fora do frontend e usa `store: false`, mas ainda não possui validação de empresa/papel, abstração de provider, configuração governada, kill switches, limites atômicos nem auditoria estruturada por tenant.

## Fluxo proposto

```text
Frontend (somente messages)
  → Edge Function ai-gateway
  → valida JWT e obtém auth.user.id
  → RPC service_role deriva profile.company_id e profile.role
  → verifica kill switch global
  → verifica kill switch e papel permitido da empresa
  → resolve provider/modelo pela allowlist backend
  → reserva quota atomicamente (empresa + usuário)
  → AIProviderFactory → adapter permitido
  → chamada com timeout, sem dados internos e sem persistência no provider
  → finaliza uso/tokens/custo de forma atômica
  → resposta normalizada { message, request_id }
```

`gestly-chat` permanece apenas como alias temporário do mesmo handler para compatibilidade. Ele deixa de conter lógica ou chamada direta ao fornecedor.

## Autenticação e isolamento por empresa

- A Edge Function exige `Authorization: Bearer <JWT>` e valida o token com Supabase Auth.
- O frontend não envia `company_id`. Campos extras no payload são rejeitados.
- Uma RPC acessível somente por `service_role` recebe o `user_id` já validado e deriva `company_id` e `role` de `public.profiles`.
- Configuração, quota e log usam exclusivamente a empresa derivada do perfil.
- Perfil inexistente, empresa inexistente, papel desconhecido ou papel fora da allowlist falham antes do provider.
- As tabelas de IA têm RLS habilitado, sem políticas de leitura/escrita para `anon` ou `authenticated`, e privilégios diretos revogados.

## Provider abstraction

O contrato `AIProvider` recebe mensagens já validadas e uma configuração resolvida pelo backend. Ele retorna conteúdo, provider, modelo e uso normalizados, ou lança um erro com código seguro.

O resolver usa um registry de adapters. A P0 inclui:

- `OpenAIProvider`, adapter do fornecedor atual;
- `FakeAIProvider`, determinístico e sem rede para testes;
- `AIProviderRegistry`, responsável por resolver somente providers registrados.

O frontend não escolhe provider ou modelo. A combinação efetiva vem de `ai_global_settings` com override opcional e protegido em `ai_company_settings`, sempre validada por `allowed_models`.

## Configuração e kill switches

`ai_global_settings` centraliza:

- kill switch global;
- provider e modelo padrão;
- allowlist provider/modelo;
- papéis permitidos;
- máximo de tokens por resposta;
- timeout;
- duração da janela;
- limites padrão de requisições, tokens e custo.

`ai_company_settings` contém:

- kill switch por empresa;
- overrides opcionais de provider/modelo;
- overrides opcionais de papéis e limites.

O kill switch global tem prioridade sobre a configuração da empresa. Nenhuma dessas tabelas é acessível diretamente pelo frontend. API keys continuam exclusivamente nos secrets da Edge Function.

Defaults P0: janela de 1 hora, 30 requisições por usuário, 300 por empresa, 250.000 tokens reservados por empresa e 500 tokens máximos de saída por chamada. O limite de custo fica inativo enquanto não existir preço configurado.

Operações de configuração são feitas somente por um operador backend no SQL
Editor ou por automação com `service_role`, nunca pelo cliente:

```sql
-- Kill switch global
UPDATE public.ai_global_settings SET enabled = false, updated_at = now() WHERE id = 1;

-- Kill switch de uma empresa
INSERT INTO public.ai_company_settings (company_id, enabled)
VALUES ('00000000-0000-0000-0000-000000000000', false)
ON CONFLICT (company_id)
DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
```

Provider/modelo só podem ser selecionados se a combinação também estiver em
`ai_global_settings.allowed_models`. A API key correspondente continua em
secret da Edge Function e nunca é persistida nessas tabelas.

## Limites e atomicidade

`reserve_ai_usage` executa em uma única transação PostgreSQL:

1. deriva e valida empresa/papel;
2. verifica kill switches e allowlist;
3. cria as linhas de janela com `INSERT ... ON CONFLICT`;
4. bloqueia primeiro o contador da empresa e depois o do usuário com `FOR UPDATE`;
5. verifica os limites;
6. insere o log `started`;
7. incrementa requisições e reserva tokens/custo.

A ordem fixa dos locks evita deadlocks entre requisições concorrentes. Em sucesso, `finalize_ai_usage` troca a reserva pelo uso real retornado pelo provider. Em falha, libera tokens/custo reservados, mas mantém a requisição contabilizada como proteção contra abuso.

`ai_model_pricing` é opcional e não recebe valores iniciais. Quando houver preço ativo para provider/modelo, reserva e finalização calculam custo em micros de dólar e aplicam o teto configurado.

## Política de logs e observabilidade

Persistido em `ai_usage_logs`:

- `request_id`, `company_id`, `user_id`;
- provider e modelo;
- status e código de erro seguro;
- início, conclusão e latência;
- tokens de entrada/saída/total quando disponíveis;
- custo estimado quando houver preço.

Logs estruturados da Edge Function registram apenas eventos permitidos: início, bloqueio, provider selecionado, sucesso, falha normalizada e duração.

É proibido registrar:

- prompt, resposta ou histórico de mensagens;
- documentos ou dados de módulos internos;
- dados pessoais contidos na conversa;
- API keys, JWTs ou headers;
- URL/configuração interna;
- payload ou erro bruto do provider;
- stack trace.

## Erros públicos

O gateway retorna um contrato uniforme com `request_id` e mensagens seguras. Códigos internos distinguem autenticação, empresa, permissão, kill switches, limite por usuário, limite por empresa, tokens, custo, timeout, indisponibilidade do provider, request inválido e erro interno. Todos os limites compartilham a mesma mensagem pública, sem revelar orçamento ou configuração.

## Evolução futura

1. Criar a permissão granular `ai.use` e uma operação administrativa auditada para configuração.
2. Adicionar adapters sem alterar o contrato do chat.
3. Criar métricas agregadas por empresa sobre `ai_usage_logs`, sem acesso a conteúdo.
4. Antes de conectar dados internos, definir ferramentas de leitura estreitas, schemas de saída, minimização/mascaramento, autorização por ferramenta e testes cross-tenant.
5. RAG, documentos, escrita e ações externas permanecem fora desta P0 e exigem nova story e revisão de segurança/LGPD.
