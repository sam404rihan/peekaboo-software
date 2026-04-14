"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listProducts, findProductBySKU } from "@/lib/products";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, increment, updateDoc, writeBatch } from "firebase/firestore";
import { COLLECTIONS, type ProductDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";

interface ReceiveLine {
  id: string;          // temp uuid
  productId: string;
  sku: string;
  name: string;
  qty: number;
  qtyInput: string;
  unitCost: string;    // cost price at time of receipt
  note: string;
}

function uid() { return Math.random().toString(36).slice(2, 10); }

export default function ReceiveStockPage() {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [lines, setLines] = useState<ReceiveLine[]>([]);
  const [supplierName, setSupplierName] = useState("");
  const [docNo, setDocNo] = useState("");
  const [docDate, setDocDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // For SKU quick-scan input
  const [skuScan, setSkuScan] = useState("");

  useEffect(() => { listProducts().then(setProducts); }, []);

  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const skuMap = useMemo(() => new Map(products.map(p => [p.sku, p])), [products]);

  const addBlankLine = () => {
    setLines(prev => [...prev, { id: uid(), productId: "", sku: "", name: "", qty: 1, qtyInput: "1", unitCost: "", note: "" }]);
  };

  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const patchLine = (id: string, patch: Partial<ReceiveLine>) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  const handleSkuScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const sku = skuScan.trim().toUpperCase();
    if (!sku) return;
    setSkuScan("");
    const prod = skuMap.get(sku) || await findProductBySKU(sku);
    if (!prod || !prod.id) { toast({ title: "Product not found", description: `SKU "${sku}" not in catalog`, variant: "destructive" }); return; }
    // If already in lines, increment qty
    const existing = lines.find(l => l.productId === prod.id);
    if (existing) {
      patchLine(existing.id, { qty: existing.qty + 1, qtyInput: String(existing.qty + 1) });
      toast({ title: "Qty updated", description: `${prod.name} → ${existing.qty + 1}` });
    } else {
      setLines(prev => [...prev, { id: uid(), productId: prod.id!, sku: prod.sku, name: prod.name, qty: 1, qtyInput: "1", unitCost: prod.unitPrice ? String(prod.unitPrice) : "", note: "" }]);
    }
  };

  const handleProductSelect = (lineId: string, productId: string) => {
    const prod = productMap.get(productId);
    if (!prod) { patchLine(lineId, { productId: "", sku: "", name: "" }); return; }
    patchLine(lineId, { productId: prod.id!, sku: prod.sku, name: prod.name, unitCost: prod.unitPrice ? String(prod.unitPrice) : "" });
  };

  const totalUnits = lines.reduce((s, l) => s + (Number(l.qtyInput) || 0), 0);
  const totalCost = lines.reduce((s, l) => s + (Number(l.qtyInput) || 0) * (parseFloat(l.unitCost) || 0), 0);

  const handleSubmit = async () => {
    if (lines.length === 0) { toast({ title: "No items added", variant: "destructive" }); return; }
    const invalid = lines.find(l => !l.productId || !Number(l.qtyInput) || Number(l.qtyInput) <= 0);
    if (invalid) { toast({ title: "Check all lines", description: "Every row needs a product and qty > 0", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const batch = writeBatch(db!);
      const now = new Date().toISOString();

      // Build goods receipt doc
      const grRef = doc(collection(db!, COLLECTIONS.goodsReceipts));
      batch.set(grRef, {
        supplierName: supplierName.trim() || "",
        docNo: docNo.trim() || "",
        docDate,
        note: note.trim() || "",
        createdByUserId: user!.uid,
        createdAt: now,
        updatedAt: now,
        lines: lines.map(l => ({
          productId: l.productId,
          sku: l.sku,
          name: l.name,
          qty: Number(l.qtyInput),
          unitCost: parseFloat(l.unitCost) || 0,
        })),
      });

      // Increment each product's stock and log each movement
      for (const line of lines) {
        const qty = Number(line.qtyInput);
        const pRef = doc(db!, COLLECTIONS.products, line.productId);
        batch.update(pRef, { stock: increment(qty), updatedAt: now });

        const logRef = doc(collection(db!, COLLECTIONS.inventoryLogs));
        batch.set(logRef, {
          productId: line.productId,
          type: "purchase",
          quantityChange: qty,
          reason: `Goods Receipt${docNo ? ` #${docNo}` : ""}`,
          userId: user!.uid,
          relatedInvoiceId: grRef.id,
          createdAt: now,
          updatedAt: now,
        });
      }

      await batch.commit();

      toast({ title: "Stock Received", description: `${lines.length} items · ${totalUnits} units added to inventory`, variant: "success" });

      // Reset form
      setLines([]);
      setSupplierName("");
      setDocNo("");
      setNote("");
      setDocDate(new Date().toISOString().split("T")[0]);
    } catch (err: any) {
      toast({ title: "Failed to receive stock", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 font-bold text-slate-400">Loading...</div>;
  if (!user || role !== "admin") return <div className="p-6 bg-red-50 rounded-2xl text-red-700 font-bold">Admin access required.</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Receive Stock</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">Record incoming goods — instantly updates stock and inventory logs</p>
      </div>

      {/* Header */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Receipt Details</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Supplier Name</label>
            <input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Supplier Co." className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 placeholder:font-normal placeholder:text-slate-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document No.</label>
            <input value={docNo} onChange={e => setDocNo(e.target.value)} placeholder="GR-001" className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 placeholder:font-normal placeholder:text-slate-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receipt Date</label>
            <input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Any notes about this receipt..." className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 placeholder:font-normal placeholder:text-slate-400" />
        </div>
      </div>

      {/* SKU Scanner */}
      <div className="bg-[#fff0f2]/60 rounded-[2rem] p-5 border border-red-50 flex items-center gap-4">
        <span className="material-symbols-outlined text-[#b7102a] text-[28px]">barcode_reader</span>
        <div className="flex-1">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Scan / Enter SKU</p>
          <input
            value={skuScan}
            onChange={e => setSkuScan(e.target.value.toUpperCase())}
            onKeyDown={handleSkuScan}
            placeholder="Scan barcode or type SKU and press Enter..."
            className="w-full h-11 bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
        <button onClick={addBlankLine} className="h-10 px-5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-[13px] flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Row
        </button>
      </div>

      {/* Lines */}
      {lines.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-[#fce8ec]">
                  <th className="px-5 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tl-[1.8rem]">Product</th>
                  <th className="px-5 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right w-24">Qty to Add</th>
                  <th className="px-5 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right w-32">Unit Cost (₹)</th>
                  <th className="px-5 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-right w-28">Line Total</th>
                  <th className="px-5 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tr-[1.8rem] w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {lines.map((line, idx) => (
                  <tr key={line.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      {line.productId ? (
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{line.name}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase">{line.sku}</div>
                        </div>
                      ) : (
                        <div className="relative">
                          <select
                            value={line.productId}
                            onChange={e => handleProductSelect(line.id, e.target.value)}
                            className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-slate-700 appearance-none outline-none focus:ring-1 focus:ring-red-300"
                          >
                            <option value="">Select product...</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[16px]">expand_more</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <input
                        type="number" min={1}
                        value={line.qtyInput}
                        onChange={e => patchLine(line.id, { qtyInput: e.target.value, qty: Number(e.target.value) })}
                        className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-bold text-right text-slate-700 outline-none focus:ring-1 focus:ring-red-300 tabular-nums"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                        <input
                          type="number" min={0}
                          value={line.unitCost}
                          onChange={e => patchLine(line.id, { unitCost: e.target.value })}
                          placeholder="0.00"
                          className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl pl-7 pr-3 text-sm font-bold text-right text-slate-700 outline-none focus:ring-1 focus:ring-red-300 tabular-nums placeholder:text-slate-300"
                        />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-extrabold tabular-nums text-slate-800">
                        {((Number(line.qtyInput) || 0) * (parseFloat(line.unitCost) || 0)) > 0
                          ? `₹${((Number(line.qtyInput) || 0) * (parseFloat(line.unitCost) || 0)).toFixed(2)}`
                          : "—"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => removeLine(line.id)} className="w-8 h-8 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all">
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Footer */}
          <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between rounded-b-[2rem]">
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className="text-slate-400 font-bold">Total Units: </span>
                <span className="font-extrabold text-slate-900 tabular-nums">{totalUnits}</span>
              </div>
              {totalCost > 0 && (
                <div>
                  <span className="text-slate-400 font-bold">Total Cost: </span>
                  <span className="font-extrabold text-slate-900 tabular-nums">₹{totalCost.toFixed(2)}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={saving || lines.length === 0}
              className="h-11 px-8 rounded-full bg-[#b7102a] text-white font-extrabold text-[13px] flex items-center gap-2 hover:brightness-110 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">{saving ? "sync" : "done_all"}</span>
              {saving ? "Receiving..." : `Receive ${totalUnits} Units`}
            </button>
          </div>
        </div>
      )}

      {lines.length === 0 && (
        <div className="bg-white rounded-[2rem] border-2 border-dashed border-slate-200 p-16 text-center">
          <span className="material-symbols-outlined text-[64px] text-slate-200 block mx-auto mb-4">inventory_2</span>
          <p className="font-bold text-slate-500 text-lg mb-2">No items added yet</p>
          <p className="text-slate-400 text-sm mb-6">Scan a barcode, enter a SKU above, or click "Add Row" to begin</p>
          <button onClick={addBlankLine} className="h-10 px-6 rounded-full bg-[#b7102a] text-white font-bold text-[13px] inline-flex items-center gap-2 hover:brightness-110 shadow-sm transition-all">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add First Item
          </button>
        </div>
      )}
    </div>
  );
}
