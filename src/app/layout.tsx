import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "任务小帮手",
  description: "学习任务、材料准备与专注计时。",
  icons: { icon: `${process.env.NEXT_PUBLIC_TOOL_BASE || ""}/icon.svg` },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf8f2",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

