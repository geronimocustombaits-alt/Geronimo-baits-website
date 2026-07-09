import { Resend } from "resend";
import { orderConfirmationEmail } from "@/lib/emailTemplates/orderConfirmationEmail";

export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const order = await req.json();

    console.log("NEW ORDER RECEIVED:", order.orderNumber);
    console.log("CUSTOMER EMAIL:", order.customerEmail);
    console.log("ORDER EMAIL:", process.env.ORDER_EMAIL);

    // 1. Send order to Google Sheets
    if (process.env.ORDERS_WEBHOOK_URL) {
      const sheetResponse = await fetch(process.env.ORDERS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(order),
      });

      const sheetResult = await sheetResponse.text();

      console.log("SHEET STATUS:", sheetResponse.status);
      console.log("SHEET RESULT:", sheetResult);
    } else {
      console.log("ORDERS_WEBHOOK_URL missing");
    }

    // 2. Build plain admin order lines
    const orderLines = order.items
      .map(
        (item: any) =>
          `• ${item.qty}x ${item.bait} - ${item.colour} | SKU: ${item.sku} | R${item.price}`
      )
      .join("<br />");

    // 3. Admin email to you
    const adminHtml = `
      <h2>🎣 New Geronimo Baits Order</h2>

      <p><strong>Order Number:</strong> ${order.orderNumber}</p>

      <p><strong>Name:</strong> ${order.customerName}</p>
      <p><strong>Phone:</strong> ${order.customerPhone}</p>
      <p><strong>Email:</strong> ${order.customerEmail}</p>
      <p><strong>Delivery:</strong> ${order.deliveryMethod}</p>

      <h3>Order Items</h3>
      <p>${orderLines}</p>

      <hr />

      <p><strong>Products:</strong> R${order.cartTotal}</p>
      <p><strong>Shipping:</strong> R${order.shippingCost}</p>
      <p><strong>Total:</strong> R${order.grandTotal}</p>

      <br />

      <p>Built to Hunt.</p>
      <p>Geronimo Baits</p>
    `;

    const adminEmailResult = await resend.emails.send({
      from: "Geronimo Baits <onboarding@resend.dev>",
      to: process.env.ORDER_EMAIL || "geronimocustombaits@gmail.com",
      subject: `New Geronimo Baits Order - ${order.orderNumber}`,
      html: adminHtml,
    });

    console.log("ADMIN EMAIL RESULT:", adminEmailResult);

    // 4. Branded customer confirmation email
    const customerHtml = orderConfirmationEmail({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      products: order.items.map((item: any) => ({
        name: item.bait,
        colour: item.colour,
        quantity: item.qty,
        price: item.price,
        total: Number(item.price) * Number(item.qty),
      })),
      shippingMethod: order.deliveryMethod,
      shippingAddress:
        order.customerAddress ||
        order.address ||
        order.deliveryAddress ||
        "Address not supplied",
      subtotal: order.cartTotal,
      shipping: order.shippingCost,
      total: order.grandTotal,
      paymentStatus: "Pending",
    });

    const customerEmailResult = await resend.emails.send({
      from: "Geronimo Baits <onboarding@resend.dev>",
      to: "geronimocustombaits@gmail.com",
      subject: `Order Received - Geronimo Baits ${order.orderNumber}`,
      html: customerHtml,
    });

    console.log("CUSTOMER EMAIL RESULT:", customerEmailResult);

    return Response.json({
      success: true,
      message: "Order saved and emails sent",
      adminEmailResult,
      customerEmailResult,
    });
  } catch (error) {
    console.error("SEND ORDER ERROR:", error);

    return Response.json(
      {
        success: false,
        error: "Email failed",
      },
      { status: 500 }
    );
  }
}