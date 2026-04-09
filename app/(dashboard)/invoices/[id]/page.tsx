"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, runTransaction, increment, collection } from "firebase/firestore";
import type { InvoiceDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { getCustomer } from "@/lib/customers";
import { splitInclusive } from "@/lib/tax";
import { COLLECTIONS } from "@/lib/models";
import { useToast } from "@/components/ui/toast";

export default function InvoiceDetailsPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const [invoice, setInvoice] = useState<InvoiceDoc | null>(null);
  const [pending, setPending] = useState(true);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);

  useEffect(() => {
    if (!db || !id) return;
    const ref = doc(db, COLLECTIONS.invoices, id);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setInvoice(toInvoiceDoc(snap.id, snap.data() as Record<string, unknown>));
      } else {
        setInvoice(null);
      }
      setPending(false);
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        if (invoice?.customerId) {
          const c = await getCustomer(invoice.customerId);
          setCustomerName(c?.name || null);
        } else {
          setCustomerName(null);
        }
      } catch {
        setCustomerName(null);
      }
    })();
  }, [invoice?.customerId]);

  const billLevelDiscount = useMemo(() => invoice?.discountTotal ?? 0, [invoice]);

  const totalsInclusive = useMemo(() => {
    if (!invoice) return { base: 0, gst: 0, lineDisc: 0 };
    let base = 0, gst = 0, lineDisc = 0;
    for (const it of invoice.items) {
      const { base: b, gst: g } = splitInclusive(
        Number(it.unitPrice || 0),
        Number(it.taxRatePct || 0)
      );
      base += b * Number(it.quantity || 0);
      gst += g * Number(it.quantity || 0);
      lineDisc += Number(it.discountAmount || 0);
    }
    return { base, gst, lineDisc };
  }, [invoice]);

  const itemsWithNet = useMemo(() => {
    if (!invoice) return [];
    return invoice.items.map((it) => {
      const unit = it.unitPrice;
      const discount = it.discountAmount ?? 0;
      const net = unit * it.quantity - discount;
      return { name: it.name, qty: it.quantity, unit, discount, net };
    });
  }, [invoice]);

  const canExchange = useMemo(() => {
    if (!invoice || invoice.status === "void") return false;
    try {
      const issued = new Date(invoice.issuedAt);
      const now = new Date();
      const dayDiff = Math.floor((now.getTime() - issued.getTime()) / (24 * 60 * 60 * 1000));
      return dayDiff <= 14;
    } catch { return false; }
  }, [invoice]);

  const handleVoid = async () => {
    if (!invoice || !id || !db) return;
    const safeDb = db; // narrow to non-undefined for use inside async callbacks
    if (!confirm("Are you sure you want to void this invoice? This cannot be undone.")) return;
    setVoiding(true);
    try {
      const voidedAt = new Date().toISOString();

      // Use transaction to ensure atomicity: void invoice + restore stock + log
      await runTransaction(safeDb, async (txn) => {
        // 1. Update invoice status to void
        const invoiceRef = doc(safeDb, COLLECTIONS.invoices, id);
        txn.update(invoiceRef, { status: "void", updatedAt: voidedAt });

        // 2. Restore stock for each item and create reverse inventory logs
        for (const item of invoice.items) {
          // Restore product stock
          const prodRef = doc(safeDb, COLLECTIONS.products, item.productId);
          txn.update(prodRef, {
            stock: increment(item.quantity),
            updatedAt: voidedAt
          });

          // Create reverse inventory log (type: 'adjustment' = stock restored, reason clarifies it's a void)
          const logRef = doc(collection(safeDb, COLLECTIONS.inventoryLogs));
          txn.set(logRef, {
            type: 'adjustment',
            productId: item.productId,
            quantityChange: item.quantity,
            relatedInvoiceId: id,
            reason: 'Invoice voided — stock restored',
            userId: user?.uid || '',
            createdAt: voidedAt,
            updatedAt: voidedAt
          });
        }
      });
      
      toast({ title: "Invoice Voided", description: `Invoice ${invoice.invoiceNumber} has been cancelled and stock restored.` });
      
      // Fire-and-forget alert email to admin
      fetch("/api/notify/void", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoice.invoiceNumber,
          invoiceId: id,
          grandTotal: invoice.grandTotal,
          voidedBy: user?.displayName || user?.email || "Unknown",
          voidedAt,
        }),
      }).catch(() => {/* notification is best-effort */});
    } catch (err: any) {
      toast({ title: "Failed to Void", description: err.message, variant: "destructive" });
    } finally {
      setVoiding(false);
    }
  };

  const handlePrint = () => {
    window.open(`/invoices/receipt/${id}?mode=print`, "_blank");
  };

  const handleDownloadPdf = () => {
    window.open(`/invoices/receipt/${id}?mode=download`, "_blank");
  };

  if (loading) return <div className="p-8 text-slate-400 font-medium tracking-wide flex items-center gap-3"><span className="material-symbols-outlined animate-spin">progress_activity</span>Loading invoice...</div>;
  if (!user) return null;

  const statusColors: Record<string, string> = {
    paid: "bg-[#dcfce7] text-[#166534]",
    void: "bg-red-100 text-red-800",
    unpaid: "bg-orange-100 text-orange-800",
    partial: "bg-[#dbeafe] text-[#1e40af]",
  };

  return (
    <div className="space-y-6 max-w-4xl font-sans text-slate-900 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 shadow-sm transition-all">
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#b7102a] mb-0.5 block">Invoice Details</span>
            <h1 className="text-3xl font-extrabold tracking-tight leading-none">
              {pending ? "..." : invoice?.invoiceNumber || id}
            </h1>
          </div>
        </div>

        {invoice && (
          <div className="flex items-center gap-3 flex-wrap">
            {invoice.status !== "void" && (role === "admin" || role === "cashier") && (
              <>
                <button onClick={handleDownloadPdf} className="h-10 px-5 rounded-full bg-[#b7102a] text-white flex items-center gap-2 text-[13px] font-bold hover:bg-[#9b0e23] shadow-sm transition-all">
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download PDF
                </button>
                <button onClick={handlePrint} className="h-10 px-5 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center gap-2 text-[13px] font-bold hover:bg-slate-50 shadow-sm transition-all">
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Print
                </button>
              </>
            )}
            {canExchange && (
              <button onClick={() => window.location.href = window.location.pathname + "/exchange"} className="h-10 px-5 rounded-full bg-[#dbeafe] text-[#1e40af] border border-[#bfdbfe] flex items-center gap-2 text-[13px] font-bold hover:bg-blue-100 shadow-sm transition-all">
                <span className="material-symbols-outlined text-[18px]">swap_horiz</span>
                Exchange
              </button>
            )}
            {invoice.status !== "void" && (role === "admin" || role === "cashier") && (
              <button onClick={handleVoid} disabled={voiding} className="h-10 px-5 rounded-full bg-red-50 text-[#b7102a] border border-red-200 flex items-center gap-2 text-[13px] font-bold hover:bg-red-100 shadow-sm transition-all disabled:opacity-50">
                <span className="material-symbols-outlined text-[18px]">{voiding ? "hourglass_empty" : "block"}</span>
                {voiding ? "Voiding..." : "Void Invoice"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Loading/Error States */}
      {pending && (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-16 text-center">
          <span className="material-symbols-outlined animate-spin text-slate-300 text-[48px] block mb-4">autorenew</span>
          <p className="font-bold text-slate-400">Loading invoice data...</p>
        </div>
      )}
      {!pending && !invoice && (
        <div className="bg-white rounded-[2rem] border border-slate-100 p-16 text-center">
          <span className="material-symbols-outlined text-slate-200 text-[64px] block mb-4">receipt_long</span>
          <p className="font-bold text-slate-500 text-lg mb-2">Invoice Not Found</p>
          <p className="text-slate-400 text-sm">This invoice may have been deleted or the ID is incorrect.</p>
        </div>
      )}

      {invoice && (
        <>
          {/* Meta Card */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Status</p>
                  <span className={`inline-flex items-center gap-2 text-[12px] font-extrabold px-4 py-1.5 rounded-full uppercase tracking-wider ${statusColors[invoice.status] || "bg-slate-100 text-slate-700"}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></div>
                    {invoice.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Issued At</p>
                  <p className="font-bold text-slate-800">{new Date(invoice.issuedAt).toLocaleString('en-IN', { dateStyle: "long", timeStyle: "short" })}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Cashier</p>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-black border border-slate-200">
                      {(invoice.cashierName || "C")[0].toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-800">{invoice.cashierName || invoice.cashierUserId}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Customer</p>
                  <p className="font-bold text-slate-800">{customerName || invoice.customerName || "Walk-In Customer"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Payment Method</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">
                      {invoice.paymentMethod === "cash" ? "payments" : invoice.paymentMethod === "card" ? "credit_card" : "account_balance_wallet"}
                    </span>
                    <span className="font-extrabold text-slate-800 uppercase">{invoice.paymentMethod}</span>
                    {invoice.paymentReferenceId && (
                      <span className="text-[11px] font-bold text-slate-400">• {invoice.paymentReferenceId}</span>
                    )}
                  </div>
                </div>
                {invoice.notes && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notes</p>
                    <p className="text-sm font-medium text-slate-600">{invoice.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 py-5 bg-[#fce8ec]/30 border-b border-red-50">
              <h2 className="font-extrabold text-[17px]">Line Items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[600px]">
                <thead>
                  <tr className="bg-[#fce8ec]">
                    <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Item</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-center">Qty</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right">Unit Price</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right">Discount</th>
                    <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {itemsWithNet.map((l, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-5 font-bold text-slate-900">{l.name}</td>
                      <td className="px-6 py-5 text-center">
                        <span className="bg-slate-100 text-slate-600 text-[11px] font-extrabold px-3 py-1 rounded-full">{l.qty}</span>
                      </td>
                      <td className="px-6 py-5 text-right font-bold text-slate-500 tabular-nums">₹{l.unit.toFixed(2)}</td>
                      <td className="px-6 py-5 text-right text-red-500 font-bold tabular-nums">
                        {l.discount > 0 ? `-₹${l.discount.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-6 py-5 text-right font-extrabold text-slate-900 tabular-nums text-[16px]">₹{l.net.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals Footer */}
            <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50">
              <div className="ml-auto w-full max-w-sm space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold">Subtotal (ex-tax)</span>
                  <span className="font-bold tabular-nums">₹{totalsInclusive.base.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-bold">GST</span>
                  <span className="font-bold tabular-nums">₹{totalsInclusive.gst.toFixed(2)}</span>
                </div>
                {(totalsInclusive.lineDisc + billLevelDiscount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 font-bold">Total Discounts</span>
                    <span className="font-bold text-red-500 tabular-nums">-₹{(totalsInclusive.lineDisc + billLevelDiscount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-4 border-t border-slate-200">
                  <span className="font-extrabold text-[18px]">Grand Total</span>
                  <span className="font-extrabold text-[22px] tabular-nums text-[#b7102a]">₹{invoice.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
