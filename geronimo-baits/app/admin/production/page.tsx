"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "../AdminNav";
import { sheetAction } from "@/lib/sheetAction";

// Production batches: log a pour, it sits in Curing. Packs scanned in with the
// scanner's Production mode come off the oldest open batch of that colour
// (PACKS = packed so far) and the batch closes itself when it runs out.
// "Packed" here adds only the packs that weren't scanned.

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
type InvItem = { sku: string; product: string; colour: string };
type Yield = { code: string; batches: number; baitsPerLitre: number };

// Number boxes are plain text that keep only digits, so you can just type 29
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

// Curing: baits need 24 hours before they can be packed
const CURE_HOURS = 24;
// Batch IDs carry the pour time in South African time, e.g. B261112-1152-BM = 12 Nov 2026 11:52
function pouredAt(b: { batch: string; datePoured: string }) {
  const m = b.batch.match(/^B(\d{2})(\d{2})(\d{2})-(\d{2})(\d{2})/);
  if (m) return Date.UTC(2000 + +m[1], +m[2] - 1, +m[3], +m[4] - 2, +m[5]); // SAST = UTC+2
  const d = Date.parse(`${b.datePoured}T00:00:00+02:00`);
  return Number.isNaN(d) ? 0 : d;
}
function timeLeft(ms: number) {
  const mins = Math.ceil(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

const perPack = (sku: string) => Number((sku.match(/-(\d+)$/) || [])[1]) || 0;

export default function ProductionPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [yields, setYields] = useState<Yield[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [packCounts, setPackCounts] = useState<Record<string, string>>({});
  const [moreBaits, setMoreBaits] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => Date.now());

  // Tick the curing timers every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [product, setProduct] = useState("");
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

  async function loadInventory() {
    try {
      const response = await fetch("/api/admin/inventory", { cache: "no-store" });
      const data = await response.json();
      if (data.success && Array.isArray(data.items)) setInventory(data.items);
    } catch {
      // the batch list still works; the dropdowns just stay empty
    }
  }

  useEffect(() => {
    load();
    loadInventory();
  }, []);

  // Bait → colour dropdowns, from the Inventory tab, in sheet order
  const products = useMemo(() => [...new Set(inventory.map((i) => i.product).filter(Boolean))], [inventory]);
  // SKU → bait name (e.g. Warvipers 4.5") from the Inventory tab
  const productBySku = useMemo(() => {
    const m: Record<string, string> = {};
    inventory.forEach((i) => (m[i.sku.toUpperCase()] = i.product));
    return m;
  }, [inventory]);
  const productOf = (sku: string) => productBySku[String(sku).toUpperCase()] || "";
  const colours = useMemo(() => inventory.filter((i) => i.product === product), [inventory, product]);

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
    setProduct("");
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
      const extra = Math.max(packs - b.packs, 0);
      const question = extra
        ? `Mark ${b.batch} packed and add ${extra} more pack(s) of ${b.sku} to stock?` +
          (b.packs ? ` (${b.packs} were already scanned in.)` : "")
        : `Mark ${b.batch} packed? Its ${b.packs} pack(s) were already scanned into stock, so nothing more is added.`;
      if (!window.confirm(question)) return;
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
        text: data.addedToStock ? `${data.packs} pack(s) added to stock.` : "Marked packed. (Its packs were already scanned into stock.)",
      });
    }
    load();
  }

  async function addBaits(b: Batch) {
    const more = Math.floor(Number(moreBaits[b.batch]) || 0);
    if (!(more > 0)) {
      setMessage({ type: "error", text: "Enter how many baits to add." });
      return;
    }
    setBusy(b.batch);
    const data = await sheetAction<{ baits?: number }>("updateBatch", { batch: b.batch, addBaits: more });
    setBusy("");
    if (!data.success) {
      setMessage({ type: "error", text: data.error || "Couldn't add the baits" });
      return;
    }
    setMessage({ type: "ok", text: `Added ${more} baits to ${b.batch} — now ${data.baits} baits.` });
    setMoreBaits((m) => ({ ...m, [b.batch]: "" }));
    setPackCounts((c) => {
      const next = { ...c };
      delete next[b.batch];
      return next;
    });
    load();
  }

  async function removeBatch(b: Batch) {
    const question =
      `Remove batch ${b.batch} (${b.sku}, ${b.baits} baits)?` +
      (b.packs ? ` The ${b.packs} pack(s) already scanned in stay in stock.` : "");
    if (!window.confirm(question)) return;
    setBusy(b.batch);
    const data = await sheetAction("deleteBatch", { batch: b.batch });
    setBusy("");
    if (!data.success) {
      setMessage({ type: "error", text: data.error || "Couldn't remove the batch" });
      return;
    }
    setMessage({ type: "ok", text: `Batch ${b.batch} removed.` });
    load();
  }

  const active = batches.filter((b) => b.status !== "Packed");
  const done = batches.filter((b) => b.status === "Packed");
  // Still to come out of open batches: baits not yet packed, and the packs they'll make
  const curing = active.reduce(
    (t, b) => {
      const per = perPack(b.sku);
      return {
        baits: t.baits + Math.max(b.baits - b.packs * per, 0),
        packs: t.packs + (per ? Math.max(Math.floor(b.baits / per) - b.packs, 0) : 0),
      };
    },
    { baits: 0, packs: 0 }
  );

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminNav current="/admin/production" title="PRODUCTION" subtitle="Pour → cure → pack. Packing a batch adds it to stock." />

        <form onSubmit={addBatch} className="rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
          <h2 className="mb-4 text-xl font-black">LOG A POUR</h2>
          <div className="grid gap-3 md:grid-cols-5">
            <div className="grid grid-cols-2 gap-3 md:col-span-2">
              <select
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value);
                  setSku("");
                }}
                required
                className="rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm outline-none focus:border-green-500"
              >
                <option value="">{inventory.length ? "Bait…" : "Loading baits…"}</option>
                {products.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                required
                disabled={!product}
                className="rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm outline-none focus:border-green-500 disabled:opacity-50"
              >
                <option value="">Colour…</option>
                {colours.map((i) => (
                  <option key={i.sku} value={i.sku}>
                    {i.colour || i.sku}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={baits}
              onChange={(e) => setBaits(digits(e.target.value))}
              type="text"
              inputMode="numeric"
              placeholder="Baits poured"
              required
              className="rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm outline-none focus:border-green-500"
            />
            <input
              value={ml}
              onChange={(e) => setMl(digits(e.target.value))}
              type="text"
              inputMode="numeric"
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
            Scan packs in with the scanner&apos;s Production mode as you bag them — they come off the oldest open batch of that
            colour, and the batch closes itself when its baits run out.
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
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-black">IN PROGRESS ({active.length})</h2>
            <div className="flex gap-3">
              <div className="rounded-2xl border border-yellow-500/30 px-4 py-2 text-right">
                <p className="text-[10px] font-bold text-gray-400">BAITS CURING</p>
                <p className="text-2xl font-black text-yellow-400">{curing.baits}</p>
              </div>
              <div className="rounded-2xl border border-green-500/30 px-4 py-2 text-right">
                <p className="text-[10px] font-bold text-gray-400">PACKS TO COME</p>
                <p className="text-2xl font-black text-green-400">{curing.packs}</p>
              </div>
            </div>
          </div>
          {loading ? (
            <p className="p-6 text-center text-gray-400">Loading batches...</p>
          ) : active.length === 0 ? (
            <p className="p-6 text-center text-gray-500">No batches curing. Log a pour above.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {active.map((b) => {
                const per = perPack(b.sku);
                const suggested = per ? Math.floor(b.baits / per) : 0;
                const baitsLeft = Math.max(b.baits - b.packs * per, 0);
                const start = pouredAt(b);
                const readyAt = start + CURE_HOURS * 3600000;
                const ready = !start || now >= readyAt || b.status === "Packing";
                const cured = start ? Math.min(Math.max((now - start) / (CURE_HOURS * 3600000), 0), 1) : 1;
                const badge =
                  b.status === "Packing"
                    ? { text: "PACKING", cls: "bg-yellow-500/15 text-yellow-400" }
                    : ready
                    ? { text: "✔ READY TO PACK", cls: "bg-green-500 text-black" }
                    : { text: "CURING", cls: "bg-yellow-500/15 text-yellow-400" };
                return (
                  <div
                    key={b.batch}
                    className={`rounded-2xl border bg-black p-4 ${ready ? "border-green-500/60" : "border-yellow-500/30"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-lg font-black text-green-400">
                          {productOf(b.sku) || b.sku}
                          {b.colour && <span className="text-white"> · {b.colour}</span>}
                        </p>
                        <p className="text-xs text-gray-500">
                          {productOf(b.sku) ? `${b.sku} · ` : ""}
                          {b.batch} · poured {b.datePoured} · {b.baits} baits
                          {b.plastisolMl ? ` · ${b.plastisolMl} ml` : ""}
                        </p>
                        {b.notes && <p className="mt-1 text-xs text-gray-400">{b.notes}</p>}
                        {per > 0 && (
                          <p className="mt-2 text-sm font-bold">
                            <span className="text-green-400">{b.packs}</span>
                            <span className="text-gray-400"> of {suggested} packs packed · </span>
                            <span className="text-yellow-400">{baitsLeft} baits left</span>
                          </p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${badge.cls}`}>{badge.text}</span>
                    </div>
                    {start > 0 && b.status !== "Packing" && (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs font-bold">
                          {ready ? (
                            <span className="text-green-400">Cured — you can start packing</span>
                          ) : (
                            <span className="text-yellow-400">⏱ Ready in {timeLeft(readyAt - now)}</span>
                          )}
                          <span className="text-gray-500">
                            ready{" "}
                            {new Date(readyAt).toLocaleString("en-ZA", {
                              weekday: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                              timeZone: "Africa/Johannesburg",
                            })}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={`h-full rounded-full ${ready ? "bg-green-500" : "bg-yellow-400"}`}
                            style={{ width: `${Math.round(cured * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-gray-400">
                        Packs
                        <input
                          type="text"
                          inputMode="numeric"
                          value={packCounts[b.batch] ?? (suggested || "")}
                          onChange={(e) => setPackCounts((c) => ({ ...c, [b.batch]: digits(e.target.value) }))}
                          className="w-20 rounded-lg border border-green-500/30 bg-black px-2 py-2 text-center font-black text-green-500"
                        />
                      </label>
                      <button
                        disabled={busy === b.batch}
                        onClick={() => setStatus(b, "Packed")}
                        className="rounded-xl bg-green-500 px-4 py-2 text-xs font-black text-black hover:bg-green-400 disabled:opacity-50"
                      >
                        {busy === b.batch ? "SAVING..." : "📦 MARK PACKED"}
                      </button>
                      <a
                        href={`/admin/labels?sku=${encodeURIComponent(b.sku)}&qty=${Math.max(suggested - b.packs, 1)}`}
                        className="rounded-xl border border-green-500 px-4 py-2 text-xs font-black text-green-500 hover:bg-green-500 hover:text-black"
                      >
                        🏷 PRINT {Math.max(suggested - b.packs, 1)} LABEL(S)
                      </a>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
                      <label className="flex items-center gap-2 text-xs text-gray-400">
                        Add baits
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="e.g. 24"
                          value={moreBaits[b.batch] ?? ""}
                          onChange={(e) => setMoreBaits((m) => ({ ...m, [b.batch]: digits(e.target.value) }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addBaits(b);
                            }
                          }}
                          className="w-24 rounded-lg border border-green-500/30 bg-black px-2 py-2 text-center font-black text-white"
                        />
                      </label>
                      <button
                        disabled={busy === b.batch}
                        onClick={() => addBaits(b)}
                        className="rounded-xl border border-green-500 px-4 py-2 text-xs font-black text-green-500 hover:bg-green-500 hover:text-black disabled:opacity-50"
                      >
                        ＋ ADD TO BATCH
                      </button>
                      <button
                        disabled={busy === b.batch}
                        onClick={() => removeBatch(b)}
                        className="ml-auto rounded-xl border border-red-500/50 px-4 py-2 text-xs font-black text-red-400 hover:bg-red-500 hover:text-black disabled:opacity-50"
                      >
                        🗑 REMOVE
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
                      <b>{productOf(b.sku) || b.sku}</b> <span className="text-gray-400">{b.colour}</span>
                      <span className="block text-xs text-gray-500">
                        {productOf(b.sku) ? `${b.sku} · ` : ""}
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
