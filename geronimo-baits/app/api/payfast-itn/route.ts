import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    const orderNumber = params.get("m_payment_id");
    const paymentStatus = params.get("payment_status");

    console.log("PAYFAST ITN ORDER:", orderNumber);
    console.log("PAYFAST ITN STATUS:", paymentStatus);

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: "Missing order number" },
        { status: 400 }
      );
    }

    if (paymentStatus === "COMPLETE" && process.env.ORDERS_WEBHOOK_URL) {
      const sheetResponse = await fetch(process.env.ORDERS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "updatePayment",
          orderNumber,
          paymentStatus: "Paid",
          orderStatus: "Paid",
        }),
      });

      const sheetResult = await sheetResponse.text();

      console.log("ITN SHEET STATUS:", sheetResponse.status);
      console.log("ITN SHEET RESULT:", sheetResult);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PAYFAST ITN ERROR:", error);

    return NextResponse.json(
      { success: false, error: "ITN failed" },
      { status: 500 }
    );
  }
}