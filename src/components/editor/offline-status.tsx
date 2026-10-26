"use client";
import { useEffect, useState } from "react";
import { Button } from "./ui";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function OfflineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [status, setStatus] = useState(() => "serviceWorker" in navigator && process.env.NODE_ENV === "production" ? "오프라인 준비 중…" : "온라인 모드");
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  useEffect(() => {
    let disposed = false;
    const network = () => setOnline(navigator.onLine);
    const installer = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const installed = () => setInstall(null);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("beforeinstallprompt", installer);
    window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/sw.js`).then((registration) => {
        if (disposed) return;
        const refresh = () => {
          if (disposed) return;
          if (registration.active) setStatus("오프라인 사용 준비됨");
          if (registration.waiting) setUpdate(registration.waiting);
        };
        const watch = () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            refresh();
            if (!disposed && worker.state === "redundant" && !registration.active) setStatus("오프라인 준비 실패 — 온라인에서 다시 열어주세요");
          });
        };
        refresh(); watch();
        registration.addEventListener("updatefound", watch);
      }).catch(() => { if (!disposed) setStatus("오프라인 저장을 사용할 수 없습니다"); });
    }
    return () => {
      disposed = true;
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("beforeinstallprompt", installer);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-2 text-xs text-(--ml-muted-foreground) sm:px-6">
    <span role="status">{online ? status : "오프라인 — 기기에서 편집 중"}</span>
    {update && <Button size="sm" variant="outline" onClick={() => {
      navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
      update.postMessage("ACTIVATE_UPDATE");
    }}>새 버전 적용</Button>}
    {install ? <Button size="sm" variant="ghost" onClick={() => {
      void install.prompt().then(() => install.userChoice).then(() => setInstall(null));
    }}>앱 설치</Button> : <details><summary className="cursor-pointer">설치·오프라인 안내</summary><p className="max-w-xl py-2">iPhone·iPad에서는 Safari의 공유 메뉴 → 홈 화면에 추가를 선택하세요. 처음에는 인터넷에 연결한 채 ‘오프라인 사용 준비됨’을 기다려주세요. 외부 아이콘, Gist, 외부 렌더러는 인터넷이 필요합니다.</p></details>}
  </div>;
}
