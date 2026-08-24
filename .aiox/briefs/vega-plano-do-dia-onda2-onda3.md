# Brief — plano do dia, Ondas 2 e 3 (revisão do coorquestrador)

**De:** Orion (`@aiox-master`) · **Para:** Vega (coorquestrador Maestri) · **Data:** 2026-08-22

---

## 1. Pedido do usuário, na íntegra

Linha de trabalho (2026-08-13):

> "preciso da criacao da minha importacao de documentos, cliente joga um documento tipo um pdf, minha ia gestly le os dados, pergunta se pode integrar ao sistema, e se sim integra ao sistema, quero isso funcionando, use o time, o maestri, os agentes aiox e etc"

Desta sessão (2026-08-22), literal:

> "pode continuar tudo ai, so quero lembrar de usar o engenheiro de prompt e o coorquestrador, quero essa funcionalidade funcionando hoje"

Ele te nomeou explicitamente. Não é cerimônia: quero a sua leitura operacional, não concordância.

## 2. Objetivo desta tarefa

Você **revisa o plano abaixo e aponta o que está errado nele**. Não delegue a ninguém, não escreva código, não fale com outro agente — o tráfego passa por mim, como sempre. Devolva análise a mim.

## 3. Estado verificado por mim nesta sessão

- Design fechado e commitado: ADR, pesquisa, UX, epic, DDL. **Nenhuma linha de código de runtime existe.**
- Banco remoto: as migrations da importação **não estavam aplicadas** (última aplicada `20260805232055`). O usuário autorizou hoje **só** a `20260814100000`; a `20260814101500` fica para a Onda 6.
- O gap de design "revisão de itens em volume" que o epic (seções 7 e 12) registrava como **bloqueante para a Onda 3** está **fechado**: Prism entregou `§3.6` e wireframe `§8.1b` no documento de UX. Confirmei os cabeçalhos.
- Próximas stories livres: `1.37` (Onda 2) e `1.38` (Onda 3).
- Todos os agentes ociosos ao início desta sessão; árvore limpa exceto `.claude/launch.json` e `vite.config.ts`, que não são desta linha de trabalho e ficam intocados.

## 4. O plano que quero que você critique

Pela seção 4 do epic, o loop que o usuário descreveu só vira realidade **no fim da Onda 3**. Logo, "hoje" = Ondas 2 **e** 3.

**Em paralelo agora:**
- Cistern aplica a `20260814100000` e me devolve verificação item a item
- Quill escreve os briefs de Loom (stories 1.37/1.38) e Forge (implementação da 1.37)

**Depois, em sequência:**
1. Loom (`@sm`) escreve 1.37 e 1.38 a partir do epic
2. Ledger (`@po`) valida → GO → transição Draft→Ready (dele, não minha)
3. Forge (`@dev`) implementa a 1.37 — parser XML determinístico, sem IA
4. Beacon (`@qa`) gate da 1.37
5. Forge implementa a 1.38 (UI de revisão)
6. Beacon gate da 1.38
7. Anchor publica **só** com autorização nova do usuário

## 5. O que eu quero que você me devolva

Análise em cima destes pontos concretos:

1. **O caminho crítico está certo?** Onde eu serializei o que dava para paralelizar, e onde eu paralelizei o que vai colidir em arquivo?
2. **"Hoje" é alcançável?** A Onda 3 é a peça mais densa do epic (tamanho relativo **G**: split view, chips de confiança por campo, decisão de custo item a item, resumo pré-gravação, atomicidade da escrita). Me diga com franqueza se cabe, e **qual é o corte honesto** se não couber — o que entregar hoje que ainda seja verdade para o usuário, em vez de um "pronto" que não fecha o loop.
3. **Onde este plano quebra** se um agente falhar no meio — qual o ponto de retomada de cada etapa.
4. **Risco R7 (fadiga de revisão)** do epic: a decisão do usuário de perguntar custo item a item pode gerar até 60 decisões humanas numa NF-e de 30 itens. O `§3.6` da Prism resolve no papel. Na sua leitura, isso vira problema de execução na 1.38?
5. **O que eu não vi.**

## 6. Fronteiras — suas e minhas

- **Você não autoriza migration, push, PR nem envio externo.** Isso vem do usuário, uma autorização por ocorrência. Está registrado na nota de retomada porque já gerou confusão.
- Você não fala com Forge, Beacon, Loom, Ledger, Cistern, Prism ou Anchor. Propõe a mim; eu despacho.
- Gate e QA Results são exclusivos do Beacon (`@qa`). Título/AC/escopo de story são do Ledger (`@po`).

## 7. Desconfie de mim

Tudo na seção 3 eu verifiquei nesta sessão, mas **não aceite de mim** — confira o que for sustentar a sua análise. Se o seu resultado divergir do meu, o seu vale; me avise. Discordância aberta é mais barata agora do que retrabalho depois.
