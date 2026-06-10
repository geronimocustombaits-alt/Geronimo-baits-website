import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const {
      customerName,
      customerEmail,
      grandTotal,
    } = await req.json();

    const merchantId = process.env.PAYFAST_MERCHANT_ID;
    const merchantKey = process.env.PAYFAST_MERCHANT_KEY;

    const paymentData = new URLSearchParams({
      merchant_id: merchantId || "",
      merchant_key: merchantKey || "",
      return_url: "http://localhost:3000/payment-success",
      cancel_url: "http://localhost:3000/payment-cancelled",
      notify_url: "http://localhost:3000/api/payfast-itn",

      name_first: customerName,
      email_address: customerEmail,

      m_payment_id: `GB-${Date.now()}`,
      amount: grandTotal.toFixed(2),
      item_name: "Geronimo Baits Order",
    });

    const payfastUrl =
      process.env.PAYFAST_SANDBOX === "true"
        ? "https://sandbox.payfast.co.za/eng/process"
        : "https://www.payfast.co.za/eng/process";

    return NextResponse.json({
      success: true,
      paymentUrl: `${payfastUrl}?${paymentData.toString()}`,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { success: false },
      { status: 500 }
    );
  }
}