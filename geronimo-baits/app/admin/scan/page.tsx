"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useScannerInput } from "../useScannerInput";
import { hasCamera } from "../camera";

// Phone barcode scanner for stock.
// PRODUCTION: scan each new pack → added to In Stock.
// STOCKTAKE:  scan every pack on the shelf → Left is set to what you counted
//             (only for the SKUs you scanned; others are left alone).
// FULL:       weekly full stocktake → scanned products are set to the count,
//             EVERY product not scanned is set to 0, Sold is moved to Total
//             sold and reset. You see the list of products going to 0 first,
//             and a report of what changed afterwards.

type Mode = "production" | "stocktake" | "full";
type Line = { sku: string; qty: number };
type Product = { sku: string; bait: string; colour: string; left?: number };
type Diff = { sku: string; product: string; colour: string; expected: number; counted: number; scanned: boolean };
type Report = { counted: number; zeroed: number; packs: number; diffs: Diff[] };

const MODES: { id: Mode; label: string }[] = [
  { id: "production", label: "➕ PRODUCTION" },
  { id: "stocktake", label: "📋 STOCKTAKE" },
  { id: "full", label: "🧾 FULL COUNT" },
];

const DRAFT_KEY = "gb-scan-draft";
const SAME_CODE_PAUSE_MS = 1500; // one pack held in view only counts once

export default function ScanPage() {
  const [mode, setMode] = useState<Mode>("production");
  const [lines, setLines] = useState<Line[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [review, setReview] = useState<Product[] | null>(null); // full count: products about to go to 0
  const [report, setReport] = useState<Report | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [handheldReady, setHandheldReady] = useState(false);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const [lastScan, setLastScan] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [perScan, setPerScan] = useState(1); // packs added by the next scan / ADD
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const addScannedRef = useRef<(code: string) => void>(() => {});

  // Product names for the list: every SKU on the Inventory tab (live, hidden
  // shop products included). Falls back to the website's product list.
  function loadProducts() {
    return fetch("/api/admin/inventory", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.success || !Array.isArray(data.items)) throw new Error("no inventory");
        setProducts(
          data.items.map(
            (i: { sku: string; product: string; colour: string; left: number }) =>
              ({ sku: i.sku, bait: i.product, colour: i.colour, left: Number(i.left) || 0 }) as Product
          )
        );
        setInventoryLoaded(true);
      })
      .catch(() =>
        fetch("/api/products")
          .then((r) => r.json())
          .then((data) => Array.isArray(data) && setProducts(data))
          .catch(() => {})
      );
  }
  useEffect(() => {
    loadProducts();
  }, []);

  // Scanning more (or changing a count) after CHECK means the "going to 0" list is out of date
  useEffect(() => {
    setReview(null);
  }, [lines]);

  // Keep an unsaved count if the phone locks or the page reloads
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
      if (draft?.lines) setLines(draft.lines);
      if (draft?.mode) setMode(draft.mode);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, lines }));
    } catch {}
  }, [mode, lines]);

  useEffect(() => () => controlsRef.current?.stop(), []);

  const nameFor = useMemo(() => {
    const map = new Map(products.map((p) => [p.sku.toUpperCase(), `${p.bait} – ${p.colour}`]));
    return (sku: string) => map.get(sku);
  }, [products]);

  function addSku(raw: string, amount = 1) {
    const sku = raw.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,40}$/.test(sku)) return;
    setMessage(null);
    setLastScan(sku);
    setLines((current) => {
      const existing = current.find((l) => l.sku === sku);
      if (existing) {
        return current.map((l) => (l.sku === sku ? { ...l, qty: Math.max(l.qty + amount, 0) } : l));
      }
      return [{ sku, qty: Math.max(amount, 0) }, ...current];
    });
  }

  function setQty(sku: string, qty: number) {
    const n = Math.max(0, Math.min(Math.floor(qty) || 0, 10000));
    setLines((current) => current.map((l) => (l.sku === sku ? { ...l, qty: n } : l)));
  }

  // Next scan / ADD uses "packs per scan", then it goes back to 1
  function addScanned(code: string) {
    addSku(code, perScan);
    setPerScan(1);
    setManualSku("");
  }

  // Handheld scanner: scans land here wherever you are on the page
  useScannerInput(addScanned);
  addScannedRef.current = addScanned;

  // Tapping the scan block readies the handheld scanner straight away (focus on
  // the SKU box), then opens the camera too if this device has one.
  async function startCamera() {
    setCameraError("");
    setHandheldReady(true);
    skuInputRef.current?.focus();
    if (!(await hasCamera())) return;
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
      const reader = new BrowserMultiFormatReader(hints);

      if (!videoRef.current) return;
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current,
        (result) => {
          if (!result) return;
          const code = result.getText();
          const now = Date.now();
          if (code === lastCodeRef.current.code && now - lastCodeRef.current.at < SAME_CODE_PAUSE_MS) return;
          lastCodeRef.current = { code, at: now };
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(60);
          addScannedRef.current(code);
        }
      );
      controlsRef.current = controls;
      setScanning(true);
    } catch (error) {
      console.error("Camera failed:", error);
      setCameraError(
        "Couldn't open the camera, but the handheld scanner is ready. To use the camera, allow camera access and use the live site (https)."
      );
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  // Full count: check everything first, then show the products going to 0
  function startFullSave() {
    setMessage(null);
    setReport(null);
    if (!inventoryLoaded) {
      setMessage({ type: "error", text: "Couldn't load the Inventory list, so a full count can't be checked. Refresh and try again." });
      return;
    }
    const unknown = lines.filter((l) => l.qty > 0 && !nameFor(l.sku)).map((l) => l.sku);
    if (unknown.length) {
      setMessage({
        type: "error",
        text: `Not on the Inventory tab: ${unknown.join(", ")}. Those packs would not be counted and their real product would go to 0. Fix the SKU (type the right one with ×) or set them to 0, then save again.`,
      });
      return;
    }
    const scanned = new Set(lines.filter((l) => l.qty > 0).map((l) => l.sku));
    const seen = new Set<string>();
    setReview(
      products.filter((p) => {
        const sku = p.sku.toUpperCase();
        if (seen.has(sku) || scanned.has(sku)) return false;
        seen.add(sku);
        return true;
      })
    );
  }

  async function save() {
    if (lines.length === 0) return;
    if (mode === "full" && review === null) {
      startFullSave();
      return;
    }
    if (
      mode === "stocktake" &&
      !window.confirm(`Set stock to your counted amounts for ${lines.length} product(s)? Products you didn't scan stay as they are.`)
    ) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          reference: `SCAN ${new Date().toISOString().slice(0, 16).replace("T", " ")} ${Math.random().toString(36).slice(2, 6)}`,
          items: mode === "full" ? lines.filter((l) => l.qty > 0) : lines,
        }),
      });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await response.json();
      if (!data.success) {
        setMessage({ type: "error", text: data.error || "Save failed. Your count is kept — try again." });
        return;
      }
      const unknown: string[] = data.unknown || [];
      if (mode === "full") {
        setReview(null);
        setReport({ counted: data.counted, zeroed: data.zeroed, packs: data.packs, diffs: data.diffs || [] });
        setMessage({
          type: unknown.length ? "error" : "ok",
          text: data.skipped
            ? "This count was already saved."
            : `Full count saved: ${data.counted} product(s) counted (${data.packs} packs), ${data.zeroed} not scanned set to 0.` +
              (unknown.length ? ` Not found in Inventory (not saved): ${unknown.join(", ")}` : ""),
        });
        setLines([]);
        loadProducts();
        return;
      }
      setMessage({
        type: unknown.length ? "error" : "ok",
        text:
          `Saved ${data.updated} product(s) to Inventory.` +
          (unknown.length ? ` Not found in Inventory (not saved): ${unknown.join(", ")}` : ""),
      });
      setLines((current) => current.filter((l) => unknown.includes(l.sku)));
    } catch {
      setMessage({ type: "error", text: "No connection. Your count is kept — try again." });
    } finally {
      setSaving(false);
    }
  }

  const totalPacks = lines.reduce((sum, l) => sum + l.qty, 0);

  return (
    <main className="admin-bg min-h-screen px-4 py-6 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.4em] text-green-500">GERONIMO BAITS</p>
            <h1 className="mt-1 text-3xl font-black">📷 STOCK SCANNER</h1>
          </div>
          <div className="flex gap-2">
            <a href="/admin/stock" className="rounded-xl border border-green-500/40 px-3 py-2 text-sm font-bold text-green-500">
              📦 STOCK
            </a>
            <a href="/admin" className="rounded-xl border border-green-500/40 px-3 py-2 text-sm font-bold text-green-500">
              ← ADMIN
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-green-500/20 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setReview(null);
              }}
              className={`rounded-xl py-3 text-xs font-black sm:text-sm ${mode === m.id ? "bg-green-500 text-black" : "text-green-500"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className={`mt-2 text-xs ${mode === "full" ? "font-bold text-yellow-400" : "text-gray-400"}`}>
          {mode === "production"
            ? "Scan each new pack once. Saving adds them to In Stock."
            : mode === "stocktake"
              ? "Scan every pack on the shelf. Saving sets stock (Left) to what you counted, for the products you scanned."
              : "Weekly full count. Scan EVERY pack you have. Saving sets each scanned product to its count and every product you didn't scan to 0. Sold moves to Total sold and starts again at 0. Curing batches aren't touched."}
        </p>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-green-500/30 bg-zinc-900">
          <video ref={videoRef} className={`h-64 w-full object-cover ${scanning ? "" : "hidden"}`} muted playsInline />
          {!scanning && (
            <button onClick={startCamera} className="flex h-64 w-full flex-col items-center justify-center gap-2 font-black text-green-500">
              {handheldReady ? (
                <>
                  <span className="relative flex h-5 w-5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                    <span className="relative inline-flex h-5 w-5 rounded-full bg-green-500" />
                  </span>
                  SCANNER READY — SCAN A PACK
                  <span className="text-xs font-bold text-gray-400">Tap again to try the camera</span>
                </>
              ) : (
                <>
                  <span className="text-5xl">📷</span>
                  TAP TO START SCANNING
                </>
              )}
            </button>
          )}
          {scanning && (
            <>
              <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-red-500/80" />
              <button
                onClick={stopCamera}
                className="absolute right-3 top-3 rounded-lg bg-black/80 px-3 py-1 text-xs font-bold text-white"
              >
                STOP
              </button>
            </>
          )}
        </div>
        {cameraError && <p className="mt-2 text-sm text-red-400">{cameraError}</p>}
        {lastScan && (
          <p className="mt-2 text-sm text-gray-300">
            Last scan: <span className="font-bold text-green-500">{lastScan}</span>{" "}
            {nameFor(lastScan) ? `· ${nameFor(lastScan)}` : "· not on the Inventory tab"}
          </p>
        )}

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addScanned(manualSku);
          }}
        >
          <input
            ref={skuInputRef}
            data-scan-target="1"
            autoFocus
            value={manualSku}
            onChange={(e) => setManualSku(e.target.value)}
            placeholder="Scan, or type a SKU e.g. WV-BM-45-12"
            className="min-w-0 flex-1 rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm uppercase"
          />
          <label className="flex items-center gap-1 rounded-xl border border-green-500/30 px-2 text-xs font-bold text-gray-400">
            ×
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={perScan}
              onChange={(e) => setPerScan(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
              onFocus={(e) => e.target.select()}
              className="w-12 bg-transparent py-3 text-center text-sm font-black text-green-500 outline-none"
              aria-label="Packs per scan"
            />
          </label>
          <button className="rounded-xl border border-green-500 px-4 font-bold text-green-500">ADD</button>
        </form>
        <p className="mt-1 text-xs text-gray-500">
          Handheld scanner: just scan — no need to click the box. Set × to e.g. 10 before scanning to add 10 packs at once.
        </p>

        <div className="mt-5 rounded-2xl border border-green-500/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-black">
              {lines.length} PRODUCTS · {totalPacks} PACKS
            </p>
            {lines.length > 0 && (
              <button
                onClick={() => window.confirm("Clear this count?") && setLines([])}
                className="text-xs font-bold text-red-400"
              >
                CLEAR
              </button>
            )}
          </div>

          {lines.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing scanned yet.</p>
          ) : (
            <ul className="space-y-2">
              {lines.map((line) => (
                <li key={line.sku} className="flex items-center gap-3 rounded-xl border border-green-500/10 bg-zinc-950 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{nameFor(line.sku) || "Unknown product"}</p>
                    <p className="text-xs text-gray-500">{line.sku}</p>
                  </div>
                  <button onClick={() => addSku(line.sku, -1)} className="h-9 w-9 rounded-lg border border-green-500/40 font-black">
                    −
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={line.qty}
                    onChange={(e) => setQty(line.sku, Number(e.target.value))}
                    onFocus={(e) => e.target.select()}
                    className="w-14 rounded-lg border border-green-500/20 bg-black py-1 text-center text-lg font-black text-green-500 outline-none focus:border-green-500"
                    aria-label={`Packs of ${line.sku}`}
                  />
                  <button onClick={() => addSku(line.sku, 1)} className="h-9 w-9 rounded-lg border border-green-500/40 font-black">
                    +
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {message && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-sm font-bold ${
              message.type === "ok" ? "border border-green-500/40 bg-green-500/10 text-green-400" : "border border-red-500/40 bg-red-500/10 text-red-400"
            }`}
          >
            {message.text}
          </p>
        )}

        {review !== null && mode === "full" && (
          <div className="mt-4 rounded-2xl border border-yellow-500/50 bg-yellow-500/5 p-4">
            {(() => {
              const withStock = review.filter((p) => (p.left ?? 0) !== 0);
              const alreadyZero = review.length - withStock.length;
              return (
                <>
                  <p className="font-black text-yellow-400">
                    {withStock.length === 0
                      ? "Every product with stock was scanned."
                      : `${withStock.length} product(s) with stock weren't scanned and will go to 0:`}
                  </p>
                  {withStock.length > 0 && (
                    <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-sm">
                      {withStock.map((p) => (
                        <li key={p.sku} className="flex justify-between gap-2">
                          <span className="truncate">
                            {p.bait} – {p.colour} <span className="text-xs text-gray-500">{p.sku}</span>
                          </span>
                          <span className="font-bold text-red-400">
                            {p.left} → 0
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {alreadyZero > 0 && <p className="mt-2 text-xs text-gray-400">+ {alreadyZero} other product(s) already on 0.</p>}
                  <p className="mt-3 text-xs text-gray-400">If any of these are on the shelf, go back and scan them first.</p>
                  <button
                    onClick={() => setReview(null)}
                    className="mt-3 w-full rounded-xl border border-green-500/40 py-3 text-sm font-black text-green-500"
                  >
                    ← BACK TO SCANNING
                  </button>
                </>
              );
            })()}
          </div>
        )}

        {report && (
          <div className="mt-4 rounded-2xl border border-green-500/30 p-4">
            <p className="font-black">
              WHAT CHANGED · {report.diffs.length} product(s) differed from the sheet
            </p>
            {report.diffs.length === 0 ? (
              <p className="mt-2 text-sm text-green-400">Everything matched. 👌</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {report.diffs.map((d) => (
                  <li key={d.sku} className="flex justify-between gap-2">
                    <span className="truncate">
                      {d.product} – {d.colour} <span className="text-xs text-gray-500">{d.sku}</span>
                    </span>
                    <span className={`whitespace-nowrap font-bold ${d.counted < d.expected ? "text-red-400" : "text-green-400"}`}>
                      {d.expected} → {d.counted} ({d.counted - d.expected > 0 ? "+" : ""}
                      {d.counted - d.expected})
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-gray-500">Also saved in the Stock Log as FULL STOCKTAKE lines.</p>
          </div>
        )}

        <button
          onClick={save}
          disabled={saving || lines.length === 0}
          className="sticky bottom-4 mt-5 w-full rounded-2xl bg-green-500 py-5 text-lg font-black text-black shadow-lg shadow-green-500/30 disabled:opacity-50"
        >
          {saving
            ? "SAVING..."
            : mode === "production"
              ? `ADD ${totalPacks} PACKS TO STOCK`
              : mode === "stocktake"
                ? "SAVE STOCKTAKE"
                : review !== null
                  ? "CONFIRM — SAVE FULL COUNT"
                  : `CHECK FULL COUNT (${totalPacks} PACKS)`}
        </button>
      </div>
    </main>
  );
}
