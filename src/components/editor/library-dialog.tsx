"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { exportLibrary, filterLibrary, LIBRARY_KEY, mergeLibrary, parseLibrary, parseLibraryExport, type LibraryItem } from "./library-store";
import type { LiveState } from "./state";
import { Button, Dialog } from "./ui";

const snapshot = (state: LiveState): LibraryItem["state"] =>
  ({ code: state.code, mermaid: state.mermaid, rough: state.rough, grid: state.grid });

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.download = name;
  anchor.href = url;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LibraryDialog({ state, thumbnail, onLoad, onClose }: {
  state: LiveState;
  /** A preview of the current diagram, or undefined when it cannot be drawn. */
  thumbnail: () => Promise<string | undefined>;
  onLoad: (state: LibraryItem["state"]) => void;
  onClose: () => void;
}) {
  const [initial] = useState(() => {
    try { return { items: parseLibrary(localStorage.getItem(LIBRARY_KEY)), error: "" }; }
    catch (error) { return { items: [], error: String(error) }; }
  });
  const [items, setItems] = useState<LibraryItem[]>(initial.items);
  const [error, setError] = useState(initial.error);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const change = (transform: (current: LibraryItem[]) => LibraryItem[]) => {
    try {
      // Read again so another tab's recent changes are not overwritten.
      const next = transform(parseLibrary(localStorage.getItem(LIBRARY_KEY)));
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
      setItems(next);
      setError("");
      return true;
    } catch (error) {
      setError(`보관함에 저장하지 못했습니다. ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  const capture = async () => {
    setBusy(true);
    try {
      return await thumbnail();
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file: File) => {
    try {
      const incoming = parseLibraryExport(await file.text());
      let result: ReturnType<typeof mergeLibrary> | undefined;
      if (change((current) => (result = mergeLibrary(current, incoming)).items) && result) {
        setNotice(`가져오기 완료: 새 항목 ${result.added}개, 갱신 ${result.updated}개, 건너뜀 ${result.skipped}개`);
      }
    } catch (error) {
      setError(`가져오지 못했습니다. ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const visible = filterLibrary(items, query, favorites);

  return (
    <Dialog open onClose={onClose} className="w-[min(40rem,95vw)] max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto p-4 sm:p-6">
      <h2 className="pr-6 text-xl font-semibold">다이어그램 보관함</h2>
      <p className="text-sm text-(--ml-muted-foreground)">이 브라우저에 코드와 설정을 보관합니다. 브라우저 데이터를 지우면 사라지니 가끔 백업 파일로 내보내세요.</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!items.length} onClick={() => {
          const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
          downloadText(`mermaid-library-${date}.json`, exportLibrary(items));
          setNotice(`${items.length}개 항목을 백업 파일로 내보냈습니다.`);
        }}><Download className="size-4" /> 백업 내보내기</Button>
        <Button size="sm" variant="outline" onClick={() => importRef.current?.click()}><Upload className="size-4" /> 백업 가져오기</Button>
        <input ref={importRef} type="file" accept=".json,application/json" className="hidden" aria-label="보관함 백업 파일" onChange={(event) => {
          const selected = event.target.files?.[0];
          event.target.value = "";
          if (selected) void importFile(selected);
        }} />
      </div>
      <form className="flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        const trimmed = name.trim();
        if (!trimmed || busy) return;
        void capture().then((preview) => {
          const item: LibraryItem = { id: crypto.randomUUID(), name: trimmed, favorite: false, updatedAt: Date.now(), state: snapshot(state), thumbnail: preview };
          if (change((current) => [item, ...current])) { setName(""); setNotice("현재 다이어그램을 보관했습니다."); }
        });
      }}>
        <input aria-label="새 다이어그램 이름" placeholder="다이어그램 이름" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 grow rounded border p-2" />
        <Button type="submit" disabled={busy}>{busy ? "보관 중…" : "현재 작업 보관"}</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <input aria-label="보관함 검색" placeholder="이름·코드 검색" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 grow rounded border p-2" />
        <Button aria-pressed={favorites} onClick={() => setFavorites(!favorites)}>{favorites ? "★ 즐겨찾기만" : "☆ 전체 보기"}</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <p role="status" className="text-sm">{notice}</p>
      <ul className="space-y-3">
        {visible.map((item) => (
          <li key={item.id} className="flex gap-3 rounded-lg border border-(--ml-border) p-3">
            <button type="button" title={`${item.name} 열기`} onClick={() => { onLoad(item.state); onClose(); }}
              className="flex h-16 w-20 shrink-0 cursor-pointer sm:h-20 sm:w-28 items-center justify-center overflow-hidden rounded border border-(--ml-border) bg-white">
              {item.thumbnail
                // eslint-disable-next-line @next/next/no-img-element -- data URL preview, not an optimizable asset
                ? <img src={item.thumbnail} alt="" className="max-h-full max-w-full object-contain" />
                : <span className="px-1 text-center font-mono text-[10px] text-slate-500">{item.state.code.trim().split("\n")[0].slice(0, 40)}</span>}
            </button>
            <div className="min-w-0 grow">
              <div className="flex items-center gap-2">
                <Button size="icon" aria-label={`${item.name} 즐겨찾기`} aria-pressed={item.favorite} onClick={() => change((current) => current.map((entry) => entry.id === item.id ? { ...entry, favorite: !entry.favorite } : entry))}>{item.favorite ? "★" : "☆"}</Button>
                <span className="min-w-0 grow truncate font-semibold" title={item.name}>{item.name}</span>
                <Button size="sm" onClick={() => { onLoad(item.state); onClose(); }}>열기</Button>
              </div>
              <p className="my-2 text-xs text-(--ml-muted-foreground)">{new Date(item.updatedAt).toLocaleString("ko-KR")}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  const next = window.prompt("새 이름", item.name)?.trim();
                  if (next) change((current) => current.map((entry) => entry.id === item.id ? { ...entry, name: next.slice(0, 120) } : entry));
                }}>이름 변경</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                  if (!window.confirm(`“${item.name}” 항목을 현재 코드와 설정으로 바꿀까요?`)) return;
                  void capture().then((preview) => change((current) => current.map((entry) => entry.id === item.id
                    ? { ...entry, state: snapshot(state), thumbnail: preview, updatedAt: Date.now() } : entry)));
                }}>현재 작업으로 갱신</Button>
                <Button size="sm" variant="ghost" onClick={() => {
                  if (window.confirm(`“${item.name}” 항목을 보관함에서 삭제할까요?`)) change((current) => current.filter((entry) => entry.id !== item.id));
                }}>삭제</Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!visible.length && <p className="py-6 text-center text-sm">표시할 다이어그램이 없습니다.</p>}
    </Dialog>
  );
}
