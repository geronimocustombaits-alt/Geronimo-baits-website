import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root to this folder. Without this, a stray
  // package-lock.json in C:\Users\USER-PC makes Next.js treat the whole user
  // folder as the project, watch it, and rebuild over and over.
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,

  // Lets the dev server be opened through a temporary Cloudflare tunnel
  // (https://….trycloudflare.com) or from a phone on the home Wi-Fi, for
  // testing the phone scanner. Only affects `npm run dev`, not the live site.
  allowedDevOrigins: ["*.trycloudflare.com", "192.168.*.*"],
};

export default nextConfig;
