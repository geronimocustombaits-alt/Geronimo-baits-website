"use client";

import JsBarcode from "jsbarcode";

// Draws one 50 × 30 mm pack label for the B21S: 203 dpi = 8 dots per mm, and
// the printhead is 384 dots (48 mm) wide, so the label is 384 × 240 dots.
export const LABEL_W = 384;
export const LABEL_H = 240;

export type LabelInfo = { sku: string; bait: string; colour: string; perPack: number };

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startPx: number, minPx: number) {
  let size = startPx;
  ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    ctx.font = `900 ${size}px Arial, Helvetica, sans-serif`;
  }
}

export function drawLabel(canvas: HTMLCanvasElement, label: LabelInfo) {
  canvas.width = LABEL_W;
  canvas.height = LABEL_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, LABEL_W, LABEL_H);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const mid = LABEL_W / 2;
  const maxW = LABEL_W - 16;

  // Brand
  ctx.font = "900 15px Arial, Helvetica, sans-serif";
  ctx.fillText("G E R O N I M O   B A I T S", mid, 22);
  ctx.fillRect(40, 30, LABEL_W - 80, 2);

  // Bait + colour
  fitText(ctx, label.bait, maxW, 34, 18);
  ctx.fillText(label.bait, mid, 66);
  fitText(ctx, label.colour, maxW, 28, 16);
  ctx.fillText(label.colour, mid, 98);

  // Barcode (CODE128, the scanner's format). Bars are whole dots so they print crisp.
  const bars = document.createElement("canvas");
  let barWidth = 2;
  JsBarcode(bars, label.sku, { format: "CODE128", width: barWidth, height: 78, displayValue: false, margin: 0 });
  if (bars.width > maxW) {
    barWidth = 1;
    JsBarcode(bars, label.sku, { format: "CODE128", width: barWidth, height: 78, displayValue: false, margin: 0 });
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bars, Math.round((LABEL_W - bars.width) / 2), 112);

  // SKU + pack size
  ctx.font = "700 17px Arial, Helvetica, sans-serif";
  const info = label.perPack ? `${label.sku}  ·  ${label.perPack} per pack` : label.sku;
  ctx.fillText(info, mid, 222);

  // Thermal printers print any non-white dot as black, so snap to pure black / white
  const img = ctx.getImageData(0, 0, LABEL_W, LABEL_H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11 < 150 ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
