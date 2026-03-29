"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";

import {
  buildAccountingCsv,
  buildUnifiedExportCsv,
} from "@/lib/reports";

import { listCategories } from "@/lib/categories";
import type { CategoryDoc } from "@/lib/models";

/* ======================================================
   HELPERS
====================================================== */

function iso(date: Date) {
  return date.toISOString();
}

function download(csvText: string, filename: string) {
  const blob = new Blob([csvText], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ======================================================
   PAGE
====================================================== */

export default function AccountingExportPage() {
  const { user, loading } = useAuth();

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return iso(d);
  });

  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return iso(d);
  });

  // Accounting-only filters
  const [category, setCategory] = useState("");
  const [paymentMode, setPaymentMode] = useState("");

  const [categories, setCategories] = useState<CategoryDoc[]>([]);

  const [previewCsv, setPreviewCsv] = useState("");
  const [loadingAccounting, setLoadingAccounting] = useState(false);
  const [loadingUnified, setLoadingUnified] = useState(false);

  useEffect(() => {
    listCategories()
      .then((c) => setCategories(c.filter((x) => x.active)))
      .catch(() => undefined);
  }, []);

  /* ======================================================
     ACTIONS
  ====================================================== */

  async function runAccountingPreview() {
  setLoadingAccounting(true);
  try {
    const csv = await buildAccountingCsv(from, to);
    setPreviewCsv(csv);
  } finally {
    setLoadingAccounting(false);
  }
}

  async function runUnifiedExport() {
    setLoadingUnified(true);
    try {
      const csv = await buildUnifiedExportCsv(from, to);
      download(
        csv,
        `ALL_REPORTS_${from.slice(0, 10)}_${to.slice(0, 10)}.csv`
      );
    } finally {
      setLoadingUnified(false);
    }
  }

  /* ======================================================
     GUARDS
  ====================================================== */

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="flex min-h-full w-full bg-background text-foreground">
      
      <div className="flex flex-col flex-1">
        
        <main className="flex-1 p-6 space-y-6">
          <h1 className="text-xl font-semibold">
            Accounting & GST Export
          </h1>

          {/* ================= Filters ================= */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">From</label>
              <input
                type="datetime-local"
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={from.slice(0, 16)}
                onChange={(e) =>
                  setFrom(new Date(e.target.value).toISOString())
                }
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">To</label>
              <input
                type="datetime-local"
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={to.slice(0, 16)}
                onChange={(e) =>
                  setTo(new Date(e.target.value).toISOString())
                }
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground">
                Category (Accounting only)
              </label>
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
                Payment Mode (Accounting only)
              </label>
              <select
                className="w-full h-9 rounded-xl border bg-background px-2 text-sm"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="">All</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
                <option value="wallet">Wallet</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button
                className="px-3 py-2 rounded-xl border w-full"
                onClick={runAccountingPreview}
                disabled={loadingAccounting}
              >
                {loadingAccounting ? "Building…" : "Preview Accounting"}
              </button>
            </div>
          </div>

          {/* ================= Accounting Preview ================= */}
          {previewCsv && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Accounting Preview (first 20 rows)
              </div>
              <pre className="border rounded-xl p-2 max-h-64 overflow-auto text-xs whitespace-pre-wrap">
                {previewCsv.split("\n").slice(0, 21).join("\n")}
              </pre>
            </div>
          )}

          {/* ================= Unified Export ================= */}
          <div className="pt-6 border-t">
            <button
              className="px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-medium"
              onClick={runUnifiedExport}
              disabled={loadingUnified}
            >
              {loadingUnified
                ? "Exporting…"
                : "Export ALL Reports (Accounting + GST)"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
