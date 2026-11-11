import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";

// Live stock for the back office, read straight from the Inventory tab
// through the Apps Script web app (no published-CSV delay).

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const webhook = process.env.ORDERS_WEBHOOK_URL;
  const secret = process.env.ORDERS_WEBHOOK_SECRET;
  if (!webhook || !secret) {
    return NextResponse.json(
      { success: false, error: "ORDERS_WEBHOOK_URL or ORDERS_WEBHOOK_SECRET missing" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "getInventory", secret }),
      cache: "no-store",
    });
    const text = await response.text();
    let result: { success?: boolean; error?: string; items?: unknown[]; at?: string } = {};
    try {
      result = JSON.parse(text);
    } catch {
      console.error("INVENTORY: unexpected reply from sheet:", text.slice(0, 300));
      return NextResponse.json({ success: false, error: "The sheet didn't reply properly" }, { status: 502 });
    }
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error === "Not allowed" ? "Sheet secret doesn't match" : result.error || "Couldn't read stock" },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, items: result.items ?? [], at: result.at });
  } catch (error) {
    console.error("INVENTORY ERROR:", error);
    return NextResponse.json({ success: false, error: "Couldn't reach the sheet" }, { status: 502 });
  }
}
