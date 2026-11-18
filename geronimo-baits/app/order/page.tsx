"use client";

// Public WhatsApp order form: geronimobaits.co.za/order
// The customer types a quantity per colour, adds name + delivery, and one tap
// opens WhatsApp with the whole order typed out to Geronimo Baits.
// Nothing is saved or paid here - you confirm and invoice from WhatsApp.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  COLLECTION_METHOD,
  DELIVERY_METHODS,
  DOOR_METHOD,
  LOCKER_METHOD,
  deliveryLabel,
  formatRand,
  roundRand,
  shippingCostFor,
  type SelectedLocker,
} from "@/lib/shop";
import { BUSINESS } from "@/lib/business";
import PudoLockerPicker from "../components/PudoLockerPicker";

type Product = {
  sku: string;
  bait: string;
  colour: string;
  size: string;
  price: string;
  stockQty: string;
};

const CATEGORY_ORDER = ["apache", "warcraw", "warviper", "warbomb", "warchin", "coreshot", "swimbait"];
const DRAFT_KEY = "gb-wa-order-v1";

const displayName = (text: string) => text.replace(/\\"/g, '"').trim();
const rank = (bait: string) => {
  const n = bait.toLowerCase();
  if (n.includes("coreshot")) return CATEGORY_ORDER.indexOf("coreshot");
  const i = CATEGORY_ORDER.findIndex((w) => n.includes(w));
  return i === -1 ? CATEGORY_ORDER.length : i;
};

export default function WhatsAppOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState(LOCKER_METHOD);
  const [locker, setLocker] = useState<SelectedLocker | null>(null);
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    fetch("/api/products", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (Array.isArray(d) ? setProducts(d) : setLoadError("Couldn't load the baits. Please refresh.")))
      .catch(() => setLoadError("Couldn't load the baits. Check your connection and refresh."));
    try {
      const s = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (s) {
        if (s.qty) setQty(s.qty);
        if (s.name) setName(s.name);
        if (s.email) setEmail(s.email);
        if (s.method) setMethod(s.method);
        if (s.locker) setLocker(s.locker);
        if (s.address) setAddress(s.address);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ qty, name, email, method, locker, address }));
    } catch {}
  }, [qty, name, email, method, locker, address]);

  // Grouped by bait + size, in the shop's usual order
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<string, Product[]>();
    products
      .filter((p) => !q || `${p.bait} ${p.colour} ${p.size}`.toLowerCase().includes(q))
      .forEach((p) => {
        const key = `${displayName(p.bait)}${p.size ? ` · ${p.size}` : ""}`;
        map.set(key, [...(map.get(key) || []), p]);
      });
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
  }, [products, search]);

  const lines = products.filter((p) => (qty[p.sku] || 0) > 0);
  const packs = lines.reduce((s, p) => s + qty[p.sku], 0);
  const baitsTotal = roundRand(lines.reduce((s, p) => s + qty[p.sku] * (Number(p.price) || 0), 0));
  const delivery = packs ? shippingCostFor(method, packs) : 0;
  const total = roundRand(baitsTotal + delivery);

  const setQ = (sku: string, n: number) =>
    setQty((prev) => ({ ...prev, [sku]: Math.max(0, Math.min(99, Math.floor(n) || 0)) }));

  const deliveryText =
    method === LOCKER_METHOD
      ? `PUDO locker: ${locker?.name || "-"}${locker?.address ? ` (${locker.address})` : ""}`
      : method === DOOR_METHOD
        ? `PUDO door-to-door: ${address || "-"}`
        : "Collection";

  const missing: string[] = [];
  if (!packs) missing.push("at least one bait");
  if (!name.trim()) missing.push("your name");
  if (method === LOCKER_METHOD && !locker?.name) missing.push("your nearest PUDO locker");
  if (method === DOOR_METHOD && !address.trim()) missing.push("your delivery address");

  const message = [
    "Hi Geronimo Baits! I'd like to order:",
    "",
    ...lines.map(
      (p) =>
        `• ${qty[p.sku]}x ${displayName(p.bait)}${p.size ? ` ${p.size}` : ""} - ${p.colour} (${p.sku})`
    ),
    "",
    `Packs: ${packs}`,
    `Baits: ${formatRand(baitsTotal)}`,
    `Delivery: ${formatRand(delivery)}`,
    `Total: ${formatRand(total)}`,
    "",
    `Name: ${name.trim()}`,
    ...(email.trim() ? [`Email: ${email.trim()}`] : []),
    deliveryText,
    ...(note.trim() ? ["", `Note: ${note.trim()}`] : []),
  ].join("\n");

  const send = () => {
    setTried(true);
    if (missing.length) return;
    window.open(`https://wa.me/${BUSINESS.whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <main className="min-h-screen bg-black pb-40 text-white">
      <div className="mx-auto max-w-3xl px-4 pt-8">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Geronimo Baits" className="h-16 w-16 rounded-xl object-cover" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-green-500">Order on WhatsApp</p>
            <h1 className="text-2xl font-black">Geronimo Baits</h1>
            <p className="text-sm text-gray-400">Handmade in SA · pick your baits, we confirm on WhatsApp</p>
          </div>
        </div>

        <ol className="mt-6 grid gap-2 rounded-2xl border border-green-900 bg-green-950/30 p-4 text-sm text-gray-300 sm:grid-cols-3">
          <li><b className="text-green-500">1.</b> Type how many packs of each colour</li>
          <li><b className="text-green-500">2.</b> Add your name and nearest PUDO</li>
          <li><b className="text-green-500">3.</b> Tap send – WhatsApp opens with your order</li>
        </ol>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search baits or colours…"
          className="mt-6 w-full rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 outline-none focus:border-green-500"
        />

        {loadError && <p className="mt-6 rounded-xl border border-red-800 p-4 text-red-400">{loadError}</p>}
        {!loadError && !products.length && <p className="mt-6 text-gray-500">Loading baits…</p>}

        {groups.map(([title, list]) => (
          <section key={title} className="mt-8">
            <h2 className="mb-2 text-lg font-black text-green-500">{title}</h2>
            <div className="divide-y divide-gray-900 rounded-2xl border border-gray-900 bg-gray-950">
              {list.map((p) => {
                const stock = Number(p.stockQty) || 0;
                const n = qty[p.sku] || 0;
                return (
                  <div key={p.sku} className={`flex items-center gap-3 px-4 py-3 ${n ? "bg-green-950/40" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{p.colour}</p>
                      <p className="text-xs text-gray-500">
                        {formatRand(p.price)} per pack ·{" "}
                        {stock > 0 ? (
                          <span className="text-green-500">{stock} in stock</span>
                        ) : (
                          <span className="text-yellow-500">made to order</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setQ(p.sku, n - 1)}
                      className="h-9 w-9 rounded-lg border border-gray-700 text-lg font-bold disabled:opacity-30"
                      disabled={!n}
                      aria-label={`One less ${p.colour}`}
                    >
                      −
                    </button>
                    <input
                      inputMode="numeric"
                      value={n || ""}
                      placeholder="0"
                      onChange={(e) => setQ(p.sku, Number(e.target.value))}
                      className="w-12 rounded-lg border border-gray-700 bg-black py-1.5 text-center font-bold"
                    />
                    <button
                      onClick={() => setQ(p.sku, n + 1)}
                      className="h-9 w-9 rounded-lg border border-green-600 text-lg font-bold text-green-500"
                      aria-label={`One more ${p.colour}`}
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {!!products.length && (
          <section className="mt-10 rounded-2xl border border-gray-800 bg-gray-950 p-5">
            <h2 className="text-lg font-black text-green-500">Your details</h2>
            <div className="mt-4 grid gap-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name and surname *"
                className="rounded-xl border border-gray-800 bg-black px-4 py-3 outline-none focus:border-green-500" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (for your invoice)" type="email"
                className="rounded-xl border border-gray-800 bg-black px-4 py-3 outline-none focus:border-green-500" />
              <div className="grid gap-2 sm:grid-cols-3">
                {DELIVERY_METHODS.map((m) => (
                  <button key={m} onClick={() => setMethod(m)}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold ${method === m ? "border-green-500 bg-green-500 text-black" : "border-gray-800"}`}>
                    {deliveryLabel(m, Math.max(packs, 1))}
                  </button>
                ))}
              </div>
              {method === LOCKER_METHOD && <PudoLockerPicker value={locker} onChange={setLocker} />}
              {method === DOOR_METHOD && (
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3}
                  placeholder="Street address, suburb, city, postal code *"
                  className="rounded-xl border border-gray-800 bg-black px-4 py-3 outline-none focus:border-green-500" />
              )}
              {method === COLLECTION_METHOD && (
                <p className="text-sm text-gray-400">We'll arrange a collection time with you on WhatsApp.</p>
              )}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="Anything else? Custom colour, questions…"
                className="rounded-xl border border-gray-800 bg-black px-4 py-3 outline-none focus:border-green-500" />
            </div>
          </section>
        )}

        <p className="mt-6 text-center text-xs text-gray-600">
          Prefer to pay by card now? <Link href="/baits" className="text-green-500 underline">Use the online shop</Link>
        </p>
      </div>

      {/* Sticky order bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-green-900 bg-black/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl">
          {tried && missing.length > 0 && (
            <p className="mb-2 text-sm text-yellow-400">Still need: {missing.join(", ")}</p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 text-sm">
              <p className="font-bold">{packs} pack{packs === 1 ? "" : "s"} · {formatRand(total)}</p>
              <p className="text-xs text-gray-500">
                Baits {formatRand(baitsTotal)} + delivery {formatRand(delivery)}
              </p>
            </div>
            <button onClick={send}
              className="rounded-xl bg-[#25D366] px-5 py-3 font-black text-black transition hover:brightness-110">
              Send order on WhatsApp
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
