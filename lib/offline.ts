"use client";
// Simple IndexedDB-backed offline operation queue
// Keeps operations in order and retries when online.

import { checkoutCart } from "./pos";
import { performExchange } from "./exchange";
import { receiveStock } from "./pos";
import { COLLECTIONS } from "./models";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

export type OfflineOpType = "checkout" | "exchange" | "receive";
export type OfflineOp = {
  id: string;
  type: OfflineOpType;
  payload: any;
  createdAt: string;
  attempts?: number;
  failed?: boolean;
  error?: string;
};

const DB_NAME = "komfort_offline_v1";
const STORE_NAME = "ops";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOp(op: OfflineOp): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listOps(): Promise<OfflineOp[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result as OfflineOp[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOp(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getOp(id: string): Promise<OfflineOp | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve((req.result as OfflineOp) || null);
    req.onerror = () => reject(req.error);
  });
}

export async function processOpById(id: string): Promise<boolean> {
  const op = await getOp(id);
  if (!op) return false;
  try {
    if (op.type === 'checkout') {
      await checkoutCart(op.payload);
    } else if (op.type === 'exchange') {
      await performExchange(op.payload);
    } else if (op.type === 'receive') {
      await receiveStock(op.payload);
    }
    await removeOp(op.id);
    return true;
  } catch (err) {
    // Increment attempts
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const updated: OfflineOp = { ...op, attempts: (op.attempts || 0) + 1 };
      store.put(updated);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    console.error('processOpById failed', id, err);
    return false;
  }
}

let running = false;
export async function processQueue(onProgress?: (left: number) => void): Promise<void> {
  if (running) return;
  // If Firebase Auth is available but no user is signed in yet, pause processing.
  if (auth && !auth.currentUser) {
    return;
  }
  running = true;
  try {
    const ops = (await listOps())
      .filter((op) => !op.failed)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    for (const op of ops) {
      if (!navigator.onLine) break; // stop if offline again
      try {
        if (onProgress) onProgress(ops.length);
        if (op.type === 'checkout') {
          // payload should match CheckoutInput
          await checkoutCart(op.payload);
        } else if (op.type === 'exchange') {
          await performExchange(op.payload);
        } else if (op.type === 'receive') {
          await receiveStock(op.payload);
        }
        await removeOp(op.id);
      } catch (err: any) {
        // Distinguish between transient (network) vs permanent (e.g., out of stock)
        const isNetworkErr = err?.name === 'FirebaseError' && 
          (err.code === 'unavailable' || err.code === 'network-request-failed');
        console.error('Offline op failed', op.id, err);
        // increment attempts count
        const db = await openDb();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const recReq = store.get(op.id);
        recReq.onsuccess = () => {
          const existing = recReq.result as OfflineOp | undefined;
          if (existing) {
            existing.attempts = (existing.attempts || 0) + 1;
            // Shunt permanent bugs (or retried too many times) so they don't brick the queue
            if (!isNetworkErr && existing.attempts >= 3) {
              existing.failed = true;
              existing.error = err?.message || String(err);
              console.warn(`Op ${op.id} permanently failed and is disabled in queue.`);
            }
            store.put(existing);
          }
        };
        await new Promise((res) => (tx.oncomplete = res));
        // Only block/break the queue if it's an actual network failure
        if (isNetworkErr) {
          break;
        }
      }
    }
  } finally {
    running = false;
  }
}

let started = false;
export function ensureSyncStarted() {
  if (started) return;
  started = true;
  async function triggerProcessWhenReady() {
    if (!navigator.onLine) return;
    // If auth is not initialized, fall back to a short delay and try.
    if (!auth) {
      setTimeout(() => processQueue().catch((e) => console.error('processQueue failed', e)), 250);
      return;
    }
    // If a user is already signed in, process immediately.
    if (auth.currentUser) {
      await processQueue().catch((e) => console.error('processQueue failed', e));
      return;
    }
    // Otherwise, wait until a user signs in before processing.
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        processQueue().catch((e) => console.error('processQueue failed', e));
      }
    });
  }
  window.addEventListener('online', triggerProcessWhenReady);
  // attempt an initial sync when we start if online/auth-ready
  triggerProcessWhenReady();
}
