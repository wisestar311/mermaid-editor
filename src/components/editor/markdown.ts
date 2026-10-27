/** Locate the first Mermaid block while skipping other fenced code blocks. */
export function findMermaidBlocks(text: string) {
  const blocks: { start: number; end: number; code: string; marker: string; length: number }[] = [];
  const lines = [...text.matchAll(/[^\n]*(?:\n|$)/g)];
  let fence: { marker: string; length: number; start: number; mermaid: boolean } | undefined;
  for (const line of lines) {
    const value = line[0].replace(/\r?\n$/, "");
    if (!fence) {
      const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(value);
      if (!opening) continue;
      fence = {
        marker: opening[1][0], length: opening[1].length,
        start: line.index! + line[0].length,
        mermaid: /^mermaid(?:\s|$)/i.test(opening[2].trim()),
      };
    } else {
      const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(value);
      if (!closing || closing[1][0] !== fence.marker || closing[1].length < fence.length) continue;
      if (fence.mermaid) {
        blocks.push({ start: fence.start, end: line.index!, code: text.slice(fence.start, line.index!), marker: fence.marker, length: fence.length });
      }
      fence = undefined;
    }
  }
  return blocks;
}

export const findMermaidBlock = (text: string) => findMermaidBlocks(text)[0];

export function codeFromMarkdown(text: string) {
  const block = findMermaidBlock(text);
  if (!block) throw new Error("Markdown 파일에 닫힌 mermaid 코드 블록이 없습니다.");
  return block.code;
}

/** A new single-diagram document; the fence grows past any backtick run inside the code. */
export function markdownFor(code: string) {
  const longest = Math.max(0, ...[...code.matchAll(/^ {0,3}(`{3,})/gm)].map((match) => match[1].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}mermaid\n${code.trimEnd()}\n${fence}\n`;
}

/** Preserve the surrounding document and all other diagrams when overwriting. */
export function replaceMermaidBlock(document: string, code: string, index = 0) {
  const block = findMermaidBlocks(document)[index];
  if (!block) throw new Error("원본 Markdown의 mermaid 코드 블록을 찾지 못했습니다.");
  if (block.code === code) return document;
  // A line that would close the fence early breaks the document structure on the next read.
  const closing = new RegExp(`^ {0,3}${block.marker === "`" ? "`" : "~"}{${block.length},}[ \\t]*\\r?$`, "m");
  if (closing.test(code)) {
    throw new Error(`다이어그램 코드에 코드 블록을 닫는 줄(${block.marker.repeat(block.length)})이 있어 Markdown에 넣을 수 없습니다.`);
  }
  const newline = document.includes("\r\n") ? "\r\n" : "\n";
  const body = code.replace(/\r?\n/g, newline).trimEnd() + newline;
  return document.slice(0, block.start) + body + document.slice(block.end);
}

export type MarkdownPart = { kind: "text"; text: string } | { kind: "diagram"; code: string; index: number };

/** The document split into prose and diagrams, in reading order. */
export function markdownParts(document: string): MarkdownPart[] {
  const parts: MarkdownPart[] = [];
  let offset = 0;
  findMermaidBlocks(document).forEach((block, index) => {
    // The opening fence line ends right before the block body; drop it from the prose.
    const opening = document.lastIndexOf("\n", block.start - 2) + 1;
    const text = document.slice(offset, opening).trim();
    if (text) parts.push({ kind: "text", text });
    parts.push({ kind: "diagram", code: block.code, index });
    const closingEnd = document.indexOf("\n", block.end);
    offset = closingEnd === -1 ? document.length : closingEnd + 1;
  });
  const rest = document.slice(offset).trim();
  if (rest) parts.push({ kind: "text", text: rest });
  return parts;
}
