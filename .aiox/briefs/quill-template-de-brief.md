# BRIEF — Padronizar os briefs de delegação do canvas

**De:** Orion (@aiox-master) · **Para:** Quill (@prompt-engineer)
**Natureza:** engenharia de prompt. Entregável é um template + checklist, não código.

---

## O pedido original do usuário

Pedido inicial, nas palavras dele:

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Depois, ao receber de volta um brief truncado que chegou à Uma (@ux-design-expert), ele mandou o seguinte feedback, que é o que motiva **esta** tarefa:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar. Por favor, ao montar briefs para os agentes, inclua sempre: (1) o pedido original completo do usuario, (2) o objetivo/contexto da tarefa, (3) escopo esperado do entregavel"

## Objetivo e contexto

Estou orquestrando a importação inteligente de documentos (upload → IA extrai → humano confirma → sistema grava). Deleguei em paralelo para Compass (arquitetura), Lantern (pesquisa) e Prism (UX).

**O que deu errado:** `maestri ask` truncou os prompts em silêncio. O mesmo brief de ~2.900 caracteres chegou íntegro ao Lantern, parcial ao Compass e reduzido a **uma palavra** ao Prism. Exit code 0, nenhum aviso. A Uma abriu um menu perguntando "que fluxo de cliente?" porque foi só isso que restou.

Eu já apliquei duas correções:
1. Brief longo agora vai em **arquivo** (`.aiox/briefs/<agente>-<assunto>.md`); o `maestri ask` leva só o ponteiro.
2. Registrei a armadilha na seção 8 do `docs/agents/orchestrator-charter.md`.

**O que falta e é seu:** o usuário quer qualidade de brief padronizada, não só transporte consertado. Transporte era meu problema; **precisão é o seu domínio.**

## Escopo do entregável

Um documento em `docs/agents/` — sugiro `brief-template.md`, mas o nome é seu se tiver argumento melhor. Deve conter:

1. **Template de brief de delegação**, pronto para copiar, com as três exigências do usuário como seções obrigatórias: (1) pedido original completo do usuário, (2) objetivo/contexto, (3) escopo do entregável.

2. **Incorpore o que já funciona.** A seção 11 do `docs/agents/orchestrator-charter.md` lista 10 atributos de um bom brief, extraídos do que acertou de primeira neste projeto. Leia, avalie criticamente e integre — não duplique, e **me diga se algum dos 10 está errado ou é supérfluo.**

3. **Checklist de verificação pré-envio** — o que eu confiro antes de mandar, incluindo confirmar recepção com `maestri check` depois de enviar.

4. **Variação por tipo de agente.** Um brief para o @dev (contratos exatos, fronteiras de arquivo, baselines numéricos) não tem a mesma forma que um para o @analyst (perguntas abertas, exigência de fonte) ou para o @qa (independência de veredito). Proponha as variações que valem a pena.

5. **Antipadrões** — o que faz o agente errar. Você tem material real: os briefs desta sessão estão em `.aiox/briefs/` (`compass-addendum-importacao-documentos.md`, `prism-ux-importacao-documentos.md`). **Critique os meus.** É pedido sério, não cortesia: quero saber onde eu fui vago, prolixo ou ambíguo.

## Fronteiras duras

- Não escreva código. Não edite `src/` nem `supabase/functions/`.
- Sem `git push`, sem PR, sem migration.
- Pode ler qualquer arquivo do repo e rodar comandos de leitura.
- Não fale com outros agentes — todo tráfego passa por mim.
- Artigo IV — No Invention: o que o usuário não pediu vai em seção "Recomendações", separado.

## Verificação

Confirme tudo por conta própria — inclusive minhas afirmações sobre o truncamento e sobre o conteúdo do charter. **Não aceite de mim.** Se você concluir que a causa do fragmento não foi o transporte e sim a redação do brief, quero saber: seria um diagnóstico meu errado, e prefiro corrigi-lo agora.

Ao terminar, me diga o caminho do arquivo.
