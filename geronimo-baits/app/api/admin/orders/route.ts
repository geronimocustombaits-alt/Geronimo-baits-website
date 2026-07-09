import { NextResponse } from "next/server";

const ORDERS_CSV_URL = process.env.ORDERS_CSV_URL;

function parseCSVLine(line: string) {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());

  return result.map((cell) => cell.replace(/^"|"$/g, "").trim());
}

function cleanHeader(header: string) {
  return header
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .trim()
    .toUpperCase();
}

export async function GET() {
  try {
    if (!ORDERS_CSV_URL) {
      return NextResponse.json([]);
    }

    const response = await fetch(ORDERS_CSV_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not fetch orders sheet" },
        { status: 500 }
      );
    }

    const csv = await response.text();
    const lines = csv.trim().split("\n");

    if (lines.length < 2) {
      return NextResponse.json([]);
    }

    const headers = parseCSVLine(lines[0]).map(cleanHeader);

    const orders = lines
      .slice(1)
      .map((line) => {
        const values = parseCSVLine(line);

        const getValue = (headerName: string) => {
          const index = headers.indexOf(headerName);
          return index >= 0 ? values[index] || "" : "";
        };

        return {
          orderNumber: getValue("ORDER #"),
          date: getValue("DATE"),
          customerName: getValue("CUSTOMER NAME"),
          customerPhone: getValue("PHONE"),
          customerEmail: getValue("EMAIL"),
          deliveryMethod: getValue("DELIVERY"),
          items: getValue("ITEMS"),
          productTotal: getValue("PRODUCT TOTAL"),
          shipping: getValue("SHIPPING"),
          grandTotal: getValue("GRAND TOTAL"),
          paymentMethod: getValue("PAYMENT METHOD"),
          paymentStatus: getValue("PAYMENT STATUS"),
          orderStatus: getValue("ORDER STATUS"),
        };
      })
      .filter((order) => order.orderNumber);

    return NextResponse.json(orders.reverse());
  } catch (error) {
    console.error("ADMIN ORDERS ERROR:", error);

    return NextResponse.json(
      { error: "Could not load admin orders" },
      { status: 500 }
    );
  }
}