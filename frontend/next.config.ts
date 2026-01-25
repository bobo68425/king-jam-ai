import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 啟用 standalone 輸出模式（用於 Docker 部署）
  output: "standalone",
  
  // 圖片優化設定
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
    // Cloud Run 建議使用 unoptimized 或設置 loader
    unoptimized: process.env.NODE_ENV === "production",
  },
  
  // 環境變數
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "https://api.kingjam.app",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || "https://kingjam.app",
  },
  
  // 實驗性功能
  experimental: {
    // 優化套件打包
    optimizePackageImports: ["lucide-react", "framer-motion", "@radix-ui/react-icons"],
  },
};

export default nextConfig;
