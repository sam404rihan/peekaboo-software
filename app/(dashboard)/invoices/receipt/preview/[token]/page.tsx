"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Receipt from "@/components/receipt";
import type { SettingsDoc } from "@/lib/models";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { splitInclusive, round2 } from "@/lib/tax";
import { checkoutCart } from "@/lib/pos";

type PendingPayload = {
  lines: Array<{ productId: string; name: string; qty: number; unitPrice: number; lineDiscount?: number; taxRatePct?: number }>;
  billDiscount?: number;
  paymentMethod?: 'cash' | 'card' | 'upi' | 'wallet';
  paymentReferenceId?: string;
  cashierUserId?: string;
  cashierName?: string;
  customerId?: string;
  opId: string; // token
};

export default function ReceiptPreviewPage() {
  const params = useParams();
  const token = Array.isArray(params?.token) ? params.token[0] : (params?.token as string);
  const search = useSearchParams();
  const [settings, setSettings] = useState<Partial<SettingsDoc> | null>(null);
  const [payload, setPayload] = useState<PendingPayload | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const sSnap = await getDoc(doc(db!, "Settings", "app"));
        if (sSnap.exists()) setSettings(snapTo<SettingsDoc>(sSnap.data()));
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`checkout.pending.${token}`);
      if (raw) setPayload(JSON.parse(raw));
      else setError("Nothing to print. This tab was opened without payload.");
    } catch {
      setError("Failed to load pending checkout payload.");
    }
  }, [token]);

  useEffect(() => {
    if (!payload) return;
    const shouldConfirm = search?.get('confirm') === '1' || search?.get('confirm') === 'true';
    const autoClose = search?.get('autoclose') === '1' || search?.get('autoclose') === 'true';
    const onAfterPrint = async () => {
      if (shouldConfirm) return;
      await doFinalize();
      if (autoClose) try { window.close(); } catch { }
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  async function doFinalize() {
    if (!payload) return;
    if (finalizing) return;
    setFinalizing(true);
    setError(null);
    try {
      const newId = await checkoutCart(payload);
      try {
        window.opener?.postMessage({ type: 'checkout-finalized', token: payload.opId, invoiceId: newId }, window.location.origin);
      } catch { }
      try { sessionStorage.removeItem(`checkout.pending.${payload.opId}`); } catch { }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setFinalizing(false);
      return;
    }
    setFinalizing(false);
  }

  const summary = useMemo(() => {
    if (!payload) return { gross: 0, lineDisc: 0, base: 0, gst: 0, grand: 0 };
    let gross = 0, lineDisc = 0, baseTotal = 0, gstTotal = 0;

    for (const it of payload.lines) {
      const g = (it.unitPrice || 0) * (it.qty || 0);
      const d = Number(it.lineDiscount || 0);
      gross += g;
      lineDisc += d;

      const { base, gst } = splitInclusive(Number(it.unitPrice || 0), Number(it.taxRatePct || 0));
      baseTotal += base * Number(it.qty || 0);
      gstTotal += gst * Number(it.qty || 0);
    }

    const sub = gross - lineDisc;
    const bill = Number(payload.billDiscount || 0);
    const grand = Math.max(0, sub - bill);

    return {
      gross: round2(gross),
      lineDisc: round2(lineDisc),
      base: round2(baseTotal),
      gst: round2(gstTotal),
      grand: round2(grand)
    };
  }, [payload]);

  if (!payload) return <div className="p-4 text-sm">{error || 'Preparing…'}</div>;

  const bizName = settings?.businessName || "Your Store Name";
  const addrParts = [
    settings?.addressLine1,
    settings?.addressLine2,
    [settings?.city, settings?.state, settings?.pinCode].filter(Boolean).join(", "),
  ].filter((p) => !!p && String(p).trim().length > 0) as string[];
  const gstin = settings?.gstin || undefined;
  const footer = settings?.receiptFooterNote || undefined;
  const logo = settings?.logoUrl || undefined;
  const showTax = settings?.showTaxLine ?? true;
  const showReview = !!settings?.showReviewLink && !!settings?.googleReviewUrl;
  const reviewUrl = settings?.googleReviewUrl || undefined;
  const terms = settings?.receiptTermsConditions || undefined;

  const shouldConfirm = search?.get('confirm') === '1' || search?.get('confirm') === 'true';
  const autoClose = search?.get('autoclose') === '1' || search?.get('autoclose') === 'true';

  return (
    <div className="relative">
      {shouldConfirm && (
        <div className="fixed top-2 right-2 z-50 print:hidden bg-white/90 backdrop-blur rounded border shadow-sm px-3 py-2 text-xs flex items-center gap-2">
          <span>Print receipt?</span>
          <button
            onClick={async () => {
              try { window.print(); } catch { }
              await doFinalize();
              if (autoClose) try { window.close(); } catch { }
            }}
            className="px-2 py-1 rounded border bg-orange-500 text-white border-2 border-orange-500 shadow-[4px_4px_0_0_#FB923C] hover:translate-y-px hover:shadow-none transition-all font-bold"
            disabled={finalizing}
          >
            {finalizing ? 'Finalizing…' : 'Print'}
          </button>
          <button
            onClick={() => { try { window.close(); } catch { } }}
            className="px-2 py-1 rounded border hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
      <Receipt
        paperWidthMm={settings?.receiptPaperWidthMm ?? 80}
        contentWidthMm={settings?.receiptContentWidthMm ?? Math.min(75, Number(settings?.receiptPaperWidthMm ?? 80))}
        safePaddingMm={3}
        logoUrl={logo}
        businessName={bizName}
        addressLines={addrParts}
        gstin={gstin}
        footerNote={footer}
        showReviewLink={showReview}
        reviewUrl={reviewUrl}
        autoPrint={!shouldConfirm}
        termsConditions={terms}
      >
        <div className="bill-info mb-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Invoice No:</span>
            <span className="font-mono">PENDING</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Date:</span>
            <span>{new Date().toLocaleString()}</span>
          </div>
        </div>

        <div className="border-b-2 border-dashed border-gray-400 my-2" />

        <div className="flex justify-between text-xs font-bold uppercase mb-2">
          <span>Item Description</span>
          <span>Amount</span>
        </div>

        {/* --- Items List --- */}
        <div className="flex flex-col gap-3">
          {payload.lines.map((it, idx) => {
            const qty = it.qty || 0;
            const unit = it.unitPrice || 0;
            const grossLine = unit * qty;
            const disc = Number(it.lineDiscount || 0);
            const net = grossLine - disc;
            const hasDisc = disc > 0;

            return (
              <div key={idx} className="flex flex-col">
                {/* Name */}
                <div className="font-bold text-sm leading-tight mb-0.5">
                  {it.name}
                </div>
                {/* Details */}
                <div className="flex justify-between text-xs text-slate-700 font-bold">
                  <span>{qty} x {unit.toFixed(2)}</span>
                  <span>{grossLine.toFixed(2)}</span>
                </div>
                {/* Discount */}
                {hasDisc && (
                  <div className="flex justify-between text-xs text-slate-500 font-medium italic">
                    <span>Item Disc.</span>
                    <span>- {disc.toFixed(2)}</span>
                  </div>
                )}
                {/* Final Net */}
                <div className="flex justify-between items-end mt-0.5">
                  <span className="text-[10px] text-gray-400">
                    {it.taxRatePct ? `(GST ${it.taxRatePct}%)` : ''}
                  </span>
                  <span className="font-bold text-sm">
                    {net.toFixed(2)}
                  </span>
                </div>
                <div className="border-b border-dashed border-gray-300 mt-2" />
              </div>
            );
          })}
        </div>

        {/* --- Footer Sums --- */}
        <div className="mt-2 text-xs flex flex-col gap-1">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal (MRP)</span>
            <span>{summary.gross.toFixed(2)}</span>
          </div>

          {summary.lineDisc > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Total Item Disc.</span>
              <span>- {summary.lineDisc.toFixed(2)}</span>
            </div>
          )}

          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>Ex-Tax Value</span>
            <span>{summary.base.toFixed(2)}</span>
          </div>
          {showTax && (
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Total GST</span>
              <span>{summary.gst.toFixed(2)}</span>
            </div>
          )}

          {payload.billDiscount && payload.billDiscount > 0 ? (
            <div className="flex justify-between text-gray-600 mt-1">
              <span>Bill Discount</span>
              <span>- {payload.billDiscount.toFixed(2)}</span>
            </div>
          ) : null}

          <div className="border-b-2 border-black my-1" />

          <div className="flex justify-between text-base font-extrabold uppercase">
            <span>Grand Total</span>
            <span>₹{summary.grand.toFixed(2)}</span>
          </div>
          <div className="border-b-2 border-black mb-1" />
        </div>

        {error ? <div className="text-xs text-red-600 mt-2 text-center">{error}</div> : null}
      </Receipt>
    </div>
  );
}

function snapTo<T>(d: any): T { return d as T; }

export const dynamic = "force-dynamic";