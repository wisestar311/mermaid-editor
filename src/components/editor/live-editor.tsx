"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";

import { cn } from "@/lib/utils";

import { DiagramView, type DiagramController } from "./diagram-view";
import { useDiagramFile } from "./diagram-file";
import { HistoryPane, useAutoSave } from "./history-pane";
import {
  BookIcon,
  CodeIcon,
  ExpandIcon,
  GearIcon,
  GridIcon,
  MoonIcon,
  PrivacyIcon,
  ResetViewIcon,
  RoughIcon,
  SunIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "./icons";
import { parseDiagram, syncManagedTheme, type ParseResult } from "./mermaid-runtime";
import { MonacoEditor } from "./monaco-editor";
import { Navbar, PrivacyDialog, ShareDialog } from "./navbar";
import { ActionsCard, SamplesCard } from "./panels";
import {
  MERMAID_VERSION,
  buildUrls,
  getDocs,
  loadInitialState,
  persistState,
  serializeState,
  type EditorMode,
  type LiveState,
} from "./state";
import { Button, Card, FloatingToolbar, LinkButton, Separator, Toggle } from "./ui";

import "./pretendard.css";
import "./mermaid-live.css";

const FONT_AWESOME_CSS = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css";
const MODE_KEY = "mermaid-editor:mode";
const PANES_KEY = "mermaid-editor:panes";
const MIN_PANE = 15;

type Mode = "light" | "dark" | "system";

function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferences are optional; ignore storage failures.
  }
}

const darkQuery = "(prefers-color-scheme: dark)";
function subscribeSystemDark(onChange: () => void) {
  const media = window.matchMedia(darkQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

const editorTabs: { id: EditorMode; title: string; icon: React.ReactNode }[] = [
  { id: "code", title: "코드", icon: <CodeIcon /> },
  { id: "config", title: "설정", icon: <GearIcon /> },
];

export function LiveEditor() {
  const rootRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<DiagramController | null>(null);
  const viewPaneRef = useRef<HTMLDivElement>(null);

  const [state, setState] = useState<LiveState>(loadInitialState);
  const [parse, setParse] = useState<ParseResult | null>(null);
  const [diagramType, setDiagramType] = useState<string>();
  // Only code that passed mermaid.parse reaches the view, like mermaid.live's validated state.
  const [validCode, setValidCode] = useState<string>();
  const [mode, setMode] = useState<Mode>(() => (readStorage(MODE_KEY) as Mode | null) ?? "system");
  const systemDark = useSyncExternalStore(subscribeSystemDark, () => window.matchMedia(darkQuery).matches, () => false);
  const dark = mode === "system" ? systemDark : mode === "dark";
  const [width, setWidth] = useState(() => window.innerWidth);
  const [isViewMode, setIsViewMode] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [leftSize, setLeftSize] = useState(() => Number(readStorage(PANES_KEY)) || 30);
  const [historySize, setHistorySize] = useState(30);
  const [shareOpen, setShareOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const isMobile = width < 640;
  const editorMode = state.editorMode ?? "code";
  const serialized = useMemo(() => serializeState(state), [state]);
  const urls = useMemo(() => buildUrls(state, serialized), [state, serialized]);
  const docs = getDocs(diagramType, editorMode);

  useEffect(() => {
    persistState(state);
  }, [state]);

  useAutoSave(state.code);

  // Parse on every code or site-mode change; a valid diagram also syncs the managed theme.
  useEffect(() => {
    let cancelled = false;
    void parseDiagram(state.code).then((result) => {
      if (cancelled) return;
      setParse(result);
      if ("diagramType" in result) {
        setDiagramType(result.diagramType);
        setValidCode(state.code);
        setState((current) => {
          const mermaid = syncManagedTheme(current.mermaid, result.diagramType, dark);
          return mermaid === current.mermaid ? current : { ...current, mermaid };
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [state.code, dark]);

  useEffect(() => {
    const element = layoutRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);


  const configValid = useMemo(() => {
    try {
      JSON.parse(state.mermaid);
      return true;
    } catch {
      return false;
    }
  }, [state.mermaid]);
  const hasError = (parse !== null && "error" in parse) || !configValid;
  const editorError = useMemo(
    () => (parse && "error" in parse ? { message: parse.error, line: parse.line } : undefined),
    [parse],
  );

  const update = (patch: Partial<LiveState>) => setState((current) => ({ ...current, ...patch }));

  // Full Screen shows only the diagram pane, in place of mermaid.live's separate /view page.
  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void viewPaneRef.current?.requestFullscreen();
  };

  const toggleDark = () => {
    const next = dark ? "light" : "dark";
    setMode(next);
    writeStorage(MODE_KEY, next);
  };


  const effectiveLeft = isMobile ? 50 : leftSize;
  const showHistory = historyOpen && !isMobile;
  const middleSize = 100 - effectiveLeft - (showHistory ? historySize : 0);

  const startResize = (pane: "left" | "history") => (event: ReactPointerEvent<HTMLDivElement>) => {
    const group = groupRef.current;
    if (!group) return;
    event.preventDefault();
    const startX = event.clientX;
    const startLeft = leftSize;
    const startHistory = historySize;
    const style = getComputedStyle(group);
    const innerWidth = group.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const onMove = (moveEvent: PointerEvent) => {
      const delta = ((moveEvent.clientX - startX) / innerWidth) * 100;
      if (pane === "left") {
        const max = 100 - MIN_PANE - (showHistory ? startHistory : 0);
        const next = Math.min(max, Math.max(MIN_PANE, startLeft + delta));
        setLeftSize(next);
        writeStorage(PANES_KEY, String(next));
      } else {
        const max = 100 - MIN_PANE - startLeft;
        setHistorySize(Math.min(max, Math.max(MIN_PANE, startHistory - delta)));
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Loading a sample or history entry starts from a freshly fitted view.
  const loadCode = (code: string) => update({ code, updateDiagram: true, pan: undefined, zoom: undefined });
  const file = useDiagramFile(state.code, loadCode);

  return (
    <div
      ref={rootRef}
      lang="ko"
      className={cn("mermaid-live fixed inset-0 flex h-dvh flex-col overflow-hidden", dark && "dark")}
    >
      <link rel="stylesheet" href={FONT_AWESOME_CSS} precedence="default" />
      <Navbar
        isMobile={isMobile}
        isViewMode={isViewMode}
        onViewModeChange={setIsViewMode}
        historyOpen={historyOpen}
        onHistoryChange={setHistoryOpen}
        onShare={() => setShareOpen(true)}
        newHref={urls.newDiagram}
        dark={dark}
        onToggleDark={toggleDark}
        file={file}
      />
      <div ref={layoutRef} className="flex flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            "size-full",
            isMobile && "w-[200%] transition-transform duration-300",
            isMobile && isViewMode && "-translate-x-1/2",
          )}
        >
          <div ref={groupRef} className="flex h-full w-full gap-4 overflow-hidden p-2 pt-0 sm:gap-0 sm:p-6 sm:pt-0">
            <div className="overflow-hidden" style={{ flex: `${effectiveLeft} 1 0px` }}>
              <div className="flex h-full flex-col gap-4 sm:gap-6">
                <Card
                  isOpen
                  header={
                    <div className="flex w-fit cursor-default items-center gap-2">
                      <ul className="flex gap-2 align-middle">
                        {editorTabs.map((tab, index) => (
                          <li key={tab.id} className="flex gap-2">
                            <Button
                              role="tab"
                              variant="ghost"
                              aria-selected={editorMode === tab.id}
                              className={cn(
                                "px-2",
                                editorMode === tab.id && "rounded-b-none border-b-2 border-b-(--ml-primary-foreground)/50",
                              )}
                              onClick={(event) => {
                                event.stopPropagation();
                                update({ editorMode: tab.id });
                              }}
                            >
                              {tab.icon}
                              {tab.title}
                            </Button>
                            {index < editorTabs.length - 1 && (
                              <div className="my-2">
                                <Separator className="w-0.5 bg-slate-300" />
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  }
                  actions={
                    <LinkButton
                      variant="ghost"
                      href={docs.url}
                      target="_blank"
                      rel="noreferrer"
                      title={docs.label === "config" ? "설정 문서 보기" : `${docs.label} 다이어그램 문서 보기`}
                    >
                      <BookIcon />
                      문서
                    </LinkButton>
                  }
                  bodyClassName="relative"
                >
                  <div className="absolute inset-0">
                    <MonacoEditor
                      mode={editorMode}
                      code={state.code}
                      config={state.mermaid}
                      dark={dark}
                      error={editorError}
                      onChange={(mode, value) => update(mode === "code" ? { code: value } : { mermaid: value })}
                    />
                  </div>
                </Card>
                <div className="group flex flex-wrap justify-between gap-4 sm:gap-6">
                  <SamplesCard onLoad={loadCode} />
                  <ActionsCard
                    controllerRef={controllerRef}
                    setExporting={setExporting}
                    backgroundColor={() =>
                      rootRef.current ? getComputedStyle(rootRef.current).getPropertyValue("--ml-background").trim() : "#fff"
                    }
                    urls={urls}
                    onLoadCode={loadCode}
                  />
                </div>
              </div>
            </div>
            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={startResize("left")}
              className="mr-1 hidden w-px shrink-0 cursor-ew-resize touch-none opacity-0 select-none sm:block"
            />
            <div ref={viewPaneRef} className="relative flex h-full flex-col overflow-hidden bg-(--ml-background)" style={{ flex: `${isMobile ? 50 : middleSize} 1 0px` }}>
              <DiagramView
                code={validCode}
                config={state.mermaid}
                rough={state.rough}
                grid={state.grid}
                panZoom={state.panZoom && !exporting}
                pan={state.pan}
                zoom={state.zoom}
                onPanZoomChange={(pan, zoom) => update({ pan, zoom })}
                dark={dark}
                hasError={hasError}
                controllerRef={controllerRef}
              />
              <div className="absolute top-0 right-0">
                <FloatingToolbar>
                  <Button variant="ghost" size="icon" title="보기 초기화" onClick={() => controllerRef.current?.reset()}>
                    <ResetViewIcon />
                  </Button>
                  <Separator />
                  <Button variant="ghost" size="icon" className="hidden sm:block" title="축소" onClick={() => controllerRef.current?.zoomOut()}>
                    <ZoomOutIcon />
                  </Button>
                  <Button variant="ghost" size="icon" className="hidden sm:block" title="확대" onClick={() => controllerRef.current?.zoomIn()}>
                    <ZoomInIcon />
                  </Button>
                  <Separator className="hidden sm:block" />
                  <Button variant="ghost" size="icon" title="전체 화면" onClick={toggleFullscreen}>
                    <ExpandIcon />
                  </Button>
                </FloatingToolbar>
              </div>
              <div className="absolute right-0 bottom-0">
                <FloatingToolbar>
                  <span className="text-sm font-semibold opacity-60">v{MERMAID_VERSION}</span>
                  <Button variant="ghost" size="icon" title="개인정보 및 보안" onClick={() => setPrivacyOpen(true)}>
                    <PrivacyIcon />
                  </Button>
                  <Separator />
                  <Button
                    variant="ghost"
                    size="icon"
                    title={`${dark ? "라이트" : "다크"} 테마로 전환`}
                    className="[&_svg]:size-5"
                    onClick={toggleDark}
                  >
                    {dark ? <MoonIcon /> : <SunIcon />}
                  </Button>
                </FloatingToolbar>
              </div>
              <div className="absolute bottom-0 left-0 sm:left-5">
                <FloatingToolbar>
                  <Toggle pressed={state.rough} onPressedChange={(rough) => update({ rough })} title="손그림 스타일">
                    <RoughIcon />
                  </Toggle>
                  <Toggle pressed={state.grid} onPressedChange={(grid) => update({ grid })} title="배경 격자">
                    <GridIcon />
                  </Toggle>
                </FloatingToolbar>
              </div>
            </div>
            {showHistory && (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onPointerDown={startResize("history")}
                  className="ml-1 hidden w-px shrink-0 cursor-ew-resize touch-none opacity-0 select-none sm:block"
                />
                <div className="hidden h-full grow flex-col sm:flex" style={{ flex: `${historySize} 1 0px` }}>
                  <HistoryPane code={state.code} onRestore={loadCode} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} />
      <PrivacyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </div>
  );
}
