import { NextResponse } from "next/server";

const ORDERS_CSV_URL = process.env.ORDERS_CSV_URL;

function parseCSVLine(line: string) {
  const result = [];
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

  result.push(current);

  return result.map((cell) => cell.replace(/^"|"$/g, "").trim());
}

export async function GET() {
  try {
    if (!ORDERS_CSV_URL) {
      return NextResponse.json({ orderNumber: "GB-01" });
    }

    const response = await fetch(ORDERS_CSV_URL, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ orderNumber: "GB-01" });
    }

    const csv = await response.text();
    const lines = csv.trim().split("\n");

    if (lines.length <= 1) {
      return NextResponse.json({ orderNumber: "GB-01" });
    }

    const rows = lines.slice(1).map(parseCSVLine);

    const existingOrderNumbers = rows
      .map((row) => row[0])
      .filter((orderNumber) => orderNumber && orderNumber.startsWith("GB-"));

    let highestNumber = 0;

    existingOrderNumbers.forEach((orderNumber) => {
      const numberPart = orderNumber.replace("GB-", "");
      const number = Number(numberPart);

      if (!Number.isNaN(number) && number > highestNumber) {
        highestNumber = number;
      }
    });

    const nextNumber = highestNumber + 1;
    const formattedOrderNumber = `GB-${String(nextNumber).padStart(2, "0")}`;

    return NextResponse.json({
      orderNumber: formattedOrderNumber,
    });
  } catch (error) {
    console.error("NEXT ORDER NUMBER ERROR:", error);

    return NextResponse.json({ orderNumber: "GB-01" });
  }
}