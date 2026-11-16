"use client";

// Private order form for a dealer shop: /dealer/<code>.
// Shows dealer prices, lets the shop type a quantity per colour, and sends the
// order to the back office (it lands on the Orders tab as a Dealer order).

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DEALER_LEAD_TIME } from "@/lib/dealer";
import { BUSINESS, whatsappLink } from "@/lib/business";

type DealerProduct = {
  sku: string;
  bait: string;
  colour: string;
  size: string;
  price: number;
  retail: number;
  inStock: number | null; // null: not on the stock list (made to order)
  usual: boolean; // a colour this shop has ordered before
  lastQty: number;
};

type Progress = { packs: number; target: number; to: string; daysLeft: number } | null;

type Loaded = {
  dealer: { name: string; contactName: string; delivery: string };
  progress: Progress;
  products: DealerProduct[];
};

const rand = (n: number) => `R${(Math.round(n * 100) / 100).toFixed(2)}`;

export default function DealerOrderPage() {
  const params = useParams<{ code: string }>();
  const code = String(params?.code || "").toUpperCase();

  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<{ orderNumber: string; packs: number; productTotal: number; invoiceNumber?: string } | null>(null);

  const draftKey = `gb-dealer-draft-${code}`;

  useEffect(() => {
    fetch(`/api/dealer?code=${encodeURIComponent(code)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) setLoadError(d.error || "This order link isn't valid.");
        else setData(d);
      })
      .catch(() => setLoadError("Couldn't load the order form. Check your connection and refresh."));
    // A half-filled order survives a refresh
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
      if (saved?.qty) setQty(saved.qty);
      if (saved?.note) setNote(saved.note);
    } catch {}
  }, [code, draftKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftKey, JSON.stringify({ qty, note }));
    } catch {}
  }, [qty, note, draftKey]);

  // Two sections (the shop's own colours, then the rest of the range), each
  // grouped by bait + size
  const sections = useMemo(() => {
    const q = search.trim().toLowerCase();
    const group = (list: DealerProduct[]) => {
      const map = new Map<string, DealerProduct[]>();
      list
        .filter((p) => !q || `${p.bait} ${p.colour} ${p.size} ${p.sku}`.toLowerCase().includes(q))
        .forEach((p) => {
          // Bait names often carry the size already ('Warcraws 3.3"'): don't add it twice
          const size = String(p.size || "").trim();
          const key = size && !p.bait.replace(/["”]/g, "").includes(size.replace(/["”]/g, "")) ? `${p.bait} ${size}` : p.bait;
          map.set(key, [...(map.get(key) || []), p]);
        });
      return [...map.entries()];
    };
    const all = data?.products || [];
    return [
      { id: "usual", title: "YOUR COLOURS", hint: "What you've ordered before", groups: group(all.filter((p) => p.usual)) },
      { id: "range", title: "MORE FROM THE RANGE", hint: "", groups: group(all.filter((p) => !p.usual)) },
    ].filter((sec) => sec.groups.length > 0);
  }, [data, search]);
  const groupCount = sections.reduce((n, sec) => n + sec.groups.length, 0);
  const hasUsual = (data?.products || []).some((p) => p.usual && p.lastQty > 0);

  // Fill every one of the shop's colours with the quantity it last ordered
  function fillUsual() {
    const next: Record<string, number> = { ...qty };
    (data?.products || []).forEach((p) => {
      if (p.usual && p.lastQty > 0) next[p.sku] = p.lastQty;
    });
    setQty(next);
  }

  const lines = useMemo(
    () => (data?.products || []).filter((p) => (qty[p.sku] || 0) > 0).map((p) => ({ ...p, qty: qty[p.sku] })),
    [data, qty]
  );
  const packs = lines.reduce((s, l) => s + l.qty, 0);
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);

  function setLine(sku: string, value: number) {
    const n = Math.max(0, Math.min(500, Math.floor(value) || 0));
    setQty((current) => ({ ...current, [sku]: n }));
  }

  async function submit() {
    if (!lines.length || sending) return;
    setSending(true);
    setError("");
    try {
      const r = await fetch("/api/dealer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, note, items: lines.map((l) => ({ sku: l.sku, qty: l.qty })) }),
      });
      const d = await r.json();
      if (!d.success) {
        setError(d.error || "Couldn't send your order. Try again.");
        return;
      }
      setPlaced({ orderNumber: d.orderNumber, packs: d.packs, productTotal: d.productTotal, invoiceNumber: d.invoiceNumber });
      setQty({});
      setNote("");
      try {
        localStorage.removeItem(draftKey);
      } catch {}
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("No connection. Your order is saved on this page, so just try again.");
    } finally {
      setSending(false);
    }
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black bg-cover bg-center bg-fixed px-6 text-center text-white" style={{ backgroundImage: "url('/bg-main.webp')" }}>
        <div className="rounded-3xl border border-green-500/30 bg-black/85 p-8 backdrop-blur-md">
          <p className="text-sm font-black tracking-[0.4em] text-green-500">GERONIMO BAITS</p>
          <h1 className="mt-4 text-3xl font-black">ORDER LINK NOT FOUND</h1>
          <p className="mt-3 text-gray-400">{loadError}</p>
          <a href={whatsappLink} className="mt-6 inline-block rounded-xl bg-green-500 px-5 py-3 font-black text-black">
            WHATSAPP {BUSINESS.phoneDisplay}
          </a>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black bg-cover bg-center bg-fixed text-gray-300" style={{ backgroundImage: "url('/bg-main.webp')" }}>
        <p className="rounded-2xl border border-green-500/30 bg-black/85 px-6 py-4 font-bold backdrop-blur-md">Loading order form...</p>
      </main>
    );
  }

  const progress = data.progress;

  return (
    <main className="min-h-screen bg-black bg-cover bg-center bg-fixed px-4 pb-40 pt-10 text-white md:px-6" style={{ backgroundImage: "url('/bg-main.webp')" }}>
      <section className="mx-auto max-w-4xl">
        <div className="rounded-3xl border border-green-500/30 bg-black/85 p-6 text-center backdrop-blur-md md:p-8">
        <img src="/logo.png" alt="Geronimo Baits" className="mx-auto h-24 w-auto md:h-28" />
        <p className="mt-3 text-sm font-black tracking-[0.4em] text-green-500">DEALER ORDERS</p>
        <h1 className="mt-3 text-3xl font-black md:text-5xl">{data.dealer.name.toUpperCase()}</h1>
        <p className="mt-3 text-gray-300">
          Your private order form for Geronimo Baits.
        </p>
        <p className="mt-4 text-xs font-black tracking-[0.3em] text-green-500">BUILT TO HUNT · HANDMADE IN SA</p>
        </div>

        {/* How ordering works */}
        <div className="mt-6 rounded-3xl border border-green-500/30 bg-black/85 p-6 backdrop-blur-md md:p-8">
          <p className="text-sm font-black tracking-[0.3em] text-green-500">HOW IT WORKS</p>
          <ol className="mt-4 grid gap-4 md:grid-cols-4">
            {[
              ["1", "Pick your packets", "Your usual colours are at the top. Tap + or type a number, or fill in your usual quantities in one go."],
              ["2", "Send your order", "Press Send order at the bottom. You'll get an order number straight away."],
              ["3", "You get the invoice", "We send your invoice for the order before we start making it."],
              ["4", "We make & deliver", `Every bait is handmade, so allow ${DEALER_LEAD_TIME}. In-stock colours can go sooner.`],
            ].map(([n, title, text]) => (
              <li key={n} className="rounded-2xl border border-green-500/15 bg-black/60 p-4">
                <p className="text-2xl font-black text-green-500">{n}</p>
                <p className="mt-1 font-black">{title}</p>
                <p className="mt-1 text-sm text-gray-400">{text}</p>
              </li>
            ))}
          </ol>
          <ul className="mt-5 grid gap-2 text-sm text-gray-300 md:grid-cols-2">
            <li>✓ All prices are <b className="text-white">dealer prices per packet</b>.</li>
            <li>✓ <b className="text-white">&quot;Made to order&quot;</b> colours are poured for your order.</li>
            <li>✓ Bookmark this page and use the same link for every order.</li>
            <li>✓ Questions or custom colours? Add a note, or WhatsApp us.</li>
          </ul>
          <a
            href={whatsappLink}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block rounded-xl border border-green-500 px-5 py-3 text-sm font-black text-green-500 transition hover:bg-green-500 hover:text-black"
          >
            WHATSAPP {BUSINESS.phoneDisplay}
          </a>
        </div>

        {placed && (
          <div className="mt-6 rounded-2xl border border-green-500 bg-black/85 p-5 backdrop-blur-md">
            <p className="text-xs font-black tracking-[0.25em] text-green-500">ORDER SENT ✓</p>
            <p className="mt-2 text-2xl font-black">{placed.orderNumber}</p>
            <p className="mt-1 text-gray-300">
              {placed.packs} packets · {rand(placed.productTotal)} at dealer prices. Thank you!{" "}
              {placed.invoiceNumber
                ? `Invoice ${placed.invoiceNumber} has been emailed to you.`
                : "Your invoice will follow shortly."}
            </p>
          </div>
        )}

        {progress && progress.target > 0 && (
          <div className="mt-6 rounded-2xl border border-green-500/20 bg-black/85 p-5 backdrop-blur-md">
            <p className="text-xs font-bold text-gray-400">THIS PERIOD (INVOICED ORDERS)</p>
            <p className="mt-2 text-2xl font-black text-green-500">
              {progress.packs} / {progress.target} packets
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-green-500"
                style={{ width: `${Math.min((progress.packs / progress.target) * 100, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Period ends {progress.to} · {progress.daysLeft} days left
            </p>
          </div>
        )}

        <input
          type="search"
          placeholder="Search bait or colour..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-8 w-full rounded-xl border border-green-500/30 bg-black/85 px-4 py-3 backdrop-blur-md text-white outline-none focus:border-green-500"
        />

        {hasUsual && (
          <button
            onClick={fillUsual}
            className="mt-4 w-full rounded-xl border border-green-500 bg-black/85 px-4 py-3 backdrop-blur-md text-sm font-black text-green-500 transition hover:bg-green-500 hover:text-black"
          >
            ↻ FILL IN MY USUAL QUANTITIES
          </button>
        )}

        {sections.map((section) => (
        <div key={section.id} className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="rounded-lg bg-black/80 px-3 py-1 text-sm font-black tracking-[0.3em] text-green-500">{section.title}</h2>
            {section.hint && <p className="rounded-lg bg-black/80 px-3 py-1 text-xs text-gray-400">{section.hint}</p>}
          </div>
        <div className="mt-4 grid gap-6">
          {section.groups.map(([name, items]) => (
            <div key={name} className="rounded-2xl border border-green-500/25 bg-black/85 p-4 backdrop-blur-md md:p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-black">{name.toUpperCase()}</h2>
                <p className="text-sm font-black text-green-500">{rand(items[0].price)} / pkt</p>
              </div>
              <ul className="mt-3 divide-y divide-white/5">
                {items.map((p) => {
                  const n = qty[p.sku] || 0;
                  return (
                    <li key={p.sku} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className={`font-bold ${n ? "text-green-500" : "text-gray-200"}`}>{p.colour}</p>
                        <p className="text-xs text-gray-500">
                          {p.sku}
                          {p.price !== items[0].price ? ` · ${rand(p.price)}` : ""}
                          {p.inStock !== null && p.inStock > 0 ? ` · ${p.inStock} in stock` : " · made to order"}
                          {p.usual && p.lastQty > 0 ? ` · last time ${p.lastQty}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => setLine(p.sku, n - 1)}
                          className="h-10 w-10 rounded-lg border border-green-500/30 text-xl font-black text-green-500"
                          aria-label={`One less ${p.colour}`}
                        >
                          −
                        </button>
                        <input
                          inputMode="numeric"
                          value={n || ""}
                          placeholder="0"
                          onChange={(e) => setLine(p.sku, Number(e.target.value.replace(/\D/g, "")))}
                          className="h-10 w-14 rounded-lg border border-green-500/30 bg-black text-center font-black text-white outline-none focus:border-green-500"
                          aria-label={`Packets of ${p.colour}`}
                        />
                        <button
                          onClick={() => setLine(p.sku, n + 1)}
                          className="h-10 w-10 rounded-lg border border-green-500/30 text-xl font-black text-green-500"
                          aria-label={`One more ${p.colour}`}
                        >
                          +
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        </div>
        ))}
        {groupCount === 0 && <p className="mt-8 text-center text-gray-500">Nothing matches that search.</p>}

        <label className="mt-8 block rounded-2xl border border-green-500/25 bg-black/85 p-4 text-xs font-bold text-gray-400 backdrop-blur-md">
          NOTE (OPTIONAL)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Anything we should know: custom colours, when you need it..."
            className="mt-2 w-full rounded-xl border border-green-500/30 bg-black px-4 py-3 text-sm font-normal text-white outline-none focus:border-green-500"
          />
        </label>
      </section>

      {/* Order bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-green-500/30 bg-black/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold text-gray-400">{packs} PACKETS</p>
            <p className="text-2xl font-black text-green-500">{rand(total)}</p>
            {error && <p className="text-xs font-bold text-red-400">{error}</p>}
          </div>
          <button
            onClick={submit}
            disabled={!packs || sending}
            className="rounded-xl bg-green-500 px-6 py-4 font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? "SENDING..." : "SEND ORDER"}
          </button>
        </div>
      </div>
    </main>
  );
}
