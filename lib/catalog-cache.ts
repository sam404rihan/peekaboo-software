"use client";
// IndexedDB cache for minimal product catalog to enable offline scans/search.
import type { ProductDoc } from "./models";

type CachedProduct = {
  id: string;
  name: string;
  sku: string;
  unitPrice: number;
  category?: string;
  taxRatePct?: number;
};

const DB_NAME = 'komfort_catalog_v1';
const STORE = 'products';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProductsToCache(products: ProductDoc[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    products.forEach((p) => {
      if (!p.id) return;
      const cp: CachedProduct = { id: p.id, name: p.name, sku: p.sku, unitPrice: p.unitPrice, category: p.category, taxRatePct: p.taxRatePct };
      store.put(cp);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedProducts(): Promise<CachedProduct[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as CachedProduct[]);
    req.onerror = () => reject(req.error);
  });
}

export async function findCachedBySKU(sku: string): Promise<CachedProduct | null> {
  const all = await getCachedProducts();
  const s = sku.trim().toLowerCase();
  const found = all.find((p) => p.sku.toLowerCase() === s);
  return found || null;
}
