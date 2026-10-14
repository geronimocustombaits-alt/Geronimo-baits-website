import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const description =
  "Hand-poured soft plastic bass baits, made in South Africa. Apache Sticks, Warcraws, Warvipers and Warbombs — built to hunt. Delivered to your nearest PUDO locker.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Geronimo Baits | Handmade Soft Plastic Baits, South Africa",
    template: "%s | Geronimo Baits",
  },
  description,
  keywords: [
    "soft plastic baits",
    "bass fishing South Africa",
    "handmade fishing lures",
    "Geronimo Baits",
    "bass lures",
  ],
  openGraph: {
    type: "website",
    locale: "en_ZA",
    siteName: "Geronimo Baits",
    title: "Geronimo Baits | Built to Hunt",
    description,
    images: [{ url: "/og-image.jpg", width: 1200, height: 630, alt: "Geronimo Baits" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Geronimo Baits | Built to Hunt",
    description,
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
