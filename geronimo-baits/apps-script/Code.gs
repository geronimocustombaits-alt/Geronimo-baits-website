/**
 * Geronimo Baits — Orders & Stock web app (Google Apps Script)
 *
 * Orders tab:   new website orders, payment status, order status.
 * Inventory tab: the ONE stock count. Left = In Stock − Sold.
 * Stock Log tab: every stock change, so nothing is counted twice and you
 *                can always see why a number changed (created automatically).
 *
 * Stock changes come from:
 *   • Packing scan in the back office       → adds to Sold (the ONLY place sales come off)
 *   • Zoho invoice voided                   → packed stock put back
 *   • Phone scanner: Production             → adds to In Stock
 *   • Phone scanner: Stocktake              → sets Left to the counted amount
 *
 * Zoho invoices (every 15 min) and website orders only create / update the
 * Orders row. Stock comes off when the order is scanned and packed, so it
 * matches what physically left the shelf. (Inventory was reset to the 11 Nov
 * 2026 stocktake when this started.)
 *
 * Settings (Project Settings → Script properties):
 *   WEBHOOK_SECRET      shared secret the website sends for scanner actions
 *   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORG_ID
 *   ZOHO_ACCOUNTS_URL   optional, defaults to https://accounts.zoho.com
 */

const SHEET_ID = "1Eyvx00kUBFvPSPCw2685kRfdNlu2noJENFyChMcbFcE";
const SHEET_NAME = "Orders";
const INVENTORY_SHEET = "Inventory";
const LOG_SHEET = "Stock Log";

// Orders columns (A = 1). N–Q were added for the website upgrade.
const COL = {
  ITEMS: 7,            // G
  PAYMENT_STATUS: 12,  // L
  ORDER_STATUS: 13,    // M
  LOCKER_CODE: 14,     // N
  DELIVERY_ADDRESS: 15,// O
  AMOUNT_PAID: 16,     // P
  HUNT_BOX: 17,        // Q
  REFERRAL: 18,        // R  ambassador code
};

// Inventory blocks: most ranges sit in columns A–L, Wargrubs sit in O–T.
const INVENTORY_BLOCKS = [
  { skuCol: 1, inStockCol: 4, soldCol: 5 },     // A SKU, D In Stock, E Sold
  { skuCol: 15, inStockCol: 18, soldCol: 19 },  // O SKU, R In Stock, S Sold
];

// ───────────────────────────── Web app entry ─────────────────────────────

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (data.action === "updatePayment") {
      updatePaymentStatus(ss, sheet, data);
      return json({ success: true });
    }
    if (data.action === "updateOrderStatus") {
      updateOrderStatus(sheet, data);
      return json({ success: true });
    }
    if (data.action === "stockIn") {
      if (!secretOk(data)) return json({ success: false, error: "Not allowed" });
      return json(stockIn(ss, data));
    }
    // Back office actions (all need the shared secret)
    const BACK_OFFICE = {
      getMakeList: () => getMakeList(ss),
      getBatches: () => getBatches(ss),
      addBatch: () => addBatch(ss, data),
      updateBatch: () => updateBatch(ss, data),
      getSales: () => getSales(),
      refreshSales: () => { refreshSalesData(); return getSales(); },
      getAmbassadors: () => getAmbassadors(ss),
      claimReward: () => claimReward(ss, data),
      setReferral: () => setReferral(ss, sheet, data),
    };
    if (BACK_OFFICE[data.action]) {
      if (!secretOk(data)) return json({ success: false, error: "Not allowed" });
      return json(BACK_OFFICE[data.action]());
    }
    if (data.action === "getInventory") {
      if (!secretOk(data)) return json({ success: false, error: "Not allowed" });
      return json(getInventory(ss));
    }
    if (data.action === "packOrder") {
      if (!secretOk(data)) return json({ success: false, error: "Not allowed" });
      return json(packOrder(ss, sheet, data));
    }

    addNewOrder(sheet, data);
    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: String(error) });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function secretOk(data) {
  const secret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
  return Boolean(secret) && data.secret === secret;
}

// ───────────────────────────── Orders ─────────────────────────────

function addNewOrder(sheet, data) {
  const items = (data.items || [])
    .map(item => `${item.qty}x ${item.bait} - ${item.colour} | ${item.sku}`)
    .join("\n");

  sheet.appendRow([
    data.orderNumber,
    new Date(),
    data.customerName,
    data.customerPhone,
    data.customerEmail,
    data.deliveryMethod,
    items,
    data.cartTotal,
    data.shippingCost,
    data.grandTotal,
    data.paymentMethod || "Website",
    data.paymentStatus || "Pending",
    data.orderStatus || "Processing",
    data.lockerCode || "",
    data.deliveryAddress || "",
    "",
    data.huntBox || "",
    String(data.referralCode || "").trim().toUpperCase().slice(0, 20),
  ]);
}

function findRow(sheet, orderNumber) {
  const values = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(orderNumber).trim()) return i + 1;
  }
  return -1;
}

function updatePaymentStatus(ss, sheet, data) {
  const row = findRow(sheet, data.orderNumber);
  if (row < 0) return;

  const status = data.paymentStatus || "Paid";
  sheet.getRange(row, COL.PAYMENT_STATUS).setValue(status);
  sheet.getRange(row, COL.ORDER_STATUS).setValue(data.orderStatus || "Paid");
  if (data.amountPaid) sheet.getRange(row, COL.AMOUNT_PAID).setValue(data.amountPaid);
  // Stock is taken off when the order is scanned and packed (packOrder), not here.
}

function updateOrderStatus(sheet, data) {
  const row = findRow(sheet, data.orderNumber);
  if (row < 0) return;
  sheet.getRange(row, COL.ORDER_STATUS).setValue(data.orderStatus);
}

// "2x Apache Stick 5" - Junebug | AP-BM-5-10" (one per line) → [{sku, qty}]
function parseOrderItems(text) {
  return String(text || "")
    .split("\n")
    .map(line => {
      const qty = parseInt(line, 10);
      const sku = line.includes("|") ? (line.split("|").pop() || "").trim().toUpperCase() : "";
      return { sku, qty };
    })
    .filter(item => item.sku && item.qty > 0);
}

// ───────────────────────────── Stock ─────────────────────────────

function inventoryIndex(inv) {
  const values = inv.getDataRange().getValues();
  const index = {};
  INVENTORY_BLOCKS.forEach(block => {
    for (let r = 0; r < values.length; r++) {
      const sku = String(values[r][block.skuCol - 1] || "").trim();
      if (sku && sku.includes("-") && sku !== "SKU" && !index[sku]) {
        index[sku] = { row: r + 1, inStockCol: block.inStockCol, soldCol: block.soldCol };
      }
    }
  });
  return index;
}

function logSheet(ss) {
  let log = ss.getSheetByName(LOG_SHEET);
  if (!log) {
    log = ss.insertSheet(LOG_SHEET);
    log.appendRow(["DATE", "TYPE", "SKU", "QTY", "REFERENCE", "SOURCE", "NOTE"]);
    log.setFrozenRows(1);
    log.getRange("A1:G1").setFontWeight("bold");
  }
  return log;
}

function alreadyLogged(log, reference, type) {
  const last = log.getLastRow();
  if (last < 2) return false;
  const rows = log.getRange(2, 2, last - 1, 4).getValues(); // TYPE..REFERENCE
  return rows.some(r => r[0] === type && String(r[3]) === String(reference));
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Adds sold packs to Sold. Each reference (order / invoice) only counts once.
function recordSale(ss, items, reference, source) {
  const log = logSheet(ss);
  if (alreadyLogged(log, reference, "SALE")) return { skipped: true };

  const inv = ss.getSheetByName(INVENTORY_SHEET);
  const index = inventoryIndex(inv);

  items.forEach(item => {
    const cell = index[item.sku];
    if (!cell) {
      log.appendRow([new Date(), "UNKNOWN SKU", item.sku, item.qty, reference, source, "Not found in Inventory - stock not changed"]);
      return;
    }
    const soldRange = inv.getRange(cell.row, cell.soldCol);
    soldRange.setValue(num(soldRange.getValue()) + item.qty);
    log.appendRow([new Date(), "SALE", item.sku, -item.qty, reference, source, ""]);
  });
  return { success: true };
}

// Puts stock back for a sale that was voided (e.g. a Zoho invoice).
function reverseSale(ss, reference, source) {
  const log = logSheet(ss);
  if (!alreadyLogged(log, reference, "SALE") || alreadyLogged(log, reference, "SALE REVERSED")) return;

  const inv = ss.getSheetByName(INVENTORY_SHEET);
  const index = inventoryIndex(inv);
  const rows = log.getRange(2, 1, log.getLastRow() - 1, 7).getValues();

  rows
    .filter(r => r[1] === "SALE" && String(r[4]) === String(reference))
    .forEach(r => {
      const sku = r[2];
      const qty = Math.abs(num(r[3]));
      const cell = index[sku];
      if (!cell) return;
      const soldRange = inv.getRange(cell.row, cell.soldCol);
      soldRange.setValue(Math.max(num(soldRange.getValue()) - qty, 0));
      log.appendRow([new Date(), "SALE REVERSED", sku, qty, reference, source, "Voided - stock put back"]);
    });
}

// Phone scanner. mode "production": add to In Stock.
//                mode "stocktake":  set Left (In Stock − Sold) to the count.
function stockIn(ss, data) {
  const mode = data.mode === "stocktake" ? "stocktake" : "production";
  const reference = String(data.reference || "");
  const log = logSheet(ss);
  const type = mode === "stocktake" ? "STOCKTAKE" : "PRODUCTION";

  if (reference && alreadyLogged(log, reference, type)) return { success: true, skipped: true };

  const inv = ss.getSheetByName(INVENTORY_SHEET);
  const index = inventoryIndex(inv);
  const unknown = [];
  let updated = 0;

  (data.items || []).forEach(item => {
    const sku = String(item.sku || "").trim();
    const qty = Math.max(Math.floor(num(item.qty)), 0);
    const cell = index[sku];
    if (!cell) {
      unknown.push(sku);
      log.appendRow([new Date(), "UNKNOWN SKU", sku, qty, reference, "Scanner", "Not found in Inventory - stock not changed"]);
      return;
    }

    const inStockRange = inv.getRange(cell.row, cell.inStockCol);
    const sold = num(inv.getRange(cell.row, cell.soldCol).getValue());
    const inStock = num(inStockRange.getValue());

    if (mode === "stocktake") {
      const oldLeft = inStock - sold;
      inStockRange.setValue(qty + sold);
      log.appendRow([new Date(), "STOCKTAKE", sku, qty - oldLeft, reference, "Scanner", `Counted ${qty} (was ${oldLeft})`]);
    } else {
      inStockRange.setValue(inStock + qty);
      log.appendRow([new Date(), "PRODUCTION", sku, qty, reference, "Scanner", ""]);
    }
    updated++;
  });

  return { success: true, updated, unknown };
}

// ───────────────────────────── Zoho Books link ─────────────────────────────
// Run setupZohoTrigger() once after adding the ZOHO_* script properties.

function setupZohoTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === "syncZohoInvoices")
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncZohoInvoices").timeBased().everyMinutes(15).create();
  syncZohoInvoices();
}

function zohoAuth() {
  const props = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();
  const cached = cache.get("zoho_auth");
  if (cached) return JSON.parse(cached);

  const accounts = props.getProperty("ZOHO_ACCOUNTS_URL") || "https://accounts.zoho.com";
  const res = UrlFetchApp.fetch(`${accounts}/oauth/v2/token`, {
    method: "post",
    payload: {
      refresh_token: props.getProperty("ZOHO_REFRESH_TOKEN"),
      client_id: props.getProperty("ZOHO_CLIENT_ID"),
      client_secret: props.getProperty("ZOHO_CLIENT_SECRET"),
      grant_type: "refresh_token",
    },
    muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText());
  if (!body.access_token) throw new Error("Zoho login failed: " + res.getContentText());

  const auth = { token: body.access_token, api: body.api_domain || "https://www.zohoapis.com" };
  cache.put("zoho_auth", JSON.stringify(auth), 50 * 60);
  return auth;
}

function zohoGet(auth, path) {
  const res = UrlFetchApp.fetch(`${auth.api}/books/v3${path}`, {
    headers: { Authorization: `Zoho-oauthtoken ${auth.token}` },
    muteHttpExceptions: true,
  });
  return JSON.parse(res.getContentText());
}

// Zoho times look like 2026-10-12T10:00:34+0200
function zohoTime(text) {
  return new Date(String(text).replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).getTime();
}

function syncZohoInvoices() {
  const props = PropertiesService.getScriptProperties();
  const orgId = props.getProperty("ZOHO_ORG_ID");
  if (!orgId || !props.getProperty("ZOHO_REFRESH_TOKEN")) return;

  // First run: start from now, so invoices already counted by hand aren't counted again.
  const lastSync = Number(props.getProperty("ZOHO_LAST_SYNC") || 0);
  const startedAt = Date.now();
  if (!lastSync) {
    props.setProperty("ZOHO_LAST_SYNC", String(startedAt));
    return;
  }

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const auth = zohoAuth();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    for (let page = 1; page <= 5; page++) {
      const list = zohoGet(auth, `/invoices?organization_id=${orgId}&sort_column=last_modified_time&sort_order=D&per_page=100&page=${page}`);
      const invoices = list.invoices || [];
      let reachedOld = false;

      invoices.forEach(inv => {
        if (zohoTime(inv.last_modified_time) < lastSync - 60 * 1000) { reachedOld = true; return; }
        const reference = `ZOHO ${inv.invoice_number}`;

        if (inv.status === "void") {
          reverseSale(ss, reference, "Zoho");                       // old rule: taken off at invoice
          reverseSale(ss, `PACK ${inv.invoice_number}`, "Zoho");    // new rule: taken off at packing
          markZohoOrderVoid(ss, inv.invoice_number);
          return;
        }

        const detail = zohoGet(auth, `/invoices/${inv.invoice_id}?organization_id=${orgId}`);
        if (!detail.invoice) return;
        upsertZohoOrder(ss, detail.invoice);
        // Stock is NOT taken off here any more — it comes off when the order is packed.
      });

      if (reachedOld || !list.page_context || !list.page_context.has_more_page) break;
    }
    props.setProperty("ZOHO_LAST_SYNC", String(startedAt));
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────────── Zoho invoices → Orders tab ─────────────────────────────
// Every Zoho invoice gets one row in Orders (ORDER # = invoice number), so the back
// office shows website and Zoho orders in one list. A row is updated, never duplicated.
// ORDER STATUS is only set on a new row, so your Packed / Shipped progress is kept.

function zohoPaymentStatus(invoice) {
  const status = String(invoice.status || "").toLowerCase();
  if (status === "paid") return "Paid";
  if (status === "partially_paid") return "Paid - CHECK AMOUNT";
  if (status === "draft") return "Draft";
  return "Pending"; // sent, viewed, overdue
}

function upsertZohoOrder(ss, invoice) {
  const sheet = ss.getSheetByName(SHEET_NAME);
  const lines = invoice.line_items || [];
  const products = lines.filter(li => String(li.sku || "").trim());
  const extras = lines.filter(li => !String(li.sku || "").trim()); // delivery etc.

  // Keep Zoho's description (e.g. "Jungle Camo with red flake") so custom colours
  // show on the packing screen. "|" is reserved as the SKU separator.
  const items = products
    .map(li => {
      const desc = String(li.description || "").replace(/\|/g, "/").replace(/\s*\n\s*/g, " ").trim();
      return `${num(li.quantity)}x ${li.name}${desc ? " - " + desc : ""} | ${String(li.sku).trim()}`;
    })
    .join("\n");
  const productTotal = products.reduce((sum, li) => sum + num(li.item_total), 0);
  const shipping = extras.reduce((sum, li) => sum + num(li.item_total), 0);

  const ship = invoice.shipping_address || {};
  const deliveryLine = extras.map(li => li.description || li.name).filter(Boolean).join("; ");
  const delivery = ship.attention || deliveryLine || (shipping > 0 ? "Delivery" : "Collection");
  const address = [ship.address, ship.street2, ship.city, ship.state, ship.zip]
    .filter(Boolean).join(", ");
  const person = (invoice.contact_persons_details || [])[0] || {};
  // Leading ' keeps "+27 …" as text (otherwise Sheets reads it as a formula → #ERROR!)
  const rawPhone = String(person.mobile || person.phone || "").trim();
  const phone = rawPhone ? `'${rawPhone}` : "";
  const paid = num(invoice.total) - num(invoice.balance);

  const values = [
    invoice.invoice_number,
    invoice.date,
    invoice.customer_name,
    phone,
    invoice.email || person.email || "",
    delivery,
    items,
    productTotal,
    shipping,
    num(invoice.total),
    "Zoho",
    zohoPaymentStatus(invoice),
    "Processing",
    "",
    address,
    paid > 0 ? paid : "",
    "",
  ];

  const row = findRow(sheet, invoice.invoice_number);
  if (row < 0) {
    sheet.appendRow(values);
    return;
  }
  // Existing row: refresh everything except ORDER STATUS (col M) and HUNT BOX (col Q).
  sheet.getRange(row, 1, 1, COL.PAYMENT_STATUS).setValues([values.slice(0, COL.PAYMENT_STATUS)]);
  sheet.getRange(row, COL.LOCKER_CODE, 1, 3).setValues([values.slice(COL.LOCKER_CODE - 1, COL.AMOUNT_PAID)]);
}

function markZohoOrderVoid(ss, invoiceNumber) {
  const sheet = ss.getSheetByName(SHEET_NAME);
  const row = findRow(sheet, invoiceNumber);
  if (row < 0) return;
  sheet.getRange(row, COL.PAYMENT_STATUS).setValue("Void");
  sheet.getRange(row, COL.ORDER_STATUS).setValue("Cancelled");
}

// Run once by hand: copies Zoho invoices dated from FROM_DATE into the Orders tab.
// Orders tab only. It does NOT touch stock, so nothing is counted twice.
function importZohoOrders() {
  const FROM_DATE = "2026-10-20"; // yyyy-mm-dd
  const props = PropertiesService.getScriptProperties();
  const orgId = props.getProperty("ZOHO_ORG_ID");
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const auth = zohoAuth();
  let count = 0;

  for (let page = 1; page <= 5; page++) {
    const list = zohoGet(auth, `/invoices?organization_id=${orgId}&date_start=${FROM_DATE}&sort_column=date&sort_order=A&per_page=100&page=${page}`);
    (list.invoices || []).forEach(inv => {
      if (inv.status === "void") return;
      const detail = zohoGet(auth, `/invoices/${inv.invoice_id}?organization_id=${orgId}`);
      if (detail.invoice) { upsertZohoOrder(ss, detail.invoice); count++; }
    });
    if (!list.page_context || !list.page_context.has_more_page) break;
  }
  Logger.log(`Imported ${count} Zoho invoices into Orders.`);
}

// ───────────────────────────── Packing scan ─────────────────────────────
// The back office sends every pack scanned for one order. It must match the
// order's ITEMS exactly (every SKU, every quantity, nothing extra), otherwise
// nothing changes and the mismatches are sent back. On a match the packs are
// added to Sold (reference "PACK <order>") and ORDER STATUS becomes Packed.

function totalsBySku(items) {
  const totals = {};
  items.forEach(i => {
    const sku = String(i.sku || "").trim().toUpperCase();
    const qty = Math.floor(num(i.qty));
    if (sku && qty > 0) totals[sku] = (totals[sku] || 0) + qty;
  });
  return totals;
}

function packOrder(ss, sheet, data) {
  const orderNumber = String(data.orderNumber || "").trim();
  const row = orderNumber ? findRow(sheet, orderNumber) : -1;
  if (row < 0) return { success: false, error: "Order not found in the Orders tab" };

  const status = String(sheet.getRange(row, COL.ORDER_STATUS).getValue()).toLowerCase();
  if (status === "cancelled") return { success: false, error: "This order is cancelled" };

  const needed = totalsBySku(parseOrderItems(sheet.getRange(row, COL.ITEMS).getValue()));
  const scanned = totalsBySku(data.items || []);

  const problems = [];
  Object.keys(needed).forEach(sku => {
    const got = scanned[sku] || 0;
    if (got !== needed[sku]) problems.push(`${sku}: scanned ${got} of ${needed[sku]}`);
  });
  Object.keys(scanned).forEach(sku => {
    if (!(sku in needed)) problems.push(`${sku} is not on this order`);
  });
  if (problems.length) return { success: false, error: "Scans don't match the order", problems };

  // Already packed before? Then don't take it off twice.
  // (Inventory was reset to the 11 Nov stocktake, so sales logged under the old
  // Zoho / website rules no longer count — every order comes off when packed.)
  const log = logSheet(ss);
  const packRef = `PACK ${orderNumber}`;
  const alreadyOff = alreadyLogged(log, packRef, "SALE");

  if (!alreadyOff) {
    const items = Object.keys(needed).map(sku => ({ sku, qty: needed[sku] }));
    recordSale(ss, items, packRef, "Packing");
  }

  sheet.getRange(row, COL.ORDER_STATUS).setValue("Packed");
  return { success: true, deducted: !alreadyOff };
}

// ───────────────────────────── Live stock (back office) ─────────────────────────────
// Returns every Inventory row, grouped under the product heading above it.
// Read live (no published-CSV delay).

function getInventory(ss) {
  const inv = ss.getSheetByName(INVENTORY_SHEET);
  const values = inv.getDataRange().getValues();
  const items = [];

  INVENTORY_BLOCKS.forEach(block => {
    const c = block.skuCol - 1; // A or O
    let product = "";
    for (let r = 0; r < values.length; r++) {
      const first = String(values[r][c] || "").trim();
      const second = String(values[r][c + 1] || "").trim();
      if (!first) continue;
      if (first === "SKU") continue;
      const looksLikeSku = /^[A-Z]+-[A-Z0-9]+-\d+-\d+$/i.test(first);
      if (!looksLikeSku) {
        product = first; // heading row, e.g. Warvipers 4.5"
        continue;
      }
      if (/meaning/i.test(product)) continue; // the "SKU MEANING" key at the top
      const inStock = num(values[r][block.inStockCol - 1]);
      const sold = num(values[r][block.soldCol - 1]);
      items.push({
        sku: first,
        colour: second,
        product,
        par: num(values[r][c + 2]),
        inStock,
        sold,
        left: inStock - sold,
      });
    }
  });
  return { success: true, items, at: new Date().toISOString() };
}

// ═════════════════════════════ Back office add-ons ═════════════════════════════
// Run setupBackOffice() once after pasting this script. It creates the extra
// tabs (Production, Ambassadors, Retailers, Sales Lines, Dashboard Data), the
// REFERRAL column on Orders, and the timers:
//   • Zoho sync          every 15 min
//   • Sales dashboard    every hour
//   • Low-stock email    every morning ~07:00

const PRODUCTION_SHEET = "Production";
const AMBASSADOR_SHEET = "Ambassadors";
const RETAILER_SHEET = "Retailers";
const SALES_LINES_SHEET = "Sales Lines";
const DASHBOARD_SHEET = "Dashboard Data";
const DONE_STATUSES = ["packed", "shipped", "completed", "cancelled"];
const PRODUCT_NAMES = {
  "WV-45": "Warvipers 4.5\"", "AP-5": "Apache Sticks 5\"", "AP-4": "Apache Sticks 4\"",
  "WB-43": "Warbombs 4.3\"", "WC-33": "Warcraws 3.3\"", "WCH-25": "Warchins 2.5\"",
  "SWB-50": "Swimbaits 5\"", "CS-5": "Coreshots 5\"", "WH-35": "Warhawks 3.3\"",
  "PH-35": "Phantoms 3.3\"", "WF-4": "Warfrogs 4\"", "WG-3": "Wargrubs 3\"",
};

function setupBackOffice() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  const orders = ss.getSheetByName(SHEET_NAME);
  if (String(orders.getRange(1, COL.REFERRAL).getValue()).trim() === "") {
    orders.getRange(1, COL.REFERRAL).setValue("REFERRAL").setFontWeight("bold");
  }

  ensureSheet(ss, PRODUCTION_SHEET, ["BATCH", "DATE POURED", "SKU", "COLOUR", "BAITS POURED", "PLASTISOL ML", "STATUS", "PACKS", "DATE PACKED", "NOTES"]);

  const amb = ensureSheet(ss, AMBASSADOR_SHEET, ["CODE", "NAME", "LEVEL", "OWN CUSTOMER NAME", "PACKS PER FREE PACK", "FREE PACKS CLAIMED", "ACTIVE"]);
  if (amb.getLastRow() < 2) {
    amb.getRange(2, 1, 5, 7).setValues([
      ["ERIK", "Erik", "Senior", "", 20, 0, "Yes"],
      ["JOHAN", "Johan", "Senior", "", 20, 0, "Yes"],
      ["GEORGE", "George", "Senior", "", 20, 0, "Yes"],
      ["HENDRE", "Hendre", "Junior", "", 20, 0, "Yes"],
      ["KEAGAN", "Keagan Thomas", "Junior", "Keagan Thomas", 20, 0, "Yes"],
    ]);
  }

  const ret = ensureSheet(ss, RETAILER_SHEET, ["ZOHO CUSTOMER NAME", "START DATE", "MIN PACKS", "PERIOD MONTHS", "MANDATE MONTHS", "NOTES"]);
  if (ret.getLastRow() < 2) {
    ret.getRange(2, 1, 1, 6).setValues([[
      "Leo Cycles, Fishing and Sport", "2026-10-29", 300, 3, 6, "Check the start date = agreement commencement",
    ]]);
  }

  ensureSheet(ss, SALES_LINES_SHEET, ["INVOICE", "MODIFIED", "DATE", "CUSTOMER", "STATUS", "TOTAL", "BALANCE", "SKU", "ITEM", "QTY", "LINE TOTAL"]);
  ensureSheet(ss, DASHBOARD_SHEET, ["UPDATED", "JSON"]);

  // Timers
  const wanted = { syncZohoInvoices: "15min", refreshSalesData: "hourly", checkLowStock: "daily" };
  ScriptApp.getProjectTriggers()
    .filter(t => wanted[t.getHandlerFunction()])
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("syncZohoInvoices").timeBased().everyMinutes(15).create();
  ScriptApp.newTrigger("refreshSalesData").timeBased().everyHours(1).create();
  ScriptApp.newTrigger("checkLowStock").timeBased().everyDays(1).atHour(7).inTimezone("Africa/Johannesburg").create();

  refreshSalesData();
  Logger.log("Back office set up.");
}

function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function sheetRows(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
}

function packSize(sku) {
  const m = String(sku).match(/-(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function asDateText(value) {
  if (value instanceof Date) return Utilities.formatDate(value, "Africa/Johannesburg", "yyyy-MM-dd");
  return String(value || "").slice(0, 10);
}

// ───────────── 1. What to make for open orders ─────────────
// Open = not packed / shipped / completed / cancelled. Shortfall per SKU against
// what's Left on the shelf, plus the orders waiting on it.

function getMakeList(ss) {
  const inv = getInventory(ss).items;
  const bySku = {};
  inv.forEach(i => { bySku[i.sku.toUpperCase()] = i; });

  const orders = sheetRows(ss.getSheetByName(SHEET_NAME));
  const need = {};
  const openOrders = [];

  orders.forEach(r => {
    const orderNumber = String(r[0] || "").trim();
    if (!orderNumber) return;
    const status = String(r[COL.ORDER_STATUS - 1] || "").toLowerCase();
    const pay = String(r[COL.PAYMENT_STATUS - 1] || "").toLowerCase();
    if (DONE_STATUSES.includes(status) || pay === "void") return;
    openOrders.push({ orderNumber, customer: String(r[2] || ""), paymentStatus: String(r[COL.PAYMENT_STATUS - 1] || "") });

    String(r[COL.ITEMS - 1] || "").split("\n").forEach(line => {
      const qty = parseInt(line, 10);
      if (!(qty > 0)) return;
      const hasSku = line.includes("|");
      const sku = hasSku ? line.split("|").pop().trim().toUpperCase() : "";
      const label = (hasSku ? line.slice(0, line.lastIndexOf("|")) : line).replace(/^\s*\d+\s*x\s*/i, "").trim();
      const key = sku || `NOSKU:${label}`;
      if (!need[key]) need[key] = { sku, label, needed: 0, orders: [] };
      need[key].needed += qty;
      if (need[key].orders.indexOf(orderNumber) < 0) need[key].orders.push(orderNumber);
    });
  });

  const rows = Object.keys(need).map(key => {
    const n = need[key];
    const item = n.sku ? bySku[n.sku] : null;
    const left = item ? item.left : 0;
    const short = Math.max(n.needed - Math.max(left, 0), 0);
    return {
      sku: n.sku,
      label: item ? `${item.product} – ${item.colour}` : n.label,
      product: item ? item.product : "",
      tracked: Boolean(item),
      custom: /-CC-/.test(n.sku),
      needed: n.needed,
      left,
      short,
      baitsPerPack: packSize(n.sku),
      baitsToPour: short * packSize(n.sku),
      orders: n.orders,
    };
  });
  rows.sort((a, b) => b.short - a.short || a.label.localeCompare(b.label));
  return { success: true, rows, openOrders };
}

// ───────────── 2. Production batches: pour → cure → pack ─────────────
// Marking a batch Packed adds its packs to In Stock (once), so don't also scan
// those packs in with the scanner's Production mode.

function getBatches(ss) {
  const sh = ensureSheet(ss, PRODUCTION_SHEET, ["BATCH", "DATE POURED", "SKU", "COLOUR", "BAITS POURED", "PLASTISOL ML", "STATUS", "PACKS", "DATE PACKED", "NOTES"]);
  const batches = sheetRows(sh).filter(r => r[0]).map(r => ({
    batch: String(r[0]),
    datePoured: asDateText(r[1]),
    sku: String(r[2]),
    colour: String(r[3]),
    baits: num(r[4]),
    plastisolMl: num(r[5]),
    status: String(r[6] || "Curing"),
    packs: num(r[7]),
    datePacked: asDateText(r[8]),
    notes: String(r[9] || ""),
  }));
  batches.reverse();

  // Yield: baits per litre of plastisol, per product
  const yieldBy = {};
  batches.forEach(b => {
    if (!(b.plastisolMl > 0 && b.baits > 0)) return;
    const code = String(b.sku).replace(/^([A-Z]+)-[A-Z0-9]+-(\d+)-\d+$/i, "$1-$2");
    if (!yieldBy[code]) yieldBy[code] = { code, baits: 0, ml: 0, batches: 0 };
    yieldBy[code].baits += b.baits;
    yieldBy[code].ml += b.plastisolMl;
    yieldBy[code].batches++;
  });
  const yields = Object.keys(yieldBy).map(k => {
    const y = yieldBy[k];
    return { code: y.code, batches: y.batches, baitsPerLitre: Math.round((y.baits / y.ml) * 1000) };
  });
  return { success: true, batches: batches.slice(0, 150), yields };
}

function addBatch(ss, data) {
  const sku = String(data.sku || "").trim().toUpperCase();
  const baits = Math.floor(num(data.baits));
  if (!/^[A-Z]+-[A-Z0-9]+-\d+-\d+$/.test(sku)) return { success: false, error: "Enter a valid SKU" };
  if (!(baits > 0)) return { success: false, error: "Enter how many baits you poured" };

  const item = getInventory(ss).items.find(i => i.sku.toUpperCase() === sku);
  const sh = ensureSheet(ss, PRODUCTION_SHEET, ["BATCH"]);
  const now = new Date();
  const batch = `B${Utilities.formatDate(now, "Africa/Johannesburg", "yyMMdd-HHmm")}-${sku.split("-")[1]}`;
  sh.appendRow([
    batch, now, sku, item ? item.colour : "", baits,
    num(data.plastisolMl) || "", "Curing", "", "", String(data.notes || "").slice(0, 200),
  ]);
  return { success: true, batch, known: Boolean(item) };
}

function updateBatch(ss, data) {
  const sh = ensureSheet(ss, PRODUCTION_SHEET, ["BATCH"]);
  const rows = sheetRows(sh);
  const idx = rows.findIndex(r => String(r[0]) === String(data.batch));
  if (idx < 0) return { success: false, error: "Batch not found" };
  const row = idx + 2;
  const status = ["Poured", "Curing", "Packed"].includes(data.status) ? data.status : "Curing";

  if (status === "Packed") {
    const sku = String(rows[idx][2]);
    const baits = num(rows[idx][4]);
    const per = packSize(sku);
    const packs = Math.floor(num(data.packs)) || (per ? Math.floor(baits / per) : 0);
    if (!(packs > 0)) return { success: false, error: "How many packs did this batch make?" };
    const result = stockIn(ss, { mode: "production", reference: `BATCH ${data.batch}`, items: [{ sku, qty: packs }] });
    sh.getRange(row, 7, 1, 3).setValues([["Packed", packs, new Date()]]);
    return { success: true, packs, addedToStock: (result.updated || 0) > 0, unknown: result.unknown || [] };
  }
  sh.getRange(row, 7).setValue(status);
  return { success: true };
}

// ───────────── 3 + 6. Sales dashboard & retailer minimums (from Zoho) ─────────────
// refreshSalesData() runs hourly: it copies invoice lines into "Sales Lines"
// (only re-fetching invoices that changed) and stores a summary for the back office.

function refreshSalesData() {
  const props = PropertiesService.getScriptProperties();
  const orgId = props.getProperty("ZOHO_ORG_ID");
  if (!orgId || !props.getProperty("ZOHO_REFRESH_TOKEN")) return;

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const auth = zohoAuth();
  const linesSheet = ensureSheet(ss, SALES_LINES_SHEET, ["INVOICE", "MODIFIED", "DATE", "CUSTOMER", "STATUS", "TOTAL", "BALANCE", "SKU", "ITEM", "QTY", "LINE TOTAL"]);

  // Lines we already have, keyed by invoice + last-modified
  const cached = {};
  sheetRows(linesSheet).forEach(r => {
    const key = `${r[0]}|${r[1]}`;
    (cached[key] = cached[key] || []).push(r);
  });

  const invoices = [];
  for (let page = 1; page <= 10; page++) {
    const list = zohoGet(auth, `/invoices?organization_id=${orgId}&per_page=200&page=${page}`);
    (list.invoices || []).forEach(i => invoices.push(i));
    if (!list.page_context || !list.page_context.has_more_page) break;
  }

  const out = [];
  invoices.forEach(i => {
    if (i.status === "draft" || i.status === "void") return;
    const modified = `M:${i.last_modified_time}`; // "M:" keeps Sheets from turning it into a date
    const key = `${i.invoice_number}|${modified}`;
    if (cached[key]) {
      // keep status / balance fresh without re-fetching the lines
      cached[key].forEach(r => { r[4] = i.status; r[6] = num(i.balance); out.push(r); });
      return;
    }
    const detail = zohoGet(auth, `/invoices/${i.invoice_id}?organization_id=${orgId}`);
    const lines = (detail.invoice && detail.invoice.line_items) || [];
    if (!lines.length) {
      out.push([i.invoice_number, modified, i.date, i.customer_name, i.status, num(i.total), num(i.balance), "", "", 0, 0]);
    }
    lines.forEach(li => out.push([
      i.invoice_number, modified, i.date, i.customer_name, i.status,
      num(i.total), num(i.balance), String(li.sku || "").trim().toUpperCase(), li.name, num(li.quantity), num(li.item_total),
    ]));
    Utilities.sleep(300);
  });

  linesSheet.getRange(2, 1, Math.max(linesSheet.getLastRow() - 1, 1), 11).clearContent();
  if (out.length) linesSheet.getRange(2, 1, out.length, 11).setValues(out);

  // Expenses
  const expenses = [];
  for (let page = 1; page <= 5; page++) {
    const list = zohoGet(auth, `/expenses?organization_id=${orgId}&per_page=200&page=${page}`);
    (list.expenses || []).forEach(e => expenses.push({ date: e.date, account: e.account_name, total: num(e.total) }));
    if (!list.page_context || !list.page_context.has_more_page) break;
  }

  const summary = buildSalesSummary(out, expenses, ss);
  const dash = ensureSheet(ss, DASHBOARD_SHEET, ["UPDATED", "JSON"]);
  dash.getRange(2, 1, 1, 2).setValues([[new Date(), JSON.stringify(summary)]]);
}

function buildSalesSummary(lines, expenses, ss) {
  const invoices = {};
  lines.forEach(r => {
    const [num_, , date, customer, status, total, balance, sku, item, qty, lineTotal] = r;
    if (!invoices[num_]) invoices[num_] = { invoice: num_, date: asDateText(date), customer, status, total: num(total), balance: num(balance), lines: [] };
    invoices[num_].status = status;
    invoices[num_].balance = num(balance);
    if (sku || item) invoices[num_].lines.push({ sku, item, qty: num(qty), lineTotal: num(lineTotal) });
  });
  const list = Object.keys(invoices).map(k => invoices[k]);

  const months = {};
  const month = d => String(d).slice(0, 7);
  const bump = m => (months[m] = months[m] || { month: m, revenue: 0, collected: 0, expenses: 0, invoices: 0, packs: 0 });

  const customers = {};
  const products = {};
  const skus = {};
  list.forEach(inv => {
    const m = bump(month(inv.date));
    m.revenue += inv.total;
    m.collected += inv.total - inv.balance;
    m.invoices++;
    customers[inv.customer] = (customers[inv.customer] || 0) + inv.total;
    inv.lines.forEach(l => {
      if (!/^[A-Z]+-[A-Z0-9]+-\d+-\d+$/.test(l.sku)) return; // baits only
      m.packs += l.qty;
      const code = l.sku.replace(/^([A-Z]+)-[A-Z0-9]+-(\d+)-\d+$/, "$1-$2");
      const productName = String(l.item).replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
      if (!products[code]) products[code] = { code, name: PRODUCT_NAMES[code] || code, packs: 0, value: 0 };
      products[code].packs += l.qty;
      products[code].value += l.lineTotal;
      if (!skus[l.sku]) skus[l.sku] = { sku: l.sku, name: productName, packs: 0, value: 0 };
      skus[l.sku].packs += l.qty;
      skus[l.sku].value += l.lineTotal;
    });
  });

  const expenseBy = {};
  expenses.forEach(e => {
    bump(month(e.date)).expenses += e.total;
    expenseBy[e.account] = (expenseBy[e.account] || 0) + e.total;
  });

  const monthList = Object.keys(months).sort().map(k => {
    const m = months[k];
    return Object.assign(m, { profit: m.revenue - m.expenses });
  });
  const round = n => Math.round(n * 100) / 100;
  const totals = monthList.reduce((t, m) => {
    t.revenue += m.revenue; t.collected += m.collected; t.expenses += m.expenses; t.packs += m.packs; t.invoices += m.invoices;
    return t;
  }, { revenue: 0, collected: 0, expenses: 0, packs: 0, invoices: 0 });
  totals.outstanding = totals.revenue - totals.collected;
  totals.profit = totals.revenue - totals.expenses;
  Object.keys(totals).forEach(k => { totals[k] = round(totals[k]); });

  return {
    updated: new Date().toISOString(),
    totals,
    months: monthList.map(m => ({ month: m.month, revenue: round(m.revenue), collected: round(m.collected), expenses: round(m.expenses), profit: round(m.profit), invoices: m.invoices, packs: m.packs })),
    outstanding: list.filter(i => i.balance > 0).map(i => ({ invoice: i.invoice, customer: i.customer, date: i.date, balance: i.balance, status: i.status })),
    topCustomers: Object.keys(customers).map(c => ({ customer: c, total: round(customers[c]) })).sort((a, b) => b.total - a.total).slice(0, 8),
    products: Object.keys(products).map(k => products[k]).sort((a, b) => b.packs - a.packs),
    topSkus: Object.keys(skus).map(k => skus[k]).sort((a, b) => b.packs - a.packs).slice(0, 12),
    expenseAccounts: Object.keys(expenseBy).map(a => ({ account: a, total: round(expenseBy[a]) })).sort((a, b) => b.total - a.total),
    retailers: retailerProgress(list, ss),
  };
}

// Rolling minimum-purchase periods for each retailer on the Retailers tab.
function retailerProgress(invoiceList, ss) {
  const sh = ensureSheet(ss, RETAILER_SHEET, ["ZOHO CUSTOMER NAME"]);
  const today = new Date();
  return sheetRows(sh).filter(r => r[0]).map(r => {
    const customer = String(r[0]).trim();
    const start = r[1] instanceof Date ? r[1] : new Date(`${asDateText(r[1])}T00:00:00`);
    const minPacks = num(r[2]) || 0;
    const periodMonths = num(r[3]) || 3;
    const mandateMonths = num(r[4]) || 6;
    const addMonths = (d, n) => { const x = new Date(d.getTime()); x.setMonth(x.getMonth() + n); return x; };
    const mandateEnd = addMonths(start, mandateMonths);

    const mine = invoiceList.filter(i => i.customer.trim().toLowerCase() === customer.toLowerCase());
    const periods = [];
    for (let p = 0; p * periodMonths < mandateMonths; p++) {
      const from = addMonths(start, p * periodMonths);
      const to = addMonths(start, (p + 1) * periodMonths);
      let packs = 0, value = 0, orders = 0;
      mine.forEach(i => {
        const d = new Date(`${i.date}T00:00:00`);
        if (d >= from && d < to) {
          orders++;
          value += i.total;
          i.lines.forEach(l => { if (/^[A-Z]+-[A-Z0-9]+-\d+-\d+$/.test(l.sku)) packs += l.qty; });
        }
      });
      const daysLeft = Math.max(Math.ceil((to - today) / 86400000), 0);
      periods.push({
        from: asDateText(from), to: asDateText(addMonths(to, 0)), packs, value: Math.round(value), orders,
        target: minPacks, current: today >= from && today < to, daysLeft,
        status: packs >= minPacks ? "met" : today >= to ? "missed" : today >= from ? "in progress" : "upcoming",
      });
    }
    const before = mine.filter(i => new Date(`${i.date}T00:00:00`) < start);
    return {
      customer, start: asDateText(start), mandateEnd: asDateText(mandateEnd), minPacks, periodMonths,
      periods,
      ordersBeforeStart: before.length,
      lastOrder: mine.length ? mine.map(i => i.date).sort().pop() : "",
    };
  });
}

function getSales() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const dash = ensureSheet(ss, DASHBOARD_SHEET, ["UPDATED", "JSON"]);
  const raw = dash.getLastRow() >= 2 ? String(dash.getRange(2, 2).getValue() || "") : "";
  if (!raw) return { success: true, summary: null };
  return { success: true, summary: JSON.parse(raw) };
}

// ───────────── 4. Low-stock email, every morning ─────────────

function checkLowStock() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const items = getInventory(ss).items.filter(i => i.par > 0 && i.left < i.par);
  const make = getMakeList(ss).rows.filter(r => r.short > 0);
  if (!items.length && !make.length) return;

  const props = PropertiesService.getScriptProperties();
  const to = props.getProperty("ALERT_EMAIL") || "geronimocustombaits@gmail.com";
  const rows = list => list.map(x => `<li>${x}</li>`).join("");

  const out = items.filter(i => i.left <= 0);
  const low = items.filter(i => i.left > 0);
  const html = [
    `<h2 style="margin:0">Geronimo Baits · stock check</h2>`,
    make.length ? `<h3>Short for open orders (${make.length})</h3><ul>${rows(make.map(r => `<b>${r.label}</b>: need ${r.needed}, have ${Math.max(r.left, 0)} → make ${r.short} pack(s) · ${r.orders.join(", ")}`))}</ul>` : "",
    out.length ? `<h3>Out of stock (${out.length})</h3><ul>${rows(out.map(i => `${i.product} – ${i.colour} (${i.sku}): 0 left, par ${i.par}`))}</ul>` : "",
    low.length ? `<h3>Below par (${low.length})</h3><ul>${rows(low.map(i => `${i.product} – ${i.colour} (${i.sku}): ${i.left} left, par ${i.par}`))}</ul>` : "",
    `<p style="color:#777">Sent by your Geronimo back office every morning. Change the address in Script properties → ALERT_EMAIL.</p>`,
  ].join("");

  MailApp.sendEmail({
    to,
    subject: `Geronimo stock: ${make.length ? `${make.length} short for orders · ` : ""}${out.length} out · ${low.length} low`,
    htmlBody: html,
  });
}

// ───────────── 5. Ambassador referral codes ─────────────
// Orders carry the code in REFERRAL (col R): from the website checkout, or set in
// the back office. Only PAID orders count, one code per order, and never the
// ambassador's own orders (OWN CUSTOMER NAME on the Ambassadors tab).

function readAmbassadors(ss) {
  const sh = ensureSheet(ss, AMBASSADOR_SHEET, ["CODE"]);
  return sheetRows(sh).map((r, i) => ({
    row: i + 2,
    code: String(r[0] || "").trim().toUpperCase(),
    name: String(r[1] || ""),
    level: String(r[2] || ""),
    ownCustomer: String(r[3] || "").trim().toLowerCase(),
    threshold: num(r[4]) || 20,
    claimed: num(r[5]),
    active: !/^no$/i.test(String(r[6] || "Yes").trim()),
  })).filter(a => a.code);
}

function getAmbassadors(ss) {
  const ambassadors = readAmbassadors(ss);
  const byCode = {};
  ambassadors.forEach(a => { byCode[a.code] = Object.assign({}, a, { orders: 0, packs: 0, value: 0, recent: [] }); });

  sheetRows(ss.getSheetByName(SHEET_NAME)).forEach(r => {
    const code = String(r[COL.REFERRAL - 1] || "").trim().toUpperCase();
    const a = byCode[code];
    if (!a) return;
    const paid = String(r[COL.PAYMENT_STATUS - 1] || "").toLowerCase().startsWith("paid");
    const cancelled = String(r[COL.ORDER_STATUS - 1] || "").toLowerCase() === "cancelled";
    const customer = String(r[2] || "").trim().toLowerCase();
    if (!paid || cancelled) return;
    if (a.ownCustomer && customer === a.ownCustomer) return; // own orders never count
    const packs = parseOrderItems(r[COL.ITEMS - 1]).reduce((s, i) => s + i.qty, 0);
    a.orders++;
    a.packs += packs;
    a.value += num(r[9]);
    a.recent.push({ orderNumber: String(r[0]), customer: String(r[2]), packs, date: asDateText(r[1]) });
  });

  const board = Object.keys(byCode).map(k => {
    const a = byCode[k];
    const earned = Math.floor(a.packs / a.threshold);
    return {
      code: a.code, name: a.name, level: a.level, active: a.active, threshold: a.threshold,
      orders: a.orders, packs: a.packs, value: Math.round(a.value),
      earned, claimed: a.claimed, available: Math.max(earned - a.claimed, 0),
      toNext: a.threshold - (a.packs % a.threshold),
      recent: a.recent.slice(-5).reverse(),
    };
  }).sort((x, y) => y.packs - x.packs);
  return { success: true, ambassadors: board };
}

function claimReward(ss, data) {
  const code = String(data.code || "").trim().toUpperCase();
  const a = readAmbassadors(ss).find(x => x.code === code);
  if (!a) return { success: false, error: "Unknown ambassador code" };
  const board = getAmbassadors(ss).ambassadors.find(x => x.code === code);
  if (!board || board.available < 1) return { success: false, error: "No free packs to claim yet" };
  const sh = ss.getSheetByName(AMBASSADOR_SHEET);
  sh.getRange(a.row, 6).setValue(a.claimed + 1);
  return { success: true, claimed: a.claimed + 1 };
}

function setReferral(ss, sheet, data) {
  const row = findRow(sheet, data.orderNumber);
  if (row < 0) return { success: false, error: "Order not found" };
  const code = String(data.code || "").trim().toUpperCase();
  if (code && !readAmbassadors(ss).some(a => a.code === code)) return { success: false, error: "Unknown ambassador code" };
  sheet.getRange(row, COL.REFERRAL).setValue(code);
  return { success: true };
}
