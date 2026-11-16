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

// Dealer price for a product, or null if it has no dealer price yet
export function dealerPrice(product: Pick<Product, "price">): number | null {
  const retail = Number(product.price);
  if (!Number.isFinite(retail) || retail <= 0) return null;
  const key = String(Math.round(retail * 100) / 100);
  return DEALER_BY_RETAIL[key] ?? null;
}

export const DEALER_LEAD_TIME = "2 to 3 weeks";

// Dealer order numbers: DL-261116-K7P3 (same shape as website orders)
export const isDealerCode = (code: string) => /^[A-Z0-9]{8,20}$/.test(code);
