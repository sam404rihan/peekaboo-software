# Toy Co. Management — User Guide

A retail management system for billing, inventory, customers, and reports.

---

## Roles

| Role | What they can access |
|------|----------------------|
| **Admin** | Everything — Dashboard, POS, Inventory, Invoices, Customers, Reports, Settings |
| **Cashier** | POS, Invoices, Customers only |

---

## Logging In

Open the app and sign in with your email and password. You will be taken straight to your panel (Admin Panel or Cashier Panel). The sidebar on the left is your main navigation.

---

## POS Terminal (Point of Sale)

> Path: **POS** in the sidebar, or click the red **New Sale** button at any time.

This is where you ring up a customer's purchase.

1. **Scan or search** a product — use a barcode scanner or type the product name / barcode in the search box.
2. Each item appears in the cart on the right with its MRP (selling price).
3. **Adjust quantity** using the + / − buttons next to each item.
4. **Apply a coupon** — enter a coupon code in the coupon field if the customer has one.
5. **Select or create a customer** — type the customer name or phone number. Creating them here adds them to the Customers list automatically.
6. **Choose payment method** — Cash, Card, UPI, or split between methods.
7. Click **Checkout** to complete the sale. A receipt is generated immediately.

> **Offline mode:** If the internet drops, the POS keeps working. Sales are queued and synced automatically when connectivity is restored. You will see an "Offline" indicator when this happens.

---

## Invoices

> Path: **Invoices**

A list of every sale ever made.

- **Search / filter** by invoice number, customer name, or date range.
- Click any invoice to see the full breakdown — items, taxes, payment method, and customer details.
- **Print receipt** — open an invoice and click the print icon to get a printable receipt.
- **Exchange / Return** — open an invoice and click **Exchange** to return items or swap them for other products. The system validates what can still be returned based on the original quantities.

---

## Customers

> Path: **Customers**

Tracks every customer who has made a purchase.

- **Search** by name or phone number.
- Click a customer to see their full purchase history and loyalty points balance.
- Loyalty points are earned automatically at checkout and can be redeemed on future purchases.

---

## Inventory (Admin only)

> Path: **Inventory**

Manage your product catalog and stock levels.

### Viewing products
The list shows every product with its current stock, MRP (selling price), and category.

### Adding a new product
1. Click **New Product**.
2. Fill in: Name, Category, Barcode (optional — one is generated if left blank), MRP, Rate (purchase price), and starting Stock.
3. Set the Tax Rate (e.g. 18% GST). If the product has a **Threshold Price**, the tax rate switches automatically between 5% and 18% depending on the selling price.
4. Click **Save**.

### Editing a product
Click any product row to open the edit form.

### Receiving stock (restocking)
> Path: **Settings → Receive Stock**

When new stock arrives:
1. Search for the product.
2. Enter the quantity received and the purchase rate.
3. Submit — stock is updated and an inventory log entry is created automatically.

---

## Reports (Admin only)

> Path: **Reports**

Four built-in report types:

| Report | What it shows |
|--------|---------------|
| **Sales** | Revenue, invoice count, and item breakdown by date range |
| **Stock** | Current stock levels and total inventory value |
| **Movement** | Every stock change (sales, restocking, returns, damage) |
| **Payments** | Totals by payment method (Cash / Card / UPI) |

Use the date pickers to filter each report. Most reports have an **Export** button that downloads the data as an Excel file.

### GST / Accounting Export
> Path: **Reports → Accounting Export**

Downloads a GST-compliant Excel file (GSTR-1 format) with B2B, B2CL, and HSN summary sheets — ready to hand to your accountant.

---

## Settings (Admin only)

> Path: **Settings**

| Section | Purpose |
|---------|---------|
| **Business Profile** | Store name, address, GSTIN, phone — printed on every receipt |
| **Receipt Template** | Customize the receipt header, footer message, and which fields are shown |
| **Categories** | Create and rename product categories |
| **Offers** | Create discount offers (flat, percentage, or BOGO) with optional customer targeting |
| **Coupons** | Create single-use or multi-use coupon codes with a fixed or percentage discount |
| **Barcodes** | Print barcode labels (50×25 mm) for any product |
| **Receive Stock** | Restock products (see Inventory section above) |
| **Inventory Logs** | Full audit trail of every stock change |
| **Audit Trail** | Log of all admin actions in the system |
| **Offline Queue** | View and manage any sales that are waiting to sync after an offline session |

---

## Offers & Coupons

### Offers (automatic discounts)
> Path: **Settings → Offers**

Offers apply automatically at checkout — no code needed.

- **Flat** — fixed rupee discount (e.g. ₹50 off)
- **Percentage** — e.g. 10% off
- **BOGO** — buy one get one free on the same item
- You can target an offer to customers whose birthday month matches the current month.
- Set a **Priority** if multiple offers could apply — higher priority wins.

### Coupons (code-based discounts)
> Path: **Settings → Coupons**

Create codes customers enter at the POS. Set an expiry date, usage limit, and discount value.

---

## Barcode Labels

> Path: **Settings → Barcodes**

1. Search for a product.
2. Choose how many labels to print.
3. A print-ready page opens — each label is 50×25 mm with the product name, MRP, and barcode.

---

## Frequently Asked Questions

**Q: Can I use the POS without internet?**
Yes. Scan and bill normally. Sales queue up locally and sync when you come back online.

**Q: Where do I change the GSTIN on receipts?**
Settings → Business Profile.

**Q: How do I give a customer a refund?**
Open the original invoice → click Exchange → select items to return → choose whether returned stock goes back to sellable inventory or is marked as damaged.

**Q: How are taxes calculated?**
All prices are MRP-inclusive (tax is already inside the price). The receipt breaks out the base price and GST separately for your records, but nothing extra is charged on top of MRP.

**Q: A sale is stuck in the offline queue. What do I do?**
Check your internet connection. If you are online and it is still stuck, go to Settings → Offline Queue to inspect or clear the pending operation.

---

## Quick Reference — Keyboard / Workflow Tips

- Press **New Sale** (red button, bottom of sidebar) from any screen to jump straight to the POS.
- On the POS, pressing **Enter** after typing in the search box selects the first result instantly — fast for keyboard-only workflows.
- Receipts can be shared via a link — open any invoice and copy the receipt preview URL to send to a customer.
