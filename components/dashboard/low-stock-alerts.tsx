"use client";
import { useEffect, useState } from "react";
import type { ProductDoc } from "@/lib/models";
import { observeLowStockProducts } from "@/lib/products";

export function LowStockAlerts() {
  const [items, setItems] = useState<ProductDoc[]>([]);

  useEffect(() => {
    const unsub = observeLowStockProducts(setItems);
    return () => unsub && unsub();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="bg-white border border-zinc-200/60 rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-display font-semibold text-zinc-800 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px] text-red-500">warning</span>
          </span>
          Low Stock Alerts
        </h2>
        <span className="h-6 px-2.5 rounded-full bg-red-50 text-[11px] font-semibold text-red-600 flex items-center">
          {items.length} {items.length === 1 ? 'Alert' : 'Alerts'}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((p) => (
          <div key={p.id} className="flex items-center justify-between p-3 bg-zinc-50/50 border border-zinc-100 rounded-lg hover:bg-zinc-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-white border border-zinc-200/60 flex items-center justify-center text-zinc-400 font-semibold text-xs uppercase shadow-sm">
                {p.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-800">{p.name}</p>
                <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">SKU: {p.sku}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-md">{p.stock} left</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
