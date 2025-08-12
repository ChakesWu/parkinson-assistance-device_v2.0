import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 允许 Web Bluetooth（需 HTTPS 或 http://localhost）
          { key: "Permissions-Policy", value: "bluetooth=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
