# Brief — Forge implementar a Story 1.55, piloto de cabeçalho de NF-e XML

## 1. Objetivo

Implementar a rota determinística de NF-e XML que autentica o usuário, valida o cabeçalho e grava uma proposta `pending` sem itens, IA ou escrita em tabelas de domínio.

## 2. Destinatário sugerido

**Forge (`@dev`)**, porque a Story 1.55 é implementação TypeScript/Deno orientada por story; qualquer mudança de arquitetura, schema, migration, gate ou publicação permanece fora da autoridade do executor.

## 3. O prompt

````text
Você é Forge (`@dev`), terminal Codex/GPT. Reporte somente a Orion (`@aiox-master`). Pedidos de aprovação do terminal para escrever arquivos são esperados; Orion destrava. Não use isso como motivo para ampliar ou rediscutir o escopo.

PEDIDO ORIGINAL DO USUÁRIO, NA ÍNTEGRA

Pedido de 2026-08-13:
"preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento de 2026-08-13:
"foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Pedido de 2026-08-22:
"pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

DECISÃO MAIS RECENTE DO USUÁRIO

Hoje é um piloto de cabeçalho de NF-e XML. A 1.55 entrega somente parser/rota/proposta; a 1.56 fará revisão e confirmação. Itens, produtos e estoque estão fora. O corte deriva de `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` §3.6.5, linha 161, e do wireframe da linha 291: fornecedor, compra e contas a pagar independem dos itens; nenhum produto é criado ou vinculado sem revisão.

PRECONDIÇÃO DE STORY

1. Leia `docs/stories/1.55.piloto-cabecalho-nfe-xml.story.md` por inteiro.
2. Confirme status `Ready` e veredito GO do Ledger (`@po`).
3. Se o arquivo não existir, estiver `Draft`, ou seu contrato divergir materialmente deste brief, NÃO escreva código. Reporte a Orion. A story validada é a autoridade executável.
4. Ao iniciar, mude apenas `Ready → InProgress` e registre no Change Log. Ao concluir todos os ACs, mude `InProgress → InReview`. Não edite título, descrição, AC ou escopo.

LEITURA OBRIGATÓRIA

- `docs/stories/1.55.piloto-cabecalho-nfe-xml.story.md`
- `.aiox/briefs/quill-adendo-escopo-e-ids.md`
- `docs/epics/epic-importacao-inteligente-documentos.md`, Onda 2 e seções 4/5/7
- `docs/architecture/ai-document-ingestion-p3.md`, D1–D8, QA-4 e R1/R3/R5
- `docs/ux/importacao-inteligente-documentos-fluxo-ux.md`, §3.6.5 e wireframe iniciado na linha 291
- `docs/data/document-import-proposals-schema.md`, seções 1, 2, 5, 6 e 10
- `supabase/migrations/20260814100000_document_import_proposals.sql`, por inteiro
- `supabase/migrations/20260719130000_document_library_security.sql`, políticas de `document_versions` e Storage
- `supabase/functions/_shared/ai/bootstrap.ts` e `security-context.ts`, apenas como padrão de clientes separados/autorização; não os edite
- `src/services/aiGatewaySecurity.test.ts`, como padrão de handler injetável, erros sanitizados e teste cross-tenant
- `src/services/documentDomain.ts`, `documentService.ts` e seus testes, para MIME, upload imutável e categoria existente
- `docs/research/2026-08-13-importacao-documentos-pdf-nfe-deno/README.md`, §3.1–3.2, para tags e módulo 11
- `.claude/rules/story-lifecycle.md` e `.claude/rules/agent-authority.md`

Desconfie das linhas aproximadas. Reabra os arquivos e confirme o contrato vivo.

VERIFICAÇÃO READ-ONLY ANTES DE CODAR

Confirme no banco remoto, sem mutação:

- migration aplicada como `20260822182249_document_import_proposals`;
- `document_extraction_jobs`, `document_import_proposals` e `document_import_proposal_items` existem;
- RLS habilitada em 3/3;
- `text_origin` existe;
- `UNIQUE (company_id, idempotency_key)` existe;
- tabelas estão disponíveis ao contrato atual.

Use somente listagem/MCP read-only e `SELECT`. Não insira fixture no remoto. Se qualquer item não bater, pare e reporte a Orion.

CONTRATO DE ENTRADA E RESPOSTA

- Endpoint: Edge Function `document-extraction`.
- Método: `POST`; `OPTIONS` apenas para CORS.
- Body estrito: `{ document_version_id: string }` e nada mais.
- Rejeitar propriedades extras, arrays, UUID inválido e qualquer `company_id`, `storage_path`, categoria ou XML bruto.
- Um request = um único documento; não aceitar lote.
- Autenticação obrigatória por Bearer JWT. Não desabilite `verify_jwt`.
- Depois de autorizar a versão/documento, criar job e responder HTTP 202 com `{ job_id, status: 'queued' }`.
- Executar o processamento com `EdgeRuntime.waitUntil`; a task muda o job `queued → running → done|failed`.

FRONTEIRA DE AUTORIZAÇÃO E `service_role`

Use clientes separados:

1. Cliente de autenticação valida o JWT com `auth.getUser(token)`.
2. Cliente do usuário, com o Bearer JWT, resolve `profiles.id/company_id/role`, `companies.id/cnpj`, `document_versions`, o `documents` pai e lê o objeto do bucket `documents` sob RLS. A categoria vem do documento salvo, nunca do XML ou body.
3. Somente após todas essas leituras autorizadas, um cliente administrativo separado grava job/proposta. Ele não recebe sessão do usuário e sua chave nunca vai ao frontend/log.

O `service_role` ignora RLS. Por isso `company_id`, `requested_by`, `document_version_id`, categoria e `storage_path` usados pela gravação privilegiada devem ser cópias do contexto autorizado do passo 2, nunca campos do request. Prova negativa obrigatória: JWT da empresa A + `document_version_id` da empresa B não cria job nem proposta e não baixa o arquivo.

CONTRATO DO DOCUMENTO

- `documents.category` deve ser `nota_fiscal`.
- `document_versions.mime_type` deve ser `text/xml` ou `application/xml`.
- O arquivo deve permanecer no bucket privado; não gerar URL pública nem aceitar caminho fornecido pelo cliente.
- Rejeitar XML vazio, maior que 500 KB para esta rota fiscal, malformado, com `DOCTYPE` ou `ENTITY`, com múltiplos `NFe/infNFe` ambíguos ou campos obrigatórios ausentes.
- Aceitar raiz `NFe` e wrapper `nfeProc/NFe`, com namespace default ou prefixado.
- Exigir `infNFe@versao="4.00"`, `ide/mod = 55`, `infNFe/@Id`, `emit/CNPJ`, `emit/xNome`, `dest/CNPJ`, `total/ICMSTot/vProd` e `vNF`.
- Números monetários devem ser finitos e não negativos; não use `parseFloat` permissivo sobre lixo. Preserve centavos e compare em unidade inteira de centavos quando houver igualdade.
- Cada `cobr/dup`, quando presente, precisa de `dVenc` válido e `vDup > 0`. Ausência completa de `dup` produz `installments: []`; não inventar data ou parcela.

PARSER XML

Implemente parser XML genérico + mapeamento manual. `djf-nfe`, `d-nfe` e qualquer biblioteca de domínio NF-e estão proibidas. `fast-xml-parser` ou equivalente genérico puro é permitido; selecione uma versão compatível com Deno Edge e Vitest, fixe a versão e atualize o lockfile. Não instalar dois parsers.

Não existe XSD no repositório e validação XSD foi retirada do piloto por decisão do usuário. Não baixe XSD, não crie um incompleto e não chame serviço externo.

Assinaturas públicas obrigatórias:

- `validateNfeAccessKey(accessKey: string): boolean`
- `extractNfeHeader(xml: string, companyCnpj: string): NfeHeaderProposalInput`
- `createDocumentExtractionHandler(deps: DocumentExtractionDependencies): (request: Request) => Promise<Response>`

O módulo 11 é fechado: remover apenas o prefixo literal `NFe` do atributo `Id`; exigir 44 dígitos; aplicar pesos 2–9 da direita para a esquerda aos 43 primeiros; `candidate = 11 - (sum % 11)`; 10 ou 11 vira 0; comparar ao 44º dígito. Também conferir que o CNPJ embutido na chave é o `emit/CNPJ` normalizado e que o segmento de modelo é `55`.

DIREÇÃO

Normalize CNPJs para dígitos e use o CNPJ da empresa derivado da sessão:

- destinatário = empresa e emitente ≠ empresa: entrada válida, prossegue;
- emitente = empresa e destinatário ≠ empresa: falha `nfe_saida_nao_suportada`, sem proposta;
- nenhum bate: falha `nfe_cnpj_suspeito`, sem proposta;
- ambos batem: falha `nfe_cnpj_suspeito`, sem proposta.

Se `companies.cnpj` estiver ausente/inválido, falhe com código seguro `company_cnpj_missing`; nunca peça CNPJ pelo body.

MAPEAMENTO EXATO DA PROPOSTA

- `document_category`: `nota_fiscal`
- `status`: `pending`
- `idempotency_key`: chave de acesso normalizada
- `text_origin`: `null`
- `truncated`: `false`
- `supplier.document`: `emit/CNPJ`
- `supplier.name`: `emit/xNome`
- `supplier.email`: `emit/email`, somente quando presente
- `supplier.phone`: `emit/enderEmit/fone`, somente quando presente
- `purchase.total_amount`: `total/ICMSTot/vProd`
- `purchase.discount`: `total/ICMSTot/vDesc`, default 0
- `purchase.fee`: soma de `vFrete`, `vSeg` e `vOutro`, cada ausente como 0
- `purchase.final_value`: `total/ICMSTot/vNF`; não recompute a partir dos demais campos
- `purchase.payment_method`: `other`
- `purchase.notes`: string vazia; não invente texto de domínio
- `purchase.installments`: `cobr/dup[]` em ordem do XML, `{ amount: vDup, due_date: dVenc + 'T00:00:00Z' }`
- `field_origins`: mapa dos caminhos gravados para `deterministic`

Não leia nem mapeie `det`, `prod` ou imposto de item.

PERSISTÊNCIA E IDEMPOTÊNCIA

- Crie job com `company_id`, `document_version_id`, categoria `nota_fiscal` e `requested_by` derivados do contexto autorizado.
- No início da task, marque `running`; em sucesso, grave uma proposta `pending` e marque `done`.
- Não insira nenhuma linha em `document_import_proposal_items`.
- Violação `23505` da `UNIQUE (company_id, idempotency_key)` vira falha segura `duplicate_nfe`; não cria segunda proposta e não tenta contornar a constraint.
- Erros do parser/direção atualizam o job para `failed` com código público seguro. Nunca grave XML, CNPJ, chave completa, JWT, Storage path, mensagem bruta do Postgres ou stack trace em `error`/logs/resposta.
- A ordem de escrita precisa evitar resíduo: se a proposta falhar, job fica `failed`; não deixe job `done` sem proposta.

ZERO ESCRITA NO DOMÍNIO

Esta story termina em proposta. É proibido inserir/atualizar `suppliers`, `purchases`, `purchase_items`, `account_payables`, `products` ou estoque; é proibido chamar `apply_nfe_purchase_proposal`. A Story 1.56 fará isso após consentimento humano.

ZERO IA

Não importe/chame provider, OpenAI, `ai-gateway`, `reserve_ai_usage`, `finalize_ai_usage` nem qualquer módulo de quota. Não edite `supabase/functions/_shared/ai/**`. Se houver chamada a modelo, a rota está errada.

ARQUIVOS E PROPRIEDADE

Você pode criar/editar somente:

- `supabase/functions/document-extraction/**`
- `supabase/functions/_shared/document-import/**`
- `src/services/documentImportNfe.test.ts`
- `src/services/documentExtractionSecurity.test.ts`
- `package.json`, `package-lock.json` e `deno.lock` apenas se indispensáveis ao parser genérico e mantendo versão fixada
- na Story 1.55: checkboxes, Dev Agent Record, File List e Change Log/status conforme autoridade

A organização interna dos dois diretórios novos é sua liberdade, mas mantenha as três assinaturas públicas. Você não está sozinho no worktree: preserve mudanças alheias e não reverta nada.

NÃO TOQUE

- `docs/stories/1.56*`, epic, ADR, UX, schema ou gates
- `supabase/migrations/**`, `supabase/rollbacks/**`, policies, grants, RPCs ou tipos do domínio
- `src/pages/**`, `src/hooks/**`, serviços de fornecedor/compra/financeiro/estoque
- `supabase/functions/ai-gateway/**` e `_shared/ai/**`
- `.claude/launch.json`, `vite.config.ts`, `dist/`, `dist-edge/`

Não crie migration no-op. Não corrija dívida global de lint/typecheck.

TESTES FOCADOS — MÍNIMO 24 CASOS NOVOS

Em `documentImportNfe.test.ts`, cubra ao menos:

1. NF-e de entrada válida e mapeamento completo do cabeçalho.
2. `NFe` com namespace default.
3. `nfeProc/NFe` com prefixo de namespace.
4. XML malformado.
5. `DOCTYPE`/`ENTITY` rejeitado.
6. múltiplos `infNFe` ambíguos.
7. versão diferente de 4.00.
8. modelo diferente de 55.
9. `Id` ausente/tamanho/caractere inválido.
10. módulo 11 válido conhecido.
11. dígito verificador adulterado.
12. CNPJ da chave divergente do emitente.
13. NF-e de saída.
14. nenhum CNPJ da empresa.
15. emitente e destinatário ambos iguais à empresa.
16. empresa sem CNPJ.
17. campos obrigatórios ausentes.
18. monetário inválido/negativo.
19. totais/defaults e parcelas múltiplas em ISO.
20. ausência de `dup` produz lista vazia.

Em `documentExtractionSecurity.test.ts`, cubra ao menos:

21. sem JWT e body com campo extra/`company_id` não inicia processamento.
22. cross-tenant A→B não baixa arquivo nem chama qualquer insert administrativo.
23. happy path `queued → running → done`, uma proposta `pending`, zero inserts de itens e resposta 202.
24. duplicidade, direção inválida ou falha inesperada produz `failed`, mensagem sanitizada e zero IA/escrita de domínio.

Use fakes/dependency injection; testes não dependem do banco remoto nem de rede. Acrescente casos se necessário — 24 é piso, não teto.

BASELINE E GATES — REVERIFIQUE ANTES E DEPOIS

Ponto de partida medido em `3c13648`, branch `docs/importacao-inteligente-documentos`, com worktree já sujo:

- `npm run lint`: 276 erros, 2 warnings, exit 1. Gate: global não passa de 276/2; `npx eslint` nos arquivos novos/tocados retorna 0 erros e 0 warnings.
- `npm run typecheck`: 24 diagnósticos TypeScript, exit 1. Gate: ≤24 e nenhum diagnóstico novo em arquivo da story. `EPERM` de `.tsbuildinfo` é falha de permissão/sandbox separada; repita com permissão e não a conte como dívida TypeScript.
- `npm test`: 58 arquivos/510 testes passando, 0 falhando. Gate: com dois arquivos e no mínimo 24 casos novos, alvo ≥60 arquivos, ≥534 testes passando, 0 falhando.
- `npm run build`: PASS. Gate: PASS; warning preexistente de chunk >500 kB não conta como falha.

Comandos distintos, saídas distintas. Não reporte erro de typecheck como lint nem warning de build como falha de teste. Registre a saída real no Dev Agent Record.

Comandos focados mínimos:

- `npx vitest run src/services/documentImportNfe.test.ts src/services/documentExtractionSecurity.test.ts`
- `npx eslint supabase/functions/document-extraction supabase/functions/_shared/document-import src/services/documentImportNfe.test.ts src/services/documentExtractionSecurity.test.ts --max-warnings 0`
- depois: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

Se a baseline corrente diferir antes da sua mudança, ela vira a comparação válida; reporte a divergência a Orion antes de atribuir regressão.

PROIBIÇÕES OPERACIONAIS

- Não execute `supabase db push`. A migration está registrada remotamente como `20260822182249`, enquanto o arquivo local é `20260814100000`; o CLI tentaria reaplicar policies/triggers.
- Não execute `apply_migration`, DDL/DML remoto, `migration repair`, deploy de Edge Function, alteração de `schema_migrations` ou renome de migration.
- Não faça `git push`, não abra PR, não crie release/tag e não envie código a serviço externo sem autorização específica do usuário.
- CodeRabbit transmite código: não execute sem autorização específica.
- Não use `git stash` + `git stash pop`. Para comparação histórica indispensável, use `git worktree add --detach <commit>` em diretório separado e valide o caminho antes.
- Não edite gate ou QA Results; são exclusivos do Beacon (`@qa`).

BLOQUEIO E ESCALADA

Pare e reporte a Orion, com evidência exata, se:

- a story não estiver Ready;
- o estado remoto divergir;
- o contrato da migration impedir a proposta sem itens;
- a biblioteca genérica escolhida não rodar tanto no Deno Edge quanto nos testes;
- cumprir um AC exigir XSD, migration, mudança de RPC, IA ou escrita de domínio;
- algum gate piorar e você não conseguir provar que a diferença é preexistente.

ENTREGA

Ao terminar:

1. marque tarefas concluídas, atualize Dev Agent Record e File List;
2. registre `InProgress → InReview` no Change Log;
3. entregue a Orion resumo, arquivos tocados, testes/gates com números antes/depois e bloqueios residuais;
4. não escreva QA Results e não publique nada.
````

## 4. Decisões de design

- O endpoint aceita somente `document_version_id`; XML, tenant, categoria e caminho permanecem dados resolvidos no servidor.
- Autorização JWT/RLS antecede qualquer uso de `service_role`, cuja finalidade é exclusivamente persistir job/proposta após a prova de acesso.
- O parser tem três funções públicas e usa mapeamento manual; a dependência XML genérica e sua versão ficam abertas apenas até Forge verificar compatibilidade, depois precisam ser fixadas.
- O processamento assíncrono usa o mecanismo oficial `EdgeRuntime.waitUntil`, alinhado ao job já modelado no DDL.
- A proposta de cabeçalho contém zero itens; isso torna o caminho de produto da RPC inerte na Story 1.56 sem alterar banco.
- `final_value` preserva `vNF`; não é recalculado pela fórmula simplificada do formulário de compra.
- Baseline global quebrada é gate de não-regressão; arquivos novos continuam obrigados a lint focado limpo.

## 5. Riscos

- O maior risco é BOLA/IDOR: `service_role` pode mascarar uma leitura cross-tenant se usado antes do cliente JWT.
- Background tasks têm limite de runtime; embora XML de NF-e seja pequeno, toda rejeição precisa encerrar e registrar `failed`, sem job preso em `running`.
- Namespaces, wrappers e arrays de uma única ocorrência costumam variar entre parsers XML; os testes precisam cobrir as formas aceitas sem transformar o parser em biblioteca fiscal incompleta.
- A migration aplicada sob versão remota diferente bloqueia `supabase db push`; um executor tentando “resolver” isso sairia do escopo e faria mutação externa não autorizada.
- A Story 1.56 dependerá de `installments: []` ser um estado revisável, não uma proposta silenciosamente aplicável; a 1.55 não pode inventar vencimento para facilitar a UI.

## 6. Como medir

- Um XML válido de entrada produz exatamente um job `done`, uma proposta `pending` e zero itens, sem chamadas a IA ou domínio.
- Saída, suspeita, chave inválida e cross-tenant produzem zero propostas e erros seguros.
- No mínimo 24 testes focados novos passam; suíte total fica em pelo menos 534/0 e build permanece PASS.
- Lint/typecheck globais não ultrapassam 276 erros/2 warnings e 24 diagnósticos; arquivos novos têm zero lint e zero diagnóstico novo.
- Diff fica restrito aos diretórios/arquivos autorizados e às seções permitidas da Story 1.55.
