import { NextResponse } from "next/server";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSZg4baA_z5JAr8cRe3DLuGNvIQVSsuI_J9RGUBXktXqQ6ksEKkJtL3nCpwgZ3nVwes4I4p62P-jHdz/pub?gid=1875945709&single=true&output=csv";

export async function GET() {
  const response = await fetch(SHEET_URL, {
    cache: "no-store",
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Could not fetch Google Sheet" },
      { status: 500 }
    );
  }

  const csv = await response.text();

  const rows = csv
    .trim()
    .split("\n")
    .map((row) =>
      row
        .split(",")
        .map((cell) => cell.replace(/"/g, "").replace(/\\/g, "").trim())
    )
    .filter(
      (row) =>
        row.length >= 7 &&
        row[0] &&
        row[0].includes("-") &&
        !row[0].includes("SKU")
    );

  const products = rows
    .map((row) => ({
      sku: row[0],
      bait: row[1],
      colour: row[2],
      size: row[3],
      price: row[4],
      stockQty: row[5],
      visible: row[6] || "TRUE",
    }))
    .filter((product) => String(product.visible).toUpperCase() !== "FALSE");

  return NextResponse.json(products);
}