import Link from "next/link";
import type { ReactNode } from "react";
import { BUSINESS } from "@/lib/business";
import { LegalFooter } from "./SiteFooter";

// Shared layout for the Terms, Returns and Privacy pages.
export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <main className="min-h-screen bg-black px-6 py-16 text-white md:py-24">
        <article className="mx-auto max-w-3xl">
          <Link
            href="/"
            className="text-sm font-bold tracking-[0.3em] text-gray-400 transition hover:text-green-500"
          >
            ← GERONIMO <span className="text-green-500">BAITS</span>
          </Link>

          <p className="mt-10 text-sm font-bold tracking-[0.4em] text-green-500">{eyebrow}</p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">{title}</h1>
          <p className="mt-3 text-sm text-gray-500">Last updated: {BUSINESS.policiesUpdated}</p>

          <div className="mt-8 text-lg leading-relaxed text-gray-300">{intro}</div>

          <div className="legal-body mt-10 space-y-10 text-base leading-relaxed text-gray-300">
            {children}
          </div>

          <ContactBox />
        </article>
      </main>
      <LegalFooter />
    </>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-black tracking-wide text-green-500">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6 marker:text-green-500">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function ContactBox() {
  return (
    <aside className="mt-14 rounded-2xl border border-green-500/30 bg-green-500/5 p-6 text-sm text-gray-300">
      <p className="font-black tracking-[0.2em] text-green-500">CONTACT US</p>
      <dl className="mt-4 grid gap-2 sm:grid-cols-[10rem_1fr]">
        <dt className="text-gray-500">Business</dt>
        <dd>{BUSINESS.legalName}</dd>
        <dt className="text-gray-500">Trading as</dt>
        <dd>{BUSINESS.tradingName}</dd>
        <dt className="text-gray-500">Address</dt>
        <dd>{BUSINESS.physicalAddress}</dd>
        <dt className="text-gray-500">Email</dt>
        <dd>
          <a href={`mailto:${BUSINESS.email}`} className="text-green-500 hover:underline">
            {BUSINESS.email}
          </a>
        </dd>
        <dt className="text-gray-500">Phone / WhatsApp</dt>
        <dd>
          <a
            href={`https://wa.me/${BUSINESS.whatsappNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-500 hover:underline"
          >
            {BUSINESS.phoneDisplay}
          </a>
        </dd>
      </dl>
    </aside>
  );
}
