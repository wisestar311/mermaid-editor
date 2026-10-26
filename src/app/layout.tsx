import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mermaid 에디터",
  manifest: `${process.env.BASE_PATH || ""}/manifest.webmanifest`,
  appleWebApp: { capable: true, title: "Mermaid 에디터", statusBarStyle: "default" },
  icons: { apple: `${process.env.BASE_PATH || ""}/pwa-192.png` },
  description: "로그인 없이 브라우저에서 Mermaid 다이어그램을 그리고 파일로 저장하는 에디터입니다.",
};

export const viewport: Viewport = {
  themeColor: "#ff3670",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
