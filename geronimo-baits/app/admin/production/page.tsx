"use client";

import { useEffect, useState } from "react";
import AdminNav from "../AdminNav";
import { sheetAction } from "@/lib/sheetAction";

// Production batches: log a pour, it sits in Curing, then mark it Packed with
// the number of packs — that adds them to stock (once).

type Batch = {
  batch: string;
  datePoured: string;
  sku: string;
  colour: string;
  baits: number;
  plastisolMl: number;
  status: string;
  packs: number;
  datePacked: string;
  notes: string;
};
type Yield = { code: string; batches: number; baitsPerLitre: number };

const perPack = (sku: string) => Number((sku.match(/-(\d+)$/) || [])[1]) || 0;

export default function ProductionPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [yields, setYields] = useState<Yield[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [packCounts, setPackCounts] = useState<Record<string, string>>({});

  const [sku, setSku] = useState("");
  const [baits, setBaits] = useState("");
  const [ml, setMl] = useState("");
  const [notes, setNotes] = useState("");

  async function load() {
    const data = await sheetAction<{ batches: Batch[]; yields: Yield[] }>("getBatches");
    if (!data.success) setMessage({ type: "error", text: data.error || "Couldn't load batches" });
    else {
      setBatches(data.batches || []);
      setYields(data.yields || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function addBatch(e: React.FormEvent) {
    e.preventDefault();
    setBusy("add");
    setMessage(null);
    const data = await sheetAction<{ batch: string; known: boolean }>("addBatch", {
      sku: sku.trim().toUpperCase(),
      baits: Number(baits) || 0,
      plastisolMl: Number(ml) || 0,
      notes,
    });
    setBusy("");
    if (!data.success) {
      setMessage({ type: "error", text: data.error || "Couldn't save the batch" });
      return;
    }
    setMessage({
      type: data.known ? "ok" : "error",
      text: data.known
        ? `Batch ${data.batch} logged — curing.`
        : `Batch ${data.batch} logged, but ${sku.toUpperCase()} isn't on the Inventory tab, so packing it won't add stock.`,
    });
    setSku("");
    setBaits("");
    setMl("");
    setNotes("");
    load();
  }

  async function setStatus(b: Batch, status: string) {
    let packs = 0;
    if (status === "Packed") {
      const suggested = perPack(b.sku) ? Math.floor(b.baits / perPack(b.sku)) : 0;
      packs = Number(packCounts[b.batch] || suggested) || 0;
      if (!packs) {
        setMessage({ type: "error", text: "Enter how many packs this batch made." });
        return;
      }
      if (!window.confirm(`Mark ${b.batch} packed and add ${packs} pack(s) of ${b.sku} to stock?`)) return;
    }
    setBusy(b.batch);
    const data = await sheetAction<{ packs?: number; addedToStock?: boolean }>("updateBatch", { batch: b.batch, status, packs });
    setBusy("");
    if (!data.success) {
      setMessage({ type: "error", text: data.error || "Couldn't update the batch" });
      return;
    }
    if (status === "Packed") {
      setMessage({
        type: "ok",
        text: data.addedToStock ? `${data.packs} pack(s) added to stock.` : "Marked packed. (Stock for this batch was already added.)",
      });
    }
    load();
  }

  const active = batches.filter((b) => b.status !== "Packed");
  const done = batches.filter((b) => b.status === "Packed");

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminNav current="/admin/production" title="PRODUCTION" subtitle="Pour → cure → pack. Packing a batch adds it to stock." />

        <form onSubmit={addBatch} className="rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
          <h2 className="mb-4 text-xl font-black">LOG A POUR</h2>
          <div className="grid gap-3 md:grid-cols-5">
            <input
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU e.g. WV-BWM-45-12"
              required
              className="rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm uppercase outline-none focus:border-green-500 md:col-span-2"
            />
            <input
              value={baits}
              onChange={(e) => setBaits(e.target.value)}
              type="number"
              inputMode="numeric"
              min={1}
              placeholder="Baits poured"
              required
              className="rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm outline-none focus:border-green-500"
            />
            <input
              value={ml}
              onChange={(e) => setMl(e.target.value)}
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="Plastisol ml (optional)"
              className="rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm outline-none focus:border-green-500"
            />
            <button
              disabled={busy === "add"}
              className="rounded-xl bg-green-500 px-4 py-3 text-sm font-black text-black hover:bg-green-400 disabled:opacity-50"
            >
              {busy === "add" ? "SAVING..." : "＋ ADD BATCH"}
            </button>
          </div>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (recipe tweak, mould, etc.)"
            className="mt-3 w-full rounded-xl border border-green-500/20 bg-black px-4 py-2 text-sm outline-none focus:border-green-500"
          />
          <p className="mt-2 text-xs text-gray-500">
            Packing a batch here adds it to stock — don&apos;t also scan those packs in with the scanner&apos;s Production mode.
          </p>
        </form>

        {message && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
              message.type === "ok" ? "border border-green-500/40 bg-green-500/10 text-green-400" : "border border-red-500/40 bg-red-500/10 text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="mt-8 rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
          <h2 className="mb-4 text-xl font-black">IN PROGRESS ({active.length})</h2>
          {loading ? (
            <p className="p-6 text-center text-gray-400">Loading batches...</p>
          ) : active.length === 0 ? (
            <p className="p-6 text-center text-gray-500">No batches curing. Log a pour above.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {active.map((b) => {
                const suggested = perPack(b.sku) ? Math.floor(b.baits / perPack(b.sku)) : 0;
                return (
                  <div key={b.batch} className="rounded-2xl border border-yellow-500/30 bg-black p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black">
                          {b.sku} {b.colour && <span className="font-bold text-gray-400">· {b.colour}</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {b.batch} · poured {b.datePoured} · {b.baits} baits
                          {b.plastisolMl ? ` · ${b.plastisolMl} ml` : ""}
                        </p>
                        {b.notes && <p className="mt-1 text-xs text-gray-400">{b.notes}</p>}
                      </div>
                      <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-black text-yellow-400">{b.status.toUpperCase()}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-gray-400">
                        Packs
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={packCounts[b.batch] ?? (suggested || "")}
                          onChange={(e) => setPackCounts((c) => ({ ...c, [b.batch]: e.target.value }))}
                          className="w-20 rounded-lg border border-green-500/30 bg-black px-2 py-2 text-center font-black text-green-500"
                        />
                      </label>
                      <button
                        disabled={busy === b.batch}
                        onClick={() => setStatus(b, "Packed")}
                        className="rounded-xl bg-green-500 px-4 py-2 text-xs font-black text-black hover:bg-green-400 disabled:opacity-50"
                      >
                        {busy === b.batch ? "SAVING..." : "📦 PACKED → ADD TO STOCK"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6 lg:col-span-2">
            <h2 className="mb-4 text-xl font-black">PACKED</h2>
            {done.length === 0 ? (
              <p className="text-sm text-gray-500">Nothing packed yet.</p>
            ) : (
              <ul className="divide-y divide-white/5 text-sm">
                {done.slice(0, 40).map((b) => (
                  <li key={b.batch} className="flex items-center justify-between gap-3 py-2">
                    <span>
                      <b>{b.sku}</b> <span className="text-gray-400">{b.colour}</span>
                      <span className="block text-xs text-gray-500">
                        {b.batch} · poured {b.datePoured} · packed {b.datePacked}
                      </span>
                    </span>
                    <span className="font-black text-green-500">{b.packs} packs</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
            <h2 className="mb-1 text-xl font-black">PLASTISOL YIELD</h2>
            <p className="mb-4 text-xs text-gray-500">Baits per litre, from batches where you entered the ml.</p>
            {yields.length === 0 ? (
              <p className="text-sm text-gray-500">Enter plastisol ml on a few pours to see this.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {yields.map((y) => (
                  <li key={y.code} className="flex justify-between">
                    <span>
                      {y.code} <span className="text-xs text-gray-500">({y.batches} batch{y.batches === 1 ? "" : "es"})</span>
                    </span>
                    <span className="font-black text-green-500">{y.baitsPerLitre}/L</span>
                  </li>
                ))}
                <li className="pt-2 text-xs text-gray-500">A 25 L bucket ≈ baits/L × 25.</li>
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
