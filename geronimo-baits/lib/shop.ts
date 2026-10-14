// Shop settings shared by the shop page (browser) and the server.
// Change prices here and both sides stay in step.

export const LOCKER_METHOD = "PUDO Locker";
export const DOOR_METHOD = "PUDO Door-to-Door";
export const COLLECTION_METHOD = "Collection";

// Browser storage key for the last placed order (shown on the success page).
export const LAST_ORDER_KEY = "gb-last-order";
// Browser storage key for the saved cart and checkout details.
export const SAVED_CART_KEY = "gb-cart-v1";

// PUDO Locker (locker to locker) price depends on how many packs are sent.
// Tiers are checked top to bottom: the first one the order fits in is used.
export const LOCKER_RATES = [
  { maxPacks: 3, price: 70 },          // 1–3 packs
  { maxPacks: 19, price: 80 },         // 4–19 packs
  { maxPacks: Infinity, price: 100 },  // 20+ packs
];

const FIXED_RATES: Record<string, number> = {
  [DOOR_METHOD]: 110,
  [COLLECTION_METHOD]: 0,
};

export const DELIVERY_METHODS = [LOCKER_METHOD, DOOR_METHOD, COLLECTION_METHOD];

export const HUNT_BOXES = [
  { name: "SCOUT BOX", size: 3, description: "Perfect starter selection." },
  { name: "HUNTER BOX", size: 5, description: "Built for a serious session." },
  { name: "WAR BOX", size: 8, description: "Full attack mode." },
];

export type DeliveryAddress = {
  street: string;
  suburb: string;
  city: string;
  postalCode: string;
};

export type SelectedLocker = {
  code: string;
  name: string;
  address: string;
};

export function lockerRateFor(packCount: number): number {
  const tier = LOCKER_RATES.find((t) => packCount <= t.maxPacks);
  return (tier ?? LOCKER_RATES[LOCKER_RATES.length - 1]).price;
}

export function shippingCostFor(deliveryMethod: string, packCount: number): number {
  if (deliveryMethod === LOCKER_METHOD) return lockerRateFor(Math.max(packCount, 1));
  return FIXED_RATES[deliveryMethod] ?? 0;
}

// Text for the delivery dropdown, e.g. "PUDO Locker (R70)".
export function deliveryLabel(deliveryMethod: string, packCount: number): string {
  const cost = shippingCostFor(deliveryMethod, packCount);
  return `${deliveryMethod} ${cost > 0 ? `(R${cost})` : "(Free)"}`;
}

// Money helpers: prices like R89.99 add up with tiny rounding errors
// (3 x 89.99 = 269.96999...), so totals are rounded to the cent.
export const roundRand = (n: number) => Math.round(n * 100) / 100;

// R60 stays "R60"; R89.99 or R269.97 show the cents.
export function formatRand(value: number | string): string {
  const n = roundRand(Number(value) || 0);
  return `R${Number.isInteger(n) ? n : n.toFixed(2)}`;
}
