"use client";

import { useEffect, useMemo, useState } from "react";

type Order = {
  orderNumber: string;
  date: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryMethod: string;
  items: string;
  productTotal: string;
  shipping: string;
  grandTotal: string;
  paymentMethod: string;
  paymentStatus: string;
  orderStatus: string;
  lockerCode: string;
  deliveryAddress: string;
  amountPaid: string;
  huntBox: string;
};

type Filter = "all" | "awaiting" | "topack" | "shipped" | "completed" | "problems";

const STATUS_BUTTONS = ["Processing", "Packed", "Shipped", "Completed"];

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "awaiting", label: "AWAITING PAYMENT" },
  { id: "topack", label: "TO PACK" },
  { id: "shipped", label: "SHIPPED" },
  { id: "completed", label: "COMPLETED" },
  { id: "problems", label: "NEEDS ATTENTION" },
];

// "R1,250.00" → 1250
const amount = (value: string) => {
  const n = Number(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const lower = (value: string) => String(value || "").toLowerCase();
const isPaid = (o: Order) => lower(o.paymentStatus).startsWith("paid");
const isProblem = (o: Order) =>
  lower(o.paymentStatus).includes("mismatch") ||
  lower(o.paymentStatus).includes("check") ||
  lower(o.orderStatus) === "on hold";

function matchesFilter(order: Order, filter: Filter) {
  const status = lower(order.orderStatus);
  switch (filter) {
    case "awaiting":
      return lower(order.paymentStatus) === "pending";
    case "topack":
      return isPaid(order) && !["shipped", "completed"].includes(status);
    case "shipped":
      return status === "shipped";
    case "completed":
      return status === "completed";
    case "problems":
      return isProblem(order);
    default:
      return true;
  }
}

function paymentColour(order: Order) {
  if (isProblem(order)) return "text-red-400";
  if (isPaid(order)) return "text-green-500";
  return "text-yellow-400";
}

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Opens a clean, printable packing slip in a new tab.
function printPackingSlip(order: Order) {
  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;

  const items = escapeHtml(order.items).split("\n").map((line) => `<li>${line}</li>`).join("");
  const deliveryTo = order.deliveryAddress || order.deliveryMethod;

  win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>Packing slip ${escapeHtml(order.orderNumber)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 32px; }
  h1 { margin: 0; letter-spacing: 3px; } .brand { color: #2a8f00; margin: 2px 0 24px; font-weight: bold; }
  .order { font-size: 28px; font-weight: bold; margin: 0 0 16px; }
  .box { border: 2px solid #000; border-radius: 8px; padding: 14px 18px; margin-bottom: 16px; }
  .label { font-size: 11px; font-weight: bold; letter-spacing: 2px; color: #555; margin: 0 0 4px; }
  .big { font-size: 20px; font-weight: bold; margin: 0; }
  ul { margin: 6px 0 0; padding-left: 20px; font-size: 16px; line-height: 1.6; }
  .row { display: flex; gap: 16px; } .row .box { flex: 1; }
  .foot { margin-top: 28px; text-align: center; font-weight: bold; letter-spacing: 2px; }
  @media print { .noprint { display: none; } body { margin: 12mm; } }
</style></head><body>
  <button class="noprint" onclick="window.print()" style="float:right;padding:10px 18px;font-weight:bold">PRINT</button>
  <h1>GERONIMO</h1><p class="brand">BAITS · BUILT TO HUNT</p>
  <p class="order">${escapeHtml(order.orderNumber)}</p>
  <div class="row">
    <div class="box"><p class="label">CUSTOMER</p><p class="big">${escapeHtml(order.customerName)}</p>
      <p>${escapeHtml(order.customerPhone)}<br>${escapeHtml(order.customerEmail)}</p></div>
    <div class="box"><p class="label">ORDER DATE</p><p class="big">${escapeHtml(order.date)}</p>
      <p>${escapeHtml(order.paymentStatus)}</p></div>
  </div>
  <div class="box"><p class="label">DELIVER TO</p>
    ${order.lockerCode ? `<p class="big">PUDO LOCKER ${escapeHtml(order.lockerCode)}</p>` : ""}
    <p class="big" style="font-size:16px">${escapeHtml(deliveryTo)}</p></div>
  <div class="box"><p class="label">PACK${order.huntBox ? ` · ${escapeHtml(order.huntBox)}` : ""}</p><ul>${items}</ul></div>
  <p class="foot">THANK YOU FOR HUNTING WITH GERONIMO · #WeMakeItFishTakeIt</p>
</body></html>`);
  win.document.close();
}

export default function AdminPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrder, setUpdatingOrder] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  async function loadOrders() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/orders", { cache: "no-store" });

      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      const data = response.ok ? await response.json() : [];
      setOrders(Array.isArray(data) ? data : []);
      if (!response.ok) setError("Couldn't load orders from the sheet.");
    } catch (err) {
      console.error("Could not load orders:", err);
      setOrders([]);
      setError("Couldn't load orders. Check your connection and refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function updateOrderStatus(orderNumber: string, orderStatus: string) {
    try {
      setUpdatingOrder(orderNumber);
      setError("");

      const response = await fetch("/api/admin/update-order-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, orderStatus }),
      });

      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }

      const data = await response.json();
      if (!data.success) {
        setError(`Couldn't update ${orderNumber}. Try again.`);
        return;
      }

      // Show the change straight away; the published sheet can lag behind.
      setOrders((current) =>
        current.map((o) => (o.orderNumber === orderNumber ? { ...o, orderStatus } : o))
      );
    } catch (err) {
      console.error("Update failed:", err);
      setError(`Couldn't update ${orderNumber}. Try again.`);
    } finally {
      setUpdatingOrder("");
    }
  }

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  const stats = useMemo(() => {
    const paid = orders.filter(isPaid);
    return {
      total: orders.length,
      awaiting: orders.filter((o) => matchesFilter(o, "awaiting")).length,
      toPack: orders.filter((o) => matchesFilter(o, "topack")).length,
      problems: orders.filter(isProblem).length,
      // Revenue only counts orders that have actually been paid.
      revenue: paid.reduce((sum, o) => sum + amount(o.amountPaid || o.grandTotal), 0),
    };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => matchesFilter(o, filter))
      .filter((o) =>
        !q
          ? true
          : [o.orderNumber, o.customerName, o.customerEmail, o.customerPhone, o.lockerCode, o.deliveryMethod, o.items]
              .join(" ")
              .toLowerCase()
              .includes(q)
      );
  }, [orders, filter, search]);

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div>
            <p className="text-sm font-black tracking-[0.4em] text-green-500">GERONIMO BAITS</p>
            <h1 className="mt-3 text-4xl font-black md:text-5xl">ADMIN DASHBOARD</h1>
            <p className="mt-3 text-gray-400">Manage orders, payments and packing progress.</p>
          </div>

          <div className="flex gap-3 self-start">
            <a
              href="/admin/scan"
              className="rounded-xl bg-green-500 px-5 py-2 text-sm font-black text-black transition hover:bg-green-400"
            >
              📷 SCANNER
            </a>
            <button
              onClick={logout}
              className="rounded-xl border border-red-500/60 px-5 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500 hover:text-black"
            >
              LOG OUT
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat label="TOTAL ORDERS" value={stats.total} />
          <Stat label="AWAITING PAYMENT" value={stats.awaiting} tone="yellow" />
          <Stat label="TO PACK" value={stats.toPack} />
          <Stat label="NEEDS ATTENTION" value={stats.problems} tone={stats.problems ? "red" : "grey"} />
          <Stat label="REVENUE (PAID)" value={`R${stats.revenue.toFixed(2)}`} />
        </div>

        <div className="mt-10 rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-2xl font-black">ORDERS</h2>
            <div className="flex gap-3">
              <input
                type="search"
                placeholder="Search order, name, phone, locker..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-2 text-sm text-white outline-none focus:border-green-500 md:w-80"
              />
              <button
                onClick={loadOrders}
                className="rounded-xl border border-green-500 px-4 py-2 text-sm font-bold text-green-500 transition hover:bg-green-500 hover:text-black"
              >
                REFRESH
              </button>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const count = orders.filter((o) => matchesFilter(o, f.id)).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-4 py-2 text-xs font-black tracking-wider transition ${
                    filter === f.id
                      ? "bg-green-500 text-black"
                      : "border border-green-500/30 text-green-500 hover:border-green-500"
                  }`}
                >
                  {f.label} ({count})
                </button>
              );
            })}
          </div>

          {error && (
            <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
              {error}
            </p>
          )}

          {loading ? (
            <div className="rounded-2xl border border-green-500/20 bg-black p-8 text-center text-gray-400">
              Loading orders...
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="rounded-2xl border border-green-500/20 bg-black p-8 text-center text-gray-400">
              {orders.length === 0 ? "No orders found yet." : "No orders match this view."}
            </div>
          ) : (
            <div className="grid gap-4">
              {visibleOrders.map((order) => {
                const currentStatus = order.orderStatus || "Processing";
                const isUpdating = updatingOrder === order.orderNumber;

                return (
                  <div key={order.orderNumber} className="rounded-2xl border border-green-500/20 bg-black p-5">
                    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                      <div>
                        <p className="text-xs font-bold tracking-[0.25em] text-green-500">
                          ORDER · {order.date}
                        </p>
                        <h3 className="mt-1 text-2xl font-black">{order.orderNumber}</h3>
                        <p className="mt-2 text-gray-300">{order.customerName || "No customer"}</p>
                        <p className="text-sm text-gray-500">
                          {order.customerPhone}
                          {order.customerPhone && order.customerEmail ? " · " : ""}
                          {order.customerEmail}
                        </p>
                      </div>

                      <div className="text-left md:text-right">
                        <p className="text-sm text-gray-400">Total</p>
                        <p className="text-2xl font-black text-green-500">R{amount(order.grandTotal).toFixed(2)}</p>
                        {order.amountPaid && (
                          <p className="text-xs text-gray-500">Paid R{amount(order.amountPaid).toFixed(2)}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <Info label="PAYMENT STATUS" className={paymentColour(order)}>
                        {order.paymentStatus || "Pending"}
                      </Info>
                      <Info label="ORDER STATUS" className="text-green-500">
                        {currentStatus}
                      </Info>
                      <Info label="DELIVERY">
                        {order.lockerCode ? (
                          <>
                            <span className="text-green-500">PUDO {order.lockerCode}</span>
                            <span className="block text-xs font-normal text-gray-400">
                              {order.deliveryAddress || order.deliveryMethod}
                            </span>
                          </>
                        ) : (
                          order.deliveryMethod || "Not supplied"
                        )}
                      </Info>
                    </div>

                    <div className="mt-5 rounded-xl border border-green-500/10 bg-black/70 p-4">
                      <p className="text-xs font-bold text-gray-500">
                        ITEMS{order.huntBox ? ` · ${order.huntBox}` : ""}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                        {order.items || "No items listed"}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {STATUS_BUTTONS.map((status) => (
                        <button
                          key={status}
                          disabled={isUpdating || currentStatus === status}
                          onClick={() => updateOrderStatus(order.orderNumber, status)}
                          className={`rounded-xl px-4 py-3 text-sm font-black transition ${
                            currentStatus === status
                              ? "bg-green-500 text-black"
                              : "border border-green-500/40 text-green-500 hover:bg-green-500 hover:text-black"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {isUpdating ? "UPDATING..." : status.toUpperCase()}
                        </button>
                      ))}

                      <button
                        onClick={() => printPackingSlip(order)}
                        className="rounded-xl border border-white/30 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-black md:ml-auto"
                      >
                        🖨 PACKING SLIP
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "green",
}: {
  label: string;
  value: string | number;
  tone?: "green" | "yellow" | "red" | "grey";
}) {
  const colours = {
    green: "border-green-500/20 text-green-500",
    yellow: "border-yellow-500/30 text-yellow-400",
    red: "border-red-500/40 text-red-400",
    grey: "border-green-500/20 text-gray-500",
  }[tone];

  return (
    <div className={`rounded-3xl border bg-black/70 p-5 ${colours.split(" ")[0]}`}>
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <h2 className={`mt-3 text-2xl font-black md:text-3xl ${colours.split(" ")[1]}`}>{value}</h2>
    </div>
  );
}

function Info({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-green-500/10 bg-black/70 p-4">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <div className={`mt-1 font-black ${className}`}>{children}</div>
    </div>
  );
}
