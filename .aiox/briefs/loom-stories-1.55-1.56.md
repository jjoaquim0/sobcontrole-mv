# Brief — Loom escrever as stories 1.55 e 1.56 do piloto de NF-e XML

## 1. Objetivo

Produzir duas stories Draft, verificáveis e sem reabrir decisões já tomadas, para entregar o piloto de importação de cabeçalho de NF-e XML em duas etapas: proposta determinística e revisão/confirmação humana.

## 2. Destinatário sugerido

**Loom (`@sm`)**, porque criação de stories a partir de epic e artefatos aprovados é autoridade exclusiva do Scrum Master; a validação posterior e a transição `Draft → Ready` pertencem ao Ledger (`@po`).

## 3. O prompt

````text
Você é Loom (`@sm`). Reporte o resultado somente a Orion (`@aiox-master`).

PEDIDO ORIGINAL DO USUÁRIO, NA ÍNTEGRA

Pedido de 2026-08-13:
"preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Esclarecimento de 2026-08-13:
"foto nao, e pdf eu pensei em primeiro ser convertido pra markdown ou html, pra sair mais barato pra ia ler. Geralmente vai jogar nfe, xml, pdf,"

Pedido de 2026-08-22:
"pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

DECISÃO MAIS RECENTE DO USUÁRIO — VENCE O ESCOPO ANTERIOR

Hoje será entregue um piloto de cabeçalho de NF-e XML: upload de um XML por vez; validação estrutural sem XSD; validação da chave por módulo 11; regra de direção; revisão editável de fornecedor, totais e parcelas; resumo; confirmação atômica criando ou vinculando fornecedor, criando compra e contas a pagar.

Itens, produtos e estoque NÃO fazem parte do piloto. O corte não é invenção: ele é o comportamento aprovado em `docs/ux/importacao-inteligente-documentos-fluxo-ux.md`, §3.6.5, linha 161, e no wireframe iniciado na linha 291. Ali, fornecedor, compra e contas a pagar continuam independentes dos itens, enquanto nenhum produto é criado ou vinculado sem revisão. Registre essa rastreabilidade nas duas stories.

OBJETIVO DESTA TAREFA

Crie exatamente estas duas stories:

1. `docs/stories/1.55.piloto-cabecalho-nfe-xml.story.md`
   - Título: `Story 1.55: Piloto determinístico de cabeçalho de NF-e XML`
   - Cobertura: backend/Edge Function `document-extraction`, parser NF-e 4.00 e gravação de proposta `pending`, sem UI e sem escrita no domínio.

2. `docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md`
   - Título: `Story 1.56: Revisão e confirmação do cabeçalho de NF-e`
   - Cobertura: acionamento após upload, acompanhamento da extração, revisão editável, aviso do corte, resumo e confirmação atômica pela RPC existente.

Ambas nascem com status `Draft`. Não crie outros arquivos.

LEITURA OBRIGATÓRIA ANTES DE ESCREVER

- `.aiox/briefs/quill-adendo-escopo-e-ids.md` — decisão mais recente de IDs e escopo; vence documentos anteriores onde houver conflito.
- `docs/epics/epic-importacao-inteligente-documentos.md` — Ondas 2 e 3 e seções 3, 4, 5 e 7; use os critérios falsificáveis como base, reduzindo somente o que a decisão do usuário retirou.
- `docs/architecture/ai-document-ingestion-p3.md` — D1 a D9, QA-1 a QA-4 e R1 a R10, em especial D1, D2, D3, D4, D5, D6 e D8.
- `docs/ux/importacao-inteligente-documentos-fluxo-ux.md` — §3.1 a §3.6, §4, §5, §8.1, §8.1b e §8.3; para este piloto, §3.6.5/linha 161 e o wireframe da linha 291 são vinculantes.
- `docs/data/document-import-proposals-schema.md` — contratos das três tabelas, payload de `nota_fiscal` e RPC `apply_nfe_purchase_proposal`; leia também a seção 10 sobre a divergência do histórico de migration.
- `supabase/migrations/20260814100000_document_import_proposals.sql` — contrato executável real, especialmente tabelas, grants e `apply_nfe_purchase_proposal`.
- `src/types/index.ts` — `AccountPayable.supplierId` obrigatório na linha 341 e `PaymentMethod` na linha 5.
- `.claude/rules/story-lifecycle.md` e `.claude/rules/agent-authority.md` — donos de seções e transições.
- `docs/stories/1.35.crud-etapas-pipeline.story.md` e `docs/stories/1.36.reordenacao-etapas-pipeline.story.md` — formato vivo; não copie escopo de Pipeline.

Antes de escrever, reconfirme que `1.55` e `1.56` não existem em `docs/stories/` e que a faixa `1.37–1.54` permanece reservada no epic de Pipeline. Se houver divergência, pare e reporte a Orion.

CONTRATO OBRIGATÓRIO DA STORY 1.55

Os ACs devem preservar, em forma falsificável, estes comportamentos:

1. A Edge Function recebe por POST somente `{ document_version_id: string }`; rejeita arrays, campos extras e qualquer `company_id`, `storage_path`, categoria ou XML bruto enviado pelo cliente. Um request representa exatamente um XML.
2. A função autentica o JWT, resolve perfil/empresa e lê `document_versions`, `documents`, empresa e Storage com cliente escopado ao JWT/RLS. `company_id` vem exclusivamente desse contexto, nunca do body, URL ou metadado controlável pelo cliente.
3. Só depois dessa autorização pode existir gravação privilegiada com cliente separado de `service_role`. Teste negativo: usuário da empresa A informando `document_version_id` da empresa B recebe não-encontrado/negado e não cria job, proposta ou qualquer outro registro.
4. O documento precisa ter categoria `nota_fiscal` e MIME `text/xml` ou `application/xml`. O parser aceita `NFe` ou `nfeProc/NFe`, namespaces default ou prefixados, exige `infNFe@versao="4.00"`, modelo `55` e os campos obrigatórios do piloto. XML malformado, ambíguo, com `DOCTYPE`/`ENTITY`, versão/modelo incorretos ou números inválidos é rejeitado com erro público seguro.
5. O parser é XML genérico com mapeamento manual do leiaute NF-e 4.00. É proibido usar `djf-nfe`, `d-nfe` ou qualquer biblioteca de domínio NF-e; `fast-xml-parser` ou parser XML genérico puro equivalente é permitido. A versão escolhida é liberdade de implementação, mas deve ser fixada e o lockfile correspondente atualizado.
6. A chave vem exclusivamente de `infNFe/@Id` após remover o prefixo literal `NFe`; deve ter 44 dígitos e passar no módulo 11: pesos 2 a 9 da direita para a esquerda nos 43 primeiros dígitos; `dv = 11 - (soma % 11)`; resultado 10 ou 11 vira 0. A chave precisa ser coerente com o CNPJ do emitente e o modelo do XML. Dígito adulterado é rejeitado antes de existir proposta.
7. Regra de direção, com CNPJs normalizados: destinatário = empresa e emitente ≠ empresa segue como entrada; emitente = empresa e destinatário ≠ empresa rejeita com aviso explícito de NF-e de saída; nenhum CNPJ batendo rejeita por suspeita; ambos batendo também rejeita por ambiguidade/suspeita. Nenhum desses ramos chama IA.
8. Mapeamento mínimo da proposta `nota_fiscal`:
   - `idempotency_key` = chave de acesso de 44 dígitos;
   - `status` = `pending`, `text_origin` = `null`, `truncated` = `false`;
   - `supplier.document` ← `emit/CNPJ`; `supplier.name` ← `emit/xNome`; email e telefone apenas quando existirem;
   - `purchase.total_amount` ← `ICMSTot/vProd`; `discount` ← `vDesc` ou 0; `fee` ← soma de `vFrete`, `vSeg` e `vOutro`, ausentes como 0; `final_value` ← `vNF`; `payment_method` = `other` no piloto;
   - `purchase.installments` ← cada `cobr/dup`, com `vDup` e `dVenc` em ISO; ausência de `dup` gera lista vazia para a UI completar, não vencimento inventado;
   - `field_origins` marca os campos extraídos como `deterministic`.
9. A proposta válida cria zero linhas em `document_import_proposal_items`. O caminho não lê/mapeia `det`, não cria/vincula produto, não cria `purchase_items`, não atualiza estoque e não toca `suppliers`, `purchases` ou `account_payables`; domínio só será escrito na 1.56 após confirmação.
10. Job segue `queued → running → done` e a proposta nasce `pending`. Falhas usam `failed` com código/mensagem sanitizados, sem persistir/logar XML, CNPJ, chave completa, JWT, caminho de Storage ou stack trace. Duplicidade pela `UNIQUE (company_id, idempotency_key)` não cria segunda proposta.
11. A rota usa `EdgeRuntime.waitUntil` para o processamento de fundo e responde `202` com `{ job_id, status: 'queued' }`; testes usam handler com dependências injetáveis. Não desabilitar autenticação/JWT.
12. Zero chamada a modelo, provider, `ai-gateway`, `reserve_ai_usage`, `finalize_ai_usage` ou migration de quota. Se aparecer IA nesta rota, a implementação está errada.

Feche nos Dev Notes os contratos públicos sugeridos, salvo divergência técnica demonstrada na fonte:

- `validateNfeAccessKey(accessKey: string): boolean`
- `extractNfeHeader(xml: string, companyCnpj: string): NfeHeaderProposalInput`
- `createDocumentExtractionHandler(deps: DocumentExtractionDependencies): (request: Request) => Promise<Response>`

Arquivos permitidos/esperados para a 1.55: `supabase/functions/document-extraction/**`, `supabase/functions/_shared/document-import/**`, testes focados em `src/services/documentImportNfe.test.ts` e `src/services/documentExtractionSecurity.test.ts`, e manifests/lockfiles somente se o parser genérico exigir. Declare explicitamente que a organização interna dentro desses diretórios é liberdade do `@dev`, desde que as três assinaturas e os contratos acima permaneçam.

CONTRATO OBRIGATÓRIO DA STORY 1.56

Os ACs devem preservar, em forma falsificável, estes comportamentos:

1. Depende de 1.55 em `Done`. Reutiliza o upload imutável já existente: um XML por vez, categoria `nota_fiscal`, MIME aceito, sem rota de PDF.
2. A ação irmã “Importar com Gestly” aparece no pós-upload de uma NF-e XML, invoca `document-extraction` uma única vez e acompanha o job até `done`/`failed`, sem aceitar `company_id` do cliente.
3. A revisão edita somente fornecedor, totais e parcelas do `payload` da proposta `pending`. Campos mínimos: CNPJ e nome do fornecedor; `total_amount`, `discount`, `fee` e `final_value` não negativos; ao menos uma parcela com valor positivo e vencimento válido; soma das parcelas igual a `final_value` em centavos. Ausência de duplicatas no XML exige preenchimento humano — não invente vencimento.
4. O aviso permanece visível na revisão e no resumo, com texto inequívoco: **“Este piloto importa somente fornecedor, compra e contas a pagar. Itens, produtos e estoque não serão importados.”** No sucesso, usar o estado aprovado do wireframe: produtos não foram adicionados ao estoque e devem ser lançados manualmente.
5. Não renderizar tabela de itens, chips de confiança, decisão de custo, vínculo/criação de produto ou qualquer controle de estoque. Não consultar nem atualizar `document_import_proposal_items` no fluxo da UI.
6. A UI distingue fornecedor existente, localizado por CNPJ exato sob RLS, de fornecedor novo. `AccountPayable.supplierId` é obrigatório e deve ser satisfeito pelo fornecedor resolvido/criado dentro da RPC — nunca por input livre do cliente.
7. O botão de confirmação fica desabilitado enquanto houver campo obrigatório inválido ou divergência entre parcelas e total. Antes da escrita, exibir resumo separado com fornecedor, compra, total de contas a pagar e o aviso do corte.
8. Confirmar chama exatamente `apply_nfe_purchase_proposal(proposal_id)` com JWT do usuário. A RPC `SECURITY INVOKER` é a única escrita de domínio e executa tudo na mesma transação. Duplo clique/retry/F5 não duplica fornecedor, compra ou contas a pagar; a segunda chamada encontra proposta não `pending` e é tratada com segurança.
9. Prova de escopo: após confirmação, contagens de `products` e `purchase_items` permanecem inalteradas; nenhuma quantidade de estoque muda. Em contrapartida, fornecedor é criado ou vinculado, uma compra é criada e uma conta a pagar é criada por parcela.
10. Teste negativo cross-tenant: sessão A não lê/edita/aplica proposta B. `company_id` vem da sessão (`requireCompanyId()`/`useAuthStore`) e a RLS é a autoridade final.
11. Erros de saída, CNPJ suspeito, XML inválido, chave inválida, duplicidade e falha de gravação têm mensagens explícitas. Em falha atômica, a UI informa que nada foi gravado e mantém o documento original salvo.
12. Acessibilidade e tema: labels, foco visível, teclado, `aria-live` nas transições, contraste e classes `dark:`; nenhuma informação depende apenas de cor.

Arquivos permitidos/esperados para a 1.56: serviço/hook de importação em `src/services/` e `src/hooks/`, componentes irmãos em `src/pages/documents/components/`, integração mínima no fluxo de upload/documentos e testes adjacentes. Não toque `AiSiteIntegrationAction`; ele continua sendo outro produto.

FORA DE ESCOPO — REPITA EM AMBAS AS STORIES

- PDF, foto, OCR, imagem, markdown/HTML e qualquer chamada a IA.
- XSD, assinatura digital e consulta SEFAZ.
- Itens da NF-e, `det/prod`, impostos por item, produtos, vínculo de produto, `purchase_items`, custo item a item e estoque.
- Chips/scores de confiança, revisão de 5–30 itens e definição de teto numérico de itens.
- Boleto, contrato, extrato bancário e NF-e de saída.
- Alterar `ai-gateway`, quota, `reserve_ai_usage` ou aplicar `20260814101500_ai_usage_feature_dimension.sql`.
- Criar/alterar migration, rollback, tabela, policy, grant, RPC ou tipo de domínio existente.

ESTADO DO BANCO E PROIBIÇÃO DE DB PUSH

Ponto de partida reverificado em 2026-08-22: migration remota registrada como `20260822182249_document_import_proposals`; as três tabelas existem, estão vazias e com RLS 3/3; `text_origin` e `UNIQUE (company_id, idempotency_key)` existem. O executor deve reverificar, não confiar neste texto.

O arquivo local continua `20260814100000_document_import_proposals.sql`. Portanto, **`supabase db push` está proibido** até a divergência de histórico ser reconciliada. `migration repair`, alteração direta de `schema_migrations`, renome de migration ou qualquer outra reconciliação é mutação externa e exige autorização específica do usuário. Nenhuma das duas stories resolve isso.

BASELINE NUMÉRICA — QUATRO GATES DISTINTOS

Medição em `3c13648`, branch `docs/importacao-inteligente-documentos`, com mudanças alheias já presentes no worktree:

- `npm run lint`: 276 erros e 2 warnings; exit 1. Gate de não-regressão: não subir nenhum dos dois números; arquivos novos/tocados devem ter 0 erro e 0 warning no lint focado.
- `npm run typecheck`: 24 diagnósticos TypeScript; exit 1. Gate de não-regressão: não subir de 24 e nenhum diagnóstico novo pode apontar para arquivos da story. `EPERM` ao gravar `.tsbuildinfo` é limitação de sandbox, não erro TypeScript; registre separadamente e repita em ambiente com permissão.
- `npm test`: 58 arquivos, 510 testes passando, 0 falhando. Gate duro: 0 falhas; a 1.55 deve adicionar ao menos 24 casos focados (alvo mínimo 534 passando) e a 1.56 deve declarar seus próprios testes adicionais sem reduzir o total.
- `npm run build`: PASS. Gate duro: continua PASS; warning existente de chunk maior que 500 kB não é falha.

Mande o executor reverificar os quatro comandos antes e depois. Números de Orion/Quill são ponto de partida, não verdade estabelecida. Não misture lint, typecheck, test e build.

AUTORIDADE, STATUS E FRONTEIRAS

- Você cria as duas stories em `Draft` e registra isso no Change Log.
- Ledger (`@po`) valida; somente ele pode corrigir título/descrição/AC/escopo após o draft e, em GO, mudar `Draft → Ready` e registrar a transição.
- Forge (`@dev`) muda `Ready → InProgress` ao começar e `InProgress → InReview` ao concluir; só edita checkboxes, Dev Agent Record, File List e Change Log, não título/descrição/AC/escopo.
- Beacon (`@qa`) é dono exclusivo do gate e de QA Results; PASS/CONCERNS/WAIVED muda `InReview → Done`, FAIL muda `InReview → InProgress`.
- Nenhum agente aplica migration, executa `supabase db push`, deploya Edge Function, faz push, abre PR ou envia código a serviço externo sem autorização específica do usuário por ocorrência.
- CodeRabbit transmite código: não executar sem autorização específica.
- Proibido `git stash` + `git stash pop` para baseline. Se comparação histórica for indispensável, usar `git worktree add --detach <commit>` em diretório separado, preservando o worktree sujo.
- Não editar epic, ADR, UX, schema, gate ou QA Results. Não corrigir dívida global de lint/typecheck no meio destas stories.

FORMATO E QUALIDADE DAS STORIES

Use o formato vivo: Status, Executor Assignment, Story, Acceptance Criteria, CodeRabbit Integration (registrando a restrição externa), Tasks/Subtasks, Dev Notes, Testing, Change Log, Dev Agent Record, File List e QA Results reservado ao `@qa`.

Cada AC deve apontar seu comando/teste de verificação e rastrear para a decisão do usuário, D*/QA*/R* ou UX §3.6.5. Não enfraqueça critérios falsificáveis em prosa vaga. Separe explicitamente comportamento do parser, segurança/RLS, persistência de proposta, UI, atomicidade e não-regressão.

Se qualquer contrato acima divergir do código ou do banco, não invente uma conciliação: pare e reporte caminho, linha/saída e impacto a Orion.

ENTREGA

Devolva a Orion somente:
- caminhos das duas stories criadas;
- status `Draft` de cada uma;
- divergências encontradas;
- confirmação de que nenhum outro arquivo foi alterado.
````

## 4. Decisões de design

- IDs fechados em `1.55/1.56`; a faixa planejada `1.37–1.54` do epic de Pipeline permanece intacta.
- O piloto usa o estado degradado aprovado no UX §3.6.5: cabeçalho e passivo financeiro seguem; automação de itens/estoque é cortada por inteiro.
- Story 1.55 termina em proposta `pending` com zero itens; Story 1.56 completa o valor ao usuário pela RPC atômica existente.
- A validação estrutural do piloto é manual e determinística, sem XSD; XSD volta apenas em escopo futuro autorizado.
- Baselines globais quebrados viram gates de não-regressão, com lint focado limpo nos arquivos novos.
- A mudança recente da Supabase sobre exposição de tabelas não exige DDL aqui: as tabelas já têm grants explícitos e RLS; qualquer correção de exposição continua fora das stories.

## 5. Riscos

- O epic ainda descreve Ondas 2/3 completas; sem a nota explícita de supersessão, Loom pode reintroduzir itens, confiança e estoque.
- O DDL contém caminho de produtos quando existem linhas de item; por isso o contrato de zero linhas em `document_import_proposal_items` precisa de teste positivo e negativo.
- O `service_role` ignora RLS. Se a autorização pelo cliente JWT ocorrer depois da escrita privilegiada, o teste cross-tenant pode passar superficialmente e ainda deixar uma vulnerabilidade.
- O mapeamento de totais fiscais para o domínio não possui XSD nem schema JSON formal; os caminhos e defaults foram fechados no prompt para impedir escolhas divergentes entre parser e UI.
- A divergência `20260814100000` local × `20260822182249` remota torna qualquer `supabase db push` perigoso até reconciliação autorizada.

## 6. Como medir

- Existem exatamente os dois arquivos de story nomeados, ambos em `Draft`, e nenhum outro arquivo foi alterado por Loom.
- Cada story contém ACs falsificáveis, baseline e alvo separados para lint, typecheck, test e build.
- A Story 1.55 prova proposta `pending`, zero IA, zero itens e rejeições de chave/direção/cross-tenant.
- A Story 1.56 prova aviso do corte, revisão humana, escrita atômica e contagens de produtos/estoque inalteradas.
- As transições e os donos de story, implementação e QA estão explícitos.
