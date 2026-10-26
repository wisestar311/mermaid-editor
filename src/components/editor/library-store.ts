import type { LiveState } from "./state";

export type LibraryItem = {
  id: string;
  name: string;
  updatedAt: number;
  favorite: boolean;
  state: Pick<LiveState, "code" | "mermaid" | "rough" | "grid">;
};
export const LIBRARY_KEY = "mermaid-editor:library:v1";

export function parseLibrary(text: string | null): LibraryItem[] {
  const value: unknown = JSON.parse(text ?? "[]");
  if (!Array.isArray(value)) throw new Error("보관함 데이터 형식이 올바르지 않습니다.");
  if (!value.every((item) => item && typeof item.id === "string" && typeof item.name === "string" &&
    typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt) && typeof item.favorite === "boolean" &&
    item.state && typeof item.state.code === "string" && typeof item.state.mermaid === "string" &&
    typeof item.state.rough === "boolean" && typeof item.state.grid === "boolean")) {
    throw new Error("보관함 데이터가 손상되어 읽을 수 없습니다.");
  }
  return value;
}

export function filterLibrary(items: LibraryItem[], query: string, favorites: boolean) {
  const term = query.trim().toLocaleLowerCase();
  return items.filter((item) => (!favorites || item.favorite) &&
    `${item.name}\n${item.state.code}`.toLocaleLowerCase().includes(term))
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
}
