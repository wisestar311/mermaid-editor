"use client";

import "./globals.css";

import { ErrorScreen } from "@/components/recovery/error-screen";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="ko">
      <body>
        <ErrorScreen error={error} retry={() => location.reload()} />
      </body>
    </html>
  );
}
