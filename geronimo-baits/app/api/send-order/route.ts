import { Resend } from "resend";
console.log("RESEND_API_KEY =", process.env.RESEND_API_KEY);
export async function POST(req: Request) {
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const order = await req.json();

    const orderLines = order.items
      .map(
        (item: any) =>
          `• ${item.qty}x ${item.bait} - ${item.colour} | SKU: ${item.sku} | R${item.price}`
      )
      .join("<br />");

    const html = `
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

    await resend.emails.send({
      from: "Geronimo Baits <onboarding@resend.dev>",
      to: process.env.ORDER_EMAIL || "geronimocustombaits@gmail.com",
      subject: "New Geronimo Baits Order",
      html,
    });

    await resend.emails.send({
      from: "Geronimo Baits <onboarding@resend.dev>",
     to: process.env.ORDER_EMAIL || "geronimocustombaits@gmail.com",
      subject: "Your Geronimo Baits Order Confirmation",
      html,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("SEND ORDER ERROR:", error);

    return Response.json(
      { success: false, error: "Email failed" },
      { status: 500 }
    );
  }
}