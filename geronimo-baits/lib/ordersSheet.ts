// Reads the published Orders sheet (ORDERS_CSV_URL).
// Uses a full CSV parser so cells containing commas, quotes or line breaks
// (like a multi-line ITEMS cell) don't break the rows apart.

export type SheetOrder = {
  orderNumber: string;
  grandTotal: string;
  paymentStatus: string;
  orderStatus: string;
};

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

// Turns "R1,250.00" or "1250" into 1250. Returns NaN if there's no number.
export function toAmount(value: string | null | undefined): number {
  const cleaned = String(value ?? "").replace(/[^0-9.]/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
}

// Returns the order, null if it isn't in the sheet (yet), or throws if the
// sheet can't be read at all.
export async function findOrder(orderNumber: string): Promise<SheetOrder | null> {
  const csvUrl = process.env.ORDERS_CSV_URL;
  if (!csvUrl) throw new Error("ORDERS_CSV_URL is not set");

  const response = await fetch(csvUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Orders sheet returned ${response.status}`);

  const rows = parseCsv(await response.text());
  if (rows.length < 2) return null;

  const headers = rows[0].map((h) => h.trim().toUpperCase());
  const col = (name: string) => headers.indexOf(name);

  const orderCol = col("ORDER #");
  if (orderCol < 0) throw new Error("Orders sheet has no 'ORDER #' column");

  const match = rows
    .slice(1)
    .find((r) => (r[orderCol] || "").trim() === orderNumber.trim());

  if (!match) return null;

  const get = (name: string) => {
    const index = col(name);
    return index >= 0 ? (match[index] || "").trim() : "";
  };

  return {
    orderNumber: get("ORDER #"),
    grandTotal: get("GRAND TOTAL"),
    paymentStatus: get("PAYMENT STATUS"),
    orderStatus: get("ORDER STATUS"),
  };
}
