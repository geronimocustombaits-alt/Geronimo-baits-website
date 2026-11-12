"use client";

// Shared header + menu for every back office screen.

const LINKS = [
  { href: "/admin", label: "ORDERS" },
  { href: "/admin/make", label: "MAKE" },
  { href: "/admin/production", label: "PRODUCTION" },
  { href: "/admin/stock", label: "STOCK" },
  { href: "/admin/sales", label: "SALES" },
  { href: "/admin/recap", label: "RECAP" },
  { href: "/admin/ambassadors", label: "AMBASSADORS" },
  { href: "/admin/scan", label: "📷 SCANNER" },
];

export default function AdminNav({
  current,
  title,
  subtitle,
}: {
  current: string;
  title: string;
  subtitle?: string;
}) {
  async function logout() {
    await fetch("/api/admin/login", { method: "DELETE" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="mb-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-black tracking-[0.4em] text-green-500">GERONIMO BAITS</p>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">{title}</h1>
          {subtitle && <p className="mt-3 text-gray-400">{subtitle}</p>}
        </div>
        <button
          onClick={logout}
          className="self-start rounded-xl border border-red-500/60 px-5 py-2 text-sm font-bold text-red-400 transition hover:bg-red-500 hover:text-black"
        >
          LOG OUT
        </button>
      </div>
      <nav className="mt-6 flex gap-2 overflow-x-auto pb-1">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-black tracking-wider transition ${
              current === link.href
                ? "bg-green-500 text-black"
                : "border border-green-500/30 text-green-500 hover:border-green-500"
            }`}
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
