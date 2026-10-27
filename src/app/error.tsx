"use client";

import { ErrorScreen } from "@/components/recovery/error-screen";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} retry={reset} />;
}
