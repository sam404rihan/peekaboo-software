# Komfort POS – Smoke Test and Role-based Testing Brief

Use this guide to validate the full workflow quickly (Smoke Test) and then thoroughly (role-based feature-wise). It reflects the latest flows: 80mm receipt printing, direct barcode label printing (50×25 mm, 1 barcode per label), transactional stock rules, and the Audit Trail.

---

## Smoke Test (≈10 minutes)

Run this fast gate after each deploy. If any item fails, stop and fix before deeper testing.

Cashier (≈6 minutes)
- [ ] Sign in as Cashier (only POS and Invoices visible)
- [ ] POS quick sale: add one in‑stock product → Cash payment
	- Expect: Invoice created; stock decremented; no errors
- [ ] Oversell guard: add a low‑stock product and try qty > available
	- Expect: Qty caps with toast; checkout blocked if any line exceeds stock
- [ ] Receipt: open the invoice → Print Receipt
	- Expect: 80mm layout; branding correct; auto print dialog

Admin (≈4 minutes)
- [ ] Sign in as Admin (Settings/Reports/Offers/Barcodes visible)
- [ ] Receipt Template: tweak 80mm options (GST line, footer) → print any invoice again
	- Expect: Receipt reflects settings
- [ ] Barcode print: Settings → Barcodes → choose a product, set labels=2 → Print Labels
	- Expect: Opens in a new tab; only labels are printed (page is 50×25 mm per label), 1 barcode per label, horizontal; after print, the app asks “Did the labels print successfully?” and auto‑closes the tab
	- If Yes: stock +2 (labels); Printed count +2; Audit Trail entry (type=purchase, reason=receive, note=barcode-print)
	- If No: no stock/printed count change; returns to Settings

---

## Prerequisites

- [ ] Users: Cashier (role=cashier) and Admin (role=admin)
- [ ] Seed products:
	- [ ] A: tax 0%, stock 10
	- [ ] B: tax 5%, stock 4 (use for oversell tests)
	- [ ] C: tax 12%, stock 0 (out-of-stock test)
- [ ] Printers/PDF: 80mm thermal, and standard printer for label (105×70 mm page)
- [ ] Settings complete: Business profile; Receipt Template (80mm), review link optional

---

## Cashier Pass (single login)

### 1) Auth & RBAC
- [1] Login as Cashier
- [1] Sees POS and Invoices only; cannot access Settings/Reports/Offers
- [1] Direct URLs to admin pages are blocked

### 2) POS – cart, discounts, totals
- [1] Add A twice (merge to qty=2)
- [1] Add B once
- [1] Line discount on A: ₹ amount (no negative totals)
- [1] Change line discount on A to % (no negative totals)
- [1] Bill-level discount: ₹, then % (separately)
- [1] Totals reflect line + bill discounts correctly

Edge checks
- [1] Zero/negative discounts are blocked or corrected
- [ ] Long product names don’t break layout

### 3) Stock guardrails (no oversell)
- [1] For B (stock 4), try qty 5 via + button (blocked, toast “Only 4 in stock”)
- [1] For B, try qty 5 via rescans (blocked)
- [1] For B, enter 9999 manually (clamped with toast)
- [1] Add C (stock 0): blocked with “out of stock” toast
- [1] Attempt checkout while any line exceeds stock: blocked with “insufficient stock”

### 4) GST & totals
- [1] Buy A (0%) + B (5%), apply line and bill discounts
- [0] Tax equals sum of per‑line taxes after discounts
- [0] Grand total = subtotal − discounts + tax (rounded 2 decimals)

### 5) Customer capture & loyalty (if used)
- [1] Enter phone for new customer; set name
- [1] Complete checkout: customer created and linked
- [1] Make another purchase with same phone: customer found and linked
- [1] Loyalty points and totalSpend updated

Edge checks
- [1] Missing name for new customer blocks checkout
- [1] Bad phone format handled

### 6) Checkout & idempotency
- [1] Complete a cash sale (success)
- [1] Double‑click Complete Sale rapidly (only one invoice is created)
- [ ] Inventory decreases once; InventoryLogs shows one set of sale logs

### 7) Invoices & receipt printing (80mm only)
- [1] Open the recent invoice
- [1] Click Print Receipt (branding, math correct)
- [1] Auto‑print dialog opens; GST line and footer reflect Receipt Template settings
 - [1] Filter by cashier email (not UID) lists invoices for that cashier

### 8) Exchanges (if enabled)
- [1] Return B qty=1 (non‑defect) → confirm → stock +1; InventoryLogs type=return
- [1] Second exchange: return only remaining allowable qty (enforced)
- [1] Mark return as defect → stock shouldn’t increase; damage/defect logged
- [ ] Add A as new item (respects stock); movement logged with reason=exchange
- [1] Money handling: if difference > 0 → pay; if < 0 → refund record

Edge checks
- [ ] Attempt return beyond remaining qty → blocked
- [ ] Attempt adding new item beyond stock → blocked
- [ ] Exchange beyond 7 days → blocked
- [ ] Attempt returning product not in original invoice → blocked

### 9) Offline queue (optional)
- [1] Go Offline → attempt checkout (op queued)
- [1] Go Online → queue processes; exactly one invoice created
- [1] If stock changed while offline, op fails with “insufficient stock” and remains for review

---

## Admin Pass (single login)

### 1) Auth & RBAC
- [1] Login as Admin
- [1] Sees Settings, Reports, Offers, Barcodes
- [1] Admin‑only pages remain blocked for Cashier

### 2) Receipt Template (80mm)
- [1] Update business profile (logo, address, GSTIN, footer)
- [1] Toggle GST line, review link
- [1] Print any invoice → changes reflect on receipt

### 3) Barcode generation and direct print (stock addition)
- [ ] Settings → Barcodes → select product B → set Labels = 5 → Print Labels
- [ ] Print page opens 50×25 mm; one barcode per label (2×1 inch target), horizontal
- [ ] After closing print dialog: product stock increases by labels (e.g., +5)
- [ ] Printed count increases by total barcodes printed (labels)
- [ ] Audit Trail entry exists for this operation: type=purchase, reason=receive, note=barcode-print, userId=admin uid

### 4) Categories & Products
- [ ] Create category (name, code) and ensure it appears in barcode encoding
- [ ] Create product, edit price/tax/category; verify in POS and label print

### 5) Reports
- [ ] Sales and Stock/Movement reflect invoices and InventoryLogs; no index errors

### 6) Audit Trail
- [ ] Settings → Audit Trail shows:
	- [ ] Sales (negative qty, type=sale, reason=sale) with invoice references
	- [ ] Returns (positive qty, type=return) and exchange adjustments
	- [ ] Barcode printing additions (positive qty, type=purchase, reason=receive, note=barcode-print)
- [ ] Filter by date, user, type, product, reason (exact)

### 7) Inventory Logs (detailed)
- [ ] Open Settings → Inventory Logs
- [ ] Verify deltas, reasons, references match recent actions

---

## Cross‑cutting Integrity Checks

- [ ] No negative inventory at any time
- [ ] POS caps quantities client‑side; backend validates stock atomically (POS & exchanges)
- [ ] Barcode print always adds labels to stock; one audit entry per print
- [ ] Remaining returnable qty enforced across multi‑exchange scenarios
- [ ] Defect returns don’t increase sellable stock (damage logged)
- [ ] Totals math: subtotal − discounts + tax = grand total (2‑decimal rounding)
- [ ] Idempotency: double‑clicks or offline replays create at most one invoice/exchange
- [ ] Concurrency: two sessions racing for last unit → one succeeds; the other fails cleanly without negative stock

---

## Fast Exit Criteria

- [ ] Cashier: cannot oversell; prints correct 80mm receipt; exchanges behave; offline queue safe
- [ ] Admin: can set branding, print labels (50×25 mm, 1 barcode/label), sees audit entries, and data reconciles across Reports/Logs

## FIXES

---

## Tax‑inclusive MRP flow – Test Brief

Goal: Verify that product prices are tax‑inclusive (MRP). POS charges MRP directly without adding tax. Receipts split MRP into Base (ex‑tax) and GST, and apply discounts after tax.

Formulas
- Given unit MRP P and tax rate r% (r = taxPct/100):
  - Base (ex‑tax) = P / (1 + r)
  - GST = P − Base
  - Line Net (before bill discount) = (P × qty) − lineDiscount
  - Grand Total = sum(Line Net) − billDiscount
  - Discounts are post‑tax and do NOT change GST; GST is derived from MRP only.

Setup
1) Create two products:
	- A: MRP=₹330, tax=5%
	- B: MRP=₹200, tax=12%
2) Ensure both have stock ≥ 5 and are active.

Happy path – single item (no discounts)
1) POS: add A ×1
2) Expect POS Grand Total = ₹330.00 (no tax added).
3) Complete Sale; open receipt.
4) Receipt totals:
	- Base (ex‑tax) ≈ ₹314.29
	- GST ≈ ₹15.71
	- Discounts = ₹0.00
	- Total = ₹330.00

Line discount
1) POS: add A ×1; set line discount ₹20; no bill discount.
2) Expect POS Grand Total = 330 − 20 = ₹310.00.
3) Receipt totals:
	- Base ≈ ₹314.29; GST ≈ ₹15.71 (unchanged by discount)
	- Discounts = ₹20.00
	- Total = ₹310.00

Bill discount
1) POS: add A ×1; no line discounts; set bill discount ₹10.
2) Expect POS Grand Total = 330 − 10 = ₹320.00.
3) Receipt totals:
	- Base ≈ ₹314.29; GST ≈ ₹15.71
	- Discounts = ₹10.00
	- Total = ₹320.00

Combined discounts
1) POS: add A ×1; line discount ₹20; bill discount ₹10.
2) Expect POS Grand Total = 330 − 20 − 10 = ₹300.00.
3) Receipt totals:
	- Base ≈ ₹314.29; GST ≈ ₹15.71
	- Discounts = ₹30.00
	- Total = ₹300.00

Multiple items, mixed tax
1) POS: add A ×2 and B ×1; no discounts.
2) POS Grand Total = 2×330 + 200 = ₹860.00.
3) Receipt totals:
	- Base ≈ (2× 330/1.05) + (200/1.12) ≈ ₹(2×314.29) + 178.57 ≈ ₹807.15
	- GST ≈ 860 − 807.15 ≈ ₹52.85 (or sum of per‑item GST: 2×15.71 + 21.43)
	- Discounts = ₹0.00
	- Total = ₹860.00

Rounding expectations
- Totals are rounded to 2 decimals after summation; Base and GST on the receipt may differ by ±₹0.01 from manual per‑unit rounding.

Exchange/Returns
1) Create an invoice with A ×2, bill discount ₹20 (no line discounts).
2) Start exchange: return A ×1 (non‑defect), add B ×1 as new.
3) Expect return credit equals original net paid per unit for A (MRP minus proportional share of bill discount).
4) New invoice for B uses its MRP for charges; receipt shows Base/GST derived from MRP.
5) Difference drives pay/refund; no tax added separately.

Edge cases
- Zero tax product: Base = MRP, GST = 0; discounts still post‑tax.
- Missing taxRatePct treated as 0%.
- Large bill discount cannot exceed subtotal (guarded). If attempted, expect validation error.
- POS must never display a separate tax line or increase total by tax; totals are MRP − discounts only.

Quick audit points
- POS Grand Total matches receipt Total for all scenarios above.
- Receipt shows Base (ex‑tax), GST (from MRP), Discounts (line + bill), and Total.
- Reports → Accounting CSV: GST column equals sum of MRP‑derived GST; discounts are listed separately and do not reduce GST.