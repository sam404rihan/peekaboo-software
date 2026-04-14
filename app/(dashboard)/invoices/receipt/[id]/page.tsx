"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, getDocs, collection, query, where, documentId } from "firebase/firestore";
import type { InvoiceDoc, SettingsDoc, ProductDoc } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { splitInclusive, round2 } from "@/lib/tax";

// ── Number → Indian words ────────────────────────────────────────────────────
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function sub1000(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
  return ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + sub1000(n % 100) : "");
}

function toIndianWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  if (Math.floor(n / 10000000)) parts.push(sub1000(Math.floor(n / 10000000)) + " Crore");
  if (Math.floor((n % 10000000) / 100000)) parts.push(sub1000(Math.floor((n % 10000000) / 100000)) + " Lakh");
  if (Math.floor((n % 100000) / 1000)) parts.push(sub1000(Math.floor((n % 100000) / 1000)) + " Thousand");
  if (n % 1000) parts.push(sub1000(n % 1000));
  return parts.join(" ");
}

function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  return "Rupees " + toIndianWords(rupees) + (paise > 0 ? " and " + toIndianWords(paise) + " Paise" : "") + " Only";
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const f2 = (n: number) => n.toFixed(2);

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

// Shared cell style
const TD: React.CSSProperties = { border: "1px solid #000", padding: "3px 5px" };
const TH: React.CSSProperties = { border: "1px solid #000", padding: "3px 5px", textAlign: "center", background: "#f5f5f5" };
const NB: React.CSSProperties = { border: "none", padding: "2px 5px" }; // no-border cell

// ── Component ─────────────────────────────────────────────────────────────────
export default function InvoiceReceiptPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : (params?.id as string);
  const search = useSearchParams();
  const [inv, setInv] = useState<InvoiceDoc | null>(null);
  const [settings, setSettings] = useState<Partial<SettingsDoc> | null>(null);
  const [products, setProducts] = useState<Record<string, ProductDoc>>({});
  const [dataReady, setDataReady] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "generating" | "done">("idle");

  useEffect(() => {
    (async () => {
      if (!db || !id) return;
      const snap = await getDoc(doc(db, "Invoices", id));
      if (!snap.exists()) return;
      const invoice = toInvoiceDoc(snap.id, snap.data() as any);
      setInv(invoice);

      try {
        const sSnap = await getDoc(doc(db, "Settings", "app"));
        if (sSnap.exists()) setSettings(sSnap.data() as any);
      } catch { /* ignore */ }

      // Batch-fetch products for HSN + SKU
      const pids = [...new Set(invoice.items.map(it => it.productId).filter(Boolean))];
      if (pids.length > 0) {
        try {
          const map: Record<string, ProductDoc> = {};
          for (let i = 0; i < pids.length; i += 10) {
            const chunk = pids.slice(i, i + 10);
            const qs = await getDocs(query(collection(db, "Products"), where(documentId(), "in", chunk)));
            qs.forEach(d => { map[d.id] = { ...d.data(), id: d.id } as ProductDoc; });
          }
          setProducts(map);
        } catch { /* ignore */ }
      }
      setDataReady(true);
    })();
  }, [id]);

  const downloadPdf = useCallback(async (invoiceNumber: string) => {
    if (!inv) return;
    setPdfStatus("generating");
    try {
      const pdfMake = (await import("pdfmake/build/pdfmake")).default;
      const pdfFonts = (await import("pdfmake/build/vfs_fonts")).default;
      pdfMake.vfs = (pdfFonts as any).vfs ?? (pdfFonts as any).pdfMake?.vfs;

      // ── helpers ────────────────────────────────────────────────────────────
      const d2 = (n: number) => n.toFixed(2);
      const fmtD = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
      const fmtT = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

      // ── per-line calcs (same formula as the HTML render) ───────────────────
      const lcs = inv.items.map(it => {
        const qty    = it.quantity || 0;
        const rate   = it.unitPrice || 0;
        const total  = round2(rate * qty);
        const disc   = round2(Number(it.discountAmount || 0));
        const netValue = round2(total - disc);
        const taxPct = it.taxRatePct || 0;
        const { gst } = splitInclusive(rate, taxPct);
        const lineGst  = round2(gst * qty);
        const halfRate = round2(taxPct / 2);
        const halfAmt  = round2(lineGst / 2);
        const prod = products[it.productId];
        return { qty, rate, total, disc, netValue, taxPct, lineGst, halfRate, halfAmt, prod };
      });

      // ── totals (identical to HTML) ─────────────────────────────────────────
      const totalQty  = lcs.reduce((s, l) => s + l.qty, 0);
      const totalBill = round2(lcs.reduce((s, l) => s + l.total, 0));
      const totalNet  = round2(lcs.reduce((s, l) => s + l.netValue, 0));
      const totalCgst = round2(lcs.reduce((s, l) => s + l.halfAmt, 0));
      const totalSgst = totalCgst;
      const totalGst  = round2(totalCgst + totalSgst);
      const netDiscount = round2((inv.discountTotal || 0) + lcs.reduce((s, l) => s + l.disc, 0));
      const totalBase = round2(totalNet - totalGst);
      const roundOff  = round2(Math.round(inv.grandTotal) - inv.grandTotal);
      const netBill   = inv.grandTotal;
      const wordsStr  = amountInWords(netBill);

      // ── settings ───────────────────────────────────────────────────────────
      const bizName   = settings?.businessName || "Your Store";
      const addrLine1 = settings?.addressLine1 || "";
      const addrLine2 = settings?.addressLine2 || "";
      const cityStatePin = [settings?.city, settings?.state, settings?.pinCode].filter(Boolean).join(" - ");
      const phone     = settings?.phone || "";
      const gstin     = settings?.gstin || "";
      const recTitle  = settings?.receiptTitle || "Tax Invoice";
      const defPlace  = settings?.defaultPlaceOfSupply || "29";
      const footNote  = settings?.receiptFooterNote || "";
      const terms     = settings?.receiptTermsConditions || "";
      const payMode   = inv.paymentMethod
        ? inv.paymentMethod.charAt(0).toUpperCase() + inv.paymentMethod.slice(1)
        : "";
      const placeOfSupply = inv.placeOfSupply || defPlace;

      // ── address stack (mirrors HTML address block) ─────────────────────────
      const addrStack: any[] = [];
      if (addrLine1) {
        addrStack.push({ text: addrLine1, fontSize: 7 });
        if (addrLine2) addrStack.push({ text: addrLine2, fontSize: 7 });
        const cityLine = cityStatePin + (phone ? "  Tel.: " + phone : "");
        if (cityLine.trim()) addrStack.push({ text: cityLine, fontSize: 7 });
      } else if (phone) {
        addrStack.push({ text: "Tel.: " + phone, fontSize: 7 });
      }

      // ── pdfmake cell helpers ───────────────────────────────────────────────
      const FS = 7;
      const FILL_HDR = "#f5f5f5";
      const FILL_TOT = "#fafafa";

      // cell(): bare data cell
      const cell = (text: string, align: "left"|"center"|"right" = "left", bold = false): any =>
        ({ text, fontSize: FS, alignment: align, bold, margin: [3, 2, 3, 2] });

      // hdr(): header cell (grey bg, bold, centered)
      const hdr = (text: string, extra: any = {}): any =>
        ({ text, fontSize: FS, bold: true, fillColor: FILL_HDR, alignment: "center", margin: [2, 2, 2, 2], ...extra });

      // ph(): rowSpan/colSpan placeholder
      const ph = (): any => ({});

      // ── item body rows ─────────────────────────────────────────────────────
      const itemRows = inv.items.map((it, idx) => {
        const lc = lcs[idx];
        return [
          cell(String(idx + 1), "center"),
          cell(lc.prod?.sku || it.productId, "center"),
          cell(it.name),
          cell(lc.prod?.hsnCode || "", "center"),
          cell(d2(lc.qty), "center"),
          cell(d2(lc.rate), "right"),
          cell(d2(lc.total), "right"),
          cell(d2(lc.netValue), "right"),
          cell(d2(lc.halfRate), "center"),
          cell(d2(lc.halfAmt), "right"),
          cell(d2(lc.halfRate), "center"),
          cell(d2(lc.halfAmt), "right"),
        ];
      });

      // ── right-side bill summary (nested table inside footer cell) ──────────
      // Mirrors the HTML nested table with a top-border on "Net Bill amount"
      const billSummaryRows: any[] = [
        ["Total Bill Value", d2(totalBill)],
        ["Taxed On",         d2(totalBase)],
        ["Net Discount",     d2(netDiscount)],
        ["GST",              d2(totalGst)],
        ["Round Off",        d2(roundOff)],
      ].map(([label, val]) => [
        { text: label, fontSize: FS, border: [false, false, false, false], margin: [3, 2, 3, 1] },
        { text: val,   fontSize: FS, border: [false, false, false, false], alignment: "right", margin: [3, 2, 3, 1] },
      ]);
      // Net Bill amount row with top border
      billSummaryRows.push([
        { text: "Net Bill amount", fontSize: FS, bold: true, border: [false, true, false, false], margin: [3, 3, 3, 3] },
        { text: d2(netBill),       fontSize: FS, bold: true, border: [false, true, false, false], alignment: "right", margin: [3, 3, 3, 3] },
      ]);
      const billSummaryTable: any = {
        table: { widths: ["*", "auto"], body: billSummaryRows },
        layout: { hLineWidth: (i: number, node: any) => (i === node.table.body.length - 1 ? 0.5 : 0), vLineWidth: () => 0, hLineColor: () => "#000" },
      };

      // ── THE ONE UNIFIED TABLE — mirrors exact HTML structure ───────────────
      // 12 columns matching the HTML colgroup:
      // Sr | SKU | Desc(*) | HSN | Qty | Rate | Total | Net | CgstR | CgstA | SgstR | SgstA
      // A4 content width at 28pt margins = ~539pt
      // Widened money cols (Rate/Total/Net/Amt) so 4-5 digit prices don't wrap
      const COL_WIDTHS = [14, 52, "*", 38, 24, 44, 44, 48, 24, 32, 24, 32];

      const tableBody: any[][] = [

        // ── Row 0: Header — biz info (colSpan=6) | invoice meta (colSpan=6) ──
        [
          {
            colSpan: 6,
            stack: [
              { text: [{ text: "Name: ", bold: true }, { text: bizName, bold: true, fontSize: 9 }], fontSize: FS },
              ...(addrLine1 ? [
                {
                  columns: [
                    { text: "Address:", fontSize: FS, width: "auto", margin: [0, 1, 4, 0] },
                    { stack: addrStack, fontSize: FS, margin: [0, 1, 0, 0] },
                  ],
                },
              ] : []),
              { text: [{ text: "GSTIN No.: ", bold: true }, gstin || "—"], fontSize: FS, margin: [0, 2, 0, 0] },
            ],
            margin: [3, 4, 3, 4],
          },
          ph(), ph(), ph(), ph(), ph(),
          {
            colSpan: 6,
            stack: [
              { text: recTitle, bold: true, fontSize: 10, decoration: "underline", alignment: "center", margin: [0, 0, 0, 5] },
              {
                table: {
                  widths: ["auto", "auto", "*"],
                  body: [
                    [
                      { text: "Invoice No.", bold: true, fontSize: FS, border: [false,false,false,false], margin: [0,1,4,1] },
                      { text: ":", fontSize: FS, border: [false,false,false,false], margin: [0,1,4,1] },
                      { text: inv.invoiceNumber, fontSize: FS, border: [false,false,false,false], margin: [0,1,0,1] },
                    ],
                    [
                      { text: "Invoice Date", bold: true, fontSize: FS, border: [false,false,false,false], margin: [0,1,4,1] },
                      { text: ":", fontSize: FS, border: [false,false,false,false], margin: [0,1,4,1] },
                      { text: fmtD(inv.issuedAt), fontSize: FS, border: [false,false,false,false], margin: [0,1,0,1] },
                    ],
                    [
                      { text: "Transaction Time", bold: true, fontSize: FS, border: [false,false,false,false], margin: [0,1,4,1] },
                      { text: ":", fontSize: FS, border: [false,false,false,false], margin: [0,1,4,1] },
                      { text: fmtT(inv.issuedAt), fontSize: FS, border: [false,false,false,false], margin: [0,1,0,1] },
                    ],
                  ],
                },
                layout: "noBorders",
              },
            ],
            margin: [3, 4, 3, 4],
          },
          ph(), ph(), ph(), ph(), ph(),
        ],

        // ── Row 1: Recipient — state code (colSpan=4) | customer (colSpan=8) ──
        [
          {
            colSpan: 4,
            text: [{ text: "Recipient State Code: ", bold: true }, placeOfSupply],
            fontSize: FS, margin: [3, 2, 3, 2],
          },
          ph(), ph(), ph(),
          {
            colSpan: 8,
            text: [{ text: "Customer GSTIN No./Name: ", bold: true }, inv.customerName || ""],
            fontSize: FS, margin: [3, 2, 3, 2],
          },
          ph(), ph(), ph(), ph(), ph(), ph(), ph(),
        ],

        // ── Row 2: Items header row 1 (rowSpan + colSpan) ─────────────────────
        [
          hdr("Sr",                    { rowSpan: 2 }),
          hdr("Stock No.",             { rowSpan: 2 }),
          hdr("Description of Goods",  { rowSpan: 2 }),
          hdr("HSN code",              { rowSpan: 2 }),
          hdr("Qty",                   { rowSpan: 2 }),
          hdr("Item Rate",             { rowSpan: 2 }),
          hdr("Total",                 { rowSpan: 2 }),
          hdr("Item Net Value",        { rowSpan: 2 }),
          hdr("CGST",                  { colSpan: 2 }), ph(),
          hdr("SGST",                  { colSpan: 2 }), ph(),
        ],

        // ── Row 3: Items header row 2 (Rate/Amt sub-labels) ───────────────────
        [
          ph(), ph(), ph(), ph(), ph(), ph(), ph(), ph(),
          hdr("Rate"), hdr("Amt"), hdr("Rate"), hdr("Amt"),
        ],

        // ── Item rows ──────────────────────────────────────────────────────────
        ...itemRows,

        // ── Totals row ─────────────────────────────────────────────────────────
        [
          { colSpan: 4, text: "Total", bold: true, fontSize: FS, alignment: "right", fillColor: FILL_TOT, margin: [3,2,3,2] },
          ph(), ph(), ph(),
          { text: d2(totalQty),  bold: true, fontSize: FS, alignment: "center", fillColor: FILL_TOT, margin: [3,2,3,2] },
          { text: "",            fontSize: FS, fillColor: FILL_TOT },
          { text: d2(totalBill), bold: true, fontSize: FS, alignment: "right",  fillColor: FILL_TOT, margin: [3,2,3,2] },
          { text: d2(totalNet),  bold: true, fontSize: FS, alignment: "right",  fillColor: FILL_TOT, margin: [3,2,3,2] },
          { text: "",            fontSize: FS, fillColor: FILL_TOT },
          { text: d2(totalCgst), bold: true, fontSize: FS, alignment: "right",  fillColor: FILL_TOT, margin: [3,2,3,2] },
          { text: "",            fontSize: FS, fillColor: FILL_TOT },
          { text: d2(totalSgst), bold: true, fontSize: FS, alignment: "right",  fillColor: FILL_TOT, margin: [3,2,3,2] },
        ],

        // ── Footer row: payment (colSpan=6) | bill summary (colSpan=6) ─────────
        [
          {
            colSpan: 6,
            stack: [
              { text: [{ text: "Payment mode", bold: true }, " : ", payMode], fontSize: FS },
              { text: [{ text: "Amount Paid",  bold: true }, " : ", d2(netBill)], fontSize: FS, margin: [0,2,0,0] },
              { text: [{ text: "Total",        bold: true }, " : ", d2(netBill)], fontSize: FS, margin: [0,2,0,0] },
              { text: [{ text: "Bill amount in words: ", bold: true }, wordsStr], fontSize: FS, margin: [0,5,0,0] },
            ],
            margin: [3, 4, 3, 4],
          },
          ph(), ph(), ph(), ph(), ph(),
          {
            colSpan: 6,
            stack: [billSummaryTable],
            margin: [0, 2, 0, 2],
          },
          ph(), ph(), ph(), ph(), ph(),
        ],
      ];

      const docDef: any = {
        pageSize: "A4",
        pageMargins: [28, 28, 28, 28],
        defaultStyle: { font: "Roboto", fontSize: FS },
        content: [
          {
            table: { widths: COL_WIDTHS, body: tableBody, headerRows: 4 },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              hLineColor: () => "#000000",
              vLineColor: () => "#000000",
            },
          },
          ...(footNote || terms
            ? [{ text: [footNote, terms].filter(Boolean).join("\n"), fontSize: FS, color: "#333333", margin: [0, 8, 0, 0] }]
            : []),
        ],
      };

      pdfMake.createPdf(docDef).download(`Invoice-${invoiceNumber}.pdf`);
      setPdfStatus("done");
      setTimeout(() => setPdfStatus("idle"), 3000);
    } catch (err) {
      console.error("PDF generation failed", err);
      setPdfStatus("idle");
      alert("PDF generation failed. Please try printing instead.");
    }
  }, [inv, settings, products]);

  // Auto-download PDF when opened with ?mode=download
  useEffect(() => {
    if (!dataReady || !inv) return;
    const mode = search?.get("mode");
    if (mode === "download") {
      // Small delay to ensure DOM has painted
      setTimeout(() => downloadPdf(inv.invoiceNumber), 300);
    } else if (mode === "print") {
      const trigger = () => { try { window.print(); } catch { } };
      if ("fonts" in document) {
        document.fonts.ready.then(trigger);
      } else {
        setTimeout(trigger, 100);
      }
    }
  }, [dataReady, inv, search, downloadPdf]);

  if (!inv) return <div style={{ padding: 32, fontSize: 13, color: "#555" }}>Preparing invoice…</div>;

  // ── Business info ────────────────────────────────────────────────────────
  const bizName = settings?.businessName || "Your Store";
  const addrLine1 = settings?.addressLine1 || "";
  const addrLine2 = settings?.addressLine2 || "";
  const cityStatePin = [settings?.city, settings?.state, settings?.pinCode].filter(Boolean).join(" - ");
  const phone = settings?.phone || "";
  const gstin = settings?.gstin || "";
  const receiptTitle = settings?.receiptTitle || "Tax Invoice";
  const defaultPlaceOfSupply = settings?.defaultPlaceOfSupply || "29";
  const footerNote = settings?.receiptFooterNote || "";
  const terms = settings?.receiptTermsConditions || "";
  const mode = search?.get("mode"); // "download" | "print" | undefined

  // ── Per-line calcs ────────────────────────────────────────────────────────
  const lineCalcs = inv.items.map(it => {
    const qty = it.quantity || 0;
    const rate = it.unitPrice || 0;
    const total = round2(rate * qty);
    const disc = round2(Number(it.discountAmount || 0));
    const netValue = round2(total - disc);
    const taxPct = it.taxRatePct || 0;
    const { gst } = splitInclusive(rate, taxPct);
    const lineGst = round2(gst * qty);
    const halfRate = round2(taxPct / 2);
    const halfAmt = round2(lineGst / 2);
    const prod = products[it.productId];
    return { qty, rate, total, disc, netValue, taxPct, lineGst, halfRate, halfAmt, prod };
  });

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalQty    = lineCalcs.reduce((s, l) => s + l.qty, 0);
  const totalBill   = round2(lineCalcs.reduce((s, l) => s + l.total, 0));
  const totalNet    = round2(lineCalcs.reduce((s, l) => s + l.netValue, 0));
  const totalCgst   = round2(lineCalcs.reduce((s, l) => s + l.halfAmt, 0));
  const totalSgst   = totalCgst;
  const totalGst    = round2(totalCgst + totalSgst);
  const netDiscount = round2((inv.discountTotal || 0) + lineCalcs.reduce((s, l) => s + l.disc, 0));
  const totalBase   = round2(totalNet - totalGst);
  const roundOff    = round2(Math.round(inv.grandTotal) - inv.grandTotal);
  const netBill     = inv.grandTotal;
  const wordsStr    = amountInWords(netBill);
  const payMode     = inv.paymentMethod
    ? inv.paymentMethod.charAt(0).toUpperCase() + inv.paymentMethod.slice(1)
    : "";

  // ── Shared table style ───────────────────────────────────────────────────
const isAutoMode = mode === "download" || mode === "print";

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body { margin: 0 !important; background: #fff !important; }
          .no-print { display: none !important; }
        }
        body { background: #e8e8e8; margin: 0; }
      `}</style>

      {/* Toolbar — shown when not in auto mode */}
      {!isAutoMode && (
        <div className="no-print" style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          background: "#1e293b", borderBottom: "1px solid #334155",
          padding: "8px 16px", fontSize: 13, display: "flex", alignItems: "center", gap: 10
        }}>
          <span style={{ color: "#94a3b8", flex: 1, fontWeight: 500 }}>
            {inv.invoiceNumber} — Invoice Preview
          </span>
          <button
            onClick={() => downloadPdf(inv.invoiceNumber)}
            disabled={pdfStatus === "generating"}
            style={{
              padding: "6px 14px", background: pdfStatus === "done" ? "#16a34a" : "#b7102a",
              color: "#fff", border: "none", borderRadius: 5, fontWeight: "bold",
              cursor: pdfStatus === "generating" ? "wait" : "pointer", fontSize: 13,
              opacity: pdfStatus === "generating" ? 0.7 : 1,
            }}
          >
            {pdfStatus === "generating" ? "Generating…" : pdfStatus === "done" ? "✓ Saved!" : "⬇ Download PDF"}
          </button>
          <button
            onClick={() => { try { window.print(); } catch { } }}
            style={{
              padding: "6px 14px", background: "#334155", color: "#e2e8f0",
              border: "1px solid #475569", borderRadius: 5, fontWeight: "bold",
              cursor: "pointer", fontSize: 13,
            }}
          >
            🖨 Print
          </button>
          <button
            onClick={() => { try { window.close(); } catch { } }}
            style={{
              padding: "6px 10px", background: "transparent", color: "#64748b",
              border: "none", borderRadius: 5, cursor: "pointer", fontSize: 20, lineHeight: 1,
            }}
          >×</button>
        </div>
      )}

      {/* Generating overlay for auto-download mode */}
      {mode === "download" && pdfStatus === "generating" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(15,23,42,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12,
        }}>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: "bold" }}>Generating PDF…</div>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>Your download will start in a moment.</div>
        </div>
      )}

      {/* ── A4 page wrapper ── */}
      <div
        style={{
          fontFamily: "Arial, sans-serif", fontSize: 11, color: "#000",
          background: "#fff", width: "210mm", minHeight: "297mm",
          margin: "0 auto", marginTop: !isAutoMode ? 44 : 0,
          padding: "10mm", boxSizing: "border-box",
        }}
      >

        {/* ══ SINGLE UNIFIED TABLE — eliminates inter-table border gaps in PDF ══ */}
        <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "3%" }} />
            <col style={{ width: "11%" }} />
            <col />
            <col style={{ width: "8%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
            <col style={{ width: "5%" }} />
          </colgroup>
          <tbody>

            {/* ── HEADER ROW: business info (left) + invoice meta (right) ── */}
            <tr>
              <td colSpan={6} style={{ ...TD, verticalAlign: "top", paddingTop: 5, paddingBottom: 5 }}>
                <div>
                  <span style={{ fontWeight: "bold" }}>Name: </span>
                  <span style={{ fontWeight: "bold", fontSize: 13 }}>{bizName}</span>
                </div>
                {addrLine1 && (
                  <table style={{ borderCollapse: "collapse", marginTop: 2 }}>
                    <tbody>
                      <tr>
                        <td style={{ border: "none", padding: 0, verticalAlign: "top", whiteSpace: "nowrap", paddingRight: 4 }}>
                          Address:
                        </td>
                        <td style={{ border: "none", padding: 0 }}>
                          <div>{addrLine1}</div>
                          {addrLine2 && <div>{addrLine2}</div>}
                          {cityStatePin && (
                            <div>
                              {cityStatePin}
                              {phone && <span>{"  "}Tel.: {phone}</span>}
                            </div>
                          )}
                          {!cityStatePin && phone && <div>Tel.: {phone}</div>}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}
                <div style={{ marginTop: 2 }}>
                  <span style={{ fontWeight: "bold" }}>GSTIN No.: </span>
                  {gstin || "—"}
                </div>
              </td>
              <td colSpan={6} style={{ ...TD, verticalAlign: "top", paddingTop: 5, paddingBottom: 5 }}>
                <div style={{ fontWeight: "bold", fontSize: 14, textDecoration: "underline", textAlign: "center", marginBottom: 6 }}>
                  {receiptTitle}
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    {[
                      ["Invoice No.", inv.invoiceNumber],
                      ["Invoice Date", fmtDate(inv.issuedAt)],
                      ["Transaction Time", fmtTime(inv.issuedAt)],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ ...NB, fontWeight: "bold" }}>{label}</td>
                        <td style={{ ...NB }}>:</td>
                        <td style={{ ...NB }}>{value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </td>
            </tr>

            {/* ── RECIPIENT ROW ── */}
            <tr>
              <td colSpan={4} style={{ ...TD }}>
                <span style={{ fontWeight: "bold" }}>Recipient State Code: </span>
                {inv.placeOfSupply || defaultPlaceOfSupply}
              </td>
              <td colSpan={8} style={{ ...TD }}>
                <span style={{ fontWeight: "bold" }}>Customer GSTIN No./Name: </span>
                {inv.customerName || ""}
              </td>
            </tr>

            {/* ── ITEMS HEADER ROW 1 ── */}
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ ...TH }} rowSpan={2}>Sr</th>
              <th style={{ ...TH }} rowSpan={2}>Stock No.</th>
              <th style={{ ...TH }} rowSpan={2}>Description of Goods</th>
              <th style={{ ...TH }} rowSpan={2}>HSN code</th>
              <th style={{ ...TH }} rowSpan={2}>Qty</th>
              <th style={{ ...TH }} rowSpan={2}>Item Rate</th>
              <th style={{ ...TH }} rowSpan={2}>Total</th>
              <th style={{ ...TH }} rowSpan={2}>Item Net Value</th>
              <th style={{ ...TH }} colSpan={2}>CGST</th>
              <th style={{ ...TH }} colSpan={2}>SGST</th>
            </tr>
            {/* ── ITEMS HEADER ROW 2 ── */}
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ ...TH }}>Rate</th>
              <th style={{ ...TH }}>Amt</th>
              <th style={{ ...TH }}>Rate</th>
              <th style={{ ...TH }}>Amt</th>
            </tr>

            {/* ── ITEM ROWS ── */}
            {inv.items.map((it, idx) => {
              const lc = lineCalcs[idx];
              return (
                <tr key={idx}>
                  <td style={{ ...TD, textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ ...TD, textAlign: "center", wordBreak: "break-all" }}>{lc.prod?.sku || it.productId}</td>
                  <td style={{ ...TD }}>{it.name}</td>
                  <td style={{ ...TD, textAlign: "center" }}>{lc.prod?.hsnCode || ""}</td>
                  <td style={{ ...TD, textAlign: "center" }}>{f2(lc.qty)}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{f2(lc.rate)}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{f2(lc.total)}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{f2(lc.netValue)}</td>
                  <td style={{ ...TD, textAlign: "center" }}>{f2(lc.halfRate)}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{f2(lc.halfAmt)}</td>
                  <td style={{ ...TD, textAlign: "center" }}>{f2(lc.halfRate)}</td>
                  <td style={{ ...TD, textAlign: "right" }}>{f2(lc.halfAmt)}</td>
                </tr>
              );
            })}

            {/* ── TOTALS ROW ── */}
            <tr style={{ fontWeight: "bold", background: "#fafafa" }}>
              <td style={{ ...TD, textAlign: "right" }} colSpan={4}>Total</td>
              <td style={{ ...TD, textAlign: "center" }}>{f2(totalQty)}</td>
              <td style={{ ...TD }}></td>
              <td style={{ ...TD, textAlign: "right" }}>{f2(totalBill)}</td>
              <td style={{ ...TD, textAlign: "right" }}>{f2(totalNet)}</td>
              <td style={{ ...TD }}></td>
              <td style={{ ...TD, textAlign: "right" }}>{f2(totalCgst)}</td>
              <td style={{ ...TD }}></td>
              <td style={{ ...TD, textAlign: "right" }}>{f2(totalSgst)}</td>
            </tr>

            {/* ── FOOTER ROW: payment info (left) + bill summary (right) ── */}
            <tr>
              <td colSpan={6} style={{ ...TD, verticalAlign: "top", padding: "5px 5px" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    <tr>
                      <td style={{ ...NB, fontWeight: "bold" }}>Payment mode</td>
                      <td style={{ ...NB }}>:</td>
                      <td style={{ ...NB }} colSpan={2}>{payMode}</td>
                    </tr>
                    <tr>
                      <td style={{ ...NB, fontWeight: "bold" }}>Amount Paid</td>
                      <td style={{ ...NB }}>:</td>
                      <td style={{ ...NB }}></td>
                      <td style={{ ...NB, textAlign: "right", fontWeight: "bold" }}>{f2(netBill)}</td>
                    </tr>
                    <tr>
                      <td style={{ ...NB, fontWeight: "bold" }}>Total</td>
                      <td style={{ ...NB }}>:</td>
                      <td style={{ ...NB }}></td>
                      <td style={{ ...NB, textAlign: "right", fontWeight: "bold" }}>{f2(netBill)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} style={{ ...NB, paddingTop: 6 }}>
                        <span style={{ fontWeight: "bold" }}>Bill amount in words: </span>
                        {wordsStr}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
              <td colSpan={6} style={{ ...TD, verticalAlign: "top", padding: 0 }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    {[
                      ["Total Bill Value", f2(totalBill)],
                      ["Taxed On", f2(totalBase)],
                      ["Net Discount", f2(netDiscount)],
                      ["GST", f2(totalGst)],
                      ["Round Off", f2(roundOff)],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td style={{ ...NB, paddingTop: 3, paddingBottom: 3 }}>{label}</td>
                        <td style={{ ...NB, paddingTop: 3, paddingBottom: 3, textAlign: "right" }}>{value}</td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...NB, fontWeight: "bold", borderTop: "1px solid #000", paddingTop: 4, paddingBottom: 5 }}>
                        Net Bill amount
                      </td>
                      <td style={{ ...NB, fontWeight: "bold", borderTop: "1px solid #000", textAlign: "right", paddingTop: 4, paddingBottom: 5 }}>
                        {f2(netBill)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>

          </tbody>
        </table>

        {/* ══ FOOTER NOTE ══ */}
        {(footerNote || terms) && (
          <div style={{ marginTop: 10, fontSize: 10, color: "#333", textAlign: "left" }}>
            {footerNote && footerNote.split("\n").map((line, i) => <div key={i}>{line}</div>)}
            {terms && <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{terms}</div>}
          </div>
        )}
      </div>
    </>
  );
}

export const dynamic = "force-dynamic";
