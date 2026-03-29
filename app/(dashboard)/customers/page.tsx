"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listCustomers, createCustomer, updateCustomer } from "@/lib/customers";
import type { CustomerDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";

interface EditState {
  id: string | null;
  form: { name: string; phone: string; email: string; kidsDob: string; gstin: string; notes: string };
  saving: boolean;
}

const EMPTY_FORM = { name: "", phone: "", email: "", kidsDob: "", gstin: "", notes: "" };

const INITIAL_EDIT_STATE: EditState = {
  id: null,
  form: EMPTY_FORM,
  saving: false,
};

export default function CustomersPage() {
  const { loading, user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<CustomerDoc[]>([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<EditState>(INITIAL_EDIT_STATE);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const loadCustomers = useCallback(async () => {
    try {
      const data = await listCustomers();
      setItems(data);
    } catch { setError("Failed to load customers"); }
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(c =>
      c.name.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s)
    );
  }, [q, items]);

  useEffect(() => { setCurrentPage(1); }, [q]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const openAdd = () => {
    setEdit({ id: null, form: EMPTY_FORM, saving: false });
    setError(null);
    setShowForm(true);
  };

  const startEdit = useCallback((c: CustomerDoc) => {
    if (!c.id) return;
    setEdit({ id: c.id, form: { name: c.name, phone: c.phone || "", email: c.email || "", kidsDob: c.kidsDob || "", gstin: c.gstin || "", notes: c.notes || "" }, saving: false });
    setError(null);
    setShowForm(true);
  }, []);

  const cancelEdit = useCallback(() => {
    setEdit(INITIAL_EDIT_STATE);
    setError(null);
    setShowForm(false);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!edit.form.name.trim()) { setError("Name is required"); return; }
    setEdit(prev => ({ ...prev, saving: true }));
    setError(null);
    try {
      const payload = {
        name: edit.form.name.trim(),
        phone: edit.form.phone.trim() || undefined,
        email: edit.form.email.trim() || undefined,
        kidsDob: edit.form.kidsDob || undefined,
        gstin: edit.form.gstin.trim() || undefined,
        notes: edit.form.notes.trim() || undefined,
      };
      if (edit.id) {
        await updateCustomer(edit.id, payload);
        setItems(prev => prev.map(c => c.id === edit.id ? { ...c, ...payload } : c));
        toast({ title: "Customer Updated" });
      } else {
        const newId = await createCustomer(payload);
        await loadCustomers();
        toast({ title: "Customer Created" });
      }
      cancelEdit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save customer";
      setError(msg);
      setEdit(prev => ({ ...prev, saving: false }));
    }
  }, [edit, cancelEdit, loadCustomers, toast]);

  if (loading) return <div className="p-8 text-slate-400 font-medium tracking-wide flex items-center gap-3"><span className="material-symbols-outlined animate-spin">progress_activity</span>Loading contacts...</div>;
  if (!user) return null;

  return (
    <div className="space-y-6 max-w-7xl font-sans text-slate-900 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#b7102a] mb-1 block">Loyalty & Records</span>
          <h1 className="text-4xl font-extrabold tracking-tight leading-none">Customer Directory</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              type="text" placeholder="Search by name or phone..." value={q} onChange={e => setQ(e.target.value)}
              className="w-full md:w-72 h-10 pl-11 pr-4 bg-white border border-slate-200 shadow-sm rounded-full text-sm font-bold text-slate-700 outline-none ring-1 ring-transparent focus:ring-red-300 transition-all placeholder:text-slate-400 placeholder:font-medium"
            />
          </div>
          <button onClick={openAdd} className="h-10 px-6 rounded-full bg-[#b7102a] text-white flex items-center gap-2 text-[13px] font-bold hover:brightness-110 transition-colors shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[18px]">person_add</span>
            Add Customer
          </button>
        </div>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-[#fff0f2]/60 rounded-[2rem] p-6 lg:p-8 border border-red-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#b7102a] shadow-sm">
              <span className="material-symbols-outlined">{edit.id ? "edit_square" : "person_add"}</span>
            </div>
            <h2 className="text-xl font-extrabold text-[#b7102a]">{edit.id ? "Edit Customer Profile" : "New Customer"}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Full Name *</label>
              <input type="text" value={edit.form.name} onChange={e => setEdit({ ...edit, form: { ...edit.form, name: e.target.value } })} className="w-full h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" placeholder="Customer name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Phone Number</label>
              <input type="tel" value={edit.form.phone} onChange={e => setEdit({ ...edit, form: { ...edit.form, phone: e.target.value } })} className="w-full h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" placeholder="+91 99999 99999" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Email Address</label>
              <input type="email" value={edit.form.email} onChange={e => setEdit({ ...edit, form: { ...edit.form, email: e.target.value } })} className="w-full h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" placeholder="customer@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Child's Date of Birth</label>
              <input type="date" value={edit.form.kidsDob} onChange={e => setEdit({ ...edit, form: { ...edit.form, kidsDob: e.target.value } })} className="w-full h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 uppercase" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">GSTIN</label>
              <input type="text" value={edit.form.gstin} onChange={e => setEdit({ ...edit, form: { ...edit.form, gstin: e.target.value.toUpperCase() } })} className="w-full h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 uppercase" placeholder="22AAAAA0000A1Z5" maxLength={15} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Notes</label>
              <input type="text" value={edit.form.notes} onChange={e => setEdit({ ...edit, form: { ...edit.form, notes: e.target.value } })} className="w-full h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" placeholder="Any relevant notes..." />
            </div>
          </div>

          <div className="w-full flex justify-end gap-3 mt-6">
            {error && <span className="mr-auto text-[13px] font-bold text-red-600 self-center">{error}</span>}
            <button onClick={cancelEdit} className="h-10 px-6 rounded-full bg-white text-slate-500 font-bold hover:bg-slate-50 border border-slate-200 shadow-sm transition-all text-[13px]">Cancel</button>
            <button onClick={saveEdit} disabled={edit.saving} className="h-10 px-6 rounded-full bg-[#b7102a] text-white font-bold hover:brightness-110 shadow-sm transition-all text-[13px] disabled:opacity-50">
              {edit.saving ? "Saving..." : edit.id ? "Save Changes" : "Create Customer"}
            </button>
          </div>
        </div>
      )}

      {/* Table Card */}
      {!showForm && (
        <div className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="bg-[#fce8ec]">
                  <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tl-[1.8rem]">Customer Profile</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Contact Details</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Important Dates</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-center">Loyalty Pts</th>
                  <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tr-[1.8rem] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-50">
                {paginatedItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-bold">
                      <span className="material-symbols-outlined text-[48px] text-slate-200 block mx-auto mb-3">recent_actors</span>
                      {q ? "No customers matching search" : "No customers yet — add your first one!"}
                    </td>
                  </tr>
                ) : paginatedItems.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-[#fce8ec] border-2 border-red-100 flex items-center justify-center shrink-0 text-xl font-extrabold text-[#b7102a] uppercase">
                          {c.name[0]}
                        </div>
                        <div>
                          <h3 className="font-extrabold text-[15px] text-slate-900 leading-tight">{c.name}</h3>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 block">ID: {c.id?.slice(0, 8)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-slate-700 text-sm flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-slate-400">call</span>
                        {c.phone || "—"}
                      </div>
                      {c.email && (
                        <div className="font-medium text-slate-400 text-[11px] flex items-center gap-2 mt-1">
                          <span className="material-symbols-outlined text-[12px] text-slate-300">mail</span>
                          {c.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      {c.kidsDob ? (
                        <span className="bg-[#fff0f2] text-[#b7102a] text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-2 w-max shadow-sm">
                          <span className="material-symbols-outlined text-[14px]">cake</span>
                          {c.kidsDob}
                        </span>
                      ) : (
                        <span className="text-slate-300 font-bold text-sm">—</span>
                      )}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="font-extrabold text-lg tabular-nums text-[#2b6485]">
                        {c.loyaltyPoints || 0}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button onClick={() => startEdit(c)} className="w-10 h-10 rounded-full text-slate-400 hover:text-white hover:bg-[#b7102a] flex items-center justify-center transition-all inline-flex shadow-sm ml-auto">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginator */}
          <div className="px-6 py-4 bg-[#fff0f2]/40 border-t-2 border-slate-100 flex items-center justify-between rounded-b-[2rem]">
            <div className="text-[12px] font-semibold text-slate-500">
              Showing <strong className="text-slate-900 font-extrabold">{filtered.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong className="text-slate-900 font-extrabold">{Math.min(filtered.length, currentPage * itemsPerPage)}</strong> of <strong className="text-slate-900 font-extrabold">{filtered.length}</strong> entries
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 shadow-sm">
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-extrabold transition-colors shadow-sm ${page === currentPage ? "bg-[#b7102a] text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{page}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 shadow-sm">
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
