import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/terms", label: "TERMS" },
  { href: "/returns", label: "RETURNS" },
  { href: "/privacy", label: "PRIVACY" },
];

// Small row of policy links. Used inside the full footer and on its own at the
// bottom of pages that don't have the full footer (shop, remelts, payment pages).
export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <nav
      aria-label="Shop policies"
      className={`flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-bold tracking-[0.2em] text-gray-400 ${className}`}
    >
      {LEGAL_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="transition hover:text-green-500">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

// Slim footer for pages without the big home-page footer.
export function LegalFooter() {
  return (
    <footer className="border-t border-green-500/20 bg-black px-6 py-8 text-center">
      <LegalLinks />
      <p className="mt-4 text-xs text-gray-600">© 2026 Geronimo Baits · Built to Hunt.</p>
    </footer>
  );
}
