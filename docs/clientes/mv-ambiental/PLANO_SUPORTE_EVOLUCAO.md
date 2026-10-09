# Plano de suporte e evolução — Piloto MV Ambiental

**Versão:** 0.1 — 09/10/2026
**Referência:** Fase 5 do `ROADMAP_MVP_MV_AMBIENTAL.md` (semanas 11–12) e Story 1.66.

## 1. Operação assistida (semanas 11–12)

| Quando | O quê | Onde no sistema |
|---|---|---|
| Dia 1 | Salvar a **linha de base** do período anterior ao piloto e contar, com a equipe, as etapas que ainda dependem de planilha ou cobrança informal | `/piloto` → Salvar medição |
| Diário | Começar o dia pelo painel: atrasos, vagas descobertas, documentos e obrigações | `/painel-operacional` |
| Diário | Registrar ocorrências e reposições como demandas, sempre com responsável e prazo | `/demandas` |
| Semanal | Medição de **acompanhamento** e conversa de 30 min sobre o que piorou | `/piloto` |
| Mensal | Abrir a competência, conferir os itens e registrar o envio do pacote | `/obrigacoes` |
| Fim do piloto | Medição **final** com a decisão da direção (ampliar, ajustar ou pausar) e os motivos | `/piloto` |

Treinamento: usar os painéis "Como usar esta tela" de cada tela como roteiro. Ao concluir, confirmar o
critério 5 em `/piloto` com data e participantes. Testar o acesso com um usuário de cada papel e
confirmar o critério 4.

## 2. Suporte

| Tipo | Canal | Responsável | Resposta |
|---|---|---|---|
| Dúvida de uso | Demanda do tipo "Ausência / ocorrência de campo" com título iniciado por "Suporte:" ou canal combinado com a Mart RH | Mart RH (primeiro nível) | Mesmo dia útil |
| Erro no sistema | Mensagem à equipe técnica com tela, horário e o que foi feito | João / equipe técnica | Avaliação em até 1 dia útil |
| Dado errado cadastrado | Corrigir pela própria tela; se não houver como, abrir chamado à equipe técnica | Gestor da área | — |
| Pedido de mudança | Registrar como sugestão; entra na revisão semanal | Mart RH + direção | Revisão semanal |

Regras:

- Nada é corrigido direto no banco. Toda correção passa pelas telas (que mantêm o histórico) ou por
  migração revisada aplicada somente no projeto sobcontrole-mv.
- Acesso a dados pessoais segue o papel do usuário; pedidos de acesso novo passam pela direção.

## 3. Critérios para a decisão (roadmap §11)

A tela `/piloto` mostra os 7 critérios. A direção decide com base em:

- **Ampliar:** critérios 1 a 6 atendidos e indicadores iguais ou melhores que a linha de base.
- **Ajustar:** algum critério pendente ou indicador pior, com causa conhecida e correção possível.
- **Pausar:** fluxo não adotado pela equipe ou dependência externa que impede o uso.

As metas numéricas são definidas só depois da linha de base, sem inventar valores antes.

## 4. Evolução após o piloto (backlog priorizado)

| Prioridade | Item | Motivo |
|---|---|---|
| P1 | Lembretes e escalonamento automático de prazos (e-mail ou WhatsApp) | Reduz atrasos depois que os donos estão definidos |
| P1 | Integração simples com o recrutamento | Evita redigitação na reposição |
| P1 | Atalhos para Drive e relatórios exportáveis (pacote mensal em PDF/planilha) | Reduz fricção com o cliente |
| P1 | Segundo contrato (Luziânia), depois da vigência conferida | Ampliação natural se a decisão for ampliar |
| P2 | Transmissão ao eSocial | Alto esforço; depende de fornecedor e validação técnica |
| P2 | Resultado financeiro por contrato | Depende da classificação confiável dos custos |

Cada item vira uma story nova antes de ser implementado.
