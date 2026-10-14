import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { parseCsv } from "@/lib/ordersSheet";

// Orders for the admin dashboard, read from the published Orders sheet.
// Uses the full CSV parser so multi-line ITEMS cells don't break rows apart.

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ success: false, error: "Not logged in" }, { status: 401 });
  }

  const csvUrl = process.env.ORDERS_CSV_URL;
  if (!csvUrl) return NextResponse.json([]);

  try {
    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json({ error: "Could not fetch orders sheet" }, { status: 500 });
    }

    const rows = parseCsv(await response.text());
    if (rows.length < 2) return NextResponse.json([]);

    const headers = rows[0].map((h) => h.trim().toUpperCase());

    const orders = rows
      .slice(1)
      .map((values) => {
        const get = (name: string) => {
          const index = headers.indexOf(name);
          return index >= 0 ? (values[index] || "").trim() : "";
        };

        return {
          orderNumber: get("ORDER #"),
          date: get("DATE"),
          customerName: get("CUSTOMER NAME"),
          customerPhone: get("PHONE"),
          customerEmail: get("EMAIL"),
          deliveryMethod: get("DELIVERY"),
          items: get("ITEMS"),
          productTotal: get("PRODUCT TOTAL"),
          shipping: get("SHIPPING"),
          grandTotal: get("GRAND TOTAL"),
          paymentMethod: get("PAYMENT METHOD"),
          paymentStatus: get("PAYMENT STATUS"),
          orderStatus: get("ORDER STATUS"),
          lockerCode: get("LOCKER CODE"),
          deliveryAddress: get("DELIVERY ADDRESS"),
          amountPaid: get("AMOUNT PAID"),
          huntBox: get("HUNT BOX"),
        };
      })
      .filter((order) => order.orderNumber);

    return NextResponse.json(orders.reverse());
  } catch (error) {
    console.error("ADMIN ORDERS ERROR:", error);
    return NextResponse.json({ error: "Could not load admin orders" }, { status: 500 });
  }
}
