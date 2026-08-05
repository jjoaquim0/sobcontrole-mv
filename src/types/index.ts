export type UserRole = 'admin' | 'manager' | 'employee';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'inactive';

export type PaymentMethod = 'cash' | 'money' | 'credit_card' | 'debit_card' | 'pix' | 'bank_slip' | 'bank_transfer' | 'other';

export type SaleStatus = 'paid' | 'pending' | 'canceled' | 'cancelled';

export type PurchaseStatus = 'paid' | 'pending' | 'canceled';

export type TransactionStatus = 'paid' | 'pending' | 'late' | 'canceled';

export type FinancialCategoryType = 'revenue' | 'expense';

export type DocumentStatus = 'active' | 'archived' | 'deleted';

export type DocumentVisibility = 'private' | 'company' | 'restricted';

export type DocumentAccessLevel = 'none' | 'view' | 'download' | 'edit' | 'admin';

export type DocumentRelatedType = 'customer' | 'supplier' | 'sale' | 'purchase' | 'product' | 'deal' | 'company';

export type DealStatus = 'open' | 'won' | 'lost';

export type AppointmentType = 'reuniao' | 'tarefa' | 'ligacao' | 'visita' | 'lembrete';

export type AppointmentStatus = 'agendado' | 'confirmado' | 'concluido' | 'cancelado' | 'nao_compareceu' | 'pendente';

export type CustomerType = 'individual' | 'corporate'; // pf ou pj

export type CommonStatus = 'active' | 'inactive';

export type EmployeeStatus = 'active' | 'on_leave' | 'terminated';

export type EmploymentType = 'clt' | 'pj' | 'internship' | 'temporary' | 'self_employed' | 'other';

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'canceled';

export type TeamStatus = 'active' | 'inactive';
export type SalesGoalType = 'sales_value' | 'sales_count' | 'new_customers' | 'custom';
export type SalesGoalAssignment = 'employee' | 'team';
export type SalesGoalPeriod = 'monthly' | 'quarterly' | 'annual' | 'custom';
export type SalesGoalStatus = 'active' | 'completed' | 'expired' | 'canceled';
export type SalesGoalResultSource = 'automatic' | 'manual';

export interface Company {
  id: string;
  name: string;
  cnpj: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySettings {
  id: string;
  companyId: string;
  timezone: string;
  currency: string;
  language: string;
  dateFormat: string;
  logoUrl: string;
  primaryColor: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  whatsappNotifications: boolean;
  smsNotifications: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  companyId: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: SubscriptionStatus;
  currentPeriodEnd: string;
  usageLimit: number;
  usageCurrent: number;
  createdAt: string;
}

export interface Profile {
  id: string; // Conectado ao auth.users.id do Supabase
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  companyId: string;
  fullName: string;
  email?: string;
  phone?: string;
  cpfMasked?: string;
  birthDate?: string;
  jobTitle: string;
  department?: string;
  teamId?: string;
  teamName?: string;
  managerEmployeeId?: string;
  managerName?: string;
  salesProfileId?: string;
  employmentType: EmploymentType;
  admissionDate?: string;
  status: EmployeeStatus;
  internalNotes?: string;
  commissionEnabled: boolean;
  commissionRuleNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Commission {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  teamId?: string;
  teamName?: string;
  description: string;
  referencePeriod?: string;
  grossAmount: number;
  status: CommissionStatus;
  internalNotes?: string;
  paidAt?: string;
  canceledAt?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PeopleAuditEvent {
  id: string;
  companyId: string;
  employeeId?: string;
  teamId?: string;
  entityType: 'employee' | 'team' | 'goal' | 'commission';
  entityId: string;
  eventType: string;
  changedFields: string[];
  actorId?: string;
  actorName?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  managerEmployeeId?: string;
  managerName?: string;
  status: TeamStatus;
  activeMembers: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesGoal {
  id: string;
  companyId: string;
  name: string;
  goalType: SalesGoalType;
  assignmentType: SalesGoalAssignment;
  employeeId?: string;
  employeeName?: string;
  teamId?: string;
  teamName?: string;
  periodType: SalesGoalPeriod;
  targetValue: number;
  startDate: string;
  endDate: string;
  status: SalesGoalStatus;
  effectiveStatus: SalesGoalStatus;
  notes?: string;
  resultSource: SalesGoalResultSource;
  hasAutomaticSource: boolean;
  manualResult: number;
  currentResult: number;
  progressPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamPerformance {
  team: Team;
  goalTarget: number;
  goalResult: number;
  progressPercent: number;
  goalsAtRisk: number;
  goalsCompleted: number;
  salesTotal?: number;
  hasSalesSource: boolean;
}

export interface SalesProfileOption {
  id: string;
  name: string;
  email: string;
}

export interface Customer {
  id: string;
  companyId: string;
  fullName: string;
  document: string; // CPF ou CNPJ
  email: string;
  phone: string;
  address: string; // Endereço formatado ou JSON
  isActive: boolean;
  createdAt: string;
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  document: string; // CNPJ
  status: CommonStatus;
  createdAt: string;
}

export interface Category {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface FinancialCategory {
  id: string;
  companyId: string;
  name: string;
  type: FinancialCategoryType;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  companyId: string;
  categoryId: string;
  category?: Category;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  unit: string;
  costPrice: number;
  salePrice: number;
  currentQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  isActive: boolean;
  createdAt: string;
}

export interface Sale {
  id: string;
  companyId: string;
  customerId: string;
  customer?: Customer;
  sellerId: string;
  sellerName?: string;
  total: number;
  discount: number;
  fee: number;
  finalValue: number;
  paymentMethod: PaymentMethod;
  paymentStatus: SaleStatus;
  notes?: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface Purchase {
  id: string;
  companyId: string;
  supplierId: string;
  supplier?: Supplier;
  totalAmount: number;
  discount: number;
  fee: number;
  finalValue: number;
  status: PurchaseStatus;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
  createdBy: string; // ID do Profile
  createdByName?: string;
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitCost: number;
  subtotal: number;
}

export interface AccountReceivable {
  id: string;
  companyId: string;
  saleId?: string;
  sale?: Sale;
  customerId: string;
  customer?: Customer;
  amount: number;
  dueDate: string;
  status: TransactionStatus;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  description?: string;
}

export interface AccountPayable {
  id: string;
  companyId: string;
  purchaseId?: string;
  purchase?: Purchase;
  supplierId: string;
  supplier?: Supplier;
  amount: number;
  dueDate: string;
  status: TransactionStatus;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  description?: string;
}

export interface ReportPeriod {
  type: 'today' | '7d' | 'current_month' | 'previous_month' | 'quarter' | 'year' | 'custom';
  dateFrom?: string;
  dateTo?: string;
}

export interface Document {
  id: string;
  companyId: string;
  name: string;
  originalName: string;
  description?: string;
  category: DocumentCategory;
  mimeType: string;
  size: number; // em bytes
  storagePath: string;
  relatedType?: DocumentRelatedType;
  relatedId?: string;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  ownerId?: string;
  ownerName?: string;
  uploadedBy?: string;
  uploadedByName?: string;
  currentVersionId?: string;
  versionCount: number;
  currentUserPermission?: DocumentAccessLevel;
  deletedAt?: string;
  deletedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentCategory = 'nota_fiscal' | 'contrato' | 'boleto' | 'recibo' | 'empresa' | 'cliente' | 'fornecedor' | 'outros';

export interface DocumentVersion {
  id: string;
  documentId: string;
  companyId: string;
  versionNumber: number;
  originalName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  changeComment?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

export interface DocumentPermission {
  id: string;
  documentId: string;
  companyId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  accessLevel: Exclude<DocumentAccessLevel, 'none'>;
  grantedBy?: string;
  grantedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentAuditEvent {
  id: string;
  documentId: string;
  companyId: string;
  eventType: string;
  summary: string;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  performedBy?: string;
  performedByName?: string;
  createdAt: string;
}

export interface DocumentRelatedEntity {
  id: string;
  label: string;
}

export interface PipelineStage {
  id: string;
  companyId: string;
  name: string;
  color: string;
  position: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  companyId: string;
  title: string;
  customerId: string;
  customer?: Customer;
  ownerId: string;
  ownerName?: string;
  stageId: string;
  value: number;
  status: DealStatus;
  expectedCloseDate?: string;
  position: number;
  notes?: string;
  lostReason?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DealStageHistoryEntry {
  id: string;
  dealId: string;
  fromStageId?: string;
  fromStageName?: string;
  toStageId: string;
  toStageName?: string;
  changedBy?: string;
  changedByName?: string;
  changedAt: string;
}

export interface Appointment {
  id: string;
  companyId: string;
  customerId?: string;
  customer?: Customer;
  dealId?: string;
  dealTitle?: string;
  assignedUserId: string;
  assignedUserName?: string;
  createdBy?: string;
  title: string;
  description?: string;
  type: AppointmentType;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationCategory =
  | 'agenda'
  | 'pipeline'
  | 'vendas'
  | 'clientes'
  | 'financeiro'
  | 'estoque'
  | 'metas'
  | 'equipe';

export type NotificationPriority = 'informativa' | 'baixa' | 'media' | 'alta' | 'critica';

export type NotificationStatus = 'unread' | 'read' | 'resolved' | 'archived';

export type NotificationChannel = 'push' | 'email' | 'email_digest' | 'sms';

export type NotificationDeliveryStatus = 'queued' | 'sending' | 'sent' | 'delivered' | 'failed' | 'skipped';

export type NotificationActionType =
  | 'send_message'
  | 'create_task'
  | 'schedule_meeting'
  | 'open_customer'
  | 'open_deal'
  | 'reassign'
  | 'snooze'
  | 'resolve'
  | 'dismiss';

export type DigestFrequency = 'immediate' | 'daily' | 'weekly' | 'none';

export type NotificationEventType =
  | 'appointment_upcoming'
  | 'appointment_overdue'
  | 'deal_stale'
  | 'proposal_expiring'
  | 'sale_no_followup'
  | 'customer_at_risk'
  | 'payment_receivable_due'
  | 'payment_payable_due'
  | 'low_stock'
  | 'sales_goal_at_risk'
  | 'team_event_created';

export interface Notification {
  id: string;
  companyId: string;
  eventId?: string;
  recipientUserId: string;
  category: NotificationCategory;
  eventType: NotificationEventType;
  priority: NotificationPriority;
  title: string;
  message: string;
  aiSummary?: string;
  aiPriorityReason?: string;
  aiSuggestedAction?: NotificationActionType;
  aiSuggestedDeadline?: string;
  aiSuggestedMessage?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  channels: NotificationChannel[];
  status: NotificationStatus;
  snoozedUntil?: string;
  actionTaken?: NotificationActionType;
  actionTakenAt?: string;
  readAt?: string;
  resolvedAt?: string;
  createdAt: string;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  provider?: string;
  providerMessageId?: string;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  nextRetryAt?: string;
  queuedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  openedAt?: string;
  failedAt?: string;
  createdAt: string;
}

export interface NotificationPreferences {
  id: string;
  companyId: string;
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  categoriesEnabled: NotificationCategory[];
  minPriorityPush: NotificationPriority;
  minPriorityEmail: NotificationPriority;
  minPrioritySms: NotificationPriority;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  digestFrequency: DigestFrequency;
  phone: string;
  notificationEmail: string;
  consentPush: boolean;
  consentPushAt?: string;
  consentEmail: boolean;
  consentEmailAt?: string;
  consentSms: boolean;
  consentSmsAt?: string;
  gestlyRecommendationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationAction {
  id: string;
  notificationId: string;
  actionType: NotificationActionType;
  performedBy?: string;
  payload: Record<string, unknown>;
  performedAt: string;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  authKey: string;
  userAgent?: string;
  createdAt: string;
}

export type AnalyticsModuleCategory = 'geral' | 'vendas' | 'clientes' | 'financeiro' | 'estoque' | 'ia';

export type AnalyticsModulePlanRequirement = 'free' | 'pro' | 'enterprise';

export type AnalyticsModuleAccessStatus = 'available' | 'contracted' | 'coming_soon' | 'locked';

export type AnalyticsModuleContractStatus = 'active' | 'inactive';

export type AnalyticsModuleHistoryAction = 'activated' | 'deactivated';

export interface AnalyticsModule {
  id: string;
  key: string;
  name: string;
  category: AnalyticsModuleCategory;
  minPlan: AnalyticsModulePlanRequirement | null;
  isAddon: boolean;
  isComingSoon: boolean;
  isActive: boolean;
  routePath: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyAnalyticsModule {
  id: string;
  companyId: string;
  moduleKey: string;
  status: AnalyticsModuleContractStatus;
  activatedAt: string;
  deactivatedAt?: string;
  activatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsModuleHistoryEntry {
  id: string;
  companyId: string;
  moduleKey: string;
  action: AnalyticsModuleHistoryAction;
  performedBy?: string;
  note?: string;
  performedAt: string;
}
