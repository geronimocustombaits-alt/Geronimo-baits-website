// Shop settings shared by the shop page (browser) and the server.
// Change prices here and both sides stay in step.

export const SHIPPING_OPTIONS: Record<string, number> = {
  "PUDO Locker": 60,
  "PUDO Door-to-Door": 110,
  Collection: 0,
};

export const HUNT_BOXES = [
  { name: "SCOUT BOX", size: 3, description: "Perfect starter selection." },
  { name: "HUNTER BOX", size: 5, description: "Built for a serious session." },
  { name: "WAR BOX", size: 8, description: "Full attack mode." },
];

export function shippingCostFor(deliveryMethod: string): number {
  return SHIPPING_OPTIONS[deliveryMethod] ?? 0;
}
