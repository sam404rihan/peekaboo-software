"use client";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { InvoiceDoc } from "@/lib/models";
import { observeInvoices, type InvoiceFilters } from "@/lib/invoices";
import { db } from "@/lib/firebase";
import { doc, updateDoc, runTransaction, increment, collection } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/models";
import { useToast } from "@/components/ui/toast";

const DATE_RANGE_OPTIONS = ["Today", "Yesterday", "This Week", "This Month", "All Time"] as const;
type DateRangeOption = typeof DATE_RANGE_OPTIONS[number];

const AMOUNT_OPTIONS = ["Any", "Under ₹500", "₹500–₹2000", "₹2000–₹5000", "Over ₹5000"] as const;
type AmountOption = typeof AMOUNT_OPTIONS[number];

function getDateRangeBounds(option: DateRangeOption): { from?: string; to?: string } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (option === "Today") {
    return { from: todayStart.toISOString(), to: now.toISOString() };
  }
  if (option === "Yesterday") {
    const yStart = new Date(todayStart); yStart.setDate(yStart.getDate() - 1);
    const yEnd = new Date(todayStart); yEnd.setMilliseconds(-1);
    return { from: yStart.toISOString(), to: yEnd.toISOString() };
  }
  if (option === "This Week") {
    const wStart = new Date(todayStart); wStart.setDate(wStart.getDate() - wStart.getDay());
    return { from: wStart.toISOString(), to: now.toISOString() };
  }
  if (option === "This Month") {
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: mStart.toISOString(), to: now.toISOString() };
  }
  return {};
}

function matchesAmount(total: number, option: AmountOption): boolean {
  if (option === "Any") return true;
  if (option === "Under ₹500") return total < 500;
  if (option === "₹500–₹2000") return total >= 500 && total <= 2000;
  if (option === "₹2000–₹5000") return total > 2000 && total <= 5000;
  if (option === "Over ₹5000") return total > 5000;
  return true;
}

export default function InvoicesPage() {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceDoc[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [voidingId, setVoidingId] = useState<string | null>(null);

  // New UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeOption>("Today");
  const [amountFilter, setAmountFilter] = useState<AmountOption>("Any");
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDoc | null>(null);

  const itemsPerPage = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Separate subscription for today's total — independent of the date-range filter
  const [todayInvoices, setTodayInvoices] = useState<InvoiceDoc[]>([]);
  useEffect(() => {
    if (!user) return;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayFilters: InvoiceFilters = { issuedFromIso: todayStart.toISOString() };
    if (role === "cashier") todayFilters.cashierUserId = user.uid;
    const unsub = observeInvoices((list) => setTodayInvoices(list), todayFilters);
    return () => unsub();
  }, [user, role]);

  // Build Firestore filters from dateRange
  const firestoreFilters = useMemo(() => {
    const filters: InvoiceFilters = {};
    if (role === "cashier" && user) {
      filters.cashierUserId = user.uid;
    }
    const bounds = getDateRangeBounds(dateRange);
    if (bounds.from) filters.issuedFromIso = bounds.from;
    if (bounds.to) filters.issuedToIso = bounds.to;
    return filters;
  }, [user, role, dateRange]);

  useEffect(() => {
    if (!user) return;
    const unsub = observeInvoices((list) => {
      setInvoices(list);
      setInvoicesLoading(false);
    }, firestoreFilters);
    return () => unsub();
  }, [user, firestoreFilters]);

  // Client-side filtering
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!inv.invoiceNumber.toLowerCase().includes(q) && !inv.id?.toLowerCase().includes(q)) return false;
      }
      if (!matchesAmount(inv.grandTotal, amountFilter)) return false;
      return true;
    });
  }, [invoices, searchQuery, amountFilter]);

  const totalSalesToday = useMemo(() => {
    return todayInvoices
      .filter((inv) => inv.status !== "void")
      .reduce((sum, inv) => sum + inv.grandTotal, 0);
  }, [todayInvoices]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleApply = () => { setCurrentPage(1); };

  const handleVoid = async (e: React.MouseEvent, invoice: InvoiceDoc) => {
    e.stopPropagation();
    if (!invoice.id || !db) return;
    const dbx = db;
    if (!confirm(`Are you sure you want to void receipt ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    setVoidingId(invoice.id);
    try {
      const voidedAt = new Date().toISOString();
      await runTransaction(dbx, async (txn) => {
        const invoiceRef = doc(dbx, COLLECTIONS.invoices, invoice.id!);
        txn.update(invoiceRef, { status: "void", updatedAt: voidedAt });
        for (const item of invoice.items) {
          const prodRef = doc(dbx, COLLECTIONS.products, item.productId);
          txn.update(prodRef, { stock: increment(item.quantity), updatedAt: voidedAt });
          const logRef = doc(collection(dbx, COLLECTIONS.inventoryLogs));
          txn.set(logRef, {
            type: "void", productId: item.productId, productName: item.name,
            quantity: item.quantity, unitPrice: item.unitPrice,
            referenceType: "invoice", referenceId: invoice.id,
            reason: "Invoice voided", userId: user?.uid || "",
            userName: user?.displayName || user?.email || "Unknown",
            createdAt: voidedAt, updatedAt: voidedAt,
          });
        }
      });
      toast({ title: "Receipt Voided", description: `Receipt ${invoice.invoiceNumber} has been cancelled and stock restored.` });
      fetch("/api/notify/void", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: invoice.invoiceNumber, invoiceId: invoice.id, grandTotal: invoice.grandTotal, voidedBy: user?.displayName || user?.email || "Unknown", voidedAt }),
      }).catch(() => {});
      if (selectedInvoice?.id === invoice.id) setSelectedInvoice(null);
    } catch (err: any) {
      toast({ title: "Failed to Void", description: err.message, variant: "destructive" });
    } finally {
      setVoidingId(null);
    }
  };

  const handleDownloadCSV = () => {
    const rows = [
      ["Receipt #", "Date/Time", "Items", "Subtotal", "Discount", "Grand Total", "Cashier", "Status"],
      ...filteredInvoices.map((inv) => [
        inv.invoiceNumber,
        new Date(inv.issuedAt).toLocaleString(),
        inv.items.map((it) => `${it.name} x${it.quantity}`).join("; "),
        inv.subtotal.toFixed(2),
        (inv.discountTotal ?? 0).toFixed(2),
        inv.grandTotal.toFixed(2),
        inv.cashierName || "System",
        inv.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "receipts.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="p-8 text-slate-400 font-medium tracking-wide flex items-center gap-3">
      <span className="material-symbols-outlined animate-spin">progress_activity</span>Loading receipts...
    </div>
  );
  if (!user) return null;

  const cashierDisplayName = user.displayName || user.email || "Cashier";

  return (
    <div className="flex gap-6 h-full min-h-screen items-start font-sans text-slate-900 pb-12">
      {/* ── Left Main Panel ── */}
      <div className="flex-1 min-w-0 space-y-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight leading-none">Receipts</h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              Session: {role === "cashier" ? cashierDisplayName : "Admin View"}
            </p>
          </div>
          {/* Total Sales Today card */}
          <div className="bg-[#fff0f2] rounded-2xl px-5 py-3 flex items-center gap-4 shrink-0 border border-red-100">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#b7102a]">Total Sales Today</p>
              <p className="text-3xl font-extrabold tabular-nums text-slate-900 mt-0.5">
                ₹{totalSalesToday.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#e0f2fe] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px] text-[#0284c7]">receipt_long</span>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-[#fff8f9] rounded-2xl border border-red-100 p-5 space-y-4">
          {/* Search */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5 block">Search Receipt #</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
              <input
                type="text"
                placeholder="Enter receipt or transaction ID..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full h-11 bg-white border border-slate-200 rounded-xl pl-10 pr-4 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-red-200"
              />
            </div>
          </div>

          <div className="flex items-end gap-4 flex-wrap">
            {/* Date range pills */}
            <div className="flex-1 min-w-[200px]">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5 block">Date Range</label>
              <div className="flex gap-2 flex-wrap">
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => { setDateRange(opt); setCurrentPage(1); }}
                    className={`h-8 px-3 rounded-full text-[11px] font-bold border transition-all ${
                      dateRange === opt
                        ? "bg-slate-800 text-white border-slate-800"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount range */}
            <div className="min-w-[160px]">
              <label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5 block">Amount Range</label>
              <div className="relative">
                <select
                  value={amountFilter}
                  onChange={(e) => { setAmountFilter(e.target.value as AmountOption); setCurrentPage(1); }}
                  className="w-full h-9 bg-white border border-slate-200 rounded-xl px-3 pr-8 text-sm font-bold text-slate-700 outline-none appearance-none focus:ring-2 focus:ring-red-200"
                >
                  {AMOUNT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">filter_list</span>
              </div>
            </div>

            {/* Apply button */}
            <button
              onClick={handleApply}
              className="h-9 px-5 rounded-xl bg-slate-800 text-white text-sm font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors shrink-0"
            >
              Apply
              <span className="material-symbols-outlined text-[16px]">check</span>
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[600px]">
              <thead>
                <tr className="bg-[#fce8ec]">
                  <th className="px-5 py-3.5 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Receipt #</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Date/Time</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Items</th>
                  <th className="px-5 py-3.5 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoicesLoading ? (
                  <tr><td colSpan={4} className="px-5 py-16 text-center text-slate-400 font-bold">Loading...</td></tr>
                ) : paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center text-slate-400">
                      <span className="material-symbols-outlined text-[48px] text-slate-200 block mx-auto mb-3">inbox</span>
                      <p className="font-bold">No receipts found</p>
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((inv) => {
                    const isSelected = selectedInvoice?.id === inv.id;
                    const firstItem = inv.items[0];
                    const extraCount = inv.items.length - 1;
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => setSelectedInvoice(isSelected ? null : inv)}
                        className={`cursor-pointer transition-colors group ${isSelected ? "bg-[#fff0f2]" : "hover:bg-slate-50/60"}`}
                      >
                        <td className="px-5 py-4">
                          <span className="bg-[#fce8ec] text-[#b7102a] text-[11px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                            {inv.invoiceNumber}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-sm font-bold text-slate-700">
                            {new Date(inv.issuedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                          <div className="text-xs text-slate-400 font-medium mt-0.5">
                            {new Date(inv.issuedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {firstItem && (
                              <span className="bg-slate-100 text-slate-600 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
                                {firstItem.name.length > 16 ? firstItem.name.slice(0, 16).toUpperCase() + "…" : firstItem.name.toUpperCase()}
                                {firstItem.quantity > 1 ? ` ${firstItem.quantity}X` : ""}
                              </span>
                            )}
                            {extraCount > 0 && (
                              <span className="bg-slate-200 text-slate-500 text-[10px] font-black px-2 py-1 rounded-full">
                                +{extraCount} MORE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-base font-extrabold tabular-nums text-slate-900">
                            ₹{inv.grandTotal.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination footer */}
          <div className="px-5 py-3.5 bg-[#fff8f9] border-t border-slate-100 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-slate-500">
              Showing <strong className="text-slate-900">{filteredInvoices.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> to{" "}
              <strong className="text-slate-900">{Math.min(filteredInvoices.length, currentPage * itemsPerPage)}</strong> of{" "}
              <strong className="text-slate-900">{filteredInvoices.length}</strong> transactions
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-40 shadow-sm"
              >
                <span className="material-symbols-outlined text-[15px]">chevron_left</span>
              </button>
              {(() => {
                const half = 2;
                let start = Math.max(1, currentPage - half);
                let end = Math.min(totalPages, start + 4);
                start = Math.max(1, end - 4);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i);
              })().map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-7 h-7 rounded-full text-[11px] font-extrabold transition-colors shadow-sm ${
                    page === currentPage ? "bg-[#b7102a] text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="w-7 h-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-40 shadow-sm"
              >
                <span className="material-symbols-outlined text-[15px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Sidebar ── */}
      <div className="w-[280px] shrink-0 space-y-4 sticky top-6">
        {/* Selection Preview */}
        <div className="bg-white rounded-2xl border-2 border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-slate-50">
            <p className="text-sm font-extrabold text-slate-900">Selection Preview</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedInvoice ? `Receipt ${selectedInvoice.invoiceNumber}` : "Tap a receipt to see details here"}
            </p>
          </div>

          {selectedInvoice ? (
            <div className="px-5 py-4 space-y-3">
              {/* Customer + cashier */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[11px] font-black text-slate-500 shrink-0">
                  {selectedInvoice.cashierName?.[0]?.toUpperCase() || "C"}
                </div>
                <div>
                  <p className="text-[12px] font-bold text-slate-700">{selectedInvoice.cashierName || "System"}</p>
                  <p className="text-[10px] text-slate-400">{selectedInvoice.customerName || "Walk-in customer"}</p>
                </div>
              </div>

              {/* Items list */}
              <div className="space-y-2">
                {selectedInvoice.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-700 truncate">{item.name}</span>
                    <span className="text-[11px] font-black text-slate-900 tabular-nums shrink-0">
                      {item.quantity} × ₹{item.unitPrice.toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-2 flex justify-between items-center">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">Total</span>
                <span className="text-base font-extrabold tabular-nums text-[#b7102a]">
                  ₹{selectedInvoice.grandTotal.toFixed(2)}
                </span>
              </div>

              {/* Status + payment */}
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide ${
                  selectedInvoice.status === "paid" ? "bg-emerald-50 text-emerald-600" :
                  selectedInvoice.status === "void" ? "bg-red-50 text-[#b7102a]" :
                  selectedInvoice.status === "unpaid" ? "bg-orange-50 text-orange-600" :
                  "bg-sky-50 text-sky-600"
                }`}>
                  {selectedInvoice.status}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedInvoice.paymentMethod}</span>
              </div>

              {/* Full receipt link + void */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => { window.location.href = `/invoices/${selectedInvoice.id}`; }}
                  className="w-full h-9 rounded-xl bg-slate-800 text-white text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-slate-700 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>
                  View Full Receipt
                </button>
                {selectedInvoice.status !== "void" && (
                  <button
                    onClick={(e) => handleVoid(e, selectedInvoice)}
                    disabled={voidingId === selectedInvoice.id}
                    className="w-full h-9 rounded-xl bg-red-50 text-[#b7102a] border border-red-200 text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-[15px]">{voidingId === selectedInvoice.id ? "hourglass_empty" : "block"}</span>
                    {voidingId === selectedInvoice.id ? "Voiding..." : "Void Receipt"}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="px-5 py-10 flex flex-col items-center text-center">
              <span className="material-symbols-outlined text-[48px] text-slate-200 mb-3">receipt_long</span>
              <p className="text-sm font-bold text-slate-400">Select a transaction from the list to view full itemized receipt and customer details.</p>
            </div>
          )}
        </div>

        {/* Promo banner */}
        <div className="rounded-2xl overflow-hidden relative bg-gradient-to-br from-[#c0392b] to-[#922b21] p-5 text-white">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
          <div className="w-12 h-12 rounded-full bg-teal-500 flex items-center justify-center mb-3 relative z-10">
            <span className="material-symbols-outlined text-white text-[24px]">star</span>
          </div>
          <p className="text-sm font-extrabold relative z-10">Member Rewards Active</p>
          <p className="text-[11px] text-white/70 mt-1 relative z-10">Double points on all wooden collections this week.</p>
        </div>

        {/* Actions */}
        <button
          onClick={handleDownloadCSV}
          className="w-full h-11 rounded-xl bg-[#b7102a] text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#9e0e24] transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          Download CSV
        </button>

        <button
          onClick={() => setSelectedInvoice(null)}
          className="w-full h-9 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <span className="material-symbols-outlined text-[16px]">grid_view</span>
          Clear Selection
        </button>
      </div>
    </div>
  );
}
