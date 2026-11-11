"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "../AdminNav";
import { sheetAction } from "@/lib/sheetAction";

// What to make for open orders: every bait on orders that aren't packed yet,
// against what's on the shelf. "Make" = packs short.

type Row = {
  sku: string;
  label: string;
  product: string;
  tracked: boolean;
  custom: boolean;
  needed: number;
  left: number;
  short: number;
  baitsPerPack: number;
  baitsToPour: number;
  orders: string[];
};
type OpenOrder = { orderNumber: string; customer: string; paymentStatus: string };

export default function MakePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCovered, setShowCovered] = useState(false);

  async function load() {
    setLoading(true);
    const data = await sheetAction<{ rows: Row[]; openOrders: OpenOrder[] }>("getMakeList");
    if (!data.success) setError(data.error || "Couldn't load the make list");
    else {
      setRows(data.rows || []);
      setOpenOrders(data.openOrders || []);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const short = rows.filter((r) => r.short > 0);
  const covered = rows.filter((r) => r.short === 0);
  const totals = useMemo(
    () => ({
      packs: short.reduce((s, r) => s + r.short, 0),
      baits: short.reduce((s, r) => s + r.baitsToPour, 0),
    }),
    [short]
  );
  const customerFor = (orderNumber: string) => openOrders.find((o) => o.orderNumber === orderNumber)?.customer || "";

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminNav current="/admin/make" title="MAKE FOR ORDERS" subtitle="What to pour so every open order can be packed." />

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="OPEN ORDERS" value={openOrders.length} />
          <Stat label="COLOURS SHORT" value={short.length} tone={short.length ? "yellow" : "grey"} />
          <Stat label="PACKS TO MAKE" value={totals.packs} tone={totals.packs ? "yellow" : "grey"} />
          <Stat label="BAITS TO POUR" value={totals.baits} />
        </div>

        <div className="mt-8 rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black">TO MAKE</h2>
            <button
              onClick={load}
              className="rounded-xl border border-green-500 px-4 py-2 text-sm font-bold text-green-500 hover:bg-green-500 hover:text-black"
            >
              REFRESH
            </button>
          </div>

          {error && <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">{error}</p>}

          {loading ? (
            <p className="p-8 text-center text-gray-400">Working it out...</p>
          ) : short.length === 0 ? (
            <p className="rounded-2xl border border-green-500/30 bg-green-500/5 p-8 text-center font-bold text-green-400">
              ✔ Everything on open orders is on the shelf.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">BAIT</th>
                    <th className="py-2 pr-3 text-right">NEEDED</th>
                    <th className="py-2 pr-3 text-right">ON SHELF</th>
                    <th className="py-2 pr-3 text-right">MAKE (PACKS)</th>
                    <th className="py-2 pr-3 text-right">BAITS TO POUR</th>
                    <th className="py-2">FOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {short.map((r) => (
                    <tr key={r.sku || r.label}>
                      <td className="py-3 pr-3">
                        <p className="font-bold">{r.label}</p>
                        <p className="text-xs text-gray-500">
                          {r.sku || "no SKU"}
                          {(r.custom || !r.tracked) && (
                            <span className="ml-2 rounded bg-yellow-500/15 px-1.5 py-0.5 font-bold text-yellow-400">
                              {r.custom ? "CUSTOM" : "NOT TRACKED"}
                            </span>
                          )}
                        </p>
                      </td>
                      <td className="py-3 pr-3 text-right">{r.needed}</td>
                      <td className="py-3 pr-3 text-right text-gray-400">{r.tracked ? Math.max(r.left, 0) : "–"}</td>
                      <td className="py-3 pr-3 text-right text-xl font-black text-yellow-400">{r.short}</td>
                      <td className="py-3 pr-3 text-right font-bold">{r.baitsToPour || "–"}</td>
                      <td className="py-3 text-xs text-gray-400">
                        {r.orders.map((o) => (
                          <span key={o} className="mr-2 inline-block">
                            {o}
                            {customerFor(o) ? ` · ${customerFor(o)}` : ""}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {covered.length > 0 && (
            <div className="mt-6">
              <button onClick={() => setShowCovered((v) => !v)} className="text-xs font-bold text-gray-400">
                {showCovered ? "▾" : "▸"} {covered.length} bait(s) on open orders already covered by the shelf
              </button>
              {showCovered && (
                <ul className="mt-3 grid gap-2 md:grid-cols-2">
                  {covered.map((r) => (
                    <li key={r.sku || r.label} className="flex justify-between rounded-xl border border-white/5 px-4 py-2 text-sm">
                      <span>{r.label}</span>
                      <span className="text-green-500">
                        need {r.needed} · have {r.left}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value, tone = "green" }: { label: string; value: string | number; tone?: "green" | "yellow" | "grey" }) {
  const colour = { green: "text-green-500", yellow: "text-yellow-400", grey: "text-gray-500" }[tone];
  return (
    <div className="rounded-3xl border border-green-500/20 bg-black/70 p-5">
      <p className="text-xs font-bold text-gray-400">{label}</p>
      <h2 className={`mt-3 text-2xl font-black md:text-3xl ${colour}`}>{value}</h2>
    </div>
  );
}
