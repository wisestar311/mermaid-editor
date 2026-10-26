import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLibrary, filterLibrary } from '../src/components/editor/library-store.ts';
import { quickInsert } from '../src/components/editor/quick-insert.ts';

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
