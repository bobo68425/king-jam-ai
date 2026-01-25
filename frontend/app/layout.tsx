import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans_TC, Noto_Serif_TC } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { AIAssistant } from "@/components/ai-assistant";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 繁體中文字型（Google Fonts - 免費商用）
const notoSansTC = Noto_Sans_TC({
  variable: "--font-noto-sans-tc",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
});

const notoSerifTC = Noto_Serif_TC({
  variable: "--font-noto-serif-tc",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "King Jam AI - 智慧內容創作平台",
  description: "AI 驅動的智慧內容創作與社群管理平台，一站式生成文章、圖文、短影片，輕鬆征服各大社群平台",
  keywords: ["AI", "內容創作", "社群管理", "文章生成", "短影片", "圖文設計", "自媒體工具"],
  authors: [{ name: "King Jam AI" }],
  metadataBase: new URL("https://kingjam.app"),
  openGraph: {
    title: "King Jam AI - 智慧內容創作平台",
    description: "AI 驅動的智慧內容創作與社群管理平台，讓你的創作效率提升 10 倍",
    url: "https://kingjam.app",
    siteName: "King Jam AI",
    locale: "zh_TW",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "King Jam AI - 智慧內容創作平台",
    description: "AI 驅動的智慧內容創作與社群管理平台",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} ${notoSerifTC.variable} antialiased bg-background text-foreground font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange={false}
        >
          {children}
          <AIAssistant />
        </ThemeProvider>
      </body>
    </html>
  );
}
