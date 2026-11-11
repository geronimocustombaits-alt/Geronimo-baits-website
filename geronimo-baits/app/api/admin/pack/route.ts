import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";

// Packing scan → Orders + Inventory tabs (via the Orders Apps Script web app).
// The sheet checks the scans against the order's items. Only an exact match
// takes the packs off stock and marks the order Packed.

type ScanItem = { sku: string; qty: number };

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const webhook = process.env.ORDERS_WEBHOOK_URL;
  const secret = process.env.ORDERS_WEBHOOK_SECRET;
  if (!webhook || !secret) {
    return NextResponse.json(
      { success: false, error: "ORDERS_WEBHOOK_URL or ORDERS_WEBHOOK_SECRET missing in .env.local" },
      { status: 500 }
    );
  }

  let body: { orderNumber?: string; items?: ScanItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const orderNumber = String(body.orderNumber || "").trim().slice(0, 40);
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((i) => ({ sku: String(i?.sku || "").trim().toUpperCase(), qty: Math.floor(Number(i?.qty)) }))
    .filter((i) => /^[A-Z0-9-]{2,40}$/.test(i.sku) && Number.isFinite(i.qty) && i.qty > 0 && i.qty <= 1000);

  if (!orderNumber) {
    return NextResponse.json({ success: false, error: "Missing order number" }, { status: 400 });
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "packOrder", secret, orderNumber, items }),
    });
    const text = await response.text();
    let result: { success?: boolean; error?: string; problems?: string[]; deducted?: boolean } = {};
    try {
      result = JSON.parse(text);
    } catch {
      console.error("PACK: unexpected reply from sheet:", text.slice(0, 300));
      return NextResponse.json({ success: false, error: "The sheet didn't reply properly" }, { status: 502 });
    }

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error === "Not allowed" ? "Sheet secret doesn't match" : result.error || "Packing failed",
        problems: result.problems ?? [],
      });
    }
    return NextResponse.json({ success: true, deducted: Boolean(result.deducted) });
  } catch (error) {
    console.error("PACK ERROR:", error);
    return NextResponse.json({ success: false, error: "Couldn't reach the sheet" }, { status: 502 });
  }
}
