"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listProducts } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc, ProductDoc } from "@/lib/models";

export default function StockReportPage() {
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<ProductDoc[]>([]);
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [category, setCategory] = useState<string>("");
  const [onlyLow, setOnlyLow] = useState<boolean>(true);
  const [threshold, setThreshold] = useState<number>(5);

  useEffect(() => {
    Promise.all([listProducts(), listCategories()])
      .then(([prods, cats]) => {
        setProducts(prods);
        setCategories(cats.filter((c) => c.active));
      })
      .catch(() => undefined);
  }, []);

  const rows = useMemo(() => {
    return products.filter((p) => {
      if (category && (p.category || "") !== category) return false;
      if (!onlyLow) return true;
      const thr =
        typeof p.reorderLevel === "number" ? p.reorderLevel : threshold;
      return p.stock <= thr;
    });
  }, [products, category, onlyLow, threshold]);

  function toCsv() {
    const headers = [
      "Name",
      "SKU",
      "Category",
      "HSN",
      "Unit Price",
      "Stock",
      "Reorder Level",
    ];
    const lines = [headers.join(",")];
    for (const p of rows) {
      const cols = [
        p.name,
        p.sku,
        p.category || "",
        p.hsnCode || "",
        String(p.unitPrice),
        String(p.stock),
        String(p.reorderLevel ?? ""),
      ];
      lines.push(
        cols
          .map((c) => (c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c))
          .join(",")
      );
    }
    return lines.join("\n");
  }

  function downloadCsv() {
    const csv = toCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock_${category || "all"}_${onlyLow ? "low" : "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;
  return (
    <div className="flex min-h-full w-full bg-background text-foreground">
      
      <div className="flex flex-col flex-1">
        
        <main className="flex-1 p-6 space-y-4">
          <h1 className="text-xl font-semibold">Stock Report</h1>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">Category</label>
              <select
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">
                Only Low Stock
              </label>
              <select
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={String(onlyLow)}
                onChange={(e) => setOnlyLow(e.target.value === "true")}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">
                Default Threshold
              </label>
              <input
                type="number"
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value || 0))}
              />
              <div className="text-xs text-muted-foreground">
                Used when product has no reorder level
              </div>
            </div>
            <div className="flex items-end">
              <button
                className="px-3 py-2 rounded-xl border bg-background w-full"
                onClick={downloadCsv}
              >
                Export CSV
              </button>
            </div>
          </div>
          <div className="border rounded-xl overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">SKU</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">HSN</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Stock</th>
                  <th className="px-3 py-2 text-right">Reorder Level</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="px-3 py-2">{p.name}</td>
                    <td className="px-3 py-2">{p.sku}</td>
                    <td className="px-3 py-2">{p.category || "-"}</td>
                    <td className="px-3 py-2">{p.hsnCode || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      ₹{p.unitPrice.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">{p.stock}</td>
                    <td className="px-3 py-2 text-right">
                      {p.reorderLevel ?? "-"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-muted-foreground"
                      colSpan={7}
                    >
                      No products match filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
