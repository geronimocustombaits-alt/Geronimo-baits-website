import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { orderNumber, orderStatus } = await req.json();

    if (!orderNumber || !orderStatus) {
      return NextResponse.json(
        { success: false, error: "Missing order number or status" },
        { status: 400 }
      );
    }

    if (!process.env.ORDERS_WEBHOOK_URL) {
      return NextResponse.json(
        { success: false, error: "Missing ORDERS_WEBHOOK_URL" },
        { status: 500 }
      );
    }

    const sheetResponse = await fetch(process.env.ORDERS_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "updateOrderStatus",
        orderNumber,
        orderStatus,
      }),
    });

    const sheetResult = await sheetResponse.text();

    console.log("UPDATE ORDER STATUS:", orderNumber, orderStatus);
    console.log("SHEET STATUS:", sheetResponse.status);
    console.log("SHEET RESULT:", sheetResult);

    return NextResponse.json({
      success: true,
      orderNumber,
      orderStatus,
    });
  } catch (error) {
    console.error("UPDATE ORDER STATUS ERROR:", error);

    return NextResponse.json(
      { success: false, error: "Could not update order status" },
      { status: 500 }
    );
  }
}