"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import type { SettingsDoc } from "@/lib/models";
import { useToast } from "@/components/ui/toast";

type FormState = Partial<Pick<SettingsDoc,
  | "receiptPaperWidthMm"
  | "receiptContentWidthMm"
  | "autoPrintReceipt"
  | "showTaxLine"
  | "googleReviewUrl"
  | "showReviewLink"
  | "receiptFooterNote"
  | "receiptTermsConditions"
  | "receiptTitle"
  | "defaultPlaceOfSupply"
>>;

type ToggleProps = {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
};

function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <label className={`flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-red-200 transition-all ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div>
        <p className="text-[14px] font-bold text-slate-800">{label}</p>
        {description && <p className="text-[12px] text-slate-400 font-medium mt-0.5">{description}</p>}
      </div>
      <div className={`w-11 h-6 rounded-full transition-colors relative ${checked ? "bg-[#b7102a]" : "bg-slate-200"}`} onClick={() => onChange(!checked)}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${checked ? "left-6" : "left-1"}`}></div>
      </div>
    </label>
  );
}

export default function ReceiptTemplateSettingsPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const isAdmin = role === "admin";
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>({});
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
          receiptPaperWidthMm: data.receiptPaperWidthMm ?? 80,
          receiptContentWidthMm: data.receiptContentWidthMm ?? Math.min(75, Number(data.receiptPaperWidthMm ?? 80)),
          autoPrintReceipt: data.autoPrintReceipt ?? true,
          showTaxLine: data.showTaxLine ?? true,
          googleReviewUrl: data.googleReviewUrl ?? "",
          showReviewLink: data.showReviewLink ?? false,
          receiptFooterNote: data.receiptFooterNote ?? "",
          receiptTermsConditions: data.receiptTermsConditions ?? "",
          receiptTitle: data.receiptTitle ?? "Tax Invoice",
          defaultPlaceOfSupply: data.defaultPlaceOfSupply ?? "29",
        });
      } else {
        setForm({ receiptPaperWidthMm: 80, receiptContentWidthMm: 75, autoPrintReceipt: true, showTaxLine: true, showReviewLink: false, receiptTitle: "Tax Invoice", defaultPlaceOfSupply: "29" });
      }
    })();
  }, []);

  const update = (k: keyof FormState, v: any) => setForm(s => ({ ...s, [k]: v }));

  const onSave = async () => {
    if (!db || !isAdmin) return;
    setSaving(true);
    try {
      const ref = doc(db, "Settings", "app");
      const payload: Partial<SettingsDoc> = {
        receiptPaperWidthMm: Number(form.receiptPaperWidthMm) || 80,
        receiptContentWidthMm: Math.min(
          Number(form.receiptPaperWidthMm) || 80,
          Math.max(40, Number(form.receiptContentWidthMm) || (Number(form.receiptPaperWidthMm) || 80))
        ),
        autoPrintReceipt: !!form.autoPrintReceipt,
        showTaxLine: !!form.showTaxLine,
        googleReviewUrl: form.googleReviewUrl || "",
        showReviewLink: !!form.showReviewLink,
        receiptFooterNote: form.receiptFooterNote || "",
        receiptTermsConditions: form.receiptTermsConditions || "",
        receiptTitle: form.receiptTitle || "Tax Invoice",
        defaultPlaceOfSupply: form.defaultPlaceOfSupply || "29",
        updatedAt: new Date().toISOString(),
      } as any;
      await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
      toast({ title: "Saved", description: "Receipt settings updated successfully", variant: "success" });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Receipt Template</h2>
        <p className="text-sm text-slate-500 font-medium mt-1">Configure how receipts print and what they display</p>
      </div>

      {!isAdmin && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-orange-700 font-bold text-sm flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px]">lock</span>
          Read-only — only admins can change receipt settings
        </div>
      )}

      {/* Paper Size Section */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-4">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Paper Configuration</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Paper Width (mm)</label>
            <input
              type="number" min={40} max={120} step={1}
              value={form.receiptPaperWidthMm ?? 80}
              onChange={e => update("receiptPaperWidthMm", Number(e.target.value))}
              disabled={!isAdmin}
              className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Content Width (mm)</label>
            <input
              type="number" min={40} max={Math.max(40, Number(form.receiptPaperWidthMm || 80))} step={1}
              value={form.receiptContentWidthMm ?? 75}
              onChange={e => update("receiptContentWidthMm", Number(e.target.value))}
              disabled={!isAdmin}
              className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 disabled:opacity-50"
            />
          </div>
        </div>
        <p className="text-[11px] font-medium text-slate-400">Tip: 75mm content width on 80mm paper gives ~2.5mm margin on each side</p>
      </div>

      {/* Toggle Settings */}
      <div className="space-y-3">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Print Behaviour</p>
        <Toggle
          label="Auto-print after checkout"
          description="Automatically open print dialog after completing a sale"
          checked={!!form.autoPrintReceipt}
          onChange={v => update("autoPrintReceipt", v)}
          disabled={!isAdmin}
        />
        <Toggle
          label="Show GST line on receipt"
          description="Display itemised GST breakdown at the bottom of receipts"
          checked={!!form.showTaxLine}
          onChange={v => update("showTaxLine", v)}
          disabled={!isAdmin}
        />
        <Toggle
          label="Show Google Review link"
          description="Print review QR code or link on receipt footer"
          checked={!!form.showReviewLink}
          onChange={v => update("showReviewLink", v)}
          disabled={!isAdmin}
        />
      </div>

      {/* Text Fields */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 space-y-5">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Receipt Content</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Receipt Title</label>
            <input
              value={form.receiptTitle || ""}
              onChange={e => update("receiptTitle", e.target.value)}
              disabled={!isAdmin}
              placeholder="Tax Invoice"
              className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 disabled:opacity-50 placeholder:font-normal placeholder:text-slate-400"
            />
            <p className="text-[11px] text-slate-400 font-medium">Shown at the top of every invoice (e.g. Tax Invoice, Receipt)</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Default State Code</label>
            <input
              value={form.defaultPlaceOfSupply || ""}
              onChange={e => update("defaultPlaceOfSupply", e.target.value)}
              disabled={!isAdmin}
              placeholder="29"
              className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 disabled:opacity-50 placeholder:font-normal placeholder:text-slate-400"
            />
            <p className="text-[11px] text-slate-400 font-medium">GST place of supply state code (e.g. 29 for Karnataka)</p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Footer Note</label>
          <input
            value={form.receiptFooterNote || ""}
            onChange={e => update("receiptFooterNote", e.target.value)}
            disabled={!isAdmin}
            placeholder="Thank you for shopping with us!"
            className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 disabled:opacity-50 placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Terms & Conditions</label>
          <textarea
            value={form.receiptTermsConditions || ""}
            onChange={e => update("receiptTermsConditions", e.target.value)}
            disabled={!isAdmin}
            rows={4}
            placeholder="e.g. No cash refunds. Exchange within 7 days with bill. Sale items are final."
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 resize-y disabled:opacity-50 placeholder:font-normal placeholder:text-slate-400"
          />
          <p className="text-[11px] text-slate-400 font-medium">Keep under 300 characters for clean thermal printing</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Google Review URL</label>
          <input
            value={form.googleReviewUrl || ""}
            onChange={e => update("googleReviewUrl", e.target.value)}
            disabled={!isAdmin}
            placeholder="https://g.page/r/..."
            className="h-11 bg-slate-50 border border-slate-200 rounded-xl px-4 text-sm font-bold text-slate-700 outline-none focus:ring-1 focus:ring-red-300 disabled:opacity-50 placeholder:font-normal placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Save */}
      {isAdmin && (
        <div className="flex justify-end pt-2">
          <button onClick={onSave} disabled={saving} className="h-11 px-10 rounded-full bg-[#b7102a] text-white font-extrabold text-[13px] hover:brightness-110 shadow-lg shadow-red-900/20 transition-all disabled:opacity-50">
            {saving ? "Saving..." : "Save Receipt Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
