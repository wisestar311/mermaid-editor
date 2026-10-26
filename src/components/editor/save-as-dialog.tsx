"use client";

import { SaveAll } from "lucide-react";
import { useState, type FormEvent } from "react";

import { cn } from "@/lib/utils";

import { baseName, fileFormats, isEditableFormat, type DiagramFile, type FileFormat } from "./diagram-file";
import { Button, Dialog } from "./ui";

const formatOrder: FileFormat[] = ["mmd", "md", "svg", "png"];

export function SaveAsDialog({ file }: { file: DiagramFile }) {
  if (!file.saveAsOpen) return null;
  return <SaveAsForm file={file} />;
}

// Mounted per opening, so the fields start from the current file each time.
function SaveAsForm({ file }: { file: DiagramFile }) {
  const [name, setName] = useState(() => (file.name ? baseName(file.name) : "diagram"));
  const [format, setFormat] = useState<FileFormat>(() => (isEditableFormat(file.format) ? file.format : "mmd"));
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await file.saveWith(name, format);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={file.closeSaveAs} className="sm:max-w-md">
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <SaveAll className="size-5" /> 다른 이름으로 저장
        </h2>
        <label className="flex flex-col gap-2 text-sm font-medium">
          파일 이름
          <span className="flex items-center rounded-md border border-(--ml-input) shadow-sm focus-within:ring-1 focus-within:ring-(--ml-ring)">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 min-w-0 grow bg-transparent px-3 text-sm font-normal outline-none"
            />
            <span className="pr-3 text-(--ml-muted-foreground)">{fileFormats[format].extension}</span>
          </span>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">형식</legend>
          {formatOrder.map((value) => {
            const { label, description, extension } = fileFormats[value];
            return (
              <label
                key={value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-[10px] border border-(--ml-input) p-3 transition-colors hover:bg-(--ml-muted)",
                  format === value && "border-(--ml-accent) bg-(--ml-muted)",
                )}
              >
                <input
                  type="radio"
                  name="format"
                  value={value}
                  checked={format === value}
                  onChange={() => setFormat(value)}
                  className="accent-(--ml-accent)"
                />
                <span className="flex grow flex-col">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-(--ml-muted-foreground)">{description}</span>
                </span>
                <span className="text-xs text-(--ml-muted-foreground)">{extension}</span>
              </label>
            );
          })}
        </fieldset>
        {!isEditableFormat(format) && (
          <p className="text-xs text-(--ml-muted-foreground)">
            이미지는 다시 열어 편집할 수 없어서 사본으로 저장합니다.
            {file.name ? ` 지금 파일(${file.name})은 그대로 유지됩니다.` : " 편집할 파일은 Mermaid나 Markdown으로 따로 저장하세요."}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={file.closeSaveAs}>
            취소
          </Button>
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "저장 중…" : "저장"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
