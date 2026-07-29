import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  headers: async () => [
    {
      // The service worker must be allowed to control the whole origin.
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

export default nextConfig;
