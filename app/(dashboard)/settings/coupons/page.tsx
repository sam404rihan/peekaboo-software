"use client";
import { useEffect, useState, useCallback } from "react";
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from "@/lib/coupons";
import { deleteField } from "firebase/firestore";
import { listCategories } from "@/lib/categories";
import type { CouponDoc, CategoryDoc } from "@/lib/models";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined", className)}>{name}</span>;
}

function generateCode(prefix?: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return prefix ? `${prefix.toUpperCase()}-${rand.slice(0, 6)}` : rand;
}

type DiscountType = "percentage" | "amount";
type CouponMode = "standard" | "auto";

const EMPTY_FORM = {
  mode: "standard" as CouponMode,
  code: "",
  codePrefix: "",
  description: "",
  discountType: "percentage" as DiscountType,
  discountValue: 10,
  maxDiscountAmount: undefined as number | undefined,
  minOrderValue: undefined as number | undefined,
  maxUses: undefined as number | undefined,
  active: true,
  startsAt: "",
  expiresAt: "",
  applicableCategories: [] as string[],
};

type FilterTab = "all" | "active" | "inactive" | "auto";

export default function CouponsPage() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<CouponDoc[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try { setCoupons(await listCoupons()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    listCategories().then(cs => setCategories(cs.filter(c => c.active))).catch(() => {});
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(c: CouponDoc) {
    setEditingId(c.id!);
    setForm({
      mode: c.autoApply ? "auto" : "standard",
      code: c.code,
      codePrefix: "",
      description: c.description ?? "",
      discountType: c.discountType,
      discountValue: c.discountValue,
      maxDiscountAmount: c.maxDiscountAmount,
      minOrderValue: c.minOrderValue,
      maxUses: c.maxUses,
      active: c.active,
      startsAt: c.startsAt ? c.startsAt.slice(0, 10) : "",
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
      applicableCategories: c.applicableCategories ?? [],
    });
    setShowForm(true);
  }

  function handleGenerate() {
    setForm(f => ({ ...f, code: generateCode(f.codePrefix || undefined) }));
  }

  function handleCopy() {
    if (!form.code) return;
    navigator.clipboard.writeText(form.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function toggleCategory(name: string) {
    setForm(f => ({
      ...f,
      applicableCategories: f.applicableCategories.includes(name)
        ? f.applicableCategories.filter(c => c !== name)
        : [...f.applicableCategories, name],
    }));
  }

  async function handleSave() {
    if (!form.code.trim()) { toast({ title: "Coupon code is required", variant: "destructive" }); return; }
    if (!form.discountValue || form.discountValue <= 0) { toast({ title: "Discount value must be greater than 0", variant: "destructive" }); return; }
    if (form.discountType === "percentage" && form.discountValue > 100) { toast({ title: "Percentage discount cannot exceed 100%", variant: "destructive" }); return; }
    if (form.startsAt && form.expiresAt && new Date(form.startsAt) >= new Date(form.expiresAt)) {
      toast({ title: "Start date must be before expiry date", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const base = {
        code: form.code.trim().toUpperCase(),
        discountType: form.discountType,
        discountValue: form.discountValue,
        active: form.active,
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.maxDiscountAmount && form.discountType === "percentage" ? { maxDiscountAmount: form.maxDiscountAmount } : {}),
        ...(form.minOrderValue ? { minOrderValue: form.minOrderValue } : {}),
        ...(form.maxUses ? { maxUses: form.maxUses } : {}),
        ...(form.startsAt ? { startsAt: new Date(form.startsAt).toISOString() } : {}),
        ...(form.expiresAt ? { expiresAt: new Date(form.expiresAt).toISOString() } : {}),
        ...(form.applicableCategories.length > 0 ? { applicableCategories: form.applicableCategories } : {}),
        ...(form.mode === "auto" ? { autoApply: true as const } : editingId ? { autoApply: deleteField() as unknown as undefined } : {}),
      };

      if (editingId) {
        await updateCoupon(editingId, base);
        toast({ title: "Coupon updated", variant: "success" });
      } else {
        await createCoupon(base);
        toast({ title: "Coupon created", variant: "success" });
      }
      setShowForm(false);
      reload();
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Delete coupon "${code}"? This cannot be undone.`)) return;
    await deleteCoupon(id);
    toast({ title: "Coupon deleted" });
    reload();
  }

  async function handleToggle(c: CouponDoc) {
    await updateCoupon(c.id!, { active: !c.active });
    reload();
  }

  const now = new Date();
  const filtered = coupons.filter(c => {
    if (filterTab === "active") return c.active && (!c.expiresAt || new Date(c.expiresAt) >= now);
    if (filterTab === "inactive") return !c.active || (!!c.expiresAt && new Date(c.expiresAt) < now);
    if (filterTab === "auto") return !!c.autoApply;
    return true;
  });

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "inactive", label: "Inactive / Expired" },
    { key: "auto", label: "Auto-apply" },
  ];

  const inputCls = "w-full h-11 bg-white rounded-xl px-4 text-sm font-semibold outline-none ring-1 ring-slate-200 focus:ring-[#b7102a]/40 transition";
  const labelCls = "text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block";
  const sectionCls = "bg-white rounded-2xl border border-slate-100 p-5 space-y-4";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900">Coupons</h2>
          <p className="text-sm text-slate-500 mt-0.5">Create and manage discount codes for POS checkout</p>
        </div>
        {!showForm && (
          <button
            onClick={openCreate}
            className="h-10 px-5 rounded-full bg-[#b7102a] text-white text-sm font-bold flex items-center gap-2 hover:brightness-110 transition-all shadow-sm"
          >
            <MSIcon name="add" className="text-[18px]" />
            New Coupon
          </button>
        )}
      </div>

      {/* ── FORM ── */}
      {showForm && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-slate-800">{editingId ? "Edit Coupon" : "New Coupon"}</h3>
            <button onClick={() => setShowForm(false)} className="h-8 w-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100">
              <MSIcon name="close" className="text-[18px]" />
            </button>
          </div>

          {/* 1. Coupon type */}
          <div className={sectionCls}>
            <p className={labelCls}>Coupon Type</p>
            <div className="grid grid-cols-2 gap-3">
              {(["standard", "auto"] as CouponMode[]).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, mode: m }))}
                  className={cn(
                    "h-auto py-3 px-4 rounded-xl border-2 text-left transition-all",
                    form.mode === m
                      ? "border-[#b7102a] bg-[#fff0f2]"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  )}
                >
                  <div className={cn("text-sm font-bold", form.mode === m ? "text-[#b7102a]" : "text-slate-700")}>
                    {m === "standard" ? "Standard Code" : "Automatic Discount"}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {m === "standard"
                      ? "Cashier enters a code at checkout"
                      : "Applies automatically when cart conditions are met — no code needed"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Code */}
          <div className={sectionCls}>
            <p className={labelCls}>Coupon Code</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  className={inputCls + " uppercase font-bold tracking-widest"}
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SUMMER20"
                />
              </div>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy code"
                className="h-11 w-11 rounded-xl border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 shrink-0"
              >
                <MSIcon name={copied ? "check" : "content_copy"} className={cn("text-[18px]", copied ? "text-emerald-600" : "text-slate-400")} />
              </button>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className={labelCls}>Prefix (optional)</label>
                <input
                  className={inputCls + " uppercase"}
                  value={form.codePrefix}
                  onChange={e => setForm(f => ({ ...f, codePrefix: e.target.value.toUpperCase() }))}
                  placeholder="e.g. SUMMER"
                />
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="h-11 px-4 rounded-xl border border-slate-200 bg-white text-[12px] font-bold text-slate-600 hover:bg-slate-50 shrink-0 flex items-center gap-1.5"
              >
                <MSIcon name="auto_fix_high" className="text-[16px] text-[#b7102a]" />
                Generate
              </button>
            </div>
            <div>
              <label className={labelCls}>Internal Label <span className="normal-case font-medium text-slate-300">(optional)</span></label>
              <input
                className={inputCls}
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Summer sale — toys category"
              />
            </div>
          </div>

          {/* 3. Discount */}
          <div className={sectionCls}>
            <p className={labelCls}>Discount</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Type</label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 h-11">
                  {(["percentage", "amount"] as DiscountType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, discountType: t }))}
                      className={cn(
                        "flex-1 text-[12px] font-bold transition-all",
                        form.discountType === t
                          ? "bg-[#b7102a] text-white"
                          : "bg-white text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {t === "percentage" ? "% Off" : "₹ Off"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>
                  Value {form.discountType === "percentage" ? "(%)" : "(₹)"}
                </label>
                <input
                  type="number" min="0" step="0.01"
                  className={inputCls}
                  value={form.discountValue || ""}
                  onChange={e => setForm(f => ({ ...f, discountValue: parseFloat(e.target.value) || 0 }))}
                  placeholder={form.discountType === "percentage" ? "e.g. 10" : "e.g. 100"}
                />
              </div>
              {form.discountType === "percentage" && (
                <div>
                  <label className={labelCls}>Max Discount Cap (₹) <span className="normal-case font-medium text-slate-300">optional</span></label>
                  <input
                    type="number" min="0"
                    className={inputCls}
                    value={form.maxDiscountAmount ?? ""}
                    onChange={e => setForm(f => ({ ...f, maxDiscountAmount: parseFloat(e.target.value) || undefined }))}
                    placeholder="e.g. 500 → max ₹500 off"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 4. Scope */}
          <div className={sectionCls}>
            <p className={labelCls}>
              Applies To
              <span className="ml-2 normal-case font-medium text-slate-300">Leave empty to apply to all products</span>
            </p>
            {categories.length === 0 ? (
              <p className="text-[12px] text-slate-400">No categories configured — coupon applies to all products.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, applicableCategories: [] }))}
                    className={cn(
                      "h-8 px-3 rounded-full text-[12px] font-bold border transition-all",
                      form.applicableCategories.length === 0
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
                    )}
                  >
                    All Products
                  </button>
                  {categories.map(cat => {
                    const sel = form.applicableCategories.includes(cat.name);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => toggleCategory(cat.name)}
                        className={cn(
                          "h-8 px-3 rounded-full text-[12px] font-bold border transition-all",
                          sel
                            ? "bg-[#b7102a] text-white border-[#b7102a]"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                        )}
                      >
                        {sel && <span className="mr-1">✓</span>}
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
                {form.applicableCategories.length > 0 && (
                  <p className="text-[11px] text-[#b7102a] font-bold">
                    Discount applies only to: {form.applicableCategories.join(", ")}
                  </p>
                )}
              </>
            )}
          </div>

          {/* 5. Conditions */}
          <div className={sectionCls}>
            <p className={labelCls}>Conditions</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Minimum Order Value (₹)</label>
                <input
                  type="number" min="0"
                  className={inputCls}
                  value={form.minOrderValue ?? ""}
                  onChange={e => setForm(f => ({ ...f, minOrderValue: parseFloat(e.target.value) || undefined }))}
                  placeholder="No minimum"
                />
              </div>
              <div>
                <label className={labelCls}>Max Redemptions</label>
                <input
                  type="number" min="0"
                  className={inputCls}
                  value={form.maxUses ?? ""}
                  onChange={e => setForm(f => ({ ...f, maxUses: parseInt(e.target.value) || undefined }))}
                  placeholder="Unlimited"
                />
              </div>
              <div>
                <label className={labelCls}>Valid From</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.startsAt}
                  onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Valid Until</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.expiresAt}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* 6. Status */}
          <div className={sectionCls}>
            <p className={labelCls}>Status</p>
            <div className="flex gap-3">
              {([true, false] as boolean[]).map(val => (
                <button
                  key={String(val)}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, active: val }))}
                  className={cn(
                    "h-10 px-5 rounded-full text-sm font-bold border-2 transition-all",
                    form.active === val
                      ? val
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-300 bg-slate-100 text-slate-600"
                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                  )}
                >
                  {val ? "Active" : "Draft"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
              {form.active
                ? "Coupon is live and can be applied at checkout"
                : "Coupon is saved as draft and will not be usable at POS"}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="h-11 px-7 rounded-full bg-[#b7102a] text-white text-sm font-bold flex items-center gap-2 hover:brightness-110 disabled:opacity-50 shadow-sm"
            >
              {saving && <MSIcon name="progress_activity" className="animate-spin text-[16px]" />}
              {editingId ? "Save Changes" : "Create Coupon"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="h-11 px-7 rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── LIST ── */}
      {!showForm && (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-2xl p-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setFilterTab(t.key)}
                className={cn(
                  "flex-1 h-8 rounded-xl text-[12px] font-bold transition-all",
                  filterTab === t.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {t.label}
                {t.key === "all" && coupons.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-black text-slate-400">{coupons.length}</span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="py-16 text-center text-slate-400 font-bold">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <MSIcon name="confirmation_number" className="text-[48px] text-slate-200 block mx-auto mb-3" />
              <p className="font-bold">
                {coupons.length === 0 ? "No coupons yet. Create one above." : "No coupons match this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((c) => {
                const expired = !!c.expiresAt && new Date(c.expiresAt) < now;
                const notStarted = !!c.startsAt && new Date(c.startsAt) > now;
                const redemptionPct = c.maxUses ? Math.min(100, (c.usedCount / c.maxUses) * 100) : null;
                return (
                  <div key={c.id} className={cn(
                    "bg-white rounded-2xl border p-4 shadow-sm transition-all",
                    !c.active || expired ? "border-slate-100 opacity-70" : "border-slate-100 hover:border-slate-200"
                  )}>
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        c.autoApply ? "bg-violet-50" : "bg-[#fce8ec]"
                      )}>
                        <MSIcon
                          name={c.autoApply ? "bolt" : "confirmation_number"}
                          className={cn("text-[22px]", c.autoApply ? "text-violet-600" : "text-[#b7102a]")}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-slate-900 uppercase tracking-wider">{c.code}</span>
                          <span className={cn(
                            "text-[11px] font-bold px-2 py-0.5 rounded-full",
                            c.discountType === "percentage" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"
                          )}>
                            {c.discountType === "percentage"
                              ? `${c.discountValue}% off${c.maxDiscountAmount ? ` (max ₹${c.maxDiscountAmount})` : ""}`
                              : `₹${c.discountValue} off`}
                          </span>
                          {c.autoApply && <span className="text-[11px] font-bold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">Auto-apply</span>}
                          {!c.active && <span className="text-[11px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Draft</span>}
                          {expired && <span className="text-[11px] font-bold bg-red-50 text-[#b7102a] px-2 py-0.5 rounded-full">Expired</span>}
                          {notStarted && <span className="text-[11px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Scheduled</span>}
                        </div>

                        {/* Meta row */}
                        <p className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {c.minOrderValue && <span>Min ₹{c.minOrderValue}</span>}
                          {c.startsAt && !expired && <span>From {new Date(c.startsAt).toLocaleDateString("en-IN")}</span>}
                          {c.expiresAt && <span>{expired ? "Expired" : "Expires"} {new Date(c.expiresAt).toLocaleDateString("en-IN")}</span>}
                          {c.applicableCategories && c.applicableCategories.length > 0 && (
                            <span>{c.applicableCategories.join(", ")} only</span>
                          )}
                        </p>

                        {c.description && <p className="text-[11px] text-slate-500 mt-0.5 italic">{c.description}</p>}

                        {/* Redemption bar */}
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-[11px] font-bold text-slate-500">
                            {c.usedCount} {c.maxUses ? `/ ${c.maxUses}` : ""} redemption{c.usedCount !== 1 ? "s" : ""}
                          </span>
                          {redemptionPct !== null && (
                            <div className="flex-1 max-w-[120px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", redemptionPct >= 90 ? "bg-red-400" : "bg-emerald-400")}
                                style={{ width: `${redemptionPct}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0 pt-0.5">
                        <button
                          onClick={() => handleToggle(c)}
                          className={cn(
                            "h-8 px-3 rounded-full text-[11px] font-bold border transition-all",
                            c.active
                              ? "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                              : "border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                          )}
                        >
                          {c.active ? "Disable" : "Enable"}
                        </button>
                        <button onClick={() => openEdit(c)} className="h-8 w-8 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50">
                          <MSIcon name="edit" className="text-slate-500 text-[16px]" />
                        </button>
                        <button onClick={() => handleDelete(c.id!, c.code)} className="h-8 w-8 rounded-full border border-red-100 bg-red-50 flex items-center justify-center hover:bg-red-100">
                          <MSIcon name="delete" className="text-[#b7102a] text-[16px]" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
