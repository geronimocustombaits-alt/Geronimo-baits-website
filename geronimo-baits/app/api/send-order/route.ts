import { NextResponse } from "next/server";
import { Resend } from "resend";
import { orderConfirmationEmail } from "@/lib/emailTemplates/orderConfirmationEmail";
import { fetchProducts, type Product } from "@/lib/products";
import { generateOrderNumber } from "@/lib/orderNumber";
import { createPaymentUrl } from "@/lib/payfast";
import { HUNT_BOXES, SHIPPING_OPTIONS, shippingCostFor } from "@/lib/shop";

// Places an order. The browser only sends WHICH baits and HOW MANY plus the
// customer's details. Prices, shipping, totals and the order number are all
// worked out here on the server, so they can't be changed in the browser.
// Returns the PayFast link to send the customer to.

type OrderLine = Product & { qty: number };

function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return fail("Invalid order");
  }

  // Customer details
  const customerName = text(body.customerName, 80);
  const customerPhone = text(body.customerPhone, 30);
  const customerEmail = text(body.customerEmail, 120);
  const deliveryMethod = text(body.deliveryMethod, 40);
  const huntBoxName = text(body.huntBoxName, 40);

  if (!customerName || !customerPhone || !customerEmail) {
    return fail("Please fill in your name, phone number and email.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return fail("Please check your email address.");
  }
  if (!(deliveryMethod in SHIPPING_OPTIONS)) {
    return fail("Please choose a delivery method.");
  }

  // Requested items: [{ sku, qty }]
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return fail("Your cart is empty.");
  }

  const requested = new Map<string, number>();
  for (const item of body.items as { sku?: unknown; qty?: unknown }[]) {
    const sku = text(item?.sku, 60);
    const qty = Number(item?.qty);
    if (!sku || !Number.isInteger(qty) || qty < 1 || qty > 100) {
      return fail("Something is wrong with an item in your cart. Please refresh and try again.");
    }
    requested.set(sku, (requested.get(sku) || 0) + qty);
  }

  // Look up real prices and stock
  let products: Product[];
  try {
    products = await fetchProducts();
  } catch (error) {
    console.error("PLACE ORDER: products unavailable:", error);
    return fail("We couldn't load our stock list. Please try again in a minute.", 503);
  }

  const lines: OrderLine[] = [];
  for (const [sku, qty] of requested) {
    const product = products.find((p) => p.sku === sku);
    if (!product) {
      return fail("One of the baits in your cart is no longer available. Please refresh and try again.");
    }

    const price = Number(product.price);
    const stock = Number(product.stockQty);
    if (!Number.isFinite(price) || price <= 0) {
      return fail(`${product.bait} - ${product.colour} isn't available right now.`);
    }
    if (!Number.isFinite(stock) || stock < qty) {
      return fail(
        stock > 0
          ? `Only ${stock} left of ${product.bait} - ${product.colour}. Please update your cart.`
          : `${product.bait} - ${product.colour} has just sold out. Please update your cart.`
      );
    }
    lines.push({ ...product, qty });
  }

  // Hunt Box must be filled exactly
  const packCount = lines.reduce((sum, line) => sum + line.qty, 0);
  if (huntBoxName) {
    const box = HUNT_BOXES.find((b) => b.name === huntBoxName);
    if (!box) return fail("Unknown Hunt Box.");
    if (packCount !== box.size) {
      return fail(`Your ${box.name} needs exactly ${box.size} packs.`);
    }
  }

  // Totals
  const cartTotal = lines.reduce((sum, line) => sum + Number(line.price) * line.qty, 0);
  const shippingCost = shippingCostFor(deliveryMethod);
  const grandTotal = cartTotal + shippingCost;
  const orderNumber = generateOrderNumber();

  const order = {
    orderNumber,
    customerName,
    customerPhone,
    customerEmail,
    deliveryMethod,
    huntBox: huntBoxName || "",
    cartTotal,
    shippingCost,
    grandTotal,
    paymentMethod: "PayFast",
    paymentStatus: "Pending",
    orderStatus: "Processing",
    items: lines,
  };

  console.log("NEW ORDER:", orderNumber, `R${grandTotal}`, customerEmail);

  // Build the PayFast link first: if PayFast isn't set up, stop before saving.
  let paymentUrl: string;
  try {
    paymentUrl = createPaymentUrl({ orderNumber, customerName, customerEmail, amount: grandTotal });
  } catch (error) {
    console.error("PLACE ORDER: PayFast not configured:", error);
    return fail("Online payment isn't available right now. Please contact us on WhatsApp.", 500);
  }

  // 1. Save to the Orders sheet (the order must be saved before payment)
  if (!process.env.ORDERS_WEBHOOK_URL) {
    console.error("PLACE ORDER: ORDERS_WEBHOOK_URL missing");
    return fail("We couldn't save your order. Please contact us on WhatsApp.", 500);
  }
  try {
    const sheetResponse = await fetch(process.env.ORDERS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(order),
    });
    // Apps Script answers via a redirect, so a non-200 here is logged as a
    // warning rather than blocking the order.
    console.log("SHEET STATUS:", sheetResponse.status, await sheetResponse.text());
  } catch (error) {
    console.error("PLACE ORDER: could not save to sheet:", error);
    return fail("We couldn't save your order. Please try again or contact us on WhatsApp.", 502);
  }

  // 2. Emails (a failed email shouldn't stop the customer paying)
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const orderLines = lines
      .map(
        (line) =>
          `• ${line.qty}x ${escapeHtml(line.bait)} - ${escapeHtml(line.colour)} | SKU: ${escapeHtml(line.sku)} | R${escapeHtml(line.price)}`
      )
      .join("<br />");

    const adminHtml = `
      <h2>🎣 New Geronimo Baits Order</h2>
      <p><strong>Order Number:</strong> ${orderNumber}</p>
      <p><strong>Name:</strong> ${escapeHtml(customerName)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(customerPhone)}</p>
      <p><strong>Email:</strong> ${escapeHtml(customerEmail)}</p>
      <p><strong>Delivery:</strong> ${escapeHtml(deliveryMethod)}</p>
      ${huntBoxName ? `<p><strong>Hunt Box:</strong> ${escapeHtml(huntBoxName)}</p>` : ""}
      <h3>Order Items</h3>
      <p>${orderLines}</p>
      <hr />
      <p><strong>Products:</strong> R${cartTotal.toFixed(2)}</p>
      <p><strong>Shipping:</strong> R${shippingCost.toFixed(2)}</p>
      <p><strong>Total:</strong> R${grandTotal.toFixed(2)}</p>
      <p><strong>Payment:</strong> Waiting for PayFast</p>
      <br />
      <p>Built to Hunt.</p>
      <p>Geronimo Baits</p>
    `;

    const adminEmailResult = await resend.emails.send({
      from: "Geronimo Baits <onboarding@resend.dev>",
      to: process.env.ORDER_EMAIL || "geronimocustombaits@gmail.com",
      subject: `New Geronimo Baits Order - ${orderNumber}`,
      html: adminHtml,
    });
    console.log("ADMIN EMAIL RESULT:", adminEmailResult);

    const customerHtml = orderConfirmationEmail({
      orderNumber,
      customerName: escapeHtml(customerName),
      products: lines.map((line) => ({
        name: escapeHtml(line.bait),
        colour: escapeHtml(line.colour),
        quantity: line.qty,
        price: line.price,
        total: Number(line.price) * line.qty,
      })),
      shippingMethod: escapeHtml(deliveryMethod),
      shippingAddress: "Address not supplied",
      subtotal: cartTotal,
      shipping: shippingCost,
      total: grandTotal,
      paymentStatus: "Pending",
    });

    // Still goes to your inbox until a domain is verified in Resend (step 3).
    const customerEmailResult = await resend.emails.send({
      from: "Geronimo Baits <onboarding@resend.dev>",
      to: "geronimocustombaits@gmail.com",
      subject: `Order Received - Geronimo Baits ${orderNumber}`,
      html: customerHtml,
    });
    console.log("CUSTOMER EMAIL RESULT:", customerEmailResult);
  } catch (error) {
    console.error("PLACE ORDER: email failed (order still saved):", error);
  }

  return NextResponse.json({ success: true, orderNumber, grandTotal, paymentUrl });
}
