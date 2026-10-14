import { NextResponse } from "next/server";
import { Resend } from "resend";
import { buildParamString, confirmWithPayfast, signParamString } from "@/lib/payfast";
import { findOrder, toAmount } from "@/lib/ordersSheet";
import { safeEqual } from "@/lib/adminAuth";

// PayFast ITN (Instant Transaction Notification).
// An order is only marked Paid once the notification passes:
//   1. the signature check (proves it was signed with your account details)
//   2. confirmation from PayFast's own server (proves PayFast sent it)
//   3. an amount check against the order's GRAND TOTAL in the Orders sheet
// PayFast can send the same notification more than once, so orders already
// marked Paid are skipped instead of emailing you twice.

type Outcome = {
  paymentStatus: string;
  orderStatus: string;
  heading: string;
  colour: string;
  note: string;
};

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    const pairs = Array.from(new URLSearchParams(bodyText).entries());
    const params = new URLSearchParams(bodyText);

    const orderNumber = params.get("m_payment_id");
    const paymentStatus = params.get("payment_status");
    const amountGross = params.get("amount_gross");
    const payerEmail = params.get("email_address");
    const payerName = params.get("name_first");
    const receivedSignature = params.get("signature") || "";

    console.log("PAYFAST ITN:", orderNumber, paymentStatus, amountGross);

    if (!orderNumber) {
      return NextResponse.json({ success: false, error: "Missing order number" }, { status: 400 });
    }

    // 1. Signature check
    const paramString = buildParamString(pairs, { skipEmpty: false });
    const expectedSignature = signParamString(paramString);

    if (!receivedSignature || !safeEqual(receivedSignature, expectedSignature)) {
      console.warn("ITN REJECTED: signature mismatch for", orderNumber);
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
    }

    // 2. Confirm with PayFast's server
    let confirmed = false;
    try {
      confirmed = await confirmWithPayfast(paramString);
    } catch (error) {
      // PayFast unreachable: answer with an error so PayFast tries again later.
      console.error("ITN: could not reach PayFast to confirm:", error);
      return NextResponse.json({ success: false, error: "Could not confirm" }, { status: 500 });
    }

    if (!confirmed) {
      console.warn("ITN REJECTED: PayFast did not confirm", orderNumber);
      return NextResponse.json({ success: false, error: "Not confirmed by PayFast" }, { status: 400 });
    }

    if (paymentStatus !== "COMPLETE") {
      console.log("ITN ignored because status is not COMPLETE:", paymentStatus);
      return NextResponse.json({ success: true });
    }

    // 3. Amount check against the Orders sheet
    let order;
    try {
      order = await findOrder(orderNumber);
    } catch (error) {
      console.error("ITN: could not read Orders sheet:", error);
      return NextResponse.json({ success: false, error: "Orders sheet unavailable" }, { status: 500 });
    }

    if (order && order.paymentStatus.toLowerCase().startsWith("paid")) {
      console.log("ITN duplicate, order already marked paid:", orderNumber);
      return NextResponse.json({ success: true });
    }

    const paid = toAmount(amountGross);
    let outcome: Outcome;

    if (!order) {
      // The published sheet can lag a few minutes behind new orders.
      outcome = {
        paymentStatus: "Paid - CHECK AMOUNT",
        orderStatus: "Paid",
        heading: "PAYMENT RECEIVED - CHECK AMOUNT",
        colour: "#f5b400",
        note: "PayFast confirmed this payment, but the order wasn't in the Orders sheet yet, so the amount couldn't be checked automatically. Compare the amount below with the order total before packing.",
      };
    } else if (Number.isNaN(paid) || Math.abs(paid - toAmount(order.grandTotal)) > 0.01) {
      outcome = {
        paymentStatus: "AMOUNT MISMATCH",
        orderStatus: "On Hold",
        heading: "PAYMENT AMOUNT DOES NOT MATCH",
        colour: "#ff4d4d",
        note: `The customer paid R${amountGross || "?"} but the order total is R${order.grandTotal || "?"}. The order has been put On Hold. Don't pack it until you've checked this.`,
      };
    } else {
      outcome = {
        paymentStatus: "Paid",
        orderStatus: "Paid",
        heading: "PAYMENT RECEIVED",
        colour: "#9cff00",
        note: "PayFast confirmed this payment and the amount matches the order. You can now pack this order.",
      };
    }

    console.log("ITN OUTCOME:", orderNumber, outcome.paymentStatus);

    // Update the Orders sheet
    if (process.env.ORDERS_WEBHOOK_URL) {
      const sheetResponse = await fetch(process.env.ORDERS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "updatePayment",
          orderNumber,
          paymentStatus: outcome.paymentStatus,
          orderStatus: outcome.orderStatus,
          amountPaid: amountGross,
          customerEmail: payerEmail,
        }),
      });
      console.log("ITN SHEET STATUS:", sheetResponse.status, await sheetResponse.text());
    } else {
      console.log("ORDERS_WEBHOOK_URL missing");
    }

    // Email you
    const adminPaymentHtml = `
      <div style="margin:0;padding:0;background:#050505;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
        <div style="max-width:650px;margin:0 auto;background:#0b0b0b;border:1px solid #222;">
          <div style="padding:28px;text-align:center;background:#000;">
            <h1 style="margin:0;color:#ffffff;font-size:38px;letter-spacing:2px;">GERONIMO</h1>
            <h2 style="margin:4px 0 10px;color:#9cff00;font-size:22px;">BAITS</h2>
            <p style="margin:0;color:#ffffff;font-weight:bold;">BUILT TO HUNT.</p>
          </div>

          <div style="padding:28px;">
            <h2 style="margin:0 0 16px;color:${outcome.colour};font-size:28px;">${outcome.heading}</h2>

            <div style="background:#111;border:1px solid #2b2b2b;border-radius:10px;padding:20px;margin-top:20px;">
              <p style="margin:0 0 8px;color:#aaa;font-size:13px;">ORDER NUMBER</p>
              <h2 style="margin:0 0 20px;color:#9cff00;font-size:30px;">${escapeHtml(orderNumber)}</h2>

              <p style="margin:0 0 8px;color:#aaa;font-size:13px;">PAYMENT STATUS</p>
              <p style="display:inline-block;background:${outcome.colour};color:#000;padding:6px 18px;border-radius:20px;font-weight:bold;margin:0 0 20px;">
                ${escapeHtml(outcome.paymentStatus.toUpperCase())}
              </p>

              <p style="margin:0 0 8px;color:#ddd;"><strong style="color:#9cff00;">Amount paid:</strong> R${escapeHtml(amountGross || "Not supplied")}</p>
              <p style="margin:0 0 8px;color:#ddd;"><strong style="color:#9cff00;">Order total:</strong> ${order ? "R" + escapeHtml(order.grandTotal) : "Not in sheet yet"}</p>
              <p style="margin:0 0 8px;color:#ddd;"><strong style="color:#9cff00;">Customer Email:</strong> ${escapeHtml(payerEmail || "Not supplied")}</p>
              <p style="margin:0;color:#ddd;"><strong style="color:#9cff00;">Customer Name:</strong> ${escapeHtml(payerName || "Not supplied")}</p>
            </div>

            <div style="border:1px solid ${outcome.colour};border-radius:10px;padding:20px;margin-top:24px;">
              <h3 style="margin:0 0 12px;color:${outcome.colour};">NEXT STEP</h3>
              <p style="margin:0;color:#ddd;">${escapeHtml(outcome.note)}</p>
            </div>
          </div>

          <div style="padding:22px;text-align:center;background:#000;border-top:1px solid #222;">
            <p style="margin:0;color:#9cff00;font-weight:bold;">GERONIMO BAITS | BUILT TO HUNT.</p>
          </div>
        </div>
      </div>
    `;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const paymentEmailResult = await resend.emails.send({
      from: "Geronimo Baits <onboarding@resend.dev>",
      to: process.env.ORDER_EMAIL || "geronimocustombaits@gmail.com",
      subject: `${outcome.heading} - Geronimo Baits ${orderNumber}`,
      html: adminPaymentHtml,
    });
    console.log("PAYMENT EMAIL RESULT:", paymentEmailResult);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PAYFAST ITN ERROR:", error);
    return NextResponse.json({ success: false, error: "ITN failed" }, { status: 500 });
  }
}
