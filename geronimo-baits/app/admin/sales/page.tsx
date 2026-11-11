"use client";

import { useEffect, useState } from "react";
import AdminNav from "../AdminNav";
import { sheetAction, rand } from "@/lib/sheetAction";

// Sales dashboard from Zoho Books (refreshed hourly by the Apps Script):
// revenue vs expenses by month, what's owed, best sellers, top customers,
// expenses by account, and each retailer's minimum-purchase progress.

type Month = { month: string; revenue: number; collected: number; expenses: number; profit: number; invoices: number; packs: number };
type Period = { from: string; to: string; packs: number; value: number; orders: number; target: number; current: boolean; daysLeft: number; status: string };
type Retailer = { customer: string; start: string; mandateEnd: string; minPacks: number; periodMonths: number; periods: Period[]; ordersBeforeStart: number; lastOrder: string };
type Summary = {
  updated: string;
  totals: { revenue: number; collected: number; expenses: number; profit: number; outstanding: number; packs: number; invoices: number };
  months: Month[];
  outstanding: { invoice: string; customer: string; date: string; balance: number; status: string }[];
  topCustomers: { customer: string; total: number }[];
  products: { code: string; name: string; packs: number; value: number }[];
  topSkus: { sku: string; name: string; packs: number; value: number }[];
  expenseAccounts: { account: string; total: number }[];
  retailers: Retailer[];
};

// Validated pair (dark surface): revenue / expenses
const REVENUE = "#16a34a";
const EXPENSES = "#8b5cf6";

const monthName = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, (mo || 1) - 1, 1).toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
};

export default function SalesPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [hover, setHover] = useState<string>("");

  async function load(action: "getSales" | "refreshSales" = "getSales") {
    if (action === "refreshSales") setRefreshing(true);
    const data = await sheetAction<{ summary: Summary | null }>(action);
    if (!data.success) setError(data.error || "Couldn't load sales");
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

  const t = summary?.totals;
  const max = Math.max(1, ...(summary?.months || []).map((m) => Math.max(m.revenue, m.expenses)));
  const maxProduct = Math.max(1, ...(summary?.products || []).map((p) => p.packs));

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminNav
          current="/admin/sales"
          title="SALES"
          subtitle={
            summary
              ? `From Zoho Books · updated ${new Date(summary.updated).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
              : "From Zoho Books"
          }
        />

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <button
            onClick={() => load("refreshSales")}
            disabled={refreshing}
            className="rounded-xl border border-green-500 px-4 py-2 text-sm font-bold text-green-500 hover:bg-green-500 hover:text-black disabled:opacity-50"
          >
            {refreshing ? "PULLING FROM ZOHO… (up to a minute)" : "↻ REFRESH FROM ZOHO"}
          </button>
          <span className="text-xs text-gray-500">Updates by itself every hour. Only counts what&apos;s recorded in Zoho.</span>
        </div>

        {error && <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">{error}</p>}

        {loading ? (
          <p className="p-8 text-center text-gray-400">Loading sales...</p>
        ) : !summary || !t ? (
          <p className="rounded-2xl border border-green-500/20 p-8 text-center text-gray-400">
            No sales data yet. Run <b>setupBackOffice</b> once in Apps Script, or press Refresh from Zoho.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <Stat label="SALES" value={rand(t.revenue)} />
              <Stat label="EXPENSES" value={rand(t.expenses)} />
              <Stat label="PROFIT" value={rand(t.profit)} tone={t.profit < 0 ? "red" : "green"} />
              <Stat label="STILL OWED" value={rand(t.outstanding)} tone={t.outstanding ? "yellow" : "grey"} />
              <Stat label="PACKS SOLD" value={t.packs.toLocaleString("en-ZA")} />
            </div>

            {summary.retailers.length > 0 && (
              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                {summary.retailers.map((r) => (
                  <RetailerCard key={r.customer} r={r} />
                ))}
              </div>
            )}

            {/* Monthly revenue vs expenses — one axis, grouped bars */}
            <div className="mt-8 rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-black">BY MONTH</h2>
                <div className="flex gap-4 text-xs text-gray-300">
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm" style={{ background: REVENUE }} /> Sales
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm" style={{ background: EXPENSES }} /> Expenses
                  </span>
                </div>
              </div>
              <div className="relative flex h-56 items-end gap-4 border-b border-white/10 px-1">
                {summary.months.map((m) => (
                  <div
                    key={m.month}
                    className="relative flex h-full flex-1 flex-col justify-end"
                    onMouseEnter={() => setHover(m.month)}
                    onMouseLeave={() => setHover("")}
                    onClick={() => setHover((h) => (h === m.month ? "" : m.month))}
                  >
                    <div className="flex h-full items-end justify-center gap-[2px]">
                      <div className="w-1/3 max-w-8 rounded-t" style={{ height: `${(m.revenue / max) * 100}%`, background: REVENUE }} />
                      <div className="w-1/3 max-w-8 rounded-t" style={{ height: `${(m.expenses / max) * 100}%`, background: EXPENSES }} />
                    </div>
                    {hover === m.month && (
                      <div className="absolute bottom-full left-1/2 z-10 mb-2 w-44 -translate-x-1/2 rounded-xl border border-white/10 bg-zinc-900 p-3 text-xs shadow-lg">
                        <p className="mb-1 font-black text-white">{monthName(m.month)}</p>
                        <p className="text-gray-300">Sales {rand(m.revenue)}</p>
                        <p className="text-gray-300">Expenses {rand(m.expenses)}</p>
                        <p className="font-bold text-white">Profit {rand(m.profit)}</p>
                        <p className="text-gray-500">{m.invoices} invoices · {m.packs} packs</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-4 px-1 text-center text-xs text-gray-500">
                {summary.months.map((m) => (
                  <span key={m.month} className="flex-1">
                    {monthName(m.month)}
                  </span>
                ))}
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="text-xs text-gray-500">
                    <tr>
                      <th className="py-2 text-left">MONTH</th>
                      <th className="py-2 text-right">SALES</th>
                      <th className="py-2 text-right">COLLECTED</th>
                      <th className="py-2 text-right">EXPENSES</th>
                      <th className="py-2 text-right">PROFIT</th>
                      <th className="py-2 text-right">PACKS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {summary.months.map((m) => (
                      <tr key={m.month}>
                        <td className="py-2">{monthName(m.month)}</td>
                        <td className="py-2 text-right">{rand(m.revenue)}</td>
                        <td className="py-2 text-right text-gray-400">{rand(m.collected)}</td>
                        <td className="py-2 text-right text-gray-400">{rand(m.expenses)}</td>
                        <td className={`py-2 text-right font-bold ${m.profit < 0 ? "text-red-400" : "text-white"}`}>{rand(m.profit)}</td>
                        <td className="py-2 text-right text-gray-400">{m.packs}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <Panel title="BEST-SELLING BAITS">
                <ul className="space-y-3">
                  {summary.products.map((p) => (
                    <li key={p.code}>
                      <div className="flex justify-between text-sm">
                        <span className="font-bold">{p.name}</span>
                        <span className="text-gray-300">{p.packs} packs</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-white/5">
                        <div className="h-2 rounded-full" style={{ width: `${(p.packs / maxProduct) * 100}%`, background: REVENUE }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel title="TOP COLOURS (SKU)">
                <ol className="space-y-2 text-sm">
                  {summary.topSkus.map((s, i) => (
                    <li key={s.sku} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="text-gray-500">{i + 1}. </span>
                        {s.name}
                      </span>
                      <span className="shrink-0 font-bold">{s.packs}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
              <Panel title="TOP CUSTOMERS">
                <ol className="space-y-2 text-sm">
                  {summary.topCustomers.map((c, i) => (
                    <li key={c.customer} className="flex justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="text-gray-500">{i + 1}. </span>
                        {c.customer}
                      </span>
                      <span className="shrink-0 font-bold">{rand(c.total)}</span>
                    </li>
                  ))}
                </ol>
                {t.revenue > 0 && summary.topCustomers[0] && (
                  <p className="mt-3 text-xs text-gray-500">
                    {summary.topCustomers[0].customer} is {Math.round((summary.topCustomers[0].total / t.revenue) * 100)}% of all sales.
                  </p>
                )}
              </Panel>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <Panel title="STILL OWED">
                {summary.outstanding.length === 0 ? (
                  <p className="text-sm text-green-400">✔ Nothing outstanding.</p>
                ) : (
                  <ul className="divide-y divide-white/5 text-sm">
                    {summary.outstanding.map((o) => (
                      <li key={o.invoice} className="flex justify-between gap-3 py-2">
                        <span>
                          <b>{o.invoice}</b> · {o.customer}
                          <span className="block text-xs text-gray-500">
                            {o.date} · {o.status}
                          </span>
                        </span>
                        <span className="font-black text-yellow-400">{rand(o.balance)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <Panel title="WHERE THE MONEY WENT">
                <ul className="divide-y divide-white/5 text-sm">
                  {summary.expenseAccounts.map((e) => (
                    <li key={e.account} className="flex justify-between py-2">
                      <span>{e.account}</span>
                      <span className="font-bold">{rand(e.total)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function RetailerCard({ r }: { r: Retailer }) {
  const current = r.periods.find((p) => p.current) || r.periods.find((p) => p.status === "upcoming") || r.periods[r.periods.length - 1];
  return (
    <div className="rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
      <p className="text-xs font-black tracking-[0.3em] text-green-500">RETAILER MINIMUM</p>
      <h2 className="mt-1 text-xl font-black">{r.customer}</h2>
      <p className="text-xs text-gray-500">
        {r.minPacks} packs per {r.periodMonths} months · mandate {r.start} → {r.mandateEnd}
        {r.lastOrder ? ` · last order ${r.lastOrder}` : ""}
      </p>
      <div className="mt-4 space-y-3">
        {r.periods.map((p) => {
          const pct = p.target ? Math.min((p.packs / p.target) * 100, 100) : 0;
          const colour = p.status === "met" ? "#16a34a" : p.status === "missed" ? "#dc2626" : "#ca8a04";
          const label =
            p.status === "met" ? "✔ MET" : p.status === "missed" ? "✖ MISSED" : p.status === "upcoming" ? "UPCOMING" : `${p.daysLeft} DAYS LEFT`;
          return (
            <div key={p.from} className={p === current ? "" : "opacity-70"}>
              <div className="flex justify-between text-sm">
                <span>
                  {p.from} → {p.to}
                </span>
                <span className="font-bold">
                  {p.packs} / {p.target} packs · <span className="text-xs">{label}</span>
                </span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-white/5">
                <div className="h-3 rounded-full" style={{ width: `${pct}%`, background: colour }} />
              </div>
              {p.current && p.status !== "met" && (
                <p className="mt-1 text-xs text-yellow-400">
                  Needs {Math.max(p.target - p.packs, 0)} more packs in {p.daysLeft} days.
                </p>
              )}
            </div>
          );
        })}
      </div>
      {r.ordersBeforeStart > 0 && (
        <p className="mt-3 text-xs text-gray-500">{r.ordersBeforeStart} order(s) before the start date don&apos;t count. Change the start date on the Retailers tab.</p>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
      <h2 className="mb-4 text-xl font-black">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, tone = "green" }: { label: string; value: string | number; tone?: "green" | "yellow" | "red" | "grey" }) {
  const colour = { green: "text-green-500", yellow: "text-yellow-400", red: "text-red-400", grey: "text-gray-500" }[tone];
  return (
    <div className="rounded-3xl border border-green-500/20 bg-black/70 p-5">
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <h2 className={`mt-3 text-xl font-black md:text-2xl ${colour}`}>{value}</h2>
    </div>
  );
}
