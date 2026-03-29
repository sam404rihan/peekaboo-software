"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { updateOffer } from "@/lib/offers";
import { listProducts } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";
import type { ProductDoc, OfferDoc } from "@/lib/models";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/models";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { IoArrowBack } from "react-icons/io5";

export default function EditOfferPage() {
  const params = useParams();
  const id = (params?.id as string) || "";
  const router = useRouter();

  const [offer, setOffer] = useState<OfferDoc | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [discountType, setDiscountType] = useState<
    "percentage" | "amount" | ""
  >("");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<ProductDoc[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, role, loading: authLoading } = useAuth();

  useEffect(() => {
    Promise.all([listProducts(), listCategories()])
      .then(([prods, cats]) => {
        setCatalog(prods);
        setCategories(cats.filter((c) => c.active));
      })
      .catch(() => undefined);
  }, []);
  const [ruleType, setRuleType] = useState<
    "flat" | "percentage" | "bogoSameItem"
  >("flat");
  const [buyQty, setBuyQty] = useState<number>(0);
  const [getQty, setGetQty] = useState<number>(0);
  const [dobMonthOnly, setDobMonthOnly] = useState(false);
  const [eventName, setEventName] = useState("");
  const [priority, setPriority] = useState<number>(100);
  const [exclusive, setExclusive] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!db || !id) return;
      const ref = doc(db, COLLECTIONS.offers, id);
      const snap = await getDoc(ref);
      if (!snap.exists()) return;
      const o = { id: snap.id, ...(snap.data() as any) } as OfferDoc;
      if (cancelled) return;
      setOffer(o);
      setName(o.name || "");
      setDescription(o.description || "");
      setActive(Boolean(o.active));
      setStartsAt(o.startsAt || "");
      setEndsAt(o.endsAt || "");
      setDiscountType((o.discountType as any) || "");
      setRuleType(
        (o.ruleType as any) ||
          (o.discountType === "amount"
            ? "flat"
            : o.discountType === "percentage"
            ? "percentage"
            : "flat")
      );
      setBuyQty(Number(o.buyQty || 0));
      setGetQty(Number(o.getQty || 0));
      setDobMonthOnly(Boolean(o.dobMonthOnly));
      setEventName(o.eventName || "");
      setPriority(Number(o.priority ?? 100));
      setExclusive(Boolean(o.exclusive));
      setDiscountValue(Number(o.discountValue || 0));
      setSelectedProducts(Array.isArray(o.productIds) ? o.productIds : []);
      setSelectedCategories(
        Array.isArray(o.categoryNames) ? o.categoryNames : []
      );
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    try {
      setSaving(true);
      await updateOffer(id, {
        name: name.trim(),
        description: description.trim() || undefined,
        active,
        startsAt: startsAt || undefined,
        endsAt: endsAt || undefined,
        discountType: discountType || undefined,
        discountValue: discountType ? Number(discountValue) : undefined,
        productIds: selectedProducts,
        categoryNames: selectedCategories,
        ruleType,
        buyQty: ruleType === "bogoSameItem" ? Number(buyQty || 0) : undefined,
        getQty: ruleType === "bogoSameItem" ? Number(getQty || 0) : undefined,
        dobMonthOnly,
        eventName: eventName || undefined,
        priority: Number(priority || 0),
        exclusive,
      });
      toast({
        title: "Offer updated",
        description: name.trim(),
        variant: "success",
      });
      router.push("/settings/offers");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function toggleProduct(id: string) {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (authLoading) return <div className="p-4">Loading…</div>;
  if (!user || role !== "admin")
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Admin access required.
      </div>
    );
  if (!offer) return <div className="p-4">Loading…</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Edit Offer</h1>
        <Button
          variant="link"
          onClick={() => (window.location.href = "/settings/offers")}
          className="h-12 cursor-pointer"
        >
          <IoArrowBack className="mr-2"/>
        </Button>
      </div>
      <form className="space-y-4" onSubmit={onSubmit}>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Name</label>
            <input
              className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Active</label>
            <select
              className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
              value={String(active)}
              onChange={(e) => setActive(e.target.value === "true")}
            >
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Starts At</label>
            <input
              type="datetime-local"
              className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">Ends At</label>
            <input
              type="datetime-local"
              className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              Discount Type
            </label>
            <select
              className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value as any)}
            >
              <option value="">None</option>
              <option value="amount">₹ Amount</option>
              <option value="percentage">% Percentage</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-muted-foreground">
              Discount Value
            </label>
            <input
              type="number"
              className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
              value={discountValue}
              onChange={(e) => setDiscountValue(Number(e.target.value || 0))}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-muted-foreground">Rule Type</label>
            <select
              className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as any)}
            >
              <option value="flat">Flat</option>
              <option value="percentage">Percentage</option>
              <option value="bogoSameItem">BOGO (same item)</option>
            </select>
          </div>
          {ruleType === "bogoSameItem" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-muted-foreground">Buy Qty</label>
                <input
                  type="number"
                  className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                  value={buyQty}
                  onChange={(e) => setBuyQty(Number(e.target.value || 0))}
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Get Qty</label>
                <input
                  type="number"
                  className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                  value={getQty}
                  onChange={(e) => setGetQty(Number(e.target.value || 0))}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">
                DOB Month Only
              </label>
              <select
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={String(dobMonthOnly)}
                onChange={(e) => setDobMonthOnly(e.target.value === "true")}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">
                Event Name
              </label>
              <input
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground">Priority</label>
              <input
                type="number"
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value || 0))}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">Exclusive</label>
              <select
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={String(exclusive)}
                onChange={(e) => setExclusive(e.target.value === "true")}
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">
            Target Products (optional)
          </div>
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
                {catalog.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(p.id!)}
                        onChange={() => toggleProduct(p.id!)}
                      />
                    </td>
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {p.sku}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="text-sm font-medium mb-2">
            Target Categories (optional)
          </div>
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
                {categories.map((cat) => (
                  <tr key={cat.id} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.name)}
                        onChange={() =>
                          setSelectedCategories((prev) =>
                            prev.includes(cat.name)
                              ? prev.filter((x) => x !== cat.name)
                              : [...prev, cat.name]
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2">{cat.name}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {cat.code}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            className="px-3 py-2 rounded-xl border bg-emerald-600 text-white"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <Link
            href="/settings/offers"
            className="px-3 py-2 rounded-xl border bg-background"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
