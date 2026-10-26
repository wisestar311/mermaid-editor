import assert from 'node:assert/strict';
import test from 'node:test';
import { codeFromMarkdown, replaceMermaidBlock } from '../src/components/editor/markdown.ts';
import { normalizeState, parseConfig, serializeState, deserializeState, defaultState, persistState } from '../src/components/editor/state.ts';

test('Markdown 저장은 본문과 두 번째 다이어그램을 보존한다', () => {
  const source = '# 설명\n\n```mermaid\nflowchart TD\n A-->B\n```\n\n본문\n```mermaid\nflowchart LR\n X-->Y\n```\n';
  assert.equal(codeFromMarkdown(source), 'flowchart TD\n A-->B\n');
  assert.equal(replaceMermaidBlock(source, 'flowchart LR\n C-->D'), source.replace('flowchart TD\n A-->B\n', 'flowchart LR\n C-->D\n'));
});

test('긴 fence, 들여쓰기, CRLF 및 다른 언어의 코드 블록을 처리한다', () => {
  const source = '```text\n```mermaid\nnot a diagram\n```\n\n  ~~~~mermaid\r\nA-->B\r\n  ~~~~\r\n끝';
  assert.equal(codeFromMarkdown(source), 'A-->B\r\n');
  assert.equal(replaceMermaidBlock(source, 'C-->D\nD-->E'), source.replace('A-->B\r\n', 'C-->D\r\nD-->E\r\n'));
});

test('Mermaid 블록이 없는 문서는 코드로 오인하지 않는다', () => {
  for (const source of ['# 문서', '```mermaid\nA-->B', '```mermaidx\nA-->B\n```']) {
    assert.throws(() => codeFromMarkdown(source));
  }
});

test('잘못된 공유 상태는 필드별로 기본값을 사용한다', () => {
  const state = normalizeState({ code: 5, mermaid: null, grid: 'no', pan: { x: Infinity, y: 1 }, zoom: -1, editorMode: 'bogus' });
  assert.deepEqual(state, defaultState);
  assert.throws(() => normalizeState(null));
  assert.throws(() => normalizeState([]));
});

test('한글 공유 링크가 왕복 복원된다', () => {
  const state = { ...defaultState, code: 'flowchart TD\n A[시작]-->B[끝]' };
  assert.deepEqual(deserializeState(serializeState(state)), state);
});

test('설정은 JSON 객체만 허용한다', () => {
  for (const value of ['null', '[]', '42', 'true', '"dark"', '{']) assert.throws(() => parseConfig(value));
  assert.deepEqual(parseConfig('{"theme":"dark"}'), { theme: 'dark' });
});

test('URL 저장이 실패해도 로컬 백업을 수행한다', () => {
  let stored;
  globalThis.window = { history: { replaceState() { throw new Error('URL limit'); } } };
  globalThis.localStorage = { setItem(key, value) { stored = JSON.parse(value); } };
  try {
    persistState(defaultState);
    assert.deepEqual(stored, defaultState);
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
  }
});

test('여러 Markdown 블록을 번갈아 편집해도 각 변경과 본문을 보존한다', async () => {
  const { findMermaidBlocks } = await import('../src/components/editor/markdown.ts');
  const source = '# 문서\n```mermaid\nA-->B\n```\n중간\n~~~mermaid\nC-->D\n~~~\n끝';
  assert.equal(findMermaidBlocks(source).length, 2);
  const first = replaceMermaidBlock(source, 'A-->Z', 0);
  const second = replaceMermaidBlock(first, 'C-->X', 1);
  assert.deepEqual(findMermaidBlocks(second).map((block) => block.code), ['A-->Z\n', 'C-->X\n']);
  assert.ok(second.includes('```\n중간\n~~~mermaid'));
  assert.ok(second.endsWith('~~~\n끝'));
  assert.equal(replaceMermaidBlock(source, 'A-->B\n'), source);
});
