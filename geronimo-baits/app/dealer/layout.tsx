import type { Metadata } from "next";

// Dealer order links are private: keep them out of search engines.
export const metadata: Metadata = {
  title: "Dealer orders | Geronimo Baits",
  robots: { index: false, follow: false },
};

export default function DealerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
