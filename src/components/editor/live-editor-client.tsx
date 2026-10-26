"use client";

import dynamic from "next/dynamic";

// The editor reads the URL hash, localStorage and matchMedia on first render, so it only renders in the browser.
export const LiveEditorClient = dynamic(() => import("./live-editor").then((module) => module.LiveEditor), {
  ssr: false,
});
