import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Optional: proxy /api/* to the FastAPI backend in local development.
  // Set NEXT_PUBLIC_BACKEND_URL in .env.local instead if you prefer direct calls.
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      "http://localhost:8000";

    // Only proxy if ENABLE_PROXY=true; by default, the frontend calls the backend directly
    if (process.env.ENABLE_PROXY !== "true") return [];

    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
