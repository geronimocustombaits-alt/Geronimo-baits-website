"use client";

import { useEffect, useRef } from "react";

// Handheld / Bluetooth barcode scanners "type" the code very fast and press
// Enter. This catches those scans anywhere on the page, so you don't have to
// click into the SKU box first. Normal typing in another input (like a
// quantity box) is left alone.

// Scanners type a character every few ms, but Bluetooth ones often send in
// bursts with an occasional stall of 100ms+ in the middle of a code. A single
// slow gap must NOT throw away what came before it (that is how
// "WV-JC-45-12" turned into "5-12"). So:
//  - the buffer is only cleared after a real pause (RESET_MS), and
//  - on Enter we decide "scanner or person?" from the typical (median) gap
//    of the whole burst, so one hiccup doesn't matter.
const RESET_MS = 500; // longer than any stall inside one scan
const SCANNER_MEDIAN_GAP_MS = 50; // people type far slower than this

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function useScannerInput(onScan: (code: string) => void, enabled = true) {
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buffer = "";
    let gaps: number[] = [];
    let last = 0;

    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typingInField =
        target &&
        (target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          (target.tagName === "INPUT" && !target.dataset.scanTarget));
      if (typingInField) return; // let the person type in that box

      // Shift etc. arrive as their own keydown; they're not characters
      if (e.key !== "Enter" && e.key.length !== 1) return;

      const now = Date.now();
      const gap = now - last;
      last = now;
      if (gap > RESET_MS) {
        buffer = "";
        gaps = [];
      } else if (buffer) {
        gaps.push(gap);
      }

      if (e.key === "Enter") {
        const code = buffer.trim();
        const looksLikeScanner = median(gaps) <= SCANNER_MEDIAN_GAP_MS;
        buffer = "";
        gaps = [];
        if (code.length >= 3 && looksLikeScanner) {
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
