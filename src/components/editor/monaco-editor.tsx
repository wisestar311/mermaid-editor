"use client";

import { useEffect, useRef, useState } from "react";

import type { EditorMode } from "./state";

type Monaco = typeof import("monaco-editor");
type StandaloneEditor = import("monaco-editor").editor.IStandaloneCodeEditor;
type TextModel = import("monaco-editor").editor.ITextModel;

type MonacoEditorProps = {
  mode: EditorMode;
  code: string;
  config: string;
  dark: boolean;
  revision: number;
  error?: { message: string; line?: number };
  onChange: (mode: EditorMode, value: string) => void;
};

let monacoPromise: Promise<Monaco> | undefined;

// Loads the bundled Monaco build once, with the same workers and mermaid language as mermaid.live.
function loadMonaco() {
  monacoPromise ??= (async () => {
    self.MonacoEnvironment = {
      getWorker(_workerId, label) {
        if (label === "json") {
          return new Worker(new URL("monaco-editor/esm/vs/language/json/json.worker.js", import.meta.url), {
            type: "module",
          });
        }
        return new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url), {
          type: "module",
        });
      },
    };
    // Monaco reads its UI strings (context menu, find widget, hovers) when its modules load.
    await import("monaco-editor/esm/nls.messages.ko.js");
    const [monaco, { initEditor }] = await Promise.all([import("monaco-editor"), import("./monaco-mermaid-language")]);
    initEditor(monaco);
    monaco.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      enableSchemaRequest: true,
      schemas: [{ fileMatch: ["config.json"], uri: "https://mermaid.js.org/schemas/config.schema.json" }],
    });
    return monaco;
  })();
  return monacoPromise;
}

type EditorParts = { monaco: Monaco; editor: StandaloneEditor; models: Record<EditorMode, TextModel> };

export function MonacoEditor({ mode, code, config, dark, revision, error, onChange }: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const partsRef = useRef<EditorParts | null>(null);
  const [ready, setReady] = useState(false);
  const initialTextRef = useRef({ code, config });
  // Values the editor reported while typing. Effects run after paint, so state can echo an
  // older one of these back; only values the editor never produced are outside edits.
  const reportedRef = useRef<Record<EditorMode, Set<string>>>({ code: new Set(), config: new Set() });
  const syncingRef = useRef(false);
  const revisionRef = useRef(revision);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void loadMonaco().then((monaco) => {
      if (disposed) return;
      const models: Record<EditorMode, TextModel> = {
        code: monaco.editor.createModel(initialTextRef.current.code, "mermaid"),
        config: monaco.editor.createModel(initialTextRef.current.config, "json", monaco.Uri.parse("internal://config.json")),
      };
      const editor = monaco.editor.create(container, {
        model: models.code,
        minimap: { enabled: false },
        overviewRulerLanes: 0,
        glyphMargin: true,
        lineNumbersMinChars: 4,
        automaticLayout: true,
      });
      // Monaco places the cursor after the last line once the code is loaded.
      editor.setPosition(models.code.getFullModelRange().getEndPosition());
      const subscription = editor.onDidChangeModelContent(({ isFlush }) => {
        if (isFlush || syncingRef.current) return;
        const model = editor.getModel();
        const editorMode: EditorMode = model === models.config ? "config" : "code";
        const value = editor.getValue();
        const reported = reportedRef.current[editorMode];
        reported.add(value);
        if (reported.size > 200) reported.delete(reported.values().next().value as string);
        onChangeRef.current(editorMode, value);
      });
      partsRef.current = { monaco, editor, models };
      setReady(true);
      cleanup = () => {
        subscription.dispose();
        editor.dispose();
        models.code.dispose();
        models.config.dispose();
        partsRef.current = null;
      };
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

  // Switch models with the Code/Config tabs and apply outside edits (samples, history, theme sync).
  useEffect(() => {
    const parts = partsRef.current;
    if (!ready || !parts) return;
    const { editor, models } = parts;
    if (revisionRef.current !== revision) {
      reportedRef.current.code.clear();
      reportedRef.current.config.clear();
      revisionRef.current = revision;
    }
    const model = models[mode];
    if (editor.getModel() !== model) editor.setModel(model);
    const next = mode === "code" ? code : config;
    if (next !== model.getValue() && !reportedRef.current[mode].has(next)) {
      syncingRef.current = true;
      try {
        editor.setScrollTop(0);
        editor.pushUndoStop();
        editor.executeEdits("updateCode", [{ range: model.getFullModelRange(), text: next }]);
        editor.pushUndoStop();
        reportedRef.current[mode].clear();
      } finally {
        syncingRef.current = false;
      }
    }
  }, [ready, mode, code, config, revision]);

  useEffect(() => {
    const parts = partsRef.current;
    if (!ready || !parts) return;
    parts.monaco.editor.setTheme(dark ? "mermaid-dark" : "mermaid");
  }, [ready, dark]);

  useEffect(() => {
    const parts = partsRef.current;
    if (!ready || !parts) return;
    const { monaco, models } = parts;
    const markers =
      error?.line !== undefined && error.line <= models.code.getLineCount()
        ? [
            {
              severity: monaco.MarkerSeverity.Error,
              message: error.message,
              startLineNumber: error.line,
              startColumn: models.code.getLineFirstNonWhitespaceColumn(error.line) || 1,
              endLineNumber: error.line,
              endColumn: models.code.getLineMaxColumn(error.line),
            },
          ]
        : [];
    monaco.editor.setModelMarkers(models.code, "mermaid", markers);
  }, [ready, error, code]);

  return <div ref={containerRef} className="h-full w-full" />;
}
