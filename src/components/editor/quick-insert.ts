export type QuickInsertKind = "node" | "decision" | "arrow";

export function quickInsert(code: string, kind: QuickInsertKind, label: string, from: string, to: string) {
  if (!/^\s*(?:flowchart|graph)\s+(?:TB|TD|BT|RL|LR)\b/m.test(code)) {
    throw new Error("간편 삽입은 플로차트에서 사용할 수 있습니다. 샘플에서 플로차트를 선택하세요.");
  }
  let line: string;
  if (kind === "arrow") {
    if (![from, to].every((id) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(id))) throw new Error("노드 ID는 영문·숫자·밑줄을 사용하며 영문 또는 밑줄로 시작해야 합니다.");
    line = `${from} --> ${to}`;
  } else {
    if (!label.trim()) throw new Error("노드 이름을 입력하세요.");
    let index = 1;
    while (new RegExp(`\\bN${index}\\b`).test(code)) index++;
    const text = label.trim().replaceAll("&", "#38;").replaceAll('"', "#34;").replaceAll("<", "#60;").replaceAll(">", "#62;").replace(/[\r\n]+/g, " ");
    line = kind === "node" ? `N${index}["${text}"]` : `N${index}{"${text}"}`;
  }
  return `${code.trimEnd()}\n    ${line}\n`;
}
