"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "../AdminNav";
import { sheetAction } from "@/lib/sheetAction";

// Monthly recap: pick a month and see how it went — headline numbers against
// the month before, best sellers by bait / colour / SKU, top customers, the
// biggest order, new customers and packs made. Built by the Apps Script from
// Zoho Books (refreshed hourly) into the sales summary.

type Seller = { name: string; packs: number; value: number; sku?: string };
type RecapMonth = {
  month: string;
  revenue: number;
  collected: number;
  expenses: number;
  profit: number;
  orders: number;
  packs: number;
  packsMade: number;
  avgOrder: number;
  customers: number;
  newCustomers: string[];
  biggest: { invoice: string; customer: string; total: number; date: string } | null;
  topProducts: Seller[];
  topColours: Seller[];
  topSkus: Seller[];
  topCustomers: { customer: string; total: number }[];
};
type Summary = { updated: string; recap?: RecapMonth[] };

const rand = (n: number) => `R${Math.round(n).toLocaleString("en-ZA")}`;
const monthLong = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
};
const monthShort = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
};

export default function RecapPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState("");

  async function load(action: "getSales" | "refreshSales" = "getSales") {
    if (action === "refreshSales") setRefreshing(true);
    const data = await sheetAction<{ summary: Summary | null }>(action);
    if (!data.success) setError(data.error || "Couldn't load the recap");
    else {
      setSummary(data.summary);
      setError("");
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, []);

  const months = useMemo(() => (summary?.recap || []).filter((m) => /^\d{4}-\d{2}$/.test(m.month)), [summary]);
  const current = months.find((m) => m.month === picked) || months[months.length - 1];
  const idx = current ? months.indexOf(current) : -1;
  const prev = idx > 0 ? months[idx - 1] : undefined;
  const bestRevenue = Math.max(0, ...months.map((m) => m.revenue));

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminNav
          current="/admin/recap"
          title="MONTHLY RECAP"
          subtitle={
            summary
              ? `From Zoho Books · updated ${new Date(summary.updated).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
              : "How each month went — best sellers, customers and more."
          }
        />

        {error && <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">{error}</p>}

        {loading ? (
          <p className="p-8 text-center text-gray-400">Loading the recap...</p>
        ) : !current ? (
          <div className="rounded-3xl border border-yellow-500/30 bg-black/70 p-8 text-center">
            <p className="font-bold text-yellow-400">No monthly recap yet.</p>
            <p className="mt-2 text-sm text-gray-400">
              Update the Apps Script to the latest version, then press refresh to build it from Zoho Books.
            </p>
            <button
              onClick={() => load("refreshSales")}
              disabled={refreshing}
              className="mt-5 rounded-xl border border-green-500 px-4 py-2 text-sm font-bold text-green-500 hover:bg-green-500 hover:text-black disabled:opacity-50"
            >
              {refreshing ? "REFRESHING..." : "REFRESH FROM ZOHO"}
            </button>
          </div>
        ) : (
          <>
            {/* Month picker */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
              {[...months].reverse().map((m) => (
                <button
                  key={m.month}
                  onClick={() => setPicked(m.month)}
                  className={`rounded-xl border px-4 py-2 text-xs font-black ${
                    m.month === current.month ? "border-green-500 bg-green-500 text-black" : "border-green-500/30 text-green-500 hover:bg-green-500/10"
                  }`}
                >
                  {monthShort(m.month).toUpperCase()}
                </button>
              ))}
              <button
                onClick={() => load("refreshSales")}
                disabled={refreshing}
                className="ml-auto rounded-xl border border-green-500 px-4 py-2 text-xs font-bold text-green-500 hover:bg-green-500 hover:text-black disabled:opacity-50"
              >
                {refreshing ? "REFRESHING..." : "REFRESH"}
              </button>
            </div>

            {/* Headline */}
            <div className="mb-6 rounded-3xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-black p-6">
              <p className="text-xs font-black tracking-[0.3em] text-green-500">RECAP</p>
              <h2 className="mt-2 text-3xl font-black md:text-4xl">{monthLong(current.month)}</h2>
              <p className="mt-3 max-w-3xl text-gray-300">{headline(current, prev, bestRevenue, months.length)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Tile label="REVENUE" value={rand(current.revenue)} now={current.revenue} before={prev?.revenue} />
              <Tile label="PROFIT" value={rand(current.profit)} now={current.profit} before={prev?.profit} />
              <Tile label="ORDERS" value={current.orders} now={current.orders} before={prev?.orders} />
              <Tile label="PACKS SOLD" value={current.packs} now={current.packs} before={prev?.packs} />
              <Tile label="PACKS MADE" value={current.packsMade} now={current.packsMade} before={prev?.packsMade} />
              <Tile label="AVG ORDER" value={rand(current.avgOrder)} now={current.avgOrder} before={prev?.avgOrder} />
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card title="🏆 BIGGEST SELLERS">
                <Bars rows={current.topProducts} />
              </Card>
              <Card title="🎨 TOP COLOURS">
                <Bars rows={current.topColours} />
              </Card>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-3">
              <Card title="TOP 10 BAITS" className="lg:col-span-2">
                {current.topSkus.length === 0 ? (
                  <Empty />
                ) : (
                  <ol className="divide-y divide-white/5 text-sm">
                    {current.topSkus.map((s, i) => (
                      <li key={s.sku || s.name} className="flex items-center gap-3 py-2">
                        <span className={`w-7 text-center text-lg font-black ${i < 3 ? "text-yellow-400" : "text-gray-500"}`}>{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-bold">{s.name}</span>
                          <span className="text-xs text-gray-500">{s.sku}</span>
                        </span>
                        <span className="text-right">
                          <span className="block font-black text-green-400">{s.packs} packs</span>
                          <span className="text-xs text-gray-500">{rand(s.value)}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>

              <div className="grid gap-6">
                <Card title="💰 BIGGEST ORDER">
                  {current.biggest ? (
                    <div>
                      <p className="text-3xl font-black text-green-400">{rand(current.biggest.total)}</p>
                      <p className="mt-1 font-bold">{current.biggest.customer}</p>
                      <p className="text-xs text-gray-500">
                        {current.biggest.invoice} · {current.biggest.date}
                      </p>
                    </div>
                  ) : (
                    <Empty />
                  )}
                </Card>
                <Card title={`👋 NEW CUSTOMERS (${current.newCustomers.length})`}>
                  {current.newCustomers.length === 0 ? (
                    <p className="text-sm text-gray-500">No new customers this month — all returning.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {current.newCustomers.map((c) => (
                        <li key={c} className="rounded-lg border border-green-500/30 px-2 py-1 text-xs font-bold text-green-400">
                          {c}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-gray-500">
                    {current.customers} customer(s) ordered · {Math.max(current.customers - current.newCustomers.length, 0)} returning
                  </p>
                </Card>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Card title="⭐ TOP CUSTOMERS">
                {current.topCustomers.length === 0 ? (
                  <Empty />
                ) : (
                  <ol className="divide-y divide-white/5 text-sm">
                    {current.topCustomers.map((c, i) => (
                      <li key={c.customer} className="flex items-center justify-between gap-3 py-2">
                        <span className="truncate">
                          <span className="mr-2 font-black text-gray-500">{i + 1}.</span>
                          <span className="font-bold">{c.customer}</span>
                        </span>
                        <span className="font-black text-green-400">{rand(c.total)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </Card>
              <Card title="📒 MONEY">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <Money label="Invoiced" value={current.revenue} />
                  <Money label="Collected" value={current.collected} />
                  <Money label="Still owed" value={Math.max(current.revenue - current.collected, 0)} warn />
                  <Money label="Expenses" value={current.expenses} />
                </dl>
              </Card>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

// One-line story of the month
function headline(m: RecapMonth, prev: RecapMonth | undefined, best: number, count: number) {
  const parts: string[] = [];
  parts.push(`${m.orders} order(s), ${m.packs} packs sold for ${rand(m.revenue)}.`);
  if (count > 1 && m.revenue > 0 && m.revenue >= best) parts.push("🔥 Your best month yet!");
  else if (prev && prev.revenue > 0) {
    const change = Math.round(((m.revenue - prev.revenue) / prev.revenue) * 100);
    parts.push(change >= 0 ? `Up ${change}% on last month.` : `Down ${Math.abs(change)}% on last month.`);
  }
  if (m.topProducts[0]) parts.push(`Best seller: ${m.topProducts[0].name} (${m.topProducts[0].packs} packs).`);
  if (m.topColours[0]) parts.push(`Top colour: ${m.topColours[0].name}.`);
  if (m.newCustomers.length) parts.push(`${m.newCustomers.length} new customer(s).`);
  return parts.join(" ");
}

function Tile({ label, value, now, before }: { label: string; value: string | number; now: number; before?: number }) {
  let change: number | null = null;
  if (before !== undefined && before !== 0) change = Math.round(((now - before) / Math.abs(before)) * 100);
  return (
    <div className="rounded-3xl border border-green-500/20 bg-black/70 p-5">
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <p className="mt-3 text-2xl font-black text-green-500 md:text-3xl">{value}</p>
      {change !== null ? (
        <p className={`mt-1 text-xs font-black ${change >= 0 ? "text-green-400" : "text-red-400"}`}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs last month
        </p>
      ) : (
        <p className="mt-1 text-xs text-gray-600">—</p>
      )}
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6 ${className}`}>
      <h3 className="mb-4 text-lg font-black">{title}</h3>
      {children}
    </div>
  );
}

function Bars({ rows }: { rows: Seller[] }) {
  if (rows.length === 0) return <Empty />;
  const max = Math.max(1, ...rows.map((r) => r.packs));
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.name}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-bold">
              {i === 0 && "🥇 "}
              {i === 1 && "🥈 "}
              {i === 2 && "🥉 "}
              {r.name}
            </span>
            <span className="shrink-0 text-xs text-gray-400">
              <b className="text-white">{r.packs}</b> packs · {rand(r.value)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-green-500" style={{ width: `${(r.packs / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Money({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-bold text-gray-400">{label}</dt>
      <dd className={`mt-1 text-xl font-black ${warn && value > 0 ? "text-yellow-400" : "text-white"}`}>{rand(value)}</dd>
    </div>
  );
}

function Empty() {
  return <p className="text-sm text-gray-500">Nothing this month.</p>;
}
