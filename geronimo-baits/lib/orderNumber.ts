import { randomInt } from "crypto";

// Order numbers look like GB-261014-K7P3: date (YYMMDD, SA time) + 4 random
// characters. They're created on the server at the moment the order is
// placed, so two shoppers can never be given the same number, and nothing
// depends on the Orders sheet being up to date.
// Letters/digits that look alike (0/O, 1/I/L) are left out so numbers are
// easy to read out over WhatsApp.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateOrderNumber(now = new Date()): string {
  const sa = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Johannesburg" }));
  const yy = String(sa.getFullYear()).slice(-2);
  const mm = String(sa.getMonth() + 1).padStart(2, "0");
  const dd = String(sa.getDate()).padStart(2, "0");

  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ALPHABET[randomInt(ALPHABET.length)];

  return `GB-${yy}${mm}${dd}-${suffix}`;
}
