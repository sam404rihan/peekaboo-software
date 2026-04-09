"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ProductDoc, CouponDoc } from "@/lib/models";
import { decodeBarcode } from "@/lib/barcodes";
import { findProductBySKU, listProducts } from "@/lib/products";
import { saveProductsToCache, getCachedProducts, findCachedBySKU } from "@/lib/catalog-cache";
import { checkoutCart } from "@/lib/pos";
import { validateCoupon, markCouponUsed, listAutoApplyCoupons, type CouponCartItem } from "@/lib/coupons";
import { findCustomerByPhone, createCustomer } from "@/lib/customers";
import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined", className)}>{name}</span>;
}

export function PosPanel() {
  const [scanValue, setScanValue] = useState("");
  type CartLine = { product: ProductDoc; qty: number; itemDiscount?: number; itemDiscountMode?: 'amount' | 'percent' };
  const [cart, setCart] = useState<CartLine[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [allProducts, setAllProducts] = useState<ProductDoc[]>([]);
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [billDiscountMode, setBillDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [toast, setToast] = useState<{ id: number; type: 'error' | 'success'; message: string } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('cash');
  const [paymentReferenceId, setPaymentReferenceId] = useState("");
  const { user } = useAuth();
  const [custPhone, setCustPhone] = useState("");
  const [custName, setCustName] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custKidsDob, setCustKidsDob] = useState("");
  const [custFound, setCustFound] = useState<{ id: string; name: string; points?: number } | null>(null);
  const [custChecking, setCustChecking] = useState(false);
  const phoneLookupSeq = useRef(0);
  const [busy, setBusy] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [couponApplied, setCouponApplied] = useState<{ id: string; code: string; discountAmount: number; autoApplied?: boolean } | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const autoApplyCoupons = useRef<CouponDoc[]>([]);

  // Load auto-apply coupons once
  useEffect(() => {
    listAutoApplyCoupons().then(c => { autoApplyCoupons.current = c; }).catch(() => {});
  }, []);

  // Auto-apply best matching group coupon when cart changes (only if no manual coupon)
  // Validates locally against cached coupon data — no extra Firestore reads on every cart change
  useEffect(() => {
    setCouponApplied(prev => {
      if (prev && !prev.autoApplied) return prev; // manual coupon takes priority
      if (!autoApplyCoupons.current.length || !cart.length) return null;

      const now = new Date();
      const cartItems: CouponCartItem[] = cart.map(l => ({
        unitPrice: l.product.unitPrice,
        quantity: l.qty,
        lineTotal: l.product.unitPrice * l.qty,
        category: l.product.category,
      }));
      const cartTotal = cart.reduce((s, l) => s + l.product.unitPrice * l.qty, 0);

      let best: { id: string; code: string; discountAmount: number } | null = null;

      for (const c of autoApplyCoupons.current) {
        if (!c.active) continue;
        if (c.startsAt && new Date(c.startsAt) > now) continue;
        if (c.expiresAt && new Date(c.expiresAt) < now) continue;
        if (c.maxUses && c.usedCount >= c.maxUses) continue;
        if (c.minOrderValue && cartTotal < c.minOrderValue) continue;

        const cats = c.applicableCategories;
        let eligibleTotal = cartTotal;
        if (cats && cats.length > 0) {
          eligibleTotal = cartItems
            .filter(item => item.category && cats.includes(item.category))
            .reduce((sum, item) => sum + item.lineTotal, 0);
          if (eligibleTotal <= 0) continue;
        }

        let discount = c.discountType === "percentage"
          ? Math.round(eligibleTotal * c.discountValue / 100 * 100) / 100
          : Math.min(c.discountValue, eligibleTotal);
        if (c.discountType === "percentage" && c.maxDiscountAmount) {
          discount = Math.min(discount, c.maxDiscountAmount);
        }

        if (!best || discount > best.discountAmount) {
          best = { id: c.id!, code: c.code, discountAmount: discount };
        }
      }

      if (best) return { ...best, autoApplied: true };
      return null;
    });
  }, [cart]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    async function load() {
      try {
        if (navigator.onLine) {
          const list = await listProducts();
          setAllProducts(list);
          saveProductsToCache(list).catch(() => undefined);
        } else {
          const cached = await getCachedProducts();
          setAllProducts(cached as any);
        }
      } catch {
        try { const cached = await getCachedProducts(); setAllProducts(cached as any); } catch { }
      }
    }
    load();
  }, []);
  

  const DRAFT_KEY_V2 = "pos.cart.v2";
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current || !allProducts.length) return;
    try {
      const rawV2 = localStorage.getItem(DRAFT_KEY_V2);
      if (rawV2) {
        const d = JSON.parse(rawV2);
        if (d && (!d.cashierUserId || !user?.uid || d.cashierUserId === user.uid)) {
          if (Array.isArray(d.cart)) {
            const lines = d.cart.map((cl: any) => {
                const p = allProducts.find((x) => x.id === cl.productId);
                if (!p) return null;
                return { product: p, qty: Math.max(1, Number(cl.qty || 1)), itemDiscount: cl.itemDiscount, itemDiscountMode: cl.itemDiscountMode };
              }).filter(Boolean) as CartLine[];
            if (lines.length) setCart(lines);
          }
          if (d.billDiscount != null) setBillDiscount(Number(d.billDiscount) || 0);
          if (d.billDiscountMode) setBillDiscountMode(d.billDiscountMode);
          if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
          if (d.custPhone) setCustPhone(d.custPhone);
          if (d.custName) setCustName(d.custName);
        }
      }
    } catch { }
    loadedRef.current = true;
  }, [allProducts.length, user?.uid]);

  useEffect(() => {
    if (!loadedRef.current) return;
    try {
      const draft = {
        version: 2, cashierUserId: user?.uid,
        cart: cart.map((l) => ({ productId: l.product.id!, qty: l.qty, itemDiscount: l.itemDiscount, itemDiscountMode: l.itemDiscountMode })),
        billDiscount, billDiscountMode, paymentMethod, paymentReferenceId, custPhone, custName, custEmail, custKidsDob,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY_V2, JSON.stringify(draft));
    } catch { }
  }, [cart, billDiscount, billDiscountMode, paymentMethod, paymentReferenceId, custPhone, custName, custEmail, custKidsDob, user?.uid]);

  const lineDiscount = useCallback((l: CartLine) => {
    const base = l.product.unitPrice * l.qty;
    const v = Number(l.itemDiscount ?? 0);
    return (l.itemDiscountMode ?? 'amount') === 'amount' ? v : (base * v) / 100;
  }, []);
  const subTotal = useMemo(() => cart.reduce((sum, l) => sum + (l.product.unitPrice * l.qty - lineDiscount(l)), 0), [cart, lineDiscount]);
  const billDiscComputed = useMemo(() => (billDiscountMode === 'amount' ? billDiscount : (subTotal * billDiscount) / 100), [billDiscountMode, billDiscount, subTotal]);
  const couponDiscount = couponApplied?.discountAmount ?? 0;
  const total = useMemo(() => Math.max(0, subTotal - billDiscComputed - couponDiscount), [subTotal, billDiscComputed, couponDiscount]);

  function showToast(type: 'error' | 'success', message: string) {
    const id = Date.now();
    setToast({ id, type, message });
    setTimeout(() => { setToast((t) => (t && t.id === id ? null : t)); }, 3000);
  }

  async function handleScanSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;
    const decoded = decodeBarcode(code);
    if (!decoded) { showToast('error', 'Invalid barcode scan.'); setScanValue(""); return; }

    let p = await findProductBySKU(decoded.sku);
    if (!p) p = await findCachedBySKU(decoded.sku) as any;
    if (!p) { showToast('error', `SKU ${decoded.sku} not found`); setScanValue(""); return; }

    addByProductId(p.id!);
    setScanValue(""); inputRef.current?.focus();
  }

  function addByProductId(id?: string) {
    if (!id) return;
    const p = allProducts.find((x) => x.id === id);
    if (!p) return;
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === p.id);
      if (idx >= 0) {
        const copy = [...prev];
        const max = Math.max(0, Number(p.stock ?? 0));
        if (copy[idx].qty >= max) { showToast('error', `Only ${max} in stock`); return copy; }
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + 1 };
        return copy;
      }
      const max = Math.max(0, Number(p.stock ?? 0));
      if (max <= 0) { showToast('error', `${p.name} is out of stock`); return prev; }
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function removeLine(id?: string) {
    if (!id) return;
    setCart((prev) => prev.filter((l) => l.product.id !== id));
  }

  function setQty(productId: string | undefined, delta: number | "input", inputVal?: number) {
    if (!productId) return;
    setCart((prev) => prev.map((l) => {
      if (l.product.id !== productId) return l;
      const max = Math.max(1, Number(l.product.stock ?? 99));
      let next: number;
      if (delta === "input") {
        next = Math.min(max, Math.max(1, isNaN(inputVal!) ? 1 : inputVal!));
      } else {
        next = l.qty + delta;
        if (next < 1) return l; // don't go below 1 — use delete button
        if (next > max) { showToast('error', `Only ${max} in stock`); return l; }
      }
      return { ...l, qty: next };
    }));
  }

  useEffect(() => {
    const phone = custPhone.trim();
    setCustFound(null); setCustName(""); setCustEmail(""); setCustKidsDob("");
    if (!phone) return;
    const seq = ++phoneLookupSeq.current;
    const t = setTimeout(async () => {
      try {
        setCustChecking(true);
        const c = await findCustomerByPhone(phone);
        if (phoneLookupSeq.current !== seq) return;
        if (c) {
          setCustFound({ id: c.id!, name: c.name, points: Number(c.loyaltyPoints || 0) });
          setCustName(c.name || ""); setCustEmail(c.email || ""); setCustKidsDob(c.kidsDob || "");
        }
      } catch { } finally { if (phoneLookupSeq.current === seq) setCustChecking(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [custPhone]);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setCouponChecking(true);
    try {
      const cartItemsForCoupon: CouponCartItem[] = cart.map(l => ({
        unitPrice: l.product.unitPrice,
        quantity: l.qty,
        lineTotal: l.product.unitPrice * l.qty - lineDiscount(l),
        category: l.product.category,
      }));
      const result = await validateCoupon(code, subTotal - billDiscComputed, cartItemsForCoupon);
      if (!result.valid) { showToast('error', result.reason); return; }
      setCouponApplied({ id: result.coupon.id!, code: result.coupon.code, discountAmount: result.discountAmount });
      const scopeNote = result.eligibleTotal < (subTotal - billDiscComputed)
        ? ` (on eligible items ₹${result.eligibleTotal.toFixed(2)})` : "";
      showToast('success', `Coupon applied: -₹${result.discountAmount.toFixed(2)}${scopeNote}`);
    } catch (e) {
      showToast('error', `Coupon error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setCouponChecking(false);
    }
  }

  async function onCheckout() {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      let customerId: string | undefined = undefined;
      const phone = custPhone.trim();
      if (phone) {
        const existing = await findCustomerByPhone(phone);
        if (existing) customerId = existing.id!;
        else {
          const name = custName.trim();
          if (!name) { showToast('error', 'Enter customer name'); return; }
           customerId = await createCustomer({ name, phone, email: custEmail.trim() || undefined, kidsDob: custKidsDob || undefined });
        }
      }
      if (!navigator.onLine) {
        const id = `op-${Date.now()}`;
        const payload = { 
          lines: cart.map(l => ({ 
            productId: l.product.id!, 
            name: l.product.name, 
            qty: l.qty, 
            unitPrice: l.product.unitPrice, 
            lineDiscount: lineDiscount(l), 
            taxRatePct: l.product.taxRatePct ?? 0  // Ensure tax rate is always defined
          })), 
          billDiscount: billDiscComputed, 
          paymentMethod, 
          paymentReferenceId: paymentReferenceId.trim() || undefined, 
          cashierUserId: user?.uid, 
          cashierName: user?.email, 
          customerId, 
          customerName: custName.trim() || undefined, 
          opId: id 
        };
        await (await import("@/lib/offline")).enqueueOp({ id, type: 'checkout', payload, createdAt: new Date().toISOString(), attempts: 0 });
      } else {
        const newInvoiceId = await checkoutCart({
          lines: cart.map(l => ({
            productId: l.product.id!,
            name: l.product.name,
            qty: l.qty,
            unitPrice: l.product.unitPrice,
            lineDiscount: lineDiscount(l),
            taxRatePct: l.product.taxRatePct ?? 0
          }) as any),
          billDiscount: billDiscComputed + couponDiscount, paymentMethod, paymentReferenceId: paymentReferenceId.trim() || undefined, cashierUserId: user?.uid, cashierName: user?.email ?? undefined, customerId, customerName: custName.trim() || undefined, opId: `op-${Date.now()}`,
        });
        if (couponApplied) { markCouponUsed(couponApplied.id).catch(() => {}); }
        try { window.open(`/invoices/receipt/${newInvoiceId}?autoclose=1&confirm=1`, '_blank'); } catch { }
      }
      showToast('success', 'Checkout complete!');
      setCart([]); setCustPhone(""); setCustName(""); setCouponApplied(null); setCouponInput("");
      try { localStorage.removeItem(DRAFT_KEY_V2); } catch { }
    } catch (e) {
      showToast('error', `Checkout failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [] as ProductDoc[];
    return allProducts.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)).slice(0, 5);
  }, [searchTerm, allProducts]);

  return (
    <div className="flex flex-col lg:flex-row h-full w-full font-sans max-w-[1400px] mx-auto gap-6 pb-12">
       {/* Scanner and Content Area */}
       <div className="flex-1 flex flex-col gap-6 pt-1 min-w-0">
          <div className="flex flex-col mb-1">
             <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#b7102a] mb-0.5 block">New Transaction</span>
             <h1 className="text-3xl font-extrabold tracking-tight leading-none text-slate-900">Point of Sale</h1>
          </div>

          <div className="relative group">
            <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 text-[22px] group-focus-within:text-[#b7102a] transition-colors">qr_code_scanner</span>
            <form onSubmit={handleScanSubmit}>
              <input
                 ref={inputRef} value={scanValue} onChange={(e) => { setScanValue(e.target.value); setSearchTerm(e.target.value); setSearchOpen(e.target.value.trim().length > 0); }}
                 placeholder="Scan barcode or type SKU / Name..."
                 className="w-full h-16 pl-14 pr-6 rounded-[2rem] bg-white border-2 border-slate-100 shadow-sm text-lg font-bold text-slate-700 outline-none ring-1 ring-transparent focus:ring-red-200 transition-all placeholder:text-slate-300 placeholder:font-medium"
                 autoComplete="off"
              />
            </form>
            {searchOpen && filtered.length > 0 && (
              <div className="absolute z-20 mt-2 w-full bg-white border border-slate-100 rounded-3xl shadow-xl overflow-hidden py-2 divide-y divide-slate-50">
                 {filtered.map(p => (
                   <button key={p.id} type="button" 
                     className="w-full text-left px-6 py-4 hover:bg-[#fff0f2]/50 transition-colors flex justify-between items-center group/item"
                     onClick={() => { addByProductId(p.id); setScanValue(""); setSearchOpen(false); inputRef.current?.focus(); }}
                   >
                     <div>
                       <div className="font-extrabold text-[15px] text-slate-800 group-hover/item:text-[#b7102a] transition-colors">{p.name}</div>
                       <div className="text-[10px] font-black tracking-widest uppercase text-slate-400 mt-1">SKU: {p.sku}</div>
                     </div>
                     <span className="font-extrabold tabular-nums bg-slate-50 px-3 py-1.5 rounded-lg text-slate-700">₹{p.unitPrice.toFixed(2)}</span>
                   </button>
                 ))}
              </div>
            )}
          </div>

          <div className="bg-[#fff0f2]/60 rounded-[2rem] p-6 lg:p-8 flex flex-col gap-4 border border-slate-100/50 shadow-sm">
             <div className="flex items-center gap-3 mb-2">
                <MSIcon name="person" className="text-[#b7102a] bg-white w-8 h-8 rounded-full flex items-center justify-center shadow-sm" />
                <h3 className="font-extrabold text-slate-900 text-[15px]">Customer Details</h3>
                {custFound && <span className="ml-auto text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">✓ Returning Customer</span>}
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2 relative">
                   <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Phone</label>
                   <input type="tel" value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="e.g. 9876543210" className="h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
                   {custChecking && <span className="material-symbols-outlined absolute right-4 top-10 animate-spin text-slate-300">progress_activity</span>}
                </div>
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Full Name</label>
                   <input type="text" value={custName} onChange={e => setCustName(e.target.value)} placeholder="Required for new customer" className="h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
                </div>
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Email <span className="text-slate-300 font-medium normal-case">(optional)</span></label>
                   <input type="email" value={custEmail} onChange={e => setCustEmail(e.target.value)} placeholder="customer@email.com" className="h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
                </div>
                <div className="flex flex-col gap-2">
                   <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Kid's DOB <span className="text-slate-300 font-medium normal-case">(optional)</span></label>
                   <input type="date" value={custKidsDob} onChange={e => setCustKidsDob(e.target.value)} className="h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
                </div>
             </div>
          </div>
       </div>

       {/* Shopping Cart Drawer Replicated Component */}
       <div className="w-full lg:w-[400px] bg-white border-l border-slate-100 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.02)] min-h-[calc(100vh-80px)] shrink-0 sticky top-20">
          {/* Cart Header */}
          <div className="p-6 border-b border-slate-100 flex justify-between items-start">
             <div>
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none mb-1">Shopping Cart</h2>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#a65b62]">POS Active Session</span>
             </div>
          </div>

          {/* Cart Lines */}
          <div className="flex-1 overflow-y-auto w-full">
            {cart.length === 0 ? (
               <div className="h-full flex flex-col justify-center items-center text-slate-300 gap-4 p-8">
                  <span className="material-symbols-outlined text-[64px] opacity-50 font-light">shopping_bag</span>
                  <p className="font-bold text-sm text-center">Scan an item or enter a barcode to begin building the cart.</p>
               </div>
            ) : (
               <ul className="divide-y divide-slate-50/80">
                  {cart.map((line, idx) => (
                    <li key={`${line.product.id}-${idx}`} className="p-5 flex gap-4 hover:bg-slate-50/40 transition-colors group">
                       <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200/50 flex items-center justify-center shrink-0 text-2xl relative overflow-hidden">
                          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-400 via-slate-100 to-transparent"></div>
                          🧸
                       </div>
                       <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                          <div className="flex justify-between items-start gap-2">
                             <h4 className="font-extrabold text-[14px] text-slate-900 leading-tight pr-4">{line.product.name}</h4>
                             <button onClick={() => removeLine(line.product.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all shrink-0"><MSIcon name="delete" className="text-[18px]"/></button>
                          </div>
                           <div className="flex justify-between items-center mt-3 gap-2">
                              {/* Qty stepper */}
                              <div className="flex items-center gap-1 bg-slate-100 rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setQty(line.product.id, -1)}
                                  className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-red-100 hover:text-[#b7102a] transition-colors font-black text-lg leading-none"
                                >−</button>
                                <input
                                  type="number" min={1} max={line.product.stock ?? 99}
                                  value={line.qty}
                                  onChange={e => setQty(line.product.id, "input", parseInt(e.target.value))}
                                  className="w-10 text-center text-[13px] font-extrabold text-slate-800 bg-transparent outline-none tabular-nums"
                                />
                                <button
                                  onClick={() => setQty(line.product.id, +1)}
                                  className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-green-100 hover:text-green-700 transition-colors font-black text-lg leading-none"
                                >+</button>
                              </div>
                              <div className="font-extrabold tabular-nums text-slate-900">
                                 ₹{(line.product.unitPrice * line.qty).toLocaleString()}
                              </div>
                           </div>
                           {line.itemDiscount ? <div className="text-[10px] font-bold text-red-500 text-right mt-1">-₹{lineDiscount(line).toLocaleString()} Disc</div> : null}
                       </div>
                    </li>
                  ))}
               </ul>
            )}
          </div>

          {/* Cart Footer */}
          <div className="p-6 bg-[#fff0f2]/30 border-t border-slate-100 flex flex-col gap-3">
             <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                <span>Subtotal</span><span>₹{subTotal.toLocaleString()}</span>
             </div>
             <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                <span>Total GST</span><span>{cart.length > 0 ? "Included" : "—"}</span>
             </div>
             {/* Coupon Code */}
             <div>
               {couponApplied ? (
                 <div className="flex items-center justify-between bg-emerald-50 rounded-xl px-3 py-2">
                   <div className="flex items-center gap-2">
                     <span className="material-symbols-outlined text-emerald-600 text-[16px]">confirmation_number</span>
                     <span className="text-[11px] font-black text-emerald-700 uppercase">{couponApplied.autoApplied ? "Auto Discount" : couponApplied.code}</span>
                     {couponApplied.autoApplied && <span className="text-[10px] font-bold bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">Auto</span>}
                     <span className="text-[11px] font-bold text-emerald-600">-₹{couponApplied.discountAmount.toFixed(2)}</span>
                   </div>
                   <button onClick={() => { setCouponApplied(null); setCouponInput(""); }} className="text-[11px] font-bold text-slate-400 hover:text-red-600">Remove</button>
                 </div>
               ) : (
                 <div className="flex gap-2">
                   <input
                     type="text"
                     placeholder="Coupon code"
                     value={couponInput}
                     onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                     onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } }}
                     className="flex-1 h-9 bg-white border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 uppercase outline-none focus:ring-2 focus:ring-red-200"
                   />
                   <button
                     onClick={applyCoupon}
                     disabled={!couponInput.trim() || couponChecking}
                     className="h-9 px-4 rounded-xl bg-slate-800 text-white text-[11px] font-bold disabled:opacity-40"
                   >
                     {couponChecking ? "..." : "Apply"}
                   </button>
                 </div>
               )}
             </div>
             <div className="flex justify-between items-center text-sm font-bold text-slate-500">
                <span>Discounts</span><span className="text-[#b7102a]">-₹{(subTotal - total).toLocaleString()}</span>
             </div>
             
             <div className="w-full h-px bg-slate-200/80 my-1"></div>
             
             <div className="flex justify-between items-end">
                <span className="text-[12px] uppercase font-black tracking-widest text-[#a65b62]">Grand Total</span>
                <span className="text-3xl font-extrabold text-slate-900 tracking-tight tabular-nums">₹{total.toLocaleString()}</span>
             </div>

             {/* Payment Method */}
             <div>
               <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-2">Payment Method</p>
               <div className="grid grid-cols-3 gap-2">
                 {([
                   { key: "cash", label: "Cash", icon: "payments" },
                   { key: "card", label: "Card", icon: "credit_card" },
                   { key: "upi",  label: "UPI",  icon: "qr_code" },
                 ] as const).map(m => (
                   <button
                     key={m.key}
                     type="button"
                     onClick={() => { setPaymentMethod(m.key); if (m.key === 'cash') setPaymentReferenceId(""); }}
                     className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl border-2 transition-all text-[11px] font-extrabold ${
                       paymentMethod === m.key
                         ? "border-[#b7102a] bg-[#fff0f2] text-[#b7102a] shadow-sm"
                         : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:text-slate-800"
                     }`}
                   >
                     <span className={`material-symbols-outlined text-[20px] ${paymentMethod === m.key ? "text-[#b7102a]" : "text-slate-400"}`}>
                       {m.icon}
                     </span>
                     {m.label}
                   </button>
                 ))}
               </div>
             </div>

             {/* Payment Reference — card/upi only */}
             {paymentMethod !== 'cash' && (
               <div>
                 <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block mb-1.5">
                   {paymentMethod === 'upi' ? 'UPI / UTR Reference' : 'Card Approval Ref'}
                 </label>
                 <input
                   type="text"
                   value={paymentReferenceId}
                   onChange={e => setPaymentReferenceId(e.target.value)}
                   placeholder={paymentMethod === 'upi' ? 'e.g. UPI-123456789012' : 'e.g. APPR-4242'}
                   className="w-full h-10 bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#b7102a]/30 focus:border-[#b7102a] transition-all"
                 />
               </div>
             )}

             <button 
               onClick={onCheckout}
               disabled={busy || cart.length === 0}
               className="w-full h-14 rounded-full bg-[#b7102a] text-white font-extrabold shadow-lg hover:brightness-110 shadow-red-900/20 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 text-[15px]"
             >
               {busy ? <MSIcon name="progress_activity" className="animate-spin" /> : <MSIcon name="payments" className="text-[20px]" />}
               Pay with {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)}
             </button>

             <button onClick={() => setCart([])} disabled={cart.length === 0 || busy} className="mx-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-colors disabled:opacity-30">
                <MSIcon name="delete_sweep" className="text-[14px]" /> Clear Cart
             </button>
          </div>
       </div>

       {toast && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-50 flex items-center gap-3 font-bold text-sm ${toast.type === 'error' ? 'bg-[#b7102a] text-white shadow-red-900/40' : 'bg-slate-900 text-white shadow-slate-900/40'}`}>
          <MSIcon name={toast.type === 'error' ? "error" : "check_circle"} className="text-[20px]" />
          {toast.message}
        </div>
      )}
    </div>
  );
}
