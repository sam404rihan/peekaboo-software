import { db } from "./firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  increment,
  writeBatch,
} from "firebase/firestore";
import { COLLECTIONS } from "./models";
import * as XLSX from "xlsx";

export interface BulkUploadResult {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ----------------------------------------------------------------
// Safely read a cell value from a row.
// Tries exact key first, then case/whitespace-insensitive match.
// Always returns a trimmed string (never undefined/null).
// ----------------------------------------------------------------
function cell(row: Record<string, any>, ...keys: string[]): string {
  for (const k of keys) {
    // 1. Exact key
    if (row[k] !== undefined && row[k] !== null) {
      const v = String(row[k]).trim();
      if (v !== "" && v !== "0" || k === "Qty") return v; // allow "0" for Qty
      if (v !== "") return v;
    }
    // 2. Case + whitespace insensitive match across all row keys
    const matchedKey = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase() === k.toLowerCase()
    );
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      const v = String(row[matchedKey]).trim();
      if (v !== "") return v;
    }
  }
  return "";
}

// Parse a numeric cell — handles raw numbers AND formatted strings like "1,234.00" / "₹100"
function num(row: Record<string, any>, ...keys: string[]): number {
  for (const k of keys) {
    // 1. Raw number stored directly
    if (typeof row[k] === "number" && isFinite(row[k])) return row[k];
    // 2. Case-insensitive key match with raw number
    const matchedKey = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase() === k.toLowerCase()
    );
    if (matchedKey && typeof row[matchedKey] === "number" && isFinite(row[matchedKey])) {
      return row[matchedKey];
    }
    // 3. String that needs parsing — strip currency symbols and commas
    const s = cell(row, k).replace(/[₹$,\s]/g, "");
    const n = parseFloat(s);
    if (!isNaN(n)) return n;
  }
  return 0;
}

// ----------------------------------------------------------------
// Main Excel processor.
//
// Supports the exact column headers from the user's stock register:
//   Item Code, Item Name, Item Desc, Product Description, Group,
//   Batch Code, HSN, Category, Pack Size, Colour, Size, Product,
//   UOM, Qty, Rate, MRP, CGST Rate, SGST Rate, IGST Rate,
//   Transaction type, ...
//
// Strategy:
//   - Group rows by Item Code; SUM qty across duplicate rows in the file
//     (e.g. multiple delivery lines for the same SKU).
//   - INCREMENT existing product stock by the summed qty.
//   - CREATE new product with qty as initial stock.
//   - Writes in Firestore batches (max 450 ops/batch) for speed & reliability.
// ----------------------------------------------------------------
export async function processInventoryExcel(file: File): Promise<BulkUploadResult> {
  if (!db) throw new Error("Firestore not initialized");
  const dbx = db;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
          type: "array",
          cellText: false,   // keep raw values where possible
          cellDates: false,  // keep dates as numbers
        });

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // raw: true → numbers stay as numbers (critical for price/qty fields)
        // defval: undefined → missing cells are absent entirely (easier to detect)
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          raw: true,
          defval: undefined,
        }) as Record<string, any>[];

        const result: BulkUploadResult = { added: 0, updated: 0, skipped: 0, errors: [] };

        if (!rows.length) {
          result.errors.push("Spreadsheet is empty or could not be read.");
          resolve(result);
          return;
        }

        // -------------------------------------------------------
        // STEP 1: Build a deduplicated product map keyed by SKU.
        //
        // When the same Item Code appears on multiple rows (a sales
        // register has this), we REPLACE with the latest row's info.
        // This avoids summing sold quantities as a stock count.
        // -------------------------------------------------------
        type ItemEntry = {
          sku: string;
          name: string;
          description: string;
          category: string;
          group: string;
          hsn: string;
          rate: number;
          mrp: number;
          qty: number;
          cgstRate: number;
          sgstRate: number;
          igstRate: number;
          packSize: string;
          colour: string;
          size: string;
          uom: string;
        };

        const itemMap = new Map<string, ItemEntry>();

        for (const row of rows) {
          const sku = cell(row, "Item Code").toUpperCase();
          if (!sku) { result.skipped++; continue; }

          const name = cell(row, "Item Name", "Item Desc", "Product Description", "Product");
          if (!name) { result.skipped++; continue; }

          const qty = num(row, "Qty");
          const rate = num(row, "Rate");
          const mrp = num(row, "MRP") || rate;
          const category = cell(row, "Category") || cell(row, "Group");
          const hsn = cell(row, "HSN");

          if (itemMap.has(sku)) {
            // Same SKU appears on multiple rows → SUM the quantities.
            // This is correct for a purchase/stock-receipt register where
            // one delivery may have many invoice lines for the same item.
            const existing = itemMap.get(sku)!;
            existing.qty += qty;          // accumulate received units
            if (rate > 0) existing.rate = rate;   // keep latest price
            if (mrp > 0) existing.mrp = mrp;
            if (category) existing.category = category;
            if (hsn) existing.hsn = hsn;
          } else {
            itemMap.set(sku, {
              sku, name,
              description: cell(row, "Item Desc", "Product Description"),
              category,
              group: cell(row, "Group"),
              hsn,
              rate,
              mrp,
              qty,
              cgstRate: num(row, "CGST Rate"),
              sgstRate: num(row, "SGST Rate"),
              igstRate: num(row, "IGST Rate"),
              packSize: cell(row, "Pack Size"),
              colour: cell(row, "Colour"),
              size: cell(row, "Size"),
              uom: cell(row, "UOM"),
            });
          }
        }

        if (itemMap.size === 0) {
          result.errors.push(
            "No valid product rows found. Verify the file has 'Item Code' and 'Item Name' columns."
          );
          resolve(result);
          return;
        }

        // -------------------------------------------------------
        // STEP 2: Fetch which SKUs already exist in Firestore.
        // Query in chunks of 30 (Firestore 'in' limit).
        // -------------------------------------------------------
        const skuList = Array.from(itemMap.keys());
        const productsCol = collection(dbx, COLLECTIONS.products);

        const existingBySkU = new Map<string, string>(); // sku → docId

        for (let i = 0; i < skuList.length; i += 30) {
          const chunk = skuList.slice(i, i + 30);
          try {
            const snap = await getDocs(query(productsCol, where("sku", "in", chunk)));
            snap.docs.forEach((d) => {
              const docSku = String(d.data().sku || "").toUpperCase();
              existingBySkU.set(docSku, d.id);
            });
          } catch (err: any) {
            result.errors.push(`Batch query error (chunk ${i}–${i + chunk.length}): ${err.message}`);
          }
        }

        // -------------------------------------------------------
        // STEP 3: Write to Firestore in batches (≤450 ops each).
        // SET stock directly — idempotent, safe to re-upload.
        // -------------------------------------------------------
        const MAX_OPS = 450;
        let batch = writeBatch(dbx);
        let opsInBatch = 0;

        const flushBatch = async () => {
          if (opsInBatch > 0) {
            await batch.commit();
            batch = writeBatch(dbx);
            opsInBatch = 0;
          }
        };

        const now = new Date().toISOString();

        for (const [sku, item] of Array.from(itemMap.entries())) {
          try {
            // Derive GST rate
            let taxRatePct: number | undefined;
            if (item.igstRate > 0) {
              taxRatePct = item.igstRate;
            } else if (item.cgstRate > 0 || item.sgstRate > 0) {
              taxRatePct = item.cgstRate + item.sgstRate;
            }

            if (opsInBatch >= MAX_OPS) await flushBatch();

            if (existingBySkU.has(sku)) {
              // ---- UPDATE: INCREMENT stock by the qty in this file ----
              // prev stock + qty received in this Excel = new stock
              const docId = existingBySkU.get(sku)!;
              const ref = doc(dbx, COLLECTIONS.products, docId);

              const updates: Record<string, any> = {
                updatedAt: now,
                stock: increment(item.qty),   // additive — never overwrites
              };
              if (item.rate > 0) updates.unitPrice = item.rate;
              if (item.mrp > 0) updates.mrp = item.mrp;
              if (item.hsn) updates.hsnCode = item.hsn;
              if (item.category) updates.category = item.category;
              if (taxRatePct !== undefined) updates.taxRatePct = taxRatePct;

              batch.update(ref, updates);
              result.updated++;
            } else {
              // ---- ADD: create new product ----
              const newRef = doc(productsCol);
              const newDoc: Record<string, any> = {
                sku: item.sku,
                name: item.name,
                unitPrice: item.rate,
                mrp: item.mrp || undefined,
                stock: item.qty,
                category: item.category || item.group || "",
                hsnCode: item.hsn || undefined,
                active: true,
                createdAt: now,
                updatedAt: now,
              };

              if (taxRatePct !== undefined) newDoc.taxRatePct = taxRatePct;
              if (item.uom) newDoc.uom = item.uom;
              if (item.colour) newDoc.colour = item.colour;
              if (item.size) newDoc.size = item.size;
              if (item.packSize) newDoc.packSize = item.packSize;
              if (item.description) newDoc.description = item.description;

              // Strip nulls / empty strings
              Object.keys(newDoc).forEach((k) => {
                if (newDoc[k] === "" || newDoc[k] === null || newDoc[k] === undefined) {
                  delete newDoc[k];
                }
              });

              batch.set(newRef, newDoc);
              result.added++;
            }

            opsInBatch++;
          } catch (err: any) {
            result.errors.push(`SKU "${sku}": ${err.message}`);
          }
        }

        await flushBatch(); // commit remaining

        resolve(result);
      } catch (err: any) {
        reject(new Error(`Failed to parse Excel file: ${err.message}`));
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
