"use client";

import { useEffect, useState } from "react";

// Shared header + menu for every back office screen.
// PUBLIC ORDERS and DEALER ORDERS show a count of orders still waiting to be packed.

const LINKS: { href: string; label: string; red?: boolean }[] = [
  { href: "/admin", label: "PUBLIC ORDERS" },
  { href: "/admin/dealer-orders", label: "DEALER ORDERS", red: true },
  { href: "/admin/make", label: "MAKE" },
  { href: "/admin/production", label: "PRODUCTION" },
  { href: "/admin/stock", label: "STOCK" },
  { href: "/admin/sales", label: "SALES" },
  { href: "/admin/recap", label: "RECAP" },
  { href: "/admin/dealers", label: "DEALER LINKS" },
  { href: "/admin/ambassadors", label: "AMBASSADORS" },
  { href: "/admin/labels", label: "🏷 LABELS" },
  { href: "/admin/scan", label: "📷 SCANNER" },
];

export default function AdminNav({
  current,
  title,
  subtitle,
}: {
  current: string;
  title: string;
  subtitle?: string;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Open orders (not packed / shipped / completed / cancelled / void / on hold)
  useEffect(() => {
    fetch("/api/admin/orders", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((orders) => {
        if (!Array.isArray(orders)) return;
        const done = ["packed", "shipped", "completed", "cancelled"];
        const open = orders.filter(
          (o: { orderStatus?: string; paymentStatus?: string }) =>
            !done.includes(String(o.orderStatus || "").toLowerCase()) &&
            !String(o.orderStatus || "").toLowerCase().startsWith("on hold") &&
            !String(o.paymentStatus || "").toLowerCase().includes("void")
        );
        const dealer = (o: { paymentMethod?: string }) => String(o.paymentMethod || "").toLowerCase() === "dealer";
        setCounts({
          "/admin": open.filter((o: { paymentMethod?: string }) => !dealer(o)).length,
          "/admin/dealer-orders": open.filter(dealer).length,
        });
      })
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="mb-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-black tracking-[0.4em] text-green-500">GERONIMO BAITS</p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 text-gray-400">{subtitle}</p>}
        </div>
        <button
          onClick={logout}
          className="self-start rounded-xl border border-red-500/60 px-5 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500 hover:text-black"
        >
          LOG OUT
        </button>
      </div>
      <nav className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {LINKS.map((link) => {
          const active = current === link.href;
          const count = counts[link.href] || 0;
          const colours = link.red
            ? active
              ? "bg-red-500 text-black"
              : "border border-red-500 bg-black text-red-400 hover:bg-red-500 hover:text-black"
            : active
              ? "bg-green-500 text-black"
              : "border border-green-500 bg-black text-green-500 hover:bg-green-500 hover:text-black";
          return (
            <a
              key={link.href}
              href={link.href}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-black tracking-wider transition ${colours}`}
            >
              {link.label}
              {count > 0 && (
                <span
                  className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[10px] leading-none ${
                    active ? "bg-black text-white" : "bg-red-500 text-white"
                  }`}
                  title="Orders waiting to be packed"
                >
                  {count}
                </span>
              )}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
