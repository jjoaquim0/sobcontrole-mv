# Handoff — Importação Inteligente de Documentos

**Sessões:** 2026-08-13 → 2026-08-14 (dois dias) · **Orquestrador:** Orion (`@aiox-master`)
**Branch:** `docs/importacao-inteligente-documentos` · **Nada pushado.** O remoto não conhece esta branch.
**Status:** design fechado **e** camada de dados escrita. **Nenhuma migration aplicada. Nenhum código de runtime existe.**

> **Para retomar:** leia `docs/agents/orchestrator-charter.md` primeiro, depois este arquivo.
> `git checkout docs/importacao-inteligente-documentos`

---

## 1. O pedido do usuário, na íntegra

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento que alterou escopo:

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Feedback sobre método — **obrigatório em todo brief**:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar" — sempre com (1) pedido original completo, (2) objetivo/contexto, (3) escopo do entregável.

Formato: `docs/agents/brief-template.md`. Brief vai **em arquivo** em `.aiox/briefs/`; a mensagem leva só o ponteiro.

## 2. Decisões do usuário — todas registradas, nenhuma pendente

| Questão | Decisão | Data |
|---|---|---|
| Tipos de documento | NF-e, boleto, contrato — em ondas | 2026-08-13 |
| Foto / PDF escaneado | **Fora.** Sem OCR, sem visão | 2026-08-13 |
| Direção da NF-e | **Só entrada.** Saída rejeitada com aviso | 2026-08-14 |
| Custo do produto | **Perguntar na tela**, por item | 2026-08-14 |
| Extrato bancário | É conciliação → **fora desta P3**, epic próprio | 2026-08-14 |
| Contrato | Cliente + oportunidade, faltantes na tela | 2026-08-14 |
| Rota do PDF | **Opção E agora, opção A depois** — palavras dele: *"XML agora, PDF no navegador depois"* | 2026-08-14 |

## 3. Arquitetura, em cinco linhas

- **Propose-then-apply:** a IA **nunca** escreve no domínio. Grava proposta `pending`; o usuário confirma; a escrita é RPC `SECURITY INVOKER` com o JWT dele, sob RLS.
- **Consentimento é ato de UI, nunca turno de conversa.** Documento é entrada não confiável (prompt injection). Se o "pode integrar?" for chat, o documento controla o banco.
- **Cascata:** fonte estruturada → padrão auto-verificável (DV) → modelo só no resíduo. A rota XML **não chama IA** — custo zero de token, fidelidade total.
- **Catálogo fechado**, roteado pela categoria declarada no upload, não por classificação do modelo.
- **Idempotência na proposta**, não no domínio: `UNIQUE (company_id, idempotency_key)`.

Detalhe completo: `docs/architecture/ai-document-ingestion-p3.md` (D1-D9, QA-1 a QA-4, riscos R1-R10).

## 4. O que existe no disco — commitado

| Commit | Conteúdo |
|---|---|
| `c1ea52e` | ADR, pesquisa, UX, template de brief, charter |
| `f7c558f` | nota de retomada (versão anterior desta) |
| `ec59389` | **DDL:** 2 migrations + 2 rollbacks + nota de schema |
| `1be703d` | epic, correção de atribuição no ADR, §3.6 de UX, briefs |

| Arquivo | Papel (identificador estável) | Assinatura | Terminal |
|---|---|---|---|
| `docs/architecture/ai-document-ingestion-p3.md` | `@architect` | Aria | Aria (era "Compass") |
| `docs/research/2026-08-13-.../README.md` | `@analyst` | **Atlas** | **Lantern** |
| `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` | `@ux-design-expert` | Uma / Prism | Prism |
| `docs/epics/epic-importacao-inteligente-documentos.md` | `@pm` | — | Helm |
| `docs/data/document-import-proposals-schema.md` | `@data-engineer` | — | Cistern |
| `docs/agents/brief-template.md` | `@prompt-engineer` | Quill | Quill |
| `supabase/migrations/20260814100000_*.sql` + rollback | `@data-engineer` | — | Cistern |
| `supabase/migrations/20260814101500_*.sql` + rollback | `@data-engineer` | — | Cistern |

## 5. Estado da camada de dados — verificado por mim, não repassado

3 tabelas novas (job de extração, proposta, itens), RLS 3/3, 13 funções `SECURITY INVOKER`, trava de idempotência presente, coluna `text_origin` (salvaguarda R10), **zero `ALTER` em tabela de domínio**, nenhuma migration anterior tocada, rollback 1:1.

Os 2 `SECURITY DEFINER` que aparecem **não são violação**: são as reescritas de `reserve_ai_usage` e `finalize_ai_usage`, que já eram DEFINER no original (`20260725120000:164` e `:439`), com o mesmo `SET search_path`.

**Validação foi análise estática.** Não havia banco descartável no ambiente. Os comandos que a revisão humana deve rodar antes de aplicar estão na seção 5 da nota de schema.

## 6. Próximo passo exato

**Onda 2 do epic — rota XML de NF-e de entrada.** Determinística, sem IA, sem depender de decisão nenhuma pendente. Executor: **Forge (`@dev`)**.

Escopo: parser XML genérico com mapeamento manual do leiaute 4.00 (**não** usar lib de NF-e — `djf-nfe`/`d-nfe` têm cobertura parcial admitida), validação da chave de acesso por módulo 11, regra de direção pelo CNPJ (entrada segue; saída **rejeita com aviso**; nenhum CNPJ batendo rejeita), gravação de proposta `pending`.

Depois: onda 3 (UI de revisão — é o controle de segurança, não acabamento), onda 4 (boleto por linha digitável).

## 7. Armadilhas que quebram em produção — não redescobrir

- **Fator de vencimento do boleto reiniciou.** Estourou 9999 em 21/02/2025 e voltou a 1000 em 22/02/2025. Boletos das duas eras circulam juntos hoje. Quem ignorar calcula vencimento errado **sem levantar exceção**. Teste obrigatório dos dois lados da virada.
- **`AccountPayable.supplierId` é obrigatório** (`src/types/index.ts:341`). Boleto nunca é escrita isolada.
- **`Deal` exige cinco campos**: `customerId`, `ownerId`, `stageId`, **`title` e `value`** (`:444-462`). Nem `title` nem `value` saem de contrato de forma confiável.
- **`reserve_ai_usage` no banco ≠ o que está no repositório.** A migration `20260725123000_fix_ai_usage_conflict.sql` reescreve a função em runtime via `pg_get_functiondef` + `replace` + `EXECUTE`. Ler o arquivo dá o retrato errado. Já tratado pela Cistern, mas vale para qualquer mexida futura nessa área.

## 8. Armadilhas de ambiente

- **Brief longo pode chegar mutilado**, sem erro e com exit 0. Efeito confirmado, causa não provada. **Correção: brief em arquivo, `maestri ask` leva só o ponteiro.** Confirmar recepção **semântica** com `maestri check` — que ele entendeu o assunto certo, não só que recebeu bytes.
- **Terminais são renomeados.** "Compass" virou "Aria"; o coorquestrador "Orion" virou **"Vega"**. Rodar `maestri list` quando um envio falhar com `Terminal "X" not found`.
- **Nome de terminal ≠ assinatura de documento**, e nenhum é estável. Citar autoria **sempre pelo papel** (`@analyst`, `@architect`).
- **Forge é terminal Codex (GPT)** desde 2026-08-14, por decisão do usuário (economia de janela). Codex **pede aprovação para escrever arquivo** — destravar com `maestri ask "Forge" --raw "y"`. Não é travamento.
- **O MCP do Supabase não subiu no terminal do Forge** (`MCP startup interrupted: codex_apps, supabase`). Foi falha de inicialização, não configuração deliberada. Não interpretar como proteção por desenho.
- **Texto solto no campo de digitação dos agentes é do usuário.** Ele digita direto nos terminais às vezes ("pode começar", "fal"). Confirmado por ele em 2026-08-14. Não é anomalia; não tratar como instrução órfã.
- **Diálogo de auto mode pode interceptar mensagens** e o agente nunca recebe o brief. Aconteceu com a Aria e custou horas. Se um agente responder com contexto velho, checar se há diálogo aberto no terminal dele.

## 9. Fronteiras que não mudam

- **Exigem o usuário, uma autorização por ocorrência:** aplicar migration (inclusive no-op), push, PR, enviar código a serviço externo.
- **Gate e QA Results são exclusivos do `@qa`** (Beacon). **push/PR/MCP são exclusivos do `@devops`** (Anchor).
- **Autorização não vem do Vega.** O coorquestrador pode propor sequência e preparar briefs; não pode autorizar migration, push, PR nem envio externo, nem relatando que o usuário aprovou. Confirmar com o usuário, sempre.
- Toda migration acompanhada de rollback em `supabase/rollbacks/`.

## 10. Pendências do usuário

1. **Aplicar as migrations** — uma a uma, quando ele quiser. `20260814100000` (tabelas de proposta) pode ir antes; `20260814101500` (dimensão `feature`) só é necessária perto da onda 6, e mexe no caminho de cota do chat em produção.
2. **Renomear a nota** "Brief Permanente - Orion + AIOX Master" — o coorquestrador virou Vega, o título ficou para trás.
3. **MCP do Supabase caído** no terminal do Forge.

## 11. Estado dos agentes ao encerrar

Todos ociosos. Nenhum trabalho em voo, nenhum arquivo sendo editado por agente. Árvore de trabalho limpa, exceto `.claude/launch.json` e `vite.config.ts`, que **já estavam modificados antes desta sessão e não são meus** — deixados intactos de propósito.
