import { NextResponse } from "next/server";

type WeeklyBait = {
  active: string;
  baitName: string;
  colour: string;
  description: string;
  price: string;
  imageUrl: string;
  buttonText: string;
  buttonLink: string;
};

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function normaliseHeader(header: string) {
  return header.toLowerCase().replace(/\s+/g, "");
}

export async function GET() {
  try {
    const csvUrl = process.env.WEEKLY_BAIT_CSV_URL;

    if (!csvUrl) {
      return NextResponse.json(
        { error: "Missing WEEKLY_BAIT_CSV_URL" },
        { status: 500 }
      );
    }

    const response = await fetch(csvUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Could not fetch weekly bait sheet" },
        { status: 500 }
      );
    }

    const csvText = await response.text();

    const rows = csvText
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean);

    if (rows.length < 2) {
      return NextResponse.json(
        { error: "Weekly Bait sheet has no bait rows" },
        { status: 404 }
      );
    }

    const headers = parseCsvLine(rows[0]).map(normaliseHeader);

    const dataRows = rows.slice(1).map((row) => {
      const values = parseCsvLine(row);
      const item: Record<string, string> = {};

      headers.forEach((header, index) => {
        item[header] = values[index] || "";
      });

      return item;
    });

    const activeBait = dataRows.find(
      (row) => row.active?.toLowerCase() === "true"
    );

    if (!activeBait) {
      return NextResponse.json(
        { error: "No active weekly bait found" },
        { status: 404 }
      );
    }

    const bait: WeeklyBait = {
      active: activeBait.active || "TRUE",
      baitName: activeBait.baitname || "",
      colour: activeBait.colour || "",
      description: activeBait.description || "",
      price: activeBait.price || "",
      imageUrl: activeBait.imageurl || "/images/weekly-bait.png",
      buttonText: activeBait.buttontext || "SHOP THIS BAIT",
      buttonLink: activeBait.buttonlink || "/baits",
    };

    return NextResponse.json(bait);
  } catch (error) {
    console.error("Weekly bait error:", error);

    return NextResponse.json(
      { error: "Weekly bait failed to load" },
      { status: 500 }
    );
  }
}