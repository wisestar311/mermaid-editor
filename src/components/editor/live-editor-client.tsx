"use client";

import dynamic from "next/dynamic";

const RELOADED_KEY = "mermaid-editor:chunk-reload";

function session(action: (storage: Storage) => string | null | void) {
  try {
    return action(sessionStorage);
  } catch {
    return null;
  }
}

// A page from an older deploy can name build files that no longer exist; reload once to get the current page.
function loadEditor() {
  return import("./live-editor").then((module) => {
    session((storage) => storage.removeItem(RELOADED_KEY));
    return module.LiveEditor;
  }, (error: unknown) => {
    if (session((storage) => storage.getItem(RELOADED_KEY))) throw error;
    session((storage) => storage.setItem(RELOADED_KEY, "1"));
    location.reload();
    return new Promise<never>(() => {});
  });
}

// The editor reads the URL hash, localStorage and matchMedia on first render, so it only renders in the browser.
export const LiveEditorClient = dynamic(loadEditor, {
  ssr: false,
});
