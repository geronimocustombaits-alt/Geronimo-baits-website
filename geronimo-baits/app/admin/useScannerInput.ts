"use client";

import { useEffect, useRef } from "react";

// Handheld / Bluetooth barcode scanners "type" the code very fast and press
// Enter. This catches those scans anywhere on the page, so you don't have to
// click into the SKU box first. Normal typing in another input (like a
// quantity box) is left alone.

const MAX_GAP_MS = 60; // scanners type a character every few ms; people are slower

export function useScannerInput(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let last = 0;

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typingInField =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          (target.tagName === "INPUT" && !target.dataset.scanTarget));
      if (typingInField) return; // let the person type in that box

      const now = Date.now();
      if (now - last > MAX_GAP_MS) buffer = "";
      last = now;

      if (e.key === "Enter") {
        const code = buffer.trim();
        buffer = "";
        if (code.length >= 3) {
          e.preventDefault();
          onScanRef.current(code);
        }
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        buffer += e.key;
      }
    }

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [enabled]);
}
