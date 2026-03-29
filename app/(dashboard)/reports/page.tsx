"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";

import {
  listInvoicesInRange,
  aggregateByPeriod,
  aggregatePaymentModes,
  buildAccountingCsv,
  aggregateInventoryMovement,
  type Period,
} from "@/lib/reports";

import { listProducts } from "@/lib/products";
import { cn } from "@/lib/utils";

/* ======================================================
   HELPERS & ICONS
====================================================== */

function MSIcon({ name, className }: { name: string; className?: string }) {
   return <span className={cn("material-symbols-outlined", className)}>{name}</span>;
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
    | "movement";

  const [tab, setTab] = useState<TabKey>("sales");

  if (loading) return <div className="p-8 text-slate-400 font-medium tracking-wide flex items-center gap-3"><span className="material-symbols-outlined animate-spin">progress_activity</span>Loading reports...</div>;
  if (!user) return null;

  const tabs = [
    { key: "sales", label: "Sales Summary" },
    { key: "payments", label: "Payment Modes" },
    { key: "profitloss", label: "Profit & Loss" },
    { key: "accounting", label: "Accounting Export" },
    { key: "stock", label: "Stock Levels" },
    { key: "movement", label: "Inventory Movement" },
  ] as Array<{ key: TabKey; label: string }>;

  return (
    <div className="space-y-6 max-w-7xl font-sans text-slate-900 pb-12">
       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
         <div>
            <span className="text-[10px] uppercase tracking-[0.2em] font-black text-[#b7102a] mb-1 block">
               Business Intelligence
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight leading-none">
               Analytics & Reports
            </h1>
         </div>
         <p className="text-[13px] font-bold text-slate-500 max-w-xs md:text-right">
            Sales tracking, inventory movement, and GST accounting exports
         </p>
      </div>

       <div className="flex flex-col gap-6">
          {/* Tabs Nav */}
          <nav className="overflow-x-auto pb-2 scrollbar-none">
             <ul className="flex flex-wrap gap-2 p-1.5 bg-white/60 backdrop-blur-sm rounded-full border border-slate-200/60 shadow-sm w-max">
                {tabs.map((it) => {
                  const isActive = tab === it.key;
                  return (
                     <li key={it.key}>
                        <button
                           type="button"
                           onClick={() => setTab(it.key)}
                           className={cn(
                              "px-6 py-3 rounded-full font-bold text-[13px] transition-all whitespace-nowrap",
                              isActive 
                                ? "bg-[#b7102a] text-white shadow-md shadow-red-900/20" 
                                : "text-slate-500 hover:bg-white hover:text-slate-900"
                           )}
                        >
                           {it.label}
                        </button>
                     </li>
                  );
                })}
             </ul>
          </nav>

          {/* Content Segment */}
          <div className="bg-white rounded-[2rem] border border-slate-100/60 shadow-sm p-6 lg:p-8 animate-in fade-in duration-500 slide-in-from-bottom-2">
             {tab === "sales" && <SalesInline />}
             {tab === "payments" && <PaymentsInline />}
             {tab === "profitloss" && <ProfitLossInline />}
             {tab === "accounting" && <AccountingInline />}
             {tab === "stock" && <StockInline />}
             {tab === "movement" && <MovementInline />}
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
          const unitCost = prod?.costPrice ?? 0;
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
