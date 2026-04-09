"use client";
import { db, auth } from "@/lib/firebase";
import { collection, serverTimestamp, runTransaction, doc, increment } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { COLLECTIONS, GoodsReceiptDoc, GoodsReceiptLine } from "@/lib/models";

export type CheckoutInput = {
  lines: Array<{ productId: string; name: string; qty: number; unitPrice: number; lineDiscount?: number; taxRatePct?: number }>;
  billDiscount?: number;
  // Single payment only
  paymentMethod?: 'cash' | 'card' | 'upi' | 'wallet';
  paymentReferenceId?: string;
  cashierUserId?: string;
  customerId?: string;
  customerName?: string;
  cashierName?: string;
  notes?: string;
  // Optional idempotency key to prevent duplicate invoices on retries
  opId?: string;
};

export async function checkoutCart(input: CheckoutInput): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db!;
  const nowIso = new Date().toISOString();
  // Basic validations: forbid negative qty/price/discounts and ensure sensible totals
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error("Cart is empty");
  }
  for (const l of input.lines) {
    if (!l || typeof l.productId !== 'string' || !l.productId) throw new Error("Invalid line: product missing");
    if (!(Number.isFinite(l.qty) && l.qty > 0)) throw new Error("Invalid line: qty must be > 0");
    if (!(Number.isFinite(l.unitPrice) && l.unitPrice >= 0)) throw new Error("Invalid line: unit price must be >= 0");
    if (l.lineDiscount != null) {
      if (!(Number.isFinite(l.lineDiscount) && (l.lineDiscount as number) >= 0)) throw new Error("Invalid line: discount must be >= 0");
      const lineTotal = l.unitPrice * l.qty;
      if ((l.lineDiscount as number) > lineTotal) throw new Error("Invalid line: discount exceeds line total");
    }
  }
  if (input.billDiscount != null) {
    if (!(Number.isFinite(input.billDiscount) && (input.billDiscount as number) >= 0)) {
      throw new Error("Invalid bill discount: must be >= 0");
    }
  }
  // Compute inclusive totals: Subtotal = sum of (MRP * qty - lineDiscounts)
  const linesWithNet = input.lines.map(l => ({
    ...l,
    net: Math.round((l.unitPrice * l.qty - (l.lineDiscount ?? 0)) * 100) / 100,
  }));
  const subtotal = Math.round(linesWithNet.reduce((s, l) => s + l.net, 0) * 100) / 100;
  const billDisc = input.billDiscount ?? 0;
  if (billDisc > subtotal) {
    throw new Error("Bill discount cannot exceed subtotal");
  }
  // Tax is derived from MRP (unitPrice) only, not reduced by discounts (post-tax discounts)
  const taxTotal = Math.round(input.lines.reduce((s, l) => {
    const rate = typeof l.taxRatePct === 'number' ? l.taxRatePct : 0;
    const r = (Number(rate) || 0) / 100;
    const gstPerUnit = r > 0 ? (l.unitPrice - l.unitPrice / (1 + r)) : 0;
    return s + gstPerUnit * l.qty;
  }, 0) * 100) / 100;
  const grandTotal = Math.max(0, Math.round((subtotal - billDisc) * 100) / 100);
  const method = input.paymentMethod ?? 'cash';
  const refId = input.paymentReferenceId;
  const cashierUserId = auth?.currentUser?.uid ?? input.cashierUserId ?? 'current-user';
  const cashierName = input.cashierName;

  // Single payment path only; no split payments

  // Transaction: decrement stock for each product and then create invoice
  const invoiceId = await runTransaction(dbx, async (tx) => {
    // Aggregate requested quantities per product to validate stock atomically
    const qtyByProduct = new Map<string, number>();
    for (const l of input.lines) {
      const prev = qtyByProduct.get(l.productId) || 0;
      qtyByProduct.set(l.productId, prev + l.qty);
    }

    // Prepare invoice reference; support idempotency via provided opId as fixed document ID
    const invRef = (input.opId && typeof input.opId === 'string')
      ? doc(dbx, COLLECTIONS.invoices, input.opId)
      : doc(collection(dbx, COLLECTIONS.invoices));

    // If an invoice with this id already exists, treat as idempotent success and return existing id
    const existingInvSnap = await tx.get(invRef);
    if (existingInvSnap.exists()) {
      return invRef.id;
    }

  // Sequential invoice number (prefix + zero-padded counter) from Settings/app
  const settingsRef = doc(dbx, COLLECTIONS.settings, 'app');
  const settingsSnap = await tx.get(settingsRef);
    let prefix = 'INV';
    let nextSeq = 1;
    if (settingsSnap.exists()) {
      const s = settingsSnap.data() as any;
      prefix = typeof s.invoicePrefix === 'string' && s.invoicePrefix.trim() ? s.invoicePrefix.trim() : 'INV';
      nextSeq = Number(s.nextInvoiceSequence ?? 1) || 1;
    }
    const seqStr = String(nextSeq).padStart(6, '0');
    const invoiceNumber = `${prefix}-${seqStr}`;
    // Validate stock levels for all involved products (all reads must occur before any writes in a transaction)
    for (const [productId, requested] of qtyByProduct.entries()) {
      const pRef = doc(dbx, COLLECTIONS.products, productId);
      const snap = await tx.get(pRef);
      if (!snap.exists()) {
        throw new Error(`Product not found: ${productId}`);
      }
      const pdata = snap.data() as any;
      const current = Number(pdata?.stock ?? 0) || 0;
      if (requested > current) {
        const name = typeof pdata?.name === 'string' ? pdata.name : 'Item';
        throw new Error(`Insufficient stock for ${name}. Available: ${current}, requested: ${requested}`);
      }
    }

    // From this point onwards, only writes
  // Bump invoice counter
  tx.set(settingsRef, { invoicePrefix: prefix, nextInvoiceSequence: nextSeq + 1, updatedAt: serverTimestamp() }, { merge: true });

    // Decrement stock and create inventory logs per line (after validation)
    for (const l of input.lines) {
      const pRef = doc(dbx, COLLECTIONS.products, l.productId);
      tx.update(pRef, { stock: increment(-l.qty), updatedAt: serverTimestamp() });
      const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
      tx.set(logRef, {
        productId: l.productId,
        quantityChange: -l.qty,
        type: 'sale',
        reason: 'sale',
        userId: auth?.currentUser?.uid ?? input.cashierUserId ?? 'current-user',
        relatedInvoiceId: invRef.id,
        unitCost: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Create invoice document
    const inv: Omit<InvoiceDoc, 'id'> = {
      invoiceNumber,
      items: linesWithNet.map((l: any) => ({ 
        productId: l.productId, 
        name: l.name, 
        quantity: l.qty, 
        unitPrice: l.unitPrice, 
        taxRatePct: l.taxRatePct ?? 0,
        discountAmount: l.lineDiscount ?? 0 
      })),
      subtotal,
      taxTotal,
      discountTotal: billDisc,
      grandTotal,
      paymentMethod: method,
      balanceDue: 0,
      cashierUserId,
      status: 'paid',
      issuedAt: nowIso,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    // Create invoice inside the transaction using tx.set
    tx.set(invRef, {
      ...inv,
      ...(input.notes ? { notes: input.notes } : {}),
      ...(input.paymentReferenceId ? { paymentReferenceId: input.paymentReferenceId } : {}),
      ...(input.cashierName ? { cashierName: input.cashierName } : {}),
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.customerName ? { customerName: input.customerName } : {}),
      // Idempotency: allow external callers to set opId to avoid duplicates on replay
      ...(typeof input.opId === 'string' ? { opId: input.opId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Loyalty: award points to customer if present
    if (input.customerId) {
      const points = Math.floor(grandTotal / 100);
      if (points > 0 || grandTotal > 0) {
        const cRef = doc(dbx, COLLECTIONS.customers, input.customerId);
        tx.set(cRef, { loyaltyPoints: increment(points), totalSpend: increment(grandTotal), updatedAt: serverTimestamp() }, { merge: true });
      }
    }
    return invRef.id;
  });

  return invoiceId;
}


// Inventory: generic stock adjustment with log entry
export type AdjustReason = 'sale' | 'receive' | 'correction' | 'stocktake' | 'return';
export async function adjustStock(params: {
  productId: string;
  delta: number; // + for receive, - for deduction
  reason: AdjustReason;
  userId?: string;
  note?: string;
  unitCost?: number;
  relatedInvoiceId?: string;
  relatedReceiptId?: string;
}): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db!;
  await runTransaction(dbx, async (tx) => {
    const pRef = doc(dbx, COLLECTIONS.products, params.productId);
    // Use atomic increment without read for speed; logs will not store from/to in this minimal version
    tx.update(pRef, { stock: increment(params.delta), updatedAt: serverTimestamp() });
    const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
    const logType: 'sale' | 'purchase' | 'return' | 'adjustment' | 'damage' =
      params.reason === 'sale' ? 'sale'
      : params.reason === 'receive' ? 'purchase'
      : params.reason === 'return' ? 'return'
      : 'adjustment';
    tx.set(logRef, {
      productId: params.productId,
      quantityChange: params.delta,
      type: logType,
      reason: params.reason,
      userId: auth?.currentUser?.uid ?? params.userId ?? 'system',
      note: params.note ?? null,
      relatedInvoiceId: params.relatedInvoiceId ?? null,
      relatedReceiptId: params.relatedReceiptId ?? null,
      unitCost: params.unitCost ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

// Inventory: receive multiple items (Option E backend) and create a GoodsReceipt document
export async function receiveStock(params: {
  createdByUserId: string;
  supplierName?: string;
  supplierCode?: string;
  docNo?: string;
  docDate?: string; // ISO
  note?: string;
  lines: GoodsReceiptLine[]; // { productId, sku, name, qty, unitCost? }
}): Promise<string> {
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db!;
  if (!params || !Array.isArray(params.lines) || params.lines.length === 0) {
    throw new Error("No lines to receive");
  }
  for (const line of params.lines) {
    if (!(Number.isFinite(line.qty) && line.qty > 0)) throw new Error("Receive qty must be > 0");
    if (line.unitCost != null && !(Number.isFinite(line.unitCost) && line.unitCost >= 0)) throw new Error("Unit cost must be >= 0");
  }
  const now = new Date().toISOString();
  const receiptId = await runTransaction(dbx, async (tx) => {
    const recRef = doc(collection(dbx, COLLECTIONS.goodsReceipts));
    const receipt: Omit<GoodsReceiptDoc, 'id'> = {
      createdByUserId: auth?.currentUser?.uid ?? params.createdByUserId,
      lines: params.lines,
      createdAt: now,
      updatedAt: now,
    };
    tx.set(recRef, { 
      ...receipt, 
      ...(params.supplierName ? { supplierName: params.supplierName } : {}),
      ...(params.supplierCode ? { supplierCode: params.supplierCode } : {}),
      ...(params.docNo ? { docNo: params.docNo } : {}),
      ...(params.docDate ? { docDate: params.docDate } : {}),
      ...(params.note ? { note: params.note } : {}),
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp() 
    });
    // Apply increments and logs per line
    for (const line of params.lines) {
      const pRef = doc(dbx, COLLECTIONS.products, line.productId);
      tx.update(pRef, { stock: increment(line.qty), updatedAt: serverTimestamp() });
      const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
      tx.set(logRef, {
        productId: line.productId,
        quantityChange: line.qty,
        type: 'purchase',
        reason: 'receive',
        userId: auth?.currentUser?.uid ?? params.createdByUserId,
        note: params.note ?? null,
        relatedReceiptId: recRef.id,
        unitCost: line.unitCost ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return recRef.id;
  });
  return receiptId;
}
