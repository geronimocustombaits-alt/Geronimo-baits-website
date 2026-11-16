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
  ZOHO_INVOICE: 19,    // S  Zoho invoice linked to a dealer order
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
      deleteBatch: () => deleteBatch(ss, data),
      getSales: () => getSales(),
      refreshSales: () => { refreshSalesData(); return getSales(); },
      getAmbassadors: () => getAmbassadors(ss),
      claimReward: () => claimReward(ss, data),
      setReferral: () => setReferral(ss, sheet, data),
      getDealers: () => getDealers(ss),
      getDealer: () => getDealer(ss, data),
      addDealerOrder: () => addDealerOrder(ss, sheet, data),
      linkInvoice: () => linkInvoice(sheet, data),
    };
    if (BACK_OFFICE[data.action]) {
      if (!secretOk(data)) return json({ success: false, error: "Not allowed" });
      return json(BACK_OFFICE[data.action]());
    }
    if (data.action === "getInventory") {
      if (!secretOk(data)) return json({ success: false, error: "Not allowed" });
      return json(getInventory(ss));
    }
    if (data.action === "packProgress") {
      if (!secretOk(data)) return json({ success: false, error: "Not allowed" });
      return json(packProgress(ss, sheet, data));
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

// Phone scanner. mode "production": add to In Stock, and take the baits off the
//                                   oldest open Production batch of that SKU.
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
  const fromBatches = [];
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
      // Packs coming from "Packed" on the Production page already belong to that batch
      const used = data.fromBatch ? [] : takeFromBatches(ss, sku, qty);
      used.forEach(u => fromBatches.push(u));
      const note = used.map(u => `${u.batch}: ${u.packs} pack(s)${u.closed ? " - batch done" : ""}`).join("; ");
      log.appendRow([new Date(), "PRODUCTION", sku, qty, reference, data.fromBatch ? "Production page" : "Scanner", note]);
    }
    updated++;
  });

  return { success: true, updated, unknown, fromBatches };
}

// Scanned production packs come out of the open batches for that SKU, oldest
// first. PACKS (col H) counts packs packed so far; once fewer baits are left
// than make a full pack, the batch is marked Packed. Packs beyond what the open
// batches hold still go into stock, they just aren't linked to a batch.
function takeFromBatches(ss, sku, packs) {
  const per = packSize(sku);
  const sh = ss.getSheetByName(PRODUCTION_SHEET);
  if (!sh || !(per > 0) || !(packs > 0)) return [];
  const rows = sheetRows(sh);
  const used = [];
  let toPlace = packs;
  rows.forEach((r, idx) => {
    if (toPlace <= 0) return;
    if (String(r[2]).trim().toUpperCase() !== String(sku).toUpperCase()) return;
    if (String(r[6]) === "Packed") return;
    const done = num(r[7]);
    const room = Math.floor(num(r[4]) / per) - done; // packs this batch can still make
    if (room <= 0) return;
    const take = Math.min(room, toPlace);
    toPlace -= take;
    const closed = take === room;
    const row = idx + 2;
    sh.getRange(row, 7, 1, 3).setValues([[closed ? "Packed" : "Packing", done + take, closed ? new Date() : ""]]);
    used.push({ batch: String(r[0]), packs: take, closed });
  });
  return used;
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
    // A dealer order already on the Orders tab that this invoice was linked to:
    // only refresh its payment, so the order isn't listed (or packed) twice.
    const linked = findLinkedRow(sheet, invoice.invoice_number);
    if (linked > 0) {
      const payment = zohoPaymentStatus(invoice);
      sheet.getRange(linked, COL.PAYMENT_STATUS).setValue(payment === "Pending" || payment === "Draft" ? "Invoiced" : payment);
      sheet.getRange(linked, COL.AMOUNT_PAID).setValue(paid > 0 ? paid : "");
      return;
    }
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
  if (row < 0) {
    // Linked dealer order: the order itself still stands, only the invoice went
    const linked = findLinkedRow(sheet, invoiceNumber);
    if (linked > 0) {
      sheet.getRange(linked, COL.PAYMENT_STATUS).setValue("Invoice voided - CHECK");
      sheet.getRange(linked, COL.ZOHO_INVOICE).setValue("");
    }
    return;
  }
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
// A part send (data.partial) takes off only what was scanned (reference
// "PACK <order> #n") and sets ORDER STATUS to "Part sent (x to follow)".

function totalsBySku(items) {
  const totals = {};
  items.forEach(i => {
    const sku = String(i.sku || "").trim().toUpperCase();
    const qty = Math.floor(num(i.qty));
    if (sku && qty > 0) totals[sku] = (totals[sku] || 0) + qty;
  });
  return totals;
}

// Packs already sent for an order, per SKU, from the Stock Log.
// Counts the full pack ("PACK <order>") and part sends ("PACK <order> #2" …).
function packedSoFar(log, orderNumber) {
  const base = `PACK ${orderNumber}`;
  const totals = {};
  const refs = {};
  const last = log.getLastRow();
  if (last < 2) return { totals, sends: 0 };
  log.getRange(2, 2, last - 1, 4).getValues().forEach(r => { // TYPE, SKU, QTY, REFERENCE
    const ref = String(r[3]);
    if (r[0] !== "SALE" || !(ref === base || ref.indexOf(base + " #") === 0)) return;
    const sku = String(r[1]).trim().toUpperCase();
    totals[sku] = (totals[sku] || 0) + Math.abs(num(r[2]));
    refs[ref] = true;
  });
  return { totals, sends: Object.keys(refs).length };
}

// Part sends are for dealer orders only: a dealer-link order, or a customer
// listed in the Retailers tab (e.g. Leo Cycles, Rod and Reel Leisure).
function isDealerOrder(ss, sheet, row) {
  const values = sheet.getRange(row, 1, 1, 11).getValues()[0];
  if (String(values[10] || "").trim().toLowerCase() === "dealer") return true; // K = payment method
  const customer = String(values[2] || "").trim().toLowerCase(); // C = customer name
  if (!customer) return false;
  const sh = dealerSheet(ss);
  if (sh.getLastRow() < 2) return false;
  return sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues()
    .some(r => String(r[0] || "").trim().toLowerCase() === customer);
}

// What's still to send for an order (for the packing screen).
function packProgress(ss, sheet, data) {
  const orderNumber = String(data.orderNumber || "").trim();
  const row = orderNumber ? findRow(sheet, orderNumber) : -1;
  if (row < 0) return { success: false, error: "Order not found in the Orders tab" };
  const { totals, sends } = packedSoFar(logSheet(ss), orderNumber);
  return { success: true, packed: totals, sends, dealer: isDealerOrder(ss, sheet, row) };
}

// data.partial = true → (dealer orders only) send part of the order now (scans may be less than
// what's left, never more). Otherwise the scans must be exactly what's left.
function packOrder(ss, sheet, data) {
  const orderNumber = String(data.orderNumber || "").trim();
  const row = orderNumber ? findRow(sheet, orderNumber) : -1;
  if (row < 0) return { success: false, error: "Order not found in the Orders tab" };

  const status = String(sheet.getRange(row, COL.ORDER_STATUS).getValue()).toLowerCase();
  if (status === "cancelled") return { success: false, error: "This order is cancelled" };

  const needed = totalsBySku(parseOrderItems(sheet.getRange(row, COL.ITEMS).getValue()));
  const scanned = totalsBySku(data.items || []);
  const partial = data.partial === true;
  if (partial && !isDealerOrder(ss, sheet, row)) {
    return { success: false, error: "Part sends are only for dealer orders. Scan the full order to pack it." };
  }

  const log = logSheet(ss);
  const done = packedSoFar(log, orderNumber);
  const remaining = {};
  Object.keys(needed).forEach(sku => {
    remaining[sku] = Math.max(needed[sku] - (done.totals[sku] || 0), 0);
  });
  const leftTotal = Object.keys(remaining).reduce((t, k) => t + remaining[k], 0);

  // Already fully packed under the old rule (one "PACK <order>" for everything)?
  if (leftTotal === 0) {
    sheet.getRange(row, COL.ORDER_STATUS).setValue("Packed");
    return { success: true, deducted: false, complete: true };
  }

  const problems = [];
  Object.keys(scanned).forEach(sku => {
    if (!(sku in needed)) problems.push(`${sku} is not on this order`);
    else if (scanned[sku] > remaining[sku]) problems.push(`${sku}: scanned ${scanned[sku]}, only ${remaining[sku]} still to send`);
  });
  if (!partial) {
    Object.keys(remaining).forEach(sku => {
      const got = scanned[sku] || 0;
      if (remaining[sku] > 0 && got < remaining[sku]) problems.push(`${sku}: scanned ${got} of ${remaining[sku]}`);
    });
  }
  const scannedTotal = Object.keys(scanned).reduce((t, k) => t + scanned[k], 0);
  if (partial && scannedTotal === 0) problems.push("Nothing scanned yet");
  if (problems.length) return { success: false, error: "Scans don't match the order", problems };

  // First and only send keeps the old reference; part sends are numbered.
  const complete = scannedTotal === leftTotal;
  const packRef = done.sends === 0 && complete ? `PACK ${orderNumber}` : `PACK ${orderNumber} #${done.sends + 1}`;
  const items = Object.keys(scanned).map(sku => ({ sku, qty: scanned[sku] }));
  recordSale(ss, items, packRef, partial ? "Packing (part)" : "Packing");

  const stillLeft = leftTotal - scannedTotal;
  sheet.getRange(row, COL.ORDER_STATUS).setValue(complete ? "Packed" : `Part sent (${stillLeft} to follow)`);
  return { success: true, deducted: true, complete, sent: scannedTotal, stillLeft };
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
// Scanning packs in with the scanner's Production mode takes them off the oldest
// open batch of that SKU (see takeFromBatches). Marking a batch Packed here only
// adds the packs that weren't scanned already.

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

// Remove a batch row (e.g. logged by mistake). Stock isn't touched: packs
// already scanned in from it stay in stock.
function deleteBatch(ss, data) {
  const sh = ensureSheet(ss, PRODUCTION_SHEET, ["BATCH"]);
  const rows = sheetRows(sh);
  const idx = rows.findIndex(r => String(r[0]) === String(data.batch));
  if (idx < 0) return { success: false, error: "Batch not found" };
  sh.deleteRow(idx + 2);
  return { success: true };
}

function updateBatch(ss, data) {
  const sh = ensureSheet(ss, PRODUCTION_SHEET, ["BATCH"]);
  const rows = sheetRows(sh);
  const idx = rows.findIndex(r => String(r[0]) === String(data.batch));
  if (idx < 0) return { success: false, error: "Batch not found" };
  const row = idx + 2;

  // Top up an open batch with more baits (e.g. a second pour of the same colour)
  if (data.addBaits) {
    const more = Math.floor(num(data.addBaits));
    if (!(more > 0)) return { success: false, error: "Enter how many baits to add" };
    if (String(rows[idx][6]) === "Packed") return { success: false, error: "That batch is already packed" };
    const baits = num(rows[idx][4]) + more;
    sh.getRange(row, 5).setValue(baits);
    return { success: true, baits };
  }

  const status = ["Poured", "Curing", "Packing", "Packed"].includes(data.status) ? data.status : "Curing";

  if (status === "Packed") {
    const sku = String(rows[idx][2]);
    const baits = num(rows[idx][4]);
    const per = packSize(sku);
    const packs = Math.floor(num(data.packs)) || (per ? Math.floor(baits / per) : 0);
    if (!(packs > 0)) return { success: false, error: "How many packs did this batch make?" };
    const scanned = num(rows[idx][7]); // packs already scanned in from this batch
    const extra = Math.max(packs - scanned, 0);
    let added = 0;
    if (extra > 0) {
      const result = stockIn(ss, { mode: "production", fromBatch: true, reference: `BATCH ${data.batch}`, items: [{ sku, qty: extra }] });
      if (!(result.updated > 0) && !result.skipped) return { success: false, error: `${sku} isn't on the Inventory tab` };
      added = result.skipped ? 0 : extra;
    }
    sh.getRange(row, 7, 1, 3).setValues([["Packed", Math.max(packs, scanned), new Date()]]);
    return { success: true, packs: added, scanned, addedToStock: added > 0 };
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
    recap: buildRecap(list, expenses, ss),
  };
}

// Monthly recap for the back office: per month, the headline numbers plus best
// sellers by bait, colour and SKU, top customers, the biggest order, new vs
// returning customers and packs made (PRODUCTION lines on the Stock Log).
function buildRecap(list, expenses, ss) {
  const round = n => Math.round(n * 100) / 100;
  const month = d => String(d).slice(0, 7);
  const BAIT_SKU = /^[A-Z]+-[A-Z0-9]+-\d+-\d+$/;

  // SKU → colour / bait from the Inventory tab
  const colourBySku = {};
  const productBySku = {};
  const productByCode = {}; // e.g. WV-45 → Warvipers 4.5", so custom colours land on the right bait
  try {
    getInventory(ss).items.forEach(i => {
      colourBySku[i.sku.toUpperCase()] = i.colour;
      productBySku[i.sku.toUpperCase()] = i.product;
      productByCode[i.sku.toUpperCase().replace(/^([A-Z]+)-[A-Z0-9]+-(\d+)-\d+$/, "$1-$2")] = i.product;
    });
  } catch (e) { /* recap still works without names */ }

  const firstSeen = {};
  list.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).forEach(inv => {
    const c = String(inv.customer || "").trim().toLowerCase();
    if (c && !firstSeen[c]) firstSeen[c] = month(inv.date);
  });

  const out = {};
  const get = m => (out[m] = out[m] || {
    month: m, revenue: 0, collected: 0, expenses: 0, orders: 0, packs: 0, packsMade: 0,
    customers: {}, newCustomers: {}, products: {}, colours: {}, skus: {}, biggest: null,
  });

  list.forEach(inv => {
    const m = get(month(inv.date));
    const cKey = String(inv.customer || "").trim();
    m.revenue += inv.total;
    m.collected += inv.total - inv.balance;
    m.orders++;
    if (cKey) {
      m.customers[cKey] = (m.customers[cKey] || 0) + inv.total;
      if (firstSeen[cKey.toLowerCase()] === m.month) m.newCustomers[cKey] = true;
    }
    if (!m.biggest || inv.total > m.biggest.total) m.biggest = { invoice: inv.invoice, customer: cKey, total: round(inv.total), date: inv.date };
    inv.lines.forEach(l => {
      const sku = String(l.sku || "").toUpperCase();
      if (!BAIT_SKU.test(sku)) return;
      m.packs += l.qty;
      const code = sku.replace(/^([A-Z]+)-[A-Z0-9]+-(\d+)-\d+$/, "$1-$2");
      const bait = productBySku[sku] || productByCode[code] || PRODUCT_NAMES[code] || code;
      const colour = /-CC-/.test(sku) ? "Custom colour" : colourBySku[sku] || sku.split("-")[1];
      const add = (bucket, key, extra) => {
        bucket[key] = bucket[key] || Object.assign({ packs: 0, value: 0 }, extra);
        bucket[key].packs += l.qty;
        bucket[key].value += l.lineTotal;
      };
      add(m.products, bait, { name: bait });
      add(m.colours, colour, { name: colour });
      add(m.skus, sku, { sku, name: `${bait} – ${colour}` });
    });
  });

  expenses.forEach(e => { get(month(e.date)).expenses += e.total; });

  try {
    sheetRows(logSheet(ss)).forEach(r => {
      if (String(r[1]) !== "PRODUCTION") return;
      const d = r[0] instanceof Date ? Utilities.formatDate(r[0], "Africa/Johannesburg", "yyyy-MM") : month(r[0]);
      get(d).packsMade += num(r[3]);
    });
  } catch (e) { /* no stock log yet */ }

  const top = (bucket, n) => Object.keys(bucket).map(k => bucket[k])
    .map(x => Object.assign({}, x, { value: round(x.value) }))
    .sort((a, b) => b.packs - a.packs || b.value - a.value).slice(0, n);

  return Object.keys(out).sort().map(k => {
    const m = out[k];
    const customerNames = Object.keys(m.customers);
    return {
      month: m.month,
      revenue: round(m.revenue),
      collected: round(m.collected),
      expenses: round(m.expenses),
      profit: round(m.revenue - m.expenses),
      orders: m.orders,
      packs: m.packs,
      packsMade: m.packsMade,
      avgOrder: m.orders ? round(m.revenue / m.orders) : 0,
      customers: customerNames.length,
      newCustomers: Object.keys(m.newCustomers),
      biggest: m.biggest,
      topProducts: top(m.products, 6),
      topColours: top(m.colours, 8),
      topSkus: top(m.skus, 10),
      topCustomers: customerNames.map(c => ({ customer: c, total: round(m.customers[c]) })).sort((a, b) => b.total - a.total).slice(0, 6),
    };
  });
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


// ═════════════════════════════ Dealer orders ═════════════════════════════
// Each shop on the Retailers tab gets a private order link (/dealer/<code>).
// Their order lands on the Orders tab as a "Dealer" order (ORDER # DL-…),
// priced at dealer prices, so it's packed and scanned like any other order.
// Once you've invoiced it in Zoho, link the invoice number on the dashboard
// (column S): the Zoho sync then updates that order's payment instead of
// adding the invoice as a second order. Minimum-purchase progress keeps
// coming from the Zoho invoices, as before.
//
// Retailers tab columns G–L (added automatically):
//   ORDER CODE (filled in for you), CONTACT NAME, PHONE, EMAIL, DELIVERY,
//   EXTRA COLOURS: colours to list with the shop's own even if it hasn't
//   ordered them yet. SKU, optionally followed by the colour name, separated
//   by commas: "WC-SS-33-08, WB-JC-43-06 Jungle Camo, SWB-BM-50-06 Junebug"
//   AMBASSADORS (column M): names, comma-separated, of the ambassadors the
//   shop gives the ambassador discount to ("Johan, JJ, Hendre"). The shop
//   reports those sales on its next order and the discount comes off it.

const DEALER_COLS = ["ORDER CODE", "CONTACT NAME", "PHONE", "EMAIL", "DELIVERY", "EXTRA COLOURS", "AMBASSADORS"];
const DEALER_FIRST_COL = 7; // G

function dealerSheet(ss) {
  const sh = ensureSheet(ss, RETAILER_SHEET, ["ZOHO CUSTOMER NAME", "START DATE", "MIN PACKS", "PERIOD MONTHS", "MANDATE MONTHS", "NOTES"]);
  const head = sh.getRange(1, DEALER_FIRST_COL, 1, DEALER_COLS.length).getValues()[0];
  if (head.some((h, i) => String(h).trim() !== DEALER_COLS[i])) {
    sh.getRange(1, DEALER_FIRST_COL, 1, DEALER_COLS.length).setValues([DEALER_COLS]).setFontWeight("bold");
  }
  return sh;
}

function newDealerCode() {
  return Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase();
}

// Every shop on the Retailers tab, with its order code (made if missing)
function readDealers(ss) {
  const sh = dealerSheet(ss);
  if (sh.getLastRow() < 2) return [];
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, DEALER_FIRST_COL + DEALER_COLS.length - 1).getValues();
  const out = [];
  rows.forEach((r, i) => {
    const name = String(r[0] || "").trim();
    if (!name) return;
    let code = String(r[DEALER_FIRST_COL - 1] || "").trim().toUpperCase();
    if (!code) {
      code = newDealerCode();
      sh.getRange(i + 2, DEALER_FIRST_COL).setValue(code);
    }
    const phone = String(r[DEALER_FIRST_COL + 1] || "").trim();
    out.push({
      row: i + 2,
      name,
      code,
      contactName: String(r[DEALER_FIRST_COL] || "").trim(),
      phone: phone.replace(/^'/, ""),
      email: String(r[DEALER_FIRST_COL + 2] || "").trim(),
      delivery: String(r[DEALER_FIRST_COL + 3] || "").trim(),
      minPacks: num(r[2]) || 0,
      extra: String(r[DEALER_FIRST_COL + 4] || "")
        .split(/[,;\n]+/)
        .map(x => {
          const m = x.trim().match(/^([A-Za-z]+-[A-Za-z0-9]+-\d+-\d+)\s*(.*)$/);
          return m ? { sku: m[1].toUpperCase(), colour: m[2].trim() } : null;
        })
        .filter(Boolean),
      ambassadors: String(r[DEALER_FIRST_COL + 5] || "")
        .split(/[,;\n]+/)
        .map(x => x.trim())
        .filter(Boolean),
    });
  });
  return out;
}

function getDealers(ss) {
  return { success: true, dealers: readDealers(ss).map(d => ({ name: d.name, code: d.code, contactName: d.contactName, phone: d.phone })) };
}

function findDealer(ss, code) {
  const c = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{8,20}$/.test(c)) return null;
  return readDealers(ss).find(d => d.code === c) || null;
}

// The current minimum-purchase period for this shop, from the sales dashboard
function dealerProgress(name) {
  const sales = getSales();
  const retailers = (sales.summary && sales.summary.retailers) || [];
  const r = retailers.find(x => String(x.customer).trim().toLowerCase() === name.toLowerCase());
  if (!r) return null;
  const p = (r.periods || []).find(x => x.current);
  return p ? { packs: p.packs, target: p.target, to: p.to, daysLeft: p.daysLeft } : null;
}

function getDealer(ss, data) {
  const d = findDealer(ss, data.code);
  if (!d) return { success: false, error: "Unknown order link" };
  return {
    success: true,
    dealer: { name: d.name, contactName: d.contactName, delivery: d.delivery, ambassadors: d.ambassadors },
    progress: dealerProgress(d.name),
    usual: dealerUsual(ss, d.name, d.extra),
  };
}

// The colours this shop has ordered before (any order on the Orders tab under
// its name, Zoho invoices included), newest order first, with the last quantity.
function dealerUsual(ss, name, extra) {
  const want = name.trim().toLowerCase();
  const rows = sheetRows(ss.getSheetByName(SHEET_NAME))
    .filter(r => String(r[2] || "").trim().toLowerCase() === want)
    .filter(r => !/void/i.test(String(r[COL.PAYMENT_STATUS - 1] || "")) && !/cancelled/i.test(String(r[COL.ORDER_STATUS - 1] || "")))
    .sort((a, b) => new Date(b[1]) - new Date(a[1]));
  const bySku = {};
  const out = [];
  rows.forEach(r => {
    String(r[COL.ITEMS - 1] || "").split("\n").forEach(line => {
      const qty = parseInt(line, 10);
      if (!(qty > 0) || line.indexOf("|") < 0) return;
      const sku = line.split("|").pop().trim().toUpperCase();
      if (!/^[A-Z]+-[A-Z0-9]+-\d+-\d+$/.test(sku)) return;
      if (bySku[sku]) { bySku[sku].times++; return; }
      const label = line.slice(0, line.lastIndexOf("|")).replace(/^\s*\d+\s*x\s*/i, "").trim();
      bySku[sku] = { sku, label, lastQty: qty, times: 1 };
      out.push(bySku[sku]);
    });
  });
  // Colours added by hand on the Retailers tab, named from the Inventory tab
  if (extra && extra.length) {
    const inv = {};
    getInventory(ss).items.forEach(i => { inv[i.sku.toUpperCase()] = i; });
    const COLOUR_CODES = { BM: "Junebug", BWM: "Watermelon Red", SS: "SA Special", JC: "Jungle Camo" };
    extra.forEach(e => {
      const sku = e.sku;
      if (bySku[sku]) return;
      const item = inv[sku];
      const parts = sku.split("-");
      const product = PRODUCT_NAMES[`${parts[0]}-${parts[2]}`] || (item && item.product) || parts[0];
      const colour = e.colour || (item && item.colour) || COLOUR_CODES[parts[1]] || parts[1];
      bySku[sku] = { sku, label: `${product} - ${colour}`, lastQty: 0, times: 0 };
      out.push(bySku[sku]);
    });
  }
  return out.slice(0, 200);
}

// The website works out the prices; this only checks the link and saves the row.
function addDealerOrder(ss, sheet, data) {
  const d = findDealer(ss, data.code);
  if (!d) return { success: false, error: "Unknown order link" };
  const orderNumber = String(data.orderNumber || "").trim();
  if (!/^DL-\d{6}-[A-Z0-9]{4}$/.test(orderNumber)) return { success: false, error: "Bad order number" };
  if (findRow(sheet, orderNumber) > 0) return { success: true, orderNumber }; // sent twice

  const items = String(data.items || "").slice(0, 5000);
  if (!parseOrderItems(items).length) return { success: false, error: "No items" };
  const total = num(data.productTotal);
  const note = String(data.note || "").replace(/\s+/g, " ").trim().slice(0, 300);
  // Ambassador discounts the shop gave since its last order (worked out on the website)
  const discount = Math.min(Math.max(num(data.discountTotal), 0), total);
  const discountText = String(data.discountText || "").replace(/\s+/g, " ").trim().slice(0, 500);
  const noteCell = [note ? `Note: ${note}` : "", discount > 0 ? `Ambassador discounts −R${discount.toFixed(2)}: ${discountText}` : ""]
    .filter(Boolean).join(" · ");
  const delivery = d.delivery || "Dealer delivery";

  sheet.appendRow([
    orderNumber,
    new Date(),
    d.name,
    d.phone ? `'${d.phone}` : "",
    d.email,
    delivery,
    items,
    total,
    0,
    Math.round((total - discount) * 100) / 100,
    "Dealer",
    "Awaiting invoice",
    "Processing",
    "",
    noteCell,
    "",
    "",
    "",
    "",
  ]);

  // Zoho invoice straight away (if DEALER_AUTO_INVOICE is set). A failure here
  // doesn't lose the order: it stays "Awaiting invoice" for you to do by hand.
  let invoice = null;
  try {
    invoice = createDealerInvoice(d, orderNumber, data.lines, note, discount, discountText);
    if (invoice) {
      const row = findRow(sheet, orderNumber);
      if (String(sheet.getRange(1, COL.ZOHO_INVOICE).getValue()).trim() === "") {
        sheet.getRange(1, COL.ZOHO_INVOICE).setValue("ZOHO INVOICE").setFontWeight("bold");
      }
      sheet.getRange(row, COL.ZOHO_INVOICE).setValue(invoice.number);
      sheet.getRange(row, COL.PAYMENT_STATUS).setValue("Invoiced");
    }
  } catch (err) {
    const row = findRow(sheet, orderNumber);
    sheet.getRange(row, COL.PAYMENT_STATUS).setValue("Awaiting invoice - CHECK");
    invoice = { error: String(err).slice(0, 300) };
  }
  return { success: true, orderNumber, dealer: d.name, email: d.email, invoice };
}

// ───────────── Dealer order → Zoho invoice ─────────────
// Script property DEALER_AUTO_INVOICE:
//   (not set) → off: invoice by hand and link it on the dashboard
//   draft     → creates a draft invoice for you to check and send
//   send      → creates the invoice and emails it to the shop
// The Zoho refresh token needs these scopes (on top of the read ones):
//   ZohoBooks.invoices.ALL, ZohoBooks.contacts.READ, ZohoBooks.settings.READ
// Subject "Geronimo Baits"; reference number = the invoice number's digits
// (INV-000052 → 52); the dealer order number goes in the notes.

function zohoSend(auth, method, path, body) {
  const res = UrlFetchApp.fetch(`${auth.api}/books/v3${path}`, {
    method,
    contentType: "application/json",
    headers: { Authorization: `Zoho-oauthtoken ${auth.token}` },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  const out = JSON.parse(res.getContentText() || "{}");
  if (out.code !== 0) throw new Error(`Zoho ${method} ${path.split("?")[0]}: ${out.message || res.getContentText()}`);
  return out;
}

function zohoCustomerId(auth, orgId, name) {
  const list = zohoGet(auth, `/contacts?organization_id=${orgId}&contact_type=customer&contact_name=${encodeURIComponent(name)}`);
  const match = (list.contacts || []).find(c => String(c.contact_name).trim().toLowerCase() === name.trim().toLowerCase());
  if (!match) throw new Error(`No Zoho customer called "${name}"`);
  return match.contact_id;
}

// SKU → Zoho item id, all items in one go (kept for 6 hours)
function zohoItemIds(auth, orgId) {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("zoho_item_ids");
  if (cached) return JSON.parse(cached);
  const map = {};
  for (let page = 1; page <= 10; page++) {
    const list = zohoGet(auth, `/items?organization_id=${orgId}&per_page=200&page=${page}`);
    (list.items || []).forEach(i => {
      const sku = String(i.sku || "").trim().toUpperCase();
      if (sku && i.status !== "inactive") map[sku] = i.item_id;
    });
    if (!list.page_context || !list.page_context.has_more_page) break;
  }
  try { cache.put("zoho_item_ids", JSON.stringify(map), 6 * 60 * 60); } catch (e) {}
  return map;
}

function createDealerInvoice(dealer, orderNumber, lines, note, discount, discountText) {
  const props = PropertiesService.getScriptProperties();
  const mode = String(props.getProperty("DEALER_AUTO_INVOICE") || "").trim().toLowerCase();
  if (mode !== "draft" && mode !== "send") return null;
  const orgId = props.getProperty("ZOHO_ORG_ID");
  if (!orgId || !props.getProperty("ZOHO_REFRESH_TOKEN")) throw new Error("Zoho isn't set up");
  if (!Array.isArray(lines) || !lines.length) throw new Error("No priced lines sent with the order");

  const auth = zohoAuth();
  const customerId = zohoCustomerId(auth, orgId, dealer.name);
  const itemIds = zohoItemIds(auth, orgId);
  const lineItems = lines.slice(0, 150).map(l => {
    const sku = String(l.sku || "").trim().toUpperCase();
    const itemId = itemIds[sku] || "";
    const line = { quantity: Math.floor(num(l.qty)), rate: num(l.price) };
    if (itemId) line.item_id = itemId;
    else { line.name = String(l.label || sku).slice(0, 100); line.description = sku; }
    return line;
  });

  const body = {
    customer_id: customerId,
    subject_content: "Geronimo Baits", // the invoice's Subject field
    line_items: lineItems,
    notes: `Dealer order ${orderNumber}${note ? `\nNote: ${note}` : ""}${discount > 0 ? `\nAmbassador discounts (20% of shelf price): ${discountText}` : ""}`,
  };
  if (discount > 0) {
    body.adjustment = -Math.round(discount * 100) / 100;
    body.adjustment_description = "Ambassador discounts";
  }
  const created = zohoSend(auth, "post", `/invoices?organization_id=${orgId}`, body).invoice;

  // Reference number = invoice number's digits (INV-000052 → 52)
  const ref = String(Number(String(created.invoice_number).replace(/\D/g, "")) || "");
  if (ref) {
    zohoSend(auth, "put", `/invoices/${created.invoice_id}?organization_id=${orgId}`,
      Object.assign({}, body, { reference_number: ref }));
  }
  if (mode === "send" && dealer.email) {
    zohoSend(auth, "post", `/invoices/${created.invoice_id}/email?organization_id=${orgId}`, {
      to_mail_ids: dealer.email ? [dealer.email] : [],
      subject: `Geronimo Baits invoice ${created.invoice_number} for order ${orderNumber}`,
      body: `Hi ${dealer.contactName || "there"},<br><br>Thank you for your order ${orderNumber}. Your invoice ${created.invoice_number} is attached. Your baits are handmade and usually ready in 2 to 3 weeks.<br><br>Geronimo Baits · Built to Hunt`,
    });
  }
  return { number: created.invoice_number, total: num(created.total), mode };
}

function findLinkedRow(sheet, invoiceNumber) {
  const last = sheet.getLastRow();
  if (last < 2 || sheet.getLastColumn() < COL.ZOHO_INVOICE) return -1;
  const values = sheet.getRange(2, COL.ZOHO_INVOICE, last - 1, 1).getValues();
  const want = String(invoiceNumber).trim().toUpperCase();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim().toUpperCase() === want) return i + 2;
  }
  return -1;
}

function linkInvoice(sheet, data) {
  const row = findRow(sheet, data.orderNumber);
  if (row < 0) return { success: false, error: "Order not found" };
  if (String(sheet.getRange(1, COL.ZOHO_INVOICE).getValue()).trim() === "") {
    sheet.getRange(1, COL.ZOHO_INVOICE).setValue("ZOHO INVOICE").setFontWeight("bold");
  }
  const invoice = String(data.invoice || "").trim().toUpperCase();
  if (invoice && !/^INV-\d{3,}$/.test(invoice)) return { success: false, error: "Invoice numbers look like INV-000052" };
  // The Zoho sync may already have added this invoice as its own order. If that
  // copy hasn't been packed yet, fold its payment into the dealer order and
  // remove the copy, so the order isn't packed twice.
  let payment = "";
  let paidAmount = "";
  const copy = invoice ? findRow(sheet, invoice) : -1;
  if (copy > 0) {
    const copyStatus = String(sheet.getRange(copy, COL.ORDER_STATUS).getValue()).toLowerCase();
    const copySource = String(sheet.getRange(copy, 11).getValue()).trim(); // K: PAYMENT METHOD
    if (copySource !== "Zoho" || DONE_STATUSES.includes(copyStatus)) {
      return { success: false, error: `${invoice} is already on the Orders tab as its own ${copyStatus || "open"} order. Check it before linking.` };
    }
    payment = String(sheet.getRange(copy, COL.PAYMENT_STATUS).getValue());
    paidAmount = sheet.getRange(copy, COL.AMOUNT_PAID).getValue();
    sheet.deleteRow(copy);
  }

  const target = findRow(sheet, data.orderNumber); // rows may have moved up
  sheet.getRange(target, COL.ZOHO_INVOICE).setValue(invoice);
  const pay = String(sheet.getRange(target, COL.PAYMENT_STATUS).getValue()).toLowerCase();
  if (!invoice) {
    if (pay === "invoiced") sheet.getRange(target, COL.PAYMENT_STATUS).setValue("Awaiting invoice");
  } else if (payment && !/^(pending|draft)$/i.test(payment)) {
    sheet.getRange(target, COL.PAYMENT_STATUS).setValue(payment);
    sheet.getRange(target, COL.AMOUNT_PAID).setValue(paidAmount);
  } else if (pay === "awaiting invoice" || pay === "") {
    sheet.getRange(target, COL.PAYMENT_STATUS).setValue("Invoiced");
  }
  return { success: true, invoice, mergedCopy: copy > 0 };
}

// Run once by hand after pasting a new Self Client code into the script
// property ZOHO_GRANT_CODE: swaps it for a refresh token and saves it as
// ZOHO_REFRESH_TOKEN (the code only works for a few minutes).
function zohoExchangeCode() {
  const props = PropertiesService.getScriptProperties();
  const code = props.getProperty("ZOHO_GRANT_CODE");
  if (!code) throw new Error("Add ZOHO_GRANT_CODE first");
  const accounts = props.getProperty("ZOHO_ACCOUNTS_URL") || "https://accounts.zoho.com";
  const res = UrlFetchApp.fetch(`${accounts}/oauth/v2/token`, {
    method: "post",
    payload: {
      code,
      client_id: props.getProperty("ZOHO_CLIENT_ID"),
      client_secret: props.getProperty("ZOHO_CLIENT_SECRET"),
      grant_type: "authorization_code",
    },
    muteHttpExceptions: true,
  });
  const body = JSON.parse(res.getContentText());
  if (!body.refresh_token) throw new Error("Zoho said: " + res.getContentText());
  props.setProperty("ZOHO_REFRESH_TOKEN", body.refresh_token);
  props.deleteProperty("ZOHO_GRANT_CODE");
  CacheService.getScriptCache().remove("zoho_auth");
  Logger.log("New Zoho refresh token saved. Scopes: " + (body.scope || "see Zoho"));
}
