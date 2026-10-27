export type QuickInsertKind = "node" | "decision" | "arrow" | "participant" | "message";
export type QuickDiagram = "flowchart" | "sequence";

const ID = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** The diagram type from its declaration line, past front matter, directives and comments. */
export function quickDiagram(code: string): QuickDiagram | undefined {
  const body = code.replace(/^\s*---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/, "");
  const declaration = body.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !line.startsWith("%%"));
  if (!declaration) return undefined;
  if (/^(?:flowchart|graph)(?:\s+(?:TB|TD|BT|RL|LR))?\s*;?$/i.test(declaration)) return "flowchart";
  if (/^sequenceDiagram\b/.test(declaration)) return "sequence";
  return undefined;
}

/** Mermaid entity codes for characters that end a label; `;` also ends a sequence statement. */
const entities = (text: string, semicolon = false) =>
  text.trim().replace(/[\r\n]+/g, " ").replace(semicolon ? /[&"<>;]/g : /[&"<>]/g, (char) => `#${char.charCodeAt(0)};`);

function nextId(code: string, prefix: string) {
  let index = 1;
  while (new RegExp(`\\b${prefix}${index}\\b`).test(code)) index++;
  return `${prefix}${index}`;
}

function checkIds(...ids: string[]) {
  if (!ids.every((id) => ID.test(id))) throw new Error("ID는 영문·숫자·밑줄을 사용하며 영문 또는 밑줄로 시작해야 합니다.");
}

export function quickInsert(code: string, kind: QuickInsertKind, label: string, from: string, to: string) {
  const diagram = quickDiagram(code);
  if (!diagram) throw new Error("간편 삽입은 플로차트와 시퀀스 다이어그램에서 사용할 수 있습니다. 샘플에서 선택하세요.");
  const flowchartKind = kind === "node" || kind === "decision" || kind === "arrow";
  if ((diagram === "flowchart") !== flowchartKind) {
    throw new Error(diagram === "flowchart" ? "플로차트에는 노드·조건·화살표를 추가할 수 있습니다." : "시퀀스 다이어그램에는 참여자·메시지를 추가할 수 있습니다.");
  }
  let line: string;
  if (kind === "arrow") {
    checkIds(from, to);
    line = `${from} --> ${to}`;
  } else if (kind === "message") {
    checkIds(from, to);
    line = `${from}->>${to}: ${entities(label, true)}`;
  } else {
    if (!label.trim()) throw new Error(kind === "participant" ? "참여자 이름을 입력하세요." : "노드 이름을 입력하세요.");
    if (kind === "participant") {
      line = `participant ${nextId(code, "P")} as ${entities(label, true)}`;
    } else {
      const id = nextId(code, "N");
      line = kind === "node" ? `${id}["${entities(label)}"]` : `${id}{"${entities(label)}"}`;
    }
  }
  return `${code.trimEnd()}\n    ${line}\n`;
}
