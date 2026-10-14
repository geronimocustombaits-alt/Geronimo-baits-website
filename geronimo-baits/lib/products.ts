import { parseCsv } from "@/lib/ordersSheet";

// Reads the published Products sheet. Columns (in order):
// SKU, BAIT, COLOUR, SIZE, PRICE, STOCK QTY, VISIBLE
const PRODUCTS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZg4baA_z5JAr8cRe3DLuGNvIQVSsuI_J9RGUBXktXqQ6ksEKkJtL3nCpwgZ3nVwes4I4p62P-jHdz/pub?gid=1875945709&single=true&output=csv";

export type Product = {
  sku: string;
  bait: string;
  colour: string;
  size: string;
  price: string;
  stockQty: string;
  visible: string;
};

const clean = (value: string | undefined) =>
  String(value ?? "").replace(/"/g, "").replace(/\\/g, "").trim();

// Only visible products with a real SKU (contains "-", not the header row).
export async function fetchProducts(): Promise<Product[]> {
  const response = await fetch(PRODUCTS_CSV_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Products sheet returned ${response.status}`);

  return parseCsv(await response.text())
    .map((row) => row.map(clean))
    .filter((row) => row.length >= 7 && row[0] && row[0].includes("-") && !row[0].includes("SKU"))
    .map((row) => ({
      sku: row[0],
      bait: row[1],
      colour: row[2],
      size: row[3],
      price: row[4],
      stockQty: row[5],
      visible: row[6] || "TRUE",
    }))
    .filter((product) => product.visible.toUpperCase() !== "FALSE");
}
