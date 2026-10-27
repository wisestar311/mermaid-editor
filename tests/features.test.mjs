import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLibrary, filterLibrary, exportLibrary, parseLibraryExport, mergeLibrary } from '../src/components/editor/library-store.ts';
import { quickDiagram, quickInsert } from '../src/components/editor/quick-insert.ts';

test('보관함 데이터 손상을 감지해 덮어쓰기를 막는다', () => {
  assert.deepEqual(parseLibrary(null), []);
  for (const data of ['null', '{}', '[{}]', 'broken']) assert.throws(() => parseLibrary(data));
});
test('이름·코드 검색과 즐겨찾기 정렬', () => {
  const items = [
    { id: '1', name: '주문 흐름', updatedAt: 2, favorite: false, state: { code: 'A-->B', mermaid: '{}', rough: false, grid: true } },
    { id: '2', name: '결제', updatedAt: 1, favorite: true, state: { code: 'C-->D', mermaid: '{}', rough: false, grid: true } },
  ];
  assert.deepEqual(parseLibrary(JSON.stringify(items)), items);
  assert.equal(filterLibrary(items, '', false)[0].id, '2');
  assert.equal(filterLibrary(items, '주문', false)[0].id, '1');
  assert.equal(filterLibrary(items, 'c-->d', true)[0].id, '2');
  assert.equal(filterLibrary(items, '주문', true).length, 0);
});
test('간편 삽입은 중복 ID를 피하고 레이블을 인코딩한다', () => {
  const node = quickInsert('flowchart TD\nN1-->N2', 'node', '시작 "확인"', '', '');
  assert.ok(node.includes('N3["시작 #34;확인#34;"]'));
  const decision = quickInsert(node, 'decision', '승인?', '', '');
  assert.ok(decision.includes('N4{"승인?"}'));
  assert.ok(quickInsert(decision, 'arrow', '', 'N3', 'N4').endsWith('    N3 --> N4\n'));
  assert.throws(() => quickInsert('sequenceDiagram', 'node', '시작', '', ''));
  assert.throws(() => quickInsert(node, 'arrow', '', 'N1;evil', 'N2'));
});

const item = (id, updatedAt, extra = {}) => ({ id, name: id, updatedAt, favorite: false, state: { code: 'A-->B', mermaid: '{}', rough: false, grid: true }, ...extra });

test('보관함 백업은 내보낸 그대로 가져오고 최신 항목만 반영한다', () => {
  const items = [item('a', 1, { thumbnail: 'data:image/png;base64,AAAA' }), item('b', 5)];
  assert.deepEqual(parseLibraryExport(exportLibrary(items)), items);
  assert.deepEqual(parseLibraryExport(JSON.stringify(items)), items);
  const merged = mergeLibrary(items, [item('a', 3), item('b', 2), item('c', 1)]);
  assert.deepEqual([merged.added, merged.updated, merged.skipped], [1, 1, 1]);
  assert.equal(merged.items.find((entry) => entry.id === 'a').updatedAt, 3);
  assert.equal(merged.items.find((entry) => entry.id === 'b').updatedAt, 5);
  for (const text of ['not json', '{}', '{"app":"other","items":[]}', JSON.stringify({ app: 'mermaid-editor-library', items: [{}] })]) {
    assert.throws(() => parseLibraryExport(text));
  }
});

test('썸네일은 래스터 이미지 data URL만 허용한다', () => {
  for (const thumbnail of ['data:image/svg+xml;base64,AAAA', 'javascript:alert(1)', 'https://example.com/a.png', 5]) {
    assert.throws(() => parseLibrary(JSON.stringify([item('a', 1, { thumbnail })])));
  }
  assert.equal(parseLibrary(JSON.stringify([item('a', 1, { thumbnail: 'data:image/webp;base64,UklG' })])).length, 1);
});

test('간편 삽입은 방향 생략·front matter·시퀀스 다이어그램을 인식한다', () => {
  assert.equal(quickDiagram('flowchart\n  A-->B'), 'flowchart');
  assert.equal(quickDiagram('---\ntitle: 흐름\n---\n%% 메모\ngraph LR\nA-->B'), 'flowchart');
  assert.equal(quickDiagram('%%{init: {}}%%\nsequenceDiagram\nA->>B: hi'), 'sequence');
  assert.equal(quickDiagram('classDiagram\nflowchart TD'), undefined);
  const participant = quickInsert('sequenceDiagram\n  participant P1', 'participant', '서버; "API"', '', '');
  assert.ok(participant.endsWith('    participant P2 as 서버#59; #34;API#34;\n'));
  assert.ok(quickInsert(participant, 'message', '요청 <확인>', 'P1', 'P2').endsWith('    P1->>P2: 요청 #60;확인#62;\n'));
  assert.throws(() => quickInsert(participant, 'node', '노드', '', ''), /참여자·메시지/);
  assert.throws(() => quickInsert('flowchart LR', 'message', 'hi', 'A', 'B'), /노드·조건·화살표/);
});
