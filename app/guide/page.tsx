"use client";
import Link from "next/link";
import { useState, useMemo } from "react";

function MSIcon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

/* Single accent style for inline code/action names */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <code className="inline bg-slate-100 text-slate-700 text-[12px] font-semibold px-1.5 py-0.5 rounded">
      {children}
    </code>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 my-3">
      {children}
    </p>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-slate-700">
      <span className="text-[#b7102a] font-bold shrink-0 w-4 text-right">{n}.</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

function GoLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[#b7102a] text-sm font-medium hover:underline underline-offset-2">
      {children} <MSIcon name="arrow_forward" className="text-[14px]" />
    </Link>
  );
}

function SectionHeader({ icon, title, adminOnly }: { icon: string; title: string; adminOnly?: boolean }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="w-9 h-9 rounded-lg bg-[#fff0f2] flex items-center justify-center shrink-0">
        <MSIcon name={icon} className="text-[20px] text-[#b7102a]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[17px] font-extrabold text-slate-900 tracking-tight leading-none">{title}</h2>
          {adminOnly && (
            <span className="text-[10px] font-bold bg-slate-100 text-slate-400 px-2 py-0.5 rounded uppercase tracking-wide shrink-0">
              Admin only
            </span>
          )}
        </div>
        <div className="mt-2 h-px bg-slate-200 w-full" />
      </div>
    </div>
  );
}

const SECTIONS = [
  { id: "roles",     icon: "manage_accounts", title: "Roles & Access",      keywords: "admin cashier role access permissions login" },
  { id: "pos",       icon: "point_of_sale",   title: "POS / New Sale",       keywords: "pos checkout billing scan barcode cart coupon payment offline" },
  { id: "invoices",  icon: "receipt_long",    title: "Invoices",             keywords: "invoice receipt print return exchange refund history" },
  { id: "customers", icon: "group",           title: "Customers",            keywords: "customer loyalty points phone history search" },
  { id: "inventory", icon: "inventory_2",     title: "Inventory",            keywords: "inventory product stock add new category barcode threshold price gst" },
  { id: "reports",   icon: "bar_chart",       title: "Reports",              keywords: "reports sales stock movement payments gst accounting export excel" },
  { id: "offers",    icon: "local_offer",     title: "Offers & Coupons",     keywords: "offer coupon discount flat percentage bogo birthday priority code" },
  { id: "settings",  icon: "settings",        title: "Settings",             keywords: "settings business profile gstin receipt template categories barcodes inventory logs audit offline queue" },
  { id: "tax",       icon: "receipt",         title: "Tax & GST",            keywords: "tax gst mrp inclusive base price split receipt" },
  { id: "faq",       icon: "help",            title: "FAQ",                  keywords: "faq internet offline stuck queue refund user role gstin barcode" },
];

export default function GuidePage() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return SECTIONS;
    return SECTIONS.filter((s) => s.title.toLowerCase().includes(q) || s.keywords.includes(q));
  }, [query]);

  const show = (id: string) => !query || filtered.some((s) => s.id === id);

  return (
    <div className="flex">

      {/* Guide-specific sidebar — fixed, like the app sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-56 flex-col bg-white border-r border-slate-100 pt-24 pb-8 px-4 overflow-y-auto">
        <Link href="/dashboard" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-6 transition-colors px-2">
          <MSIcon name="arrow_back" className="text-[13px]" /> Back to Dashboard
        </Link>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 px-2">In this guide</p>
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12.5px] text-slate-500 hover:text-[#b7102a] hover:bg-slate-50 transition-colors"
            >
              <MSIcon name={s.icon} className="text-[14px] shrink-0 text-slate-400" />
              {s.title}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main content — offset by sidebar width */}
      <main className="flex-1 lg:ml-56 min-w-0 pb-16 space-y-12 max-w-3xl px-2 lg:px-8">

        {/* Header + search */}
        <div>
          {/* Back link — mobile only (sidebar handles desktop) */}
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 mb-4 lg:hidden">
            <MSIcon name="arrow_back" className="text-[15px]" /> Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold text-slate-900 mb-1">User Guide</h1>
          <p className="text-sm text-slate-500 mb-4">Step-by-step instructions for every feature in Toy Co. Management.</p>
          <div className="relative max-w-xs">
            <MSIcon name="search" className="text-[17px] absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search the guide…"
              className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-red-300 focus:border-red-300 bg-white"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <MSIcon name="close" className="text-[15px]" />
              </button>
            )}
          </div>
          {query && (
            <p className="text-xs text-slate-400 mt-1.5">
              {filtered.length === 0 ? "No results" : `${filtered.length} section${filtered.length !== 1 ? "s" : ""} found`}
            </p>
          )}
        </div>

        {/* ROLES */}
        {show("roles") && (
          <section id="roles" className="scroll-mt-24">
            <SectionHeader icon="manage_accounts" title="Roles & Access" />
            <p className="text-sm text-slate-600 mb-4">Every account has one of two roles. Your role decides what you can see in the sidebar.</p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2.5 pr-6 font-semibold text-slate-800">Admin</td>
                  <td className="py-2.5 text-slate-600">Dashboard, POS, Inventory, Invoices, Customers, Reports, Settings — everything.</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-6 font-semibold text-slate-800">Cashier</td>
                  <td className="py-2.5 text-slate-600">POS, Invoices, and Customers only. Reports and Settings are hidden.</td>
                </tr>
              </tbody>
            </table>
            <Note>If a menu item is missing, it is hidden for your role — ask your admin if you need access.</Note>
          </section>
        )}

        {/* POS */}
        {show("pos") && (
          <section id="pos" className="scroll-mt-24">
            <SectionHeader icon="point_of_sale" title="POS Terminal — Making a Sale" />
            <p className="text-sm text-slate-600 mb-1">
              Click the red <Tag>New Sale</Tag> button at the bottom of the sidebar, or go to <Tag>POS</Tag> in the menu.
              &nbsp;<GoLink href="/pos">Open POS</GoLink>
            </p>

            {/* Simple step flow */}
            <div className="my-4 border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Checkout steps</p>
              </div>
              <div className="flex items-center px-4 py-3 gap-0 overflow-x-auto">
                {["Scan / Search", "Add to Cart", "Select Customer", "Coupon (opt.)", "Payment", "Checkout"].map((label, i, arr) => (
                  <div key={i} className="flex items-center gap-0 shrink-0">
                    <div className="flex flex-col items-center gap-1">
                      <span className="w-6 h-6 rounded-full bg-[#b7102a] text-white text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="text-[11px] text-slate-600 font-medium text-center leading-tight" style={{ maxWidth: 64 }}>{label}</span>
                    </div>
                    {i < arr.length - 1 && <span className="text-slate-300 mx-2 mb-3 text-sm">→</span>}
                  </div>
                ))}
              </div>
            </div>

            <ol className="space-y-2.5">
              <Step n={1}><strong>Scan or search</strong> — use a barcode scanner or type the product name. Press Enter to add the first result.</Step>
              <Step n={2}><strong>Adjust quantity</strong> — use the <Tag>+</Tag> and <Tag>−</Tag> buttons next to each item in the cart.</Step>
              <Step n={3}><strong>Select a customer</strong> — type name or phone number. New customers are saved automatically.</Step>
              <Step n={4}><strong>Apply a coupon</strong> (optional) — type the code in the coupon field. Automatic offers apply without any code.</Step>
              <Step n={5}><strong>Choose payment method</strong> — Cash, Card, UPI, or split between them.</Step>
              <Step n={6}><strong>Click Checkout</strong> — the invoice is created and the receipt appears.</Step>
            </ol>

            <Note>
              <strong>Offline mode:</strong> If the internet drops, the POS keeps working. Sales are saved locally and sync automatically when connectivity returns. An Offline badge appears at the top when active.{" "}
              <GoLink href="/settings/offline-queue">View offline queue</GoLink>
            </Note>
          </section>
        )}

        {/* INVOICES */}
        {show("invoices") && (
          <section id="invoices" className="scroll-mt-24">
            <SectionHeader icon="receipt_long" title="Invoices" />
            <p className="text-sm text-slate-600 mb-4">
              Every completed sale is stored here. <GoLink href="/invoices">Open Invoices</GoLink>
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wide w-40">Task</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">How</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                <tr>
                  <td className="py-2.5 pr-6 font-medium text-slate-800">Find an invoice</td>
                  <td className="py-2.5">Search by invoice number, customer name, or date range at the top of the list.</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-6 font-medium text-slate-800">Print receipt</td>
                  <td className="py-2.5">Open the invoice → click the print icon. You can also copy the receipt link to share with the customer.</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-6 font-medium text-slate-800">Return items</td>
                  <td className="py-2.5">Open the invoice → click <Tag>Exchange</Tag> → select items to return → mark as sellable (back to stock) or damaged.</td>
                </tr>
                <tr>
                  <td className="py-2.5 pr-6 font-medium text-slate-800">Add new items to a return</td>
                  <td className="py-2.5">During exchange, you can add new products. A new invoice is created for the difference.</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        {/* CUSTOMERS */}
        {show("customers") && (
          <section id="customers" className="scroll-mt-24">
            <SectionHeader icon="group" title="Customers" />
            <p className="text-sm text-slate-600 mb-3">
              Every customer who has made a purchase is listed here. <GoLink href="/customers">Open Customers</GoLink>
            </p>
            <ul className="space-y-2 text-sm text-slate-600 list-none">
              <li className="flex gap-2">— Search by <Tag>name</Tag> or <Tag>phone number</Tag>.</li>
              <li className="flex gap-2">— Click a customer to see their full purchase history and current loyalty points balance.</li>
              <li className="flex gap-2">— Loyalty points are earned automatically at checkout and can be redeemed on future purchases.</li>
            </ul>
          </section>
        )}

        {/* INVENTORY */}
        {show("inventory") && (
          <section id="inventory" className="scroll-mt-24">
            <SectionHeader icon="inventory_2" title="Inventory" adminOnly />
            <p className="text-sm text-slate-600 mb-4">
              Manage your product catalog and stock levels. <GoLink href="/products">Open Inventory</GoLink>
            </p>

            <h3 className="text-[13px] font-bold text-slate-700 mb-2 mt-1 flex items-center gap-2"><span className="w-0.5 h-4 bg-[#b7102a] rounded-full shrink-0" />Adding a new product</h3>
            <ol className="space-y-2 mb-4">
              <Step n={1}>Click <Tag>New Product</Tag> in the top-right corner of the Inventory page.</Step>
              <Step n={2}>Fill in the name, category, barcode (auto-generated if left blank), MRP (selling price to customers), Rate (your purchase cost), and starting stock quantity.</Step>
              <Step n={3}>Set the tax rate — usually 18% GST. If this product has variable GST, enter a Threshold Price (see below).</Step>
              <Step n={4}>Click <Tag>Save</Tag>.</Step>
            </ol>

            <Note>
              <strong>Threshold Price:</strong> When set, GST switches automatically — selling price below threshold uses 5% GST, at or above uses 18% GST. Useful for slab-rated items like footwear.
            </Note>

            <h3 className="text-[13px] font-bold text-slate-700 mb-2 mt-5 flex items-center gap-2"><span className="w-0.5 h-4 bg-[#b7102a] rounded-full shrink-0" />Restocking — receiving new stock</h3>
            <p className="text-sm text-slate-600 mb-2">
              Go to <GoLink href="/settings/receive">Settings → Receive Stock</GoLink>, enter the quantity received and purchase rate, then submit. Stock updates immediately and an inventory log entry is written automatically.
            </p>

            <div className="border border-slate-200 rounded-lg p-4 mt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">How stock changes — all updates are logged</p>
              <table className="w-full text-sm border-collapse">
                <tbody className="divide-y divide-slate-100">
                  {[
                    ["Sale (POS)",    "−qty",              "Decremented on every checkout"],
                    ["Receive Stock", "+qty",              "Incremented when new stock is entered"],
                    ["Return",        "+qty (if sellable)","Added back only if marked as sellable"],
                    ["Damage",        "−qty",              "Written off, logged as damage"],
                  ].map(([action, delta, note]) => (
                    <tr key={action}>
                      <td className="py-2 pr-4 font-medium text-slate-800">{action}</td>
                      <td className="py-2 pr-4 font-mono text-[12px] text-[#b7102a]">{delta}</td>
                      <td className="py-2 text-slate-500">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* REPORTS */}
        {show("reports") && (
          <section id="reports" className="scroll-mt-24">
            <SectionHeader icon="bar_chart" title="Reports" adminOnly />
            <p className="text-sm text-slate-600 mb-4">
              Use the date pickers on each report to filter by range. Most reports have an Export button that downloads an Excel file.{" "}
              <GoLink href="/reports">Open Reports</GoLink>
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wide">Report</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">What it shows</th>
                  <th className="text-left py-2 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {[
                  ["Sales",       "Revenue, invoice count, and item-level breakdown",              "/reports/sales"],
                  ["Stock",       "Current stock levels and total inventory value",                "/reports/stock"],
                  ["Movement",    "Every stock change — sales, restocking, returns, damage",       "/reports/movement"],
                  ["Payments",    "Totals split by Cash, Card, and UPI",                          "/reports/payments"],
                  ["GST Export",  "GSTR-1 Excel file — B2B, B2CL, HSN summary (for accountant)", "/reports/accounting-export"],
                ].map(([name, desc, href]) => (
                  <tr key={name}>
                    <td className="py-2.5 pr-6 font-medium text-slate-800 whitespace-nowrap">{name}</td>
                    <td className="py-2.5 text-slate-600">{desc}</td>
                    <td className="py-2.5 pl-4 whitespace-nowrap">
                      <GoLink href={href}>Open</GoLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* OFFERS */}
        {show("offers") && (
          <section id="offers" className="scroll-mt-24">
            <SectionHeader icon="local_offer" title="Offers & Coupons" adminOnly />

            <p className="text-sm text-slate-600 mb-4">
              There are two ways to give discounts. Use <strong>Offers</strong> when you want discounts to apply automatically, or <strong>Coupons</strong> when the customer needs to enter a code.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="border border-slate-200 rounded-lg p-4">
                <p className="font-semibold text-slate-800 text-sm mb-1">Offers — automatic</p>
                <p className="text-sm text-slate-500 mb-3">No code needed. Apply to everyone or target by birthday month.</p>
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100">
                    {[
                      ["Flat",       "Fixed rupee discount, e.g. ₹50 off"],
                      ["Percentage", "e.g. 10% off cart total"],
                      ["BOGO",       "Buy one get one free (same item)"],
                      ["Birthday",   "Active in customer's birthday month"],
                    ].map(([t, d]) => (
                      <tr key={t}>
                        <td className="py-1.5 pr-3 font-medium text-slate-700 text-[12.5px]">{t}</td>
                        <td className="py-1.5 text-slate-500 text-[12px]">{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3"><GoLink href="/settings/offers">Manage Offers</GoLink></div>
              </div>

              <div className="border border-slate-200 rounded-lg p-4">
                <p className="font-semibold text-slate-800 text-sm mb-1">Coupons — code-based</p>
                <p className="text-sm text-slate-500 mb-3">Customer enters a code at the POS coupon field to redeem.</p>
                <ul className="space-y-1.5 text-sm text-slate-500">
                  <li>— Flat or percentage discount</li>
                  <li>— Set an expiry date</li>
                  <li>— Limit total uses (or leave unlimited)</li>
                </ul>
                <div className="mt-3"><GoLink href="/settings/coupons">Manage Coupons</GoLink></div>
              </div>
            </div>

            <Note>If multiple offers apply to the same cart, set a <Tag>Priority</Tag> number on each — the highest priority offer wins.</Note>
          </section>
        )}

        {/* SETTINGS */}
        {show("settings") && (
          <section id="settings" className="scroll-mt-24">
            <SectionHeader icon="settings" title="Settings" adminOnly />
            <p className="text-sm text-slate-600 mb-4">
              <GoLink href="/settings">Open Settings</GoLink>
            </p>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wide w-44">Section</th>
                  <th className="text-left py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">What you can do</th>
                  <th className="text-left py-2 pl-4 text-xs font-semibold text-slate-500 uppercase tracking-wide">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {[
                  ["Business Profile",  "Store name, address, GSTIN, phone — appears on every receipt",        "/settings/business-profile"],
                  ["Receipt Template",  "Customize the receipt header, footer text, and which fields show",    "/settings/receipt-template"],
                  ["Categories",        "Create and rename product categories",                                "/settings/categories"],
                  ["Receive Stock",     "Add received stock — enter quantity and purchase rate",               "/settings/receive"],
                  ["Barcodes",          "Print 50×25 mm barcode shelf labels for any product",                "/settings/barcodes"],
                  ["Offers",            "Create automatic discount rules",                                     "/settings/offers"],
                  ["Coupons",           "Create code-based discounts with expiry and usage limits",            "/settings/coupons"],
                  ["Inventory Logs",    "Audit trail of every stock movement",                                 "/settings/inventory-logs"],
                  ["Audit Trail",       "Log of all admin actions in the system",                              "/settings/audit-trail"],
                  ["Offline Queue",     "View or clear sales waiting to sync after an offline session",        "/settings/offline-queue"],
                ].map(([name, desc, href]) => (
                  <tr key={name}>
                    <td className="py-2.5 pr-6 font-medium text-slate-800 whitespace-nowrap">{name}</td>
                    <td className="py-2.5 text-slate-600">{desc}</td>
                    <td className="py-2.5 pl-4 whitespace-nowrap"><GoLink href={href}>Open</GoLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* TAX */}
        {show("tax") && (
          <section id="tax" className="scroll-mt-24">
            <SectionHeader icon="receipt" title="Tax & GST" />
            <p className="text-sm text-slate-600 mb-3">
              All prices in this system are <strong>MRP-inclusive</strong> — the tax is already inside the price. You never add tax on top at checkout.
            </p>
            <div className="border border-slate-200 rounded-lg p-4 mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">How a receipt shows the tax split (18% GST example)</p>
              <div className="flex items-center gap-3 text-sm">
                <div className="text-center">
                  <div className="font-bold text-slate-800 text-base">₹118</div>
                  <div className="text-slate-500 text-xs">MRP charged</div>
                </div>
                <span className="text-slate-300">=</span>
                <div className="text-center">
                  <div className="font-bold text-slate-800">₹100</div>
                  <div className="text-slate-500 text-xs">Base price</div>
                  <div className="text-slate-400 text-[10px]">118 ÷ 1.18</div>
                </div>
                <span className="text-slate-300">+</span>
                <div className="text-center">
                  <div className="font-bold text-slate-800">₹18</div>
                  <div className="text-slate-500 text-xs">GST (18%)</div>
                  <div className="text-slate-400 text-[10px]">back-calculated</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Discounts do not reduce the GST amount — GST is always calculated on the original undiscounted MRP.
            </p>
          </section>
        )}

        {/* FAQ */}
        {show("faq") && (
          <section id="faq" className="scroll-mt-24">
            <SectionHeader icon="help" title="FAQ" />
            <div className="space-y-2">
              {[
                {
                  q: "Can I use the POS without internet?",
                  a: <>Yes. Bill as normal — sales queue locally and sync automatically when you come back online. Look for the Offline badge at the top. <GoLink href="/settings/offline-queue">View queue</GoLink></>,
                },
                {
                  q: "Where do I change the store name or GSTIN on receipts?",
                  a: <><GoLink href="/settings/business-profile">Settings → Business Profile</GoLink></>,
                },
                {
                  q: "How do I process a return?",
                  a: <>Open the original invoice → click <Tag>Exchange</Tag> → select which items to return → choose whether they go back to sellable stock or are marked as damaged. <GoLink href="/invoices">Open Invoices</GoLink></>,
                },
                {
                  q: "A sale is stuck in the offline queue. What do I do?",
                  a: <>Confirm your internet is working. If it is still stuck, go to <GoLink href="/settings/offline-queue">Settings → Offline Queue</GoLink> to inspect or remove it.</>,
                },
                {
                  q: "How do I print barcode labels for new products?",
                  a: <><GoLink href="/settings/barcodes">Settings → Barcodes</GoLink> → search for the product → choose the label count → print. Labels are 50×25 mm, Code-128 format.</>,
                },
                {
                  q: "How do I download the GST file for my accountant?",
                  a: <><GoLink href="/reports/accounting-export">Reports → Accounting Export</GoLink> — downloads a GSTR-1 Excel file with B2B, B2CL, and HSN summary sheets.</>,
                },
                {
                  q: "Who can create new users or change roles?",
                  a: <>User creation is done via the Firebase console or the admin debug panel. Contact your system administrator.</>,
                },
              ].map(({ q, a }) => (
                <details key={q} className="border border-slate-200 rounded-lg group bg-white">
                  <summary className="px-4 py-3 text-sm font-medium text-slate-800 cursor-pointer list-none flex items-center justify-between select-none">
                    {q}
                    <MSIcon name="expand_more" className="text-[18px] text-slate-400 group-open:rotate-180 transition-transform shrink-0" />
                  </summary>
                  <div className="px-4 pb-3 pt-1 text-sm text-slate-500 border-t border-slate-100 flex flex-wrap items-center gap-2">
                    {a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* No results */}
        {query && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <MSIcon name="search_off" className="text-[40px] mb-2 text-slate-300" />
            <p className="text-sm">No results for &ldquo;{query}&rdquo;</p>
            <button onClick={() => setQuery("")} className="mt-2 text-xs text-[#b7102a] hover:underline">Clear search</button>
          </div>
        )}

        <p className="text-xs text-slate-300 text-center border-t border-slate-100 pt-4">
          Toy Co. Management · User Guide · April 2026
        </p>
      </main>
    </div>
  );
}
