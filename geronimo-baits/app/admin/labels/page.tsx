"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdminNav from "../AdminNav";
import { drawLabel, LABEL_H, LABEL_W, type LabelInfo } from "../labelArt";
import { bluetoothSupported, connectPrinter, disconnectPrinter, printLabels } from "../niimbot";

// Print pack labels (50 × 30 mm) on the NIIMBOT B21S over Bluetooth.
// Bait + colour come from the Inventory tab, so the barcode always matches the SKU.
// Opening /admin/labels?sku=WV-BM-45-12&qty=6 (from Production) pre-fills the list.

type InvItem = { sku: string; product: string; colour: string };
type Line = LabelInfo & { qty: number };

const perPackOf = (sku: string) => Number((sku.match(/-(\d+)$/) || [])[1]) || 0;
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

export default function LabelsPage() {
  const [inventory, setInventory] = useState<InvItem[]>([]);
  const [product, setProduct] = useState("");
  const [sku, setSku] = useState("");
  const [qty, setQty] = useState("1");
  const [lines, setLines] = useState<Line[]>([]);
  const [printer, setPrinter] = useState("");
  const [density, setDensity] = useState(3);
  const [busy, setBusy] = useState<"" | "connect" | "print">("");
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [supported, setSupported] = useState(true);
  const prefill = useRef<{ sku: string; qty: number } | null>(null);

  useEffect(() => {
    setSupported(bluetoothSupported());
    const params = new URLSearchParams(window.location.search);
    const s = (params.get("sku") || "").toUpperCase();
    if (s) prefill.current = { sku: s, qty: Math.max(1, Math.min(Number(params.get("qty")) || 1, 500)) };
    (async () => {
      try {
        const response = await fetch("/api/admin/inventory", { cache: "no-store" });
        const data = await response.json();
        if (data.success && Array.isArray(data.items)) setInventory(data.items);
        else setMessage({ type: "error", text: data.error || "Couldn't load your baits" });
      } catch {
        setMessage({ type: "error", text: "Couldn't load your baits" });
      }
    })();
    return () => {
      disconnectPrinter();
    };
  }, []);

  const bySku = useMemo(() => {
    const m: Record<string, InvItem> = {};
    inventory.forEach((i) => (m[i.sku.toUpperCase()] = i));
    return m;
  }, [inventory]);

  // Pre-fill from the Production page once the bait list has loaded
  useEffect(() => {
    const p = prefill.current;
    if (!p || !bySku[p.sku]) return;
    prefill.current = null;
    const item = bySku[p.sku];
    setLines([{ sku: item.sku, bait: item.product, colour: item.colour, perPack: perPackOf(item.sku), qty: p.qty }]);
    setProduct(item.product);
    setSku(item.sku);
  }, [bySku]);

  const products = useMemo(() => [...new Set(inventory.map((i) => i.product).filter(Boolean))], [inventory]);
  const colours = useMemo(() => inventory.filter((i) => i.product === product), [inventory, product]);
  const selected = sku ? bySku[sku.toUpperCase()] : undefined;
  const preview: LabelInfo | null = selected
    ? { sku: selected.sku, bait: selected.product, colour: selected.colour, perPack: perPackOf(selected.sku) }
    : lines[0] || null;
  const total = lines.reduce((t, l) => t + l.qty, 0);

  function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const n = Math.max(1, Number(qty) || 1);
    setLines((current) => {
      const existing = current.find((l) => l.sku === selected.sku);
      if (existing) return current.map((l) => (l.sku === selected.sku ? { ...l, qty: l.qty + n } : l));
      return [...current, { sku: selected.sku, bait: selected.product, colour: selected.colour, perPack: perPackOf(selected.sku), qty: n }];
    });
    setQty("1");
  }

  async function connect() {
    setBusy("connect");
    setMessage(null);
    try {
      const model = await connectPrinter(() => {
        setPrinter("");
        setMessage({ type: "error", text: "Printer disconnected." });
      });
      setPrinter(model);
      setMessage({ type: "ok", text: `Connected to ${model}.` });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setMessage({
        type: "error",
        text: /cancel|chosen|selected/i.test(text)
          ? "No printer picked. Switch the printer on, press Connect, and choose it from the list."
          : `Couldn't connect: ${text}`,
      });
    }
    setBusy("");
  }

  async function printAll() {
    if (!lines.length) return;
    setBusy("print");
    setMessage(null);
    try {
      const jobs = lines.map((l) => {
        const canvas = document.createElement("canvas");
        drawLabel(canvas, l);
        return { canvas, qty: l.qty };
      });
      await printLabels(jobs, density);
      setMessage({ type: "ok", text: `Printed ${total} label(s).` });
    } catch (error) {
      setMessage({ type: "error", text: `Printing stopped: ${error instanceof Error ? error.message : String(error)}` });
    }
    setBusy("");
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminNav current="/admin/labels" title="LABELS" subtitle="Print 50 × 30 mm pack labels on your NIIMBOT B21S." />

        {/* Printer */}
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-5">
          <span className={`h-3 w-3 rounded-full ${printer ? "bg-green-500" : "bg-gray-600"}`} />
          <p className="font-black">{printer ? `PRINTER: ${printer}` : "PRINTER NOT CONNECTED"}</p>
          <label className="ml-auto flex items-center gap-2 text-xs font-bold text-gray-400">
            Darkness
            <select
              value={density}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="rounded-lg border border-green-500/30 bg-black px-2 py-2 text-sm text-white"
            >
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}
                  {d === 3 ? " (normal)" : ""}
                </option>
              ))}
            </select>
          </label>
          {printer ? (
            <button
              onClick={() => disconnectPrinter().then(() => setPrinter(""))}
              className="rounded-xl border border-gray-600 px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/10"
            >
              DISCONNECT
            </button>
          ) : (
            <button
              onClick={connect}
              disabled={busy !== "" || !supported}
              className="rounded-xl bg-green-500 px-5 py-2 text-sm font-black text-black hover:bg-green-400 disabled:opacity-50"
            >
              {busy === "connect" ? "CONNECTING..." : "🔗 CONNECT PRINTER"}
            </button>
          )}
          {!supported && (
            <p className="w-full text-sm text-yellow-400">
              This browser can&apos;t use Bluetooth. Open the back office in Microsoft Edge or Google Chrome on your PC.
            </p>
          )}
        </div>

        {message && (
          <p
            className={`mb-6 rounded-xl px-4 py-3 text-sm font-bold ${
              message.type === "ok" ? "border border-green-500/40 bg-green-500/10 text-green-400" : "border border-red-500/40 bg-red-500/10 text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pick + preview */}
          <form onSubmit={addLine} className="rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
            <h2 className="mb-4 text-xl font-black">ADD LABELS</h2>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
              <select
                value={product}
                onChange={(e) => {
                  setProduct(e.target.value);
                  setSku("");
                }}
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
              <input
                value={qty}
                onChange={(e) => setQty(digits(e.target.value))}
                inputMode="numeric"
                aria-label="How many labels"
                className="rounded-xl border border-green-500/30 bg-black px-3 py-3 text-center text-sm font-black outline-none focus:border-green-500"
              />
            </div>
            <button
              disabled={!selected}
              className="mt-3 w-full rounded-xl border border-green-500 py-3 text-sm font-black text-green-500 hover:bg-green-500 hover:text-black disabled:opacity-40"
            >
              ＋ ADD TO PRINT LIST
            </button>

            <p className="mb-2 mt-6 text-xs font-bold text-gray-400">PREVIEW (50 × 30 mm)</p>
            {preview ? (
              <LabelPreview label={preview} />
            ) : (
              <div className="flex aspect-[5/3] items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-gray-500">
                Pick a bait and colour
              </div>
            )}
          </form>

          {/* Print list */}
          <div className="rounded-3xl border border-green-500/20 bg-black/70 p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-black">PRINT LIST · {total} LABEL(S)</h2>
              {lines.length > 0 && (
                <button onClick={() => setLines([])} className="text-xs font-bold text-red-400">
                  CLEAR
                </button>
              )}
            </div>
            {lines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-gray-500">
                Nothing to print yet. Add labels on the left.
              </p>
            ) : (
              <ul className="space-y-2">
                {lines.map((l) => (
                  <li key={l.sku} className="flex items-center gap-3 rounded-2xl border border-white/5 p-3">
                    <div className="w-24 shrink-0">
                      <LabelPreview label={l} small />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">
                        {l.bait} · {l.colour}
                      </p>
                      <p className="text-xs text-gray-500">{l.sku}</p>
                    </div>
                    <input
                      value={String(l.qty)}
                      onChange={(e) => {
                        const n = Math.max(1, Number(digits(e.target.value)) || 1);
                        setLines((c) => c.map((x) => (x.sku === l.sku ? { ...x, qty: n } : x)));
                      }}
                      inputMode="numeric"
                      aria-label="Labels"
                      className="w-16 rounded-lg border border-green-500/30 bg-black px-2 py-2 text-center font-black text-green-500"
                    />
                    <button
                      onClick={() => setLines((c) => c.filter((x) => x.sku !== l.sku))}
                      className="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-500 hover:text-black"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={printAll}
              disabled={!printer || !lines.length || busy !== ""}
              className="mt-5 w-full rounded-2xl bg-green-500 py-4 text-lg font-black text-black hover:bg-green-400 disabled:opacity-40"
            >
              {busy === "print" ? "PRINTING..." : printer ? `🖨 PRINT ${total} LABEL(S)` : "CONNECT THE PRINTER TO PRINT"}
            </button>
            <p className="mt-2 text-xs text-gray-500">
              Uses 50 × 30 mm labels with gaps. If the print is faint or too dark, change Darkness and print one test label.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

function LabelPreview({ label, small = false }: { label: LabelInfo; small?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawLabel(ref.current, label);
  }, [label]);
  return (
    <canvas
      ref={ref}
      width={LABEL_W}
      height={LABEL_H}
      className={`w-full rounded-lg bg-white ${small ? "" : "shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"}`}
      style={{ imageRendering: "pixelated" }}
    />
  );
}
