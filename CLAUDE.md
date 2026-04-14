# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (Webpack, stable on Windows)
npm run dev

# Development (Turbopack, faster but may cause ENOENT race on Windows)
npm run dev:turbo

# Build (runs npm run clean first via prebuild)
npm run build

# Production server
npm run start

# Lint
npm run lint

# Clear .next cache manually
npm run clean
```

> **Windows note:** If you see intermittent ENOENT errors on `.next\static\development\_buildManifest.js.tmp.*`, run `npm run clean` then `npm run dev`. Webpack polling is already enabled in `next.config.ts`.

## Environment

Copy `.env.example` to `.env.local` and fill in the six `NEXT_PUBLIC_FIREBASE_*` variables (`API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, `APP_ID`). Without them, Firebase won't initialize and the app will show a console warning. The SMTP vars (`SMTP_HOST/PORT/USER/PASS`, `NOTIFY_ADMIN_EMAIL`) are optional — only needed for void-invoice email alerts.

## Architecture

### App Router layout

- `app/(auth)/` — unauthenticated routes (login)
- `app/(dashboard)/` — all authenticated routes; `app/(dashboard)/layout.tsx` enforces role-based nav visibility
- `app/debug/` — dev-only pages for Firebase status inspection and user creation
- Print-only routes (`receipt/[id]`, `barcodes/print/[productId]/[labels]`) should have `export const dynamic = "force-dynamic"` and `Cache-Control: no-store` headers in production

### Data layer (`lib/`)

All Firestore logic lives in `lib/`. The collection name constants in `lib/models.ts` (`COLLECTIONS`) must be used everywhere — never hardcode collection name strings.

Key modules:
- `lib/models.ts` — all TypeScript interfaces and `COLLECTIONS` constants. Single source of truth for the data model.
- `lib/firebase.ts` — initializes Firebase only when all env vars are present; exports `auth`, `db`, `storage` (all possibly `undefined`). Always guard: `if (!db) throw new Error(...)`.
- `lib/pos.ts` — `checkoutCart()` (Firestore transaction: validates stock, decrements, creates Invoice + InventoryLogs + customer loyalty in one atomic op), `adjustStock()`, `receiveStock()`
- `lib/exchange.ts` — exchange/return flow; validates remaining returnable qty, handles defect vs sellable returns, creates new invoice if new items added
- `lib/offline.ts` — offline queue; serializes pending ops (checkout, receive, exchange) to localStorage and replays on reconnect
- `lib/catalog-cache.ts` — warms product catalog into localStorage for offline POS scanning
- `lib/offers.ts` — offer engine: flat, percentage, BOGO same-item rules; DOB-month targeting; exclusive/priority stacking
- `lib/tax.ts` — tax-inclusive MRP helpers (MRP already includes GST; split out base ex-tax and GST for receipts)
- `lib/reports.ts` — aggregation queries for sales, stock, movement, payment breakdown
- `lib/gst-xlsx.ts` — GST-compliant accounting export (GSTR-1 B2B, B2CL, HSN summary rows)
- `lib/barcodes.ts` — barcode generation (JSBarcode, Code-128); label PDF generation (jsPDF, 50×25 mm labels)

### Dynamic GST via threshold price

`ProductDoc.thresholdPrice` (optional) enables per-product dynamic GST at billing time. When set:
- selling price (`unitPrice`) **< `thresholdPrice`** → 5% GST applied
- selling price **≥ `thresholdPrice`** → 18% GST applied

This overrides the product's static `taxRatePct` at checkout. The resolution happens in `effectiveTaxRate()` inside `components/pos/pos-panel.tsx`, and the resolved rate is passed to `checkoutCart()` (both online and offline paths). The field is editable in the product form under "Pricing & Tax".

### Tax model (important)

Prices are **MRP-inclusive** (tax already baked into `unitPrice`). The POS grand total = sum of MRP lines minus discounts — no tax is added on top. On receipts, base (ex-tax) and GST are back-calculated from MRP using `P / (1 + r)`. Discounts are **post-tax** and do not reduce the GST figure.

### Stock mutations — always transactional

Every stock change uses a Firestore transaction (`runTransaction`) and must also write an `InventoryLogs` entry. The log `type` field maps: `sale → sale`, `receive → purchase`, `return → return`, `defect → damage`, general → `adjustment`. Never update `products.stock` outside a transaction.

### Offline queue

The queue stores ops in `localStorage`. `lib/offline.ts` processes them in order when connectivity is restored. Each op carries an `opId` used as the Firestore document ID for idempotency — replay won't create duplicates. The catalog cache (`lib/catalog-cache.ts`) must be warmed while online before offline use.

### Auth & RBAC

`UserDoc.role` is `admin | cashier`. Route-level guards are in `app/(dashboard)/layout.tsx`. Cashiers only see POS and Invoices; admins see everything including Settings, Reports, Offers, and Barcodes.

### Settings document

A single Firestore document at `Settings/app` holds business profile, receipt config, invoice prefix, and the auto-incrementing `nextInvoiceSequence` counter (bumped atomically inside `checkoutCart`).

## Testing

No automated test suite is set up. Validation is done manually using `Testing.md` (smoke test + role-based pass). Run the smoke test after every deploy.
