import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";

// Phone scanner → Inventory tab (via the Orders Apps Script web app).
// mode "production": scanned packs are added to In Stock.
// mode "stocktake":  Left is set to the number of packs counted.

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

  let body: { mode?: string; reference?: string; items?: ScanItem[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const mode = body.mode === "stocktake" ? "stocktake" : "production";
  const items = (Array.isArray(body.items) ? body.items : [])
    .map((i) => ({ sku: String(i?.sku || "").trim().toUpperCase(), qty: Math.floor(Number(i?.qty)) }))
    .filter((i) => /^[A-Z0-9-]{3,40}$/.test(i.sku) && Number.isFinite(i.qty) && i.qty >= 0 && i.qty <= 10000);

  if (items.length === 0) {
    return NextResponse.json({ success: false, error: "Nothing to save" }, { status: 400 });
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "stockIn",
        secret,
        mode,
        reference: String(body.reference || "").slice(0, 60),
        items,
      }),
    });
    const text = await response.text();
    let result: { success?: boolean; error?: string; updated?: number; unknown?: string[] } = {};
    try {
      result = JSON.parse(text);
    } catch {
      console.error("STOCK: unexpected reply from sheet:", text.slice(0, 300));
      return NextResponse.json({ success: false, error: "The sheet didn't reply properly" }, { status: 502 });
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error === "Not allowed" ? "Sheet secret doesn't match" : result.error || "Sheet update failed" },
        { status: 502 }
      );
    }
    return NextResponse.json({ success: true, updated: result.updated ?? 0, unknown: result.unknown ?? [] });
  } catch (error) {
    console.error("STOCK ERROR:", error);
    return NextResponse.json({ success: false, error: "Couldn't reach the sheet" }, { status: 502 });
  }
}
