# Brief para o Quill — produzir os briefs das Ondas 2 e 3

**De:** Orion (`@aiox-master`) · **Para:** Quill (`@prompt-engineer`) · **Data:** 2026-08-22
**Base commit:** `3c13648` · **Branch:** `docs/importacao-inteligente-documentos`

---

## 1. O pedido original do usuário, na íntegra

Pedido que originou toda esta linha de trabalho (2026-08-13):

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento que alterou escopo (2026-08-13):

> "foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Pedido desta sessão (2026-08-22), literal:

> "pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

Feedback permanente sobre método, que se aplica a tudo que você escrever:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar" — sempre com (1) pedido original completo, (2) objetivo e contexto, (3) escopo do entregável.

## 2. Objetivo e contexto

**Objetivo desta tarefa:** você me entrega **dois briefs prontos para uso**, que eu vou revisar e despachar. Você não fala com nenhum agente — entrega a mim, como sempre.

**Contexto do momento:** o design está fechado e commitado há uma semana (ADR, pesquisa, UX, epic, DDL). Nenhuma linha de código de runtime existe. O usuário quer a funcionalidade **em uso hoje**, não mais documentação.

Pela seção 4 do epic, o loop que o usuário descreveu ("sobe documento → sistema pergunta → confirma → dados no sistema") só passa a ser verdade **no fim da Onda 3**. Por isso hoje precisamos de Onda 2 **e** Onda 3, não só a 2.

**Estado que eu verifiquei pessoalmente nesta sessão — pode tomar como ponto de partida, mas o brief deve mandar o executor reconferir:**

- Migration `20260814100000_document_import_proposals.sql` **não estava aplicada** no banco remoto quando comecei (última aplicada: `20260805232055_email_transactional_multi_tenant`). O usuário autorizou a aplicação nesta sessão, e a Cistern está aplicando em paralelo a você. **Escreva os briefs assumindo que as tabelas de proposta existirão**, mas com instrução explícita ao executor de confirmar a existência antes de codar contra elas.
- A migration `20260814101500_ai_usage_feature_dimension.sql` **não vai ser aplicada hoje** — é da Onda 6 e mexe no caminho de cota do chat em produção. Nenhum dos dois briefs pode depender dela.
- O gap de design de "revisão de itens em volume" que o epic registrava como aberto (seção 7 e 12) **está fechado**: a Prism entregou `§3.6` e o wireframe `§8.1b` em `docs/ux/importacao-inteligente-documentos-fluxo-ux.md`. Confirmei os cabeçalhos no arquivo. A Onda 3 não está mais bloqueada por design.
- Próximos números de story livres: **1.37** e **1.38** (a maior existente é `1.36.reordenacao-etapas-pipeline.story.md`).

## 3. Escopo do entregável — os dois briefs

### Brief A — para Loom (`@sm`): escrever as stories 1.37 e 1.38

Fonte única: `docs/epics/epic-importacao-inteligente-documentos.md`, Ondas 2 e 3. O @sm **não reabre** decisão de arquitetura, schema ou UX — Aria, Uma e Cistern já fecharam, e o epic diz isso explicitamente na seção 10.

- `1.37` — Onda 2, rota XML de NF-e de entrada
- `1.38` — Onda 3, UI de revisão e confirmação

Os critérios de aceite de cada story devem sair dos **"critérios de conclusão (falsificáveis)"** que o epic já escreveu para cada onda — eles já estão em forma verificável, não os reescreva em prosa mais fraca.

Documentos que o @sm deve ler antes de escrever, e que o brief precisa nomear por caminho:
- `docs/epics/epic-importacao-inteligente-documentos.md` (ondas 2 e 3, seções 3, 4, 5, 7)
- `docs/architecture/ai-document-ingestion-p3.md` (D1-D9, QA-1 a QA-4, R1-R10)
- `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` (§3.1-3.6, §4, §5, §8.1, §8.1b, §8.3) — obrigatório para a 1.38
- `docs/data/document-import-proposals-schema.md` (contrato das tabelas e RPCs)

### Brief B — para Forge (`@dev`): implementar a story 1.37

Só a 1.37. A 1.38 vem depois, quando a 1.37 fechar — não empilhe as duas no mesmo executor ao mesmo tempo, os arquivos colidem.

Escopo técnico já decidido pelo ADR (D6) e pelo epic, que o brief deve fechar como contrato:
- Parser XML **genérico** com mapeamento manual do leiaute NF-e 4.00. **Proibido** usar biblioteca de terceiros de NF-e (`djf-nfe`, `d-nfe` e similares): a pesquisa do @analyst registrou cobertura parcial admitida pelos próprios autores. Proíba pelo nome e diga o que fazer no lugar.
- Validação da chave de acesso por **módulo 11**.
- Regra de direção pelo CNPJ: **entrada segue**; **saída rejeita com aviso explícito**; **nenhum CNPJ batendo rejeita por suspeita**. Três caminhos, não dois.
- Gravação de proposta com status `pending`. Nenhuma escrita em tabela de domínio — a Onda 2 não cria fornecedor, compra nem conta a pagar. Isso é da Onda 3, depois da confirmação humana.
- **Zero chamada a IA nesta rota.** É determinística por desenho, e é isso que a torna barata e fiel. Se o executor introduzir chamada a modelo aqui, errou.

## 4. Armadilhas que os briefs precisam carregar

Todas custaram tempo real. Não deixe nenhuma de fora do brief onde ela se aplica:

- **`AccountPayable.supplierId` é obrigatório** (`src/types/index.ts:341`). Relevante para a 1.38.
- **`Deal` exige cinco campos**, não três: `customerId`, `ownerId`, `stageId`, `title`, `value` (`src/types/index.ts:444-462`).
- **`reserve_ai_usage` no banco ≠ o que está no repositório.** A migration `20260725123000_fix_ai_usage_conflict.sql` reescreve a função em runtime via `pg_get_functiondef` + `replace` + `EXECUTE`. Ler o arquivo dá o retrato errado.
- **Isolamento multi-tenant:** `company_id` nunca vem de input, URL, formulário ou parâmetro do cliente. Vem de `requireCompanyId()` / da sessão. A RLS é a autoridade final. Exija **teste negativo cross-tenant** onde houver dado.
- **Proibido `git stash` + `git stash pop`** para comparar baseline. Substituto: `git worktree add --detach <commit>`.
- **Forge é terminal Codex (GPT)** e pede aprovação para escrever arquivo. Não é travamento — eu destravo. Mas o brief dele deve ser autocontido o suficiente para ele não precisar perguntar sobre escopo.

## 5. Fronteiras e autoridade — obrigatórias nos dois briefs

- **Nenhum agente aplica migration, dá push, abre PR ou envia código a serviço externo.** Exige o usuário, uma autorização por ocorrência. A autorização que recebi hoje vale **só** para a `20260814100000` e **só** para a Cistern.
- **Gate e seção QA Results são exclusivos do `@qa`** (Beacon). Nenhum outro agente escreve veredito.
- **Título, descrição, AC e escopo da story são do `@po`** (Ledger). O `@dev` mexe em checkboxes, Dev Agent Record e File List — nada além.
- **Transições de status precisam estar explícitas no brief, com o dono de cada uma.** Já perdemos uma story parada em `Draft` com GO 10/10 registrado porque o brief não tinha o passo.
- Toda migration acompanhada de rollback em `supabase/rollbacks/`.

## 6. Baseline numérica

Você precisa disto para a barra de qualidade, e eu **não medi ainda**. Meça você mesmo antes de escrever os briefs, e escreva os números encontrados dentro deles:

```
npm run lint        # quantos erros/warnings hoje
npm run typecheck   # quantos erros hoje
npm test            # quantos passam / falham hoje
npm run build       # passa ou não hoje
```

Estes são **quatro comandos distintos**. Já custou uma arbitragem inteira confundir lint com typecheck. Nomeie cada gate pelo comando que o produz.

## 7. Como entregar

Formato da seção 9 do seu charter: objetivo, destinatário, o prompt em bloco, decisões de design, riscos, como medir. Para **cada** um dos dois briefs.

Grave cada brief como arquivo:
- `.aiox/briefs/loom-stories-1.37-1.38.md`
- `.aiox/briefs/forge-story-1.37-parser-xml-nfe.md`

E me responda com o resumo — não cole os briefs inteiros na resposta, eu leio os arquivos.

## 8. Desconfie de mim

Tudo que eu afirmei na seção 2 foi verificado por mim nesta sessão, mas **não aceite de mim**. Confira por conta própria o que for entrar como fato dentro dos briefs — caminhos de arquivo, números de linha, seções de documento, estado do banco. Se algo que eu disse não bater, me avise antes de escrever: prefiro corrigir a fonte a propagar um erro meu para dois agentes.

Se faltar informação, pergunte antes de escrever. Prompt escrito sobre lacuna preenchida por suposição é a principal fonte de erro de agente — está no seu próprio charter.
