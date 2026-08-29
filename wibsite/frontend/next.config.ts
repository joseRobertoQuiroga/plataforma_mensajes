import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    // En producción (Docker) el frontend llama a /api/* que Nginx proxea al helper.
    // En desarrollo local el helper está en localhost:3100 directo.
    const helper = process.env.NEXT_PUBLIC_HELPER_URL || "http://localhost:3100";
    if (helper === "/api") {
      return [];
    }
    return [
      { source: "/api/:path*", destination: `${helper}/api/:path*` },
      { source: "/webhooks/:path*", destination: `${helper}/webhooks/:path*` },
    ];
  },
};

export default nextConfig;
