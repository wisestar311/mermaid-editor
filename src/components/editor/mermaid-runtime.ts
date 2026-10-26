// Browser-only mermaid setup matching mermaid.live: tidy-tree layouts, ZenUML,
// and the editor-managed theme rules (MIT, mermaid-js/mermaid-live-editor).
import tidyTreeLayouts from "@mermaid-js/layout-tidy-tree";
import zenuml from "@mermaid-js/mermaid-zenuml";
import mermaid, { type MermaidConfig } from "mermaid";

mermaid.registerLayoutLoaders(tidyTreeLayouts);
const ready = mermaid.registerExternalDiagrams([zenuml]);

const defaultConfig = (mermaid.mermaidAPI.defaultConfig ?? {}) as Record<string, unknown>;

// Detector ids whose config section is named differently.
const sectionAliases: Record<string, string> = {
  classDiagram: "class",
  "flowchart-elk": "flowchart",
  "flowchart-v2": "flowchart",
  railroadAbnf: "railroad",
  railroadEbnf: "railroad",
  railroadPeg: "railroad",
  stateDiagram: "state",
  xychart: "xyChart",
};

function themeOfSection(section: unknown) {
  if (section && typeof section === "object" && "theme" in section) {
    const { theme } = section as { theme?: unknown };
    if (typeof theme === "string") return theme;
  }
  return undefined;
}

const globalDefaultTheme = (defaultConfig.theme as string | undefined) ?? "default";

function getDefaultTheme(diagramType: string) {
  const key = sectionAliases[diagramType] ?? diagramType;
  return themeOfSection(defaultConfig[key]) ?? globalDefaultTheme;
}

function darkVariantOf(theme: string) {
  if (theme.includes("dark")) return theme;
  return theme.startsWith("redux") ? theme.replace("redux", "redux-dark") : "dark";
}

const managedThemes = new Set<string>();
for (const theme of [globalDefaultTheme, ...Object.values(defaultConfig).map(themeOfSection)]) {
  if (theme) {
    managedThemes.add(theme);
    managedThemes.add(darkVariantOf(theme));
  }
}

/**
 * Returns the config string with the editor-managed theme for this diagram
 * type and site mode, or the input unchanged when the user picked a theme.
 */
export function syncManagedTheme(configText: string, diagramType: string, dark: boolean) {
  let config: MermaidConfig;
  try {
    config = JSON.parse(configText) as MermaidConfig;
  } catch {
    return configText;
  }
  if (config.theme !== undefined && !managedThemes.has(config.theme)) return configText;
  const base = getDefaultTheme(diagramType);
  const theme = dark ? darkVariantOf(base) : base;
  if (config.theme === theme) return configText;
  return JSON.stringify({ ...config, theme }, null, 2);
}

export type ParseResult = { diagramType: string } | { error: string; line?: number };

export async function parseDiagram(code: string): Promise<ParseResult> {
  await ready;
  try {
    const result = await mermaid.parse(code);
    if (!result) return { error: "다이어그램 종류를 알아낼 수 없습니다" };
    return { diagramType: result.diagramType };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const hash = (error as { hash?: { loc?: { first_line?: number }; line?: number } }).hash;
    const lineFromMessage = /line (\d+)/i.exec(message)?.[1];
    const line = hash?.loc?.first_line ?? (hash?.line !== undefined ? hash.line + 1 : undefined) ??
      (lineFromMessage ? Number(lineFromMessage) : undefined);
    return { error: message, line };
  }
}

let renderCount = 0;

export async function renderDiagram(code: string, config: MermaidConfig) {
  await ready;
  mermaid.initialize({ ...config, startOnLoad: false });
  renderCount += 1;
  const id = `graph-${renderCount}`;
  const result = await mermaid.render(id, code);
  return { id, ...result };
}
