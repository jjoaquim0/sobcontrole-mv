export type UserRole = 'admin' | 'manager' | 'employee';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'inactive';

export type PaymentMethod = 'cash' | 'money' | 'credit_card' | 'debit_card' | 'pix' | 'bank_slip' | 'bank_transfer' | 'other';

export type SaleStatus = 'paid' | 'pending' | 'canceled' | 'cancelled';

export type PurchaseStatus = 'paid' | 'pending' | 'canceled';

export type TransactionStatus = 'paid' | 'pending' | 'late' | 'canceled';

export type DocumentStatus = 'active' | 'archived';

export type CustomerType = 'individual' | 'corporate'; // pf ou pj

export type CommonStatus = 'active' | 'inactive';

export interface Company {
  id: string;
  name: string;
  cnpj: string;
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
  status: PurchaseStatus;
  paymentMethod: PaymentMethod;
  createdAt: string;
  createdBy: string; // ID do Profile
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

export interface Document {
  id: string;
  companyId: string;
  name: string;
  url: string;
  category: string;
  size: number; // em bytes
  status: DocumentStatus;
  createdAt: string;
}
