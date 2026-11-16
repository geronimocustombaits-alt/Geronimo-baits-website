import { NextResponse } from "next/server";
import { Resend } from "resend";
import { fetchProducts } from "@/lib/products";
import { generateOrderNumber } from "@/lib/orderNumber";
import { dealerPrice, dealerPriceForSku, isDealerCode, splitLabel, type UsualLine } from "@/lib/dealer";
import type { Product } from "@/lib/products";
import { roundRand } from "@/lib/shop";

// Dealer order page (/dealer/<code>). Open to anyone with the link: the code
// on the Retailers tab is the key. The browser only sends WHICH baits and HOW
// MANY; dealer prices and totals are worked out here, and the sheet checks the
// code again before saving. The webhook secret never reaches the browser.

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

async function callSheet(payload: Record<string, unknown>) {
  const webhook = process.env.ORDERS_WEBHOOK_URL;
  const secret = process.env.ORDERS_WEBHOOK_SECRET;
  if (!webhook || !secret) throw new Error("ORDERS_WEBHOOK_URL or ORDERS_WEBHOOK_SECRET missing");
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ ...payload, secret }),
    cache: "no-store",
  });
  return JSON.parse(await response.text());
}

const codeFrom = (value: unknown) => String(value || "").trim().toUpperCase();

type DealerProduct = {
  sku: string;
  bait: string;
  colour: string;
  size: string;
  price: number;
  retail: number;
  inStock: number | null;
  usual: boolean;
  lastQty: number;
};

// The shop's own colours first (from its earlier orders, named the way it
// knows them), then the rest of the range from the Products sheet.
function dealerList(products: Product[], usual: UsualLine[]): DealerProduct[] {
  const bySku = new Map(products.map((p) => [p.sku.toUpperCase(), p]));
  const out: DealerProduct[] = [];
  const seen = new Set<string>();

  usual.forEach((u) => {
    const sku = String(u.sku || "").toUpperCase();
    if (!sku || seen.has(sku)) return;
    const product = bySku.get(sku);
    const price = product ? dealerPrice(product) : dealerPriceForSku(sku);
    if (price === null) return;
    const { bait, colour } = splitLabel(u.label);
    seen.add(sku);
    out.push({
      sku: product?.sku || sku,
      // Named the way the shop's own orders name it
      bait: colour ? bait : product?.bait || bait,
      colour: colour || product?.colour || bait,
      size: colour ? "" : product?.size || "",
      price,
      retail: Number(product?.price) || 0,
      inStock: product ? Math.max(Number(product.stockQty) || 0, 0) : null,
      usual: true,
      lastQty: Number(u.lastQty) || 0,
    });
  });

  products.forEach((p) => {
    const price = dealerPrice(p);
    if (price === null || seen.has(p.sku.toUpperCase())) return;
    if (!p.bait && !p.colour) return; // half-filled row on the Products sheet
    seen.add(p.sku.toUpperCase());
    out.push({
      sku: p.sku,
      bait: p.bait,
      colour: p.colour,
      size: p.size,
      price,
      retail: Number(p.price) || 0,
      inStock: Math.max(Number(p.stockQty) || 0, 0),
      usual: false,
      lastQty: 0,
    });
  });
  return out;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// GET /api/dealer?code=… → the shop, its minimum progress and the price list
export async function GET(req: Request) {
  const code = codeFrom(new URL(req.url).searchParams.get("code"));
  if (!isDealerCode(code)) return fail("This order link isn't valid.", 404);

  try {
    const result = await callSheet({ action: "getDealer", code });
    if (!result.success) return fail("This order link isn't valid. Please ask Geronimo Baits for a new one.", 404);

    const products = dealerList(await fetchProducts(), Array.isArray(result.usual) ? result.usual : []);

    return NextResponse.json({ success: true, dealer: result.dealer, progress: result.progress, products });
  } catch (error) {
    console.error("DEALER GET ERROR:", error);
    return fail("We couldn't load the order form. Please try again in a minute.", 503);
  }
}

// POST /api/dealer { code, items: [{ sku, qty }], note } → saves the order
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid order");
  }

  const code = codeFrom(body.code);
  if (!isDealerCode(code)) return fail("This order link isn't valid.", 404);
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";

  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 150) {
    return fail("Add at least one bait to your order.");
  }
  const requested = new Map<string, number>();
  for (const item of body.items as { sku?: unknown; qty?: unknown }[]) {
    const sku = String(item?.sku || "").trim().slice(0, 60);
    const qty = Number(item?.qty);
    if (!sku || !Number.isInteger(qty) || qty < 1 || qty > 500) {
      return fail("Something is wrong with one of the quantities. Please check and try again.");
    }
    requested.set(sku, (requested.get(sku) || 0) + qty);
  }

  // Same list the shop sees: its own colours plus the Products sheet
  let products: DealerProduct[];
  try {
    const dealer = await callSheet({ action: "getDealer", code });
    if (!dealer.success) return fail("This order link isn't valid.", 404);
    products = dealerList(await fetchProducts(), Array.isArray(dealer.usual) ? dealer.usual : []);
  } catch (error) {
    console.error("DEALER ORDER: products unavailable:", error);
    return fail("We couldn't load the price list. Please try again in a minute.", 503);
  }

  const lines: { sku: string; label: string; qty: number; price: number }[] = [];
  for (const [sku, qty] of requested) {
    const product = products.find((p) => p.sku === sku);
    if (!product) {
      return fail("One of the baits on your order is no longer listed. Please refresh and try again.");
    }
    const label = [product.bait, product.colour].filter(Boolean).join(" - ").replace(/\|/g, "/");
    lines.push({ sku: product.sku, label, qty, price: product.price });
  }

  const productTotal = roundRand(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const packs = lines.reduce((sum, l) => sum + l.qty, 0);
  const orderNumber = generateOrderNumber().replace(/^GB-/, "DL-");
  // Same line format as every other order, so packing and the make list read it
  const items = lines.map((l) => `${l.qty}x ${l.label} | ${l.sku}`).join("\n");

  let saved;
  try {
    saved = await callSheet({ action: "addDealerOrder", code, orderNumber, items, productTotal, note });
  } catch (error) {
    console.error("DEALER ORDER: could not save:", error);
    return fail("We couldn't save your order. Please try again or WhatsApp us.", 502);
  }
  if (!saved?.success) {
    return fail(saved?.error === "Unknown order link" ? "This order link isn't valid." : "We couldn't save your order. Please try again or WhatsApp us.", 502);
  }

  // Let Geronimo know (a failed email doesn't undo the order)
  try {
    if (process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const rows = lines
        .map((l) => `• ${l.qty}x ${escapeHtml(l.label)} | ${escapeHtml(l.sku)} | R${l.price}`)
        .join("<br />");
      await resend.emails.send({
        from: "Geronimo Baits <onboarding@resend.dev>",
        to: process.env.ORDER_EMAIL || "geronimocustombaits@gmail.com",
        subject: `New dealer order - ${escapeHtml(saved.dealer)} - ${orderNumber}`,
        html: `<h2>🏪 New dealer order</h2>
          <p><strong>${escapeHtml(saved.dealer)}</strong> · ${orderNumber}</p>
          <p>${rows}</p>
          <p><strong>${packs} packets · R${productTotal.toFixed(2)}</strong> at dealer prices</p>
          ${note ? `<p><strong>Note:</strong> ${escapeHtml(note)}</p>` : ""}
          <p>Invoice it in Zoho and link the invoice number on the order in the back office, then make and pack it.</p>`,
      });
    }
  } catch (error) {
    console.error("DEALER ORDER EMAIL ERROR:", error);
  }

  return NextResponse.json({ success: true, orderNumber, packs, productTotal });
}
