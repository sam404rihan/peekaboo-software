"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { listOps, removeOp, processOpById, processQueue } from "@/lib/offline";
import { useToast } from "@/components/ui/toast";

type ViewOp = { id: string; type: string; createdAt: string; attempts?: number; payload?: any };

export default function OfflineQueuePage() {
  const { user, role, loading } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ViewOp[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  async function refresh() {
    try {
      const ops = await listOps();
      ops.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
      setItems(ops as any);
    } catch (e) {
      toast({ title: "Failed to load queue", description: String(e), variant: "destructive" });
    }
  }

  useEffect(() => { refresh(); }, []);

  const failed = useMemo(() => items.filter(i => (i.attempts || 0) > 0), [items]);
  const pending = useMemo(() => items.filter(i => (i.attempts || 0) === 0), [items]);

  async function onRetry(id: string) {
    setBusy(true);
    try {
      const ok = await processOpById(id);
      if (ok) toast({ title: "Retried", description: `Operation applied successfully`, variant: "success" });
      else toast({ title: "Retry failed", description: "Check console for details", variant: "destructive" });
      await refresh();
    } finally { setBusy(false); }
  }

  async function onRemove(id: string) {
    setConfirmRemove(null);
    setBusy(true);
    try {
      await removeOp(id);
      toast({ title: "Removed", description: "Operation discarded from queue", variant: "success" });
      await refresh();
    } finally { setBusy(false); }
  }

  async function onRetryAll() {
    setBusy(true);
    try {
      await processQueue();
      toast({ title: "Queue Processed", description: "All pending operations submitted", variant: "success" });
      await refresh();
    } finally { setBusy(false); }
  }

  if (loading) return <div className="p-8 font-bold text-slate-400">Loading...</div>;
  if (!user || role !== "admin") return <div className="p-6 bg-red-50 rounded-2xl text-red-700 font-bold">Admin access required.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sync Queue</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Operations queued while offline — pending Firestore sync</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={refresh} disabled={busy} className="h-10 px-5 rounded-full bg-white border border-slate-200 text-slate-700 font-bold text-[13px] flex items-center gap-2 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Refresh
          </button>
          <button onClick={onRetryAll} disabled={busy || items.length === 0} className="h-10 px-5 rounded-full bg-[#b7102a] text-white font-bold text-[13px] flex items-center gap-2 hover:brightness-110 shadow-sm transition-all disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">sync</span>
            Process All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Queued", value: items.length, color: "bg-slate-50", icon: "inbox" },
          { label: "Pending", value: pending.length, color: "bg-[#dbeafe]", icon: "schedule" },
          { label: "Failed Attempts", value: failed.length, color: failed.length > 0 ? "bg-red-50" : "bg-[#dcfce7]", icon: failed.length > 0 ? "error" : "check_circle" },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-2xl p-4 flex items-center gap-3 border border-slate-100/50`}>
            <span className="material-symbols-outlined text-slate-500 text-[22px]">{s.icon}</span>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{s.value}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Signed-in user badge */}
      <div className="flex items-center gap-2 text-xs font-bold text-[#166534] bg-[#dcfce7] px-4 py-2 rounded-full w-max border border-green-200">
        <span className="w-2 h-2 rounded-full bg-[#166534]"></span>
        Signed in — {user.email || user.uid}
      </div>

      {/* Confirm Remove Modal */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setConfirmRemove(null)}>
          <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <span className="material-symbols-outlined text-[48px] text-[#b7102a] block mb-4">warning</span>
            <h3 className="text-lg font-extrabold text-slate-900 mb-2">Discard Operation?</h3>
            <p className="text-sm text-slate-500 font-medium mb-6">This operation will be permanently removed from the sync queue and will not be retried.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRemove(null)} className="flex-1 h-11 rounded-full bg-slate-100 text-slate-700 font-bold text-[13px] hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={() => onRemove(confirmRemove)} className="flex-1 h-11 rounded-full bg-[#b7102a] text-white font-bold text-[13px] hover:brightness-110 transition-all">Discard</button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-[#fce8ec]">
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tl-[1.8rem]">Operation ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Queued At</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-center">Attempts</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tr-[1.8rem] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                  <span className="material-symbols-outlined text-[48px] text-slate-200 block mx-auto mb-3">cloud_done</span>
                  <p className="font-bold">Queue is empty</p>
                  <p className="text-sm mt-1">All operations have been synced to Firestore</p>
                </td></tr>
              ) : items.map(op => (
                <tr key={op.id} className={`hover:bg-slate-50/50 transition-colors ${(op.attempts || 0) > 0 ? "bg-red-50/30" : ""}`}>
                  <td className="px-6 py-4">
                    <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg">{op.id.slice(0, 16)}...</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[12px] font-extrabold text-slate-700 bg-slate-100 px-3 py-1 rounded-full uppercase">{op.type}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-slate-800">{new Date(op.createdAt).toLocaleDateString()}</div>
                    <div className="text-[11px] text-slate-400 font-medium">{new Date(op.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`text-[12px] font-extrabold px-3 py-1.5 rounded-full ${(op.attempts || 0) > 0 ? "bg-red-100 text-[#b7102a]" : "bg-slate-100 text-slate-600"}`}>
                      {op.attempts || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => onRetry(op.id)} disabled={busy} className="h-9 px-4 rounded-full bg-[#dbeafe] text-[#1e40af] text-[12px] font-bold hover:bg-blue-100 transition-all disabled:opacity-50">
                        Retry
                      </button>
                      <button onClick={() => setConfirmRemove(op.id)} disabled={busy} className="h-9 w-9 rounded-full bg-red-50 text-[#b7102a] flex items-center justify-center hover:bg-red-100 transition-all disabled:opacity-50">
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-3 bg-[#fff0f2]/40 border-t border-slate-100 rounded-b-[2rem]">
          <p className="text-[11px] font-bold text-slate-400">Failed items have been attempted at least once. Use "Retry" to reattempt or "Discard" to remove.</p>
        </div>
      </div>
    </div>
  );
}
