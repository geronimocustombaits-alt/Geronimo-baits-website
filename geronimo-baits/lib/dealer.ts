// Dealer (retailer) ordering: shared by the dealer order page and the server.
// Dealer prices only change in January, together with the dealer price sheet.

import type { Product } from "@/lib/products";

// Retail price on the Products sheet → dealer price per packet
const DEALER_BY_RETAIL: Record<string, number> = {
  "60": 38, // Warvipers, Warcraws, Warbombs, Apache Sticks
  "65": 38, // custom-colour packets
  "80": 50, // Premium / laminated / coreshot
  "110": 75, // Swimbaits
  "89.99": 55, // Warchins
};

// By SKU type, for colours a shop has ordered before that aren't on the
// Products sheet (e.g. a colour made for that shop)
const DEALER_BY_PREFIX: Record<string, number> = {
  WV: 38, WC: 38, WB: 38, AP: 38, PH: 38, WG: 38, WH: 38, WF: 38,
  CS: 50,
  SWB: 75,
  WCH: 55,
};

export function dealerPriceForSku(sku: string): number | null {
  const prefix = String(sku || "").toUpperCase().split("-")[0];
  return DEALER_BY_PREFIX[prefix] ?? null;
}

// Dealer price for a product, or null if it has no dealer price yet
export function dealerPrice(product: Pick<Product, "price" | "sku">): number | null {
  const retail = Number(product.price);
  const key = String(Math.round(retail * 100) / 100);
  if (Number.isFinite(retail) && retail > 0 && DEALER_BY_RETAIL[key] !== undefined) return DEALER_BY_RETAIL[key];
  return dealerPriceForSku(product.sku);
}

// A colour the shop ordered before, from its earlier orders
export type UsualLine = { sku: string; label: string; lastQty: number; times: number };

// 'Warviper 4.5" Arctic Ghost (Jerkbaits)' → bait 'Warviper 4.5"', colour 'Arctic Ghost (Jerkbaits)'
export function splitLabel(label: string): { bait: string; colour: string } {
  const clean = String(label || "").trim();
  const dash = clean.indexOf(" - ");
  if (dash > 0) return { bait: clean.slice(0, dash).trim(), colour: clean.slice(dash + 3).trim() };
  const inch = clean.match(/^(.*?\d(?:\.\d)?(?:"|”|''| ?inch))\s+(.+)$/i);
  if (inch) return { bait: inch[1].trim(), colour: inch[2].trim() };
  return { bait: clean, colour: "" };
}

export const DEALER_LEAD_TIME = "2 to 3 weeks";

// Dealer order numbers: DL-261116-K7P3 (same shape as website orders)
export const isDealerCode = (code: string) => /^[A-Z0-9]{8,20}$/.test(code);
