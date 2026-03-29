"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";
import { aggregateInventoryMovement, type MovementRow } from "@/lib/reports";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function MovementReportPage() {
  const { user, loading } = useAuth();
  const [categories, setCategories] = useState<CategoryDoc[]>([]);
  const [category, setCategory] = useState<string>("");
  const [from, setFrom] = useState<string>(() =>
    isoDate(new Date(new Date().setDate(new Date().getDate() - 7)))
  );
  const [to, setTo] = useState<string>(() => isoDate(new Date()));
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listCategories()
      .then((c) => setCategories(c.filter((x) => x.active)))
      .catch(() => undefined);
  }, []);

  async function run() {
    setBusy(true);
    try {
      const fromIso = new Date(from + "T00:00:00Z").toISOString();
      const toIso = new Date(to + "T23:59:59Z").toISOString();
      const data = await aggregateInventoryMovement(fromIso, toIso, {
        category: category || undefined,
      });
      setRows(data);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    run();
  }, []);

  const totalIn = useMemo(() => rows.reduce((s, r) => s + r.qtyIn, 0), [rows]);
  const totalOut = useMemo(
    () => rows.reduce((s, r) => s + r.qtyOut, 0),
    [rows]
  );
  const totalNet = useMemo(() => rows.reduce((s, r) => s + r.net, 0), [rows]);

  function downloadCsv() {
    const headers = ["Name", "SKU", "Category", "Qty In", "Qty Out", "Net"];
    const lines = [headers.join(",")];
    for (const r of rows) {
      const cols = [
        r.name,
        r.sku,
        r.category || "",
        String(r.qtyIn),
        String(r.qtyOut),
        String(r.net),
      ];
      lines.push(
        cols
          .map((c) => (c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c))
          .join(",")
      );
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movement_${from}_${to}_${category || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;
  return (
    <div className="flex min-h-full w-full bg-background text-foreground">
      
      <div className="flex flex-col flex-1">
        
        <main className="flex-1 p-6 space-y-4">
          <h1 className="text-xl font-semibold">Inventory Movement Summary</h1>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">From</label>
              <input
                type="date"
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">To</label>
              <input
                type="date"
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
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
            <div className="flex items-end">
              <button
                className="px-3 py-2 rounded-xl border bg-background w-full"
                onClick={run}
                disabled={busy}
              >
                Apply
              </button>
            </div>
            <div className="flex items-end">
              <button
                className="px-3 py-2 rounded-xl border bg-background w-full"
                onClick={downloadCsv}
                disabled={rows.length === 0}
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
                  <th className="px-3 py-2 text-right">Qty In</th>
                  <th className="px-3 py-2 text-right">Qty Out</th>
                  <th className="px-3 py-2 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.productId} className="border-t">
                    <td className="px-3 py-2">{r.name}</td>
                    <td className="px-3 py-2">{r.sku}</td>
                    <td className="px-3 py-2">{r.category || "-"}</td>
                    <td className="px-3 py-2 text-right">{r.qtyIn}</td>
                    <td className="px-3 py-2 text-right">{r.qtyOut}</td>
                    <td className="px-3 py-2 text-right">{r.net}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-muted-foreground"
                      colSpan={6}
                    >
                      No movement in range
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t font-medium">
                    <td className="px-3 py-2" colSpan={3}>
                      Totals
                    </td>
                    <td className="px-3 py-2 text-right">{totalIn}</td>
                    <td className="px-3 py-2 text-right">{totalOut}</td>
                    <td className="px-3 py-2 text-right">{totalNet}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
