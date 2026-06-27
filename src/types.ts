export type UserRole = "ADMIN" | "SUPERVISOR" | "CASHIER";

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  supplier: string;
  costPrice: number;
  salePrice: number;
  vatRate: number; // e.g. 16 for Moçambique
  stock: number;
  minStock: number;
  expiryDate?: string;
  image?: string;
  emoji?: string;
  promotion?: string; // e.g. "PROMO", "MAIS_VENDIDO", "NOVO", "DESCONTO"
  isFavorite?: boolean;
  brand?: string;
  weightBased?: boolean; // True if sold per kg
  barcode?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number; // percentage or fixed
  vatRate: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  nuit: string; // Moçambique Tax ID
  totalSpent: number;
  purchaseCount: number;
  lastPurchaseDate?: string;
  debt: number;
  loyaltyPoints: number;
  creditBlocked?: boolean;
  settlements?: { id: string, date: string, amount: number, method: string }[];
}

export interface Transaction {
  id: string;
  invoiceNumber: string;
  timestamp: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    vatAmount: number;
    discountAmount: number;
    subtotal: number;
  }[];
  subtotal: number;
  vatTotal: number;
  discountTotal: number;
  grandTotal: number;
  paymentMethod: "CASH" | "MPESA_PAGA_FACIL" | "EMOLA" | "POS_CARD" | "CREDIT_CARD" | "BANK_TRANSFER" | "MIXED" | "DEBT";
  paymentDetails?: string;
  cashierName: string;
  customerName?: string;
  customerId?: string;
  nuit?: string;
}

export interface CashFlowEntry {
  id: string;
  timestamp: string;
  type: "INPUT" | "REINFORCEMENT" | "EXPENSE" | "QUEBRA";
  amount: number;
  reason: string;
  responsibleUser: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  userRole: UserRole;
  action: string;
  module: string;
  details: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  contact: string;
  salary: number;
  admissionDate: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
}

export interface SystemSettings {
  companyName: string;
  companyAddress: string;
  companyNuit: string;
  vatDefaultRate: number;
  currency: string; // e.g. MT, Meticais
  logoUrl?: string;
  autoBackup: boolean;
  smsGateway: string;
  smtpServer: string;
  reportRecipientEmail: string;
  reportHour: string;
  reportFrequency: "daily" | "weekly";
  slogan?: string;
  storeAddress?: string;
  storeContact?: string;
  defaultVat?: number;
  cloudBackupEnabled?: boolean;
  backupFrequency?: string;
  backupCron?: string;
  backupTime?: string;
  cloudProvider?: string;
  mpesaEnabled?: boolean;
  mpesaShortcode?: string;
  mpesaApiKey?: string;
  mpesaSecret?: string;
  mpesaWebhookUrl?: string;
  emolaEnabled?: boolean;
  emolaShortcode?: string;
  emolaApiKey?: string;
  emolaSecret?: string;
  emolaWebhookUrl?: string;
  whatsappEnabled?: boolean;
  whatsappProvider?: "DIRECT_LINK" | "EVOLUTION_API" | "TWILIO" | "META_CLOUD";
  whatsappApiEndpoint?: string;
  whatsappToken?: string;
  whatsappPhoneId?: string;
  managerWhatsappPhone?: string;
}

export interface MasterclassVideo {
  id: string;
  title: string;
  duration: string;
  description: string;
  thumbnail: string;
  category: string;
  steps: string[];
  instructor?: string;
}

export interface SalesForecast {
  forecastText: string;
  growthRate: number;
  growthTrend: "up" | "down" | "stable";
  suggestedCampaigns: string[];
}
