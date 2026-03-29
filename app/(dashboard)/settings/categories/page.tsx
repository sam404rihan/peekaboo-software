"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listCategories } from "@/lib/categories";
import { db } from "@/lib/firebase";
import { collection, addDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/models";
import type { CategoryDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";

interface CategoryForm {
  name: string;
  code: string;
  defaultHsnCode: string;
  defaultTaxRatePct: string;
  active: boolean;
}

const EMPTY_FORM: CategoryForm = { name: "", code: "", defaultHsnCode: "", defaultTaxRatePct: "18", active: true };

export default function CategoriesPage() {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CategoryDoc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const cats = await listCategories();
      setItems(cats);
    } catch {}
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const openAdd = () => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); };
  const openEdit = (c: CategoryDoc) => {
    setEditId(c.id || null);
    setForm({ name: c.name, code: c.code || "", defaultHsnCode: c.defaultHsnCode || "", defaultTaxRatePct: String(c.defaultTaxRatePct ?? 18), active: c.active !== false });
    setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!db) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        name: form.name.trim(),
        code: form.code.trim(),
        defaultHsnCode: form.defaultHsnCode.trim(),
        defaultTaxRatePct: parseFloat(form.defaultTaxRatePct) || 0,
        active: form.active,
        updatedAt: new Date().toISOString(),
      };
      if (editId) {
        await updateDoc(doc(db, COLLECTIONS.categories, editId), payload);
        toast({ title: "Category Updated" });
      } else {
        payload.createdAt = new Date().toISOString();
        await addDoc(collection(db, COLLECTIONS.categories), payload);
        toast({ title: "Category Created" });
      }
      await loadCategories();
      cancelForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (c: CategoryDoc) => {
    if (!db || !c.id) return;
    setBusy(c.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.categories, c.id), { active: !c.active, updatedAt: new Date().toISOString() });
      setItems(prev => prev.map(item => item.id === c.id ? { ...item, active: !item.active } : item));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <div className="p-8 text-slate-400 font-bold">Loading categories...</div>;
  if (!user || role !== "admin") return <div className="p-8 bg-red-50 rounded-2xl text-red-700 font-bold">Admin access required.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Categories</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Organize products and set default GST rates per category</p>
        </div>
        <button onClick={openAdd} className="h-10 px-6 rounded-full bg-[#b7102a] text-white font-bold text-[13px] flex items-center gap-2 hover:brightness-110 shadow-sm transition-all">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Category
        </button>
      </div>

      {/* Inline Add/Edit Form */}
      {showForm && (
        <div className="bg-[#fff0f2]/60 rounded-[2rem] p-6 border border-red-100 space-y-4 shadow-sm">
          <h3 className="font-extrabold text-[#b7102a] text-[16px]">{editId ? "Edit Category" : "New Category"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" placeholder="e.g. Action Figures" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Short Code</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" placeholder="e.g. ACT" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default HSN Code</label>
              <input value={form.defaultHsnCode} onChange={e => setForm(f => ({ ...f, defaultHsnCode: e.target.value }))} className="h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" placeholder="e.g. 9503" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Default GST Rate (%)</label>
              <input type="number" value={form.defaultTaxRatePct} onChange={e => setForm(f => ({ ...f, defaultTaxRatePct: e.target.value }))} className="h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" placeholder="e.g. 18" />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer mt-2">
            <div className={`w-10 h-6 rounded-full transition-colors ${form.active ? "bg-[#b7102a]" : "bg-slate-200"} relative`} onClick={() => setForm(f => ({ ...f, active: !f.active }))}>
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${form.active ? "left-5" : "left-1"}`}></div>
            </div>
            <span className="text-sm font-bold text-slate-700">Active</span>
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={cancelForm} className="h-10 px-6 rounded-full bg-white border border-slate-200 text-slate-500 font-bold text-[13px] hover:bg-slate-50 shadow-sm">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="h-10 px-6 rounded-full bg-[#b7102a] text-white font-bold text-[13px] hover:brightness-110 shadow-sm disabled:opacity-50">
              {saving ? "Saving..." : editId ? "Update Category" : "Create Category"}
            </button>
          </div>
        </div>
      )}

      {/* Categories Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="bg-[#fce8ec]">
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tl-[1.8rem]">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">HSN / GST</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tr-[1.8rem] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-bold">
                  <span className="material-symbols-outlined text-[48px] text-slate-200 block mx-auto mb-3">category</span>
                  No categories yet — create your first one above
                </td></tr>
              ) : items.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="font-extrabold text-slate-900">{c.name}</div>
                    {c.code && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 block">{c.code}</span>}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {c.defaultHsnCode && <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded-full uppercase">HSN: {c.defaultHsnCode}</span>}
                      {c.defaultTaxRatePct !== undefined && <span className="bg-[#fce8ec] text-[#b7102a] text-[10px] font-black px-2.5 py-1 rounded-full">GST: {c.defaultTaxRatePct}%</span>}
                      {!c.defaultHsnCode && c.defaultTaxRatePct === undefined && <span className="text-slate-300 font-bold text-sm">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <button onClick={() => handleToggleActive(c)} disabled={busy === c.id} className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full transition-all disabled:opacity-50 ${c.active ? "bg-[#dcfce7] text-[#166534] hover:bg-green-100" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${c.active ? "bg-[#166534]" : "bg-slate-400"}`}></div>
                      {busy === c.id ? "..." : c.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button onClick={() => openEdit(c)} className="w-9 h-9 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all ml-auto">
                      <span className="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
