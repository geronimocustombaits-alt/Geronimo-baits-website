"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Phone barcode scanner for stock.
// PRODUCTION: scan each new pack → added to In Stock.
// STOCKTAKE:  scan every pack on the shelf → Left is set to what you counted
//             (only for the SKUs you scanned; others are left alone).

type Mode = "production" | "stocktake";
type Line = { sku: string; qty: number };
type Product = { sku: string; bait: string; colour: string };

const DRAFT_KEY = "gb-scan-draft";
const SAME_CODE_PAUSE_MS = 1500; // one pack held in view only counts once

export default function ScanPage() {
  const [mode, setMode] = useState<Mode>("production");
  const [lines, setLines] = useState<Line[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [lastScan, setLastScan] = useState("");
  const [manualSku, setManualSku] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  // Product names for the list (visible website products)
  useEffect(() => {
    fetch("/api/products")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setProducts(data))
      .catch(() => {});
  }, []);

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

  async function startCamera() {
    setCameraError("");
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
          addSku(code);
        }
      );
      controlsRef.current = controls;
      setScanning(true);
    } catch (error) {
      console.error("Camera failed:", error);
      setCameraError(
        "Couldn't open the camera. Allow camera access, and use the live site (https) — phones block the camera on plain http addresses."
      );
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  async function save() {
    if (lines.length === 0) return;
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
          items: lines,
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
    <main className="min-h-screen bg-black px-4 py-6 text-white">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.4em] text-green-500">GERONIMO BAITS</p>
            <h1 className="mt-1 text-3xl font-black">📷 STOCK SCANNER</h1>
          </div>
          <a href="/admin" className="rounded-xl border border-green-500/40 px-3 py-2 text-sm font-bold text-green-500">
            ← ADMIN
          </a>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-green-500/20 p-1">
          {(["production", "stocktake"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-xl py-3 text-sm font-black ${mode === m ? "bg-green-500 text-black" : "text-green-500"}`}
            >
              {m === "production" ? "➕ PRODUCTION" : "📋 STOCKTAKE"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">
          {mode === "production"
            ? "Scan each new pack once. Saving adds them to In Stock."
            : "Scan every pack on the shelf. Saving sets stock (Left) to what you counted, for the products you scanned."}
        </p>

        <div className="relative mt-4 overflow-hidden rounded-2xl border border-green-500/30 bg-zinc-900">
          <video ref={videoRef} className={`h-64 w-full object-cover ${scanning ? "" : "hidden"}`} muted playsInline />
          {!scanning && (
            <button onClick={startCamera} className="flex h-64 w-full flex-col items-center justify-center gap-2 font-black text-green-500">
              <span className="text-5xl">📷</span>
              TAP TO START SCANNING
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
            {nameFor(lastScan) ? `· ${nameFor(lastScan)}` : "· not on the website list"}
          </p>
        )}

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addSku(manualSku);
            setManualSku("");
          }}
        >
          <input
            value={manualSku}
            onChange={(e) => setManualSku(e.target.value)}
            placeholder="Or type a SKU, e.g. WV-BM-45-12"
            className="flex-1 rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm uppercase"
          />
          <button className="rounded-xl border border-green-500 px-4 font-bold text-green-500">ADD</button>
        </form>

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
                  <span className="w-8 text-center text-lg font-black text-green-500">{line.qty}</span>
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

        <button
          onClick={save}
          disabled={saving || lines.length === 0}
          className="sticky bottom-4 mt-5 w-full rounded-2xl bg-green-500 py-5 text-lg font-black text-black shadow-lg shadow-green-500/30 disabled:opacity-50"
        >
          {saving ? "SAVING..." : mode === "production" ? `ADD ${totalPacks} PACKS TO STOCK` : "SAVE STOCKTAKE"}
        </button>
      </div>
    </main>
  );
}
