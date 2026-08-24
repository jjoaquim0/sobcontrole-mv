# Brief — Forge implementar a Story 1.56, revisão e confirmação do cabeçalho de NF-e

## 1. Objetivo

Implementar o fluxo pós-upload que acompanha a extração da NF-e XML, permite revisar somente fornecedor, totais e parcelas, apresenta resumo explícito e aplica a proposta por uma única RPC transacional sob JWT/RLS.

## 2. Destinatário sugerido

**Forge (`@dev`, Dex)**, porque a Story 1.56 combina React/TypeScript, integração `supabase-js`, formulário financeiro, estados assíncronos e testes de segurança; decisões de escopo, schema, gate e publicação continuam pertencendo aos respectivos agentes.

## 3. O prompt

````text
Você é Forge (`@dev`, Dex), terminal Codex/GPT. Reporte somente a Orion (`@aiox-master`). Leia este prompt inteiro antes de agir. Não fale com outro agente e não trate pedido de aprovação do terminal para escrita local como bloqueio de escopo — Orion coordena essas aprovações.

PEDIDO ORIGINAL DO USUÁRIO, NA ÍNTEGRA

Pedido de 2026-08-13:
"preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento de 2026-08-13:
"foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Exigência permanente de método:
"ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar"

Pedido de 2026-08-22:
"pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

Pedido de 2026-08-24:
"continue a tarefa que estavamos fazendo"

OBJETIVO, CONTEXTO E ESCOPO DO ENTREGÁVEL

Objetivo observável: fechar o loop “upload XML → acompanhar extração → revisar dados estruturados → resumo → clique humano → fornecedor/compra/contas a pagar”, sem itens, produtos, estoque, PDF, OCR ou IA.

A Story 1.55 já entrega o parser determinístico, a Edge Function `document-extraction` e a proposta `pending`. A Story 1.56 entrega exclusivamente a UI/serviço/hook de revisão e confirmação. Consentimento é clique sobre dados estruturados revisáveis; nunca implemente pergunta/resposta em chat.

Entregável esperado:

- integração mínima no sucesso do upload existente;
- ação irmã literal `Importar com Gestly`, mantendo `AiSiteIntegrationAction` intocado;
- serviço e hook para iniciar/retomar job, ler/editar proposta sob RLS e confirmar por RPC;
- modal/fluxo com revisão, resumo e sucesso;
- testes focados por comportamento e atualização das seções pertencentes ao `@dev` na Story 1.56.

Não-objetivos: itens de NF-e, chips/scores de confiança, decisão de custo, vínculo/criação de produto, estoque, PDF/foto/OCR, IA, boleto, contrato, mudança de schema/RPC/policy/grant, correção de issues da Story 1.55 ou publicação.

PRECONDIÇÃO DE STORY — BLOQUEANTE

1. Leia `docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md` por inteiro.
2. Só comece código se o Status estiver exatamente `Ready` e houver veredito GO do `@po` no Change Log.
3. A transição `Draft → Ready` pertence exclusivamente ao `@po`. Não a faça.
4. Se a story ainda estiver `Draft`, se houver novo NO-GO, ou se qualquer AC divergir deste prompt, pare antes de escrever código e reporte a Orion com o trecho exato. A story validada prevalece.
5. Com `Ready`, registre apenas `Ready → InProgress`, por ser transição do `@dev`.

LEITURA OBRIGATÓRIA ANTES DE CODAR

- `docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md`, os 13 ACs por inteiro;
- `docs/stories/1.55.piloto-cabecalho-nfe-xml.story.md`, Dev Agent Record e QA Results;
- `docs/qa/gates/1.55-piloto-deterministico-cabecalho-nfe-xml.yml`, somente leitura;
- `docs/ux/importacao-inteligente-documentos-fluxo-ux.md`, §§3.1, 3.2, 3.6.5, 4, 5, 6, 7, 8.1, 8.1b e 8.3;
- `docs/architecture/ai-document-ingestion-p3.md`, D1–D9, QA-1–QA-4 e R1–R10;
- `docs/data/document-import-proposals-schema.md`, §§2.5, 2.6, 6 e 10;
- `supabase/migrations/20260814100000_document_import_proposals.sql`, tabelas, RLS/grants e `apply_nfe_purchase_proposal`;
- `src/types/index.ts`, `PaymentMethod`, `AccountPayable` e `Deal`, somente leitura;
- `supabase/functions/_shared/document-import/nfe.ts`, `handler.ts` e `supabase/functions/document-extraction/index.ts`, somente leitura;
- `src/pages/documents/DocumentsPage.tsx`, `DocumentUploadModal.tsx`, `AiSiteIntegrationAction.tsx`, `DocumentPreviewModal.tsx`;
- `src/services/documentService.ts`, `supplierService.ts`, `src/hooks/useDocuments.ts`, `src/store/authStore.ts` e testes adjacentes;
- `.claude/rules/story-lifecycle.md` e `.claude/rules/agent-authority.md`.

CONTEXTO VERIFICADO POR ORION/QUILL — CONFIRME POR CONTA PRÓPRIA, NÃO ACEITE DE MIM

- A Story 1.55 está `Done`; o gate é `CONCERNS`, não `FAIL`, com TEST-001, TEST-002 e REL-001 médios e TEST-003 baixo. Não tente fechar essas issues: são de outro ciclo e qualquer gate/QA Results é do `@qa`.
- Os cinco arquivos da 1.55 estão untracked na branch `docs/importacao-inteligente-documentos`, último commit `3c13648`.
- A migration local cria as três tabelas, RLS, `GRANT SELECT` em jobs/propostas, `GRANT UPDATE (payload)` em propostas e `GRANT EXECUTE` da RPC para `authenticated`.
- O registro da 1.55 e a nota de schema dizem que a migration foi aplicada remotamente como versão `20260822182249`, embora o arquivo local continue `20260814100000`. Não execute `supabase db push`: a divergência de versão faria o CLI tentar reaplicar policies/triggers.
- `npm test` foi medido por Quill em 2026-08-24: 60 arquivos, 551 testes, 0 falhas. Isso é ponto de partida de terceiro, não seu baseline.
- A última medida conhecida, não refeita nesta retomada, era: lint 276 erros/2 warnings, typecheck 24 diagnósticos e build PASS.
- `package-lock.json` fixa `@supabase/supabase-js` 2.108.2; a linha declarada no `package.json` é `^2.42.0`.
- `.claude/launch.json`, `vite.config.ts` e `docs/data/document-import-proposals-schema.md` já têm mudanças alheias. Preserve-as.

Reverifique localmente com leitura e comandos. Você não tem autoridade para gerenciar MCP nem para fazer mutação remota. Se a Data API responder `42501`, não contorne RLS/grants no cliente e não crie migration: reporte a Orion. As tabelas já têm grants explícitos no DDL; grants e RLS são camadas distintas.

PRECEDÊNCIA ENTRE FONTES — NÃO IMPLEMENTE A MAIS

A UX histórica mostra itens, produtos, scores de confiança e custo por item. A Story 1.56 supersede esse trecho para o piloto. O corte vinculante é:

- somente fornecedor, totais e parcelas;
- nenhuma leitura/renderização de `document_import_proposal_items`;
- nenhum chip/score de confiança;
- nenhum produto, `purchase_items`, decisão de custo ou estoque;
- proposta da 1.55 tem zero itens, portanto o loop de itens existente na RPC deve permanecer inerte.

O AC5 é negativo: renderizar ou consultar item faz a implementação falhar. Não “melhore” a story entregando a tela completa dos wireframes antigos.

ARQUIVOS E CONTRATOS DE CÓDIGO

Use estes caminhos e responsabilidades, sem criar uma segunda arquitetura paralela:

- `src/services/documentImportService.ts`: tipos, validação pura e todas as operações Supabase do fluxo;
- `src/services/documentImportService.test.ts`: serviço, payload, tenant, centavos, retries e erros;
- `src/hooks/useDocumentImport.ts`: orquestra estados/polling/reentrada sem acesso direto a tabelas fora do service;
- `src/hooks/useDocumentImport.test.tsx`: state machine do hook;
- `src/pages/documents/components/DocumentImportAction.tsx`: ação irmã `Importar com Gestly`;
- `src/pages/documents/components/DocumentImportAction.test.tsx`;
- `src/pages/documents/components/DocumentImportReviewModal.tsx`: revisão, resumo, sucesso, erro e acessibilidade;
- `src/pages/documents/components/DocumentImportReviewModal.test.tsx`;
- `src/pages/documents/components/DocumentUploadModal.tsx`: integração mínima no item com upload bem-sucedido;
- `src/pages/documents/components/DocumentUploadModal.test.tsx`;
- `src/pages/documents/DocumentsPage.tsx`: fazer o retorno real de `uploadDocument` chegar ao modal.

Contratos públicos fechados:

- `DocumentUploadModalProps.onUpload(file, input): Promise<Document>`; o `PendingFile` guarda o `Document` retornado. Não refaça upload nem procure versão por nome.
- `DocumentImportActionProps`: `{ document: Document; compact?: boolean; className?: string }`.
- A ação só fica disponível quando `document.category === 'nota_fiscal'`, `document.mimeType` é `text/xml` ou `application/xml` e `document.currentVersionId` existe.
- `startNfeDocumentExtraction(documentVersionId: string): Promise<{ jobId: string; status: 'queued' }>`.
- `findLatestNfeExtraction(documentVersionId: string): Promise<DocumentExtractionJob | null>`.
- `getNfeImportProposalByJobId(jobId: string): Promise<NfeImportProposal | null>`.
- `saveNfeProposalPayload(proposalId: string, payload: NfeHeaderProposalPayload): Promise<NfeImportProposal>`.
- `findSupplierMatchByDocument(document: string): Promise<SupplierMatchResult>`.
- `applyNfePurchaseProposal(proposalId: string): Promise<NfeImportProposal>`.

Se um nome acima colidir com símbolo real descoberto na leitura, pare e reporte a colisão antes de escolher outro silenciosamente.

CONTRATO EXATO DO PAYLOAD EDITÁVEL

Não acrescente chaves e não remova opcionais já extraídos:

{
  supplier: {
    document: string,
    name: string,
    email?: string,
    phone?: string
  },
  purchase: {
    total_amount: number,
    discount: number,
    fee: number,
    final_value: number,
    payment_method: 'other',
    notes: string,
    installments: Array<{
      amount: number,
      due_date: string
    }>
  }
}

A UI edita somente `supplier.document`, `supplier.name`, os quatro campos financeiros e `installments`. Preserve `supplier.email`, `supplier.phone` e `purchase.notes` se vierem da proposta. `payment_method` permanece literalmente `'other'` e não ganha seletor.

`due_date` sai do input `YYYY-MM-DD` e é serializado como `YYYY-MM-DDT00:00:00Z`, validando calendário real. Valores monetários são editados, somados e comparados em inteiros de centavos; não compare floats e não use arredondamento implícito. Não imponha fórmula `total_amount - discount + fee = final_value`, porque o AC não a exige e `final_value` preserva o `vNF` fiscal.

TABELAS, COLUNAS E OPERAÇÕES PERMITIDAS À UI

1. `document_extraction_jobs` — somente SELECT de `id, company_id, document_version_id, document_category, status, error, created_at, updated_at, started_at, completed_at`.
2. `document_import_proposals` — SELECT de `id, job_id, company_id, document_category, status, payload, field_origins, text_origin, truncated, expires_at, applied_at`; UPDATE somente da coluna `payload`, somente com `id`, `company_id` da sessão e `status = 'pending'` no filtro.
3. `suppliers` — somente SELECT de `id, company_id, name, document, status` para sinalizar existente versus novo.
4. `documents`/`document_versions` — reutilize o objeto `Document` devolvido pelo upload; não reescreva arquivo, storage path, versão ou metadados.
5. Função `public.apply_nfe_purchase_proposal(p_proposal_id UUID) RETURNS public.document_import_proposals`, `SECURITY INVOKER`.

Não selecione com `*` nos novos services. Não consulte nem atualize `document_import_proposal_items`. Não faça INSERT/UPDATE/DELETE direto em `suppliers`, `purchases`, `purchase_items`, `account_payables`, `products`, estoque, jobs ou status da proposta.

TENANT E SESSÃO

Crie no service um guard local sem argumento, seguindo o padrão real do projeto: ele lê `useAuthStore.getState().company?.id` e lança `Empresa não identificada.` se ausente. O nome do helper interno é liberdade de implementação; sua fonte não é.

`company_id` nunca vem de prop, body, URL, query string, formulário, payload da proposta, `sessionStorage` ou estado editável. Em toda leitura/update Data API, filtre também por `company_id` da sessão como defesa em profundidade; RLS continua autoridade final. Uma proposta estrangeira deve parecer inexistente e nenhuma RPC deve ser chamada.

CHAMADAS SUPABASE EXATAS

Início da extração, uma invocação de aplicação por clique:

supabase.functions.invoke('document-extraction', {
  body: { document_version_id: documentVersionId }
})

Não envie `company_id`, categoria, MIME, XML, storage path ou objeto `Document`. Valide retorno HTTP lógico como `{ job_id: string, status: 'queued' }`. Para `FunctionsHttpError`, leia `error.context.json()` e preserve `error.code`/mensagem pública do handler; não exponha stack, SQL ou segredo.

Confirmação, com nome real do parâmetro SQL:

supabase.rpc('apply_nfe_purchase_proposal', {
  p_proposal_id: proposalId
})

Uma confirmação dispara uma chamada de aplicação no código da UI. Não envolva `.rpc()` em retry manual. A versão instalada de `supabase-js` possui retry automático de PostgREST para falhas transitórias; se a chamada retornar erro ou a resposta se perder, releia a proposta sob RLS antes de concluir:

- status `applied` → trate como sucesso idempotente;
- status `pending` → nada de domínio foi confirmado; mostre erro seguro e permita retry explícito;
- proposta inexistente/estrangeira → erro seguro, zero nova RPC;
- outro status → não repita aplicação.

Não altere o cliente global para desabilitar retry — isso afetaria o projeto inteiro. Não crie segundo cliente Supabase no frontend e nunca exponha `service_role`.

STATE MACHINE, DUPLO CLIQUE E F5

1. Após upload bem-sucedido, use `Document.currentVersionId`; um item de upload corresponde a uma ação.
2. Antes de invocar a Edge Function, busque o job mais recente da mesma `document_version_id` e empresa:
   - `queued|running`: retome polling;
   - `done`: carregue a proposta do job;
   - `failed`: mostre erro e exija clique explícito em retry;
   - ausente: inicie uma extração.
3. Enquanto a busca/invocação estiver em voo, desabilite o botão e use mutex/ref para impedir dois handlers no mesmo clique. Não dependa apenas de estado React assíncrono.
4. Polling comunica `queued`, `running`, `done` e `failed` em região `aria-live="polite"`; pare em estado terminal, unmount ou fechamento.
5. F5/reabertura recompõe o estado consultando job/proposta por `document_version_id`; não use tenant ou proposta armazenados no browser como autoridade.
6. Retry de extração só ocorre após estado `failed` e clique explícito. Duplicidade `duplicate_nfe` não cria nova proposta e é exibida como resultado seguro.
7. Na confirmação, salve primeiro o payload revisado permitido e, após sucesso desse update, chame a RPC uma vez. Desabilite confirmação durante os dois passos. Em F5/resposta perdida, releia o status da proposta.

FORNECEDOR EXISTENTE VERSUS NOVO

O cadastro atual formata CNPJ em alguns fluxos, enquanto a proposta XML chega com 14 dígitos e a RPC compara o texto armazenado por igualdade após `btrim`. Para cumprir AC6 sem mudar RPC:

- normalize ambos para dígitos apenas para comparação;
- leia fornecedores do tenant com as colunas permitidas e encontre os que têm o mesmo CNPJ normalizado;
- zero correspondências → exiba `Novo — será criado`;
- uma correspondência → exiba `Vinculado a <nome>` e, ao persistir o payload, use exatamente o valor de `suppliers.document` armazenado para que a RPC resolva o mesmo registro;
- mais de uma correspondência normalizada → bloqueie confirmação e reporte conflito explícito; não escolha arbitrariamente;
- nunca envie `supplierId`, `matched_supplier_id` ou id editável. A RPC resolve/cria sob o JWT/RLS.

VALIDAÇÃO DO FORMULÁRIO — EXATAMENTE O AC3

- CNPJ: obrigatório e 14 dígitos após normalização; nome do fornecedor obrigatório após trim.
- `total_amount`, `discount`, `fee` e `final_value`: números válidos e não negativos.
- Pelo menos uma parcela antes de confirmar.
- Cada parcela: valor estritamente positivo e data de calendário válida.
- Soma das parcelas em centavos exatamente igual a `final_value` em centavos.
- Se o XML não trouxe `cobr/dup`, comece com lista vazia e obrigue preenchimento humano; não gere data, quantidade de parcelas ou vencimento.
- Confirmação desabilitada em qualquer estado inválido.

REVISÃO, RESUMO E SUCESSO

Use três estados distintos: revisão editável → resumo somente leitura → sucesso. Voltar do resumo preserva edições válidas. O resumo mostra fornecedor (novo/vinculado), compra, `final_value`, número de parcelas e total de contas a pagar.

O texto abaixo é literal, inclusive pontuação, e deve aparecer inteiro na revisão, no resumo e no sucesso:

“Este piloto importa somente fornecedor, compra e contas a pagar. Itens, produtos e estoque não serão importados.”

No sucesso, mostre também literalmente:

“Os produtos não foram adicionados ao estoque — lance-os manualmente.”

Nenhum dos avisos pode depender apenas de cor. Não renderize tabela de item, contagem de itens, score/chip de confiança ou custo de produto, ainda que o XML contenha `det`.

ERROS SEGUROS

Mapeie códigos públicos já produzidos pela 1.55, sem alterar o handler: `nfe_saida_nao_suportada`, `nfe_cnpj_suspeito`, `nfe_xml_*`, `nfe_access_key_*`, `duplicate_nfe`, `document_not_found`, `unauthorized` e `internal_error`. A cópia exata fora do aviso de corte é decisão de implementação, mas centralize-a e fixe-a nos testes; nunca mostre stack, SQL, objeto Supabase bruto ou identificador de outro tenant.

Em qualquer falha da RPC, mostre literalmente:

“Nada foi gravado. O documento original continua salvo. Tente novamente.”

Não apague documento/versão e não faça compensação client-side. A função inteira é transacional: falha propaga e a proposta permanece `pending`.

ACESSIBILIDADE E TEMA

- modal com `role="dialog"`, `aria-modal="true"`, heading nomeado e foco inicial no heading ou primeiro campo inválido;
- labels associados por `htmlFor`/`id`, mensagens com `aria-describedby`, erro e transições em `aria-live="polite"`;
- navegação completa por teclado, foco visível, Escape/fechamento seguro sem perder confirmação em voo;
- informação nunca só por cor; contraste em claro/escuro e classes `dark:` nos novos componentes;
- botão nativo para ações; revisão/resumo/sucesso anunciáveis por leitor de tela.

TESTES FOCADOS E MATRIZ AC1–AC13

Use Vitest + Testing Library e mocks injetáveis do cliente Supabase. Rode:

npx vitest run src/services/documentImportService.test.ts src/hooks/useDocumentImport.test.tsx src/pages/documents/components/DocumentImportAction.test.tsx src/pages/documents/components/DocumentImportReviewModal.test.tsx src/pages/documents/components/DocumentUploadModal.test.tsx

Prove, no mínimo, estes comportamentos, sem meta artificial de quantidade:

- AC1: ação somente para Document NF-e XML com `currentVersionId`; PDF/foto não entram e upload/versão não mudam.
- AC2: body exato, uma `functions.invoke`, estados `queued→done` e `queued→failed`, mutex, retry explícito e retomada do último job.
- AC3: CNPJ/nome vazios, quatro valores negativos, data inválida, parcela zero, soma divergente, centavos e ausência de duplicatas.
- AC4: texto literal do corte em revisão, resumo e sucesso; texto manual no sucesso.
- AC5: XML/proposta com `det` não renderiza item; mocks falham se `document_import_proposal_items`, produto, custo ou estoque forem consultados.
- AC6: fornecedor novo, uma correspondência formatada/não formatada, correspondência duplicada bloqueante e nenhum `supplierId` enviado.
- AC7: botão desabilitado para cada inválido, resumo separado e retorno sem perda.
- AC8: `supabase.rpc` recebe exatamente `('apply_nfe_purchase_proposal', { p_proposal_id })` uma vez por ação; duplo clique/F5/resposta perdida reconsultam status e não disparam escrita alternativa.
- AC9: payload mantém `payment_method: 'other'`; zero chamadas client-side a tabelas de domínio/itens/estoque.
- AC10: sessão A + proposta B resulta em nenhuma leitura útil, nenhum UPDATE e nenhuma RPC; `company_id` não aparece em props/body/URL.
- AC11: casos próprios para saída, nenhum CNPJ, ambos CNPJs, XML inválido, chave inválida, duplicidade e exceção da RPC; documento preservado e mensagem atômica literal.
- AC12: labels, foco, teclado, `aria-live`, claro/escuro e avisos textuais.
- AC13: matriz AC→teste no Dev Agent Record e quatro gates separados antes/depois.

Integrações que criam fornecedor/compra/contas a pagar ou alteram dados remotos não estão autorizadas nesta execução. Implemente toda prova local/mocada possível. Não aponte teste para produção. Se AC8/AC9 exigirem prova contra banco real, pare apenas essa parte e escale a Orion para obter ambiente descartável e autorização humana específica; não marque a evidência de integração como satisfeita por mock.

BASELINES E QUATRO GATES — MEÇA VOCÊ MESMO ANTES DE EDITAR

Execute e registre separadamente, antes da primeira alteração:

1. `npm run lint` — erros e warnings, exit code.
2. `npm run typecheck` — diagnósticos TypeScript, exit code.
3. `npm test` — arquivos, testes passando/falhando, exit code.
4. `npm run build` — PASS/FAIL, exit code e warnings informativos separados.

Não herde 276/2, 24, 551/0 ou PASS como verdade. Meça. Depois repita os quatro comandos e compare com seu próprio baseline registrado:

- lint global não piora; lint focado de todos os arquivos tocados = 0 erros/0 warnings;
- typecheck global não aumenta e nenhum diagnóstico novo aparece em arquivo da story;
- testes do baseline continuam com 0 falhas, sem remoção silenciosa de casos; novos testes passam;
- build permanece PASS.

`lint`, `typecheck`, `test` e `build` são checks diferentes. Não chame diagnóstico do `tsc` de lint nem warning de chunk de falha de teste. Se ocorrer `EPERM` em `.tsbuildinfo`, registre como limitação de ambiente separada, repita de forma segura e não o conte como diagnóstico TypeScript.

Não use `git stash` + `git stash pop` para baseline. Se comparação histórica for indispensável, use `git worktree add --detach <diretório-validado> <commit>` e não toque na árvore atual.

FRONTEIRAS DURAS — NÃO TOQUE

- `supabase/functions/_shared/document-import/nfe.ts`
- `supabase/functions/_shared/document-import/handler.ts`
- `supabase/functions/document-extraction/index.ts`
- `src/services/documentImportNfe.test.ts`
- `src/services/documentExtractionSecurity.test.ts`
- `docs/qa/gates/**` e a seção QA Results de qualquer story
- `src/pages/documents/components/AiSiteIntegrationAction.tsx` e seu teste
- `src/pages/documents/components/DocumentPreviewModal.tsx`
- `src/types/index.ts`
- `src/services/supplierService.ts`, serviços de compra/financeiro/estoque e tabelas de domínio
- `supabase/migrations/**`, `supabase/rollbacks/**`, policies, grants, RPCs e `schema_migrations`
- `docs/architecture/**`, `docs/ux/**`, `docs/data/**`, epic e handoff
- `.claude/launch.json`, `.claude/settings.local.json.bak`, `vite.config.ts`, `dist/` e `dist-edge/`
- `ai-gateway`, quota, `reserve_ai_usage`, `finalize_ai_usage` e migration `20260814101500_ai_usage_feature_dimension.sql`

Se um AC só puder ser cumprido tocando qualquer item acima, não toque: reporte a Orion o AC, arquivo e menor mudança necessária. Não feche TEST-001/002/003 ou REL-001 do gate da 1.55 nesta story.

AUTORIDADE E OPERAÇÕES PROIBIDAS

- Sem `git push`, `gh pr`, merge, release ou tag; publicação é exclusiva do `@devops` e ainda exige autorização humana.
- Sem migration, `supabase db push`, `migration repair`, DDL/DML remoto, deploy de Edge Function ou gestão de MCP.
- Sem CodeRabbit ou outro envio externo de código; exige autorização humana por ocorrência.
- Sem `reset --hard`, exclusão destrutiva ou bypass de hook/guard de autoridade.
- `git add`/commit local são permitidos ao `@dev`, mas a árvore contém trabalho alheio untracked: nunca use `git add .` ou `git add -A`; stage somente os caminhos da Story 1.56 e confira `git diff --cached --name-only`.
- Preserve toda mudança alheia e não reverta arquivos que você não criou.

STORY, PROPRIEDADE E TRANSIÇÕES

- `Draft → Ready`: somente `@po`.
- `Ready → InProgress`: você, `@dev`, ao iniciar.
- `InProgress → InReview`: você, `@dev`, somente quando o escopo implementável e as evidências exigidas estiverem completos; se a prova de integração autorizada bloquear um AC, reporte antes de promover.
- `InReview → Done` ou retorno a `InProgress`: somente `@qa` conforme gate.

Você pode atualizar checkboxes, Dev Agent Record, File List e acrescentar sua linha append-only no Change Log. Não altere título, Story, ACs, escopo ou QA Results. Nunca mude gate/veredito.

BLOQUEIO E ESCALADA

Pare somente a parte afetada, preserve o trabalho válido e reporte a Orion com: ponto exato, evidência, impacto, tentativas e menor decisão necessária. Bloqueiam especialmente:

- story diferente de `Ready` ou novo NO-GO;
- falta de `currentVersionId` no retorno real do upload;
- contrato SQL/RLS/grant diferente do descrito;
- necessidade de alterar RPC para resolver fornecedor/atomicidade;
- acesso `42501`, proposta cross-tenant visível ou qualquer escrita parcial;
- mais de um fornecedor com o mesmo CNPJ normalizado;
- AC que exija itens, migration, código da 1.55, IA ou ação externa;
- gate que piora sem atribuição objetiva.

Nunca marque AC satisfeito por aproximação. Continue apenas nas partes independentes e não procure outro agente diretamente.

ENTREGA A ORION

1. Resultado em uma frase.
2. Caminhos criados/alterados e razão de cada um.
3. Matriz AC1–AC13 → testes/evidências.
4. Baseline e resultado final de lint, typecheck, test e build, cada comando separado.
5. Resultado do lint focado.
6. Decisões tomadas somente nas liberdades declaradas.
7. Bloqueios, integração não executada e ações que ainda exigem aprovação humana.
8. Story atualizada apenas nas seções do `@dev`; sem QA Results, gate ou publicação.
````

## 4. Decisões de design

- Fechei a integração no retorno real de `uploadDocument`: ele já devolve `Document` com `currentVersionId`; propagar esse retorno evita procurar versão por nome ou recriar upload.
- Fechei a chamada client-side como `p_proposal_id`, que é o nome real do parâmetro SQL; `proposal_id` seria um contrato errado em `supabase.rpc`.
- Separei update de `payload` — única coluna concedida à UI — da RPC, única escrita de domínio. O status continua fora do alcance direto do frontend.
- Para F5, preferi recomposição por job/proposta sob RLS, e não estado persistido no browser. O browser nunca vira autoridade de tenant.
- Tratei o CNPJ formatado do cadastro existente sem mudar a RPC: comparação normalizada na leitura e persistência do texto exato já armazenado quando há uma única correspondência.
- Mantive a liberdade do Forge somente para organização interna e cópia dos erros sem literal na story; nomes públicos, caminhos principais, payload, tabelas/colunas e mensagens exigidas por AC ficaram fechados.
- Apliquei o comportamento atual do `supabase-js` 2.108.2: uma chamada de aplicação no código, sem retry manual, seguida de reconsulta do status se a resposta for ambígua.
- A Story 1.56 corrigiu o baseline fixo para um baseline recomponível; o prompt exige medição própria dos quatro gates antes da edição.

## 5. Riscos

- A story só pode começar em `Ready`; no momento da auditoria ela ainda estava `Draft` após a correção 0.1.3 do baseline e aguardava nova validação do `@po`.
- A RPC ainda contém o caminho histórico de itens. A segurança do corte depende de a 1.55 produzir zero itens e de esta UI nunca consultar/criar itens; por isso há testes negativos explícitos.
- Cadastros antigos podem ter CNPJ formatado e múltiplas duplicatas normalizadas. Escolher uma arbitrariamente criaria vínculo silencioso errado; o prompt bloqueia esse caso.
- Retry automático de PostgREST pode repetir o POST de uma RPC se a resposta se perder. O lock/status transacional da proposta segura o domínio, mas a UI precisa reconsultar antes de anunciar falha.
- AC8/AC9 pedem evidência de integração autorizada. Sem ambiente descartável e autorização humana, Forge pode concluir testes locais, mas não pode declarar a prova remota satisfeita.
- O worktree tem muitos arquivos untracked da 1.55; `git add .` misturaria stories e autoria.

## 6. Como medir

- Ação pós-upload envia somente `{ document_version_id }`, retoma job após F5 e não duplica invocação por duplo clique.
- Formulário aceita apenas fornecedor/totais/parcelas válidos em centavos; resumo preserva edições e os dois avisos literais aparecem nos estados exigidos.
- Uma confirmação chama `apply_nfe_purchase_proposal` com `{ p_proposal_id }`; segunda tentativa/resposta perdida é resolvida por status, sem escrita direta no domínio.
- Testes negativos provam zero item/produto/estoque, zero `supplierId` livre e zero acesso/RPC cross-tenant.
- Os cinco testes focados passam, a matriz AC1–AC13 não deixa rejeição sem caso próprio, lint focado fica 0/0 e os quatro gates não pioram contra o baseline medido pelo executor.
- O diff fica restrito aos caminhos autorizados e às seções do `@dev` na Story 1.56.
