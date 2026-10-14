"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SelectedLocker } from "@/lib/shop";

// PUDO locker picker: a full-screen map of all PUDO lockers with search and
// "use my location". Falls back to a plain text box if the locker list
// isn't available (e.g. no PUDO_API_KEY yet).

type Locker = {
  code: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  town: string;
  hours: string;
};

type Props = {
  value: SelectedLocker | null;
  onChange: (locker: SelectedLocker | null) => void;
};

const SA_CENTRE: [number, number] = [-28.8, 25.5];
const GREEN = "#22c55e";

function distanceKm(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export default function PudoLockerPicker({ value, onChange }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const [lockers, setLockers] = useState<Locker[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [userPos, setUserPos] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [highlighted, setHighlighted] = useState<Locker | null>(null);

  const mapDiv = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, CircleMarker>>(new Map());

  // Load the locker list once
  useEffect(() => {
    let cancelled = false;
    fetch("/api/pudo-lockers")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.available && Array.isArray(data.lockers)) {
          setLockers(data.lockers);
          setStatus("ready");
        } else {
          setStatus("unavailable");
        }
      })
      .catch(() => !cancelled && setStatus("unavailable"));
    return () => {
      cancelled = true;
    };
  }, []);

  // Create the map when the picker opens, remove it when it closes
  useEffect(() => {
    if (!open || !mapDiv.current || lockers.length === 0) return;
    let disposed = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !mapDiv.current) return;

      const map = L.map(mapDiv.current, { preferCanvas: true }).setView(SA_CENTRE, 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const markers = new Map<string, CircleMarker>();
      for (const locker of lockers) {
        const marker = L.circleMarker([locker.lat, locker.lng], {
          radius: 7,
          color: "#000",
          weight: 2,
          fillColor: GREEN,
          fillOpacity: 0.9,
        })
          .addTo(map)
          .on("click", () => setHighlighted(locker));
        markers.set(locker.code, marker);
      }

      mapRef.current = map;
      markersRef.current = markers;

      // The modal has only just appeared, so let Leaflet re-measure it, then
      // zoom to fit all the lockers (unless a locker is already chosen).
      setTimeout(() => {
        map.invalidateSize();
        if (!value?.code) {
          map.fitBounds(
            L.latLngBounds(lockers.map((l) => [l.lat, l.lng] as [number, number])),
            { padding: [20, 20] }
          );
        }
      }, 50);

      if (value) {
        const current = lockers.find((l) => l.code === value.code);
        if (current) {
          setHighlighted(current);
          map.setView([current.lat, current.lng], 14);
        }
      }
    })();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = new Map();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lockers]);

  // Highlight the chosen marker
  useEffect(() => {
    markersRef.current.forEach((marker, code) => {
      const active = code === highlighted?.code;
      marker.setStyle({
        radius: active ? 11 : 7,
        fillColor: active ? "#ffffff" : GREEN,
        color: active ? GREEN : "#000",
        weight: active ? 4 : 2,
      });
      if (active) marker.bringToFront();
    });
  }, [highlighted]);

  // Close with Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q
      ? lockers.filter((l) =>
          `${l.name} ${l.address} ${l.town} ${l.code}`.toLowerCase().includes(q)
        )
      : lockers;

    if (userPos) {
      list = [...list].sort(
        (a, b) => distanceKm(userPos, [a.lat, a.lng]) - distanceKm(userPos, [b.lat, b.lng])
      );
    } else if (!q) {
      return [];
    }
    return list.slice(0, 40);
  }, [lockers, query, userPos]);

  function focusLocker(locker: Locker) {
    setHighlighted(locker);
    mapRef.current?.setView([locker.lat, locker.lng], 15);
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocateError("Your browser can't share your location. Search by town instead.");
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserPos(here);
        setLocating(false);
        mapRef.current?.setView(here, 12);
      },
      () => {
        setLocating(false);
        setLocateError("Couldn't get your location. Search by town or suburb instead.");
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  function selectLocker(locker: Locker) {
    onChange({
      code: locker.code,
      name: locker.name,
      address: [locker.address, locker.town].filter(Boolean).join(", "),
    });
    setOpen(false);
  }

  // Fallback: no locker list available
  if (status === "unavailable") {
    return (
      <div className="space-y-2">
        <input
          type="text"
          placeholder="PUDO locker name or code"
          value={value?.name ?? ""}
          onChange={(e) =>
            onChange(
              e.target.value.trim()
                ? { code: "", name: e.target.value, address: "" }
                : null
            )
          }
          className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white"
        />
        <p className="text-xs text-gray-500">
          Find your nearest locker on the PUDO website, then type its name here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {value?.code ? (
        <div className="rounded-xl border border-green-500/40 bg-black/60 p-4">
          <p className="text-xs font-bold tracking-[0.2em] text-green-500">YOUR LOCKER</p>
          <p className="mt-1 font-bold text-white">{value.name}</p>
          <p className="text-sm text-gray-400">{value.address}</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-2 text-sm font-bold text-green-500 hover:text-green-400"
          >
            CHANGE LOCKER
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={status === "loading"}
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-green-500 px-4 py-3 font-bold text-green-500 transition hover:bg-green-500 hover:text-black disabled:opacity-60"
        >
          {status === "loading" ? "LOADING LOCKERS..." : "📍 CHOOSE LOCKER ON MAP"}
        </button>
      )}

      {/* Rendered into <body> so parent styles (like the sidebar's blur)
          can't trap the full-screen map inside the sidebar. */}
      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 text-white md:p-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden border-green-500/30 bg-black md:rounded-3xl md:border">
            <div className="flex items-center justify-between border-b border-green-500/20 px-5 py-4">
              <div>
                <p className="text-xs font-black tracking-[0.3em] text-green-500">PUDO</p>
                <h2 className="text-2xl font-black">CHOOSE YOUR LOCKER</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-xl border border-green-500/40 px-4 py-2 font-bold text-green-500 hover:bg-green-500 hover:text-black"
              >
                ✕
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] md:grid-cols-[340px_1fr] md:grid-rows-1">
              <div className="flex min-h-0 flex-col border-b border-green-500/20 md:border-b-0 md:border-r">
                <div className="space-y-3 p-4">
                  <input
                    type="search"
                    placeholder="Search town, suburb or mall"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-white outline-none focus:border-green-500"
                  />
                  <button
                    type="button"
                    onClick={useMyLocation}
                    disabled={locating}
                    className="w-full rounded-xl border border-green-500/40 px-4 py-2 text-sm font-bold text-green-500 hover:bg-green-500 hover:text-black disabled:opacity-60"
                  >
                    {locating ? "FINDING YOU..." : "🎯 USE MY LOCATION"}
                  </button>
                  {locateError && <p className="text-xs text-red-400">{locateError}</p>}
                </div>

                <div className="max-h-40 overflow-y-auto px-4 pb-4 md:max-h-none md:flex-1">
                  {results.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {query.trim()
                        ? "No lockers match that search."
                        : "Search or use your location to list nearby lockers, or tap a pin on the map."}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {results.map((locker) => (
                        <li key={locker.code}>
                          <button
                            type="button"
                            onClick={() => focusLocker(locker)}
                            className={`w-full rounded-xl border p-3 text-left transition ${
                              highlighted?.code === locker.code
                                ? "border-green-500 bg-green-500/10"
                                : "border-green-500/20 hover:border-green-500/60"
                            }`}
                          >
                            <p className="font-bold">{locker.name}</p>
                            <p className="text-xs text-gray-400">
                              {[locker.address, locker.town].filter(Boolean).join(", ")}
                            </p>
                            {userPos && (
                              <p className="mt-1 text-xs font-bold text-green-500">
                                {distanceKm(userPos, [locker.lat, locker.lng]).toFixed(1)} km away
                              </p>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="relative min-h-0">
                <div ref={mapDiv} className="h-full min-h-[300px] w-full" />

                {highlighted && (
                  <div className="absolute inset-x-3 bottom-3 z-[1000] rounded-2xl border border-green-500 bg-black/95 p-4 shadow-lg shadow-green-500/20 md:left-auto md:right-4 md:w-96">
                    <p className="text-xs font-bold tracking-[0.2em] text-green-500">
                      {highlighted.code}
                    </p>
                    <p className="mt-1 text-lg font-black">{highlighted.name}</p>
                    <p className="text-sm text-gray-300">
                      {[highlighted.address, highlighted.town].filter(Boolean).join(", ")}
                    </p>
                    {highlighted.hours && (
                      <p className="mt-2 text-xs text-gray-500">{highlighted.hours}</p>
                    )}
                    <button
                      type="button"
                      onClick={() => selectLocker(highlighted)}
                      className="mt-3 w-full rounded-xl bg-green-500 px-4 py-3 font-black text-black hover:bg-green-400"
                    >
                      SELECT THIS LOCKER
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
