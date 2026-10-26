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
const DOCS_URL = "https://mermaid.js.org";

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
  return { ...defaultState, ...(JSON.parse(json) as Partial<LiveState>) };
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
    if (stored) return { ...defaultState, ...(JSON.parse(stored) as Partial<LiveState>) };
  } catch {
    // Storage can be unavailable (private mode); fall back to the default diagram.
  }
  return { ...defaultState };
}

export function persistState(state: LiveState) {
  const serialized = serializeState(state);
  window.history.replaceState(null, "", `#${serialized}`);
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


// mermaid's detector ids → documentation page and Docs-button label.
const docPages: Record<string, [page: string, label: string]> = {
  "flowchart-v2": ["flowchart", "flowchart"],
  flowchart: ["flowchart", "flowchart"],
  "flowchart-elk": ["flowchart", "flowchart"],
  sequence: ["sequenceDiagram", "sequence"],
  class: ["classDiagram", "class"],
  classDiagram: ["classDiagram", "class"],
  state: ["stateDiagram", "state"],
  stateDiagram: ["stateDiagram", "state"],
  er: ["entityRelationshipDiagram", "er"],
  journey: ["userJourney", "journey"],
  gantt: ["gantt", "gantt"],
  pie: ["pie", "pie"],
  quadrantChart: ["quadrantChart", "quadrantChart"],
  requirement: ["requirementDiagram", "requirement"],
  gitGraph: ["gitgraph", "gitGraph"],
  c4: ["c4", "c4"],
  mindmap: ["mindmap", "mindmap"],
  timeline: ["timeline", "timeline"],
  sankey: ["sankey", "sankey"],
  xychart: ["xyChart", "xychart"],
  block: ["block", "block"],
  packet: ["packet", "packet"],
  kanban: ["kanban", "kanban"],
  architecture: ["architecture", "architecture"],
  radar: ["radar", "radar"],
  treemap: ["treemap", "treemap"],
  zenuml: ["zenuml", "zenuml"],
};

export function getDocs(diagramType: string | undefined, editorMode: EditorMode) {
  if (editorMode === "config") {
    return { url: `${DOCS_URL}/config/configuration.html`, label: "config" };
  }
  const entry = diagramType ? docPages[diagramType] : undefined;
  if (!entry) return { url: `${DOCS_URL}/intro/`, label: diagramType ?? "" };
  return { url: `${DOCS_URL}/syntax/${entry[0]}.html`, label: entry[1] };
}
