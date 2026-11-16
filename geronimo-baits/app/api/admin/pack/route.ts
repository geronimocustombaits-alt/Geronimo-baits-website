import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";

// Packing scan → Orders + Inventory tabs (via the Orders Apps Script web app).
// The sheet checks the scans against the order's items. An exact match of
// what's left takes the packs off stock and marks the order Packed; a part
// send (partial: true) takes off only what was scanned and keeps the rest open.

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

  let body: { orderNumber?: string; items?: ScanItem[]; partial?: boolean; progressOnly?: boolean };
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

  // What's already been sent for this order (part sends), for the packing screen.
  if (body.progressOnly) {
    try {
      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "packProgress", secret, orderNumber }),
      });
      const result = JSON.parse(await response.text());
      // Older sheet script without packProgress → treat as nothing sent yet.
      if (!result?.success) return NextResponse.json({ success: true, packed: {}, sends: 0 });
      return NextResponse.json({ success: true, packed: result.packed ?? {}, sends: Number(result.sends) || 0 });
    } catch {
      return NextResponse.json({ success: true, packed: {}, sends: 0 });
    }
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "packOrder", secret, orderNumber, items, partial: body.partial === true }),
    });
    const text = await response.text();
    let result: {
      success?: boolean;
      error?: string;
      problems?: string[];
      deducted?: boolean;
      complete?: boolean;
      stillLeft?: number;
    } = {};
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
    return NextResponse.json({
      success: true,
      deducted: Boolean(result.deducted),
      // An older sheet script has no "complete" → it only ever packs the full order.
      complete: result.complete !== false,
      stillLeft: Number(result.stillLeft) || 0,
    });
  } catch (error) {
    console.error("PACK ERROR:", error);
    return NextResponse.json({ success: false, error: "Couldn't reach the sheet" }, { status: 502 });
  }
}
