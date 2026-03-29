"use client";
import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QuerySnapshot,
  type QueryConstraint,
} from "firebase/firestore";
import { COLLECTIONS, type InventoryLogDoc } from "@/lib/models";
import { processInventoryExcel } from "@/lib/inventory-bulk";
import { useToast } from "@/components/ui/toast";
import * as XLSX from "xlsx";

function toLog(id: string, data: Record<string, unknown>): InventoryLogDoc {
  const now = new Date().toISOString();
  const validTypes = ["adjustment", "sale", "purchase", "return", "damage"];
  const t = typeof data.type === "string" && validTypes.includes(data.type) ? (data.type as InventoryLogDoc["type"]) : "adjustment";
  return {
    id,
    productId: String(data.productId || ""),
    type: t,
    quantityChange: typeof data.quantityChange === "number" ? data.quantityChange : Number(data.quantityChange || 0),
    reason: typeof data.reason === "string" ? data.reason : undefined,
    relatedInvoiceId: typeof data.relatedInvoiceId === "string" ? data.relatedInvoiceId : undefined,
    userId: typeof data.userId === "string" ? data.userId : undefined,
    previousStock: typeof data.previousStock === "number" ? data.previousStock : undefined,
    newStock: typeof data.newStock === "number" ? data.newStock : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : now,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : now,
  };
}

const TYPE_COLORS: Record<string, string> = {
  sale: "bg-[#dbeafe] text-[#1e40af]",
  purchase: "bg-[#dcfce7] text-[#166534]",
  adjustment: "bg-slate-100 text-slate-600",
  return: "bg-orange-100 text-orange-700",
  damage: "bg-red-100 text-[#b7102a]",
};

export default function InventoryLogsPage() {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logs, setLogs] = useState<InventoryLogDoc[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [prodId, setProdId] = useState("");
  const [type, setType] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!db) return;
    const col = collection(db, COLLECTIONS.inventoryLogs);
    const constraints: QueryConstraint[] = [orderBy("createdAt", "desc")];
    if (prodId) constraints.push(where("productId", "==", prodId));
    if (type) constraints.push(where("type", "==", type));
    if (from) constraints.push(where("createdAt", ">=", new Date(from).toISOString()));
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      constraints.push(where("createdAt", "<=", end.toISOString()));
    }
    const q = query(col, ...constraints);
    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      setLogs(snap.docs.map(d => toLog(d.id, d.data() as Record<string, unknown>)));
    });
    return () => unsub();
  }, [from, to, prodId, type]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await processInventoryExcel(file);
      toast({
        title: "Bulk Upload Complete",
        description: `Added: ${result.added}, Updated: ${result.updated}${result.errors.length ? `. Errors: ${result.errors.length}` : ""}`,
        variant: result.errors.length ? "warning" : "success",
      });
      e.target.value = "";
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleExportLogs = () => {
    if (logs.length === 0) return;
    const data = logs.map(l => ({
      Date: new Date(l.createdAt).toLocaleString(),
      ProductID: l.productId,
      Type: l.type,
      QuantityChange: l.quantityChange,
      PreviousStock: l.previousStock ?? "",
      NewStock: l.newStock ?? "",
      Reason: l.reason || "",
      RelatedInvoice: l.relatedInvoiceId || "",
      By: l.userId || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Logs");
    XLSX.writeFile(wb, `InventoryLogs_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast({ title: "Export Complete", description: "Excel file downloaded" });
  };

  const clearFilters = () => { setFrom(""); setTo(""); setProdId(""); setType(""); };

  if (loading) return <div className="p-8 font-bold text-slate-400">Loading logs...</div>;
  if (!user || role !== "admin") return <div className="p-6 bg-red-50 rounded-2xl text-red-700 font-bold">Admin access required.</div>;

  return (
    <div className="space-y-6">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".xlsx,.xls" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Inventory Logs</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Track all stock movements — sales, purchases, adjustments</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="h-10 px-5 rounded-full bg-[#dcfce7] text-[#166534] border border-green-200 font-bold text-[13px] flex items-center gap-2 hover:bg-green-100 shadow-sm transition-all disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">{isUploading ? "sync" : "upload_file"}</span>
            {isUploading ? "Importing..." : "Bulk Import"}
          </button>
          <button onClick={handleExportLogs} disabled={logs.length === 0} className="h-10 px-5 rounded-full bg-slate-100 text-slate-700 font-bold text-[13px] flex items-center gap-2 hover:bg-slate-200 shadow-sm transition-all disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#fff0f2]/60 rounded-[2rem] p-6 flex items-end gap-4 flex-wrap border border-red-50 shadow-sm">
        <div className="flex flex-col gap-1.5 flex-1 min-w-[130px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From Date</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-10 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[130px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To Date</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-10 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300" />
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[140px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Movement Type</label>
          <div className="relative">
            <select value={type} onChange={e => setType(e.target.value)} className="w-full h-10 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300">
              <option value="">All Types</option>
              <option value="sale">Sale</option>
              <option value="purchase">Purchase</option>
              <option value="adjustment">Adjustment</option>
              <option value="return">Return</option>
              <option value="damage">Damage</option>
            </select>
            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Product ID</label>
          <input type="text" value={prodId} onChange={e => setProdId(e.target.value)} placeholder="Filter by product..." className="h-10 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:text-slate-400 placeholder:font-normal" />
        </div>
        <button onClick={clearFilters} className="h-10 w-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 transition-colors shadow-sm mt-5" title="Clear Filters">
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="bg-[#fce8ec]">
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tl-[1.8rem]">Date & Time</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Product</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right">Δ Qty</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Stock</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Reason / Invoice</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tr-[1.8rem]">By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-slate-400">
                  <span className="material-symbols-outlined text-[48px] text-slate-200 block mx-auto mb-3">history</span>
                  <p className="font-bold">No inventory logs found</p>
                  <p className="text-sm mt-1">Adjust filters or import inventory to populate logs</p>
                </td></tr>
              ) : logs.map(l => (
                <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-slate-800">{new Date(l.createdAt).toLocaleDateString()}</div>
                    <div className="text-[11px] text-slate-400 font-medium">{new Date(l.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">{l.productId.slice(0, 12)}...</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-[11px] font-extrabold px-3 py-1.5 rounded-full uppercase ${TYPE_COLORS[l.type] || "bg-slate-100 text-slate-600"}`}>{l.type}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-extrabold text-[15px] tabular-nums ${l.quantityChange >= 0 ? "text-[#059669]" : "text-[#b7102a]"}`}>
                      {l.quantityChange >= 0 ? "+" : ""}{l.quantityChange}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {l.previousStock !== undefined && l.newStock !== undefined ? (
                      <div className="flex items-center gap-1.5 text-sm font-bold text-slate-500">
                        <span className="tabular-nums">{l.previousStock}</span>
                        <span className="material-symbols-outlined text-[14px] text-slate-300">arrow_forward</span>
                        <span className="tabular-nums text-slate-800">{l.newStock}</span>
                      </div>
                    ) : <span className="text-slate-300 font-bold">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      {l.reason && <div className="text-sm font-bold text-slate-700">{l.reason}</div>}
                      {l.relatedInvoiceId && <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-wider">{l.relatedInvoiceId.slice(0, 8)}</div>}
                      {!l.reason && !l.relatedInvoiceId && <span className="text-slate-300 font-bold">—</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[11px] font-bold text-slate-500">{l.userId ? l.userId.slice(0, 8) : "System"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length > 0 && (
          <div className="px-6 py-3 bg-[#fff0f2]/40 border-t border-slate-100 rounded-b-[2rem]">
            <p className="text-[11px] font-bold text-slate-400">{logs.length} records found</p>
          </div>
        )}
      </div>
    </div>
  );
}
