"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { SettingsDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

function MSIcon({ name, className }: { name: string; className?: string }) {
  return <span className={cn("material-symbols-outlined", className)}>{name}</span>;
}

type FormState = Partial<
  Pick<
    SettingsDoc,
    | "businessName"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "state"
    | "pinCode"
    | "gstin"
    | "phone"
    | "email"
    | "logoUrl"
    | "receiptFooterNote"
    | "invoicePrefix"
  >
> & { currency?: string; taxInclusive?: boolean };

export default function BusinessProfileSettingsPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({});
  const isAdmin = role === "admin";
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    (async () => {
      if (!db) return;
      const ref = doc(db, "Settings", "app");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as Partial<SettingsDoc>;
        setForm({
          businessName: data.businessName ?? "",
          addressLine1: data.addressLine1 ?? "",
          addressLine2: data.addressLine2 ?? "",
          city: data.city ?? "",
          state: data.state ?? "",
          pinCode: data.pinCode ?? "",
          gstin: data.gstin ?? "",
          phone: data.phone ?? "",
          email: data.email ?? "",
          logoUrl: data.logoUrl ?? "",
          receiptFooterNote: data.receiptFooterNote ?? "",
          invoicePrefix: data.invoicePrefix ?? "INV",
          currency: data.currency ?? "INR",
          taxInclusive: data.taxInclusive ?? true,
        });
      } else {
        setForm({ businessName: "", currency: "INR", taxInclusive: true });
      }
    })();
  }, []);

  const update = (k: keyof FormState, v: any) =>
    setForm((s) => ({ ...s, [k]: v }));

  const onSave = async () => {
    if (!db || !isAdmin) return;
    setSaving(true);
    try {
      const ref = doc(db, "Settings", "app");
      const payload: Partial<SettingsDoc> = {
        businessName: form.businessName || "",
        currency: form.currency || "INR",
        taxInclusive: form.taxInclusive ?? true,
        addressLine1: form.addressLine1 || "",
        addressLine2: form.addressLine2 || "",
        city: form.city || "",
        state: form.state || "",
        pinCode: form.pinCode || "",
        gstin: form.gstin || "",
        phone: form.phone || "",
        email: form.email || "",
        logoUrl: form.logoUrl || "",
        receiptFooterNote: form.receiptFooterNote || "",
        invoicePrefix: form.invoicePrefix || "INV",
        updatedAt: new Date().toISOString(),
      } as any;
      await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: "Saved", description: "Business profile updated", variant: "success" });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full font-sans max-w-4xl mx-auto pt-4 relative">
      <div className="flex flex-col mb-8 w-full items-center relative">
         <button 
           onClick={() => window.history.back()} 
           className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-50 transition-colors absolute left-0 top-1/2 -translate-y-1/2"
         >
            <MSIcon name="arrow_back" className="text-slate-700 text-[20px] font-bold" />
         </button>
         <h2 className="text-xl font-extrabold text-[#111827] tracking-tight">Store Profile</h2>
         <p className="text-[12px] font-medium text-slate-500 mt-1">Configure global store identity and address</p>
      </div>

      {!isAdmin && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-600 flex items-center gap-3">
          <MSIcon name="lock" />
          You have read-only access. Ask an admin to update business profile.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
         
         <div className="flex flex-col gap-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">Business Name</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.businessName || ""}
             onChange={(e) => update("businessName", e.target.value)}
             disabled={!isAdmin}
             placeholder="My Awesome Store"
           />
         </div>

         <div className="flex flex-col gap-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">GSTIN / Tax ID</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.gstin || ""}
             onChange={(e) => update("gstin", e.target.value)}
             disabled={!isAdmin}
             placeholder="29ABCDE1234F1Z5"
           />
         </div>

         <div className="flex flex-col gap-2 md:col-span-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">Address Line 1</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.addressLine1 || ""}
             onChange={(e) => update("addressLine1", e.target.value)}
             disabled={!isAdmin}
           />
         </div>

         <div className="flex flex-col gap-2 md:col-span-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">Address Line 2</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.addressLine2 || ""}
             onChange={(e) => update("addressLine2", e.target.value)}
             disabled={!isAdmin}
           />
         </div>

         <div className="flex flex-col gap-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">City</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.city || ""}
             onChange={(e) => update("city", e.target.value)}
             disabled={!isAdmin}
           />
         </div>

         <div className="flex flex-col gap-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">State</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.state || ""}
             onChange={(e) => update("state", e.target.value)}
             disabled={!isAdmin}
             placeholder="e.g. Karnataka"
           />
         </div>

         <div className="flex flex-col gap-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">Pin Code</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.pinCode || ""}
             onChange={(e) => update("pinCode", e.target.value)}
             disabled={!isAdmin}
             placeholder="e.g. 560001"
           />
         </div>

         <div className="flex flex-col gap-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">Phone</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.phone || ""}
             onChange={(e) => update("phone", e.target.value)}
             disabled={!isAdmin}
             placeholder="e.g. 9876543210"
           />
         </div>

         <div className="flex flex-col gap-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">Email</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.email || ""}
             onChange={(e) => update("email", e.target.value)}
             disabled={!isAdmin}
           />
         </div>

         <div className="flex flex-col gap-2 md:col-span-2">
           <label className="text-[11px] font-bold text-slate-500 tracking-wide">Receipt Footer Note</label>
           <input
             className="w-full h-[46px] rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-red-200 transition-all disabled:opacity-50 disabled:bg-slate-50"
             value={form.receiptFooterNote || ""}
             onChange={(e) => update("receiptFooterNote", e.target.value)}
             disabled={!isAdmin}
           />
         </div>

         <label className="flex items-center gap-3 md:col-span-2 p-4 bg-[#fafafa] border border-slate-200 rounded-xl mt-2 cursor-pointer transition-all hover:bg-slate-50">
           <input
             type="checkbox"
             className="w-5 h-5 rounded text-[#b7102a] focus:ring-[#b7102a]"
             checked={!!form.taxInclusive}
             onChange={(e) => update("taxInclusive", e.target.checked)}
             disabled={!isAdmin}
           />
           <span className="text-[13px] font-bold text-slate-700">Prices are Tax Inclusive by default</span>
         </label>

      </div>

      <div className="mt-8 flex justify-end items-center gap-4 border-t border-slate-100 pt-6">
         <button 
            type="button"
            className="h-11 px-8 rounded-full border border-slate-200 bg-white text-[13px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 shadow-sm transition-all"
            onClick={() => window.history.back()}
         >
           Cancel
         </button>
         <button 
           className="h-11 px-10 rounded-full bg-[#b7102a] text-[13px] text-white font-extrabold hover:brightness-110 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50 disabled:shadow-none min-w-[140px]"
           onClick={onSave}
           disabled={!isAdmin || saving}
         >
           {saving ? 'Saving...' : 'Save Profile'}
         </button>
      </div>
    </div>
  );
}
