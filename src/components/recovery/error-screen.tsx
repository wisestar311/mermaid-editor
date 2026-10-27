"use client";

import { useState } from "react";

import { resetAppFiles } from "./app-reset";

/** Replaces Next's default error page with a way out that works even when stored app files are the problem. */
export function ErrorScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [resetting, setResetting] = useState(false);
  const button = "cursor-pointer rounded-md px-4 py-2 text-sm font-medium";
  return (
    <main lang="ko" className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 p-6 text-slate-900">
      <h1 className="text-2xl font-semibold">페이지를 불러오지 못했습니다</h1>
      <p className="text-sm text-slate-600">
        새 버전이 배포된 직후라면 브라우저에 저장된 이전 파일 때문일 수 있습니다. 아래의 초기화를 누르면 앱 파일만 지우고 최신 버전을 다시 받습니다.
        작성 중인 다이어그램, 기록, 보관함은 지워지지 않습니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${button} bg-[#dd2c5c] text-white disabled:opacity-60`} disabled={resetting}
          onClick={() => { setResetting(true); void resetAppFiles(); }}>
          {resetting ? "초기화 중…" : "앱 파일 초기화 후 다시 열기"}
        </button>
        <button type="button" className={`${button} border border-slate-300`} onClick={retry}>다시 시도</button>
      </div>
      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">오류 내용</summary>
        <pre className="mt-2 whitespace-pre-wrap">{error.message || String(error)}{error.digest ? `\n(${error.digest})` : ""}</pre>
      </details>
    </main>
  );
}
