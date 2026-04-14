"use client";
import { db } from "@/lib/firebase";
import { collection, addDoc, updateDoc, doc, getDocs, getDoc, serverTimestamp, query, type DocumentData } from "firebase/firestore";
import type { CategoryDoc } from "@/lib/models";
import { COLLECTIONS } from "@/lib/models";

function asString(v: unknown, d = ""): string { return typeof v === 'string' ? v : d; }

export function toCategoryDoc(id: string, data: Record<string, unknown>): CategoryDoc {
  const now = new Date().toISOString();
  return {
    id,
    name: asString(data.name),
    code: asString(data.code).toUpperCase(),
    description: typeof data.description === 'string' ? data.description : undefined,
    active: typeof data.active === 'boolean' ? data.active : true,
    defaultHsnCode: typeof data.defaultHsnCode === 'string' ? data.defaultHsnCode : undefined,
    defaultTaxRatePct: typeof data.defaultTaxRatePct === 'number' ? data.defaultTaxRatePct : undefined,
    createdAt: asString(data.createdAt, now),
    updatedAt: asString(data.updatedAt, now),
  };
}

export async function listCategories(): Promise<CategoryDoc[]> {
  if (!db) return [];
  const col = collection(db, COLLECTIONS.categories);
  const snap = await getDocs(query(col));
  const docs = snap.docs.map(d => toCategoryDoc(d.id, d.data() as DocumentData as Record<string, unknown>));
  return docs.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCategory(id: string): Promise<CategoryDoc | null> {
  if (!db) return null;
  const ref = doc(db, COLLECTIONS.categories, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toCategoryDoc(snap.id, snap.data() as DocumentData as Record<string, unknown>);
}

export async function createCategory(input: {
  name: string;
  code: string;
  description?: string;
  active?: boolean;
  defaultHsnCode?: string;
  defaultTaxRatePct?: number;
}): Promise<string> {
  if (!db) throw new Error('Firestore not initialized');
  const col = collection(db, COLLECTIONS.categories);
  const payload: Record<string, unknown> = {
    ...input,
    code: input.code.toUpperCase(),
    active: input.active ?? true,
    defaultHsnCode: input.defaultHsnCode,
    defaultTaxRatePct: typeof input.defaultTaxRatePct === 'number' ? input.defaultTaxRatePct : undefined,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  Object.keys(payload).forEach(k => (payload as Record<string, unknown>)[k] === undefined && delete (payload as Record<string, unknown>)[k]);
  const res = await addDoc(col, payload);
  return res.id;
}

export async function updateCategory(id: string, input: Partial<{
  name: string;
  code: string;
  description?: string;
  active?: boolean;
  defaultHsnCode?: string;
  defaultTaxRatePct?: number;
}>): Promise<void> {
  if (!db) throw new Error('Firestore not initialized');
  const ref = doc(db, COLLECTIONS.categories, id);
  const payload: Record<string, unknown> = {
    ...input,
    ...(input.code ? { code: input.code.toUpperCase() } : {}),
    ...(input.defaultTaxRatePct !== undefined ? { defaultTaxRatePct: input.defaultTaxRatePct } : {}),
    updatedAt: serverTimestamp(),
  };
  Object.keys(payload).forEach(k => (payload as Record<string, unknown>)[k] === undefined && delete (payload as Record<string, unknown>)[k]);
  await updateDoc(ref, payload);
}
