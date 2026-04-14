"use client";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  serverTimestamp,
  updateDoc,
  type QuerySnapshot,
  type DocumentData,
} from "firebase/firestore";
import { increment } from "firebase/firestore";
import { COLLECTIONS, ProductDoc } from "./models";

function assertDb() {
  if (!db) throw new Error("Firestore not initialized");
}

function asString(v: unknown, def = ""): string {
  return typeof v === "string" ? v : def;
}

function asNumber(v: unknown, def = 0): number {
  if (v == null) return def;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function asBool(v: unknown, def = true): boolean {
  return typeof v === "boolean" ? v : def;
}

function toProductDoc(id: string, data: Record<string, unknown>): ProductDoc {
  const now = new Date().toISOString();
  return {
    id,
    name: asString(data.name, ""),
    sku: asString(data.sku, ""),
    category: typeof data.category === "string" ? data.category : undefined,
    hsnCode: typeof data.hsnCode === "string" ? data.hsnCode : undefined,
    unitPrice: asNumber(data.unitPrice, 0),       // This is the Selling Price
    mrp: data.mrp != null ? asNumber(data.mrp) : undefined, // This is the new MRP field
    costPrice: data.costPrice != null ? asNumber(data.costPrice) : undefined,
    stock: asNumber(data.stock, 0),
    reorderLevel: data.reorderLevel != null ? asNumber(data.reorderLevel) : undefined,
    taxRatePct: data.taxRatePct != null ? asNumber(data.taxRatePct) : undefined,
    thresholdPrice: data.thresholdPrice != null ? asNumber(data.thresholdPrice) : undefined,
    active: asBool(data.active, true),
    printedCount: data.printedCount != null ? asNumber(data.printedCount, 0) : 0,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : now,
  };
}

export async function listProducts(): Promise<ProductDoc[]> {
  if (!db) return [];
  const col = collection(db, COLLECTIONS.products);
  const q = query(col, orderBy("name"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => toProductDoc(d.id, d.data()));
}

export async function getProduct(id: string): Promise<ProductDoc | null> {
  if (!db) return null;
  const ref = doc(db, COLLECTIONS.products, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toProductDoc(snap.id, snap.data());
}

// Low stock helpers
export async function listLowStockProducts(): Promise<ProductDoc[]> {
  const all = await listProducts();
  return all.filter((p) => p.active && (p.reorderLevel ?? 0) > 0 && p.stock <= (p.reorderLevel ?? 0));
}

export function observeLowStockProducts(cb: (items: ProductDoc[]) => void) {
  if (!db) { try { cb([]); } catch { /* noop */ } return () => {}; }
  const colRef = collection(db, COLLECTIONS.products);
  const q = query(colRef, orderBy("name"));
  const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    const list: ProductDoc[] = snap.docs.map((d) => toProductDoc(d.id, d.data()));
    cb(list.filter((p: ProductDoc) => p.active && (p.reorderLevel ?? 0) > 0 && p.stock <= (p.reorderLevel ?? 0)));
  });
  return unsub;
}

export type UpsertProductInput = {
  name: string;
  sku: string;
  unitPrice: number;
  stock: number;
  active: boolean;
  brand?: string;
  mrp?: number;
  category?: string;
  hsnCode?: string;
  costPrice?: number;
  reorderLevel?: number;
  taxRatePct?: number;
  thresholdPrice?: number;
};

export async function createProduct(input: UpsertProductInput): Promise<string> {
  assertDb();
  const col = collection(db!, COLLECTIONS.products);
  const payload: Record<string, unknown> = {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  const res = await addDoc(col, payload);
  return res.id;
}

export async function updateProduct(id: string, input: Partial<UpsertProductInput>): Promise<void> {
  assertDb();
  const ref = doc(db!, COLLECTIONS.products, id);
  const payload: Record<string, unknown> = {
    ...input,
    updatedAt: serverTimestamp(),
  };
  Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);
  await updateDoc(ref, payload);
}

export async function deleteProduct(id: string): Promise<void> {
  assertDb();
  const ref = doc(db!, COLLECTIONS.products, id);
  await deleteDoc(ref);
}

export async function incrementPrintedCount(id: string, qty: number): Promise<void> {
  assertDb();
  const ref = doc(db!, COLLECTIONS.products, id);
  await updateDoc(ref, { printedCount: increment(qty), updatedAt: serverTimestamp() });
}

export async function findProductBySKU(sku: string): Promise<ProductDoc | null> {
  if (!db) return null;
  const colRef = collection(db, COLLECTIONS.products);
  const qy = query(colRef, where("sku", "==", sku), limit(1));
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return toProductDoc(d.id, d.data() as Record<string, unknown>);
}