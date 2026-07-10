import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const bodyText = await req.text();
    const params = new URLSearchParams(bodyText);

    const orderNumber = params.get("m_payment_id");
    const paymentStatus = params.get("payment_status");
    const amountGross = params.get("amount_gross");
    const payerEmail = params.get("email_address");
    const payerName = params.get("name_first");

    console.log("PAYFAST ITN ORDER:", orderNumber);
    console.log("PAYFAST ITN STATUS:", paymentStatus);
    console.log("PAYFAST ITN AMOUNT:", amountGross);
    console.log("PAYFAST ITN EMAIL:", payerEmail);

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: "Missing order number" },
        { status: 400 }
      );
    }

    if (paymentStatus === "COMPLETE") {
      // 1. Update Google Sheet payment status
      if (process.env.ORDERS_WEBHOOK_URL) {
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
            amountPaid: amountGross,
            customerEmail: payerEmail,
          }),
        });

        const sheetResult = await sheetResponse.text();

        console.log("ITN SHEET STATUS:", sheetResponse.status);
        console.log("ITN SHEET RESULT:", sheetResult);
      } else {
        console.log("ORDERS_WEBHOOK_URL missing");
      }

      // 2. Send admin payment received email
      const adminPaymentHtml = `
        <div style="margin:0;padding:0;background:#050505;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
          <div style="max-width:650px;margin:0 auto;background:#0b0b0b;border:1px solid #222;">
            
            <div style="padding:28px;text-align:center;background:#000;">
              <h1 style="margin:0;color:#ffffff;font-size:38px;letter-spacing:2px;">GERONIMO</h1>
              <h2 style="margin:4px 0 10px;color:#9cff00;font-size:22px;">BAITS</h2>
              <p style="margin:0;color:#ffffff;font-weight:bold;">BUILT TO HUNT.</p>
            </div>

            <div style="padding:28px;">
              <h2 style="margin:0 0 16px;color:#9cff00;font-size:28px;">PAYMENT RECEIVED</h2>

              <p style="font-size:16px;line-height:1.6;color:#ddd;">
                PayFast has confirmed a successful payment.
              </p>

              <div style="background:#111;border:1px solid #2b2b2b;border-radius:10px;padding:20px;margin-top:20px;">
                <p style="margin:0 0 8px;color:#aaa;font-size:13px;">ORDER NUMBER</p>
                <h2 style="margin:0 0 20px;color:#9cff00;font-size:30px;">${orderNumber}</h2>

                <p style="margin:0 0 8px;color:#aaa;font-size:13px;">PAYMENT STATUS</p>
                <p style="display:inline-block;background:#65b800;color:#fff;padding:6px 18px;border-radius:20px;font-weight:bold;margin:0 0 20px;">
                  PAID
                </p>

                <p style="margin:0 0 8px;color:#ddd;"><strong style="color:#9cff00;">Amount:</strong> R${amountGross || "Not supplied"}</p>
                <p style="margin:0 0 8px;color:#ddd;"><strong style="color:#9cff00;">Customer Email:</strong> ${payerEmail || "Not supplied"}</p>
                <p style="margin:0;color:#ddd;"><strong style="color:#9cff00;">Customer Name:</strong> ${payerName || "Not supplied"}</p>
              </div>

              <div style="border:1px solid #9cff00;border-radius:10px;padding:20px;margin-top:24px;">
                <h3 style="margin:0 0 12px;color:#9cff00;">NEXT STEP</h3>
                <p style="margin:0;color:#ddd;">You can now pack this order and mark it as paid in your order process.</p>
              </div>
            </div>

            <div style="padding:22px;text-align:center;background:#000;border-top:1px solid #222;">
              <p style="margin:0;color:#9cff00;font-weight:bold;">GERONIMO BAITS | BUILT TO HUNT.</p>
            </div>

          </div>
        </div>
      `;

      const paymentEmailResult = await resend.emails.send({
        from: "Geronimo Baits <onboarding@resend.dev>",
        to: process.env.ORDER_EMAIL || "geronimocustombaits@gmail.com",
        subject: `Payment Received - Geronimo Baits ${orderNumber}`,
        html: adminPaymentHtml,
      });

      console.log("PAYMENT EMAIL RESULT:", paymentEmailResult);
    } else {
      console.log("ITN ignored because status is not COMPLETE:", paymentStatus);
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