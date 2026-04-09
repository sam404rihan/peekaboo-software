"use client";

import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import type { InvoiceDoc, InventoryLogDoc, UnifiedCsvRow } from "@/lib/models";
import { COLLECTIONS } from "@/lib/models";
import { toInvoiceDoc } from "@/lib/invoices";
import { listProducts } from "@/lib/products";
import { listCustomers } from "@/lib/customers";
import { db } from "@/lib/firebase";
import { splitInclusive } from "@/lib/tax";

/* ======================================================
   TYPES
====================================================== */

export type Period = "day" | "week" | "month";

export type MovementRow = {
  productId: string;
  name: string;
  sku: string;
  category?: string;
  qtyIn: number;
  qtyOut: number;
  net: number;
};

export type AgingBucket = '0-30' | '31-60' | '61-90' | '90+';

export type AgingRow = {
  productId: string;
  name: string;
  sku: string;
  category?: string;
  currentStock: number;
  unitPrice: number;
  stockValue: number;
  lastInboundDate: string | null;
  daysAged: number;
  bucket: AgingBucket;
};

export type AgingSummary = {
  bucket: AgingBucket;
  productCount: number;
  totalQty: number;
  totalValue: number;
};

/* ======================================================
   CONSTANTS
====================================================== */

const GSTIN_REGEX = /\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}/;

const DEFAULT_PLACE_OF_SUPPLY = "29-Karnataka";

/* ======================================================
   HELPERS
====================================================== */

const isValidGstin = (value: string): boolean => GSTIN_REGEX.test(value);

const tsFromIso = (iso: string): Timestamp => Timestamp.fromDate(new Date(iso));

const escapeCSV = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

const formatRow = (row: (string | number | undefined)[]) =>
  row.map(String).map(escapeCSV).join(",");

/* ======================================================
   QUERIES
====================================================== */

export async function listInvoicesInRange(
  fromIso: string,
  toIso: string
): Promise<InvoiceDoc[]> {
  if (!db) return [];
  const qy = query(
    collection(db, COLLECTIONS.invoices),
    where("issuedAt", ">=", fromIso),
    where("issuedAt", "<=", toIso),
    orderBy("issuedAt", "asc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) =>
    toInvoiceDoc(d.id, d.data() as Record<string, unknown>)
  );
}

export async function listInventoryLogsInRange(fromIso: string, toIso: string) {
  if (!db) return [];
  const qy = query(
    collection(db, COLLECTIONS.inventoryLogs),
    where("createdAt", ">=", tsFromIso(fromIso)),
    where("createdAt", "<=", tsFromIso(toIso)),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({
    id: d.id,
    data: d.data() as InventoryLogDoc & { createdAt: Timestamp },
  }));
}

/* ======================================================
   ACCOUNTING CSV (FIXED & REQUIRED)
====================================================== */

export async function buildAccountingCsv(
  fromIso: string,
  toIso: string
): Promise<string> {
  const [invoices, products] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listProducts(),
  ]);

  const pmap = new Map(products.map((p) => [p.id, p]));

  const header = [
    "Date",
    "Invoice No.",
    "SKU",
    "HSN",
    "Tax",
    "Discounts",
    "Payment Mode",
    "Customer ID",
  ];

  const rows: (string | number | undefined)[][] = [];

  for (const inv of invoices) {
    for (const item of inv.items) {
      const prod = pmap.get(item.productId);
      if (!prod) continue;

      const value = item.unitPrice * item.quantity;
      const rate = (item.taxRatePct || 0) / 100;
      const tax = rate > 0 ? value - value / (1 + rate) : 0;

      rows.push([
        inv.issuedAt.slice(0, 10),
        inv.invoiceNumber,
        prod.sku,
        prod.hsnCode,
        tax.toFixed(2),
        item.discountAmount || 0,
        inv.paymentMethod,
        inv.customerId || "",
      ]);
    }
  }

  return [header, ...rows].map(formatRow).join("\n");
}

// helpers for tax calculations
function formatGstDate(iso: string): string {
  const d = new Date(iso);
  return d
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    })
    .replace(/ /g, "-");
}


/* ======================================================
   GSTR-1 CSV BUILDERS
====================================================== */

export async function buildGstr1B2bCsv(
  fromIso: string,
  toIso: string
): Promise<string> {
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  const header = [
    "GSTIN/UIN of Recipient",
    "Invoice Number",
    "Invoice date",
    "Invoice Value",
    "Place Of Supply",
    "Reverse Charge",
    "Applicable % of Tax Rate",
    "Invoice Type",
    "E-Commerce GSTIN",
    "Rate",
    "Taxable Value",
    "Cess Amount",
  ];

  const rows: (string | number)[][] = [];

  for (const inv of invoices) {
    const cust = inv.customerId ? customerMap.get(inv.customerId) : undefined;

    // Get the GSTIN or default to "None" if missing or invalid
    const rawGstin = cust?.gstin?.trim().toUpperCase();
    const gstin = (rawGstin && isValidGstin(rawGstin)) ? rawGstin : "None";

    for (const item of inv.items) {
      const rate = Number(item.taxRatePct || 0);
      const lineValue = item.unitPrice * item.quantity;
      const { base } = splitInclusive(lineValue, rate);

      rows.push([
        gstin, // Now will show "None" if no GSTIN is found
        inv.invoiceNumber,
        formatGstDate(inv.issuedAt),
        inv.grandTotal.toFixed(2),
        inv.placeOfSupply || DEFAULT_PLACE_OF_SUPPLY, // Fallback to default
        "N",
        "",
        "Regular",
        "",
        rate.toFixed(2),
        base.toFixed(2),
        "",
      ]);
    }
  }

  return [header, ...rows].map(formatRow).join("\n");
}

export async function buildGstr1B2clCsv(
  fromIso: string,
  toIso: string
): Promise<string> {
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));

  // Aggregate by GST rate
  const rateMap = new Map<number, number>();

  for (const inv of invoices) {
    // B2CL condition:
    if (inv.grandTotal <= 25000) continue;

    const cust = inv.customerId ? customerMap.get(inv.customerId) : undefined;

    // Skip if customer has GSTIN (then it's B2B)
    if (cust?.gstin && isValidGstin(cust.gstin)) continue;

    for (const item of inv.items) {
      const rate = Number(item.taxRatePct || 0);
      if (rate <= 0) continue;

      const lineValue = item.unitPrice * item.quantity;
      const { base } = splitInclusive(lineValue, rate);

      rateMap.set(rate, (rateMap.get(rate) || 0) + base);
    }
  }

  const header = [
    "Applicable % of Tax Rate",
    "Rate",
    "Taxable Value",
    "Cess Amount",
    "E-Commerce GSTIN",
  ];

  const rows: (string | number)[][] = [];

  for (const [rate, taxableValue] of Array.from(rateMap.entries()).sort(
    (a, b) => a[0] - b[0]
  )) {
    rows.push(["", rate.toFixed(2), taxableValue.toFixed(2), "", ""]);
  }

  return [header, ...rows].map(formatRow).join("\n");
}

function splitGst(taxableValue: number, rate: number, isInterState: boolean) {
  const gst = (taxableValue * rate) / 100;

  if (isInterState) {
    return {
      igst: gst,
      cgst: 0,
      sgst: 0,
    };
  }

  return {
    igst: 0,
    cgst: gst / 2,
    sgst: gst / 2,
  };
}

export async function buildGstr1HsnCsv(
  fromIso: string,
  toIso: string
): Promise<string> {
  const invoices = await listInvoicesInRange(fromIso, toIso);
  const products = await listProducts();

  const productMap = new Map(products.map((p) => [p.id, p]));

  type HsnAgg = {
    description: string;
    uqc: string;
    qty: number;
    totalValue: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    cess: number;
  };

  const hsnMap = new Map<string, HsnAgg>();

  for (const inv of invoices) {
    const isInterState =
      !!inv.placeOfSupply && !inv.placeOfSupply.startsWith(DEFAULT_PLACE_OF_SUPPLY);

    for (const item of inv.items) {
      const product = productMap.get(item.productId);
      if (!product?.hsnCode) continue;

      const rate = Number(item.taxRatePct || 0);
      const lineValue = item.unitPrice * item.quantity;
      const { base } = splitInclusive(lineValue, rate);

      const taxSplit = splitGst(base, rate, isInterState);

      const agg = hsnMap.get(product.hsnCode) || {
        description: product.name,
        uqc: "NOS",
        qty: 0,
        totalValue: 0,
        taxableValue: 0,
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0,
      };

      agg.qty += item.quantity;
      agg.totalValue += lineValue;
      agg.taxableValue += base;
      agg.igst += taxSplit.igst;
      agg.cgst += taxSplit.cgst;
      agg.sgst += taxSplit.sgst;

      hsnMap.set(product.hsnCode, agg);
    }
  }

  const header = [
    "HSN",
    "Description",
    "UQC",
    "Total Quantity",
    "Total Value",
    "Taxable Value",
    "Integrated Tax Amount",
    "Central Tax Amount",
    "State/UT Tax Amount",
    "Cess Amount",
  ];

  const rows: (string | number)[][] = [];

  for (const [hsn, v] of hsnMap.entries()) {
    rows.push([
      hsn,
      v.description,
      v.uqc,
      v.qty,
      v.totalValue.toFixed(2),
      v.taxableValue.toFixed(2),
      v.igst.toFixed(2),
      v.cgst.toFixed(2),
      v.sgst.toFixed(2),
      v.cess.toFixed(2),
    ]);
  }

  return [["Summary For HSN"], [], header, ...rows].map(formatRow).join("\n");
}

/* =====================================================
b2bcs  ROW TYPES
====================================================== */
export async function buildGstr1B2csCsv(
  fromIso: string,
  toIso: string
): Promise<string> {
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);

  const customerMap = new Map(customers.map((c) => [c.id, c]));
  
  // B2CS requires aggregation by (POS + Rate)
  const b2csMap = new Map<string, { pos: string; rate: number; taxable: number }>();

  for (const inv of invoices) {
    const cust = inv.customerId ? customerMap.get(inv.customerId) : undefined;
    const gstin = cust?.gstin?.trim().toUpperCase();

    // Skip if it's B2B (has valid GSTIN)
    if (gstin && isValidGstin(gstin)) continue;

    // Skip if it's B2CL (Unregistered AND > 2.5 Lakhs)
    if (inv.grandTotal > 250000) continue;

    for (const item of inv.items) {
      const rate = Number(item.taxRatePct || 0);
      const pos = inv.placeOfSupply || DEFAULT_PLACE_OF_SUPPLY;
      const { base } = splitInclusive(item.unitPrice * item.quantity, rate);

      const key = `${pos}_${rate}`;
      const existing = b2csMap.get(key) || { pos, rate, taxable: 0 };
      existing.taxable += base;
      b2csMap.set(key, existing);
    }
  }

  const header = ["Type", "Place Of Supply", "Rate", "Taxable Value", "Cess Amount", "E-Commerce GSTIN"];
  const rows = Array.from(b2csMap.values()).map(v => [
    "OE", // Other than E-commerce
    v.pos,
    v.rate.toFixed(2),
    v.taxable.toFixed(2),
    "",
    ""
  ]);

  return [["Summary For B2CS(7)"], [], header, ...rows].map(formatRow).join("\n");
}

/* ======================================================
   ROW BUILDERS
====================================================== */

export async function buildAccountingRows(
  fromIso: string,
  toIso: string
): Promise<UnifiedCsvRow[]> {
  // Re-derive directly from source data to avoid fragile CSV re-parsing
  const [invoices, products] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listProducts(),
  ]);
  const pmap = new Map(products.map((p) => [p.id, p]));
  const rows: UnifiedCsvRow[] = [];
  for (const inv of invoices) {
    for (const item of inv.items) {
      const prod = pmap.get(item.productId);
      if (!prod) continue;
      const value = item.unitPrice * item.quantity;
      const rate = (item.taxRatePct || 0) / 100;
      const tax = rate > 0 ? value - value / (1 + rate) : 0;
      rows.push({
        reportType: "ACCOUNTING",
        date: inv.issuedAt.slice(0, 10),
        invoiceNumber: inv.invoiceNumber,
        sku: prod.sku,
        hsn: prod.hsnCode,
        taxAmount: Math.round(tax * 100) / 100,
        paymentMode: inv.paymentMethod,
      });
    }
  }
  return rows;
}

export async function buildGstr1B2bRows(
  fromIso: string,
  toIso: string
): Promise<UnifiedCsvRow[]> {
  const csv = await buildGstr1B2bCsv(fromIso, toIso);
  return csv
    .split("\n")
    .slice(1)
    .map((l) => {
      const [
        gstin,
        invoiceNumber,
        date,
        invoiceValue,
        ,
        ,
        ,
        ,
        ,
        rate,
        taxableValue,
      ] = l.split(",");
      return {
        reportType: "GSTR1_B2B",
        gstin,
        invoiceNumber,
        date,
        invoiceValue: Number(invoiceValue),
        taxRate: Number(rate),
        taxableValue: Number(taxableValue),
      };
    });
}

export async function buildGstr1B2clRows(
  fromIso: string,
  toIso: string
): Promise<UnifiedCsvRow[]> {
  // Re-derive directly — rows are pushed as ["", rate, taxable, "", ""]
  const [invoices, customers] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listCustomers(),
  ]);
  const customerMap = new Map(customers.map((c) => [c.id, c]));
  const rateMap = new Map<number, number>();
  for (const inv of invoices) {
    if (inv.grandTotal <= 25000) continue;
    const cust = inv.customerId ? customerMap.get(inv.customerId) : undefined;
    if (cust?.gstin && GSTIN_REGEX.test(cust.gstin.trim().toUpperCase())) continue;
    for (const item of inv.items) {
      const rate = Number(item.taxRatePct || 0);
      if (rate <= 0) continue;
      const { base } = splitInclusive(item.unitPrice * item.quantity, rate);
      rateMap.set(rate, (rateMap.get(rate) || 0) + base);
    }
  }
  return Array.from(rateMap.entries()).map(([taxRate, taxableValue]) => ({
    reportType: "GSTR1_B2CL" as const,
    taxRate,
    taxableValue: Math.round(taxableValue * 100) / 100,
  }));
}

export async function buildGstr1HsnRows(
  fromIso: string,
  toIso: string
): Promise<UnifiedCsvRow[]> {
  const csv = await buildGstr1HsnCsv(fromIso, toIso);
  return csv
    .split("\n")
    .slice(1)
    .map((l) => {
      const [hsn, , , totalValue, taxableValue, taxAmount] = l.split(",");
      return {
        reportType: "GSTR1_HSN",
        hsn,
        invoiceValue: Number(totalValue),
        taxableValue: Number(taxableValue),
        taxAmount: Number(taxAmount),
      };
    });
}

/* ======================================================
   🔥 UNIFIED CSV EXPORT
====================================================== */

export async function buildUnifiedExportCsv(
  fromIso: string,
  toIso: string
): Promise<string> {
  const rows: UnifiedCsvRow[] = [
    ...(await buildAccountingRows(fromIso, toIso)),
    ...(await buildGstr1B2bRows(fromIso, toIso)),
    ...(await buildGstr1B2clRows(fromIso, toIso)),
    ...(await buildGstr1HsnRows(fromIso, toIso)),
  ];

  const header = [
    "Report Type",
    "Date",
    "Invoice Number",
    "GSTIN",
    "SKU",
    "HSN",
    "Taxable Value",
    "Tax Rate",
    "Tax Amount",
    "Invoice Value",
    "Payment Mode",
  ];

  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.reportType,
        r.date ?? "",
        r.invoiceNumber ?? "",
        r.gstin ?? "",
        r.sku ?? "",
        r.hsn ?? "",
        r.taxableValue ?? "",
        r.taxRate ?? "",
        r.taxAmount ?? "",
        r.invoiceValue ?? "",
        r.paymentMode ?? "",
      ].join(",")
    ),
  ];

  return lines.join("\n");
}

/* ======================================================
   INVENTORY MOVEMENT
====================================================== */

export async function aggregateInventoryMovement(
  fromIso: string,
  toIso: string,
  opts?: { category?: string }
): Promise<MovementRow[]> {
  const [logs, products] = await Promise.all([
    listInventoryLogsInRange(fromIso, toIso),
    listProducts(),
  ]);

  const pmap = new Map(products.map((p) => [p.id, p]));
  const rowsMap = new Map<string, MovementRow>();

  for (const entry of logs) {
    const l = entry.data as InventoryLogDoc & {
      productId: string;
      quantityChange: number;
    };
    const prod = pmap.get(l.productId);
    if (!prod) continue;

    const row = rowsMap.get(l.productId) || {
      productId: l.productId,
      name: prod.name,
      sku: prod.sku,
      category: prod.category,
      qtyIn: 0,
      qtyOut: 0,
      net: 0,
    };

    const delta = Number(l.quantityChange || 0);
    if (delta >= 0) row.qtyIn += delta;
    else row.qtyOut += Math.abs(delta);
    row.net += delta;

    rowsMap.set(l.productId, row);
  }

  return Array.from(rowsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function aggregateByPeriod(
  invoices: { issuedAt: string; grandTotal: number }[],
  period: Period
) {
  const map = new Map<string, { count: number; total: number }>();

  for (const inv of invoices) {
    const dt = new Date(inv.issuedAt);
    let key = "";

    if (period === "day") {
      key = dt.toISOString().slice(0, 10);
    } else if (period === "month") {
      key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
        2,
        "0"
      )}`;
    } else {
      // ISO week
      const tmp = new Date(
        Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())
      );
      const dayNum = tmp.getUTCDay() || 7;
      tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
      key = `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    }

    const val = map.get(key) ?? { count: 0, total: 0 };
    val.count += 1;
    val.total += inv.grandTotal;
    map.set(key, val);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, v]) => ({
      period,
      invoices: v.count,
      total: v.total,
    }));
}

export function aggregatePaymentModes(
  invoices: { paymentMethod: string; grandTotal: number }[]
) {
  const map = new Map<string, number>();

  for (const inv of invoices) {
    map.set(
      inv.paymentMethod,
      (map.get(inv.paymentMethod) ?? 0) + inv.grandTotal
    );
  }

  return Array.from(map.entries()).map(([method, amount]) => ({
    method,
    amount,
  }));
}

/* ======================================================
   INVENTORY AGING
====================================================== */

function toBucket(days: number): AgingBucket {
  if (days <= 30) return '0-30';
  if (days <= 60) return '31-60';
  if (days <= 90) return '61-90';
  return '90+';
}

export async function aggregateInventoryAging(opts?: { category?: string }): Promise<{ rows: AgingRow[]; summary: AgingSummary[] }> {
  if (!db) return { rows: [], summary: [] };

  // Fetch all products and all inventory logs
  const [products, logSnap] = await Promise.all([
    listProducts(),
    getDocs(query(collection(db, COLLECTIONS.inventoryLogs), orderBy("createdAt", "asc"))),
  ]);

  // Build map of latest inbound date per product
  const lastInbound = new Map<string, Date>();
  for (const d of logSnap.docs) {
    const data = d.data() as any;
    const qty = Number(data.quantityChange ?? 0);
    if (qty <= 0) continue; // only inbound movements
    const pid = data.productId as string;
    const ts = data.createdAt;
    const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
    const prev = lastInbound.get(pid);
    if (!prev || date > prev) lastInbound.set(pid, date);
  }

  const now = new Date();
  const rows: AgingRow[] = [];

  for (const p of products) {
    if (p.stock <= 0) continue;
    if (opts?.category && (p.category || '') !== opts.category) continue;

    const inDate = lastInbound.get(p.id!) ?? (p.createdAt ? new Date(p.createdAt) : now);
    const daysAged = Math.max(0, Math.floor((now.getTime() - inDate.getTime()) / (24 * 60 * 60 * 1000)));
    const stockValue = Math.round(p.unitPrice * p.stock * 100) / 100;

    rows.push({
      productId: p.id!,
      name: p.name,
      sku: p.sku,
      category: p.category,
      currentStock: p.stock,
      unitPrice: p.unitPrice,
      stockValue,
      lastInboundDate: inDate.toISOString(),
      daysAged,
      bucket: toBucket(daysAged),
    });
  }

  rows.sort((a, b) => b.daysAged - a.daysAged);

  // Build summary by bucket
  const bucketOrder: AgingBucket[] = ['0-30', '31-60', '61-90', '90+'];
  const summaryMap = new Map<AgingBucket, AgingSummary>(
    bucketOrder.map(b => [b, { bucket: b, productCount: 0, totalQty: 0, totalValue: 0 }])
  );
  for (const r of rows) {
    const s = summaryMap.get(r.bucket)!;
    s.productCount++;
    s.totalQty += r.currentStock;
    s.totalValue += r.stockValue;
  }

  return { rows, summary: bucketOrder.map(b => summaryMap.get(b)!) };
}

/* ======================================================
   STAFF REPORT
====================================================== */

export type StaffRow = {
  cashierUserId: string;
  cashierName: string;
  invoiceCount: number;
  total: number;
  voidCount: number;
};

export async function aggregateByStaff(fromIso: string, toIso: string): Promise<StaffRow[]> {
  const invoices = await listInvoicesInRange(fromIso, toIso);
  const map = new Map<string, StaffRow>();
  for (const inv of invoices) {
    const key = inv.cashierUserId;
    const existing = map.get(key) ?? {
      cashierUserId: inv.cashierUserId,
      cashierName: inv.cashierName || inv.cashierUserId,
      invoiceCount: 0,
      total: 0,
      voidCount: 0,
    };
    if (inv.status === 'void') {
      existing.voidCount++;
    } else {
      existing.invoiceCount++;
      existing.total += inv.grandTotal;
    }
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/* ======================================================
   BRAND REPORT
====================================================== */

export type BrandRow = {
  brand: string;
  invoiceCount: number;
  unitsSold: number;
  total: number;
};

export async function aggregateByBrand(fromIso: string, toIso: string): Promise<BrandRow[]> {
  const [invoices, products] = await Promise.all([
    listInvoicesInRange(fromIso, toIso),
    listProducts(),
  ]);
  const brandMap = new Map(products.map(p => [p.id, p.brand || 'Unbranded']));
  const map = new Map<string, BrandRow>();
  for (const inv of invoices) {
    if (inv.status === 'void') continue;
    const seenBrandsInThisInvoice = new Set<string>();
    for (const item of inv.items) {
      const brand = brandMap.get(item.productId) ?? 'Unbranded';
      const existing = map.get(brand) ?? { brand, invoiceCount: 0, unitsSold: 0, total: 0 };
      existing.unitsSold += item.quantity;
      existing.total += item.unitPrice * item.quantity - (item.discountAmount ?? 0);
      if (!seenBrandsInThisInvoice.has(brand)) {
        existing.invoiceCount++;
        seenBrandsInThisInvoice.add(brand);
      }
      map.set(brand, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
