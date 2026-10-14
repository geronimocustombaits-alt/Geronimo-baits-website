"use client";

import { useEffect, useState } from "react";
import { LAST_ORDER_KEY, SAVED_CART_KEY, formatRand } from "@/lib/shop";

type LastOrder = {
  orderNumber: string;
  grandTotal: number;
  customerName: string;
  deliveryMethod: string;
  locker: { code: string; name: string; address: string } | null;
  address: { street: string; suburb: string; city: string; postalCode: string } | null;
  items: { bait: string; colour: string; qty: number; price: string }[];
};

export default function PaymentSuccess() {
  const [order, setOrder] = useState<LastOrder | null>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAST_ORDER_KEY) || "null");
      if (saved?.orderNumber) setOrder(saved);
      // The order is paid, so empty the cart (details like name stay saved).
      const cart = JSON.parse(localStorage.getItem(SAVED_CART_KEY) || "null");
      if (cart) {
        localStorage.setItem(
          SAVED_CART_KEY,
          JSON.stringify({ ...cart, cart: [], huntBoxName: "", huntBoxSize: 0 })
        );
      }
    } catch {
      // Storage unavailable: show the plain thank-you.
    }
  }, []);

  const firstName = order?.customerName?.split(" ")[0];
  const deliveryLine = order?.locker
    ? `PUDO Locker ${order.locker.code ? `${order.locker.code} – ` : ""}${order.locker.name}`
    : order?.address
      ? [order.address.street, order.address.suburb, order.address.city, order.address.postalCode]
          .filter(Boolean)
          .join(", ")
      : order?.deliveryMethod;

  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-green-500/40 bg-black/80 p-8 text-center md:p-10">
        <p className="text-sm font-bold tracking-[0.4em] text-green-500">GERONIMO BAITS</p>

        <h1 className="mt-6 text-4xl font-black text-green-500 md:text-5xl">PAYMENT SUCCESSFUL</h1>

        <p className="mt-6 text-xl text-gray-300">
          {firstName ? `Thanks ${firstName}! ` : "Thank you! "}
          Your order is in and we&apos;ll get it packed and on its way.
        </p>

        {order && (
          <div className="mt-8 rounded-2xl border border-green-500/20 bg-black p-6 text-left">
            <p className="text-xs font-bold tracking-[0.25em] text-gray-500">ORDER NUMBER</p>
            <p className="mt-1 text-3xl font-black text-green-500">{order.orderNumber}</p>
            <p className="mt-1 text-sm text-gray-500">Keep this number for any questions about your order.</p>

            <div className="mt-6 space-y-2 border-t border-green-500/20 pt-4">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between gap-4 text-sm">
                  <span>
                    {item.qty}x {item.bait} – {item.colour}
                  </span>
                  <span className="text-gray-400">{formatRand(Number(item.price) * item.qty)}</span>
                </div>
              ))}
            </div>

            {deliveryLine && (
              <div className="mt-4 border-t border-green-500/20 pt-4">
                <p className="text-xs font-bold tracking-[0.25em] text-gray-500">DELIVERING TO</p>
                <p className="mt-1 font-bold">{deliveryLine}</p>
              </div>
            )}

            <div className="mt-4 flex justify-between border-t border-green-500/20 pt-4 text-lg font-black">
              <span>Total paid</span>
              <span className="text-green-500">R{Number(order.grandTotal).toFixed(2)}</span>
            </div>
          </div>
        )}

        <p className="mt-6 text-gray-400">Built to Hunt. #WeMakeItFishTakeIt</p>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="/"
            className="inline-block rounded-xl bg-green-500 px-8 py-4 font-black text-black transition hover:bg-green-400"
          >
            BACK TO HOME
          </a>
          <a
            href={`https://wa.me/27675380595?text=${encodeURIComponent(
              `Hi Geronimo Baits! I just placed order ${order?.orderNumber ?? ""}.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-xl border border-green-500 px-8 py-4 font-black text-green-500 transition hover:bg-green-500 hover:text-black"
          >
            💬 WHATSAPP US
          </a>
        </div>
      </div>
    </main>
  );
}
