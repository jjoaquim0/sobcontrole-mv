# BRIEF DE UX — Importação Inteligente de Documentos

**De:** Orion (@aiox-master) · **Para:** Prism (@ux-design-expert)
**Natureza:** design de fluxo. **Não é implementação.**

---

## Aviso: descarte o fragmento anterior

Meu brief anterior chegou ao seu terminal truncado — você recebeu praticamente só a palavra "cliente" e abriu um menu perguntando se era cadastro, listagem ou vínculo com pipeline. **Nenhuma das três.** Foi falha de envio minha, não ambiguidade sua. Este arquivo é o brief íntegro. Cancele aquele menu.

---

## O pedido do usuário, nas palavras dele

> "cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema"

Aqui "cliente" = **o usuário do Gestly subindo um arquivo**. Não é a entidade Cliente do CRM.

O coração disso é a sua parte: **a tela onde a IA mostra o que entendeu e o humano aprova ou corrige.** Se essa tela for ruim, o usuário aprova dado errado e suja a base dele. Trate como fluxo de alto risco, não como um modal bonito.

## Contexto verificado por mim (confirme por conta própria, não aceite de mim)

- Módulo Documentos já existe: `src/pages/documents/` — `DocumentsPage.tsx`, `DocumentUploadModal.tsx`, `DocumentPreviewModal.tsx`, `DocumentFilters.tsx`, `CategoryIcon.tsx`
- `src/pages/documents/components/AiSiteIntegrationAction.tsx` é **placeholder**: o clique só dispara um toast *"Esta integração estará disponível em breve"*. Tem variante `compact` e variante card. Usa ícone `Bot` do lucide-react, cor de destaque `#10b981`, badge "Em breve".
- Upload real já funciona: `documentService.ts:308` sobe para bucket do Supabase com versionamento.
- Formatos aceitos hoje (`documentDomain.ts`): pdf, png, jpg, csv, xlsx, xls, doc, docx, xml. Teto de 10 MB.
- Tema claro e escuro no projeto (classes `dark:`). O fluxo tem que funcionar nos dois.
- Stack: React 18, Tailwind, framer-motion, sonner (toast), lucide-react, react-hook-form + zod.
- Já existe página da IA: `src/pages/gestly/GestlyPage.tsx` — a "IA Gestly" que o usuário citou.

## Restrição técnica já decidida

Sem foto, sem PDF escaneado, **sem OCR**. O usuário disse "foto nao". Não desenhe estados de "melhorar a foto" ou "reenquadrar".

## Tipos de documento no escopo (todos os quatro)

| Documento | Vira o quê no sistema |
|---|---|
| Nota fiscal NF-e / DANFE | fornecedor + compra + contas a pagar + produtos no estoque |
| Boleto | conta a pagar |
| Extrato bancário | **muitos** lançamentos financeiros de uma vez |
| Contrato / proposta | cliente + oportunidade no pipeline |

---

## O que eu preciso de você

1. **Fluxo completo em estados:** upload → processando → revisão/confirmação → gravando → resultado. Descreva cada estado, as transições e o **caminho de erro** de cada um.

2. **Tela de revisão — a mais importante.** Responda com decisão, não com opções soltas:
   - Como mostrar lado a lado o que a IA extraiu **e de onde veio no documento**?
   - O usuário pode **editar** um campo antes de confirmar? Minha hipótese: sim, obrigatoriamente. Me contrarie se achar errado.
   - Como sinalizar **confiança por campo** (ex: a IA não teve certeza do CNPJ)?
   - **Extrato com 80 linhas:** confirmar uma a uma é inviável. Proponha a solução.
   - Como deixar claro o que será **criado** × o que será **vinculado** a registro existente (ex: fornecedor já cadastrado)?

3. **Prevenção de erro:** valor financeiro errado aprovado por engano é o pior resultado possível. Que padrões de interface reduzem isso? O que merece atrito deliberado?

4. **Duplicidade:** o usuário sobe a mesma nota duas vezes. Como a interface avisa?

5. **Acessibilidade:** teclado, leitor de tela, contraste, foco. O projeto já cuida de `aria-label` — veja o placeholder como referência do padrão adotado.

6. **Destino do placeholder:** `AiSiteIntegrationAction` diz *"Integrar ao site com IA"* — alimentar a IA do site do cliente. O que o usuário quer agora é diferente: **integrar o documento AO SISTEMA**. Diga se esse componente deve ser reaproveitado, renomeado, ou se são dois recursos que convivem. **Quero sua recomendação, não um leque.**

## Fronteiras duras

- **Não escreva código de implementação. Não edite nada em `src/`.**
- Sem `git push`, sem PR, sem migration.
- Pode ler qualquer arquivo do repo e rodar comandos de leitura.
- Entregável: **um** documento em `docs/ux/` (crie a pasta se não existir). Wireframe em ASCII/markdown é bem-vindo. Sem imagem.
- Artigo IV — No Invention: o que o usuário não pediu vai em seção "Recomendações", separado dos requisitos.
- Ao terminar, me diga o caminho do arquivo. **Não fale com outros agentes** — todo tráfego passa por mim.
- Continue me desconfiando: confirme o contexto por conta própria.

## Trabalho paralelo (não é seu, só para você não duplicar)

- **Compass** está fechando o ADR de arquitetura (rota de extração, contrato de dados).
- **Lantern** está levantando libs de PDF→markdown e o layout da NF-e.

Você não depende deles. O fluxo de confirmação é independente de como o PDF vira texto.
