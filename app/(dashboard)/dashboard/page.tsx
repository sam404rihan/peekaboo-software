"use client";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  getDocs,
  type QueryConstraint,
  getCountFromServer,
} from "firebase/firestore";
import { COLLECTIONS } from "@/lib/models";
import type { InvoiceDoc } from "@/lib/models";
import { listProducts } from "@/lib/products";
import Link from "next/link";

const getTodayStr = () => {
  const d = new Date();
  return d.toISOString().split('T')[0];
};

const getFirstDayOfMonthStr = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
};

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const [isDataLoading, setIsDataLoading] = useState(true);

  // Use full current month by default
  const [fromDate] = useState<string>(getFirstDayOfMonthStr());
  const [toDate] = useState<string>(getTodayStr());

  const [revenue, setRevenue] = useState(0);
  const [productMeta, setProductMeta] = useState<Record<string, { name: string; category?: string }>>({});
  const [topItems, setTopItems] = useState<Array<{ productId: string; name: string; category?: string; units: number; revenue: number; }>>([]);
  const [revenueBuckets, setRevenueBuckets] = useState<Array<{ label: string; total: number }>>([]);
  const [prevRevenue, setPrevRevenue] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [ordersThisMonth, setOrdersThisMonth] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<InvoiceDoc[]>([]);
  const [totalCustomers, setTotalCustomers] = useState(0);

  const { fromIso, toIso } = useMemo(() => {
    if (!fromDate || !toDate) return { fromIso: undefined, toIso: undefined, rangeDays: 0 };
    const fromD = new Date(fromDate); fromD.setHours(0, 0, 0, 0);
    const toD = new Date(toDate); toD.setHours(23, 59, 59, 999);
    return {
      fromIso: fromD.toISOString(),
      toIso: toD.toISOString(),
    };
  }, [fromDate, toDate]);

  useEffect(() => {
    if (!loading && !user) window.location.href = "/login";
  }, [user, loading]);

  // Fetch true database stats
  useEffect(() => {
    if (!db) return;
    const col = collection(db, COLLECTIONS.customers);
    getCountFromServer(col).then((snapshot) => {
        setTotalCustomers(snapshot.data().count);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const prods = await listProducts();
        const meta: Record<string, { name: string; category?: string }> = {};
        prods.forEach((p) => { if (p.id) meta[p.id] = { name: p.name, category: p.category }; });
        setProductMeta(meta);
      } catch (err) { }
    };
    loadProducts();
  }, []);

  useEffect(() => {
    if (!db) return;
    // Count products that are out of stock (stock=0) OR at/below their reorder level
    const unsub = onSnapshot(collection(db, COLLECTIONS.products), (snap) => {
      const count = snap.docs.filter(d => {
        const data = d.data();
        const stock = Number(data.stock ?? 0);
        const reorder = data.reorderLevel != null ? Number(data.reorderLevel) : 5;
        return data.active !== false && (stock === 0 || stock <= reorder);
      }).length;
      setLowStockCount(count);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!db || !fromIso || !toIso) return;
    setIsDataLoading(true);
    const col = collection(db, COLLECTIONS.invoices);
    const constraints: QueryConstraint[] = [
      orderBy("issuedAt", "desc"),
      where("issuedAt", ">=", fromIso),
      where("issuedAt", "<=", toIso),
    ];
    const q = query(col, ...constraints);

    const unsub = onSnapshot(
      q,
      (snap) => {
        let rev = 0;
        const agg = new Map<string, { productId: string; name: string; category?: string; units: number; revenue: number; }>();
        const dayMap = new Map<string, number>();

        // We also want exactly 7 buckets for the stacked bar
        const endDay = new Date(toIso);
        for(let i=6; i>=0; i--) {
            const temp = new Date(endDay);
            temp.setDate(temp.getDate() - i);
            dayMap.set(temp.toISOString().slice(0, 10), 0);
        }

        const invoicesList: InvoiceDoc[] = [];

        snap.docs.forEach((d) => {
          const data = d.data() as InvoiceDoc;
          invoicesList.push({ id: d.id, ...data });

          const grand = typeof data.grandTotal === "number" ? data.grandTotal : Number(data.grandTotal ?? 0);
          rev += Number.isFinite(grand) ? grand : 0;

          const issuedAt = typeof data.issuedAt === "string" ? data.issuedAt : undefined;
          const dayKey = issuedAt?.slice(0, 10);
          if (dayKey && dayMap.has(dayKey)) {
             dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + (Number.isFinite(grand) ? grand : 0));
          }

          const items = Array.isArray(data.items) ? data.items : [];
          items.forEach((it: any) => {
            const pid = String(it.productId ?? "");
            if (!pid) return;
            const qty = Number(it.quantity ?? 0);
            const unitPrice = Number(it.unitPrice ?? 0);
            const lineRevenue = Math.max(0, unitPrice * qty - Number(it.discountAmount ?? 0));
            
            const cur = agg.get(pid) || { productId: pid, name: it.name || productMeta[pid]?.name || pid, category: productMeta[pid]?.category, units: 0, revenue: 0 };
            cur.units += qty;
            cur.revenue += lineRevenue;
            agg.set(pid, cur);
          });
        });

        invoicesList.sort((a,b) => b.issuedAt.localeCompare(a.issuedAt));
        setRecentTransactions(invoicesList.slice(0, 4));

        setRevenue(rev);
        setOrdersThisMonth(snap.docs.length);
        setTopItems(Array.from(agg.values()).sort((a, b) => b.units - a.units || b.revenue - a.revenue));
        
        const buckets = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => ({ label: k, total: v }));
        setRevenueBuckets(buckets);
        setIsDataLoading(false);
      },
      () => setIsDataLoading(false)
    );
    return () => unsub();
  }, [fromIso, toIso, productMeta]);

  useEffect(() => {
    if (!db || !fromIso || !toIso) { setPrevRevenue(0); return; }
    const curStart = new Date(fromIso).getTime();
    const curEnd = new Date(toIso).getTime();
    const duration = curEnd - curStart + 1;
    const prevStart = new Date(curStart - duration).toISOString();
    const prevEnd = new Date(curStart - 1).toISOString();

    const col = collection(db, COLLECTIONS.invoices);
    const q = query(col, where("issuedAt", ">=", prevStart), where("issuedAt", "<=", prevEnd));
    getDocs(q).then((snap) => {
      let prev = 0;
      snap.docs.forEach((d) => prev += Number(d.data().grandTotal ?? 0));
      setPrevRevenue(prev);
    }).catch(() => setPrevRevenue(0));
  }, [fromIso, toIso]);

  if (loading || !user) return <div className="p-8"><span className="material-symbols-outlined animate-spin text-slate-400">autorenew</span></div>;

  const pct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : revenue > 0 ? 100 : 0;
  const pctStr = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

  const categoryAggr: Record<string, number> = {};
  topItems.forEach(item => {
     const cat = item.category || "Uncategorized";
     categoryAggr[cat] = (categoryAggr[cat] || 0) + item.revenue;
  });
  const topCategories = Object.entries(categoryAggr)
     .sort((a, b) => b[1] - a[1])
     .slice(0, 3);
  
  const topCatTotal = topCategories.reduce((sum, [_, val]) => sum + val, 0);
  const colors = ["#b7102a", "#2b6485", "#78909c"];
  let dashOffset = 0; 

  const maxBucket = Math.max(...revenueBuckets.map(b => b.total), 1); 

  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6 max-w-7xl font-sans text-slate-900 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Monthly Performance</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">Real-time overview of your toy empire operations.</p>
        </div>
        <div className="h-10 px-5 rounded-full bg-slate-50 border border-slate-100 flex items-center gap-2 text-[13px] font-bold text-slate-700 shadow-sm whitespace-nowrap">
          <span className="material-symbols-outlined text-[18px] text-slate-400">calendar_today</span>
          {formatter.format(new Date(fromDate))} - {formatter.format(new Date(toDate))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] shadow-sm relative overflow-hidden border border-slate-100 flex flex-col justify-between h-[155px]">
          <span className="material-symbols-outlined absolute right-4 top-8 text-[6rem] text-slate-100 opacity-60 pointer-events-none select-none">payments</span>
          <div>
            <p className="text-[11px] font-black uppercase text-slate-500 tracking-[0.15em] mb-2">Total Sales</p>
            <p className="text-3xl font-extrabold">₹{revenue.toLocaleString()}</p>
          </div>
          <div className="inline-flex">
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1 leading-none shadow-sm ${pct >= 0 ? "bg-[#ecfdf5] text-[#059669]" : "bg-red-50 text-red-600"}`}>
               <span className="material-symbols-outlined text-[10px]">{pct >= 0 ? "trending_up" : "trending_down"}</span>{pctStr}
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm relative overflow-hidden border border-slate-100 flex flex-col justify-between h-[155px]">
          <span className="material-symbols-outlined absolute right-4 top-8 text-[6rem] text-slate-100 opacity-60 pointer-events-none select-none">group_add</span>
          <div>
            <p className="text-[11px] font-black uppercase text-slate-500 tracking-[0.15em] mb-2">Total Customers</p>
            <p className="text-3xl font-extrabold">{totalCustomers}</p>
          </div>
          <div className="inline-flex">
             <Link href="/customers" className="text-[10px] font-black text-[#2b6485] uppercase tracking-widest hover:underline flex items-center gap-1">
                View All <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
             </Link>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] shadow-sm relative overflow-hidden border border-slate-100 flex flex-col justify-between h-[155px]">
          <span className="material-symbols-outlined absolute right-4 top-8 text-[6rem] text-slate-100 opacity-60 pointer-events-none select-none">account_balance</span>
          <div>
            <p className="text-[11px] font-black uppercase text-slate-500 tracking-[0.15em] mb-2">Est. GST Collected</p>
            <p className="text-3xl font-extrabold">₹{(revenue * 0.18).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          </div>
          <p className="text-[11px] font-black text-slate-500 mt-2 whitespace-nowrap overflow-hidden text-ellipsis">Standard rate assumed (18%)</p>
        </div>

        <div className="bg-[#fce8ec] p-6 rounded-[2rem] shadow-sm relative overflow-hidden border border-white flex flex-col justify-between h-[155px]">
          <span className="material-symbols-outlined absolute right-4 -top-2 text-[8rem] text-red-200/40 pointer-events-none select-none">warning</span>
          <div>
            <p className="text-[11px] font-black uppercase text-red-800 tracking-[0.15em] mb-2">Stock Alerts</p>
            <p className="text-3xl font-extrabold text-[#b7102a]">{lowStockCount} {lowStockCount === 1 ? "Item" : "Items"}</p>
          </div>
          <div>
            <Link href="/products?status=Low+Stock" className="bg-[#b7102a] text-white text-[12px] font-bold px-4 py-2 rounded-full shadow-lg hover:brightness-110 transition-colors w-max block">
              Restock Now
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm col-span-2 flex flex-col justify-between min-h-[380px]">
           <div>
              <div className="flex justify-between items-start mb-2">
                 <h2 className="text-lg font-bold">Daily Sales Volume (Last 7 Days)</h2>
                 <button className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-50"><span className="material-symbols-outlined text-slate-400">more_vert</span></button>
              </div>
              <p className="text-sm font-medium text-slate-500 mb-8">Revenue trend computed from actual POS receipts</p>
           </div>
           
           <div className="flex-1 w-full border-t border-b border-slate-100/60 pb-8 pt-4 flex items-end justify-around gap-2 px-4 relative mt-auto h-[200px]">
              <div className="absolute top-10 left-0 right-0 border-b border-slate-100/60 w-full" />
              <div className="absolute top-28 left-0 right-0 border-b border-slate-100/60 w-full" />
              
              {revenueBuckets.map((bucket, i) => {
                 const pctHeight = maxBucket > 0 ? (bucket.total / maxBucket) * 100 : 0;
                 return (
                 <div key={i} className="flex-1 max-w-[48px] h-full flex flex-col justify-end gap-1 relative z-10 group cursor-pointer" title={`₹${bucket.total.toLocaleString()}`}>
                    <div className="w-full bg-[#1e293b]/10 rounded-sm" style={{ height: `${pctHeight > 0 ? pctHeight * 0.3 : 1}%` }} />
                    <div className="w-full bg-[#2b6485] rounded-sm hover:brightness-110 transition-all" style={{ height: `${pctHeight || 1}%` }} />
                    <div className="absolute -bottom-8 w-[200%] -left-1/2 text-center text-[9px] font-black uppercase tracking-widest text-[#2b6485]">
                       {new Date(bucket.label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                 </div>
              )})}
           </div>
        </div>

        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm flex flex-col items-center">
            <h2 className="text-lg font-bold w-full mb-2">Sales by Category</h2>
            <p className="text-sm font-medium text-slate-500 w-full mb-8">Revenue distribution by type</p>
            
            <div className="relative w-48 h-48 mb-8">
               <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                 <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                 {topCategories.map(([cat, val], i) => {
                    if (topCatTotal === 0) return null;
                    const strokeDasharray = `${(val / topCatTotal) * 251.2} 251.2`;
                    const currentOffset = 251.2 - dashOffset;
                    dashOffset += (val / topCatTotal) * 251.2;
                    return (
                       <circle key={cat} cx="50" cy="50" r="40" fill="transparent" stroke={colors[i%colors.length]} strokeWidth="12" strokeDasharray={strokeDasharray} strokeDashoffset={currentOffset} className="transition-all duration-1000"/>
                    );
                 })}
               </svg>
               <div className="absolute inset-0 flex items-center justify-center flex-col pt-2 bg-white rounded-full">
                 <span className="text-3xl font-extrabold text-slate-800">
                    {topCategories.length > 0 ? `${Math.round((topCategories[0][1] / (topCatTotal || 1)) * 100)}%` : '0%'}
                 </span>
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5 truncate max-w-[80px]">
                    {topCategories.length > 0 ? topCategories[0][0] : 'None'}
                 </span>
               </div>
            </div>

            <div className="w-full space-y-4">
               {topCategories.map(([cat, val], i) => (
                  <div key={cat} className="flex items-center justify-between text-sm font-bold w-full">
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i%colors.length] }}></div> 
                        <span className="truncate max-w-[120px] text-slate-700">{cat}</span>
                     </div>
                     <span className="text-slate-900">{Math.round((val / (topCatTotal || 1)) * 100)}%</span>
                  </div>
               ))}
               {topCategories.length === 0 && <span className="text-sm text-slate-400 font-bold block text-center">No categories matching sales data</span>}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm col-span-2 flex flex-col overflow-hidden">
           <div className="p-6 flex justify-between items-center bg-[#fce8ec]/30 border-b border-red-50">
             <h2 className="text-lg font-bold">Recent Transactions</h2>
             <Link href="/invoices" className="text-[12px] font-extrabold text-[#b7102a] uppercase tracking-wider">View All</Link>
           </div>
           
           <div className="overflow-x-auto p-4">
             <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#fce8ec]">
                    <th className="px-5 py-3 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.1em] rounded-tl-xl whitespace-nowrap">Order ID</th>
                    <th className="px-5 py-3 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.1em] whitespace-nowrap">Customer</th>
                    <th className="px-5 py-3 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.1em] text-right whitespace-nowrap">Amount</th>
                    <th className="px-5 py-3 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.1em] rounded-tr-xl whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                   {recentTransactions.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                         <td className="px-5 py-4 font-black text-[13px] text-slate-800">
                            <Link href={`/invoices/${inv.id}`} className="hover:text-[#b7102a]">{inv.invoiceNumber}</Link>
                         </td>
                         <td className="px-5 py-4 font-bold text-sm text-slate-600 truncate max-w-[120px]">{inv.customerName || "Walk-In"}</td>
                         <td className="px-5 py-4 font-extrabold text-sm text-right tabular-nums text-slate-800">₹{inv.grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                         <td className="px-5 py-4 text-xs font-bold flex items-center gap-1.5">
                            {inv.status === "paid" && <span className="text-[#059669] flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#059669] mt-3"></div> Completed</span>}
                            {inv.status === "void" && <span className="text-[#b7102a] flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#b7102a] mt-3"></div> Cancelled</span>}
                            {inv.status === "unpaid" && <span className="text-orange-500 flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-3"></div> Pending</span>}
                            {inv.status === "partial" && <span className="text-[#2b6485] flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#2b6485] mt-3"></div> Partial</span>}
                         </td>
                      </tr>
                   ))}
                   {recentTransactions.length === 0 && (
                      <tr><td colSpan={4} className="px-5 py-10 text-center font-bold text-slate-400">No recent transactions this month</td></tr>
                   )}
                </tbody>
             </table>
           </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 overflow-hidden">
           <h2 className="text-lg font-bold mb-6">Top Selling Toys</h2>
           <div className="space-y-4">
              {topItems.slice(0, 3).map((item, i) => (
                 <div key={i} className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-2xl hover:bg-slate-50 transition-colors group">
                    <div className="w-14 h-14 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center shrink-0">
                       <span className="text-2xl opacity-80 group-hover:scale-110 transition-transform">🧸</span>
                    </div>
                    <div className="flex-1 min-w-0">
                       <p className="font-extrabold text-sm text-slate-900 truncate tracking-tight">{item.name}</p>
                       <div className="flex items-center gap-2 mt-1">
                          {item.category ? (
                             <span className="bg-[#dbeafe] text-[#1e40af] text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider truncate max-w-[80px]">{item.category}</span>
                          ) : null}
                          <span className="text-[10px] font-bold text-slate-400">{item.units} Sold</span>
                       </div>
                    </div>
                    <div className="font-extrabold text-[#b7102a] tabular-nums whitespace-nowrap pl-2">
                       ₹{item.revenue.toLocaleString()}
                    </div>
                 </div>
              ))}
              {topItems.length === 0 && (
                <div className="text-center py-10 text-slate-400 font-bold text-sm">No sales records yet</div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
