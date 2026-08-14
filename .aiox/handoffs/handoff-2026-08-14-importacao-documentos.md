# Handoff — Importação Inteligente de Documentos

**Sessão:** 2026-08-13 → 2026-08-14 · **Orquestrador:** Orion (@aiox-master)
**Status:** design fechado, implementação **não iniciada**. Nenhum código escrito.

> **Para retomar:** leia `docs/agents/orchestrator-charter.md` primeiro, depois este arquivo.

---

## 1. O pedido do usuário, na íntegra

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Feedback posterior dele, sobre método:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar" — incluindo sempre (1) pedido original completo, (2) objetivo/contexto, (3) escopo do entregável.

## 2. O que já existe, verificado no código

- **Gateway de IA maduro:** `supabase/functions/_shared/ai/` — multiempresa, rate limit, auditoria, `store: false`.
- **A IA é read-only por invariante estrutural**, não por convenção: `tools/registry.ts:45` lança `configuration_error` se `mode !== 'read_only'`. As 15 tools são todas `get_*`/`list_*`.
- **Gateway é texto puro e com limites apertados** (`_shared/ai/validation.ts`): `MAX_BODY_BYTES=25_000`, `MAX_MESSAGES=12`, **`MAX_MESSAGE_LENGTH=2_000`**, `MAX_TOTAL_MESSAGE_LENGTH=12_000`. Uma DANFE em markdown já estoura o limite por mensagem — por isso a extração precisa de função própria.
- **Upload já funciona:** `documentService.ts:308`, bucket privado, path imutável, versionamento. `.xml` já é aceito.
- **`AiSiteIntegrationAction.tsx` é placeholder** — só um toast "em breve". Recurso diferente (alimentar IA do site), decidir se convive ou é renomeado.
- **Precedente visual de confiança já existe:** `TaxConfidenceCard.tsx` e `RecommendationCard.tsx` (alta/média/baixa, emerald/amber/gray). Reaproveitar, não inventar.

## 3. Decisões do usuário (todas registradas, nenhuma pendente)

| Questão | Decisão |
|---|---|
| Tipos de documento | NF-e, boleto, extrato, contrato — **todos**, em ondas |
| Foto / PDF escaneado | **Fora.** Sem OCR, sem visão |
| Direção da NF-e | **Só entrada.** Saída é rejeitada com aviso claro |
| Custo do produto | **Perguntar na tela**, por item, custo atual × custo da nota |
| Extrato bancário | É **conciliação** → **fora desta P3**, vira epic próprio |
| Contrato | Cria **cliente + oportunidade**, faltantes coletados na tela |
| Rota do PDF | **Opção E agora, A depois:** XML na v1 + boleto por linha digitável colada; PDF no navegador (pdf.js) na sequência |

## 4. Arquitetura decidida (ADR completo em `docs/architecture/ai-document-ingestion-p3.md`)

- **D1** — Edge Function `document-extraction`, separada do `ai-gateway`.
- **D2** — *Propose-then-apply*: a IA **nunca** escreve no domínio. Grava proposta `pending`; o usuário confirma; a escrita é RPC `SECURITY INVOKER` com o JWT dele, sob RLS.
- **D3** — **Consentimento é ato de UI, nunca turno de conversa.** Documento é entrada não confiável (prompt injection). Se o "pode integrar?" for chat, o documento controla o banco.
- **D4** — Catálogo fechado, contrato roteado pela **categoria declarada no upload**, não por classificação do modelo.
- **D5** — **Cascata:** fonte estruturada → padrão auto-verificável (DV) → modelo só no resíduo.
- **D6** — Rota XML determinística, sem IA. XML é **mais caro** em tokens que o PDF convertido e entrega pior.
- **D7** — Multimodal cancelado (consequência de escopo, não limitação técnica).
- **D8** — Idempotência na tabela de propostas (`UNIQUE (company_id, idempotency_key)`), sem tocar no domínio.

**Correções ao mapa de destinos, verificadas por Orion no schema:**
- `AccountPayable.supplierId` é **obrigatório** → boleto não é escrita isolada, precisa resolver fornecedor.
- `Deal` exige `customerId`, `ownerId`, `stageId` — **e também `title` e `value`** (`src/types/index.ts:444-462`).
- `Purchase` **não tem** chave de acesso, número de documento nem data de emissão.
- **Não existe tabela bancária/conciliação** em todo o projeto.

## 5. Armadilha que quebraria em produção

**O fator de vencimento do boleto estourou o limite em 21/02/2025 e reiniciou a contagem.** A decodificação da linha digitável precisa tratar **as duas eras**, ou todo vencimento sai errado. Fonte na pesquisa do Lantern.

## 6. Entregáveis

**Commitados em `c1ea52e`, na branch `docs/importacao-inteligente-documentos`** (criada a partir de `main`). Nada foi pushado — o remoto não conhece esta branch. Para retomar: `git checkout docs/importacao-inteligente-documentos`.

| Arquivo | Autor |
|---|---|
| `docs/architecture/ai-document-ingestion-p3.md` | Aria (@architect) |
| `docs/research/2026-08-13-importacao-documentos-pdf-nfe-deno/README.md` | Lantern (@analyst) |
| `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` | Uma (@ux-design-expert) |
| `docs/agents/brief-template.md` | Quill (@prompt-engineer) |
| `docs/agents/orchestrator-charter.md` | Orion |
| `.aiox/briefs/*.md` | Orion (briefs de delegação) |

## 7. Próximo passo exato

Sequência do ADR, **nada iniciado**:

1. **@data-engineer (Cistern/Dara)** — DDL das tabelas de proposta, RLS, RPCs de aplicação, dimensão `feature` em `ai_usage_windows`/`ai_usage_logs`. **Escrever a migration ≠ aplicar.** Aplicar exige autorização explícita do usuário, uma a uma (NFR-2), mesmo no-op.
2. **@pm (Helm)** — epic cobrindo as ondas.
3. **@sm (Loom)** → **@po (Ledger)** — stories da onda 1 (rota XML de NF-e) e transição Draft→Ready.
4. **@dev (Forge)** — implementação.
5. **@qa (Beacon)** — gate. Veredito é **exclusivo dele**.
6. **@devops (Anchor)** — push/PR, **só com autorização explícita do usuário**.

## 8. Armadilhas de ambiente desta sessão

- **Brief longo chega mutilado ao agente**, sem erro e com exit 0. Efeito confirmado, causa não provada. **Correção: brief em arquivo, `maestri ask` leva só o ponteiro.** Sempre confirmar recepção com `maestri check`.
- **Terminais são renomeados:** "Compass" virou **"Aria"**; envio ao nome antigo falha com `Terminal "X" not found`. Rodar `maestri list` quando um envio falhar.
- **Quill roda em terminal Codex** — pede aprovação para escrever arquivo; aprovar com `maestri ask "Quill" --raw "y"`.

## 9. Estado dos agentes ao encerrar

Todos ociosos. Nenhum trabalho em voo, nenhum arquivo sendo editado por agente.
