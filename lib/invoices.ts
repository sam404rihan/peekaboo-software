"use client";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, orderBy, query, where, type DocumentData, type QuerySnapshot, type QueryConstraint, type FirestoreError } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { COLLECTIONS } from "@/lib/models";

function asString(v: unknown, def = ""): string { return typeof v === "string" ? v : def; }
function asNumber(v: unknown, def = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }
  return def;
}
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }
function asArrayOfRecords(v: unknown): v is Array<Record<string, unknown>> { return Array.isArray(v) && v.every(isRecord); }
function asPaymentMethod(v: unknown): InvoiceDoc["paymentMethod"] {
  return v === "card" || v === "upi" || v === "wallet" ? v : "cash";
}
function asInvoiceStatus(v: unknown): InvoiceDoc["status"] {
  return v === "partial" || v === "unpaid" || v === "void" ? v : "paid";
}

export function toInvoiceDoc(id: string, data: Record<string, unknown>): InvoiceDoc {
  const now = new Date().toISOString();
  return {
    id,
    invoiceNumber: asString(data.invoiceNumber, id),
    customerId: typeof data.customerId === "string" ? data.customerId : undefined,
    customerName: typeof data.customerName === "string" ? data.customerName : undefined,
    items: asArrayOfRecords(data.items) ? data.items.map((it) => ({
      productId: asString(it.productId),
      name: asString(it.name),
      quantity: asNumber(it.quantity, 0),
      unitPrice: asNumber(it.unitPrice, 0),
      taxRatePct: it.taxRatePct != null ? asNumber(it.taxRatePct) : undefined,
      discountAmount: it.discountAmount != null ? asNumber(it.discountAmount) : undefined,
    })) : [],
    subtotal: asNumber(data.subtotal, 0),
    taxTotal: asNumber(data.taxTotal, 0),
    discountTotal: data.discountTotal != null ? asNumber(data.discountTotal) : undefined,
    grandTotal: asNumber(data.grandTotal, 0),
    paymentMethod: asPaymentMethod(data.paymentMethod),
    paymentReferenceId: typeof data.paymentReferenceId === "string" ? data.paymentReferenceId : undefined,
    balanceDue: asNumber(data.balanceDue, 0),
    cashierUserId: asString(data.cashierUserId, ""),
    cashierName: typeof data.cashierName === "string" ? data.cashierName : undefined,
    status: asInvoiceStatus(data.status),
    issuedAt: asString(data.issuedAt, now),
    createdAt: asString(data.createdAt, now),
    updatedAt: asString(data.updatedAt, now),
    exchangeOfInvoiceId: typeof data.exchangeOfInvoiceId === 'string' ? data.exchangeOfInvoiceId : undefined,
    exchangeId: typeof data.exchangeId === 'string' ? data.exchangeId : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
  };
}

export type InvoiceFilters = {
  cashierUserId?: string; // legacy: filter by cashier uid (still supported)
  cashierNameEq?: string; // new: filter by cashierName (use email value when captured)
  status?: InvoiceDoc["status"]; // filter by status
  issuedFromIso?: string; // inclusive start
  issuedToIso?: string; // inclusive end
};

export function observeInvoices(cb: (invoices: InvoiceDoc[]) => void, filters?: InvoiceFilters) {
  // Be resilient if Firebase isn't initialized (e.g., missing envs in dev)
  if (!db) {
    try { cb([]); } catch { /* noop */ }
    return () => {};
  }
  const col = collection(db, COLLECTIONS.invoices);

  const constraints: QueryConstraint[] = [];
  if (filters?.status) constraints.push(where("status", "==", filters.status));
  if (filters?.cashierUserId) constraints.push(where("cashierUserId", "==", filters.cashierUserId));
  if (filters?.cashierNameEq) constraints.push(where("cashierName", "==", filters.cashierNameEq));
  if (filters?.issuedFromIso) constraints.push(where("issuedAt", ">=", filters.issuedFromIso));
  if (filters?.issuedToIso) constraints.push(where("issuedAt", "<=", filters.issuedToIso));
  constraints.push(orderBy("issuedAt", "desc"));

  const applyClientFilters = (list: InvoiceDoc[]): InvoiceDoc[] => {
    let out = list;
    if (filters?.status) out = out.filter((i) => i.status === filters.status);
    if (filters?.cashierUserId) out = out.filter((i) => i.cashierUserId === filters.cashierUserId);
    if (filters?.cashierNameEq) out = out.filter((i) => (i.cashierName || "") === filters.cashierNameEq);
    if (filters?.issuedFromIso) out = out.filter((i) => i.issuedAt >= filters.issuedFromIso!);
    if (filters?.issuedToIso) out = out.filter((i) => i.issuedAt <= filters.issuedToIso!);
    return out;
  };

  let activeUnsub: (() => void) | null = null;

  const subscribeMain = () => {
    const q = query(col, ...constraints);
    activeUnsub = onSnapshot(
      q,
      (snap: QuerySnapshot<DocumentData>) => {
        const list: InvoiceDoc[] = snap.docs.map((d) => toInvoiceDoc(d.id, d.data() as Record<string, unknown>));
        cb(list);
      },
      (err: FirestoreError) => {
        if (err.code === "failed-precondition") {
          // Likely missing composite index; fallback to client-side filtering
          console.warn("Missing index for invoices query; falling back to client-side filtering.", err.message);
          if (activeUnsub) { activeUnsub(); activeUnsub = null; }
          const fallbackQ = query(col, orderBy("issuedAt", "desc"));
          activeUnsub = onSnapshot(fallbackQ, (snap2: QuerySnapshot<DocumentData>) => {
            const list: InvoiceDoc[] = snap2.docs.map((d) => toInvoiceDoc(d.id, d.data() as Record<string, unknown>));
            cb(applyClientFilters(list));
          });
        } else {
          console.error("Invoices snapshot error:", err);
        }
      }
    );
  };

  subscribeMain();

  return () => {
    if (activeUnsub) activeUnsub();
  };
}
