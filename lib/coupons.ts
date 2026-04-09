import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { COLLECTIONS, type CouponDoc } from "@/lib/models";

function assertDb() {
  if (!db) throw new Error("Firestore not initialized");
}

export async function listCoupons(): Promise<CouponDoc[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.coupons), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CouponDoc));
}

/** Returns all active auto-apply coupons (for POS to check on cart change) */
export async function listAutoApplyCoupons(): Promise<CouponDoc[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.coupons),
      where("active", "==", true),
      where("autoApply", "==", true)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CouponDoc));
}

export async function createCoupon(
  input: Omit<CouponDoc, "id" | "createdAt" | "updatedAt" | "usedCount">
): Promise<string> {
  assertDb();
  const code = input.code.trim().toUpperCase();
  // Check uniqueness
  const existing = await getDocs(
    query(collection(db!, COLLECTIONS.coupons), where("code", "==", code))
  );
  if (!existing.empty) throw new Error(`Coupon code "${code}" already exists`);
  const ref = await addDoc(collection(db!, COLLECTIONS.coupons), {
    ...input,
    code,
    usedCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCoupon(
  id: string,
  input: Partial<Omit<CouponDoc, "id" | "createdAt" | "usedCount">>
): Promise<void> {
  assertDb();
  await updateDoc(doc(db!, COLLECTIONS.coupons, id), {
    ...input,
    ...(input.code ? { code: input.code.trim().toUpperCase() } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCoupon(id: string): Promise<void> {
  assertDb();
  await deleteDoc(doc(db!, COLLECTIONS.coupons, id));
}

export type CouponValidation =
  | { valid: true; coupon: CouponDoc; discountAmount: number; eligibleTotal: number }
  | { valid: false; reason: string };

export type CouponCartItem = {
  unitPrice: number;
  quantity: number;
  lineTotal: number; // after any per-line discounts
  category?: string;
};

export async function validateCoupon(
  code: string,
  cartTotal: number,
  cartItems?: CouponCartItem[]
): Promise<CouponValidation> {
  if (!db) return { valid: false, reason: "Database unavailable" };
  const snap = await getDocs(
    query(
      collection(db, COLLECTIONS.coupons),
      where("code", "==", code.trim().toUpperCase()),
      where("active", "==", true)
    )
  );
  if (snap.empty) return { valid: false, reason: "Coupon code not found" };
  const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() } as CouponDoc;

  if (coupon.startsAt && new Date(coupon.startsAt) > new Date()) {
    return { valid: false, reason: `Coupon is not valid yet (starts ${new Date(coupon.startsAt).toLocaleDateString("en-IN")})` };
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { valid: false, reason: "Coupon has expired" };
  }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { valid: false, reason: "Coupon usage limit reached" };
  }
  if (coupon.minOrderValue && cartTotal < coupon.minOrderValue) {
    return {
      valid: false,
      reason: `Minimum order value ₹${coupon.minOrderValue} required`,
    };
  }

  // Determine eligible subtotal — scoped to categories if specified
  const cats = coupon.applicableCategories;
  let eligibleTotal = cartTotal;
  if (cats && cats.length > 0 && cartItems && cartItems.length > 0) {
    eligibleTotal = cartItems
      .filter(item => item.category && cats.includes(item.category))
      .reduce((sum, item) => sum + item.lineTotal, 0);
    if (eligibleTotal <= 0) {
      const catList = cats.join(", ");
      return {
        valid: false,
        reason: `This coupon only applies to: ${catList}. None of your cart items match.`,
      };
    }
  }

  let discountAmount =
    coupon.discountType === "percentage"
      ? Math.round(eligibleTotal * coupon.discountValue / 100 * 100) / 100
      : Math.min(coupon.discountValue, eligibleTotal);
  if (coupon.discountType === "percentage" && coupon.maxDiscountAmount) {
    discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
  }

  return { valid: true, coupon, discountAmount, eligibleTotal };
}

/** Atomically increment usedCount after a successful checkout */
export async function markCouponUsed(couponId: string): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  await updateDoc(doc(db, COLLECTIONS.coupons, couponId), {
    usedCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}
