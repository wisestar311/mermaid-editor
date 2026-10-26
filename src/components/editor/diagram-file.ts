"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { addHistoryEntry } from "./history-pane";

const DEFAULT_NAME = "diagram.mmd";
const pickerTypes = [{ description: "Mermaid 다이어그램", accept: { "text/plain": [".mmd", ".mermaid"] } }];

// The File System Access pickers are Chromium-only and not in TypeScript's DOM lib yet.
type PickerWindow = Window & {
  showSaveFilePicker?: (options: { suggestedName?: string; types?: typeof pickerTypes }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options: { types?: typeof pickerTypes; multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
};

export type DiagramFile = {
  /** Name of the file the diagram was last saved to or opened from. */
  name?: string;
  /** True when the code changed since the last save or open. */
  dirty: boolean;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  open: () => Promise<void>;
};

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const withExtension = (name: string) => (/\.(mmd|mermaid|txt)$/i.test(name) ? name : `${name}.mmd`);

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.download = name;
  anchor.href = url;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function writeTo(handle: FileSystemFileHandle, text: string) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

function pickFileWithInput() {
  return new Promise<File | undefined>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mmd,.mermaid,.txt,text/plain";
    input.addEventListener("change", () => resolve(input.files?.[0]));
    input.addEventListener("cancel", () => resolve(undefined));
    input.click();
  });
}

/**
 * Saves the diagram code to a local .mmd file without an account. Chromium browsers keep the
 * file handle, so Save overwrites the same file; other browsers download a copy instead.
 */
export function useDiagramFile(code: string, onOpen: (code: string) => void): DiagramFile {
  const [name, setName] = useState<string>();
  const [savedCode, setSavedCode] = useState<string>();
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const codeRef = useRef(code);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    codeRef.current = code;
    onOpenRef.current = onOpen;
  }, [code, onOpen]);

  const dirty = savedCode !== undefined && code !== savedCode;
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const markSaved = useCallback((fileName: string, text: string) => {
    setName(fileName);
    setSavedCode(text);
    addHistoryEntry(text, "manual");
  }, []);

  const saveAs = useCallback(async () => {
    const text = codeRef.current;
    const picker = (window as PickerWindow).showSaveFilePicker;
    try {
      if (picker) {
        const handle = await picker({ suggestedName: name ?? DEFAULT_NAME, types: pickerTypes });
        await writeTo(handle, text);
        handleRef.current = handle;
        markSaved(handle.name, text);
        return;
      }
      const input = window.prompt("저장할 파일 이름", name ?? DEFAULT_NAME)?.trim();
      if (!input) return;
      const fileName = withExtension(input);
      download(fileName, text);
      markSaved(fileName, text);
    } catch (error) {
      if (!isAbort(error)) window.alert(`저장하지 못했습니다: ${errorMessage(error)}`);
    }
  }, [name, markSaved]);

  const save = useCallback(async () => {
    const text = codeRef.current;
    const handle = handleRef.current;
    if (handle) {
      try {
        await writeTo(handle, text);
        markSaved(handle.name, text);
      } catch (error) {
        if (!isAbort(error)) window.alert(`저장하지 못했습니다: ${errorMessage(error)}`);
      }
      return;
    }
    // Without file handles a named diagram is downloaded again under the same name.
    if (name && !(window as PickerWindow).showSaveFilePicker) {
      download(name, text);
      markSaved(name, text);
      return;
    }
    await saveAs();
  }, [name, saveAs, markSaved]);

  const open = useCallback(async () => {
    if (dirtyRef.current && !window.confirm("저장하지 않은 변경 사항이 있습니다. 다른 파일을 열까요?")) return;
    const picker = (window as PickerWindow).showOpenFilePicker;
    try {
      let handle: FileSystemFileHandle | null = null;
      let file: File | undefined;
      if (picker) {
        [handle] = await picker({ types: pickerTypes, multiple: false });
        file = await handle.getFile();
      } else {
        file = await pickFileWithInput();
      }
      if (!file) return;
      const text = await file.text();
      handleRef.current = handle;
      setName(file.name);
      setSavedCode(text);
      onOpenRef.current(text);
    } catch (error) {
      if (!isAbort(error)) window.alert(`파일을 열지 못했습니다: ${errorMessage(error)}`);
    }
  }, []);

  // ⌘S / Ctrl+S, ⇧⌘S and ⌘O, captured before Monaco sees them.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        event.stopPropagation();
        void (event.shiftKey ? saveAs() : save());
      } else if (key === "o" && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        void open();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [save, saveAs, open]);

  return { name, dirty, save, saveAs, open };
}

/** Shortcut prefix for menu hints: ⌘ on Apple platforms, Ctrl+ elsewhere. */
export const modKey = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl+");
