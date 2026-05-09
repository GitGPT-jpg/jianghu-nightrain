import type { Metadata } from "next";
import { Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const bodyFont = Noto_Sans_SC({
  variable: "--font-body",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const displayFont = Noto_Serif_SC({
  variable: "--font-display",
  weight: ["500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "江湖夜雨十年灯",
  description: "把任务、阶段、恒力与成长系统放进同一套可视化面板里。",
  applicationName: "江湖夜雨十年灯",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "江湖夜雨十年灯",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${bodyFont.variable} ${displayFont.variable}`} suppressHydrationWarning>
      <body className="min-h-screen">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
