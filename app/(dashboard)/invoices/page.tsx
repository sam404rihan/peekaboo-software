"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { InvoiceDoc } from "@/lib/models";
import { observeInvoices, type InvoiceFilters } from "@/lib/invoices";

const STATUS_OPTIONS = ["paid", "partial", "unpaid", "void"] as const;

export default function InvoicesPage() {
  const { user, role, loading } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [status, setStatus] = useState<InvoiceDoc["status"] | "">("");
  const [cashierEmail, setCashierEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  useEffect(() => {
    if (!user) return;
    const filters: InvoiceFilters = {};
    if (role === "cashier") {
      filters.cashierUserId = user.uid;
    } else {
      if (status) filters.status = status as InvoiceDoc["status"];
      if (cashierEmail) filters.cashierNameEq = cashierEmail.trim();
      if (from) filters.issuedFromIso = new Date(from).toISOString();
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filters.issuedToIso = end.toISOString();
      }
    }
    const unsub = observeInvoices((list) => { setInvoices(list); setInvoicesLoading(false); }, filters);
    return () => unsub();
  }, [user, role, status, cashierEmail, from, to]);

  const totalPages = Math.ceil(invoices.length / itemsPerPage);
  const paginatedInvoices = invoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleClearFilters = () => { setFrom(""); setTo(""); setStatus(""); setCashierEmail(""); };
  const handleNavigateToInvoice = (id: string) => { window.location.href = `/invoices/${id}`; };

  if (loading) return <div className="p-8 text-slate-400 font-medium tracking-wide flex items-center gap-3"><span className="material-symbols-outlined animate-spin">progress_activity</span>Loading invoices...</div>;
  if (!user) return null;

  return (
    <div className="space-y-6 max-w-7xl font-sans text-slate-900 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
         <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#b7102a] mb-1 block">
               Transactions
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight leading-none">
               Invoice Management
            </h1>
         </div>
      </div>

      {/* Filters (Admin Only) */}
      {role === "admin" && (
        <div className="bg-[#fff0f2]/60 rounded-[2rem] p-6 lg:p-8 flex items-end gap-5 flex-wrap border border-slate-100/50 shadow-sm relative">
          <div className="flex flex-col gap-2 flex-1 min-w-[150px]">
            <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Date Range</label>
            <div className="flex items-center gap-2">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full h-10 bg-white border-0 rounded-xl px-3 text-sm font-bold text-slate-700 shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
              <span className="text-slate-300 font-bold">-</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full h-10 bg-white border-0 rounded-xl px-3 text-sm font-bold text-slate-700 shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-[150px]">
            <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Status</label>
            <div className="relative">
               <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full h-10 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300">
                 <option value="">All Statuses</option>
                 {STATUS_OPTIONS.map((opt) => (
                   <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                 ))}
               </select>
               <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 flex-1 min-w-[150px]">
            <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Cashier</label>
            <input type="text" placeholder="Search cashier..." value={cashierEmail} onChange={(e) => setCashierEmail(e.target.value)} className="w-full h-10 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
          </div>
          <button onClick={handleClearFilters} className="h-10 w-10 shrink-0 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm hover:text-slate-800 transition-colors tooltip" title="Clear Filters">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="bg-[#fce8ec]">
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tl-[1.8rem]">Receipt # / Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right">Subtotal</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right">Discount</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right">Grand Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Cashier</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tr-[1.8rem]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-50">
              {invoicesLoading ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-slate-400 font-bold">Loading...</td></tr>
              ) : paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                    <span className="material-symbols-outlined text-[48px] text-slate-200 block mx-auto mb-3">inbox</span>
                    <p className="font-bold">No invoices found</p>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv) => (
                  <tr key={inv.id} onClick={() => handleNavigateToInvoice(inv.id!)} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                    <td className="px-6 py-5">
                       <span className="bg-[#fce8ec] text-[#b7102a] text-[11px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest">{inv.invoiceNumber}</span>
                       <div className="text-[12px] font-bold text-slate-500 mt-2 px-1">
                          {new Date(inv.issuedAt).toLocaleDateString()} &middot; {new Date(inv.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </div>
                    </td>
                    <td className="px-6 py-5 text-right font-extrabold text-[15px] tabular-nums text-slate-500">
                      ₹{inv.subtotal.toFixed(2)}
                    </td>
                    <td className="px-6 py-5 text-right font-extrabold text-[15px] tabular-nums text-red-500/80">
                      {inv.discountTotal ? `-₹${inv.discountTotal.toFixed(2)}` : "—"}
                    </td>
                    <td className="px-6 py-5 text-right font-extrabold text-[18px] tabular-nums text-slate-900 border-l border-slate-50 group-hover:bg-[#fff0f2]/50 transition-colors">
                      ₹{inv.grandTotal.toFixed(2)}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-[10px] shrink-0 border border-slate-200">
                           {inv.cashierName?.[0]?.toUpperCase() || "C"}
                         </div>
                         <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{inv.cashierName || "System"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {inv.status === "paid" && <span className="text-[11px] font-black flex items-center gap-1.5 text-[#059669]"><div className="w-2 h-2 rounded-full bg-[#059669]"></div> COMPLETED</span>}
                      {inv.status === "void" && <span className="text-[11px] font-black flex items-center gap-1.5 text-[#b7102a]"><div className="w-2 h-2 rounded-full bg-[#b7102a]"></div> CANCELLED</span>}
                      {inv.status === "unpaid" && <span className="text-[11px] font-black flex items-center gap-1.5 text-orange-500"><div className="w-2 h-2 rounded-full bg-orange-500"></div> PENDING</span>}
                      {inv.status === "partial" && <span className="text-[11px] font-black flex items-center gap-1.5 text-[#2b6485]"><div className="w-2 h-2 rounded-full bg-[#2b6485]"></div> PARTIAL</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginator */}
        <div className="px-6 py-4 bg-[#fff0f2]/40 border-t-2 border-slate-100 flex items-center justify-between rounded-b-[2rem]">
           <div className="text-[12px] font-semibold text-slate-500">
              Showing <strong className="text-slate-900 font-extrabold">{invoices.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to <strong className="text-slate-900 font-extrabold">{Math.min(invoices.length, currentPage * itemsPerPage)}</strong> of <strong className="text-slate-900 font-extrabold">{invoices.length}</strong> entries
           </div>
           <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 shadow-sm"><span className="material-symbols-outlined text-[16px]">chevron_left</span></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-extrabold transition-colors shadow-sm ${page === currentPage ? 'bg-[#b7102a] text-white border-transparent' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{page}</button>
              ))}
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages} className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50 shadow-sm"><span className="material-symbols-outlined text-[16px]">chevron_right</span></button>
           </div>
        </div>
      </div>
    </div>
  );
}
