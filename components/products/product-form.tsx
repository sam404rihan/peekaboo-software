"use client";
import { useEffect, useState } from "react";
import { createProduct, updateProduct, UpsertProductInput } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface ProductFormProps {
  mode: "create" | "edit";
  initial?: Partial<UpsertProductInput> & { id?: string };
  onSaved?: (id?: string) => void;
}

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined", className)}>{name}</span>;
}

export function ProductForm({ mode, initial, onSaved }: ProductFormProps) {
  const [form, setForm] = useState<UpsertProductInput>({
    name: initial?.name ?? "",
    sku: initial?.sku ?? "",
    unitPrice: initial?.unitPrice ?? 0,
    mrp: initial?.mrp,
    stock: initial?.stock ?? 0,
    active: initial?.active ?? true,
    brand: initial?.brand,
    category: initial?.category,
    hsnCode: initial?.hsnCode,
    costPrice: initial?.costPrice,
    reorderLevel: initial?.reorderLevel ?? 5,
    taxRatePct: initial?.taxRatePct ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    listCategories()
      .then((cs) => {
        if (mounted) setCategories(cs.filter((c) => c.active));
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!form.category || categories.length === 0) return;
    const selected = categories.find((c) => c.name === form.category);
    if (!selected) return;
    setForm((prev) => {
      if (prev.category !== selected.name) return prev;
      const updates: Partial<UpsertProductInput> = {};
      if ((!prev.hsnCode || prev.hsnCode.trim() === "") && selected.defaultHsnCode) {
        updates.hsnCode = selected.defaultHsnCode;
      }
      if (
        (prev.taxRatePct === undefined || prev.taxRatePct === null) &&
        selected.defaultTaxRatePct !== undefined &&
        !Number.isNaN(selected.defaultTaxRatePct)
      ) {
        updates.taxRatePct = selected.defaultTaxRatePct;
      }
      return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
    });
  }, [categories, form.category]);

  function update<K extends keyof UpsertProductInput>(key: K, val: UpsertProductInput[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function applyCategoryDefaults(categoryName?: string) {
    setForm((prev) => {
      const next: UpsertProductInput = { ...prev, category: categoryName };
      if (!categoryName) return next;
      const selected = categories.find((c) => c.name === categoryName);
      if (!selected) return next;
      if (selected.defaultHsnCode) {
        next.hsnCode = selected.defaultHsnCode;
      }
      if (selected.defaultTaxRatePct !== undefined && !Number.isNaN(selected.defaultTaxRatePct)) {
        next.taxRatePct = selected.defaultTaxRatePct;
      }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (!form.name || !form.sku) throw new Error("Name and SKU are required");
      if (mode === "create") {
        const id = await createProduct(form);
        toast({ title: 'Product created', description: form.name, variant: 'success' });
        onSaved?.(id);
      } else if (mode === "edit" && initial?.id) {
        await updateProduct(initial.id, form);
        toast({ title: 'Product updated', description: form.name, variant: 'success' });
        onSaved?.(initial.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl pb-16 font-sans">
      
      {/* Essential Details Card */}
      <div className="bg-[#fff0f2]/60 rounded-[2rem] p-8 border border-slate-100/50 shadow-sm relative overflow-hidden">
        <h2 className="text-xl font-extrabold text-[#b7102a] mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#b7102a] shadow-sm">
             <MSIcon name="edit_document" />
          </div>
          Essential Details
        </h2>
        
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Name <span className="text-red-500">*</span></label>
            <input 
              required
              className="w-full h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
              value={form.name} 
              onChange={(e) => update("name", e.target.value)} 
              placeholder="e.g., Artisan Wooden Car" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SKU <span className="text-red-500">*</span></label>
            <input 
              required
              className="w-full h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
              value={form.sku} 
              onChange={(e) => update("sku", e.target.value)} 
              placeholder="e.g., TOY-CR-012" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand</label>
            <input
              className="w-full h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
              value={form.brand ?? ""}
              onChange={(e) => update("brand", e.target.value || undefined)}
              placeholder="e.g., Funskool"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
            <div className="relative">
              <select
                className="w-full h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300 transition-all"
                value={form.category ?? ""}
                onChange={(e) => applyCategoryDefaults(e.target.value || undefined)}
              >
                <option value="">Select category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
              <MSIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]"/>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HSN Code</label>
            <input 
              className="w-full h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
              value={form.hsnCode ?? ""} 
              onChange={(e) => update("hsnCode", e.target.value)} 
              placeholder="e.g., 950300" 
            />
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="bg-[#fff0f2]/60 rounded-[2rem] p-8 border border-slate-100/50 shadow-sm relative overflow-hidden">
        <h2 className="text-xl font-extrabold text-[#b7102a] mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#b7102a] shadow-sm">
             <MSIcon name="payments" />
          </div>
          Pricing & Tax
        </h2>
        
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-5 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selling Price <span className="text-red-500">*</span></label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input
                required
                type="number" step="0.01" min="0"
                className="w-full h-12 bg-white border-0 rounded-xl pl-8 pr-4 text-sm font-extrabold text-slate-900 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
                value={form.unitPrice || ""}
                onChange={(e) => update("unitPrice", parseFloat(e.target.value) || 0)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MRP (Print Label)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
              <input
                type="number" step="0.01" min="0"
                className="w-full h-12 bg-white border-0 rounded-xl pl-8 pr-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
                value={form.mrp ?? ""}
                onChange={(e) => update("mrp", Number.isNaN(parseFloat(e.target.value)) ? undefined : parseFloat(e.target.value))}
                placeholder="Leave empty if same as SP"
              />
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost Price</label>
             <div className="relative">
               <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
               <input 
                 type="number" step="0.01" min="0"
                 className="w-full h-12 bg-white border-0 rounded-xl pl-8 pr-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
                 value={form.costPrice || ""} 
                 onChange={(e) => update("costPrice", parseFloat(e.target.value) || 0)} 
                 placeholder="0.00" 
               />
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GST Rate %</label>
             <div className="relative">
                <input
                  type="number" step="0.1" min="0"
                  className="w-full h-12 bg-white border-0 rounded-xl px-4 text-sm font-extrabold text-[#b7102a] shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
                  value={form.taxRatePct === undefined || form.taxRatePct === null ? "" : form.taxRatePct}
                  onChange={(e) => update("taxRatePct", e.target.value === "" ? undefined : (Number.isNaN(parseFloat(e.target.value)) ? 0 : parseFloat(e.target.value)))}
                  placeholder="18.0"
                />
             </div>
          </div>
        </div>
      </div>

      {/* Inventory Section */}
      <div className="bg-[#fff0f2]/60 rounded-[2rem] p-8 border border-slate-100/50 shadow-sm relative overflow-hidden">
        <h2 className="text-xl font-extrabold text-[#b7102a] mb-6 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#b7102a] shadow-sm">
             <MSIcon name="inventory_2" />
          </div>
          Inventory Management
        </h2>
        
        <div className="grid md:grid-cols-3 gap-x-6 gap-y-5 relative z-10">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Stock</label>
            <input 
              type="number" 
              className="w-full h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
              value={form.stock === 0 ? "" : form.stock} 
              onChange={(e) => update("stock", parseInt(e.target.value || "0", 10))} 
              placeholder="e.g., 100" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reorder Alert Level</label>
            <input 
              type="number" 
              className="w-full h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-300 placeholder:font-medium transition-all"
              value={form.reorderLevel === 0 ? "" : (form.reorderLevel ?? "")} 
              onChange={(e) => update("reorderLevel", parseInt(e.target.value || "0", 10))} 
              placeholder="e.g., 10" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Publish Status</label>
            <div className="relative">
              <select
                className={`w-full h-12 bg-white border-0 rounded-xl px-4 text-sm font-bold shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300 transition-all ${form.active ? 'text-[#059669]' : 'text-slate-500'}`}
                value={form.active ? "true" : "false"}
                onChange={(e) => update("active", e.target.value === "true")}
              >
                <option value="true">Active Store</option>
                <option value="false">Hidden / Draft</option>
              </select>
              <MSIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]"/>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-100 text-[#b7102a] text-[13px] font-bold rounded-xl flex items-center gap-3">
          <MSIcon name="error" />
          {error}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex justify-start gap-4 pt-4 border-t border-slate-100/50 mt-8">
        <button 
          type="button" 
          onClick={() => window.history.back()}
          className="h-12 px-8 rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 transition-all font-bold hover:text-slate-900 shadow-sm text-sm"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={saving}
          className="h-12 px-10 rounded-full bg-[#b7102a] text-white font-extrabold hover:brightness-110 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 flex items-center gap-2 text-sm"
        >
          {saving && <MSIcon name="progress_activity" className="animate-spin text-[18px]" />}
          {mode === "create" ? "Create Product" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}