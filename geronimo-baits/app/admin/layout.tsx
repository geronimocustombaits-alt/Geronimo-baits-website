import type { Metadata } from "next";

// Makes the back office installable as its own app (desktop / home-screen
// icon that opens straight into /admin in its own window).
export const metadata: Metadata = {
  title: "Geronimo Back Office",
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "Geronimo BO", statusBarStyle: "black" },
  icons: { apple: "/admin-icon-192.png" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
