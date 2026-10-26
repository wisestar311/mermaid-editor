"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DiagramExporter } from "./exporters";
import { codeFromMarkdown, findMermaidBlocks, markdownFor, replaceMermaidBlock } from "./markdown";
import { addHistoryEntry } from "./history-pane";

export { codeFromMarkdown, markdownFor } from "./markdown";

export type FileFormat = "mmd" | "md" | "svg" | "png";

export const fileFormats: Record<FileFormat, { label: string; description: string; extension: string; mime: string }> = {
  mmd: { label: "Mermaid", description: "다시 열어 편집할 수 있는 다이어그램 코드", extension: ".mmd", mime: "text/plain" },
  md: { label: "Markdown", description: "GitHub·Notion·Obsidian에서 그려지는 mermaid 코드 블록", extension: ".md", mime: "text/markdown" },
  svg: { label: "SVG 이미지", description: "확대해도 깨지지 않는 벡터 이미지", extension: ".svg", mime: "image/svg+xml" },
  png: { label: "PNG 이미지", description: "어디서나 열리는 그림 파일 (2배 해상도)", extension: ".png", mime: "image/png" },
};

/** Image formats cannot be opened again, so saving one exports a copy and keeps the current file. */
export const isEditableFormat = (format: FileFormat) => format === "mmd" || format === "md";

const DEFAULT_BASE_NAME = "diagram";
const openTypes = [{ description: "Mermaid 다이어그램", accept: { "text/plain": [".mmd", ".mermaid", ".md", ".txt"] } }];

type PickerType = { description: string; accept: Record<string, string[]> };
// The File System Access pickers are Chromium-only and not in TypeScript's DOM lib yet.
type PickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName?: string; types?: PickerType[] }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options: { types?: PickerType[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
};

export type DiagramFile = {
  /** Name of the file the diagram was last saved to or opened from. */
  name?: string;
  /** Format of that file. */
  format: FileFormat;
  /** True when the code changed since the last save or open. */
  dirty: boolean;
  save: () => Promise<void>;
  /** Opens the Save As dialog. */
  saveAs: () => void;
  saveAsOpen: boolean;
  closeSaveAs: () => void;
  /** Writes the diagram as `baseName` in `format`; called by the Save As dialog. */
  saveWith: (baseName: string, format: FileFormat) => Promise<void>;
  open: () => Promise<void>;
  markdownBlocks: string[];
  selectedBlock: number;
  selectBlock: (index: number) => void;
  detach: () => void;
};

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function formatFromName(name: string): FileFormat {
  const extension = name.toLowerCase().split(".").pop();
  if (extension === "md" || extension === "markdown") return "md";
  if (extension === "svg") return "svg";
  if (extension === "png") return "png";
  return "mmd";
}

export const baseName = (name: string) => name.replace(/\.(mmd|mermaid|md|markdown|txt|svg|png)$/i, "");

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.download = name;
  anchor.href = url;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function writeTo(handle: FileSystemFileHandle, blob: Blob) {
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function pickFileWithInput() {
  return new Promise<File | undefined>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mmd,.mermaid,.md,.txt,text/plain,text/markdown";
    input.addEventListener("change", () => resolve(input.files?.[0]));
    input.addEventListener("cancel", () => resolve(undefined));
    input.click();
  });
}

/**
 * Saves the diagram to local files without an account. Chromium browsers keep the file handle,
 * so Save overwrites the same file; other browsers download a copy instead.
 */
export function useDiagramFile(code: string, onOpen: (code: string) => void, exportDiagram: DiagramExporter): DiagramFile {
  const [name, setName] = useState<string>();
  const [format, setFormat] = useState<FileFormat>("mmd");
  const [savedCode, setSavedCode] = useState(code);
  const markdownRef = useRef<string | null>(null);
  const [savedDocument, setSavedDocument] = useState<string | null>(null);
  const [markdownDocument, setMarkdownDocument] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState(0);
  const selectedBlockRef = useRef(0);
  const [markdownBlocks, setMarkdownBlocks] = useState<string[]>([]);
  const updateDocument = useCallback((document: string | null, index = 0) => {
    markdownRef.current = document;
    setMarkdownDocument(document);
    selectedBlockRef.current = index;
    setSelectedBlock(index);
    setMarkdownBlocks(document === null ? [] : findMermaidBlocks(document).map((block) => block.code));
  }, []);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const codeRef = useRef(code);
  const onOpenRef = useRef(onOpen);
  const exportRef = useRef(exportDiagram);
  useEffect(() => {
    codeRef.current = code;
    onOpenRef.current = onOpen;
    exportRef.current = exportDiagram;
  }, [code, onOpen, exportDiagram]);

  const dirty = format === "md" && markdownDocument !== null
    ? replaceMermaidBlock(markdownDocument, code, selectedBlock) !== savedDocument
    : code !== savedCode;
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const contentFor = useCallback(async (fileFormat: FileFormat, text: string): Promise<Blob> => {
    if (fileFormat === "mmd") return new Blob([text], { type: "text/plain;charset=utf-8" });
    if (fileFormat === "md") return new Blob([markdownFor(text)], { type: "text/markdown;charset=utf-8" });
    return exportRef.current(fileFormat);
  }, []);

  const markSaved = useCallback((fileName: string, fileFormat: FileFormat, text: string) => {
    setName(fileName);
    setFormat(fileFormat);
    setSavedCode(text);
    addHistoryEntry(text, "manual");
  }, []);

  const saveWith = useCallback(
    async (base: string, fileFormat: FileFormat) => {
      const text = codeRef.current;
      const { extension, mime, label } = fileFormats[fileFormat];
      const fileName = `${baseName(base.trim()) || DEFAULT_BASE_NAME}${extension}`;
      const picker = (window as PickerWindow).showSaveFilePicker;
      try {
        let handle: FileSystemFileHandle | null = null;
        // The picker must open while the click still counts as user activation, so ask first and render after.
        if (picker) handle = await picker({ suggestedName: fileName, types: [{ description: label, accept: { [mime]: [extension] } }] });
        const blob = await contentFor(fileFormat, text);
        if (handle) await writeTo(handle, blob);
        else download(fileName, blob);
        setSaveAsOpen(false);
        if (!isEditableFormat(fileFormat)) return;
        handleRef.current = handle;
        const document = fileFormat === "md" ? markdownFor(text) : null;
        setSavedDocument(document);
        updateDocument(document);
        markSaved(handle?.name ?? fileName, fileFormat, text);
      } catch (error) {
        if (!isAbort(error)) window.alert(`저장하지 못했습니다: ${errorMessage(error)}`);
      }
    },
    [contentFor, markSaved, updateDocument],
  );

  const saveAs = useCallback(() => setSaveAsOpen(true), []);
  const closeSaveAs = useCallback(() => setSaveAsOpen(false), []);

  const save = useCallback(async () => {
    const text = codeRef.current;
    const handle = handleRef.current;
    const markdown = format === "md" && markdownRef.current !== null
      ? replaceMermaidBlock(markdownRef.current, text, selectedBlockRef.current) : null;
    const blob = () => markdown !== null
      ? Promise.resolve(new Blob([markdown], { type: "text/markdown;charset=utf-8" }))
      : contentFor(format, text);
    if (handle) {
      try {
        await writeTo(handle, await blob());
        setSavedDocument(markdown);
        updateDocument(markdown, selectedBlockRef.current);
        markSaved(handle.name, format, text);
      } catch (error) {
        if (!isAbort(error)) window.alert(`저장하지 못했습니다: ${errorMessage(error)}`);
      }
      return;
    }
    // Without file handles a named diagram is downloaded again under the same name.
    if (name && !(window as PickerWindow).showSaveFilePicker) {
      download(name, await blob());
      setSavedDocument(markdown);
      updateDocument(markdown, selectedBlockRef.current);
      markSaved(name, format, text);
      return;
    }
    setSaveAsOpen(true);
  }, [name, format, contentFor, markSaved, updateDocument]);

  const open = useCallback(async () => {
    if (dirtyRef.current && !window.confirm("저장하지 않은 변경 사항이 있습니다. 다른 파일을 열까요?")) return;
    const picker = (window as PickerWindow).showOpenFilePicker;
    try {
      let handle: FileSystemFileHandle | null = null;
      let file: File | undefined;
      if (picker) {
        [handle] = await picker({ types: openTypes, multiple: false });
        file = await handle.getFile();
      } else {
        file = await pickFileWithInput();
      }
      if (!file) return;
      const fileFormat = formatFromName(file.name);
      const text = await file.text();
      const opened = fileFormat === "md" ? codeFromMarkdown(text) : text;
      handleRef.current = handle;
      const document = fileFormat === "md" ? text : null;
      setSavedDocument(document);
      updateDocument(document);
      setName(file.name);
      setFormat(fileFormat);
      setSavedCode(opened);
      onOpenRef.current(opened);
    } catch (error) {
      if (!isAbort(error)) window.alert(`파일을 열지 못했습니다: ${errorMessage(error)}`);
    }
  }, [updateDocument]);

  const selectBlock = useCallback((index: number) => {
    if (markdownRef.current === null || index === selectedBlockRef.current) return;
    const document = replaceMermaidBlock(markdownRef.current, codeRef.current, selectedBlockRef.current);
    const block = findMermaidBlocks(document)[index];
    if (!block) return;
    updateDocument(document, index);
    onOpenRef.current(block.code);
  }, [updateDocument]);

  const detach = () => {
    handleRef.current = null;
    setSavedDocument(null);
    updateDocument(null);
    setName(undefined);
    setFormat("mmd");
  };

  // ⌘S / Ctrl+S, ⇧⌘S and ⌘O, captured before Monaco sees them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) saveAs();
        else void save();
      } else if (key === "o" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        void open();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [save, saveAs, open]);

  return { name, format, dirty, save, saveAs, saveAsOpen, closeSaveAs, saveWith, open, markdownBlocks, selectedBlock, selectBlock, detach };
}

/** Shortcut prefix for menu hints: ⌘ on Apple platforms, Ctrl+ elsewhere. */
export const modKey = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+");
