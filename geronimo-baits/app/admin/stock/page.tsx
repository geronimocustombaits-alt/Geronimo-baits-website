"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "../AdminNav";

// Live stock: every product and colour on the Inventory tab, with what's left.
// Refreshes itself every minute.

type Item = {
  sku: string;
  colour: string;
  product: string;
  par: number;
  inStock: number;
  sold: number;
  left: number;
};

type Filter = "all" | "instock" | "low" | "out";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "instock", label: "IN STOCK" },
  { id: "low", label: "BELOW PAR" },
  { id: "out", label: "OUT OF STOCK" },
];

const REFRESH_MS = 60_000;
// Lure types you're not selling right now (remembered on this device)
const NOT_SELLING_KEY = "gb_stock_not_selling";

// Made-to-order colours (par 0) with nothing on the shelf aren't "out of stock"
const isTracked = (i: Item) => i.par > 0 || i.left !== 0;
const isOut = (i: Item) => i.left <= 0 && i.par > 0;
const isLow = (i: Item) => i.left > 0 && i.left < i.par;

function tone(i: Item) {
  if (i.left < 0) return "text-red-400";
  if (isOut(i)) return "text-red-400";
  if (isLow(i)) return "text-yellow-400";
  if (i.left > 0) return "text-green-500";
  return "text-gray-600";
}

function matches(i: Item, f: Filter) {
  switch (f) {
    case "instock":
      return i.left > 0;
    case "low":
      return isLow(i);
    case "out":
      return isOut(i);
    default:
      return true;
  }
}

export default function StockPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [notSelling, setNotSelling] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(NOT_SELLING_KEY) || "[]");
      if (Array.isArray(saved)) setNotSelling(saved);
    } catch {
      // nothing saved on this device
    }
  }, []);

  function toggleSelling(product: string) {
    setNotSelling((current) => {
      const next = current.includes(product) ? current.filter((p) => p !== product) : [...current, product];
      try {
        localStorage.setItem(NOT_SELLING_KEY, JSON.stringify(next));
      } catch {
        // not remembered on this device, but still applied until you leave the page
      }
      return next;
    });
  }
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [hideEmpty, setHideEmpty] = useState(true);

  async function load(showSpinner = false) {
    if (showSpinner) setLoading(true);
    try {
      const response = await fetch("/api/admin/inventory", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await response.json();
      if (!data.success) {
        setError(data.error || "Couldn't load stock");
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setError("");
      setUpdatedAt(new Date(data.at || Date.now()).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setError("No connection. Showing the last stock loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(true);
    const timer = setInterval(() => load(), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const selling = items.filter((i) => !notSelling.includes(i.product || "Other"));
    const tracked = selling.filter(isTracked);
    return {
      packs: selling.reduce((s, i) => s + Math.max(i.left, 0), 0),
      inStock: selling.filter((i) => i.left > 0).length,
      low: tracked.filter(isLow).length,
      out: tracked.filter(isOut).length,
    };
  }, [items, notSelling]);

  const productTypes = useMemo(() => [...new Set(items.map((i) => i.product || "Other"))], [items]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const visible = items
      .filter((i) => !notSelling.includes(i.product || "Other"))
      .filter((i) => matches(i, filter))
      .filter((i) => !hideEmpty || filter !== "all" || isTracked(i))
      .filter((i) => !q || `${i.sku} ${i.colour} ${i.product}`.toLowerCase().includes(q));
    const map = new Map<string, Item[]>();
    visible.forEach((i) => {
      const key = i.product || "Other";
      map.set(key, [...(map.get(key) || []), i]);
    });
    return Array.from(map.entries());
  }, [items, filter, search, hideEmpty, notSelling]);

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminNav
          current="/admin/stock"
          title="LIVE STOCK"
          subtitle={`What's on the shelf right now${updatedAt ? ` · updated ${updatedAt}` : ""}.`}
        />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="PACKS ON THE SHELF" value={stats.packs} />
          <Stat label="COLOURS IN STOCK" value={stats.inStock} />
          <Stat label="BELOW PAR" value={stats.low} tone={stats.low ? "yellow" : "grey"} />
          <Stat label="OUT OF STOCK" value={stats.out} tone={stats.out ? "red" : "grey"} />
        </div>

        {productTypes.length > 0 && (
          <div className="mt-8 rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-black">LURES I&apos;M SELLING</h2>
              <p className="text-xs text-gray-400">
                Tap to switch a lure type on or off. Switched-off types are hidden here and left out of the totals.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {productTypes.map((p) => {
                const on = !notSelling.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => toggleSelling(p)}
                    aria-pressed={on}
                    className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                      on ? "border-green-500 bg-green-500 text-black" : "border-white/15 text-gray-500 line-through hover:border-green-500/50"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {p.replace(/\s+/g, " ").trim()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-4 py-2 text-xs font-black tracking-wider transition ${
                    filter === f.id ? "bg-green-500 text-black" : "border border-green-500/30 text-green-500 hover:border-green-500"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <input
                type="search"
                placeholder="Search bait, colour or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-2 text-sm text-white outline-none focus:border-green-500 md:w-72"
              />
              <button
                onClick={() => load(true)}
                className="rounded-xl border border-green-500 px-4 py-2 text-sm font-bold text-green-500 hover:bg-green-500 hover:text-black"
              >
                REFRESH
              </button>
            </div>
          </div>

          {filter === "all" && (
            <label className="mb-5 flex items-center gap-2 text-xs text-gray-400">
              <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
              Hide made-to-order colours with nothing on the shelf (par 0)
            </label>
          )}

          {error && (
            <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">{error}</p>
          )}

          {loading ? (
            <div className="rounded-2xl border border-green-500/20 bg-black p-8 text-center text-gray-400">Loading stock...</div>
          ) : groups.length === 0 ? (
            <div className="rounded-2xl border border-green-500/20 bg-black p-8 text-center text-gray-400">Nothing matches this view.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {groups.map(([product, rows]) => {
                const total = rows.reduce((s, i) => s + Math.max(i.left, 0), 0);
                return (
                  <div key={product} className="rounded-2xl border border-green-500/20 bg-black p-4">
                    <div className="mb-3 flex items-baseline justify-between gap-3">
                      <h3 className="text-xl font-black text-green-400 md:text-2xl">{product}</h3>
                      <span className="text-xs font-bold text-gray-500">{total} packs</span>
                    </div>
                    <ul className="divide-y divide-white/5">
                      {rows.map((i) => (
                        <li key={i.sku} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold">{i.colour || i.sku}</p>
                            <p className="text-xs text-gray-500">
                              {i.sku}
                              {i.par > 0 ? ` · par ${i.par}` : " · made to order"}
                            </p>
                          </div>
                          <span className={`text-2xl font-black ${tone(i)}`}>{i.left}</span>
                        </li>
                      ))}
                    </ul>
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
