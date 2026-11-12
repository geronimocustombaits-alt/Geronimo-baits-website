"use client";

import { useEffect, useMemo, useState } from "react";
import AdminNav from "../AdminNav";
import { sheetAction } from "@/lib/sheetAction";

// Label list to work off while printing labels in the NIIMBOT phone app.
// "To print" = packs still to come out of open Production batches. Tick a line
// off once its labels are printed (remembered on this phone). Tap a SKU to copy it.

type InvItem = { sku: string; product: string; colour: string };
type Batch = { batch: string; sku: string; colour: string; baits: number; status: string; packs: number };
type Line = { key: string; sku: string; bait: string; colour: string; labels: number; batches: string[] };

const STORE = "gb_labels_done";
const perPack = (sku: string) => Number((sku.match(/-(\d+)$/) || [])[1]) || 0;

function loadDone(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}");
  } catch {
    return {};
  }
}

export default function LabelListPage() {
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [inv, prod] = await Promise.all([
        fetch("/api/admin/inventory", { cache: "no-store" }).then((r) => r.json()),
        sheetAction<{ batches: Batch[] }>("getBatches"),
      ]);
      if (inv.success && Array.isArray(inv.items)) setInventory(inv.items);
      if (prod.success) setBatches(prod.batches || []);
      setError(!inv.success ? inv.error || "Couldn't load your baits" : !prod.success ? prod.error || "Couldn't load batches" : "");
    } catch {
      setError("No connection. Try again.");
    }
    setLoading(false);
  }

  useEffect(() => {
    setDone(loadDone());
    load();
  }, []);

  const bySku = useMemo(() => {
    const m: Record<string, InvItem> = {};
    inventory.forEach((i) => (m[i.sku.toUpperCase()] = i));
    return m;
  }, [inventory]);

  // One line per SKU: labels still needed for open batches
  const toPrint = useMemo(() => {
    const lines: Record<string, Line> = {};
    batches.forEach((b) => {
      if (b.status === "Packed") return;
      const per = perPack(b.sku);
      const labels = per ? Math.max(Math.floor(b.baits / per) - (b.packs || 0), 0) : 0;
      if (!labels) return;
      const sku = String(b.sku).toUpperCase();
      const item = bySku[sku];
      const line = (lines[sku] = lines[sku] || {
        key: "",
        sku,
        bait: item?.product || "",
        colour: item?.colour || b.colour,
        labels: 0,
        batches: [],
      });
      line.labels += labels;
      line.batches.push(b.batch);
    });
    // The tick resets by itself if the batches or count change
    return Object.values(lines)
      .map((l) => ({ ...l, key: `${l.sku}|${l.labels}|${l.batches.join(",")}` }))
      .sort((a, b) => a.bait.localeCompare(b.bait) || a.colour.localeCompare(b.colour));
  }, [batches, bySku]);

  const remaining = toPrint.filter((l) => !done[l.key]);
  const totalLabels = remaining.reduce((t, l) => t + l.labels, 0);

  function toggle(key: string) {
    setDone((d) => {
      const next = { ...d, [key]: !d[key] };
      if (!next[key]) delete next[key];
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        // not saved on this phone; the tick still shows until you leave the page
      }
      return next;
    });
  }

  async function copy(sku: string) {
    try {
      await navigator.clipboard.writeText(sku);
      setCopied(sku);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // clipboard blocked; the SKU is still on screen to type
    }
  }

  const allBaits = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inventory.filter((i) => !q || `${i.product} ${i.colour} ${i.sku}`.toLowerCase().includes(q));
  }, [inventory, search]);

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-3xl">
        <AdminNav current="/admin/labels" title="LABEL LIST" subtitle="Work through this while you print labels in the NIIMBOT app." />

        {error && <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">{error}</p>}

        <div className="rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">TO PRINT</h2>
              <p className="text-xs text-gray-400">For packs still to come out of your open batches.</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-yellow-400">{totalLabels}</p>
              <p className="text-xs font-bold text-gray-400">labels left</p>
            </div>
          </div>

          {loading ? (
            <p className="p-6 text-center text-gray-400">Loading...</p>
          ) : toPrint.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-gray-500">
              No open batches need labels. Log a pour on the Production page.
            </p>
          ) : (
            <ul className="space-y-2">
              {toPrint.map((l) => {
                const isDone = !!done[l.key];
                return (
                  <li
                    key={l.key}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${isDone ? "border-white/5 opacity-50" : "border-green-500/30"}`}
                  >
                    <button
                      onClick={() => toggle(l.key)}
                      aria-label={isDone ? "Mark not printed" : "Mark printed"}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-xl font-black ${
                        isDone ? "border-green-500 bg-green-500 text-black" : "border-green-500/50 text-transparent"
                      }`}
                    >
                      ✓
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-black ${isDone ? "line-through" : ""}`}>
                        <span className="text-green-400">{l.bait || l.sku}</span> · {l.colour}
                      </p>
                      <button onClick={() => copy(l.sku)} className="mt-0.5 font-mono text-sm font-bold text-gray-300">
                        {l.sku} <span className="text-xs text-gray-500">{copied === l.sku ? "copied ✓" : "tap to copy"}</span>
                      </button>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-2xl font-black text-yellow-400">×{l.labels}</p>
                      <p className="text-[10px] font-bold text-gray-500">labels</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <button onClick={load} className="mt-4 text-xs font-bold text-green-500">
            ↻ REFRESH
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
          <h2 className="text-xl font-black">ALL BAITS</h2>
          <p className="mb-3 text-xs text-gray-400">Every SKU on your Inventory tab, for reprints. Tap a SKU to copy it.</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bait, colour or SKU"
            className="mb-3 w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm outline-none focus:border-green-500"
          />
          <ul className="divide-y divide-white/5">
            {allBaits.map((i) => (
              <li key={i.sku} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm">
                  <b>{i.product}</b> · {i.colour}
                </span>
                <button onClick={() => copy(i.sku)} className="shrink-0 font-mono text-sm font-bold text-green-400">
                  {copied === i.sku ? "copied ✓" : i.sku}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
