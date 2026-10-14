/**
 * Geronimo Baits — Orders & Stock web app (Google Apps Script)
 *
 * Orders tab:   new website orders, payment status, order status.
 * Inventory tab: the ONE stock count. Left = In Stock − Sold.
 * Stock Log tab: every stock change, so nothing is counted twice and you
 *                can always see why a number changed (created automatically).
 *
 * Stock changes come from:
 *   • Website orders marked Paid            → adds to Sold
 *   • Zoho Books invoices (every 15 min)    → adds to Sold (voided → put back)
 *   • Phone scanner: Production             → adds to In Stock
 *   • Phone scanner: Stocktake              → sets Left to the counted amount
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

  // Paid (including "Paid - CHECK AMOUNT") → take the packs off stock.
  // An AMOUNT MISMATCH order is on hold, so stock is left alone.
  if (String(status).toLowerCase().startsWith("paid")) {
    const items = parseOrderItems(sheet.getRange(row, COL.ITEMS).getValue());
    recordSale(ss, items, String(data.orderNumber), "Website");
  }
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
      const sku = (line.split("|").pop() || "").trim();
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
          reverseSale(ss, reference, "Zoho");
          return;
        }
        if (inv.status === "draft") return; // counted once it's sent

        const detail = zohoGet(auth, `/invoices/${inv.invoice_id}?organization_id=${orgId}`);
        const items = ((detail.invoice && detail.invoice.line_items) || [])
          .map(li => ({ sku: String(li.sku || "").trim(), qty: num(li.quantity) }))
          .filter(i => i.sku && i.qty > 0);
        recordSale(ss, items, reference, "Zoho");
      });

      if (reachedOld || !list.page_context || !list.page_context.has_more_page) break;
    }
    props.setProperty("ZOHO_LAST_SYNC", String(startedAt));
  } finally {
    lock.releaseLock();
  }
}
