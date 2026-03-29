"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import JsBarcode from "jsbarcode";
import { listProducts } from "@/lib/products";
import type { ProductDoc } from "@/lib/models";
import { categoryCode } from "@/lib/models";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className || ''}`}>{name}</span>;
}

function encodeBarcode(p: ProductDoc, categories: CategoryDoc[]): string {
  const catName = p.category;
  let code = categoryCode(catName);
  if (catName) {
    const match = categories.find(
      (c) => c.active && c.name.toLowerCase() === catName.toLowerCase()
    );
    if (match?.code) code = match.code.toUpperCase();
  }
  return `PB|${code}|${p.sku}`;
}

export default function BarcodeGeneratorPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [productId, setProductId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (role !== "admin" && role !== "cashier") { // Allowed for demo, customize based on true role
      router.replace("/dashboard");
      return;
    }
    Promise.all([listProducts(), listCategories()])
      .then(([list, cats]) => {
        setProducts(list);
        if (list.length > 0) setProductId(""); // Start empty to show "Select product"
        setCategories(cats.filter((c) => c.active));
      })
      .catch((e) => console.error(e));
  }, [loading, user, role, router]);

  const selected = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId]
  );

  useEffect(() => {
    if (!selected) return;
    const code = encodeBarcode(selected, categories);
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      JsBarcode(canvas, code, {
        format: "CODE128B",
        displayValue: false,
        margin: 0,
        height: 35,
        width: 2
      });
    } catch (e) {
      console.error("Barcode render failed", e);
    }
  }, [selected, qty, categories]);

  function printLabels() {
    if (!selected) return;
    const count = Math.max(1, Math.min(300, Math.floor(qty)));
    toast({
      title: "Sending to print…",
      description: `${count} label(s) for ${selected.name}`,
      variant: "info",
      duration: 2000,
    });
    try {
      const url = `/settings/barcodes/print/${selected.id}/${count}`;
      window.open(url, "_blank", "noopener");
    } catch {
      router.push(`/settings/barcodes/print/${selected.id}/${count}`);
    }
  }

  return (
    <div className="flex flex-col h-full font-sans max-w-4xl mx-auto pt-4 relative">
      <div className="flex flex-col mb-6 w-full items-center relative">
         <button 
           onClick={() => window.history.back()} 
           className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors absolute left-0 top-1/2 -translate-y-1/2"
         >
            <MSIcon name="arrow_back" className="text-slate-700 text-[20px] font-bold" />
         </button>
         <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">Barcode Generator</h2>
      </div>

      <div className="bg-white border-2 border-slate-100 rounded-[1.5rem] p-6 shadow-sm w-full mx-auto pb-10">
        
        {/* Controls Row */}
        <div className="flex flex-col md:flex-row items-end gap-6 mb-8 w-full">
           <div className="flex-1 flex flex-col gap-2 w-full">
              <label className="text-[11px] font-bold text-slate-500 tracking-wide">Product</label>
              <div className="relative">
                 <select
                   className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 appearance-none shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200"
                   value={productId}
                   onChange={(e) => setProductId(e.target.value)}
                 >
                   <option value="">Select a product...</option>
                   {products.map((p) => (
                     <option key={p.id} value={p.id}>{p.name}</option>
                   ))}
                 </select>
                 <MSIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]"/>
              </div>
           </div>

           <div className="w-[140px] flex flex-col gap-2 shrink-0">
              <label className="text-[11px] font-bold text-slate-500 tracking-wide">Quantity</label>
              <input
                 type="number"
                 min={1}
                 max={300}
                 value={qty}
                 onChange={(e) => setQty(Number(e.target.value))}
                 className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200"
              />
           </div>

           <button 
              onClick={printLabels} 
              disabled={!selected}
              className="h-[46px] px-8 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50 disabled:shadow-none whitespace-nowrap"
           >
             Print Labels
           </button>
        </div>

        {/* Layout Row */}
        <div className="flex flex-col md:flex-row gap-10">
           
           <div className="flex-1 max-w-sm">
             <label className="text-[11px] font-bold text-slate-500 tracking-wide mb-3 block">Preview (50×25 mm, horizontal)</label>
             <div className="h-40 w-full rounded-2xl bg-[#fafafa] border border-slate-100 flex items-center justify-center relative overflow-hidden shadow-inner">
               {selected ? (
                  <div
                    className="bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-between text-center overflow-hidden relative"
                    style={{ width: "200px", height: "100px", padding: "8px" }} // scale up representation
                  >
                    <div className="text-[12px] font-bold leading-tight w-full truncate mb-1">
                      {selected.name}
                    </div>
                    <div className="text-[16px] font-extrabold leading-none mb-1 text-slate-800">
                      SP - ₹{selected.unitPrice.toFixed(0)}
                    </div>
                    <div className="flex-1 w-full flex items-center justify-center overflow-hidden py-1">
                      <canvas
                        ref={canvasRef}
                        className="max-h-full max-w-full"
                      />
                    </div>
                    <div className="w-full flex justify-between items-end mt-1 text-[8px]">
                      {selected.mrp && selected.mrp > selected.unitPrice ? (
                        <span className="text-slate-500 font-medium line-through leading-none">
                          MRP ₹{selected.mrp.toFixed(0)}
                        </span>
                      ) : (
                        <span></span>
                      )}
                      <span className="font-mono text-[9px] leading-none font-bold text-slate-700">
                        {encodeBarcode(selected, categories)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[12px] font-medium text-slate-400">
                    Select a product to preview
                  </div>
                )}
             </div>
           </div>

           <div className="flex-[0.8]">
             <label className="text-[11px] font-bold text-slate-500 tracking-wide mb-3 block">Layout</label>
             <div className="text-[13px] font-medium text-[#111827] space-y-1.5 leading-relaxed">
                <p>Label size: 50×25 mm.</p>
                <p><strong className="font-bold text-slate-700">Top:</strong> Name</p>
                <p><strong className="font-bold text-slate-700">Below Name:</strong> SP - ₹Price</p>
                <p><strong className="font-bold text-slate-700">Middle:</strong> Barcode</p>
                <p><strong className="font-bold text-slate-700">Bottom:</strong> MRP (Strikethrough) & SKU</p>
             </div>
           </div>

        </div>

      </div>
    </div>
  );
}