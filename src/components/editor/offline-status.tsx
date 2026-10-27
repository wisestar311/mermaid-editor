"use client";
import { useCallback, useEffect, useState } from "react";
import { Button, Dialog } from "./ui";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Progress = { cached: number; total: number };

const enabled = () => "serviceWorker" in navigator && process.env.NODE_ENV === "production";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export type Offline = {
  online: boolean;
  /** "pending" until the core files are cached; "failed" when the worker could not install. */
  phase: "unsupported" | "pending" | "ready" | "failed";
  progress?: Progress;
  downloading: boolean;
  downloadError: boolean;
  update: ServiceWorker | null;
  canInstall: boolean;
  downloadAll: () => void;
  applyUpdate: () => void;
  install: () => void;
};

/** Service worker registration, offline readiness and the install prompt. */
export function useOffline(): Offline {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [phase, setPhase] = useState<Offline["phase"]>(() => (enabled() ? "pending" : "unsupported"));
  const [progress, setProgress] = useState<Progress>();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const [update, setUpdate] = useState<ServiceWorker | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    let disposed = false;
    const network = () => setOnline(navigator.onLine);
    const installer = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
    const installed = () => setInstallEvent(null);
    const onMessage = (event: MessageEvent) => {
      if (disposed) return;
      if (event.data?.type === "OFFLINE_STATUS") {
        setProgress({ cached: event.data.cached, total: event.data.total });
        if (event.data.cached >= event.data.total) setDownloading(false);
      } else if (event.data?.type === "OFFLINE_ERROR") {
        setDownloading(false);
        setDownloadError(true);
      }
    };
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    window.addEventListener("beforeinstallprompt", installer);
    window.addEventListener("appinstalled", installed);
    if (enabled()) {
      navigator.serviceWorker.addEventListener("message", onMessage);
      void navigator.serviceWorker.register(`${BASE}/sw.js`).then((registration) => {
        if (disposed) return;
        let reported = false;
        const refresh = () => {
          if (disposed) return;
          const active = registration.active;
          if (active) {
            setPhase("ready");
            if (!reported) {
              reported = true;
              // Files loaded before the worker took control are cached now, so this visit works offline later.
              const urls = performance.getEntriesByType("resource")
                .map((entry) => new URL(entry.name))
                .filter((url) => url.origin === location.origin && url.pathname.startsWith(`${BASE}/`) && !url.search)
                .map((url) => url.pathname);
              active.postMessage({ type: "CACHE_URLS", urls });
            }
          }
          if (registration.waiting) setUpdate(registration.waiting);
        };
        const watch = () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            refresh();
            if (!disposed && worker.state === "redundant" && !registration.active) setPhase("failed");
          });
        };
        refresh(); watch();
        registration.addEventListener("updatefound", watch);
      }).catch(() => { if (!disposed) setPhase("failed"); });
    }
    return () => {
      disposed = true;
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      window.removeEventListener("beforeinstallprompt", installer);
      window.removeEventListener("appinstalled", installed);
      if (enabled()) navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);

  const downloadAll = useCallback(() => {
    void navigator.serviceWorker.ready.then((registration) => {
      setDownloading(true);
      setDownloadError(false);
      registration.active?.postMessage({ type: "CACHE_ALL" });
    });
  }, []);
  const applyUpdate = useCallback(() => {
    if (!update) return;
    navigator.serviceWorker.addEventListener("controllerchange", () => location.reload(), { once: true });
    update.postMessage("ACTIVATE_UPDATE");
  }, [update]);
  const install = useCallback(() => {
    void installEvent?.prompt().then(() => installEvent.userChoice).then(() => setInstallEvent(null));
  }, [installEvent]);

  return { online, phase, progress, downloading, downloadError, update, canInstall: installEvent !== null, downloadAll, applyUpdate, install };
}

const percent = (progress: Progress) => Math.floor((progress.cached / Math.max(progress.total, 1)) * 100);

/** A status line that only appears while there is something to tell or do. */
export function OfflineBar({ offline, onDetails }: { offline: Offline; onDetails: () => void }) {
  const { online, phase, progress, downloading, update, canInstall } = offline;
  const message = !online ? "오프라인 — 기기에서 편집 중"
    : phase === "pending" ? "오프라인 준비 중…"
    : phase === "failed" ? "오프라인 준비 실패 — 온라인에서 다시 열어주세요"
    : downloading && progress ? `오프라인용 파일 내려받는 중… ${percent(progress)}%`
    : undefined;
  if (!message && !update && !canInstall) return null;
  return <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pb-2 text-xs text-(--ml-muted-foreground) sm:px-6">
    {message && <span role="status">{message}</span>}
    {update && <Button size="sm" variant="outline" onClick={offline.applyUpdate}>새 버전 적용</Button>}
    {canInstall && <Button size="sm" variant="ghost" onClick={offline.install}>앱 설치</Button>}
    <Button size="sm" variant="ghost" onClick={onDetails}>자세히</Button>
  </div>;
}

export function OfflineDialog({ offline, open, onClose }: { offline: Offline; open: boolean; onClose: () => void }) {
  const { phase, progress, downloading, downloadError, canInstall } = offline;
  const complete = progress !== undefined && progress.cached >= progress.total;
  return (
    <Dialog open={open} onClose={onClose} className="w-[min(32rem,95vw)] grid-cols-[minmax(0,1fr)]">
      <h2 className="pr-6 text-xl font-semibold">오프라인 사용과 앱 설치</h2>
      {phase === "unsupported" ? (
        <p className="text-sm">이 환경에서는 오프라인 저장을 사용할 수 없습니다. 배포된 사이트에서 열어주세요.</p>
      ) : (
        <>
          <p className="text-sm">
            {phase === "ready" ? "편집기 기본 기능은 오프라인에서도 열립니다." : phase === "failed" ? "오프라인 준비에 실패했습니다. 인터넷에 연결한 채 다시 열어주세요." : "오프라인 준비 중입니다. 인터넷에 연결된 상태로 잠시 기다려주세요."}
            {" "}처음 쓰는 다이어그램 종류는 인터넷이 있을 때 한 번 열어야 오프라인에서도 그려집니다.
          </p>
          {progress && (
            <div className="grid gap-1 text-sm">
              <div className="h-2 overflow-hidden rounded bg-(--ml-muted)" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent(progress)}>
                <div className="h-full bg-(--ml-accent)" style={{ width: `${percent(progress)}%` }} />
              </div>
              <span>저장된 파일 {progress.cached} / {progress.total}</span>
            </div>
          )}
          <Button disabled={phase !== "ready" || downloading || complete || !offline.online} onClick={offline.downloadAll}>
            {complete ? "모든 기능을 오프라인에 저장함" : downloading ? "내려받는 중…" : "모든 기능 오프라인 저장 (약 26MB)"}
          </Button>
          {downloadError && <p role="alert" className="text-sm text-red-600">일부 파일을 내려받지 못했습니다. 연결을 확인한 뒤 다시 시도하세요.</p>}
        </>
      )}
      {canInstall
        ? <Button variant="outline" onClick={offline.install}>앱 설치</Button>
        : <p className="text-sm">iPhone·iPad에서는 Safari의 공유 메뉴 → 홈 화면에 추가를 선택하세요.</p>}
      <p className="text-xs text-(--ml-muted-foreground)">외부 아이콘, Gist, 외부 렌더러(mermaid.ink·Kroki)는 인터넷이 필요합니다.</p>
    </Dialog>
  );
}
