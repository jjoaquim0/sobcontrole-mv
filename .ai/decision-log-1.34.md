# Decision Log — Story 1.34

## 2026-08-05 — Pipeline isolado de notificações existentes

**Decisão:** criar `email-sender-api` e providers próprios, sem alterar `process-notification-deliveries` nem ativar disparos automáticos.

**Motivo:** a story entrega configuração e teste transacional, não campanhas ou mudança silenciosa do canal atual.

## 2026-08-05 — Supabase Vault e schema privado

**Decisão:** armazenar access/refresh tokens no Vault, referenciados apenas por linhas em `private.email_sender_credentials`. Client secrets, chave Resend, HMAC de destinatário e kill switch permanecem em Edge Function secrets.

**Motivo:** mantém material criptográfico fora do Data API e elimina qualquer fallback em texto puro. A rotação/desconexão apaga os secrets antigos.

## 2026-08-05 — Tenant sempre derivado da sessão

**Decisão:** o frontend não envia `company_id`; a Edge Function valida o bearer token, lê `profiles.company_id`/`role` e todas as RPCs privilegiadas repetem a checagem de tenant e papel.

**Motivo:** defesa em profundidade contra BOLA/IDOR e payload adulterado.

## 2026-08-05 — OAuth mínimo

**Decisão:** Authorization Code + PKCE S256 + state de uso único + nonce + verificação criptográfica do ID token. Google recebe somente `gmail.send`; Microsoft recebe somente `Mail.Send`, além de identidade e `offline_access`.

**Motivo:** menor privilégio e ausência de leitura de caixa postal, contatos, arquivos ou calendário.

## 2026-08-05 — Teste não é um compositor

**Decisão:** assunto e corpo são fixos no backend; o cliente envia apenas destinatário e chave de idempotência. Reservas são serializadas por advisory lock e limitadas globalmente, por empresa, usuário e hash HMAC do destinatário.

**Motivo:** impedir abuso como ferramenta de spam e eliminar duplicação concorrente.

## 2026-08-05 — Logs mínimos e webhooks monotônicos

**Decisão:** persistir apenas destinatário mascarado/hash HMAC, rótulo fixo, IDs e códigos seguros; nunca corpo ou resposta bruta. Webhooks Resend exigem assinatura Svix válida em corpo bruto, janela de cinco minutos e ID único.

**Motivo:** observabilidade sem ampliar exposição de PII e proteção contra replay/eventos fora de ordem.

## 2026-08-05 — Migração somente local

**Decisão:** não executar `supabase db push` neste turno.

**Motivo:** o diagnóstico encontrou drift remoto e timestamps locais duplicados. A entrega inclui migration e rollback revisáveis; aplicação remota deve ocorrer em janela controlada após reconciliação do histórico.
