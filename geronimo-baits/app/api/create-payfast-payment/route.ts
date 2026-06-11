 import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { orderNumber, customerName, customerEmail, grandTotal } =
      await req.json();

    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;

    if (!merchantId || !merchantKey) {
      return NextResponse.json(
        { success: false, error: "Missing PayFast merchant details" },
        { status: 500 }
      );
    }

    if (!orderNumber || !customerName || !customerEmail || !grandTotal) {
      return NextResponse.json(
        { success: false, error: "Missing payment details" },
        { status: 400 }
      );
    }

    console.log("PAYFAST ORDER NUMBER:", orderNumber);
    console.log("PAYFAST TOTAL:", grandTotal);

    const payfastUrl =
      process.env.PAYFAST_SANDBOX === "true"
        ? "https://sandbox.payfast.co.za/eng/process"
        : "https://www.payfast.co.za/eng/process";

    const paymentData = new URLSearchParams({
      merchant_id: merchantId,
      merchant_key: merchantKey,

      return_url: "http://localhost:3000/payment-success",
      cancel_url: "http://localhost:3000/payment-cancelled",
      notify_url: "http://localhost:3000/api/payfast-itn",

      name_first: customerName,
      email_address: customerEmail,

      m_payment_id: orderNumber,
      amount: Number(grandTotal).toFixed(2),
      item_name: `Geronimo Baits Order ${orderNumber}`,
    });

    return NextResponse.json({
      success: true,
      paymentUrl: `${payfastUrl}?${paymentData.toString()}`,
    });
  } catch (error) {
    console.error("PAYFAST ERROR:", error);

    return NextResponse.json(
      { success: false, error: "PayFast payment failed" },
      { status: 500 }
    );
  }
}