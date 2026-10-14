import { NextResponse } from "next/server";

// Returns PUDO lockers for the checkout map, from The Courier Guy's locker API.
// The list is cached for a day. If the API key is missing or the API is
// unreachable, it returns { available: false } and checkout falls back to a
// plain "locker name or code" box.

export type PudoLocker = {
  code: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  town: string;
  hours: string;
};

type RawLocker = {
  code?: string;
  name?: string;
  latitude?: string | number;
  longitude?: string | number;
  address?: string;
  place?: { town?: string; postalCode?: string };
  openinghours?: { day?: string; open_time?: string; close_time?: string }[];
};

// PUDO's docs show api-tcg.co.za, but their live API also runs at
// api-pudo.co.za/api/v1. Each address is tried in turn and the first one that
// answers with a locker list is used.
const LOCKER_URLS = [
  "https://api-pudo.co.za/api/v1/lockers-data",
  "https://api-tcg.co.za/lockers-data",
  "https://api-pudo.co.za/lockers-data",
];

function summariseHours(hours: RawLocker["openinghours"]): string {
  if (!Array.isArray(hours) || hours.length === 0) return "";
  return hours
    .filter((h) => h?.day)
    .map((h) => {
      const open = (h.open_time || "").slice(0, 5);
      const close = (h.close_time || "").slice(0, 5);
      const closed = !open || !close || (open === "00:00" && close === "00:00");
      return `${h.day}: ${closed ? "Closed" : `${open}–${close}`}`;
    })
    .join(" · ");
}

// PUDO's full response is over Next.js's 2 MB fetch-cache limit, so the
// trimmed list is kept in server memory for a day instead.
const CACHE_MS = 24 * 60 * 60 * 1000;
let cached: { lockers: PudoLocker[]; at: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json({ available: true, lockers: cached.lockers });
  }

  const apiKey = process.env.PUDO_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ available: false, reason: "PUDO_API_KEY not set" });
  }

  try {
    const attempts: string[] = [];
    let raw: unknown = null;

    for (const url of LOCKER_URLS) {
      const label = `${new URL(url).host}${new URL(url).pathname}`;
      try {
        const response = await fetch(`${url}?api_key=${encodeURIComponent(apiKey)}`, {
          headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
          cache: "no-store",
        });
        attempts.push(`${label} → ${response.status}`);
        if (response.ok) {
          raw = await response.json().catch(() => null);
          if (raw) break;
        }
      } catch {
        attempts.push(`${label} → unreachable`);
      }
    }

    if (!raw) {
      console.error("PUDO LOCKERS: no address worked:", attempts.join(", "));
      return NextResponse.json({ available: false, reason: "PUDO API did not return lockers", attempts });
    }

    const data = raw as { data?: unknown };
    const list: RawLocker[] = Array.isArray(raw)
      ? (raw as RawLocker[])
      : Array.isArray(data?.data)
        ? (data.data as RawLocker[])
        : [];

    const lockers: PudoLocker[] = list
      .map((l) => ({
        code: String(l.code ?? "").trim(),
        name: String(l.name ?? "").trim(),
        lat: Number(l.latitude),
        lng: Number(l.longitude),
        address: String(l.address ?? "").trim(),
        town: String(l.place?.town ?? "").trim(),
        hours: summariseHours(l.openinghours),
      }))
      .filter((l) => l.code && Number.isFinite(l.lat) && Number.isFinite(l.lng) && l.lat !== 0);

    if (lockers.length === 0) {
      console.error("PUDO LOCKERS: API returned no usable lockers");
      return NextResponse.json({ available: false, reason: "No lockers returned" });
    }

    cached = { lockers, at: Date.now() };
    return NextResponse.json({ available: true, lockers });
  } catch (error) {
    console.error("PUDO LOCKERS ERROR:", error);
    return NextResponse.json({ available: false, reason: "PUDO API unreachable" });
  }
}
