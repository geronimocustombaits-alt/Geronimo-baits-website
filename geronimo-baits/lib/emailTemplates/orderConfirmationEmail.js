export function orderConfirmationEmail({
  orderNumber,
  customerName,
  products,
  shippingMethod,
  shippingAddress,
  subtotal,
  shipping,
  total,
  paymentStatus = "Paid",
}) {
  const productRows = products
    .map(
      (item) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #222;">
            <strong style="color:#fff;">${item.name}</strong><br/>
            <span style="color:#9cff00;">${item.colour || ""}</span>
          </td>
          <td style="padding:12px;border-bottom:1px solid #222;text-align:center;color:#fff;">
            ${item.quantity}
          </td>
          <td style="padding:12px;border-bottom:1px solid #222;text-align:right;color:#fff;">
            R${item.price}
          </td>
          <td style="padding:12px;border-bottom:1px solid #222;text-align:right;color:#9cff00;font-weight:bold;">
            R${item.total}
          </td>
        </tr>
      `
    )
    .join("");

  return `
  <div style="margin:0;padding:0;background:#050505;font-family:Arial,Helvetica,sans-serif;color:#ffffff;">
    <div style="max-width:720px;margin:0 auto;background:#0b0b0b;border:1px solid #1f1f1f;">
      
      <div style="padding:30px 24px;text-align:center;background:#000;">
        <h1 style="margin:0;color:#ffffff;font-size:42px;letter-spacing:2px;">GERONIMO</h1>
        <h2 style="margin:4px 0 10px;color:#9cff00;font-size:24px;">BAITS</h2>
        <p style="margin:0;color:#ffffff;font-size:16px;font-weight:bold;">BUILT TO HUNT.</p>
      </div>

      <div style="padding:30px 24px;">
        <h2 style="color:#9cff00;margin:0 0 12px;font-size:28px;">ORDER CONFIRMED</h2>
        <p style="font-size:18px;margin:0 0 16px;color:#fff;">Hi ${customerName},</p>
        <p style="font-size:16px;line-height:1.6;color:#ddd;margin:0;">
          Thanks for your order. We’ve received your Geronimo Baits order and will start getting it ready for you.
        </p>
      </div>

      <div style="padding:0 24px 24px;">
        <div style="background:#111;border:1px solid #2b2b2b;border-radius:10px;padding:20px;">
          <p style="margin:0 0 8px;color:#aaa;font-size:13px;">ORDER NUMBER</p>
          <h2 style="margin:0 0 20px;color:#9cff00;font-size:32px;">${orderNumber}</h2>

          <p style="margin:0 0 8px;color:#aaa;font-size:13px;">PAYMENT STATUS</p>
          <p style="display:inline-block;background:#65b800;color:#fff;padding:6px 18px;border-radius:20px;font-weight:bold;margin:0;">
            ${paymentStatus}
          </p>
        </div>
      </div>

      <div style="padding:0 24px 24px;">
        <h3 style="color:#ffffff;margin:0 0 12px;">YOUR ORDER</h3>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#111;border:1px solid #2b2b2b;border-radius:10px;overflow:hidden;">
          <thead>
            <tr>
              <th align="left" style="padding:12px;color:#aaa;border-bottom:1px solid #2b2b2b;">PRODUCT</th>
              <th align="center" style="padding:12px;color:#aaa;border-bottom:1px solid #2b2b2b;">QTY</th>
              <th align="right" style="padding:12px;color:#aaa;border-bottom:1px solid #2b2b2b;">PRICE</th>
              <th align="right" style="padding:12px;color:#aaa;border-bottom:1px solid #2b2b2b;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${productRows}
          </tbody>
        </table>
      </div>

      <div style="padding:0 24px 24px;">
        <div style="background:#111;border:1px solid #2b2b2b;border-radius:10px;padding:20px;">
          <h3 style="margin:0 0 16px;color:#ffffff;">SHIPPING DETAILS</h3>
          <p style="margin:0 0 8px;color:#ddd;"><strong style="color:#9cff00;">Method:</strong> ${shippingMethod}</p>
          <p style="margin:0;color:#ddd;"><strong style="color:#9cff00;">Address:</strong><br/>${shippingAddress}</p>
        </div>
      </div>

      <div style="padding:0 24px 24px;">
        <div style="background:#111;border:1px solid #2b2b2b;border-radius:10px;padding:20px;">
          <p style="margin:0 0 8px;color:#ddd;">Subtotal: <strong style="float:right;">R${subtotal}</strong></p>
          <p style="margin:0 0 8px;color:#ddd;">Shipping: <strong style="float:right;">R${shipping}</strong></p>
          <hr style="border:none;border-top:1px solid #333;margin:16px 0;" />
          <p style="margin:0;color:#fff;font-size:22px;font-weight:bold;">Total Paid: <span style="float:right;color:#9cff00;">R${total}</span></p>
        </div>
      </div>

      <div style="padding:0 24px 30px;">
        <div style="border:1px solid #9cff00;border-radius:10px;padding:20px;">
          <h3 style="margin:0 0 12px;color:#9cff00;">WHAT HAPPENS NEXT?</h3>
          <p style="margin:0 0 8px;color:#ddd;">1. We pack your baits</p>
          <p style="margin:0 0 8px;color:#ddd;">2. Your order gets marked as ready to ship</p>
          <p style="margin:0;color:#ddd;">3. You receive a shipping update</p>
        </div>
      </div>

      <div style="padding:24px;text-align:center;background:#000;border-top:1px solid #222;">
        <p style="margin:0 0 8px;color:#ffffff;">Thank you for supporting handmade South African soft plastics.</p>
        <p style="margin:0;color:#9cff00;font-weight:bold;letter-spacing:1px;">GERONIMO BAITS | BUILT TO HUNT.</p>
      </div>

    </div>
  </div>
  `;
}