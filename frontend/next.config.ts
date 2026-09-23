import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${process.env.BACKEND_URL || "http://127.0.0.1:8800"}/auth/:path*` },
      { source: "/api/together", destination: `${process.env.BACKEND_URL || "http://127.0.0.1:8800"}/together` },
      { source: "/api/together/:path*", destination: `${process.env.BACKEND_URL || "http://127.0.0.1:8800"}/together/:path*` },
      { source: "/api/travel/:path*", destination: `${process.env.BACKEND_URL || "http://127.0.0.1:8800"}/travel/:path*` },
    ];
  },
};

export default nextConfig;
