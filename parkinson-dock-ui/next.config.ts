import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 在生产构建时忽略 ESLint/TS 错误，避免因样式或类型阻断部署
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
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
