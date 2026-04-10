// @react-pdf/renderer — invoice PDF component
// Must be imported dynamically (client-only, no SSR)
import React from "react";
import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

// ── Column flex weights (proportional, sum = 100) ─────────────────────────────
// sr=3, sku=11, desc=28, hsn=8, qty=5, rate=7, total=7, net=8,
// cgstR=5, cgstA=6, sgstR=5, sgstA=7  →  total = 100
const W = {
  sr:    3,
  sku:   11,
  desc:  28,
  hsn:   8,
  qty:   5,
  rate:  7,
  total: 7,
  net:   8,
  cgstR: 5,
  cgstA: 6,
  sgstR: 5,
  sgstA: 7,
} as const;

const BORDER = "0.5pt solid #000";

const S = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 7,
    color: "#000",
    padding: "10mm",
  },
  table: {
    width: "100%",
    borderTop: BORDER,
    borderLeft: BORDER,
  },
  row: {
    flexDirection: "row",
    width: "100%",
  },
  // Every cell closes its own right + bottom edge; table provides top + left.
  cell: {
    borderRight: BORDER,
    borderBottom: BORDER,
    padding: "2pt 3pt",
    overflow: "hidden",
  },
  bold: { fontFamily: "Helvetica-Bold" },
  center: { textAlign: "center" },
  right: { textAlign: "right" },
  bg: { backgroundColor: "#f5f5f5" },
  bgFaint: { backgroundColor: "#fafafa" },
});

// ── Cell ──────────────────────────────────────────────────────────────────────
// Use flex (integer weight) instead of percentage to avoid border-box overflow gaps
function Cell({
  flex,
  style,
  children,
}: {
  flex: number | number[];           // single flex, or [grow, shrink, basis] — unused
  style?: object | object[];
  children?: React.ReactNode;
}) {
  const f = Array.isArray(flex) ? flex[0] : flex;
  const base = [S.cell, { flex: f }];
  const extra = Array.isArray(style) ? style : style ? [style] : [];
  return (
    <View style={[...base, ...extra] as any}>
      {typeof children === "string" || typeof children === "number"
        ? <Text>{String(children)}</Text>
        : children ?? <Text> </Text>}
    </View>
  );
}

function Row({ children, style }: { children: React.ReactNode; style?: object | object[] }) {
  const extra = Array.isArray(style) ? style : style ? [style] : [];
  return <View style={[S.row, ...extra] as any}>{children}</View>;
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", marginBottom: 1 }}>
      <Text style={S.bold}>{label}: </Text>
      <Text>{value}</Text>
    </View>
  );
}

// ── Data type ─────────────────────────────────────────────────────────────────
export type InvoicePdfData = {
  invoiceNumber: string;
  issuedAt: string;
  placeOfSupply: string;
  customerName: string;
  paymentMethod: string;
  grandTotal: number;
  items: Array<{
    name: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    taxRatePct?: number;
  }>;
  lineCalcs: Array<{
    qty: number;
    rate: number;
    total: number;
    disc: number;
    netValue: number;
    taxPct: number;
    halfRate: number;
    halfAmt: number;
    prod?: { sku?: string; hsnCode?: string };
  }>;
  totals: {
    qty: number;
    bill: number;
    net: number;
    cgst: number;
    sgst: number;
    gst: number;
    base: number;
    discount: number;
    roundOff: number;
    netBill: number;
  };
  biz: {
    name: string;
    addrLine1: string;
    addrLine2: string;
    cityStatePin: string;
    phone: string;
    gstin: string;
  };
  receiptTitle: string;
  wordsStr: string;
  footerNote: string;
  terms: string;
};

const f2 = (n: number) => n.toFixed(2);
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

// ── Document ──────────────────────────────────────────────────────────────────
export function InvoicePdfDocument({ d }: { d: InvoicePdfData }) {
  const { biz, totals } = d;

  // flex sums for merged cells
  const leftHalf  = W.sr + W.sku + W.desc + W.hsn;          // 50
  const rightHalf = W.qty + W.rate + W.total + W.net + W.cgstR + W.cgstA + W.sgstR + W.sgstA; // 50
  const cgstSpan  = W.cgstR + W.cgstA;   // 11
  const sgstSpan  = W.sgstR + W.sgstA;   // 12
  const allCols   = leftHalf + rightHalf; // 100

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <View style={S.table}>

          {/* ── Header: biz info | invoice meta ── */}
          <Row>
            <Cell flex={allCols / 2} style={{ padding: "4pt 4pt" }}>
              <Text style={[S.bold, { fontSize: 9 }]}>{biz.name}</Text>
              {biz.addrLine1 ? (
                <View style={{ flexDirection: "row", marginTop: 2 }}>
                  <Text style={{ marginRight: 3 }}>Address:</Text>
                  <View style={{ flex: 1 }}>
                    <Text>{biz.addrLine1}</Text>
                    {biz.addrLine2 ? <Text>{biz.addrLine2}</Text> : null}
                    <Text>
                      {biz.cityStatePin}
                      {biz.phone ? `  Tel.: ${biz.phone}` : ""}
                    </Text>
                  </View>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", marginTop: 2 }}>
                <Text style={S.bold}>GSTIN No.: </Text>
                <Text>{biz.gstin || "—"}</Text>
              </View>
            </Cell>
            <Cell flex={allCols / 2} style={{ padding: "4pt 4pt" }}>
              <Text style={[S.bold, { fontSize: 10, textAlign: "center", textDecoration: "underline", marginBottom: 4 }]}>
                {d.receiptTitle}
              </Text>
              <KV label="Invoice No."       value={d.invoiceNumber} />
              <KV label="Invoice Date"      value={fmtDate(d.issuedAt)} />
              <KV label="Transaction Time"  value={fmtTime(d.issuedAt)} />
            </Cell>
          </Row>

          {/* ── Recipient ── */}
          <Row>
            <Cell flex={33}>
              <View style={{ flexDirection: "row" }}>
                <Text style={S.bold}>Recipient State Code: </Text>
                <Text>{d.placeOfSupply}</Text>
              </View>
            </Cell>
            <Cell flex={67}>
              <View style={{ flexDirection: "row" }}>
                <Text style={S.bold}>Customer GSTIN No./Name: </Text>
                <Text>{d.customerName}</Text>
              </View>
            </Cell>
          </Row>

          {/* ── Items header row 1 (CGST/SGST as merged spans) ── */}
          <Row style={S.bg}>
            <Cell flex={W.sr}    style={[S.bold, S.center]}><Text style={S.bold}>Sr</Text></Cell>
            <Cell flex={W.sku}   style={[S.bold, S.center]}><Text style={S.bold}>Stock No.</Text></Cell>
            <Cell flex={W.desc}  style={[S.bold, S.center]}><Text style={S.bold}>Description of Goods</Text></Cell>
            <Cell flex={W.hsn}   style={[S.bold, S.center]}><Text style={S.bold}>HSN code</Text></Cell>
            <Cell flex={W.qty}   style={[S.bold, S.center]}><Text style={S.bold}>Qty</Text></Cell>
            <Cell flex={W.rate}  style={[S.bold, S.center]}><Text style={S.bold}>Item Rate</Text></Cell>
            <Cell flex={W.total} style={[S.bold, S.center]}><Text style={S.bold}>Total</Text></Cell>
            <Cell flex={W.net}   style={[S.bold, S.center]}><Text style={S.bold}>Item Net Value</Text></Cell>
            <Cell flex={cgstSpan} style={[S.bold, S.center]}><Text style={S.bold}>CGST</Text></Cell>
            <Cell flex={sgstSpan} style={[S.bold, S.center]}><Text style={S.bold}>SGST</Text></Cell>
          </Row>

          {/* ── Items header row 2 (Rate / Amt sub-labels) ── */}
          <Row style={S.bg}>
            <Cell flex={W.sr}    style={S.center}><Text> </Text></Cell>
            <Cell flex={W.sku}   style={S.center}><Text> </Text></Cell>
            <Cell flex={W.desc}  style={S.center}><Text> </Text></Cell>
            <Cell flex={W.hsn}   style={S.center}><Text> </Text></Cell>
            <Cell flex={W.qty}   style={S.center}><Text> </Text></Cell>
            <Cell flex={W.rate}  style={S.center}><Text> </Text></Cell>
            <Cell flex={W.total} style={S.center}><Text> </Text></Cell>
            <Cell flex={W.net}   style={S.center}><Text> </Text></Cell>
            <Cell flex={W.cgstR} style={[S.bold, S.center]}><Text style={S.bold}>Rate</Text></Cell>
            <Cell flex={W.cgstA} style={[S.bold, S.center]}><Text style={S.bold}>Amt</Text></Cell>
            <Cell flex={W.sgstR} style={[S.bold, S.center]}><Text style={S.bold}>Rate</Text></Cell>
            <Cell flex={W.sgstA} style={[S.bold, S.center]}><Text style={S.bold}>Amt</Text></Cell>
          </Row>

          {/* ── Item rows ── */}
          {d.items.map((it, idx) => {
            const lc = d.lineCalcs[idx];
            return (
              <Row key={idx}>
                <Cell flex={W.sr}    style={S.center}>{idx + 1}</Cell>
                <Cell flex={W.sku}   style={S.center}>{lc.prod?.sku || it.productId}</Cell>
                <Cell flex={W.desc}>{it.name}</Cell>
                <Cell flex={W.hsn}   style={S.center}>{lc.prod?.hsnCode || ""}</Cell>
                <Cell flex={W.qty}   style={S.center}>{f2(lc.qty)}</Cell>
                <Cell flex={W.rate}  style={S.right}>{f2(lc.rate)}</Cell>
                <Cell flex={W.total} style={S.right}>{f2(lc.total)}</Cell>
                <Cell flex={W.net}   style={S.right}>{f2(lc.netValue)}</Cell>
                <Cell flex={W.cgstR} style={S.center}>{f2(lc.halfRate)}</Cell>
                <Cell flex={W.cgstA} style={S.right}>{f2(lc.halfAmt)}</Cell>
                <Cell flex={W.sgstR} style={S.center}>{f2(lc.halfRate)}</Cell>
                <Cell flex={W.sgstA} style={S.right}>{f2(lc.halfAmt)}</Cell>
              </Row>
            );
          })}

          {/* ── Totals row ── */}
          <Row style={S.bgFaint}>
            <Cell flex={leftHalf}  style={[S.bold, S.right]}><Text style={S.bold}>Total</Text></Cell>
            <Cell flex={W.qty}     style={[S.bold, S.center]}>{f2(totals.qty)}</Cell>
            <Cell flex={W.rate}><Text> </Text></Cell>
            <Cell flex={W.total}   style={[S.bold, S.right]}>{f2(totals.bill)}</Cell>
            <Cell flex={W.net}     style={[S.bold, S.right]}>{f2(totals.net)}</Cell>
            <Cell flex={W.cgstR}><Text> </Text></Cell>
            <Cell flex={W.cgstA}   style={[S.bold, S.right]}>{f2(totals.cgst)}</Cell>
            <Cell flex={W.sgstR}><Text> </Text></Cell>
            <Cell flex={W.sgstA}   style={[S.bold, S.right]}>{f2(totals.sgst)}</Cell>
          </Row>

          {/* ── Footer: payment info (left) | bill summary (right) ── */}
          <Row>
            <Cell flex={allCols / 2} style={{ padding: "4pt 4pt" }}>
              <KV label="Payment mode" value={d.paymentMethod} />
              <KV label="Amount Paid"  value={f2(totals.netBill)} />
              <KV label="Total"        value={f2(totals.netBill)} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 4 }}>
                <Text style={S.bold}>Bill amount in words: </Text>
                <Text>{d.wordsStr}</Text>
              </View>
            </Cell>
            <Cell flex={allCols / 2} style={{ padding: 0 }}>
              {(
                [
                  ["Total Bill Value", f2(totals.bill)],
                  ["Taxed On",         f2(totals.base)],
                  ["Net Discount",     f2(totals.discount)],
                  ["GST",              f2(totals.gst)],
                  ["Round Off",        f2(totals.roundOff)],
                ] as [string, string][]
              ).map(([label, value]) => (
                <View key={label} style={{ flexDirection: "row", padding: "2pt 4pt" }}>
                  <Text style={{ flex: 1 }}>{label}</Text>
                  <Text>{value}</Text>
                </View>
              ))}
              <View style={{ flexDirection: "row", padding: "3pt 4pt", borderTop: BORDER }}>
                <Text style={[S.bold, { flex: 1 }]}>Net Bill amount</Text>
                <Text style={S.bold}>{f2(totals.netBill)}</Text>
              </View>
            </Cell>
          </Row>

        </View>

        {/* ── Footer note ── */}
        {(d.footerNote || d.terms) ? (
          <View style={{ marginTop: 8, fontSize: 7, color: "#333" }}>
            {d.footerNote
              ? d.footerNote.split("\n").map((line, i) => <Text key={i}>{line}</Text>)
              : null}
            {d.terms ? <Text style={{ marginTop: 3 }}>{d.terms}</Text> : null}
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
