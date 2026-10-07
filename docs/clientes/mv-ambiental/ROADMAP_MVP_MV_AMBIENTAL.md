# Roadmap do MVP para a MV Ambiental

**Versão:** 0.1 — 29/09/2026  
**Horizonte proposto:** 12 semanas  
**Direção:** adaptar o ERP + CRM existente para apoiar a gestão de contratos terceirizados e as rotinas administrativas e de pessoas da MV Ambiental.

## 1. Objetivo

Entregar uma primeira versão utilizável que conecte contrato, posto, funcionário, demanda, obrigação e documento. A equipe deve conseguir identificar o que precisa acontecer, quem é responsável, qual é o prazo e onde está a evidência de conclusão.

O produto deve aproveitar os módulos já prontos de ERP e CRM. O trabalho começa com um levantamento de aderência para configurar e completar os fluxos existentes; não pressupõe reconstruir o sistema.

## 2. Resultado esperado para o piloto

Ao final do piloto, usuários da MV Ambiental deverão conseguir:

1. Consultar contratos e postos com vigência, quantitativo e requisitos operacionais.
2. Relacionar funcionários aos postos e acompanhar entradas, saídas, férias e substituições.
3. Abrir e acompanhar demandas até a conclusão, com responsável, prazo, prioridade e histórico.
4. Ver documentos e comprovações pendentes por funcionário, posto, contrato e competência mensal.
5. Receber alertas de prazo e consultar pendências sem depender de controles pessoais dispersos.
6. Trabalhar com acesso limitado ao papel de cada usuário e trilha de alterações.

## 3. Escopo do MVP

### Essencial para o piloto (P0)

- **Cadastro de contratos e versões:** cliente, local, escopo, datas de início e fim, aditivos, convenção coletiva de referência, situação de validação e arquivos de origem.
- **Postos e equipes:** função, escala, quantitativo previsto, responsável operacional e requisitos específicos do posto.
- **Funcionários e alocações:** dados mínimos necessários, vínculo de trabalho, posto atual e histórico de movimentações.
- **Pipeline de demandas:** reposição, admissão, férias, ausência, documento pendente, ponto/ocorrência, uniforme/EPI e solicitação do cliente.
- **Responsabilidades:** executor, aprovador quando aplicável, substituto interno, prazo e regra de escalonamento.
- **Gestão documental:** checklist por processo/contrato, status, validade quando aplicável, localização do arquivo e registro de conferência.
- **Agenda de obrigações:** recorrência, data de referência, competência, responsável, evidência exigida e status.
- **Painel operacional:** demandas abertas/atrasadas, postos descobertos, documentos pendentes e obrigações próximas do vencimento.
- **Auditoria e permissões:** histórico de alterações, perfis de acesso e controle de acesso a informações pessoais.
- **Treinamento operacional:** instruções curtas e checklists dentro do fluxo de trabalho.

### Importante, mas pode começar com operação assistida (P1)

- Importação controlada por CSV ou planilha para cadastros iniciais.
- Links de documentos no Google Drive, mantendo o Drive como repositório no piloto.
- Exportação de relatórios de pendências e comprovações para envio ao cliente.
- Alertas por e-mail ou dentro do sistema; mensagens externas somente após validar canal, consentimento e responsáveis.
- Integração com o sistema de recrutamento existente, inicialmente por exportação/importação ou etapa manual registrada.
- Importação de status/recibos do eSocial fornecidos pela contabilidade ou SST.

### Fora do primeiro MVP (P2 / decisão posterior)

- Transmissão direta de eventos ao eSocial.
- Cálculo de folha, rescisões, benefícios ou interpretação automática de convenções coletivas.
- Open Finance, contas bancárias e apuração de lucro por contrato.
- OCR/IA para decidir conformidade documental sem revisão humana.
- Substituição integral do Google Drive, Dix, Novio ou do sistema de recrutamento.
- Aplicativo de campo completo, geolocalização ou ponto eletrônico próprio.

## 4. Roadmap de 12 semanas

| Fase | Semanas | Entregas | Critério de saída |
|---|---:|---|---|
| **0. Descoberta e aderência** | 1–2 | Inventário dos módulos atuais do ERP/CRM; entrevistas; mapa dos fluxos; inventário de dados e integrações; definição do contrato piloto; lista de lacunas P0/P1/P2 | MV Ambiental valida os fluxos prioritários, usuários, dados mínimos e contrato piloto; equipe técnica aponta o que já existe e o que requer mudança |
| **1. Fundação do produto** | 3–4 | Modelo de contrato versionado; cadastro de postos e alocações; perfis e permissões; auditoria básica; carga de teste | É possível representar um contrato e seus postos, atribuir equipe e identificar vigência/documento cuja validade ainda não foi confirmada |
| **2. Execução das demandas** | 5–6 | Pipeline configurável; tipos e etapas de demanda; responsáveis e aprovadores; prazos, prioridade, comentários e evidências | Um caso de reposição ou ausência percorre abertura, triagem, execução, conferência e encerramento com histórico completo |
| **3. Pessoas e documentação** | 7–8 | Checklist de documentos; vínculo com pessoa/posto/contrato; validade e pendência; movimentação e substituição; controle de uniformes/EPIs e férias | Usuário identifica lacuna documental e cobertura de posto; consegue registrar entrega, movimentação e responsável |
| **4. Obrigações e painel** | 9–10 | Agenda por contrato e competência; pacote de comprovação mensal; painel de prazos e pendências; importação inicial; treinamento piloto | Uma competência mensal pode ser preparada com itens exigidos, responsáveis, links/arquivos e situação de conferência |
| **5. Piloto e decisão de expansão** | 11–12 | Operação assistida; correções de usabilidade; medição de indicadores; plano de suporte e evolução | Usuários concluem fluxos reais sem depender da consultoria para cada etapa; direção decide ampliar, ajustar ou pausar |

**Regra de priorização:** se houver atraso, preservar cadastro/versionamento de contratos, pipeline, documentação, agenda de obrigações, permissões e teste real. Adiar integrações externas e automações que não sejam necessárias para validar o fluxo.

## 5. Uso dos contratos no desenho do produto

### Laboratório de Astrofísica — candidato a piloto inicial

O arquivo recebido descreve serviço de portaria, um posto com dois funcionários e escala 12x36, com vigência iniciada em 16/07/2026 por 12 meses. O termo de referência também aponta controles de cobertura/substituição, férias, uniformes, EPIs, treinamentos, registros de jornada e documentos mensais para fiscalização.

Isso testa o fluxo completo com escopo pequeno: posto previsto → escala/equipe alocada → ocorrência ou ausência → substituição → atualização do registro → comprovação/documento.

### Meio Ambiente — Luziânia

O contrato anexado indica período de 19/04/2023 a 18/04/2024, enquanto a planilha de equipe inclui admissões posteriores e a convenção anexada é de 2026. Antes de cadastrar como contrato ativo, é necessário localizar o instrumento atual e seus aditivos. Até lá, usar os documentos como referência histórica, com status **vigência a confirmar**.

### Regras de convenção e obrigações

As convenções anexadas são documentos de 2026 e têm período de vigência próprio. O sistema deve guardar documento, abrangência, data inicial/final, versão e aprovação da regra aplicável. Não fixar pisos, benefícios, prazos jurídicos ou cálculos como regras permanentes no código; esses itens precisam de atualização e validação pelo responsável de RH/DP ou assessoria competente.

### Dados pessoais

As planilhas recebidas incluem identificadores e contatos de funcionários. Para o MVP, importar apenas campos necessários ao fluxo; limitar acesso por perfil; manter logs; evitar expor documentos de saúde a usuários sem necessidade operacional. O Drive permanece fonte de arquivo no piloto, com links e permissões revisados.

## 6. Fluxos prioritários a validar

### A. Reposição de posto

1. Responsável registra ausência/vaga, contrato, posto, função, escala e data necessária.
2. Direção ou aprovador autoriza a reposição conforme regra interna.
3. Solicitação é encaminhada ao sistema de recrutamento existente.
4. Candidato aprovado segue para checklist de admissão e exame/documentação.
5. DP registra admissão e alocação; operação confirma cobertura do posto.
6. Pipeline registra conclusão e evidências necessárias.

### B. Documento ou comprovação mensal

1. Sistema abre a competência para o contrato e gera a lista de itens configurados.
2. Cada item recebe responsável, prazo, estado e fonte do arquivo.
3. Conferente verifica completude e registra pendências.
4. Pacote é marcado como pronto/enviado, com data, destinatário e comprovante.

### C. Ocorrência de campo e ponto

1. Yuri registra ocorrência, posto, funcionário, data e justificativa/documento recebido.
2. A demanda é roteada ao DP ou responsável definido; Yuri acompanha o retorno.
3. DP confirma o tratamento no sistema de ponto/folha atual e registra referência/protocolo.
4. A direção acompanha atraso ou impacto de cobertura.

## 7. Matriz de prioridade do backlog

| Prioridade | Item | Motivo |
|---|---|---|
| **P0** | Contrato, aditivo, vigência e status de validação | Evita operar sobre documento ou período incorreto |
| **P0** | Posto, quantidade prevista, escala e alocação atual | Dá visibilidade de cobertura e necessidade de reposição |
| **P0** | Pipeline de demandas com prazos e responsáveis | Ataca diretamente a centralização e a perda de acompanhamento |
| **P0** | Checklist documental e evidências por competência | Responde às cobranças recorrentes dos contratos |
| **P0** | Permissões e histórico de alterações | Protege dados pessoais e dá rastreabilidade |
| **P1** | Integração simples com recrutamento | Evita redigitação após validar o processo |
| **P1** | Sincronização/atalhos para Drive e relatórios exportáveis | Reduz fricção sem substituir as ferramentas atuais |
| **P1** | Lembretes e escalonamento automático | Reduz atrasos após responsabilidades estarem definidas |
| **P2** | Integração de transmissão ao eSocial | Alto esforço, depende de processo, autorização, fornecedor e validação técnica |
| **P2** | Open Finance/resultado financeiro por contrato | Frente do financeiro e depende de classificação confiável dos custos |

## 8. Papéis de trabalho sugeridos

| Papel | Responsabilidade no projeto |
|---|---|
| Direção da MV Ambiental | Patrocinar o piloto, decidir prioridades e aprovar papéis/processos |
| Mart RH | Product owner funcional: mapear processos, validar requisitos, organizar treinamento e aceite |
| João / equipe técnica | Avaliar ERP/CRM atual, propor adaptações, implementar e acompanhar integrações priorizadas |
| Carol, Maria Rosiane e Ana | Validar rotinas administrativas e de DP, documentos e transferência de conhecimento |
| Yuri | Validar fluxo de campo, ocorrências, cobertura, ponto e acompanhamento de demandas |
| Contabilidade e prestador de SST | Validar obrigações técnicas, situações do eSocial, eventos e evidências sob sua responsabilidade |

Os nomes acima são uma proposta baseada no resumo da reunião; confirmar disponibilidade e autoridade de aprovação na descoberta.

## 9. Indicadores do piloto

Medir uma linha de base nas semanas 1–2 e comparar ao final:

- Percentual de demandas concluídas no prazo.
- Número de demandas sem responsável ou vencidas.
- Tempo entre abertura da reposição e confirmação de cobertura.
- Percentual de itens documentais do piloto conferidos até o prazo.
- Quantidade de obrigações mensais prontas e enviadas com evidência registrada.
- Percentual de usuários do piloto que registram e concluem tarefas diretamente no sistema.
- Número de etapas que ainda exigem planilha ou cobrança informal.

Definir metas quantitativas após medir a situação inicial, sem inventar uma meta antes de conhecer os volumes e prazos reais.

## 10. Riscos, dependências e decisões

| Risco/dependência | Tratamento proposto |
|---|---|
| Repositório do ERP/CRM não está disponível neste workspace | Fazer o fit-gap técnico assim que o código ou acesso ao ambiente for disponibilizado; este documento é funcional e não presume arquitetura |
| Vigência de Luziânia não confirmada | Solicitar contrato vigente/aditivos antes de ativar cadastros e prazos atuais |
| Dados espalhados ou desatualizados | Definir fonte oficial, importar em lote de teste e validar com responsáveis antes da carga final |
| Sobrecarga dos usuários | Começar por um contrato piloto e reservar horários curtos de validação e treinamento |
| Regras de CCT mudam por região/período | Parametrizar referência e vigência, exigir validação humana e manter histórico |
| Integrações indisponíveis | Operação assistida com importação/exportação e registro manual auditável no MVP |
| Excesso de escopo | Priorizar P0 e adiar folha, Open Finance, eSocial transmissor e substituição de sistemas existentes |

Decisões a tomar na descoberta: contrato e equipe do piloto; ferramenta atual para pipeline/documentos; quais perfis acessam dados pessoais; sistema responsável por recrutamento, ponto, folha e eSocial; canal de alertas; responsável por manter cada controle após o projeto.

## 11. Critérios de aceite do MVP

O piloto está pronto para decisão de expansão quando:

1. O contrato piloto tem versão e vigência conferidas, postos e equipe cadastrados.
2. Uma demanda de reposição ou ocorrência percorreu o fluxo completo com responsável, prazo e histórico.
3. Documentos e obrigações de pelo menos uma competência foram controlados e conferidos.
4. Usuários autorizados conseguem operar sem visualizar dados fora do seu papel.
5. A equipe piloto recebeu treinamento e consegue repetir o processo usando instruções no sistema.
6. Pendências técnicas ou legais externas aparecem com dono e próximo passo, sem o sistema declarar conformidade automaticamente.
7. A direção revisou os indicadores e decidiu o próximo ciclo do produto.

## 12. Próximo passo para tornar o roadmap técnico

Este roadmap foi elaborado a partir das necessidades relatadas, do resumo da reunião e dos documentos dos dois contratos. O diretório de trabalho atual não contém o código do ERP/CRM; portanto, a sequência acima ainda não mapeia módulos, telas, banco de dados, integrações ou esforço real do sistema existente.

Na etapa de fit-gap, comparar cada item P0 com as telas, permissões, entidades e integrações já implementadas. O resultado deve ser uma tabela **já existe / ajustar / criar / fora do MVP**, acompanhada de histórias técnicas e estimativas da equipe.
