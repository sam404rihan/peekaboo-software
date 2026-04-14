// Firestore data model TypeScript interfaces
// Keep these in sync with security rules (to be added later)

export type UserRole = 'admin' | 'cashier';

export interface BaseDoc {
  id?: string; // Firestore document ID (set after fetch)
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}

export interface UserDoc extends BaseDoc {
  authUid: string; // Firebase Auth uid
  email: string;
  displayName?: string;
  role: UserRole;
  active: boolean;
  lastLoginAt?: string;
}

export interface CustomerDoc extends BaseDoc {
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  kidsDob?: string;
  gstin?: string;
  active: boolean;
  loyaltyPoints?: number;
  totalSpend?: number;
}

export interface ProductDoc extends BaseDoc {
  name: string;
  sku: string; // internal SKU
  brand?: string; // brand / manufacturer name
  category?: string;
  hsnCode?: string; // HSN/SAC code for GST
  unitPrice: number; // Rate — the price the store receives/buys the product at
  costPrice?: number;
  mrp?: number; // MRP — the selling price to customers (Maximum Retail Price)
  stock: number; // current on-hand quantity
  reorderLevel?: number; // threshold for low-stock alerts
  taxRatePct?: number; // e.g. 5 for 5%
  thresholdPrice?: number; // if set: GST = 5% when unitPrice < thresholdPrice, else 18%
  active: boolean;
  printedCount?: number; // number of barcode labels printed
}

export interface InvoiceLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number; // price at time of sale
  taxRatePct?: number;
  discountAmount?: number; // absolute amount per line
}

export interface InvoiceDoc extends BaseDoc {
  invoiceNumber: string; // sequential human-readable
  customerId?: string;
  customerName?: string; // denormalized for search and display
  items: InvoiceLineItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal?: number;
  grandTotal: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'wallet';
  paymentReferenceId?: string;
  balanceDue: number;
  placeOfSupply?: string; // for GST
  cashierUserId: string;
  cashierName?: string;
  status: 'paid' | 'partial' | 'unpaid' | 'void';
  issuedAt: string; // sale timestamp
  // Exchange metadata (optional)
  exchangeOfInvoiceId?: string; // original invoice id if this invoice was created for an exchange
  exchangeId?: string; // link to Exchanges doc
  notes?: string;
}

export interface OfferDoc extends BaseDoc {
  name: string;
  description?: string;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
  discountType?: 'percentage' | 'amount';
  discountValue?: number; // meaning depends on type
  productIds?: string[]; // targeted products
  // Extended targeting and rules
  categoryNames?: string[]; // target by product.category name
  ruleType?: 'flat' | 'percentage' | 'bogoSameItem'; // engine selector; flat/percentage mirror discountType, bogo uses buy/get
  buyQty?: number; // for BOGO same item
  getQty?: number; // for BOGO same item
  dobMonthOnly?: boolean; // apply only if customer's (kid's) DOB month matches current
  eventName?: string; // label like Diwali, Back-to-School
  priority?: number; // lower number = higher priority
  exclusive?: boolean; // if true, do not combine/stack
}

// Category management
export interface CategoryDoc extends BaseDoc {
  name: string;
  code: string; // short uppercase code used in barcodes (e.g., CLO)
  description?: string;
  active: boolean;
  defaultHsnCode?: string;
  defaultTaxRatePct?: number;
}

// Goods receipt (group of received items)
export interface GoodsReceiptLine {
  productId: string;
  sku: string;
  name: string;
  qty: number;
  unitCost?: number;
}

export interface GoodsReceiptDoc extends BaseDoc {
  supplierName?: string;
  supplierCode?: string;
  docNo?: string;
  docDate?: string; // ISO date
  note?: string;
  createdByUserId: string;
  lines: GoodsReceiptLine[];
}

export interface InventoryLogDoc extends BaseDoc {
  productId: string;
  type: 'adjustment' | 'sale' | 'purchase' | 'return' | 'damage';
  quantityChange: number; // negative for reduction
  reason?: string;
  relatedInvoiceId?: string;
  userId?: string; // who performed the change
  previousStock?: number;
  newStock?: number;
}

export interface BarcodeDoc extends BaseDoc {
  code: string; // actual barcode / QR string
  productId: string;
  type?: 'ean-13' | 'code-128' | 'qr';
  printedCount?: number;
}

export interface ReportDoc extends BaseDoc {
  type: 'daily-sales' | 'inventory-summary' | 'top-products' | 'low-stock';
  rangeStart?: string;
  rangeEnd?: string;
  // Use unknown to avoid any; callers must narrow.
  payload: unknown; // computed data snapshot
  generatedByUserId?: string;
}

export interface SettingsDoc extends BaseDoc {
  businessName: string;
  currency: string; // e.g. INR, USD
  taxInclusive: boolean; // whether prices include tax
  invoicePrefix?: string;
  nextInvoiceSequence?: number;
  lowStockThresholdDefault?: number;
  theme?: 'light' | 'dark' | 'system';
  // Branding fields for invoices/receipts (optional)
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  gstin?: string;
  phone?: string;
  email?: string;
  logoUrl?: string; // public URL (optional)
  receiptFooterNote?: string;
  receiptTermsConditions?: string; // multi-line terms and conditions for receipt
  // Receipt configuration (optional)
  receiptPaperWidthMm?: number; // e.g., 80 (default), 58 later
  receiptContentWidthMm?: number; // inner content width, e.g., 75 for 80mm paper
  autoPrintReceipt?: boolean; // hint: auto open print after checkout
  showTaxLine?: boolean; // show GST line on receipt totals
  googleReviewUrl?: string; // link to Google review page
  showReviewLink?: boolean; // whether to show review link/QR
  receiptTitle?: string; // e.g. "Tax Invoice", "Invoice", "Receipt"
  defaultPlaceOfSupply?: string; // default state code, e.g. "29" for Karnataka
}

// Exchange & Refunds
export interface ExchangeReturnLine {
  productId: string;
  qty: number;
  defect?: boolean; // if true, do not increase sellable stock
  creditPerUnit: number; // computed based on original invoice
  creditTotal: number; // qty * creditPerUnit
}

export interface ExchangeNewLine {
  productId: string;
  qty: number;
  unitPrice: number; // current price used for the exchanged item
  lineTotal: number; // qty * unitPrice (before discount/credit)
}

export interface ExchangeDoc extends BaseDoc {
  originalInvoiceId: string;
  returned: ExchangeReturnLine[];
  newItems: ExchangeNewLine[];
  totals: {
    returnCredit: number;
    newSubtotal: number;
    difference: number; // newSubtotal - returnCredit; >0 pay; <0 refund
  };
  payment?: { type: 'pay' | 'refund'; method: 'cash' | 'card' | 'upi' | 'wallet'; referenceId?: string };
  createdByUserId: string;
}

export interface RefundDoc extends BaseDoc {
  exchangeId: string;
  amount: number;
  method: 'cash' | 'card' | 'upi' | 'wallet';
  referenceId?: string;
  createdByUserId: string;
}

export interface CouponDoc extends BaseDoc {
  code: string; // uppercase unique code e.g. "SAVE10"
  description?: string;
  discountType: 'percentage' | 'amount';
  discountValue: number; // % or flat ₹ amount
  maxDiscountAmount?: number; // cap for percentage discounts e.g. max ₹200 off
  minOrderValue?: number; // minimum cart total to apply
  maxUses?: number; // 0 / undefined = unlimited
  usedCount: number;
  active: boolean;
  startsAt?: string; // ISO date string — coupon not valid before this date
  expiresAt?: string; // ISO date string
  applicableCategories?: string[]; // if set, discount applies only to items in these categories
  autoApply?: boolean; // if true, applies automatically at checkout — no code entry needed
}

// Collection name constants (helps avoid typos)
export const COLLECTIONS = {
  users: 'Users',
  customers: 'Customers',
  products: 'Products',
  invoices: 'Invoices',
  offers: 'Offers',
  inventoryLogs: 'InventoryLogs',
  categories: 'Categories',
  goodsReceipts: 'GoodsReceipts',
  barcodes: 'Barcodes',
  reports: 'Reports',
  settings: 'Settings',
  exchanges: 'Exchanges',
  refunds: 'Refunds',
  coupons: 'Coupons',
} as const;

// Common product categories for initial UI; can be extended in Settings later
export const CATEGORY_OPTIONS = [
  'Toys',
  'Clothes',
  'Books',
  'Stationery',
  'Accessories',
  'Electronics',
] as const;

export function categoryCode(cat?: string): string {
  if (!cat) return 'GEN';
  const trimmed = cat.trim();
  if (!trimmed) return 'GEN';
  return trimmed.slice(0, 3).toUpperCase();
}


export type UnifiedCsvRow = {
  reportType: 'ACCOUNTING' | 'GSTR1_B2B' | 'GSTR1_B2CL' | 'GSTR1_HSN';
  date?: string;
  invoiceNumber?: string;
  gstin?: string;
  sku?: string;
  hsn?: string;
  taxableValue?: number;
  taxRate?: number;
  taxAmount?: number;
  invoiceValue?: number;
  paymentMode?: string;
  placeOfSupply?: string;
};
