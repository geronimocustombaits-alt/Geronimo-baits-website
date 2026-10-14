import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root to this folder. Without this, a stray
  // package-lock.json in C:\Users\USER-PC makes Next.js treat the whole user
  // folder as the project, watch it, and rebuild over and over.
  turbopack: {
    root: __dirname,
  },
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
