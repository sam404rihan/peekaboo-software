"use client";
import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { listOffers } from "@/lib/offers";
import type { OfferDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth/auth-provider";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { COLLECTIONS } from "@/lib/models";

export default function OffersListPage() {
  const [offers, setOffers] = useState<OfferDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, role, loading: authLoading } = useAuth();

  const loadOffers = useCallback(async () => {
    try {
      const data = await listOffers();
      setOffers(data);
    } catch (e) {
      toast({ title: "Load failed", description: String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return offers;
    return offers.filter(o => o.name.toLowerCase().includes(s));
  }, [q, offers]);

  const handleToggleActive = async (o: OfferDoc) => {
    if (!db || !o.id) return;
    setBusy(o.id);
    try {
      await updateDoc(doc(db, COLLECTIONS.offers, o.id), { active: !o.active, updatedAt: new Date().toISOString() });
      setOffers(prev => prev.map(item => item.id === o.id ? { ...item, active: !item.active } : item));
      toast({ title: o.active ? "Offer Deactivated" : "Offer Activated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (authLoading) return <div className="p-4 font-bold text-slate-400">Loading...</div>;
  if (!user || role !== "admin") return <div className="p-6 bg-red-50 rounded-2xl text-red-700 font-bold">Admin access required.</div>;

  const now = new Date();
  const getOfferStatus = (o: OfferDoc) => {
    if (!o.active) return { label: "Inactive", className: "bg-slate-100 text-slate-500" };
    if (o.endsAt && new Date(o.endsAt) < now) return { label: "Expired", className: "bg-orange-100 text-orange-700" };
    if (o.startsAt && new Date(o.startsAt) > now) return { label: "Scheduled", className: "bg-[#dbeafe] text-[#1e40af]" };
    return { label: "Live", className: "bg-[#dcfce7] text-[#166534]" };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Active Offers</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">Manage discounts, promotions, and special pricing rules</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input
              className="h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-full text-sm font-bold text-slate-700 outline-none ring-1 ring-transparent focus:ring-red-300 w-48 placeholder:text-slate-400"
              placeholder="Search offers..."
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
          <Link href="/settings/offers/new" className="h-10 px-6 rounded-full bg-[#b7102a] text-white font-bold text-[13px] flex items-center gap-2 hover:brightness-110 shadow-sm transition-all whitespace-nowrap">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Offer
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Offers", value: offers.length, icon: "local_offer", color: "bg-slate-50" },
          { label: "Currently Live", value: offers.filter(o => { const s = getOfferStatus(o); return s.label === "Live"; }).length, icon: "check_circle", color: "bg-[#dcfce7]" },
          { label: "Expiring Soon", value: offers.filter(o => { if (!o.endsAt) return false; const diff = (new Date(o.endsAt).getTime() - now.getTime()) / 86400000; return diff >= 0 && diff <= 3; }).length, icon: "schedule", color: "bg-orange-50" },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} rounded-2xl p-4 border border-slate-100/50 flex items-center gap-3`}>
            <span className="material-symbols-outlined text-slate-500 text-[24px]">{stat.icon}</span>
            <div>
              <div className="text-2xl font-extrabold text-slate-900">{stat.value}</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="bg-[#fce8ec]">
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tl-[1.8rem]">Offer Name</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Discount</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em]">Valid Period</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-[#a65b62] uppercase tracking-[0.15em] rounded-tr-[1.8rem] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-bold">
                  <span className="material-symbols-outlined animate-spin text-slate-300 text-[32px] block mx-auto mb-3">autorenew</span>
                  Loading offers...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                  <span className="material-symbols-outlined text-[48px] text-slate-200 block mx-auto mb-3">local_offer</span>
                  <p className="font-bold">No offers found</p>
                </td></tr>
              ) : filtered.map(o => {
                const statusInfo = getOfferStatus(o);
                return (
                  <tr key={o.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-5">
                      <div className="font-extrabold text-slate-900">{o.name}</div>
                    </td>
                    <td className="px-6 py-5">
                      {o.discountType ? (
                        <span className="bg-[#fce8ec] text-[#b7102a] text-[12px] font-extrabold px-3 py-1.5 rounded-full">
                          {o.discountType === "percentage" ? `${o.discountValue}% OFF` : `₹${o.discountValue} OFF`}
                        </span>
                      ) : <span className="text-slate-300 font-bold">—</span>}
                    </td>
                    <td className="px-6 py-5">
                      <div className="text-sm font-bold text-slate-600">
                        {o.startsAt ? new Date(o.startsAt).toLocaleDateString() : "Always"} → {o.endsAt ? new Date(o.endsAt).toLocaleDateString() : "No expiry"}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <button
                        onClick={() => handleToggleActive(o)}
                        disabled={busy === o.id}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1.5 rounded-full transition-all disabled:opacity-50 ${statusInfo.className}`}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></div>
                        {busy === o.id ? "..." : statusInfo.label}
                      </button>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <Link href={`/settings/offers/${o.id}`} className="w-9 h-9 rounded-full text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-all ml-auto">
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
