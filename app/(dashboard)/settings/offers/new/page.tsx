"use client";
import React, { useEffect, useState } from "react";
import { createOffer } from "@/lib/offers";
import { listProducts } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";
import type { ProductDoc } from "@/lib/models";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";

export default function NewOfferPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [discountType, setDiscountType] = useState<'percentage' | 'amount' | ''>('');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ProductDoc[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const { user, role, loading } = useAuth();

  useEffect(() => {
    Promise.all([listProducts(), listCategories()])
      .then(([prods, cats]) => { setCatalog(prods); setCategories(cats.filter(c => c.active)); })
      .catch(() => undefined);
  }, []);
  const [ruleType, setRuleType] = useState<'flat' | 'percentage' | 'bogoSameItem'>('flat');
  const [buyQty, setBuyQty] = useState<number>(0);
  const [getQty, setGetQty] = useState<number>(0);
  const [dobMonthOnly, setDobMonthOnly] = useState(false);
  const [eventName, setEventName] = useState("");
  const [priority, setPriority] = useState<number>(100);
  const [exclusive, setExclusive] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) { setError('Name is required'); return; }
    if (discountType && !Number.isFinite(discountValue)) { setError('Discount value must be a number'); return; }
    try {
      setSaving(true);
      const id = await createOffer({ name: name.trim(), description: description.trim() || undefined, active, startsAt: startsAt || undefined, endsAt: endsAt || undefined, discountType: discountType || undefined, discountValue: discountType ? Number(discountValue) : undefined, productIds: selectedProducts, categoryNames: selectedCategories, ruleType, buyQty: ruleType === 'bogoSameItem' ? Number(buyQty || 0) : undefined, getQty: ruleType === 'bogoSameItem' ? Number(getQty || 0) : undefined, dobMonthOnly, eventName: eventName || undefined, priority: Number(priority || 0), exclusive, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      toast({ title: 'Offer created', description: name.trim(), variant: 'success' });
      router.push(`/settings/offers/${id}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast({ title: 'Create failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function toggleProduct(id: string) {
    setSelectedProducts((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    loading ? <div className="p-4">Loading…</div> : (!user || role !== 'admin') ? (
      <div className="p-4 text-sm text-muted-foreground">Admin access required.</div>
    ) : (
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">New Offer</h1>
          <Link href="/settings/offers" className="px-3 py-2 rounded-xl border bg-background text-sm">Back</Link>
        </div>
        <form className="space-y-4" onSubmit={onSubmit}>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Name</label>
              <input className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Active</label>
              <select className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={String(active)} onChange={(e) => setActive(e.target.value === 'true')}>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Starts At</label>
              <input type="datetime-local" className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Ends At</label>
              <input type="datetime-local" className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Discount Type</label>
              <select className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}>
                <option value="">None</option>
                <option value="amount">₹ Amount</option>
                <option value="percentage">% Percentage</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Discount Value</label>
              <input type="number" className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={discountValue} onChange={(e) => setDiscountValue(Number(e.target.value || 0))} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Rule Type</label>
              <select className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={ruleType} onChange={(e) => setRuleType(e.target.value as any)}>
                <option value="flat">Flat</option>
                <option value="percentage">Percentage</option>
                <option value="bogoSameItem">BOGO (same item)</option>
              </select>
            </div>
            {ruleType === 'bogoSameItem' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-muted-foreground">Buy Qty</label>
                  <input type="number" className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={buyQty} onChange={(e) => setBuyQty(Number(e.target.value || 0))} />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">Get Qty</label>
                  <input type="number" className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={getQty} onChange={(e) => setGetQty(Number(e.target.value || 0))} />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">DOB Month Only</label>
                <select className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={String(dobMonthOnly)} onChange={(e) => setDobMonthOnly(e.target.value === 'true')}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Event Name</label>
                <input className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={eventName} onChange={(e) => setEventName(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Priority</label>
                <input type="number" className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={priority} onChange={(e) => setPriority(Number(e.target.value || 0))} />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Exclusive</label>
                <select className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={String(exclusive)} onChange={(e) => setExclusive(e.target.value === 'true')}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Target Products (optional)</div>
            <div className="border rounded-xl max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Select</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">SKU</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedProducts.includes(p.id!)} onChange={() => toggleProduct(p.id!)} /></td>
                      <td className="px-3 py-2">{p.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{p.sku}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2">Target Categories (optional)</div>
            <div className="border rounded-xl max-h-64 overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Select</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Code</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <tr key={cat.id} className="border-t">
                      <td className="px-3 py-2"><input type="checkbox" checked={selectedCategories.includes(cat.name)} onChange={() => setSelectedCategories(prev => prev.includes(cat.name) ? prev.filter(x => x !== cat.name) : [...prev, cat.name])} /></td>
                      <td className="px-3 py-2">{cat.name}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{cat.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-3 py-2 rounded-xl border bg-emerald-600 text-white" disabled={saving}>{saving ? 'Saving…' : 'Create Offer'}</button>
            <Link href="/settings/offers" className="px-3 py-2 rounded-xl border bg-background">Cancel</Link>
          </div>
        </form>
      </div>)
  );
}
