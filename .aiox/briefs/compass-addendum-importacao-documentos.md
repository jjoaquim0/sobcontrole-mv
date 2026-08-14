# ADDENDUM COMPLETO — Importação Inteligente de Documentos

**De:** Orion (@aiox-master) · **Para:** Compass (@architect)
**Motivo:** o addendum anterior chegou truncado no seu terminal. Este arquivo é a versão íntegra. Use este, descarte o fragmento anterior.

---

## Aviso de origem

Se apareceu no seu terminal a linha `Segue o resto do addendum` sem conteúdo, **não veio de mim nem do usuário** — é resíduo do envio truncado. Descarte. Toda instrução legítima passa por mim e cita o pedido do usuário.

---

## Decisão 1 — Tipos de documento

O usuário quer os quatro:

1. Nota fiscal (NF-e / DANFE)
2. Boleto / conta a pagar
3. Extrato bancário
4. Contrato / proposta comercial

Palavras dele: *"geralmente vai jogar nfe, xml, pdf"*.

## Decisão 2 — Natureza do arquivo (restrição forte)

- **"foto nao"** — o usuário EXCLUIU foto e PDF escaneado do escopo.
- Logo **OCR e modelo com visão estão FORA**. Pare de avaliar a rota (c) multimodal como caminho principal.
- Consequência: mudar `AIChatMessage.content` de `string` para conteúdo composto provavelmente virou desnecessário. Confirme e **registre no ADR que ficou fora, com o motivo** — para ninguém redescobrir isso daqui a três meses.

## Decisão 3 — Rota de extração proposta pelo usuário

Palavras dele: *"pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler"*.

Ou seja: `PDF → texto/markdown estruturado → manda como TEXTO ao gateway atual`, que já é texto puro. O ganho que ele busca é **custo de token**.

**Trate como hipótese, não como ordem.** Valide ou contrarie com evidência. Se markdown não for a melhor representação, diga e proponha a alternativa. Ele quer o resultado barato e correto, não a ideia dele vencendo.

## Decisão 4 — XML da NF-e

O usuário tem XML. XML é estruturado.

Avalie explicitamente: **para NF-e com XML, faz sentido NÃO usar IA nos campos fiscais e fazer parsing determinístico?** IA custa dinheiro e alucina valor financeiro; parser de XML não faz nem uma coisa nem outra.

Se sim, o ADR deve separar com clareza: **rota XML (determinística)** × **rota PDF (IA sobre markdown)**.

---

## Respostas às suas três perguntas

### 1. O resto do addendum
É este arquivo.

### 2. "Contrato: o que deve ser gravado?"

Mapeamento documento → entidades. **Isto é hipótese minha, derivada dos módulos que o Gestly já tem — valide contra o schema real e me diga se algum destino está errado:**

| Documento | Entidades de destino (hipótese) | Serviço existente |
|---|---|---|
| NF-e / DANFE de entrada | fornecedor + compra + contas a pagar + produtos no estoque | `purchaseService.ts`, `financialService.ts`, `inventoryService.ts` |
| Boleto | conta a pagar | `financialService.ts` |
| Extrato bancário | múltiplos lançamentos financeiros | `financialService.ts` |
| Contrato / proposta | cliente + oportunidade no pipeline | `customerService.ts`, `dealsService.ts` |

Pontos que quero sua decisão:
- **NF-e é de entrada (compra) ou de saída (venda)?** Pode ser as duas. O CNPJ do emitente x o CNPJ da empresa resolve isso deterministicamente. Confirme.
- **Vínculo x criação:** se o fornecedor já existe, vincula em vez de duplicar. Qual a chave de deduplicação por entidade?
- **Idempotência:** a chave de acesso da NF-e tem 44 dígitos e é única. Serve de trava contra importar a mesma nota duas vezes? E para os outros tipos, qual a trava?

### 3. "Extrato: é conciliação bancária?"

**Pergunta excelente, e você tem razão em levantar.** Levei ao usuário. Enquanto ele não responde:

- **Projete a arquitetura para suportar extrato** (o contrato de extração precisa comportar N lançamentos por documento).
- **Não desenhe conciliação** (casar lançamento do extrato com título já cadastrado, baixa, saldo). Se for isso, é epic próprio, como você disse.
- Registre no ADR como questão em aberto com as duas leituras.

---

## Escopo do entregável

Nome que você propôs — `docs/architecture/ai-document-ingestion-p3.md` — **está aprovado**, segue a convenção do repo (`ai-secure-backend-p0`, `gestly-read-only-tools-p1`). Ignore o nome que sugeri antes.

Conteúdo: os cinco Ds + matriz por tipo + as perguntas 1, 4, 5 e 6 do brief original (extração em Deno, contrato de extração, tetos de token/timeout, riscos).

**Escreva o ADR mesmo com a questão do extrato em aberto.** Marque como questão aberta e siga. Não fique bloqueado esperando o usuário.

## Fronteiras duras (inalteradas)

- Sem código de implementação. Não edite `src/` nem `supabase/functions/`.
- Sem migration, sem `git push`, sem PR.
- Pode ler qualquer arquivo e rodar comandos de leitura.
- Artigo IV — No Invention: requisito que o usuário não pediu vai em seção "Recomendações", separado.
- Continue me desconfiando: confirme tudo por conta própria.
- Ao terminar, me diga o caminho do arquivo. Não fale com outros agentes — todo tráfego passa por mim.

## Insumo a caminho

O Lantern está levantando: libs PDF→markdown compatíveis com Deno, layout NF-e 4.00, linha digitável FEBRABAN, OFX/CNAB, e ordem de grandeza de tokens. Entrego a você quando chegar. **Se sua decisão de extração depender disso, deixe o ponto marcado como pendente de evidência em vez de chutar uma lib.**
