"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listInvoicesInRange, aggregatePaymentModes } from "@/lib/reports";

function iso(date: Date) { return date.toISOString(); }

export default function PaymentReportPage() {
  const { user, loading } = useAuth();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0); return iso(d); });
  const [to, setTo] = useState(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return iso(d); });
  const [rows, setRows] = useState<{ method: string; amount: number }[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  async function run() {
    setLoadingData(true);
    try {
      const data = await listInvoicesInRange(from, to);
      setRows(aggregatePaymentModes(data));
    } finally { setLoadingData(false); }
  }

  useEffect(() => { if (user) run(); }, [user]);

  if (loading) return <div className="p-6">Loading…</div>;
  if (!user) return null;

  return (
    <div className="flex min-h-full w-full bg-background text-foreground">
      
      <div className="flex flex-col flex-1">
        
        <main className="flex-1 p-6 space-y-4">
          <h1 className="text-xl font-semibold">Payment Mode Report</h1>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm text-muted-foreground">From</label>
              <input type="datetime-local" className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={from.slice(0, 16)} onChange={(e) => setFrom(new Date(e.target.value).toISOString())} />
            </div>
            <div>
              <label className="text-sm text-muted-foreground">To</label>
              <input type="datetime-local" className="w-full h-9 rounded-xl border bg-background px-2 text-sm" value={to.slice(0, 16)} onChange={(e) => setTo(new Date(e.target.value).toISOString())} />
            </div>
            <div className="flex items-end">
              <button className="px-3 py-2 rounded-xl border bg-background w-full" onClick={run} disabled={loadingData}>{loadingData ? 'Loading…' : 'Run'}</button>
            </div>
          </div>
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2">Payment Mode</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.method} className="border-t">
                    <td className="px-3 py-2">{r.method.toUpperCase()}</td>
                    <td className="px-3 py-2 text-right">₹{r.amount.toFixed(2)}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td className="px-3 py-6 text-center text-muted-foreground" colSpan={2}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
