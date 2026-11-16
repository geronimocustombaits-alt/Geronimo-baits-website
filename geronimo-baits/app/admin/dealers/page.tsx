"use client";

import { useEffect, useState } from "react";
import AdminNav from "../AdminNav";
import { sheetAction } from "@/lib/sheetAction";

// Each shop on the Retailers tab gets a private order link. Send it to the
// shop once; their orders then land on the Orders dashboard as Dealer orders.
// Add a shop (and its contact, phone, email, delivery) on the Retailers tab.

type Dealer = { name: string; code: string; contactName: string; phone: string };

// "082 123 4567" or "+27 82…" → 2782…
const waNumber = (phone: string) => {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.startsWith("0") ? `27${digits.slice(1)}` : digits;
};

export default function DealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    sheetAction<{ dealers: Dealer[] }>("getDealers").then((data) => {
      if (!data.success) setError(data.error || "Couldn't load dealers");
      else setDealers(data.dealers || []);
      setLoading(false);
    });
  }, []);

  const linkFor = (d: Dealer) => `${origin}/dealer/${d.code}`;

  async function copy(d: Dealer) {
    try {
      await navigator.clipboard.writeText(linkFor(d));
      setCopied(d.code);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      window.prompt("Copy this link:", linkFor(d));
    }
  }

  function whatsapp(d: Dealer) {
    const hi = d.contactName ? `Hi ${d.contactName.split(" ")[0]}` : "Hi";
    const text =
      `${hi}, here's your Geronimo Baits order link for ${d.name}: ${linkFor(d)}\n\n` +
      "Just type the number of packets per colour and press Send. It shows dealer prices and your packets for this period. " +
      "Keep the link for every order.";
    const number = waNumber(d.phone);
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <main className="admin-bg min-h-screen px-4 py-10 text-white md:px-6">
      <section className="mx-auto max-w-7xl">
        <AdminNav
          current="/admin/dealers"
          title="DEALERS"
          subtitle="Private order links for your shops. Their orders show on the Orders dashboard as Dealer orders."
        />

        {error && (
          <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
            {error}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-green-500/20 p-8 text-center text-gray-400">Loading dealers...</div>
        ) : dealers.length === 0 ? (
          <div className="rounded-2xl border border-green-500/20 p-8 text-center text-gray-400">
            No shops yet. Add one on the Retailers tab of the sheet (Zoho customer name in column A).
          </div>
        ) : (
          <div className="grid gap-4">
            {dealers.map((d) => (
              <div key={d.code} className="rounded-2xl border border-green-500/20 bg-black p-5">
                <h3 className="text-2xl font-black">{d.name}</h3>
                <p className="text-sm text-gray-500">
                  {[d.contactName, d.phone].filter(Boolean).join(" · ") || "Add a contact and phone on the Retailers tab"}
                </p>
                <p className="mt-3 break-all rounded-xl border border-green-500/10 bg-black/70 px-4 py-3 font-mono text-sm text-green-500">
                  {linkFor(d)}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => copy(d)}
                    className="rounded-xl border border-green-500/40 px-4 py-3 text-sm font-black text-green-500 transition hover:bg-green-500 hover:text-black"
                  >
                    {copied === d.code ? "COPIED ✓" : "COPY LINK"}
                  </button>
                  <button
                    onClick={() => whatsapp(d)}
                    className="rounded-xl bg-green-500 px-4 py-3 text-sm font-black text-black transition hover:bg-green-400"
                  >
                    SEND ON WHATSAPP
                  </button>
                  <a
                    href={linkFor(d)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-white/30 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-black"
                  >
                    OPEN FORM
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
