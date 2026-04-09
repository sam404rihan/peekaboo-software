"use client";
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, runTransaction, serverTimestamp, increment, getDocs, query, where } from "firebase/firestore";
import { COLLECTIONS, ExchangeDoc, InvoiceDoc, ProductDoc } from "@/lib/models";
import { splitInclusive } from "@/lib/tax";
import { listProducts } from "@/lib/products";

function sum<T>(arr: T[], f: (x: T) => number) { return arr.reduce((s, x) => s + f(x), 0); }

export type ExchangeRequest = {
  originalInvoiceId: string;
  returned: Array<{ productId: string; qty: number; defect?: boolean }>;
  newItems: Array<{ productId: string; qty: number }>;
  cashierUserId: string;
  cashierName?: string;
  paymentMethod?: 'cash'|'card'|'upi'|'wallet';
  paymentReferenceId?: string;
  refundMethod?: 'cash'|'card'|'upi'|'wallet';
  refundReferenceId?: string;
  // Optional idempotency key to prevent duplicate processing on retries
  opId?: string;
};

export async function performExchange(req: ExchangeRequest): Promise<{ exchangeId: string; newInvoiceId?: string; refundId?: string; difference: number }>{
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db!;
  // Require at least one new item to proceed with an exchange
  if (!req.newItems || req.newItems.length === 0) {
    throw new Error("Add at least one product to buy in this exchange.");
  }
  // Load original invoice and product catalog for pricing
  const invSnap = await getDoc(doc(dbx, COLLECTIONS.invoices, req.originalInvoiceId));
  if (!invSnap.exists()) throw new Error("Original invoice not found");
  const inv = invSnap.data() as InvoiceDoc;
  // Track prior returned quantities per product (allow multiple exchanges up to original qty)
  const priorQ = query(collection(dbx, COLLECTIONS.exchanges), where('originalInvoiceId', '==', req.originalInvoiceId));
  const priorSnap = await getDocs(priorQ);
  const priorReturnedQty = new Map<string, number>();
  priorSnap.forEach(d => {
    const data = d.data() as any;
    const ret: any[] = Array.isArray(data.returned) ? data.returned : [];
    for (const r of ret) {
      if (r?.productId && Number(r?.qty) > 0) {
        const pid = String(r.productId);
        const prev = priorReturnedQty.get(pid) || 0;
        priorReturnedQty.set(pid, prev + Number(r.qty));
      }
    }
  });


  // Enforce 14 calendar days window (store local assumed == client local). If needed, shift to TZ later.
  const issued = new Date(inv.issuedAt);
  const today = new Date();
  const dayDiff = Math.floor((today.getTime() - issued.getTime()) / (24*60*60*1000));
  if (dayDiff > 14) throw new Error("Exchange window (14 days) exceeded");

  // Build a quick map of original items
  const lineMap = new Map<string, { qty: number; unitPrice: number; discountAmount: number }>();
  for (const it of inv.items) {
    const prev = lineMap.get(it.productId) || { qty: 0, unitPrice: it.unitPrice, discountAmount: 0 };
    lineMap.set(it.productId, { qty: prev.qty + it.quantity, unitPrice: it.unitPrice, discountAmount: (prev.discountAmount || 0) + (it.discountAmount || 0) });
  }
  const originalBase = sum(inv.items, (it) => it.unitPrice * it.quantity) || 1;
  const totalLineDiscount = sum(inv.items, (it) => Number(it.discountAmount || 0));
  const billDiscRemaining = Math.max(0, Number(inv.discountTotal || 0) - totalLineDiscount);

  // Compute credit per returned line using paid price including proportional bill discount
  const returnLines = req.returned.map((r) => {
    const li = lineMap.get(r.productId);
    if (!li) throw new Error("Returned product not in original invoice");
    const prevReturned = priorReturnedQty.get(r.productId) || 0;
    const remaining = Math.max(0, li.qty - prevReturned);
    if (!(r.qty > 0 && r.qty <= remaining)) throw new Error(`Invalid return quantity. Remaining returnable qty: ${remaining}`);
    const base = li.unitPrice; // per unit base
    // Proportional share of remaining bill discount per unit based on original proportions
    const lineBaseTotal = li.unitPrice * li.qty;
    const proportionalOnLine = billDiscRemaining * (lineBaseTotal / originalBase);
    const proportionalPerUnit = proportionalOnLine / li.qty;
    const lineDiscPerUnit = (li.discountAmount || 0) / li.qty;
    const creditPerUnit = Math.max(0, base - lineDiscPerUnit - proportionalPerUnit);
    const creditTotal = Number((creditPerUnit * r.qty).toFixed(2));
    return { productId: r.productId, qty: r.qty, defect: !!r.defect, creditPerUnit: Number(creditPerUnit.toFixed(2)), creditTotal };
  });
  const returnCredit = sum(returnLines, (x) => x.creditTotal);

  // New items pricing from catalog
  const products = await listProducts();
  const pmap = new Map<string, ProductDoc>();
  for (const p of products) if (p.id) pmap.set(p.id, p);
  
  // Validate stock availability for new items BEFORE proceeding
  const newLines = req.newItems.map((n) => {
    const p = pmap.get(n.productId);
    if (!p) throw new Error(`Product not found: ${n.productId}`);
    if (!(n.qty > 0)) throw new Error("New item qty must be > 0");
    
    // Check stock availability
    if (p.stock < n.qty) {
      throw new Error(
        `Insufficient stock for "${p.name}". Available: ${p.stock}, Requested: ${n.qty}`
      );
    }
    
    const unitPrice = p.unitPrice;
    const lineTotal = Number((unitPrice * n.qty).toFixed(2));
    return { productId: n.productId, qty: n.qty, unitPrice, lineTotal, productName: p.name };
  });
  const newSubtotal = sum(newLines, (x) => x.lineTotal);
  const difference = Number((newSubtotal - returnCredit).toFixed(2));

  const result = await runTransaction(dbx, async (tx) => {
    // Prepare refs
  const exRef = doc(collection(dbx, COLLECTIONS.exchanges));
  const refundRef = doc(collection(dbx, COLLECTIONS.refunds));
  const invRef = doc(collection(dbx, COLLECTIONS.invoices));
    // READ PHASE (all reads before any writes)
    // Gather stock availability for new items
    let settingsPrefix = 'INV';
    let settingsNextSeq = 1;
  if (newLines.length > 0) {
      const needByProduct = new Map<string, number>();
      for (const n of newLines) {
        needByProduct.set(n.productId, (needByProduct.get(n.productId) || 0) + n.qty);
      }
      for (const [pid, need] of needByProduct.entries()) {
        const pRef = doc(dbx, COLLECTIONS.products, pid);
        const snap = await tx.get(pRef);
        if (!snap.exists()) throw new Error(`Product not found: ${pid}`);
        const data = snap.data() as any;
        const curr = Number(data?.stock ?? 0) || 0;
        if (need > curr) {
          const nm = typeof data?.name === 'string' ? data.name : 'Item';
          throw new Error(`Insufficient stock for ${nm}. Available: ${curr}, requested: ${need}`);
        }
      }
      // Read settings for invoice numbering
      const sRef = doc(dbx, COLLECTIONS.settings, 'app');
      const sSnap = await tx.get(sRef);
      if (sSnap.exists()) {
        const s = sSnap.data() as any;
        settingsPrefix = typeof s.invoicePrefix === 'string' && s.invoicePrefix.trim() ? s.invoicePrefix.trim() : 'INV';
        settingsNextSeq = Number(s.nextInvoiceSequence ?? 1) || 1;
      }
    }

    // WRITE PHASE (no more reads from here)
    // For defect returns, log as damage without stock change here.
    for (const r of returnLines) {
      if (r.defect) {
        const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
        tx.set(logRef, {
          productId: r.productId,
          quantityChange: 0,
          type: 'damage',
          reason: 'exchange-defect',
          relatedInvoiceId: req.originalInvoiceId,
          userId: req.cashierUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Create exchange doc (omit 'payment' field if not provided to avoid undefined)
    const maybePayment = difference > 0
      ? (req.paymentMethod ? { type: 'pay', method: req.paymentMethod, ...(req.paymentReferenceId ? { referenceId: req.paymentReferenceId } : {}) } : null)
      : (difference < 0 ? (req.refundMethod ? { type: 'refund', method: req.refundMethod, ...(req.refundReferenceId ? { referenceId: req.refundReferenceId } : {}) } : null) : null);

    const exchangeData: any = {
      originalInvoiceId: req.originalInvoiceId,
      returned: returnLines,
      newItems: newLines,
      totals: { returnCredit, newSubtotal, difference },
      createdByUserId: req.cashierUserId,
    };
    if (maybePayment) exchangeData.payment = maybePayment;
    if (req.opId) exchangeData.opId = req.opId;
    exchangeData.createdAt = serverTimestamp();
    exchangeData.updatedAt = serverTimestamp();
    tx.set(exRef, exchangeData);

    let createdInvoiceId: string | undefined;
    let createdRefundId: string | undefined;

    // New invoice if there are new items
    if (newLines.length > 0) {
      const itemsForInvoice = newLines.map(n => ({ 
        productId: n.productId, 
        name: pmap.get(n.productId)?.name || '', 
        quantity: n.qty, 
        unitPrice: n.unitPrice, 
        taxRatePct: pmap.get(n.productId)?.taxRatePct ?? 0, 
        discountAmount: 0 
      }));
      const discountTotal = Math.max(0, Math.min(returnCredit, newSubtotal));
      const subtotal = newSubtotal;
      const taxTotal = Math.round(
        newLines.reduce((s, n) => {
          const rate = pmap.get(n.productId)?.taxRatePct ?? 0;
          const { gst } = splitInclusive(n.unitPrice, rate);
          return s + gst * n.qty;
        }, 0) * 100
      ) / 100;
      const grandTotal = Number((subtotal - discountTotal).toFixed(2));
      const nowIso = new Date().toISOString();

      // Use settings read above; now bump sequence
      const sRef = doc(dbx, COLLECTIONS.settings, 'app');
      const seqStr = String(settingsNextSeq).padStart(6, '0');
      const invoiceNumber = `${settingsPrefix}-${seqStr}`;
      tx.set(sRef, { invoicePrefix: settingsPrefix, nextInvoiceSequence: settingsNextSeq + 1, updatedAt: serverTimestamp() }, { merge: true });

      const invDoc: Omit<InvoiceDoc, 'id'> = {
        invoiceNumber,
        items: itemsForInvoice,
        subtotal,
        taxTotal,
        discountTotal,
        grandTotal,
        paymentMethod: difference > 0 ? (req.paymentMethod || 'cash') : 'cash',
        ...(difference > 0 && req.paymentReferenceId ? { paymentReferenceId: req.paymentReferenceId } : {}),
        balanceDue: 0,
        cashierUserId: req.cashierUserId,
        ...(req.cashierName ? { cashierName: req.cashierName } : {}),
        status: 'paid',
        issuedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        exchangeOfInvoiceId: req.originalInvoiceId,
        exchangeId: exRef.id,
        ...(inv.customerId ? { customerId: inv.customerId } : {}),
        ...(difference > 0 ? { notes: `Extra charge for exchange — original invoice ${inv.invoiceNumber}` } : {}),
      } as any;
      tx.set(invRef, { ...invDoc, ...req.opId ? { opId: req.opId } : {}, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      createdInvoiceId = invRef.id;

      // Decrement stock for new items and write logs
      for (const n of newLines) {
        const pRef = doc(dbx, COLLECTIONS.products, n.productId);
        tx.update(pRef, { stock: increment(-n.qty), updatedAt: serverTimestamp() });
        const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
        tx.set(logRef, {
          productId: n.productId,
          quantityChange: -n.qty,
          type: 'sale',
          reason: 'exchange',
          relatedInvoiceId: createdInvoiceId,
          userId: req.cashierUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Loyalty: award points only for net paid amount (grandTotal is difference when >0)
      if (inv.customerId && grandTotal > 0) {
        const cRef = doc(dbx, COLLECTIONS.customers, inv.customerId);
        const pts = Math.floor(grandTotal / 100);
        tx.set(cRef, { loyaltyPoints: increment(pts), totalSpend: increment(grandTotal), updatedAt: serverTimestamp() }, { merge: true });
      }
    }

    // Apply stock increases and logs for non-defect returns
    for (const r of returnLines) {
      if (!r.defect) {
        const pRef = doc(dbx, COLLECTIONS.products, r.productId);
        tx.update(pRef, { stock: increment(r.qty), updatedAt: serverTimestamp() });
        const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
        tx.set(logRef, {
          productId: r.productId,
          quantityChange: r.qty,
          type: 'return',
          reason: 'exchange',
          relatedInvoiceId: req.originalInvoiceId,
          userId: req.cashierUserId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Refund if credit exceeds new subtotal
    if (difference < 0) {
      const amount = Math.abs(difference);
      const refundDoc = {
        exchangeId: exRef.id,
        amount,
        method: req.refundMethod || 'cash',
        ...(req.refundReferenceId ? { referenceId: req.refundReferenceId } : {}),
        createdByUserId: req.cashierUserId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      tx.set(refundRef, refundDoc);
      createdRefundId = refundRef.id;

      // Loyalty: deduct points for refunded amount from original customer
      if (inv.customerId && amount > 0) {
        const cRef = doc(dbx, COLLECTIONS.customers, inv.customerId);
        const pts = Math.floor(amount / 100);
        tx.set(cRef, { loyaltyPoints: increment(-pts), totalSpend: increment(-amount), updatedAt: serverTimestamp() }, { merge: true });
      }
    }

    return { exchangeId: exRef.id, newInvoiceId: createdInvoiceId, refundId: createdRefundId, difference };
  });

  return result as any;
}
