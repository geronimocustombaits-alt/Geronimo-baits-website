"use client";

import { useEffect, useState } from "react";
import AdminNav from "../AdminNav";
import { sheetAction, rand } from "@/lib/sheetAction";

// Ambassador leaderboard. Paid orders with an ambassador's code count towards
// free packs (never their own orders). Codes, names and the "packs per free
// pack" number live on the Ambassadors tab of the sheet.

type Ambassador = {
  code: string;
  name: string;
  level: string;
  active: boolean;
  threshold: number;
  orders: number;
  packs: number;
  value: number;
  earned: number;
  claimed: number;
  available: number;
  toNext: number;
  recent: { orderNumber: string; customer: string; packs: number; date: string }[];
};

export default function AmbassadorsPage() {
  const [rows, setRows] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const data = await sheetAction<{ ambassadors: Ambassador[] }>("getAmbassadors");
    if (!data.success) setError(data.error || "Couldn't load ambassadors");
    else {
      setRows(data.ambassadors || []);
      setError("");
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function claim(a: Ambassador) {
    if (!window.confirm(`Give ${a.name} 1 free pack now? (${a.available} available)`)) return;
    setBusy(a.code);
    const data = await sheetAction("claimReward", { code: a.code });
    setBusy("");
    if (!data.success) setError(data.error || "Couldn't record the claim");
    load();
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminNav
          current="/admin/ambassadors"
          title="AMBASSADORS"
          subtitle="Referral leaderboard. Paid orders with a code count; ambassadors' own orders never do."
        />

        {error && <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">{error}</p>}

        {loading ? (
          <p className="p-8 text-center text-gray-400">Loading leaderboard...</p>
        ) : rows.length === 0 ? (
          <p className="rounded-2xl border border-green-500/20 p-8 text-center text-gray-400">
            No ambassadors yet. Run <b>setupBackOffice</b> in Apps Script, then add codes on the Ambassadors tab.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((a, i) => (
              <div key={a.code} className={`rounded-3xl border bg-black/70 p-5 ${a.available ? "border-green-500" : "border-green-500/20"} ${a.active ? "" : "opacity-50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black tracking-[0.3em] text-green-500">
                      #{i + 1} · {a.level.toUpperCase() || "AMBASSADOR"}
                    </p>
                    <h2 className="mt-1 text-2xl font-black">{a.name}</h2>
                    <p className="text-xs text-gray-500">
                      Code <b className="text-gray-300">{a.code}</b>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-green-500">{a.packs}</p>
                    <p className="text-xs text-gray-500">packs referred</p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Next free pack</span>
                    <span>{a.toNext} pack(s) to go</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full bg-green-600"
                      style={{ width: `${((a.threshold - a.toNext) / a.threshold) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <Mini label="ORDERS" value={a.orders} />
                  <Mini label="SALES" value={rand(a.value)} />
                  <Mini label="FREE EARNED" value={`${a.earned} (${a.claimed} given)`} />
                </div>

                {a.available > 0 && (
                  <button
                    onClick={() => claim(a)}
                    disabled={busy === a.code}
                    className="mt-4 w-full rounded-xl bg-green-500 py-3 text-sm font-black text-black hover:bg-green-400 disabled:opacity-50"
                  >
                    🎁 {a.available} FREE PACK{a.available === 1 ? "" : "S"} READY · MARK 1 GIVEN
                  </button>
                )}

                {a.recent.length > 0 && (
                  <ul className="mt-4 space-y-1 border-t border-white/5 pt-3 text-xs text-gray-400">
                    {a.recent.map((r) => (
                      <li key={r.orderNumber} className="flex justify-between">
                        <span>
                          {r.orderNumber} · {r.customer}
                        </span>
                        <span>{r.packs} packs</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          Customers enter the code at checkout, or pick it on the order in Orders. One free pack per{" "}
          {rows[0]?.threshold || 20} referred packs — change “PACKS PER FREE PACK” on the Ambassadors tab.
        </p>
      </section>
    </main>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/5 p-2">
      <p className="font-bold text-gray-500">{label}</p>
      <p className="mt-1 font-black text-white">{value}</p>
    </div>
  );
}
