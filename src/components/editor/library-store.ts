import type { LiveState } from "./state";

export type LibraryItem = {
  id: string;
  name: string;
  updatedAt: number;
  favorite: boolean;
  state: Pick<LiveState, "code" | "mermaid" | "rough" | "grid">;
  /** Small raster preview as a data URL. */
  thumbnail?: string;
};
export const LIBRARY_KEY = "mermaid-editor:library:v1";
const EXPORT_APP = "mermaid-editor-library";

const THUMBNAIL = /^data:image\/(?:png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/;

function isItem(item: unknown): item is LibraryItem {
  if (!item || typeof item !== "object") return false;
  const value = item as Record<string, unknown>;
  const state = value.state as Record<string, unknown> | null;
  return typeof value.id === "string" && typeof value.name === "string" &&
    typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt) && typeof value.favorite === "boolean" &&
    !!state && typeof state === "object" && typeof state.code === "string" && typeof state.mermaid === "string" &&
    typeof state.rough === "boolean" && typeof state.grid === "boolean" &&
    (value.thumbnail === undefined || (typeof value.thumbnail === "string" && THUMBNAIL.test(value.thumbnail)));
}

export function parseLibrary(text: string | null): LibraryItem[] {
  const value: unknown = JSON.parse(text ?? "[]");
  if (!Array.isArray(value)) throw new Error("보관함 데이터 형식이 올바르지 않습니다.");
  if (!value.every(isItem)) throw new Error("보관함 데이터가 손상되어 읽을 수 없습니다.");
  return value;
}

export function filterLibrary(items: LibraryItem[], query: string, favorites: boolean) {
  const term = query.trim().toLocaleLowerCase();
  return items.filter((item) => (!favorites || item.favorite) &&
    `${item.name}\n${item.state.code}`.toLocaleLowerCase().includes(term))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
}

/** Backup file contents; thumbnails are kept so a restored library looks the same. */
export const exportLibrary = (items: LibraryItem[], exportedAt = Date.now()) =>
  JSON.stringify({ app: EXPORT_APP, version: 1, exportedAt, items }, null, 2);

/** Items from a backup file, or a bare item array as stored in local storage. */
export function parseLibraryExport(text: string): LibraryItem[] {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("JSON 파일이 아닙니다.");
  }
  const items = Array.isArray(value) ? value
    : value && typeof value === "object" && (value as { app?: unknown }).app === EXPORT_APP ? (value as { items?: unknown }).items
    : undefined;
  if (!Array.isArray(items)) throw new Error("Mermaid 에디터 보관함 백업 파일이 아닙니다.");
  if (!items.every(isItem)) throw new Error("백업 파일의 일부 항목이 손상되어 가져올 수 없습니다.");
  return items;
}

/** Adds new items and replaces existing ones only with a newer version, matched by id. */
export function mergeLibrary(current: LibraryItem[], incoming: LibraryItem[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  for (const item of incoming) {
    const existing = byId.get(item.id);
    if (!existing) added++;
    else if (item.updatedAt > existing.updatedAt) updated++;
    else continue;
    byId.set(item.id, item);
  }
  return { items: [...byId.values()], added, updated, skipped: incoming.length - added - updated };
}
