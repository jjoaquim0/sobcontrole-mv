// Conteúdo do Roadmap do MVP da MV Ambiental.
// Fonte: docs/clientes/mv-ambiental/ROADMAP_MVP_MV_AMBIENTAL.md (versão 0.1 — 29/09/2026).
// Mantenha este arquivo em sincronia com o documento de origem ao publicar novas versões.

export type Priority = 'P0' | 'P1' | 'P2';

export interface RoadmapPhase {
  id: string;
  name: string;
  weekStart: number;
  weekEnd: number;
  deliverables: string[];
  exitCriteria: string;
}

export interface ScopeItem {
  title: string;
  description?: string;
}

export interface FlowDefinition {
  id: string;
  title: string;
  steps: string[];
}

export const roadmapMeta = {
  client: 'MV Ambiental',
  title: 'Roadmap do MVP',
  version: '0.1',
  date: '29/09/2026',
  horizonWeeks: 12,
  direction:
    'Adaptar o ERP + CRM existente para apoiar a gestão de contratos terceirizados e as rotinas administrativas e de pessoas da MV Ambiental.',
};

export const objective = [
  'Entregar uma primeira versão utilizável que conecte contrato, posto, funcionário, demanda, obrigação e documento. A equipe deve conseguir identificar o que precisa acontecer, quem é responsável, qual é o prazo e onde está a evidência de conclusão.',
  'O produto deve aproveitar os módulos já prontos de ERP e CRM. O trabalho começa com um levantamento de aderência para configurar e completar os fluxos existentes; não pressupõe reconstruir o sistema.',
];

export const objectiveChain = ['Contrato', 'Posto', 'Funcionário', 'Demanda', 'Obrigação', 'Documento'];

export const pilotOutcomes = [
  'Consultar contratos e postos com vigência, quantitativo e requisitos operacionais.',
  'Relacionar funcionários aos postos e acompanhar entradas, saídas, férias e substituições.',
  'Abrir e acompanhar demandas até a conclusão, com responsável, prazo, prioridade e histórico.',
  'Ver documentos e comprovações pendentes por funcionário, posto, contrato e competência mensal.',
  'Receber alertas de prazo e consultar pendências sem depender de controles pessoais dispersos.',
  'Trabalhar com acesso limitado ao papel de cada usuário e trilha de alterações.',
];

export const scope: Record<Priority, { label: string; summary: string; items: ScopeItem[] }> = {
  P0: {
    label: 'Essencial para o piloto',
    summary: 'Itens sem os quais o piloto não valida o fluxo.',
    items: [
      { title: 'Cadastro de contratos e versões', description: 'Cliente, local, escopo, datas de início e fim, aditivos, convenção coletiva de referência, situação de validação e arquivos de origem.' },
      { title: 'Postos e equipes', description: 'Função, escala, quantitativo previsto, responsável operacional e requisitos específicos do posto.' },
      { title: 'Funcionários e alocações', description: 'Dados mínimos necessários, vínculo de trabalho, posto atual e histórico de movimentações.' },
      { title: 'Pipeline de demandas', description: 'Reposição, admissão, férias, ausência, documento pendente, ponto/ocorrência, uniforme/EPI e solicitação do cliente.' },
      { title: 'Responsabilidades', description: 'Executor, aprovador quando aplicável, substituto interno, prazo e regra de escalonamento.' },
      { title: 'Gestão documental', description: 'Checklist por processo/contrato, status, validade quando aplicável, localização do arquivo e registro de conferência.' },
      { title: 'Agenda de obrigações', description: 'Recorrência, data de referência, competência, responsável, evidência exigida e status.' },
      { title: 'Painel operacional', description: 'Demandas abertas/atrasadas, postos descobertos, documentos pendentes e obrigações próximas do vencimento.' },
      { title: 'Auditoria e permissões', description: 'Histórico de alterações, perfis de acesso e controle de acesso a informações pessoais.' },
      { title: 'Treinamento operacional', description: 'Instruções curtas e checklists dentro do fluxo de trabalho.' },
    ],
  },
  P1: {
    label: 'Importante, com operação assistida',
    summary: 'Pode começar de forma assistida e evoluir durante o piloto.',
    items: [
      { title: 'Importação controlada por CSV ou planilha para cadastros iniciais.' },
      { title: 'Links de documentos no Google Drive, mantendo o Drive como repositório no piloto.' },
      { title: 'Exportação de relatórios de pendências e comprovações para envio ao cliente.' },
      { title: 'Alertas por e-mail ou dentro do sistema; mensagens externas somente após validar canal, consentimento e responsáveis.' },
      { title: 'Integração com o sistema de recrutamento existente, inicialmente por exportação/importação ou etapa manual registrada.' },
      { title: 'Importação de status/recibos do eSocial fornecidos pela contabilidade ou SST.' },
    ],
  },
  P2: {
    label: 'Fora do primeiro MVP',
    summary: 'Decisão posterior, após o piloto.',
    items: [
      { title: 'Transmissão direta de eventos ao eSocial.' },
      { title: 'Cálculo de folha, rescisões, benefícios ou interpretação automática de convenções coletivas.' },
      { title: 'Open Finance, contas bancárias e apuração de lucro por contrato.' },
      { title: 'OCR/IA para decidir conformidade documental sem revisão humana.' },
      { title: 'Substituição integral do Google Drive, Dix, Novio ou do sistema de recrutamento.' },
      { title: 'Aplicativo de campo completo, geolocalização ou ponto eletrônico próprio.' },
    ],
  },
};

export const phases: RoadmapPhase[] = [
  {
    id: '0',
    name: 'Descoberta e aderência',
    weekStart: 1,
    weekEnd: 2,
    deliverables: ['Inventário dos módulos atuais do ERP/CRM', 'Entrevistas', 'Mapa dos fluxos', 'Inventário de dados e integrações', 'Definição do contrato piloto', 'Lista de lacunas P0/P1/P2'],
    exitCriteria: 'MV Ambiental valida os fluxos prioritários, usuários, dados mínimos e contrato piloto; equipe técnica aponta o que já existe e o que requer mudança.',
  },
  {
    id: '1',
    name: 'Fundação do produto',
    weekStart: 3,
    weekEnd: 4,
    deliverables: ['Modelo de contrato versionado', 'Cadastro de postos e alocações', 'Perfis e permissões', 'Auditoria básica', 'Carga de teste'],
    exitCriteria: 'É possível representar um contrato e seus postos, atribuir equipe e identificar vigência/documento cuja validade ainda não foi confirmada.',
  },
  {
    id: '2',
    name: 'Execução das demandas',
    weekStart: 5,
    weekEnd: 6,
    deliverables: ['Pipeline configurável', 'Tipos e etapas de demanda', 'Responsáveis e aprovadores', 'Prazos, prioridade, comentários e evidências'],
    exitCriteria: 'Um caso de reposição ou ausência percorre abertura, triagem, execução, conferência e encerramento com histórico completo.',
  },
  {
    id: '3',
    name: 'Pessoas e documentação',
    weekStart: 7,
    weekEnd: 8,
    deliverables: ['Checklist de documentos', 'Vínculo com pessoa/posto/contrato', 'Validade e pendência', 'Movimentação e substituição', 'Controle de uniformes/EPIs e férias'],
    exitCriteria: 'Usuário identifica lacuna documental e cobertura de posto; consegue registrar entrega, movimentação e responsável.',
  },
  {
    id: '4',
    name: 'Obrigações e painel',
    weekStart: 9,
    weekEnd: 10,
    deliverables: ['Agenda por contrato e competência', 'Pacote de comprovação mensal', 'Painel de prazos e pendências', 'Importação inicial', 'Treinamento piloto'],
    exitCriteria: 'Uma competência mensal pode ser preparada com itens exigidos, responsáveis, links/arquivos e situação de conferência.',
  },
  {
    id: '5',
    name: 'Piloto e decisão de expansão',
    weekStart: 11,
    weekEnd: 12,
    deliverables: ['Operação assistida', 'Correções de usabilidade', 'Medição de indicadores', 'Plano de suporte e evolução'],
    exitCriteria: 'Usuários concluem fluxos reais sem depender da consultoria para cada etapa; direção decide ampliar, ajustar ou pausar.',
  },
];

export const prioritizationRule =
  'Se houver atraso, preservar cadastro/versionamento de contratos, pipeline, documentação, agenda de obrigações, permissões e teste real. Adiar integrações externas e automações que não sejam necessárias para validar o fluxo.';

export const contracts = [
  {
    title: 'Laboratório de Astrofísica',
    badge: 'Candidato a piloto inicial',
    tone: 'positive' as const,
    paragraphs: [
      'O arquivo recebido descreve serviço de portaria, um posto com dois funcionários e escala 12x36, com vigência iniciada em 16/07/2026 por 12 meses. O termo de referência também aponta controles de cobertura/substituição, férias, uniformes, EPIs, treinamentos, registros de jornada e documentos mensais para fiscalização.',
    ],
    chain: ['Posto previsto', 'Escala/equipe alocada', 'Ocorrência ou ausência', 'Substituição', 'Atualização do registro', 'Comprovação/documento'],
  },
  {
    title: 'Meio Ambiente — Luziânia',
    badge: 'Vigência a confirmar',
    tone: 'warning' as const,
    paragraphs: [
      'O contrato anexado indica período de 19/04/2023 a 18/04/2024, enquanto a planilha de equipe inclui admissões posteriores e a convenção anexada é de 2026. Antes de cadastrar como contrato ativo, é necessário localizar o instrumento atual e seus aditivos. Até lá, usar os documentos como referência histórica.',
    ],
    chain: [],
  },
];

export const designNotes = [
  {
    title: 'Regras de convenção e obrigações',
    text: 'As convenções anexadas são documentos de 2026 e têm período de vigência próprio. O sistema deve guardar documento, abrangência, data inicial/final, versão e aprovação da regra aplicável. Não fixar pisos, benefícios, prazos jurídicos ou cálculos como regras permanentes no código; esses itens precisam de atualização e validação pelo responsável de RH/DP ou assessoria competente.',
  },
  {
    title: 'Dados pessoais',
    text: 'As planilhas recebidas incluem identificadores e contatos de funcionários. Para o MVP, importar apenas campos necessários ao fluxo; limitar acesso por perfil; manter logs; evitar expor documentos de saúde a usuários sem necessidade operacional. O Drive permanece fonte de arquivo no piloto, com links e permissões revisados.',
  },
];

export const flows: FlowDefinition[] = [
  {
    id: 'A',
    title: 'Reposição de posto',
    steps: [
      'Responsável registra ausência/vaga, contrato, posto, função, escala e data necessária.',
      'Direção ou aprovador autoriza a reposição conforme regra interna.',
      'Solicitação é encaminhada ao sistema de recrutamento existente.',
      'Candidato aprovado segue para checklist de admissão e exame/documentação.',
      'DP registra admissão e alocação; operação confirma cobertura do posto.',
      'Pipeline registra conclusão e evidências necessárias.',
    ],
  },
  {
    id: 'B',
    title: 'Documento ou comprovação mensal',
    steps: [
      'Sistema abre a competência para o contrato e gera a lista de itens configurados.',
      'Cada item recebe responsável, prazo, estado e fonte do arquivo.',
      'Conferente verifica completude e registra pendências.',
      'Pacote é marcado como pronto/enviado, com data, destinatário e comprovante.',
    ],
  },
  {
    id: 'C',
    title: 'Ocorrência de campo e ponto',
    steps: [
      'Yuri registra ocorrência, posto, funcionário, data e justificativa/documento recebido.',
      'A demanda é roteada ao DP ou responsável definido; Yuri acompanha o retorno.',
      'DP confirma o tratamento no sistema de ponto/folha atual e registra referência/protocolo.',
      'A direção acompanha atraso ou impacto de cobertura.',
    ],
  },
];

export const backlogMatrix: { priority: Priority; item: string; reason: string }[] = [
  { priority: 'P0', item: 'Contrato, aditivo, vigência e status de validação', reason: 'Evita operar sobre documento ou período incorreto' },
  { priority: 'P0', item: 'Posto, quantidade prevista, escala e alocação atual', reason: 'Dá visibilidade de cobertura e necessidade de reposição' },
  { priority: 'P0', item: 'Pipeline de demandas com prazos e responsáveis', reason: 'Ataca diretamente a centralização e a perda de acompanhamento' },
  { priority: 'P0', item: 'Checklist documental e evidências por competência', reason: 'Responde às cobranças recorrentes dos contratos' },
  { priority: 'P0', item: 'Permissões e histórico de alterações', reason: 'Protege dados pessoais e dá rastreabilidade' },
  { priority: 'P1', item: 'Integração simples com recrutamento', reason: 'Evita redigitação após validar o processo' },
  { priority: 'P1', item: 'Sincronização/atalhos para Drive e relatórios exportáveis', reason: 'Reduz fricção sem substituir as ferramentas atuais' },
  { priority: 'P1', item: 'Lembretes e escalonamento automático', reason: 'Reduz atrasos após responsabilidades estarem definidas' },
  { priority: 'P2', item: 'Integração de transmissão ao eSocial', reason: 'Alto esforço, depende de processo, autorização, fornecedor e validação técnica' },
  { priority: 'P2', item: 'Open Finance/resultado financeiro por contrato', reason: 'Frente do financeiro e depende de classificação confiável dos custos' },
];

export const roles = [
  { role: 'Direção da MV Ambiental', responsibility: 'Patrocinar o piloto, decidir prioridades e aprovar papéis/processos' },
  { role: 'Mart RH', responsibility: 'Product owner funcional: mapear processos, validar requisitos, organizar treinamento e aceite' },
  { role: 'João / equipe técnica', responsibility: 'Avaliar ERP/CRM atual, propor adaptações, implementar e acompanhar integrações priorizadas' },
  { role: 'Carol, Maria Rosiane e Ana', responsibility: 'Validar rotinas administrativas e de DP, documentos e transferência de conhecimento' },
  { role: 'Yuri', responsibility: 'Validar fluxo de campo, ocorrências, cobertura, ponto e acompanhamento de demandas' },
  { role: 'Contabilidade e prestador de SST', responsibility: 'Validar obrigações técnicas, situações do eSocial, eventos e evidências sob sua responsabilidade' },
];

export const rolesNote =
  'Os nomes acima são uma proposta baseada no resumo da reunião; confirmar disponibilidade e autoridade de aprovação na descoberta.';

export const indicators = [
  'Percentual de demandas concluídas no prazo.',
  'Número de demandas sem responsável ou vencidas.',
  'Tempo entre abertura da reposição e confirmação de cobertura.',
  'Percentual de itens documentais do piloto conferidos até o prazo.',
  'Quantidade de obrigações mensais prontas e enviadas com evidência registrada.',
  'Percentual de usuários do piloto que registram e concluem tarefas diretamente no sistema.',
  'Número de etapas que ainda exigem planilha ou cobrança informal.',
];

export const indicatorsNote =
  'Medir uma linha de base nas semanas 1–2 e comparar ao final. Definir metas quantitativas após medir a situação inicial, sem inventar uma meta antes de conhecer os volumes e prazos reais.';

export const risks = [
  { risk: 'Fit-gap técnico do ERP/CRM ainda não realizado', treatment: 'Fazer o fit-gap técnico na descoberta, com acesso ao código e ao ambiente; este documento é funcional e não presume arquitetura' },
  { risk: 'Vigência de Luziânia não confirmada', treatment: 'Solicitar contrato vigente/aditivos antes de ativar cadastros e prazos atuais' },
  { risk: 'Dados espalhados ou desatualizados', treatment: 'Definir fonte oficial, importar em lote de teste e validar com responsáveis antes da carga final' },
  { risk: 'Sobrecarga dos usuários', treatment: 'Começar por um contrato piloto e reservar horários curtos de validação e treinamento' },
  { risk: 'Regras de CCT mudam por região/período', treatment: 'Parametrizar referência e vigência, exigir validação humana e manter histórico' },
  { risk: 'Integrações indisponíveis', treatment: 'Operação assistida com importação/exportação e registro manual auditável no MVP' },
  { risk: 'Excesso de escopo', treatment: 'Priorizar P0 e adiar folha, Open Finance, eSocial transmissor e substituição de sistemas existentes' },
];

export const discoveryDecisions = [
  'Contrato e equipe do piloto',
  'Ferramenta atual para pipeline/documentos',
  'Quais perfis acessam dados pessoais',
  'Sistema responsável por recrutamento, ponto, folha e eSocial',
  'Canal de alertas',
  'Responsável por manter cada controle após o projeto',
];

export const acceptanceCriteria = [
  'O contrato piloto tem versão e vigência conferidas, postos e equipe cadastrados.',
  'Uma demanda de reposição ou ocorrência percorreu o fluxo completo com responsável, prazo e histórico.',
  'Documentos e obrigações de pelo menos uma competência foram controlados e conferidos.',
  'Usuários autorizados conseguem operar sem visualizar dados fora do seu papel.',
  'A equipe piloto recebeu treinamento e consegue repetir o processo usando instruções no sistema.',
  'Pendências técnicas ou legais externas aparecem com dono e próximo passo, sem o sistema declarar conformidade automaticamente.',
  'A direção revisou os indicadores e decidiu o próximo ciclo do produto.',
];

export const nextStep = [
  'Este roadmap foi elaborado a partir das necessidades relatadas, do resumo da reunião e dos documentos dos dois contratos. A sequência acima ainda não mapeia módulos, telas, banco de dados, integrações ou esforço real do sistema existente.',
  'Na etapa de fit-gap, comparar cada item P0 com as telas, permissões, entidades e integrações já implementadas. O resultado deve ser uma tabela já existe / ajustar / criar / fora do MVP, acompanhada de histórias técnicas e estimativas da equipe.',
];

export const fitGapColumns = ['Já existe', 'Ajustar', 'Criar', 'Fora do MVP'];
