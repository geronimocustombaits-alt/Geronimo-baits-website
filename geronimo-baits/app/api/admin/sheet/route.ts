import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";

// One route for the back office screens that talk to the Orders Apps Script.
// Only the actions listed here can be called, and the shared secret is added
// on the server so it never reaches the browser.

const ACTIONS: Record<string, string[]> = {
  getMakeList: [],
  getBatches: [],
  addBatch: ["sku", "baits", "plastisolMl", "notes"],
  updateBatch: ["batch", "status", "packs", "addBaits"],
  getSales: [],
  refreshSales: [],
  getAmbassadors: [],
  claimReward: ["code"],
  setReferral: ["orderNumber", "code"],
};

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const webhook = process.env.ORDERS_WEBHOOK_URL;
  const secret = process.env.ORDERS_WEBHOOK_SECRET;
  if (!webhook || !secret) {
    return NextResponse.json({ success: false, error: "ORDERS_WEBHOOK_URL or ORDERS_WEBHOOK_SECRET missing" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const action = String(body.action || "");
  const allowed = ACTIONS[action];
  if (!allowed) {
    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  }

  const payload: Record<string, unknown> = { action, secret };
  for (const key of allowed) {
    const value = body[key];
    if (typeof value === "string") payload[key] = value.slice(0, 300);
    else if (typeof value === "number" && Number.isFinite(value)) payload[key] = value;
  }

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const text = await response.text();
    try {
      const result = JSON.parse(text);
      if (result && result.success === false && result.error === "Not allowed") {
        return NextResponse.json({ success: false, error: "Sheet secret doesn't match" }, { status: 502 });
      }
      return NextResponse.json(result);
    } catch {
      console.error(`SHEET ${action}: unexpected reply:`, text.slice(0, 300));
      return NextResponse.json(
        { success: false, error: "The sheet didn't reply properly — is the latest Apps Script deployed?" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error(`SHEET ${action} ERROR:`, error);
    return NextResponse.json({ success: false, error: "Couldn't reach the sheet" }, { status: 502 });
  }
}
