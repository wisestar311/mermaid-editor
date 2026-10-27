"use client";
import { useState } from "react";
import { quickDiagram, quickInsert, type QuickInsertKind } from "./quick-insert";
import { Button } from "./ui";

export function QuickInsert({ code, onChange }: { code: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const diagram = quickDiagram(code);
  const insert = (kind: QuickInsertKind) => {
    try { onChange(quickInsert(code, kind, label, from, to)); setError(""); }
    catch (error) { setError(error instanceof Error ? error.message : String(error)); }
  };
  const input = "w-24 grow rounded border p-2 text-sm";
  return <div className="max-h-[45dvh] shrink-0 overflow-y-auto border-t border-(--ml-border) p-2">
    <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>＋ 간편 삽입</Button>
    {open && <div className="space-y-2 pt-2">
      {diagram === "flowchart" && <>
        <p className="text-xs">플로차트 끝에 추가합니다. 노드 ID는 N1, N2…로 생성됩니다.</p>
        <input aria-label="삽입할 노드 이름" placeholder="노드 이름" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded border p-2 text-sm" />
        <div className="flex gap-2"><Button size="sm" onClick={() => insert("node")}>노드 추가</Button><Button size="sm" onClick={() => insert("decision")}>조건 추가</Button></div>
        <div className="flex flex-wrap gap-2">
          <input aria-label="시작 노드 ID" placeholder="시작 ID (N1)" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
          <input aria-label="도착 노드 ID" placeholder="도착 ID (N2)" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
          <Button size="sm" onClick={() => insert("arrow")}>화살표 추가</Button>
        </div>
      </>}
      {diagram === "sequence" && <>
        <p className="text-xs">시퀀스 다이어그램 끝에 추가합니다. 참여자 ID는 P1, P2…로 생성됩니다.</p>
        <input aria-label="참여자 이름 또는 메시지" placeholder="참여자 이름 / 메시지 내용" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded border p-2 text-sm" />
        <Button size="sm" onClick={() => insert("participant")}>참여자 추가</Button>
        <div className="flex flex-wrap gap-2">
          <input aria-label="보내는 참여자 ID" placeholder="보내는 ID (P1)" value={from} onChange={(e) => setFrom(e.target.value)} className={input} />
          <input aria-label="받는 참여자 ID" placeholder="받는 ID (P2)" value={to} onChange={(e) => setTo(e.target.value)} className={input} />
          <Button size="sm" onClick={() => insert("message")}>메시지 추가</Button>
        </div>
      </>}
      {!diagram && !code.trim() && <>
        <p className="text-xs">빈 다이어그램입니다. 시작할 종류를 고르세요.</p>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onChange("flowchart TD\n")}>플로차트로 시작</Button>
          <Button size="sm" onClick={() => onChange("sequenceDiagram\n")}>시퀀스로 시작</Button>
        </div>
      </>}
      {!diagram && code.trim() && <p className="text-xs">간편 삽입은 플로차트와 시퀀스 다이어그램에서 사용할 수 있습니다. 샘플에서 선택하세요.</p>}
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>}
  </div>;
}
