"use client";

// Talks to a NIIMBOT label printer (B21S) over Bluetooth, straight from the
// browser (Edge / Chrome on the PC). Uses the open-source NiimBlue library,
// loaded only when you press Connect.

import type { NiimbotBluetoothClient } from "@mmote/niimbluelib";

let client: NiimbotBluetoothClient | null = null;

export function bluetoothSupported() {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

export async function connectPrinter(onDisconnect: () => void): Promise<string> {
  const lib = await import("@mmote/niimbluelib");
  if (client) await client.disconnect().catch(() => {});
  const c = new lib.NiimbotBluetoothClient();
  c.on("disconnect", () => {
    client = null;
    onDisconnect();
  });
  await c.connect(); // opens the browser's Bluetooth device picker
  client = c;
  return c.getModelMetadata()?.model || "NIIMBOT";
}

export async function disconnectPrinter() {
  await client?.disconnect().catch(() => {});
  client = null;
}

export function printerConnected() {
  return client !== null;
}

// Print each canvas `qty` times, in one print job
export async function printLabels(jobs: { canvas: HTMLCanvasElement; qty: number }[], density: number) {
  if (!client) throw new Error("Connect the printer first");
  const lib = await import("@mmote/niimbluelib");
  const meta = client.getModelMetadata();
  const taskType = client.getPrintTaskType() || "D110";
  const totalPages = jobs.reduce((t, j) => t + j.qty, 0);
  const task = client.protocol.newPrintTask(taskType, {
    totalPages,
    density,
    labelType: lib.LabelType.WithGaps,
  });
  try {
    await task.printInit();
    for (const job of jobs) {
      if (job.qty < 1) continue;
      const image = lib.ImageEncoder.encodeCanvas(job.canvas, lib.PageColorType.SingleColor, meta?.printDirection || "top");
      await task.printPage(image, job.qty);
      await task.waitForPageFinished();
    }
    await task.waitForFinished();
  } finally {
    await client?.protocol.printEnd().catch(() => false);
  }
}
