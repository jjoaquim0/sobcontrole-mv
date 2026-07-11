import { NotificationCategory, NotificationChannel, NotificationPriority, NotificationStatus } from '../../types';

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  agenda: 'Agenda',
  pipeline: 'Pipeline',
  vendas: 'Vendas',
  clientes: 'Clientes',
  financeiro: 'Financeiro',
  estoque: 'Estoque',
  metas: 'Metas',
  equipe: 'Equipe',
};

export const PRIORITY_LABELS: Record<NotificationPriority, string> = {
  informativa: 'Informativa',
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
};

export const PRIORITY_CLASSES: Record<NotificationPriority, string> = {
  informativa: 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
  baixa: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  media: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
  alta: 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400',
  critica: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400',
};

export const STATUS_LABELS: Record<NotificationStatus, string> = {
  unread: 'Não lida',
  read: 'Lida',
  resolved: 'Resolvida',
  archived: 'Arquivada',
};

export const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  push: 'Push',
  email: 'E-mail',
  email_digest: 'Resumo por e-mail',
  sms: 'SMS',
};

export const ACTION_LABELS: Record<string, string> = {
  send_message: 'Enviar mensagem',
  create_task: 'Criar tarefa',
  schedule_meeting: 'Agendar reunião',
  open_customer: 'Abrir cliente',
  open_deal: 'Abrir negócio',
  reassign: 'Alterar responsável',
  snooze: 'Adiar lembrete',
  resolve: 'Marcar como resolvida',
  dismiss: 'Arquivar',
};

// Nem todo related_entity_type possui uma rota de detalhe dedicada no
// projeto (ex.: negócios/compromissos não têm página própria — o Kanban e a
// Agenda são visões de lista/board). Nesses casos, o link resolve para a
// seção geral em vez de inventar uma rota que não existe.
export const resolveEntityLink = (relatedEntityType?: string, relatedEntityId?: string): string | null => {
  switch (relatedEntityType) {
    case 'customer':
      return relatedEntityId ? `/customers/${relatedEntityId}` : '/customers';
    case 'deal':
      return '/pipeline';
    case 'appointment':
      return '/agenda';
    case 'sale':
      return relatedEntityId ? `/sales/${relatedEntityId}` : '/sales';
    case 'product':
      return relatedEntityId ? `/inventory/${relatedEntityId}` : '/inventory';
    case 'purchase':
      return relatedEntityId ? `/purchases/${relatedEntityId}` : '/purchases';
    case 'account_receivable':
    case 'account_payable':
      return '/financial';
    default:
      return null;
  }
};

export const formatDateTime = (iso?: string): string => {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};
