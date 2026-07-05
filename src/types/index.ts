export type UserRole = 'admin' | 'manager' | 'employee';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'inactive';

export type PaymentMethod = 'cash' | 'money' | 'credit_card' | 'debit_card' | 'pix' | 'bank_slip' | 'bank_transfer' | 'other';

export type SaleStatus = 'paid' | 'pending' | 'canceled' | 'cancelled';

export type PurchaseStatus = 'paid' | 'pending' | 'canceled';

export type TransactionStatus = 'paid' | 'pending' | 'late' | 'canceled';

export type FinancialCategoryType = 'revenue' | 'expense';

export type DocumentStatus = 'active' | 'archived';

export type DealStatus = 'open' | 'won' | 'lost';

export type CustomerType = 'individual' | 'corporate'; // pf ou pj

export type CommonStatus = 'active' | 'inactive';

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
  type: '7d' | '30d' | '90d' | '12m' | 'custom';
  dateFrom?: string;
  dateTo?: string;
}

export interface Document {
  id: string;
  companyId: string;
  name: string;
  originalName: string;
  url: string;
  category: DocumentCategory;
  mimeType: string;
  size: number; // em bytes
  storagePath: string;
  relatedType?: 'sale' | 'purchase' | 'customer' | 'supplier';
  relatedId?: string;
  status: DocumentStatus;
  uploadedBy?: string;
  uploadedByName?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentCategory = 'nota_fiscal' | 'contrato' | 'boleto' | 'recibo' | 'empresa' | 'cliente' | 'fornecedor' | 'outros';

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
