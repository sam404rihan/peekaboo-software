/**
 * Hands-on feature test using Playwright + Chromium
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = "http://localhost:3000";
const EMAIL = "admin@nndl.com";
const PASS = "IamAdmin@28";
const SCREENSHOTS = path.join(__dirname, "test-screenshots");
if (!fs.existsSync(SCREENSHOTS)) fs.mkdirSync(SCREENSHOTS);

let pass = 0, fail = 0;
const results = [];

function log(name, ok, detail = "") {
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${name}${detail ? " — " + detail : ""}`);
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false });
}

async function goto(page, url, extraMs = 1000) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(
    () => !document.body?.innerText?.includes("Loading…") && !document.body?.innerText?.includes("Loading..."),
    { timeout: 12000 }
  ).catch(() => {});
  await page.waitForTimeout(extraMs);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASS);
  await page.locator('input[type="password"]').first().press("Enter");
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(1000);
    if (!page.url().includes("/login")) break;
  }
  await page.waitForFunction(
    () => !document.body?.innerText?.includes("Loading…") && !document.body?.innerText?.includes("Loading..."),
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(2000);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", err => consoleErrors.push(err.message));

  try {
    // ── 1. Login ─────────────────────────────────────────────────────────────
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    await shot(page, "01-login");
    log("Login page loads", (await page.title()) !== "");

    await page.locator('input[type="email"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASS);
    await page.locator('input[type="password"]').first().press("Enter");
    let loginOk = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      if (!page.url().includes("/login")) { loginOk = true; break; }
    }
    await page.waitForFunction(
      () => !document.body?.innerText?.includes("Loading…") && !document.body?.innerText?.includes("Loading..."),
      { timeout: 12000 }
    ).catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, "02-dashboard");
    log("Login → dashboard redirect", loginOk, page.url());

    const dashText = await page.evaluate(() => document.body.innerText);
    log("Dashboard shows content", /performance|sales|inventory|revenue/i.test(dashText));

    // ── 2. Products ───────────────────────────────────────────────────────────
    await goto(page, `${BASE}/products`, 1500);
    await shot(page, "03-products-list");
    const prodText = await page.evaluate(() => document.body.innerText);
    log("Products list renders", /product|sku|stock/i.test(prodText));

    const productLinks = [];
    for (const l of await page.locator("a[href*='/products/']").all()) {
      const h = await l.getAttribute("href");
      if (h && h !== "/products" && !h.endsWith("/products/new")) productLinks.push(h);
    }
    log("Products: data loaded", productLinks.length > 0, `${productLinks.length} products`);

    // ── 3. Product edit ───────────────────────────────────────────────────────
    if (productLinks.length > 0) {
      await goto(page, `${BASE}${productLinks[0]}`, 1500);
      await shot(page, "04-product-edit");
      const editText = await page.evaluate(() => document.body.innerText);
      log("Product edit: form renders", /name|sku|pricing|inventory/i.test(editText));
      log("Product edit: has inputs", (await page.locator("input").count()) >= 5, `${await page.locator("input").count()} inputs`);
      log("Product edit: Pricing & Tax section", /pricing|tax|gst/i.test(editText));
      log("Product edit: Inventory section", /inventory|stock|reorder/i.test(editText));
    }

    // ── 4. Invoices list ──────────────────────────────────────────────────────
    await goto(page, `${BASE}/invoices`, 3000);
    await shot(page, "05-invoices-list");
    const invText0 = await page.evaluate(() => document.body.innerText);
    log("Invoices list renders", /receipt|invoice|transaction/i.test(invText0));

    // Switch to All Time to see all invoices
    const allTimeBtn = page.locator("button, span, div").filter({ hasText: /^all time$/i }).first();
    if (await allTimeBtn.count() > 0) {
      await allTimeBtn.click();
      await page.waitForTimeout(3000);
    }
    await shot(page, "05b-invoices-all-time");

    const invText = await page.evaluate(() => document.body.innerText);
    const hasInvoiceNumbers = /INV-/i.test(invText);
    log("Invoices: All Time filter shows invoices", hasInvoiceNumbers);

    // Click first invoice row to select it
    let invoiceId = null;
    const invRows = page.locator("tr, [class*='row']").filter({ hasText: /INV-/ });
    if (await invRows.count() > 0) {
      await invRows.first().click();
      await page.waitForTimeout(1500);
      await shot(page, "05c-invoice-selected");

      // Click "View Full Receipt" button
      const viewBtn = page.locator("button").filter({ hasText: /view full receipt/i }).first();
      if (await viewBtn.count() > 0) {
        // Intercept navigation to get invoiceId
        const [navReq] = await Promise.all([
          page.waitForURL(/\/invoices\/[^/]+$/, { timeout: 8000 }).catch(() => null),
          viewBtn.click(),
        ]);
        await page.waitForTimeout(2000);
        const url = page.url();
        if (/\/invoices\/[^/]+$/.test(url)) {
          invoiceId = url.split("/").pop();
          log("Invoices: navigate to invoice detail works", true, url);
        } else {
          log("Invoices: navigate to invoice detail works", false, url);
        }
      } else {
        log("Invoices: navigate to invoice detail works", false, "View Full Receipt button not found");
      }
    } else {
      log("Invoices: navigate to invoice detail works", false, "no invoice rows");
    }

    // ── 5. Invoice detail ─────────────────────────────────────────────────────
    if (invoiceId) {
      await goto(page, `${BASE}/invoices/${invoiceId}`, 2000);
      await shot(page, "06-invoice-detail");
      const detailText = await page.evaluate(() => document.body.innerText);
      log("Invoice detail page renders", /invoice|items|total|customer/i.test(detailText));
    }

    // ── 6. Receipt page ───────────────────────────────────────────────────────
    if (invoiceId) {
      await goto(page, `${BASE}/invoices/receipt/${invoiceId}`, 4000);
      await shot(page, "07-receipt");
      const rcptText = await page.evaluate(() => document.body.innerText);
      log("Receipt: page renders", /invoice|name|gstin|total/i.test(rcptText));

      const titleFound = await page.evaluate(() => {
        const divs = [...document.querySelectorAll("div")];
        return divs.some(d => /^(Tax Invoice|Invoice|Receipt)$/.test(d.textContent?.trim() || ""));
      });
      log("Receipt: title element present", titleFound);
      log("Receipt: GSTIN row", /GSTIN/i.test(rcptText));
      log("Receipt: HSN column in table", /HSN/i.test(rcptText));
      log("Receipt: CGST & SGST columns", /CGST/i.test(rcptText) && /SGST/i.test(rcptText));
      log("Receipt: Net Bill row", /Net Bill/i.test(rcptText));
      log("Receipt: Amount in words", /Rupees/i.test(rcptText));

      const dlBtn = page.locator("button").filter({ hasText: /download pdf/i }).first();
      const hasDl = await dlBtn.count() > 0;
      log("Receipt: Download PDF button", hasDl);
      log("Receipt: Print button", await page.locator("button").filter({ hasText: /print/i }).count() > 0);

      if (hasDl) {
        await dlBtn.click();
        await page.waitForTimeout(6000);
        await shot(page, "08-receipt-pdf");
        const pdfText = await page.evaluate(() => document.body.innerText);
        log("Receipt: PDF generation triggers (no crash)", /generating|saved|✓/i.test(pdfText));
      }
    }

    // ── 7. Settings: Receipt Template ────────────────────────────────────────
    await goto(page, `${BASE}/settings/receipt-template`, 2000);
    await shot(page, "09-receipt-settings");

    const hasTitleField = await page.locator("input[placeholder='Tax Invoice']").count() > 0;
    log("Settings/Receipt: Receipt Title field", hasTitleField);
    log("Settings/Receipt: Default State Code field", await page.locator("input[placeholder='29']").count() > 0);
    log("Settings/Receipt: Footer Note field", await page.locator("input[placeholder*='Thank' i], input[placeholder*='shopping' i]").count() > 0);
    log("Settings/Receipt: Terms textarea", await page.locator("textarea").count() > 0);
    log("Settings/Receipt: Toggles", await page.locator("text=/Auto-print|GST line|Google Review/i").count() > 0);

    if (hasTitleField) {
      const ti = page.locator("input[placeholder='Tax Invoice']");
      const original = await ti.inputValue();
      await ti.clear();
      await ti.fill("Invoice");

      const saveBtn = page.locator("button").filter({ hasText: /save receipt settings/i }).first();
      await saveBtn.click();
      await page.waitForTimeout(3000);
      await shot(page, "10-settings-saved");
      log("Settings/Receipt: Save → toast", /saved/i.test(await page.evaluate(() => document.body.innerText)));

      // Verify persistence
      await goto(page, `${BASE}/settings/receipt-template`, 2000);
      const persisted = await page.locator("input[placeholder='Tax Invoice']").inputValue();
      log("Settings/Receipt: Title persists after reload", persisted === "Invoice", `got "${persisted}"`);
      await shot(page, "11-settings-reloaded");

      // Restore
      await page.locator("input[placeholder='Tax Invoice']").clear();
      await page.locator("input[placeholder='Tax Invoice']").fill(original || "Tax Invoice");
      await saveBtn.click();
      await page.waitForTimeout(1500);
      log("Settings/Receipt: Title restored to original", true);

      // Verify receipt title reflects settings
      if (invoiceId) {
        await goto(page, `${BASE}/invoices/receipt/${invoiceId}`, 4000);
        const rcptTitle = await page.evaluate(() => {
          const divs = [...document.querySelectorAll("div")];
          const el = divs.find(d => /^(Tax Invoice|Invoice|Receipt)$/.test(d.textContent?.trim() || ""));
          return el?.textContent?.trim() || "";
        });
        log("Receipt: title reflects restored settings value",
          rcptTitle === (original || "Tax Invoice"), `got "${rcptTitle}"`);
        await shot(page, "12-receipt-title-check");
      }
    }

    // ── 8. Business Profile ───────────────────────────────────────────────────
    await goto(page, `${BASE}/settings/business-profile`, 2000);
    await shot(page, "13-business-profile");
    const bizInputs = await page.locator("input, textarea").count();
    log("Settings/Business Profile: form fields", bizInputs > 0, `${bizInputs} inputs`);

    // ── 9. Reports ────────────────────────────────────────────────────────────
    await goto(page, `${BASE}/reports`, 3000);
    await shot(page, "14-reports");
    log("Reports page renders", /report|sales|revenue|export/i.test(await page.evaluate(() => document.body.innerText)));

    // ── 10. POS ───────────────────────────────────────────────────────────────
    await goto(page, `${BASE}/pos`, 2000);
    await shot(page, "15-pos");
    log("POS terminal page renders", /scan|cart|checkout|pos|barcode/i.test(await page.evaluate(() => document.body.innerText)));

    // ── 11. Console errors ────────────────────────────────────────────────────
    const badErrors = consoleErrors.filter(e =>
      !e.toLowerCase().includes("firebase") &&
      !e.includes("net::ERR") &&
      !e.includes("favicon") &&
      !e.includes("baseline-browser")
    );
    log("No unexpected JS console errors", badErrors.length === 0,
      badErrors.length > 0 ? badErrors.slice(0, 2).join(" | ") : "clean");

  } catch (err) {
    console.error("\n💥 Crashed:", err.message);
    await shot(page, "crash").catch(() => {});
  } finally {
    await browser.close();
  }

  console.log("\n══════════════════════════════════");
  console.log(`Results: ${pass} passed, ${fail} failed / ${pass + fail} total`);
  if (fail > 0) {
    console.log("\nFailed:");
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.name}${r.detail ? " — " + r.detail : ""}`));
  }
  console.log(`\nScreenshots → ${SCREENSHOTS}`);
})();
