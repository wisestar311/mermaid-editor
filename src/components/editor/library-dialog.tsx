"use client";

import { useState } from "react";
import { filterLibrary, LIBRARY_KEY, parseLibrary, type LibraryItem } from "./library-store";
import type { LiveState } from "./state";
import { Button, Dialog } from "./ui";

export function LibraryDialog({ state, onLoad, onClose }: {
  state: LiveState; onLoad: (state: LibraryItem["state"]) => void; onClose: () => void;
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

  return (
    <Dialog open onClose={onClose} className="w-[min(40rem,95vw)] max-h-[90dvh] overflow-y-auto p-6">
      <h2 className="pr-6 text-xl font-semibold">다이어그램 보관함</h2>
      <p className="text-sm text-(--ml-muted-foreground)">이 브라우저에 코드와 설정을 보관합니다. 중요한 작업은 파일로도 저장하세요.</p>
      <form className="my-4 flex gap-2" onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim()) return;
        const item: LibraryItem = {
          id: crypto.randomUUID(), name: name.trim(), favorite: false, updatedAt: Date.now(),
          state: { code: state.code, mermaid: state.mermaid, rough: state.rough, grid: state.grid },
        };
        if (change((current) => [item, ...current])) { setName(""); setNotice("현재 다이어그램을 보관했습니다."); }
      }}>
        <input aria-label="새 다이어그램 이름" placeholder="다이어그램 이름" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 grow rounded border p-2" />
        <Button type="submit">현재 작업 보관</Button>
      </form>
      <div className="mb-3 flex flex-wrap gap-2">
        <input aria-label="보관함 검색" placeholder="이름·코드 검색" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 grow rounded border p-2" />
        <Button aria-pressed={favorites} onClick={() => setFavorites(!favorites)}>{favorites ? "★ 즐겨찾기만" : "☆ 전체 보기"}</Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <p role="status" className="text-sm">{notice}</p>
      <ul className="space-y-3">
        {filterLibrary(items, query, favorites).map((item) => (
          <li key={item.id} className="rounded-lg border border-(--ml-border) p-3">
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
              <Button size="sm" variant="outline" onClick={() => {
                if (window.confirm(`“${item.name}”을 현재 코드와 설정으로 바꿀까요?`)) change((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: { code: state.code, mermaid: state.mermaid, rough: state.rough, grid: state.grid }, updatedAt: Date.now() } : entry));
              }}>현재 작업으로 갱신</Button>
              <Button size="sm" variant="ghost" onClick={() => {
                if (window.confirm(`“${item.name}”을 보관함에서 삭제할까요?`)) change((current) => current.filter((entry) => entry.id !== item.id));
              }}>삭제</Button>
            </div>
          </li>
        ))}
      </ul>
      {!filterLibrary(items, query, favorites).length && <p className="py-6 text-center text-sm">표시할 다이어그램이 없습니다.</p>}
    </Dialog>
  );
}
