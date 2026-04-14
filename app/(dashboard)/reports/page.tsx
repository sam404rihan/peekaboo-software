"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";

import {
  listInvoicesInRange,
  aggregateByPeriod,
  aggregatePaymentModes,
  buildAccountingCsv,
  aggregateInventoryMovement,
  aggregateInventoryAging,
  aggregateByStaff,
  aggregateByBrand,
  type Period,
  type AgingRow,
  type AgingSummary,
  type AgingBucket,
  type StaffRow,
  type BrandRow,
} from "@/lib/reports";

import { listProducts } from "@/lib/products";
import { cn } from "@/lib/utils";

/* ======================================================
   HELPERS & ICONS
====================================================== */

function MSIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
   return <span className={cn("material-symbols-outlined", className)} style={style}>{name}</span>;
}

function toIsoLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
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

export default function ReportsIndexPage() {
  const { user, loading } = useAuth();
  type TabKey =
    | "sales"
    | "payments"
    | "profitloss"
    | "accounting"
    | "stock"
    | "movement"
    | "aging"
    | "staff"
    | "brand";

  const [tab, setTab] = useState<TabKey>("sales");

  if (loading) return <div className="p-8 text-slate-400 font-medium tracking-wide flex items-center gap-3"><span className="material-symbols-outlined animate-spin">progress_activity</span>Loading reports...</div>;
  if (!user) return null;

  const tabs = [
    { key: "sales",      label: "Sales Summary",      desc: "Revenue & volume by period",      icon: "bar_chart"    },
    { key: "payments",   label: "Payment Modes",      desc: "Cash, card, UPI breakdown",       icon: "payments"     },
    { key: "profitloss", label: "Profit & Loss",      desc: "Gross margin vs cost",            icon: "trending_up"  },
    { key: "accounting", label: "Accounting Export",  desc: "GST-compliant CSV download",      icon: "receipt_long" },
    { key: "stock",      label: "Stock Levels",       desc: "Current on-hand quantities",      icon: "inventory_2"  },
    { key: "movement",   label: "Inventory Movement", desc: "Sales, purchases & adjustments",  icon: "swap_vert"    },
    { key: "aging",      label: "Inventory Aging",    desc: "Slow-moving & dead stock",        icon: "schedule"     },
    { key: "staff",      label: "Staff Report",       desc: "Sales attributed per cashier",    icon: "badge"        },
    { key: "brand",      label: "Brand Report",       desc: "Performance by brand / supplier", icon: "sell"         },
  ] as Array<{ key: TabKey; label: string; desc: string; icon: string }>;

  const activeTab = tabs.find(t => t.key === tab)!;

  return (
    <div className="flex flex-col font-sans text-slate-900" style={{ height: "calc(100vh - 80px)" }}>
      {/* Header row + picker in one compact bar */}
      <div className="shrink-0 flex items-center gap-4 mb-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#b7102a]">
            Business Intelligence
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight leading-tight">Analytics & Reports</h1>
        </div>

        {/* Styled select picker */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <MSIcon name={activeTab.icon} className="text-[18px] text-[#b7102a]" />
          </div>
          <select
            value={tab}
            onChange={e => setTab(e.target.value as TabKey)}
            className="h-11 pl-10 pr-10 bg-white border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-red-200 appearance-none cursor-pointer"
          >
            {tabs.map(it => (
              <option key={it.key} value={it.key}>{it.label}</option>
            ))}
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <MSIcon name="expand_more" className="text-[18px] text-slate-400" />
          </div>
        </div>
      </div>

      {/* Content panel — fills remaining height, scrolls internally */}
      <div className="flex-1 min-h-0 bg-white rounded-[2rem] border border-slate-100/60 shadow-sm flex flex-col overflow-hidden">
        {/* Panel header */}
        <div className="shrink-0 flex items-center gap-3 px-7 py-5 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-[#b7102a] flex items-center justify-center shadow-sm">
            <MSIcon name={activeTab.icon} className="text-white text-[18px]" />
          </div>
          <div>
            <p className="text-[15px] font-extrabold text-slate-900 leading-tight">{activeTab.label}</p>
            <p className="text-[11px] text-slate-400 font-medium">{activeTab.desc}</p>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-7 py-6">
          {tab === "sales"      && <SalesInline />}
          {tab === "payments"   && <PaymentsInline />}
          {tab === "profitloss" && <ProfitLossInline />}
          {tab === "accounting" && <AccountingInline />}
          {tab === "stock"      && <StockInline />}
          {tab === "movement"   && <MovementInline />}
          {tab === "aging"      && <AgingInline />}
          {tab === "staff"      && <StaffInline />}
          {tab === "brand"      && <BrandInline />}
        </div>
      </div>
    </div>
  );
}

/* ======================================================
   DATE RANGE
====================================================== */

function DateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
}: {
  from: Date;
  to: Date;
  onFromChange: (d: Date) => void;
  onToChange: (d: Date) => void;
}) {
  return (
    <div className="flex flex-col md:flex-row items-end gap-6 bg-[#fff0f2]/60 p-6 rounded-[2rem] border border-slate-100/50 shadow-sm mb-6 flex-wrap">
      <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
        <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Date Range From</label>
        <input
          type="datetime-local"
          className="h-12 w-full bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 transition-all uppercase"
          value={toIsoLocal(from)}
          onChange={(e) => onFromChange(new Date(e.target.value))}
        />
      </div>
      <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
        <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Date Range To</label>
        <input
          type="datetime-local"
          className="h-12 w-full bg-white border-0 rounded-xl px-4 text-sm font-bold text-slate-700 shadow-sm outline-none ring-1 ring-slate-200/50 focus:ring-red-300 transition-all uppercase"
          value={toIsoLocal(to)}
          onChange={(e) => onToChange(new Date(e.target.value))}
        />
      </div>
    </div>
  );
}

/* ======================================================
   SALES
====================================================== */

function SalesInline() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [period, setPeriod] = useState<Period>("day");
  const [rows, setRows] = useState<
    { period: string; invoices: number; total: number }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const invs = await listInvoicesInRange(
        from.toISOString(),
        to.toISOString()
      );
      setRows(aggregateByPeriod(invs, period));
    } finally {
      setLoading(false);
    }
  }, [from, to, period]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-end gap-6 justify-between flex-wrap">
         <div className="flex-1 w-full max-w-2xl">
            <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
         </div>
         <div className="flex flex-col gap-2 mb-6">
            <label className="text-[10px] uppercase tracking-widest font-black text-slate-400">Aggregation</label>
            <div className="relative">
               <select
                 className="h-12 w-48 bg-white border-0 rounded-xl px-4 text-[13px] font-bold text-slate-700 shadow-sm appearance-none outline-none ring-1 ring-slate-200/50 focus:ring-red-300 transition-all"
                 value={period}
                 onChange={(e) => setPeriod(e.target.value as Period)}
               >
                 <option value="day">Daily Breakdown</option>
                 <option value="week">Weekly Breakdown</option>
                 <option value="month">Monthly Breakdown</option>
               </select>
               <MSIcon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]"/>
            </div>
         </div>
      </div>
      
      {loading ? (
        <div className="py-20 flex justify-center"><MSIcon name="autorenew" className="animate-spin text-[32px] text-slate-300" /></div>
      ) : (
        <Table
          columns={["Period", "Invoices", "Total Sales"]}
          rows={rows.map((r) => [
            { value: r.period, className: "font-black" },
            { value: r.invoices.toString(), className: "tabular-nums" },
            { value: `₹${r.total.toFixed(2)}`, className: "font-extrabold text-[15px] tabular-nums" }
          ])}
          emptyText="No sales recorded for this period."
        />
      )}
    </div>
  );
}

/* ======================================================
   PAYMENTS
====================================================== */

function PaymentsInline() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [rows, setRows] = useState<{ method: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const invs = await listInvoicesInRange(from.toISOString(), to.toISOString());
      setRows(aggregatePaymentModes(invs));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    run();
  }, [run]);

  return (
    <div className="space-y-6">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      {loading ? (
         <div className="py-20 flex justify-center"><MSIcon name="autorenew" className="animate-spin text-[32px] text-slate-300" /></div>
      ) : (
        <Table
          columns={["Payment Mode", "Total Amount"]}
          rows={rows.map((r) => [
             { value: r.method.toUpperCase(), className: "font-black tracking-wider text-[11px]" },
             { value: `₹${r.amount.toFixed(2)}`, className: "font-extrabold text-[15px] tabular-nums text-[#059669]" }
          ])}
          emptyText="No payment data found."
        />
      )}
    </div>
  );
}

/* ======================================================
   PROFIT & LOSS
====================================================== */

function ProfitLossInline() {
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [to, setTo] = useState(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d;
  });

  const [revenue, setRevenue] = useState(0);
  const [cogs, setCogs] = useState(0);
  const [taxCollected, setTaxCollected] = useState(0);
  const [discountsGiven, setDiscountsGiven] = useState(0);
  const [topRows, setTopRows] = useState<{ name: string; revenue: number; cost: number; margin: number }[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const [invs, prods] = await Promise.all([
        listInvoicesInRange(from.toISOString(), to.toISOString()),
        listProducts(),
      ]);
      const productMap = new Map(prods.map(p => [p.id, p]));

      let rev = 0, cost = 0, tax = 0, disc = 0;
      const productAgg = new Map<string, { name: string; revenue: number; cost: number }>();

      for (const inv of invs) {
        rev += inv.grandTotal;
        disc += inv.discountTotal ?? 0;
        for (const item of inv.items) {
          const lineRev = item.unitPrice * item.quantity - (item.discountAmount ?? 0);
          const rate = (item.taxRatePct ?? 0) / 100;
          const lineTax = rate > 0 ? lineRev - lineRev / (1 + rate) : 0;
          tax += lineTax;

          const prod = productMap.get(item.productId);
          const unitCost = prod?.unitPrice ?? 0;
          const lineCost = unitCost * item.quantity;
          cost += lineCost;

          const cur = productAgg.get(item.productId) || { name: item.name, revenue: 0, cost: 0 };
          cur.revenue += lineRev;
          cur.cost += lineCost;
          productAgg.set(item.productId, cur);
        }
      }

      setRevenue(rev);
      setCogs(cost);
      setTaxCollected(tax);
      setDiscountsGiven(disc);

      const rows = Array.from(productAgg.values())
        .map(r => ({ ...r, margin: r.cost > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 100 }))
        .sort((a, b) => (b.revenue - b.cost) - (a.revenue - a.cost))
        .slice(0, 5);
      setTopRows(rows);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { run(); }, [run]);

  const grossProfit = revenue - cogs;
  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netProfit = grossProfit - taxCollected;

  return (
    <div className="space-y-6">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      {loading ? (
        <div className="py-20 flex justify-center"><MSIcon name="autorenew" className="animate-spin text-[32px] text-slate-300" /></div>
      ) : (
        <div className="space-y-6">
          {/* P&L Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Gross Revenue", value: `₹${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "bg-[#dcfce7] text-[#166534]", icon: "trending_up" },
              { label: "COGS (Est.)", value: `₹${cogs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "bg-slate-50 text-slate-700", icon: "inventory", note: cogs === 0 ? "Set cost prices in Products" : "" },
              { label: "Gross Profit", value: `₹${grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: grossProfit >= 0 ? "bg-[#dbeafe] text-[#1e40af]" : "bg-red-50 text-red-700", icon: "account_balance" },
              { label: "Gross Margin", value: `${grossMarginPct.toFixed(1)}%`, color: grossMarginPct >= 30 ? "bg-[#dcfce7] text-[#166534]" : "bg-orange-50 text-orange-700", icon: "percent" },
            ].map(card => (
              <div key={card.label} className={`${card.color} rounded-2xl p-5 flex flex-col gap-2`}>
                <div className="flex justify-between items-start">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{card.label}</p>
                  <MSIcon name={card.icon} className="text-[20px] opacity-50" />
                </div>
                <p className="text-2xl font-extrabold tabular-nums">{card.value}</p>
                {card.note && <p className="text-[10px] font-bold opacity-60">{card.note}</p>}
              </div>
            ))}
          </div>

          {/* Additional breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Discounts Given</p>
                <p className="text-xl font-extrabold text-[#b7102a] tabular-nums">-₹{discountsGiven.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <MSIcon name="local_offer" className="text-[32px] text-slate-200" />
            </div>
            <div className="bg-slate-50 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">GST Collected</p>
                <p className="text-xl font-extrabold text-slate-700 tabular-nums">₹{taxCollected.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              </div>
              <MSIcon name="account_balance" className="text-[32px] text-slate-200" />
            </div>
          </div>

          {/* Top Profitable Products */}
          {topRows.length > 0 && (
            <Table
              columns={["Product", "Revenue", "Est. Cost", "Gross Margin"]}
              rows={topRows.map(r => [
                { value: r.name, className: "font-bold" },
                { value: `₹${r.revenue.toFixed(0)}`, className: "tabular-nums font-bold text-[#059669]" },
                { value: r.cost > 0 ? `₹${r.cost.toFixed(0)}` : "—", className: "tabular-nums text-slate-500 font-bold" },
                { value: `${r.margin.toFixed(1)}%`, className: `font-extrabold tabular-nums ${r.margin >= 30 ? "text-[#059669]" : "text-orange-600"}` },
              ])}
              emptyText="No product data."
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ======================================================
   ACCOUNTING & GST EXPORT
====================================================== */

function AccountingInline() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  });
  const [busy, setBusy] = useState(false);

  const exportAccounting = async () => {
    setBusy(true);
    try {
      const csv = await buildAccountingCsv(from.toISOString(), to.toISOString());
      downloadFile(csv, `accounting_${from.toISOString().slice(0, 10)}.csv`, "text/csv");
    } finally { setBusy(false); }
  };

  async function exportAll() {
    setBusy(true);
    try {
      const { buildGstr1Excel } = await import("@/lib/gst-xlsx");
      const blob = await buildGstr1Excel(from.toISOString(), to.toISOString());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GSTR1_${from.toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      <div className="flex flex-col sm:flex-row gap-4 pt-4">
        <button
          className="h-14 px-8 rounded-full border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center justify-center gap-3 shadow-sm flex-1 max-w-[300px]"
          onClick={exportAccounting}
          disabled={busy}
        >
          <MSIcon name="csv" className="text-[20px] text-slate-400" />
          Export Basic CSV
        </button>

        <button
          className="h-14 px-8 rounded-full bg-[#b7102a] text-white font-bold hover:brightness-110 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3 flex-1 max-w-[350px]"
          onClick={exportAll}
          disabled={busy}
        >
          {busy ? <MSIcon name="progress_activity" className="animate-spin text-[20px]" /> : <MSIcon name="download" className="text-[20px]" />}
          Export Unified GSTR1 Excel
        </button>
      </div>
    </div>
  );
}

/* ======================================================
   STOCK
====================================================== */

function StockInline() {
  const [rows, setRows] = useState<
    { name: string; sku: string; stock: number; unitPrice: number }[]
  >([]);

  useEffect(() => {
    listProducts().then((ps) =>
      setRows(
        ps.map((p) => ({
          name: p.name,
          sku: p.sku,
          stock: p.stock,
          unitPrice: p.unitPrice,
        }))
      )
    );
  }, []);

  return (
    <Table
      columns={["Product Name", "SKU", "Units in Stock", "Unit Price"]}
      rows={rows.map((r) => [
         { value: r.name, className: "font-black" },
         { value: r.sku, className: "text-[11px] uppercase tracking-widest text-[#2b6485]" },
         { value: r.stock.toString(), className: `font-extrabold tabular-nums ${r.stock <= 5 ? 'text-[#b7102a]' : 'text-[#059669]'}` },
         { value: `₹${r.unitPrice.toFixed(2)}`, className: "font-bold tabular-nums" }
      ])}
      emptyText="No products found in inventory."
    />
  );
}

/* ======================================================
   MOVEMENT
====================================================== */

function MovementInline() {
  const [rows, setRows] = useState<any[]>([]);
  const [from, setFrom] = useState(() => {
     const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d;
  });
  const [to, setTo] = useState(() => {
     const d = new Date(); d.setHours(23,59,59,999); return d;
  });

  useEffect(() => {
    aggregateInventoryMovement(from.toISOString(), to.toISOString()).then(setRows);
  }, [from, to]);

  return (
    <div className="space-y-6">
       <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
       <Table
         columns={["Product Name", "SKU", "Qty Inward", "Qty Outward", "Net Change"]}
         rows={rows.map((r) => [
            { value: r.name, className: "font-bold" },
            { value: r.sku, className: "text-[11px] uppercase tracking-widest" },
            { value: `+${r.qtyIn}`, className: "font-bold text-[#059669]" },
            { value: `-${r.qtyOut}`, className: "font-bold text-[#b7102a]" },
            { value: r.net, className: "font-extrabold" }
         ])}
         emptyText="No inventory movement for this period."
       />
    </div>
  );
}

/* ======================================================
   INVENTORY AGING
====================================================== */

function AgingInline() {
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [summary, setSummary] = useState<AgingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [bucketFilter, setBucketFilter] = useState<AgingBucket | "all">("all");

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aggregateInventoryAging();
      setRows(data.rows);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const filtered = bucketFilter === "all" ? rows : rows.filter(r => r.bucket === bucketFilter);

  const totalValue = summary.reduce((s, b) => s + b.totalValue, 0);
  const totalQty = summary.reduce((s, b) => s + b.totalQty, 0);

  function downloadCsv() {
    const headers = ["Product", "SKU", "Category", "Stock", "Unit Price", "Stock Value", "Days Aged", "Bucket", "Last Inbound"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const cols = [
        r.name, r.sku, r.category || "", r.currentStock.toString(), r.unitPrice.toFixed(2),
        r.stockValue.toFixed(2), r.daysAged.toString(), r.bucket,
        r.lastInboundDate ? new Date(r.lastInboundDate).toLocaleDateString("en-IN") : "—",
      ];
      lines.push(cols.map(c => c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_aging_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const bucketColors: Record<AgingBucket, { bg: string; text: string; label: string }> = {
    '0-30':  { bg: "bg-[#dcfce7]", text: "text-[#166534]", label: "Fresh (0–30 days)" },
    '31-60': { bg: "bg-[#dbeafe]", text: "text-[#1e40af]", label: "Moderate (31–60 days)" },
    '61-90': { bg: "bg-orange-50",  text: "text-orange-700", label: "Aging (61–90 days)" },
    '90+':   { bg: "bg-red-50",     text: "text-red-700",    label: "Stale (90+ days)" },
  };

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="py-20 flex justify-center"><MSIcon name="autorenew" className="animate-spin text-[32px] text-slate-300" /></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {summary.map(s => {
              const style = bucketColors[s.bucket];
              return (
                <button key={s.bucket} type="button" onClick={() => setBucketFilter(bucketFilter === s.bucket ? "all" : s.bucket)} className={`${style.bg} ${style.text} rounded-2xl p-5 flex flex-col gap-2 text-left transition-all ${bucketFilter === s.bucket ? 'ring-2 ring-offset-2 ring-current' : ''}`}>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{style.label}</p>
                  <p className="text-2xl font-extrabold tabular-nums">{s.productCount} items</p>
                  <p className="text-[11px] font-bold opacity-70">{s.totalQty} units — ₹{s.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </button>
              );
            })}
          </div>

          {/* Totals Bar */}
          <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Total Inventory Value</p>
              <p className="text-2xl font-extrabold tabular-nums">₹{totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <p className="text-[11px] font-bold text-slate-400">{totalQty} units across {rows.length} products</p>
            </div>
            <button onClick={downloadCsv} className="h-12 px-6 rounded-full border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
              <MSIcon name="download" className="text-[18px] text-slate-400" />
              Export CSV
            </button>
          </div>

          {/* Table */}
          <Table
            columns={["Product", "SKU", "Stock", "Value", "Days Aged", "Bucket", "Last Inbound"]}
            rows={filtered.map(r => {
              const style = bucketColors[r.bucket];
              return [
                { value: r.name, className: "font-bold" },
                { value: r.sku, className: "text-[11px] uppercase tracking-widest text-[#2b6485]" },
                { value: r.currentStock.toString(), className: `font-extrabold tabular-nums ${r.currentStock <= 5 ? 'text-[#b7102a]' : ''}` },
                { value: `₹${r.stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, className: "font-bold tabular-nums" },
                { value: `${r.daysAged}d`, className: `font-extrabold tabular-nums ${style.text}` },
                { value: r.bucket, className: `font-black text-[11px] ${style.text}` },
                { value: r.lastInboundDate ? new Date(r.lastInboundDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—", className: "text-slate-500 font-bold" },
              ];
            })}
            emptyText="No products with stock found."
          />
        </>
      )}
    </div>
  );
}

/* ======================================================
   STAFF REPORT
====================================================== */

function StaffInline() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try { setRows(await aggregateByStaff(from.toISOString(), to.toISOString())); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="space-y-6">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      {loading ? (
        <div className="py-20 flex justify-center"><MSIcon name="autorenew" className="animate-spin text-[32px] text-slate-300" /></div>
      ) : (
        <Table
          columns={["Staff Name", "Bills Raised", "Voids", "Total Sales"]}
          rows={rows.map(r => [
            { value: r.cashierName, className: "font-black" },
            { value: r.invoiceCount.toString(), className: "tabular-nums font-bold" },
            { value: r.voidCount.toString(), className: `tabular-nums font-bold ${r.voidCount > 0 ? 'text-[#b7102a]' : 'text-slate-400'}` },
            { value: `₹${r.total.toFixed(2)}`, className: "font-extrabold text-[15px] tabular-nums text-[#059669]" },
          ])}
          emptyText="No staff data for this period."
        />
      )}
    </div>
  );
}

/* ======================================================
   BRAND REPORT
====================================================== */

function BrandInline() {
  const [rows, setRows] = useState<BrandRow[]>([]);
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0,0,0,0); return d; });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23,59,59,999); return d; });
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try { setRows(await aggregateByBrand(from.toISOString(), to.toISOString())); }
    finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { run(); }, [run]);

  return (
    <div className="space-y-6">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      {loading ? (
        <div className="py-20 flex justify-center"><MSIcon name="autorenew" className="animate-spin text-[32px] text-slate-300" /></div>
      ) : (
        <Table
          columns={["Brand", "Bills", "Units Sold", "Total Revenue"]}
          rows={rows.map(r => [
            { value: r.brand, className: "font-black" },
            { value: r.invoiceCount.toString(), className: "tabular-nums font-bold" },
            { value: r.unitsSold.toString(), className: "tabular-nums font-bold" },
            { value: `₹${r.total.toFixed(2)}`, className: "font-extrabold text-[15px] tabular-nums text-[#059669]" },
          ])}
          emptyText="No brand data. Add brand names to products first."
        />
      )}
    </div>
  );
}

/* ======================================================
   TABLE
====================================================== */

function Table({
  columns,
  rows,
  emptyText,
}: {
  columns: string[];
  rows: { value: string | number; className?: string }[][];
  emptyText: string;
}) {
  return (
    <div className="bg-white rounded-3xl border border-slate-100/60 shadow-sm overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left min-w-[700px]">
          <thead>
            <tr className="bg-[#fce8ec]">
              {columns.map((c, idx) => (
                <th key={c} className={`px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] ${idx === 0 ? 'rounded-tl-[1.8rem]':''} ${idx === columns.length - 1 ? 'rounded-tr-[1.8rem]':''}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-slate-50">
            {rows.length > 0 ? (
              rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                  {r.map((c, j) => (
                    <td key={j} className={`px-6 py-5 text-[13px] text-slate-800 ${c.className || ''}`}>
                      {c.value}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-16 px-6 text-center text-slate-400 font-bold"
                >
                  <MSIcon name="info" className="text-[48px] text-slate-200 block mx-auto mb-3" />
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
