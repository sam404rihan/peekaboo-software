## Komfort POS – Launch Checklist and Roadmap

This file lists the final quick polishes to complete before build/launch, plus a roadmap of future additions that can follow without blocking go‑live.

---

## Final pre‑launch polish checklist

Essentials to complete and verify before shipping:

1) Firebase project configuration
- Fill `.env.local` with `NEXT_PUBLIC_FIREBASE_*` required by `lib/firebase.ts` (prod project).
- Verify app boots without “Firebase not initialized” warnings in the browser console.

2) Firestore security rules and indexes
- Deploy rules and composite indexes:
  - Firestore Rules: admin/cashier RBAC, validations, and new Exchanges/Refunds collections.
  - Composite Indexes: Invoices and InventoryLogs used by reports and listings.
- Validate read/write access from a Cashier user for POS/Receive only.

3) Business Profile & numbering
- Set business name, address, GSTIN, phone/email, logo URL, receipt footer in Settings.
- Configure invoice prefix and ensure sequence increments on every sale/exchange invoice.

4) Prints and hardware
- Print A4 and 80mm invoices from an actual invoice:
  - Check logo, address, GSTIN, totals, and date/time formatting.
- Label printing (A4 labels): verify sizing and scanability with your barcode scanner.
- Scanner config: HID keyboard mode with Enter/Tab suffix; test on POS and Receive pages.

5) Offline resilience (quick flight)
- Go offline →
  - POS: scan from cached catalog and perform checkout (should queue).
  - Receive: scan and “Post Receipt” (should queue).
  - Exchange: return + new items (should queue).
- Reconnect → queued items should sync exactly once; stock and logs must reconcile.
  - Note: catalog cache warms when POS loads online once. Open Dashboard/POS online before attempting offline scans.

6) PWA polish
- Service worker is registered; add app icons (192/512) to make it installable.
- Link the manifest if not yet linked (via `app/manifest.ts` or metadata `manifest` in `app/layout.tsx`).
- Optional: pin a SW version bump (`CACHE_VERSION` in `public/sw.js`) for controlled updates.

7) QA and reports
- Run through Testing.md items (sales, payments, stock, movement, accounting CSV).
- Spot‑check Inventory Logs for sale/receive/return/exchange/defect paths.

8) Data hygiene & backups
- Export Products and Settings to CSV/JSON as a seed backup before launch.
- Confirm currency symbol (₹) and number formats across the app.

9) Build & deploy (summary)
- Install dependencies and build, then deploy hosting + Firestore config.
- Verify envs and public URLs (logo, manifest) resolve over HTTPS.

---

## Optional pre‑launch niceties (non‑blocking)

- Idempotency guard: write a dedicated `Ops/{opId}` document inside the same transaction for checkout/exchange to make replays strictly duplicate‑proof.
- Queue screen: minimal UI to view/retry/remove failed offline ops.
- Auth‑aware queue start: wait for Firebase Auth ready before running `processQueue()`; show a paused state if not signed in.
- PWA icons and theme meta: add platform icons and verify install banner.
- Basic monitoring: Sentry or error toast bundling for unexpected failures.

---

## Post‑launch roadmap (future additions)

Operations & Inventory
- Shift open/close with Z‑report (cash expected vs counted, refunds, net).
- Stocktake / cycle counts with variance posting (reason=stocktake), CSV import/export.
- Purchase Orders: Suppliers, PO→partial/complete receive into Goods Receipts.
- Multi‑store readiness: store/location field, per‑store stock and reports.

Compliance (India)
- GST split (CGST/SGST vs IGST) based on place of supply.
- HSN summary on invoices and a GSTR‑1/returns‑friendly export.
- Rounding and invoice footer compliance notes.

Sales, Offers, Loyalty
- Loyalty redemption rules (points→discount), configurable earn/redeem rates and caps.
- Offers engine enhancements: cross‑SKU BOGO, stacking/priority policies, event‑based promos.
- Customer comms: birthday/event nudges; export segments.

Printing & UX
- Dedicated 4" label printer mode (CSS @page, density tuning, print dialog presets) beyond A4 PDF.
- Email/PDF invoice delivery; WhatsApp share link.
- Accessibility polish (focus order, ARIA landmarks) and keyboard shortcuts help.

Resilience & DX
- Workbox/next‑pwa strategies (stale‑while‑revalidate for static, background sync for queue).
- Firestore offline persistence (if desired) in addition to the explicit queue.
- Dead‑letter queue with thresholds and audit trail for ops.
- Telemetry & logs: Sentry, performance marks, Cloud logs.

Data & Integrations
- Bulk import/export for Products/Customers (CSV; XLSX optional later), with validation preview.
- Payment integrations (UPI intent, card gateways) for reference capture automation.
- Accounting integrations (Tally/Zoho) via CSV/Bridge API.

---

## Build & deploy quick start

1) Install and build

```powershell
npm install
npm run build
```

2) Deploy config (example)
- Firestore rules/indexes:
```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

3) Host the app (Vercel/Cloud Run/Firebase Hosting). Ensure `.env` is present in the runtime environment.

---

Questions or changes? Open an issue with the checklist item and desired outcome; we’ll scope it as a polish or a roadmap feature.


## Tech Support in the Due course of one month
2. Offer creation flow perfection
3. Exchange flow is made more robust. And if return needed is added.
4. Tax inclusion flow to be perfected.
5. Receipt template to be made much beautiful and clear. Discounts for now keep it Bill discount only. Review link, logo etc to be added.
6. Reporting to be made much better.
8. Make sure all buttons have success/error toasts. Converting POS local to use the Global toast provider for consistency. May add few more info toasts in Settings list pages to get extra feedback.


### NEXT 
---

## Development tips (Windows)

If you see intermittent ENOENT errors like:

```
ENOENT: no such file or directory, open '.next\\static\\development\\_buildManifest.js.tmp.*'
```

This is a known race on some Windows setups when the dev server writes temp files (antivirus/FS latency). We’ve disabled Turbopack by default and enabled Webpack polling to stabilize hot reloads.

Try this:

1) Start dev (Webpack):

```powershell
npm run dev
```

2) If it still occurs, clear cache and restart:

```powershell
npm run clean
npm run dev
```

3) Optional: try Turbopack (faster but can trigger the issue):

```powershell
npm run dev:turbo
```

We also set watch polling in `next.config.ts` to reduce race conditions on Windows.

---

## Deploy to Vercel (Production)

Follow these steps to deploy this app to your own domain on Vercel.

### 0) Prerequisites
- Vercel account (Owner/Maintainer on the target team/project)
- GitHub repository connected (this repo)
- Firebase project for production
- Node 20.x on Vercel (Project → Settings → Node.js Version = 20)

### 1) Firebase setup (production)
- Firebase Console → Authentication → Settings → Authorized domains → add your production domain(s).
- Ensure Firestore rules and composite indexes are in place (use the existing rules/indexes from this repo or create via console when prompted).

### 2) Environment variables on Vercel
Project → Settings → Environment Variables → Add (Environment: Production; optionally also Preview)

Required (copy from your local `.env.local`):
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Tip: never commit `.env.local`. Paste values directly in Vercel.

### 3) Build settings (Vercel)
- Framework Preset: Next.js (auto-detected)
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `.next` (default)
- Node.js Version: `20.x`

### 4) Make print pages dynamic and uncached
These routes should never be cached, and should not be indexed by search engines.

- In `app/invoices/receipt/[id]/page.tsx` and
  `app/settings/barcodes/print/[productId]/[labels]/page.tsx` add:
  - `export const dynamic = "force-dynamic"`

- In `next.config.ts`, add headers for these paths:
  - `Cache-Control: no-store`
  - `X-Robots-Tag: noindex, nofollow`

(These guards ensure receipt/label pages always render fresh data and don’t leak into SEO.)

### 5) Local production sanity check (optional but recommended)

```powershell
npm ci
npm run build
npm run start
```

Open http://localhost:3000 and run the Smoke Test in `Testing.md`.

### 6) Deploy via Vercel dashboard
- Vercel → New Project → Import this GitHub repo.
- Confirm Environment Variables and Build Settings (steps 2–3).
- Deploy and wait for status “Ready”.

### 7) Attach your custom domain
- Project → Settings → Domains → Add.
- If using external DNS:
  - Apex: A → `76.76.21.21`
  - `www`: CNAME → `cname.vercel-dns.com`
- Force HTTPS (default) and set preferred redirect (www → apex or apex → www).
- Add the new domain to Firebase Auth → Authorized domains.

### 8) Post‑deploy verification
- Auth works (no "domain not authorized" errors)
- POS: sample sale → receipt tab opens → confirm → tab auto‑closes
- Barcodes: Settings → Barcodes → Print Labels → only the label prints (2"×1"); confirm → stock increases; audit trail entry present
- Invoices: filter by cashier email works; totals match receipt

### 9) Printer settings (once per device)
- In the browser print dialog for labels:
  - Paper size: 2"×1" (50.8×25.4 mm) or your exact label stock
  - Margins: None; Scale: 100%
  - Headers and footers: OFF (removes URL/date/title)
- Allow pop‑ups for your domain (receipt/label tabs auto‑close).

### Troubleshooting
- Blank/empty print preview → Allow pop‑ups; ensure we wait for barcode render (built‑in) and pick the correct label paper size
- Stale receipt/label → Verify `dynamic = "force-dynamic"` and `Cache-Control: no-store` headers
- Auth fails in prod → Add your domain to Firebase Auth; confirm Vercel env vars
- Missing Firestore indexes → Create suggested indexes from the Firestore error prompt

### Optional: Vercel CLI

```powershell
npm i -g vercel
vercel login
vercel --prod
```
