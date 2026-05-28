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
    .map((row) => row.split(","))
    .filter((row) => row.length >= 6);

  const products = rows.slice(1).map((row) => ({
    sku: row[0]?.trim(),
    bait: row[1]?.trim(),
    colour: row[2]?.trim(),
    size: row[3]?.trim(),
    price: row[4]?.trim(),
    stockQty: row[5]?.trim(),
  }));

  return NextResponse.json(products);
}