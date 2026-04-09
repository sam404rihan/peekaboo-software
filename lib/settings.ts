"use client";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { COLLECTIONS, SettingsDoc } from "@/lib/models";

/**
 * Get the global settings document
 */
export async function getSettings(): Promise<SettingsDoc | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, COLLECTIONS.settings, 'app'));
  if (!snap.exists()) return null;
  return snap.data() as SettingsDoc;
}

/**
 * Update settings (partial update)
 */
export async function updateSettings(updates: Partial<SettingsDoc>): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const ref = doc(db, COLLECTIONS.settings, 'app');
  await setDoc(ref, {
    ...updates,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
