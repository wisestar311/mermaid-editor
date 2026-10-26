// State model and URL format of mermaid.live (MIT, mermaid-js/mermaid-live-editor).
// Diagrams live in the URL hash as `pako:<base64url(deflate(JSON))>`.
import { deflate, inflate } from "pako";

export type EditorMode = "code" | "config";

export type LiveState = {
  code: string;
  mermaid: string;
  grid: boolean;
  panZoom: boolean;
  rough: boolean;
  updateDiagram: boolean;
  editorMode?: EditorMode;
  pan?: { x: number; y: number };
  zoom?: number;
};

export const MERMAID_VERSION = "12.2.0";
const RENDERER_URL = "https://mermaid.ink";
const KROKI_URL = "https://kroki.io";

export const defaultState: LiveState = {
  code: `flowchart TD
    A[Christmas] -->|Get money| B(Go shopping)
    B --> C{Let me think}
    C -->|One| D[Laptop]
    C -->|Two| E[iPhone]
    C -->|Three| F[fa:fa-car Car]
  `,
  grid: true,
  mermaid: "{}",
  panZoom: true,
  rough: false,
  updateDiagram: true,
};

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64ToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function pakoSerialize(text: string) {
  return bytesToBase64Url(deflate(new TextEncoder().encode(text), { level: 9 }));
}

export function serializeState(state: LiveState) {
  return `pako:${pakoSerialize(JSON.stringify(state))}`;
}

/** Accept only the expected fields from shared links and local storage. */
export function normalizeState(value: unknown): LiveState {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("잘못된 다이어그램 상태입니다.");
  const input = value as Record<string, unknown>;
  const state = { ...defaultState };
  for (const key of ["code", "mermaid"] as const) {
    if (typeof input[key] === "string") state[key] = input[key];
  }
  for (const key of ["grid", "panZoom", "rough", "updateDiagram"] as const) {
    if (typeof input[key] === "boolean") state[key] = input[key];
  }
  if (input.editorMode === "code" || input.editorMode === "config") state.editorMode = input.editorMode;
  if (typeof input.zoom === "number" && Number.isFinite(input.zoom) && input.zoom > 0) state.zoom = input.zoom;
  const pan = input.pan as { x?: unknown; y?: unknown } | null;
  if (pan && typeof pan.x === "number" && typeof pan.y === "number" && Number.isFinite(pan.x) && Number.isFinite(pan.y)) {
    state.pan = { x: pan.x, y: pan.y };
  }
  return state;
}

export function parseConfig(text: string): Record<string, unknown> {
  const config: unknown = JSON.parse(text);
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("설정은 JSON 객체여야 합니다. 예: {}");
  }
  return config as Record<string, unknown>;
}

export function deserializeState(serialized: string): LiveState {
  const [type, data] = serialized.includes(":") ? serialized.split(":") : ["base64", serialized];
  let json: string;
  if (type === "pako") {
    json = inflate(base64ToBytes(data), { to: "string" });
  } else if (type === "base64") {
    json = new TextDecoder().decode(base64ToBytes(data));
  } else {
    throw new Error(`Unknown serde type: ${type}`);
  }
  return normalizeState(JSON.parse(json));
}

const STORE_KEY = "mermaid-editor:codeStore";

export function loadInitialState(): LiveState {
  const hash = window.location.hash.slice(1);
  if (hash) {
    try {
      return deserializeState(hash);
    } catch (error) {
      console.error("Failed to load state from URL", error);
    }
  }
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (stored) return normalizeState(JSON.parse(stored));
  } catch {
    // Storage can be unavailable (private mode); fall back to the default diagram.
  }
  return { ...defaultState };
}

export function persistState(state: LiveState) {
  const serialized = serializeState(state);
  try {
    window.history.replaceState(null, "", `#${serialized}`);
  } catch {
    // Browser URL limits must not prevent the local backup.
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures; the URL still carries the state.
  }
  return serialized;
}

export function buildUrls(state: LiveState, serialized: string) {
  const png = `${RENDERER_URL}/img/${serialized}?type=png`;
  return {
    png,
    svg: `${RENDERER_URL}/svg/${serialized}`,
    kroki: `${KROKI_URL}/mermaid/svg/${pakoSerialize(state.code)}`,
    mdCode: `[![](${png})](${window.location.href})`,
    newDiagram: `${window.location.pathname}#${serializeState(defaultState)}`,
  };
}
