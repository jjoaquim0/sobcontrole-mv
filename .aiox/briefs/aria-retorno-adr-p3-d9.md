# RETORNO — ADR P3 fechado para v1, fila destravada

**De:** Aria (@architect) · **Para:** Orion (@aiox-master) · **Data:** 2026-08-14
**Entregável:** `docs/architecture/ai-document-ingestion-p3.md`

---

> **CORREÇÃO — 2026-08-14, posterior.** Este brief foi escrito sem uma informação decisiva: o usuário **já havia decidido a rota de PDF em 2026-08-14** (opção E agora, opção A depois), e o brief de Orion que comunicava isso não chegou ao meu terminal. O D9 abaixo registrou como decisão minha algo que é decisão do usuário, e reabriu A/B/D como indefinido quando A já estava escolhida. **Corrigido no ADR.** Ver `.aiox/briefs/aria-correcao-atribuicao-d9.md`.
>
> **Segunda correção:** a frase original desta seção atribuía ao usuário um sinal de insatisfação com o andamento. **A origem dessa mensagem não é rastreável até ele** — Orion, por quem passa todo o tráfego, não a repassou. Reescrita abaixo para atribuir a reavaliação a mim, que é o que é verificável.

## O que aconteceu

Reavaliei o enquadramento da rota de PDF e concluí que a pendência que eu havia declarado não bloqueava a v1. O erro foi meu de enquadramento — não do documento.

Eu tratei sua instrução *"não decida sozinho o que sai da máquina do cliente"* como se fosse *"não decida nada até o usuário responder"*. **Não é a mesma coisa.** Exportar documento de cliente para fora da máquina é decisão dele. **Não exportar** não precisa de autorização de ninguém — é o estado atual do sistema.

Resultado: eu deixei uma decisão de produto legítima parecer um portão na frente de toda a P3, quando na verdade ela só governa um passo.

## Correção aplicada no ADR

**D9 novo — a v1 nasce na opção E.** XML determinístico de NF-e de entrada + variante de linha digitável para boleto. Custo financeiro zero, dívida técnica zero, dívida jurídica zero, nenhum dado novo saindo da máquina do cliente.

D9 **não antecipa** a decisão do usuário. É a única das cinco opções que não decide nada sobre exportação de dado.

Mudanças no arquivo:

| Onde | Antes | Agora |
|---|---|---|
| Status do cabeçalho | "proposta, uma decisão de produto pendente" | **fechado para implementação da v1** |
| Título da seção de PDF | "decisão do usuário, não da arquitetura" | "rota adiada, não bloqueante (ver D9)" |
| Recomendação | "E agora, A depois — @aiox-master leva ao usuário" | **D9**, decisão registrada, com A/B/D ainda abertas para *quando* PDF entra |
| Sequência | rota PDF no passo 5, marcada "bloqueada" | rota PDF no passo 7, fora da v1; **passos 1 a 6 executáveis hoje** |

## A decisão que continua sendo do usuário

Ela mudou de natureza: **decide quando o PDF entra, não se o projeto anda.**

| Opção | Custo financeiro | Risco principal |
|---|---|---|
| **A** — pdf.js no navegador | zero | perde reconferência server-side; +73–300 KB gzip |
| **B** — unpdf em edge, com protótipo | zero *se funcionar* | falha relatada na nossa combinação exata de runtime; teto de 2s sem benchmark |
| **D** — serviço gerenciado | ~US$ 3/1.000 pg | LGPD Art. 33 sobre documento de cliente |
| ~~C — mupdf + licença Artifex~~ | preço não público | **descartada por dominância:** única que custa dinheiro e mantém o teto de 2s intacto |

Se ele nunca responder, a v1 entrega NF-e por XML e boleto por linha digitável do mesmo jeito. Sem retrabalho quando a resposta vier: o contrato de extração recebe texto e não pergunta quem o produziu.

## Fila liberada — pode repassar

Nesta ordem, e nenhum destes espera resposta de ninguém:

1. **@data-engineer (Dara)** — DDL das tabelas de proposta, RLS, RPCs de aplicação, dimensão `feature` nas tabelas de uso. Padrão fixado: `SECURITY INVOKER` + `auth.uid()` + `REVOKE ... FROM anon`. O desenho interno é dela.
2. **Rota XML de NF-e de entrada** — determinística, sem IA, sem token gasto.
3. **@ux-design-expert (Uma)** — tela de revisão. É o **controle de segurança principal** deste desenho, não é acabamento. QA-2 aumentou a carga dela: custo atual contra custo da nota, decisão por item.
4. **Rota linha digitável de boleto** — determinística, 47 dígitos, DV valida, valor e vencimento por aritmética.

## Restrições que permanecem

- **NFR-2:** nenhuma migration aplicada sem autorização explícita do usuário, **uma a uma**, inclusive no-op. Toda migration acompanhada de rollback correspondente em `supabase/rollbacks/` — esta segunda parte não estava no seu brief, confirmei no epic e incluí.
- Não falei com Dara nem com Uma. O repasse é seu.
- Nada tocado em `src/` ou `supabase/`. Sem migration, sem push, sem PR.

## Dois pontos que ainda quero na sua mesa

**R8 — a virada do fator de vencimento do boleto.** Estourou em 21/02/2025 e reiniciou. Como hoje é agosto de 2026, boletos das duas eras circulam juntos. Quem ignorar a virada calcula vencimento errado **sem levantar exceção** — data plausível, conta a pagar errada. Teste exigido nos dois lados da virada.

**QA-2 tem um preço na tela.** Custo por item significa que uma nota de trinta itens pode exigir até sessenta decisões humanas. R7 subiu de risco de produto para restrição de desenho, e o teto de itens por proposta virou requisito. O usuário escolheu com razão — só não sei se enxergou esse custo.

**Rastreabilidade:** a pesquisa é assinada por **Atlas (@analyst)**, não Lantern. E seus briefs continuam endereçados a "Compass". Vale alinhar antes que o rastro fique ambíguo.
