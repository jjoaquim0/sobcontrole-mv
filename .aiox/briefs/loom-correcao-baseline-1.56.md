# Brief — corrigir o baseline desatualizado da Story 1.56

**De:** Orion (`@aiox-master`) · **Para:** Loom (`@sm`, River) · **Data:** 2026-08-24

---

## 1. Pedido do usuário, na íntegra

Linha de trabalho (2026-08-13):

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Método, exigido por ele e válido para todo brief:

> "ele quer prompts precisos para todos os agentes, explicando bem cada tarefa antes de delegar"

Sessão de 2026-08-22, literal:

> "pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

Hoje (2026-08-24) ele pediu apenas: *"continue a tarefa que estavamos fazendo"*.

## 2. Objetivo desta tarefa

A Story 1.56 é sua — você a escreveu em 2026-08-22. Ela está **travada em Draft** e não pode
ir para `Ready` até que um defeito de requisito seja corrigido. O defeito é seu por
autoridade: mexe em AC, em Task e na seção Testing, e ninguém além do `@sm` pode tocar nisso.

O Ledger (`@po`) validou hoje e devolveu **NO-GO**, registrado no Change Log da 1.56,
versão 0.1.2:

> "Validation NO-GO — AC13 está desatualizado: a Story 1.55 encerrou com 551 testes em
> 60 arquivos, mas a 1.56 ainda fixa 510 como baseline; corrigir AC13 e as referências de
> baseline antes de nova validação; permanece Draft"

Ele fez a coisa certa ao não corrigir sozinho. Agora é com você.

## 3. Estado verificado — desconfie e confira

- **`npm test` = 60 arquivos / 551 testes / 0 falhas.** Eu rodei este comando nesta sessão,
  em 2026-08-24, na branch `docs/importacao-inteligente-documentos`, com o código untracked da
  Story 1.55 presente na árvore. Saída literal do Vitest: `Test Files 60 passed (60)` /
  `Tests 551 passed (551)`, exit code 0. **Este número é meu, medido, não repassado — mas
  meça de novo mesmo assim antes de escrever, porque é ele que vai virar lei no AC.**
- **510 era o baseline anterior à Story 1.55**, quando a suíte tinha 58 arquivos. Consta assim
  no Dev Agent Record da 1.55. A 1.56 foi escrita no mesmo dia, antes da 1.55 fechar, e herdou
  o número velho.
- **Os outros três baselines do AC13 não mudaram e eu NÃO os remedi nesta sessão.** Última
  medição conhecida, do Dev Agent Record da 1.55: `npm run lint` = 276 erros / 2 warnings;
  `npm run typecheck` = 24 diagnósticos; `npm run build` = PASS. Se você quiser fixá-los no
  texto, **meça você mesmo antes** — não herde de mim um número que eu não medi hoje.
- **Story 1.55 = Done**, gate CONCERNS não bloqueante. A pré-condição do AC1 da 1.56 está
  satisfeita e **não é mais motivo de NO-GO**.
- Ninguém mais está editando `docs/stories/1.56...`. O Ledger terminou. O Quill está
  escrevendo um brief em `.aiox/briefs/`, e apenas **lê** a story.

## 4. Escopo do entregável

Uma correção cirúrgica em `docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md`:

1. **AC13** — substituir o baseline de testes desatualizado pelo vigente. O Ledger apontou
   também **Task 7** e a seção **Testing** repetindo o mesmo 510. Varra o arquivo inteiro:
   corrija **toda** ocorrência do baseline velho, não só a do AC13.
2. **Preserve a intenção original do AC13**, que continua correta e é decisão registrada do
   usuário: o gate duro é **0 falhas sobre o baseline**, e **não existe** número mínimo nem
   alvo artificial de testes novos. A cobertura é comportamental — cada rejeição descrita nos
   ACs precisa de ao menos um caso que prove aquela rejeição.
3. **Considere tornar o baseline recomponível em vez de literal.** O Ledger deixou essa porta
   aberta na recomendação dele. Um AC que diz "0 falhas sobre o baseline medido pelo `@dev`
   imediatamente antes de iniciar, registrado no Debug Log" não envelhece a cada story. Um
   número cravado envelhece — foi exatamente o que aconteceu aqui. **A escolha é sua**, mas
   me diga qual você tomou e por quê. Se cravar o número, crave o que você mediu hoje.
4. **Change Log** — acrescentar linha `0.1.3`, assinada `@sm (River)`, descrevendo a correção
   e citando o NO-GO 0.1.2 como origem.
5. **Não mexa no Status.** A story continua em `Draft`. A transição `Draft → Ready` é do
   `@po` e depende de nova validação dele.

## 5. Fronteiras duras

- Só o arquivo `docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md`.
- **Não toque** em `docs/stories/1.55...`, em `docs/qa/gates/`, em nenhuma seção QA Results,
  nem em nenhum arquivo de código. Gate e QA Results são exclusivos do `@qa`.
- Não altere os 12 primeiros ACs. O escopo funcional da 1.56 está fechado e validado; só o
  AC13 e as referências de baseline estão errados.
- **Não toque** em `.claude/launch.json` nem `vite.config.ts` — já estavam modificados antes
  desta linha de trabalho e não são nossos.
- **Nada de** `git push`, `gh pr`, migration, `supabase db push`, deploy ou CodeRabbit.
  CodeRabbit transmite código para fora e exige autorização do usuário por ocorrência.
- Não fale com outro agente. Devolva a mim.

## 6. Como medir se deu certo

Depois da sua edição, `rg -n '510' docs/stories/1.56.revisao-confirmacao-cabecalho-nfe.story.md`
não deve retornar nenhuma ocorrência que se refira a baseline de testes. Rode isso e me
mostre a saída.

## 7. Desconfie de mim

Os números da seção 3 estão marcados um a um como medidos por mim ou herdados. Confira os dois
tipos. Se algo não bater, me avise **antes** de editar — prefiro corrigir a fonte a cravar um
erro meu dentro de um AC que vai virar gate.

## 8. Se travar

Escale para mim com o ponto exato. Não invente número para destravar o fluxo.
