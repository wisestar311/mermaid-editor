import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mermaid 에디터",
  description: "로그인 없이 브라우저에서 Mermaid 다이어그램을 그리고 파일로 저장하는 에디터입니다.",
  icons: { icon: { url: "/icons/favicon.svg", type: "image/svg+xml" } },
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
