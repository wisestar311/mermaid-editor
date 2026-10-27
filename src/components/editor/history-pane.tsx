"use client";

import { GitCompare, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { HistoryIcon } from "./icons";
import { MonacoDiff } from "./monaco-editor";
import { Button, Dialog } from "./ui";

export type HistoryEntry = { id: string; time: number; code: string; type: "auto" | "manual" };

const HISTORY_KEY = "mermaid-editor:history";
const MAX_AUTO_ENTRIES = 30;
const AUTO_SAVE_DELAY = 5000;

function readHistory(): HistoryEntry[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is HistoryEntry =>
      entry !== null && typeof entry === "object" && typeof entry.id === "string" &&
      typeof entry.time === "number" && Number.isFinite(entry.time) && typeof entry.code === "string" &&
      (entry.type === "auto" || entry.type === "manual"),
    );
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  } catch {
    // History is a convenience; storage failures only lose old snapshots.
  }
}

export function addHistoryEntry(code: string, type: HistoryEntry["type"]) {
  const entries = readHistory();
  if (entries[0]?.code === code && entries[0].type === type) return entries;
  const next = [{ id: crypto.randomUUID(), time: Date.now(), code, type }, ...entries];
  const autos = next.filter((entry) => entry.type === "auto").slice(0, MAX_AUTO_ENTRIES);
  const trimmed = next.filter((entry) => entry.type === "manual" || autos.includes(entry));
  writeHistory(trimmed);
  window.dispatchEvent(new Event("mermaid-editor:history"));
  return trimmed;
}

/** Records a Timeline snapshot after the code has been idle for a few seconds. */
export function useAutoSave(code: string) {
  useEffect(() => {
    const timer = window.setTimeout(() => addHistoryEntry(code, "auto"), AUTO_SAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [code]);
}

export function HistoryPane({ code, dark, onRestore }: { code: string; dark: boolean; onRestore: (code: string) => void }) {
  const [tab, setTab] = useState<HistoryEntry["type"]>("manual");
  const [comparing, setComparing] = useState<HistoryEntry | null>(null);
  const [entries, setEntries] = useState(readHistory);

  useEffect(() => {
    const refresh = () => setEntries(readHistory());
    window.addEventListener("mermaid-editor:history", refresh);
    return () => window.removeEventListener("mermaid-editor:history", refresh);
  }, []);

  const visible = entries.filter((entry) => entry.type === tab);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-(--ml-muted)">
      <div className="flex h-11 flex-none items-center justify-between gap-2 bg-(--ml-muted) p-2">
        <span className="flex items-center gap-3">
          <HistoryIcon />
          기록
        </span>
        <div className="flex gap-1">
          {(["manual", "auto"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant="ghost"
              className={cn(tab === value && "bg-(--ml-primary) text-(--ml-primary-foreground)")}
              onClick={() => setTab(value)}
            >
              {value === "manual" ? "저장됨" : "타임라인"}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex grow flex-col gap-2 overflow-y-auto p-2">
        {tab === "manual" && (
          <Button size="sm" onClick={() => setEntries(addHistoryEntry(code, "manual"))}>
            현재 다이어그램 저장
          </Button>
        )}
        {visible.length === 0 && (
          <p className="p-2 text-sm text-(--ml-muted-foreground)">
            {tab === "manual" ? "아직 저장한 다이어그램이 없습니다." : "편집 내용이 여기에 자동으로 기록됩니다."}
          </p>
        )}
        {visible.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2 rounded-xl bg-(--ml-muted) p-2">
            <button type="button" className="grow cursor-pointer text-left" onClick={() => onRestore(entry.code)}>
              <span className="block text-xs text-(--ml-muted-foreground)">{new Date(entry.time).toLocaleString("ko-KR")}</span>
              <span className="block truncate font-mono text-xs">{entry.code.split("\n")[0]}</span>
            </button>
            <Button size="icon" variant="ghost" title="현재 코드와 비교" aria-label="현재 코드와 비교" onClick={() => setComparing(entry)}>
              <GitCompare className="size-4!" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="삭제"
              onClick={() => {
                const next = readHistory().filter((item) => item.id !== entry.id);
                writeHistory(next);
                setEntries(next);
              }}
            >
              <Trash2 className="size-4!" />
            </Button>
          </div>
        ))}
      </div>
      <Dialog open={comparing !== null} onClose={() => setComparing(null)} className="w-[min(72rem,95vw)] max-w-none grid-cols-[minmax(0,1fr)]">
        {comparing && (
          <>
            <h2 className="pr-6 text-xl font-semibold">기록 비교</h2>
            <div className="grid grid-cols-2 text-sm text-(--ml-muted-foreground)">
              <span>기록: {new Date(comparing.time).toLocaleString("ko-KR")}</span>
              <span>현재 코드</span>
            </div>
            {comparing.code === code
              ? <p className="py-8 text-center text-sm">현재 코드와 같습니다.</p>
              : <div className="h-[65dvh] overflow-hidden rounded border border-(--ml-border)"><MonacoDiff original={comparing.code} modified={code} dark={dark} /></div>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setComparing(null)}>닫기</Button>
              <Button onClick={() => { onRestore(comparing.code); setComparing(null); }}>이 기록으로 복원</Button>
            </div>
          </>
        )}
      </Dialog>
    </div>
  );
}
