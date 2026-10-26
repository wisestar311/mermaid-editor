"use client";
import { useState } from "react";
import { quickInsert, type QuickInsertKind } from "./quick-insert";
import { Button } from "./ui";

export function QuickInsert({ code, onChange }: { code: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const insert = (kind: QuickInsertKind) => {
    try { onChange(quickInsert(code, kind, label, from, to)); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  };
  return <div className="max-h-[45dvh] shrink-0 overflow-y-auto border-t border-(--ml-border) p-2">
    <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>＋ 간편 삽입</Button>
    {open && <div className="space-y-2 pt-2">
      <p className="text-xs">플로차트 끝에 추가합니다. 노드 ID는 N1, N2…로 생성됩니다.</p>
      <input aria-label="삽입할 노드 이름" placeholder="노드 이름" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded border p-2 text-sm" />
      <div className="flex gap-2"><Button size="sm" onClick={() => insert("node")}>노드 추가</Button><Button size="sm" onClick={() => insert("decision")}>조건 추가</Button></div>
      <div className="flex flex-wrap gap-2">
        <input aria-label="시작 노드 ID" placeholder="시작 ID (N1)" value={from} onChange={(e) => setFrom(e.target.value)} className="w-24 grow rounded border p-2 text-sm" />
        <input aria-label="도착 노드 ID" placeholder="도착 ID (N2)" value={to} onChange={(e) => setTo(e.target.value)} className="w-24 grow rounded border p-2 text-sm" />
        <Button size="sm" onClick={() => insert("arrow")}>화살표 추가</Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>}
  </div>;
}
