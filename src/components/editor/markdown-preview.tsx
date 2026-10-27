"use client";

import { useEffect, useRef, useState } from "react";
import type { MermaidConfig } from "mermaid";

import { markdownParts } from "./markdown";
import { renderDiagram } from "./mermaid-runtime";
import { parseConfig } from "./state";
import { Button, Dialog } from "./ui";

function Diagram({ code, config }: { code: string; config: MermaidConfig }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    renderDiagram(code, config).then(({ svg }) => {
      if (cancelled || !ref.current) return;
      ref.current.innerHTML = svg;
      const graph = ref.current.querySelector("svg");
      graph?.style.setProperty("max-width", "100%");
      graph?.style.setProperty("max-height", "24rem");
    }, (reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { cancelled = true; };
  }, [code, config]);
  if (error) return <pre className="overflow-x-auto rounded bg-red-50 p-3 text-xs whitespace-pre-wrap text-red-700">다이어그램 오류: {error}</pre>;
  return <div ref={ref} className="flex justify-center overflow-x-auto" />;
}

export function MarkdownPreview({ document, config, selected, onSelect, onClose }: {
  document: string;
  config: string;
  selected: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const [parts] = useState(() => markdownParts(document));
  const [mermaidConfig] = useState<MermaidConfig>(() => {
    try { return parseConfig(config) as MermaidConfig; } catch { return {}; }
  });
  return (
    <Dialog open onClose={onClose} className="w-[min(56rem,95vw)] max-w-none max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto">
      <h2 className="pr-6 text-xl font-semibold">문서 전체 미리보기</h2>
      <p className="text-sm text-(--ml-muted-foreground)">편집 중인 내용을 포함한 모든 다이어그램입니다. 본문은 서식 없이 표시합니다.</p>
      {parts.map((part, key) => part.kind === "text"
        ? <pre key={key} className="font-sans text-sm whitespace-pre-wrap text-(--ml-muted-foreground)">{part.text}</pre>
        : (
          <section key={key} className={`grid gap-2 rounded-lg border p-3 ${part.index === selected ? "border-(--ml-accent)" : "border-(--ml-border)"}`}>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold">다이어그램 {part.index + 1}{part.index === selected && " · 편집 중"}</span>
              {part.index !== selected && <Button size="sm" variant="outline" onClick={() => { onSelect(part.index); onClose(); }}>이 다이어그램 편집</Button>}
            </div>
            <div className="rounded bg-(--ml-background) p-2"><Diagram code={part.code} config={mermaidConfig} /></div>
          </section>
        ))}
    </Dialog>
  );
}
