"use client";
import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { InvoiceDoc, SettingsDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import Receipt from "@/components/receipt";
import { splitInclusive, round2 } from "@/lib/tax";

export default function InvoiceReceiptPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const search = useSearchParams();
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [settings, setSettings] = useState<Partial<SettingsDoc> | null>(null);

  useEffect(() => {
    (async () => {
      if (!db || !id) return;
      const snap = await getDoc(doc(db, "Invoices", id));
      if (snap.exists()) setInv(toInvoiceDoc(snap.id, snap.data() as any));
      try {
        const sSnap = await getDoc(doc(db, "Settings", "app"));
        if (sSnap.exists()) setSettings(sSnap.data() as any);
      } catch {
        // ignore
      }
    })();
  }, [id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const autoClose = search?.get('autoclose') === '1' || search?.get('autoclose') === 'true';
    if (!autoClose) return;
    const onAfterPrint = () => {
      try { window.close(); } catch { }
    };
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [search]);

  // Compute Totals
  const summary = React.useMemo(() => {
    if (!inv) return { gross: 0, lineDisc: 0, base: 0, gst: 0 };
    let gross = 0;
    let lineDisc = 0;

    // For Tax Calculation summary (Approximation based on existing logic)
    let baseTotal = 0;
    let gstTotal = 0;

    for (const it of inv.items) {
      const g = (it.unitPrice || 0) * (it.quantity || 0);
      const d = Number(it.discountAmount || 0);
      gross += g;
      lineDisc += d;

      // Tax Logic:
      // Note: If you want tax calculated on the Discounted price, change logic here.
      // Currently, it follows your previous logic: Tax on MRP (Base)
      const { base, gst } = splitInclusive(Number(it.unitPrice || 0), Number(it.taxRatePct || 0));
      baseTotal += base * Number(it.quantity || 0);
      gstTotal += gst * Number(it.quantity || 0);
    }
    return {
      gross: round2(gross),
      lineDisc: round2(lineDisc),
      base: round2(baseTotal),
      gst: round2(gstTotal)
    };
  }, [inv]);

  if (!inv) return <div className="p-4">Preparing…</div>;

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

  const shouldConfirm = (search?.get('confirm') === '1' || search?.get('confirm') === 'true');

  return (
    <div className="relative">
      {shouldConfirm && (
        <div className="fixed top-2 right-2 z-50 print:hidden bg-white/90 backdrop-blur rounded border shadow-sm px-3 py-2 text-xs flex items-center gap-2">
          <span>Print receipt?</span>
          <button
            onClick={() => { try { window.print(); } catch { } }}
            className="px-2 py-1 rounded border bg-blue-600 text-white hover:bg-blue-700"
          >
            Print
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
            <span className="font-mono">{inv.invoiceNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">Date:</span>
            <span>{new Date(inv.issuedAt).toLocaleString()}</span>
          </div>
        </div>

        {/* --- Header Separator --- */}
        <div className="border-b-2 border-dashed border-gray-400 my-2" />

        {/* --- Items Header --- */}
        <div className="flex justify-between text-xs font-bold uppercase mb-2">
          <span>Item Description</span>
          <span>Amount</span>
        </div>

        {/* --- Items Block Layout --- */}
        <div className="flex flex-col gap-3">
          {inv.items.map((it, idx) => {
            const qty = it.quantity || 0;
            const unit = it.unitPrice || 0;
            const grossLine = unit * qty;
            const disc = Number(it.discountAmount || 0);
            const net = grossLine - disc;
            const hasDisc = disc > 0;

            return (
              <div key={idx} className="flex flex-col">
                {/* Line 1: Name */}
                <div className="font-bold text-sm leading-tight mb-0.5">
                  {it.name}
                </div>

                {/* Line 2: Qty x Rate = Gross */}
                <div className="flex justify-between text-xs text-gray-700">
                  <span>{qty} x {unit.toFixed(2)}</span>
                  <span>{grossLine.toFixed(2)}</span>
                </div>

                {/* Line 3: Discount (only if exists) */}
                {hasDisc && (
                  <div className="flex justify-between text-xs text-gray-500 italic">
                    <span>Item Disc.</span>
                    <span>- {disc.toFixed(2)}</span>
                  </div>
                )}

                {/* Line 4: Final Net & Tax Info */}
                <div className="flex justify-between items-end mt-0.5">
                  {/* Tax info (small) */}
                  <span className="text-[10px] text-gray-400">
                    {it.taxRatePct ? `(GST ${it.taxRatePct}%)` : ''}
                  </span>
                  {/* Net Amount (Bold) */}
                  <span className="font-bold text-sm">
                    {net.toFixed(2)}
                  </span>
                </div>
                {/* Dashed Separator between items */}
                <div className="border-b border-dashed border-gray-300 mt-2" />
              </div>
            );
          })}
        </div>

        {/* --- Totals Section --- */}
        <div className="mt-2 text-xs flex flex-col gap-1">
          {/* 1. Gross Total */}
          <div className="flex justify-between text-gray-600">
            <span>Subtotal (MRP)</span>
            <span>{summary.gross.toFixed(2)}</span>
          </div>

          {/* 2. Total Line Discounts */}
          {summary.lineDisc > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Total Item Disc.</span>
              <span>- {summary.lineDisc.toFixed(2)}</span>
            </div>
          )}

          {/* 3. Base & Tax Breakdown (Information Only) */}
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

          {/* 4. Bill Level Discount */}
          {inv.discountTotal && inv.discountTotal > 0 ? (
            <div className="flex justify-between text-gray-600 mt-1">
              <span>Bill Discount</span>
              <span>- {inv.discountTotal.toFixed(2)}</span>
            </div>
          ) : null}

          {/* --- Grand Total Separator --- */}
          <div className="border-b-2 border-black my-1" />

          {/* 5. Grand Total */}
          <div className="flex justify-between text-base font-extrabold uppercase">
            <span>Grand Total</span>
            <span>₹{inv.grandTotal.toFixed(2)}</span>
          </div>
          <div className="border-b-2 border-black mb-1" />
        </div>

      </Receipt>
    </div>
  );
}

export const dynamic = "force-dynamic";