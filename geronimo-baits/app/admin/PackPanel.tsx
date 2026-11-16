"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useScannerInput } from "./useScannerInput";
import { hasCamera } from "./camera";

// Pack & scan one order.
// Scan every pack going into the box. Each scan is checked against the order:
//   • on the order and still needed → ticked off (green)
//   • not on the order, or one too many → blocked with a red warning
// When every line is complete, PACK ORDER sends the scans to the sheet, which
// checks them again, takes the packs off stock and marks the order Packed.
// SEND PART ORDER (dealer orders only) sends only what's been scanned so far
// (e.g. half a shop's order): those packs come off stock and the order stays open with the rest
// "to follow". Next time the order is opened, only what's left is listed.

type PackOrder = {
  orderNumber: string;
  customerName: string;
  items: string;
  paymentStatus: string;
};

type Line = {
  key: string;
  label: string;
  sku: string; // "" = no barcode → tick by hand
  needed: number; // still to send (order qty minus packs sent earlier)
  ordered: number; // on the order
  custom: boolean; // custom colour (…-CC-…) → usually no label, tick by hand
};

type Flash = { type: "ok" | "error"; text: string } | null;

const SAME_CODE_PAUSE_MS = 1200; // one pack held in view only counts once

// "2x Warviper 4.5" Jungle Camo | WV-JC-45-12" (one per line)
function parseItems(text: string): Line[] {
  const lines: Line[] = [];
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((raw, i) => {
      const qty = parseInt(raw, 10);
      const hasSku = raw.includes("|");
      const sku = hasSku ? (raw.split("|").pop() || "").trim().toUpperCase() : "";
      const label = (hasSku ? raw.slice(0, raw.lastIndexOf("|")) : raw).replace(/^\d+\s*x\s*/i, "").trim();
      const needed = Number.isFinite(qty) && qty > 0 ? qty : 1;
      // Every order line stays its own row, so two custom colours that share a
      // SKU (e.g. WB-CC-43-06) still show as two separate colours to pack.
      lines.push({ key: `line-${i}`, label: label || sku, sku, needed, ordered: needed, custom: /-CC-/.test(sku) });
    });
  return lines;
}

function beep(ok: boolean) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    osc.type = ok ? "sine" : "square";
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.08 : 0.35));
    osc.onended = () => ctx.close();
  } catch {}
  try {
    if ("vibrate" in navigator) navigator.vibrate(ok ? 60 : [120, 80, 120]);
  } catch {}
}

export default function PackPanel({
  order,
  onClose,
  onPacked,
}: {
  order: PackOrder;
  onClose: () => void;
  onPacked: (orderNumber: string, orderStatus: string) => void;
}) {
  // Packs already sent in an earlier part send, per SKU (from the sheet).
  const [sentBefore, setSentBefore] = useState<Record<string, number>>({});
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [isDealerOrder, setIsDealerOrder] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/pack", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber: order.orderNumber, progressOnly: true }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d?.success) return;
        if (d.packed && typeof d.packed === "object") setSentBefore(d.packed);
        setIsDealerOrder(d.dealer === true);
      })
      .catch(() => {})
      .finally(() => !cancelled && setProgressLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [order.orderNumber]);

  // Take packs sent earlier off the lines, first line first for a shared SKU.
  const lines = useMemo(() => {
    const left = { ...sentBefore };
    return parseItems(order.items).map((l) => {
      if (!l.sku) return l;
      const sent = Math.min(left[l.sku] || 0, l.ordered);
      left[l.sku] = (left[l.sku] || 0) - sent;
      return { ...l, needed: l.ordered - sent };
    });
  }, [order.items, sentBefore]);
  const anySentBefore = lines.some((l) => l.needed < l.ordered);
  const draftKey = `gb-pack-${order.orderNumber}`;

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [flash, setFlash] = useState<Flash>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [handheldReady, setHandheldReady] = useState(false);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const [manualSku, setManualSku] = useState("");
  const [saving, setSaving] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const countsRef = useRef(counts);
  countsRef.current = counts;

  // Keep progress if the phone locks or the page reloads
  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (draft && typeof draft === "object") setCounts(draft);
    } catch {}
  }, [draftKey]);
  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(counts));
    } catch {}
  }, [draftKey, counts]);

  useEffect(() => () => controlsRef.current?.stop(), []);

  function scan(raw: string) {
    const sku = raw.trim().toUpperCase();
    if (!sku) return;
    setProblems([]);
    const matches = lines.filter((l) => l.sku === sku);
    if (matches.length === 0) {
      beep(false);
      setFlash({ type: "error", text: `✖ ${sku} is NOT on this order — keep it out of the box.` });
      return;
    }
    // Same SKU on several lines → fill the first one that still needs packs
    const line = matches.find((l) => (countsRef.current[l.key] || 0) < l.needed);
    if (!line) {
      const total = matches.reduce((s, l) => s + l.needed, 0);
      beep(false);
      setFlash({ type: "error", text: `✖ Too many: ${sku} — this order only needs ${total}.` });
      return;
    }
    const have = countsRef.current[line.key] || 0;
    beep(true);
    setCounts((c) => ({ ...c, [line.key]: have + 1 }));
    setFlash({ type: "ok", text: `✔ ${line.label} (${have + 1}/${line.needed})` });
  }

  // camera callback always uses the latest scan()
  const scanRef = useRef(scan);
  scanRef.current = scan;

  // Handheld scanner: scans land here wherever you are on the screen
  useScannerInput((code) => {
    scanRef.current(code);
    setManualSku("");
  });

  function adjust(line: Line, delta: number) {
    setProblems([]);
    setCounts((c) => {
      const next = Math.min(Math.max((c[line.key] || 0) + delta, 0), line.needed);
      return { ...c, [line.key]: next };
    });
  }

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
          scanRef.current(code);
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

  function close() {
    stopCamera();
    onClose();
  }

  const totalNeeded = lines.reduce((s, l) => s + l.needed, 0);
  const totalDone = lines.reduce((s, l) => s + Math.min(counts[l.key] || 0, l.needed), 0);
  const complete = lines.length > 0 && totalNeeded > 0 && totalDone === totalNeeded;
  const scannedWithSku = lines.reduce((s, l) => s + (l.sku ? Math.min(counts[l.key] || 0, l.needed) : 0), 0);
  const canSendPart = isDealerOrder && !complete && scannedWithSku > 0;
  const unpaid = !String(order.paymentStatus || "").toLowerCase().startsWith("paid");

  async function pack(partial = false) {
    if (partial ? !canSendPart : !complete) return;
    if (
      partial &&
      !window.confirm(
        `Send PART of ${order.orderNumber} now?\n\n${totalDone} pack(s) go in this box and come off stock.\n${
          totalNeeded - totalDone
        } pack(s) stay on the order to send later.`
      )
    ) {
      return;
    }
    if (
      unpaid &&
      !window.confirm(`${order.orderNumber} is not marked Paid (${order.paymentStatus || "Pending"}). Pack it anyway?`)
    ) {
      return;
    }
    setSaving(true);
    setProblems([]);
    setFlash(null);
    try {
      const response = await fetch("/api/admin/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber: order.orderNumber,
          // the sheet adds up lines that share a SKU
          items: lines
            .filter((l) => l.sku)
            .map((l) => ({ sku: l.sku, qty: Math.min(counts[l.key] || 0, l.needed) }))
            .filter((i) => i.qty > 0),
          partial,
        }),
      });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const data = await response.json();
      if (!data.success) {
        beep(false);
        setFlash({ type: "error", text: data.error || "Packing failed" });
        setProblems(Array.isArray(data.problems) ? data.problems : []);
        return;
      }
      beep(true);
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      stopCamera();
      const stillLeft = Number(data.stillLeft) || 0;
      const done = data.complete !== false;
      onPacked(order.orderNumber, done ? "Packed" : `Part sent (${stillLeft} to follow)`);
      window.alert(
        !done
          ? `Part of ${order.orderNumber} sent. ${totalDone} pack(s) taken off stock, ${stillLeft} still to follow.\nOpen the order again to pack the rest when it's ready.`
          : data.deducted
          ? `${order.orderNumber} packed. ${totalDone} item(s) taken off stock.`
          : `${order.orderNumber} packed. Stock for this order was already taken off earlier, so it wasn't deducted again.`
      );
    } catch (error) {
      console.error("Pack failed:", error);
      setFlash({ type: "error", text: "Couldn't reach the sheet. Check your connection and try again." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/95 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black tracking-[0.3em] text-green-500">PACK &amp; SCAN</p>
            <h2 className="mt-1 text-3xl font-black">{order.orderNumber}</h2>
            <p className="text-gray-400">{order.customerName}</p>
          </div>
          <button
            onClick={close}
            className="rounded-xl border border-white/30 px-4 py-2 text-sm font-black text-white hover:bg-white hover:text-black"
          >
            CLOSE
          </button>
        </div>

        {unpaid && (
          <p className="mb-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm font-bold text-yellow-400">
            Payment status: {order.paymentStatus || "Pending"}. Orders are normally only released once paid.
          </p>
        )}

        {anySentBefore && (
          <p className="mb-4 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm font-bold text-green-400">
            Part of this order was sent already. Only what&apos;s still to follow is listed below.
          </p>
        )}
        {!progressLoaded && <p className="mb-4 text-sm text-gray-500">Checking what was sent before…</p>}

        <div className="overflow-hidden rounded-2xl border border-green-500/40 bg-black">
          <video
            ref={videoRef}
            className={`aspect-video w-full object-cover ${scanning ? "block" : "hidden"}`}
            muted
            playsInline
          />
          {!scanning && (
            <button onClick={startCamera} className="w-full py-12 text-lg font-black text-green-500">
              {handheldReady ? (
                <span className="flex flex-col items-center gap-2">
                  <span className="relative flex h-5 w-5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                    <span className="relative inline-flex h-5 w-5 rounded-full bg-green-500" />
                  </span>
                  SCANNER READY — SCAN A PACK
                  <span className="text-xs font-bold text-gray-400">Tap again to try the camera</span>
                </span>
              ) : (
                "📷 TAP TO START SCANNING"
              )}
            </button>
          )}
          {scanning && (
            <button onClick={stopCamera} className="w-full py-3 text-sm font-bold text-gray-400">
              STOP CAMERA
            </button>
          )}
        </div>
        {cameraError && <p className="mt-3 text-sm text-red-400">{cameraError}</p>}

        {flash && (
          <p
            className={`mt-4 rounded-xl px-4 py-3 text-lg font-black ${
              flash.type === "ok"
                ? "border border-green-500/50 bg-green-500/10 text-green-400"
                : "border-2 border-red-500 bg-red-500/20 text-red-300"
            }`}
          >
            {flash.text}
          </p>
        )}

        <form
          className="mt-4 flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            scan(manualSku);
            setManualSku("");
          }}
        >
          <input
            ref={skuInputRef}
            data-scan-target="1"
            autoFocus
            value={manualSku}
            onChange={(e) => setManualSku(e.target.value)}
            placeholder="SCAN, OR TYPE A SKU"
            className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm uppercase text-white outline-none focus:border-green-500"
          />
          <button className="rounded-xl border-2 border-green-500 px-5 font-black text-green-500">ADD</button>
        </form>

        <div className="mt-5 rounded-2xl border border-green-500/20 bg-black p-4">
          <p className="mb-3 text-sm font-black">
            {totalDone} / {totalNeeded} PACKED
          </p>
          {lines.length === 0 && <p className="text-gray-400">This order has no items listed.</p>}
          <div className="grid gap-2">
            {lines.map((line) => {
              const have = Math.min(counts[line.key] || 0, line.needed);
              const sentEarlier = line.needed === 0;
              const done = have === line.needed;
              return (
                <div
                  key={line.key}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 ${
                    done ? "border-green-500 bg-green-500/10" : "border-white/10"
                  }`}
                >
                  <div className="min-w-0">
                    <p className={`font-bold ${done ? "text-green-400" : "text-white"}`}>
                      {done ? "✔ " : ""}
                      {line.label}
                    </p>
                    <p className="text-xs text-gray-500">
                      {line.sku || "No barcode"}
                      {sentEarlier && <span className="ml-2 font-bold text-green-500">SENT EARLIER</span>}
                      {!sentEarlier && line.needed < line.ordered && (
                        <span className="ml-2 font-bold text-yellow-400">
                          {line.ordered - line.needed} of {line.ordered} sent earlier
                        </span>
                      )}
                      {(!line.sku || line.custom) && (
                        <span className="ml-2 rounded bg-yellow-500/15 px-1.5 py-0.5 font-bold text-yellow-400">
                          {line.custom ? "CUSTOM · " : ""}TICK BY HAND
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => adjust(line, -1)}
                      className="h-9 w-9 rounded-lg border border-green-500/40 font-black text-green-500"
                    >
                      −
                    </button>
                    <span className={`w-14 text-center font-black ${done ? "text-green-400" : "text-gray-300"}`}>
                      {have}/{line.needed}
                    </span>
                    <button
                      onClick={() => adjust(line, 1)}
                      disabled={done}
                      className="h-9 w-9 rounded-lg border border-green-500/40 font-black text-green-500 disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {problems.length > 0 && (
          <ul className="mt-4 list-disc rounded-xl border border-red-500/40 bg-red-500/10 py-3 pl-8 pr-4 text-sm text-red-300">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}

        {canSendPart && (
          <button
            onClick={() => pack(true)}
            disabled={saving}
            className="mt-5 w-full rounded-2xl border-2 border-yellow-400 py-4 text-lg font-black text-yellow-400 transition hover:bg-yellow-400 hover:text-black disabled:opacity-40"
          >
            {saving ? "SAVING..." : `SEND PART ORDER (${totalDone} OF ${totalNeeded}) · REST TO FOLLOW`}
          </button>
        )}

        <button
          onClick={() => pack(false)}
          disabled={!complete || saving}
          className="mt-5 w-full rounded-2xl bg-green-500 py-4 text-lg font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
        >
          {saving ? "SAVING..." : complete ? "PACK ORDER" : `SCAN ${totalNeeded - totalDone} MORE`}
        </button>
      </div>
    </div>
  );
}
