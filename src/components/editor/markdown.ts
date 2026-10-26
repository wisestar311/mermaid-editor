/** Locate the first Mermaid block while skipping other fenced code blocks. */
export function findMermaidBlocks(text: string) {
  const blocks: { start: number; end: number; code: string }[] = [];
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
      if (fence.mermaid) blocks.push({ start: fence.start, end: line.index!, code: text.slice(fence.start, line.index!) });
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

export const markdownFor = (code: string) => `\`\`\`mermaid\n${code.trimEnd()}\n\`\`\`\n`;

/** Preserve the surrounding document and all other diagrams when overwriting. */
export function replaceMermaidBlock(document: string, code: string, index = 0) {
  const block = findMermaidBlocks(document)[index];
  if (!block) throw new Error("원본 Markdown의 mermaid 코드 블록을 찾지 못했습니다.");
  if (block.code === code) return document;
  const newline = document.includes("\r\n") ? "\r\n" : "\n";
  const body = code.replace(/\r?\n/g, newline).trimEnd() + newline;
  return document.slice(0, block.start) + body + document.slice(block.end);
}
