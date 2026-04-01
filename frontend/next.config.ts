import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 啟用 standalone 輸出模式（用於 Docker 部署）
  output: "standalone",

  // 暫時禁用 ESLint 和 TypeScript 錯誤檢查（建置時）
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // 圖片優化設定（已開啟自動壓縮 / WebP 轉換 / 尺寸調整）
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.kingjam.app",
      },
      {
        protocol: "https",
        hostname: "pub-dd448be937ca4aaab1aacd75dcb601b4.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },

  // 環境變數
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://api.kingjam.app",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://kingjam.app",
  },

  // 靜態資源快取 Headers
  async headers() {
    return [
      {
        // JS / CSS 等 hashed 靜態檔 — 長期快取 1 年
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // 字型檔 — 長期快取 1 年
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // 圖片 — 30 天快取
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Next.js 圖片優化端點 — 30 天快取
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // API 路由 — 不快取
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate",
          },
        ],
      },
    ];
  },

  // 重定向設定
  async redirects() {
    return [
      {
        source: "/pricing",
        destination: "/#pricing",
        permanent: false,
      },
    ];
  },

  // 代理設定
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.kingjam.app";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/:path*`,
      },
    ];
  },

  // 實驗性功能
  experimental: {
    // 優化套件打包
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-icons"],
  },
};

export default nextConfig;
