# Mermaid 에디터

로그인 없이 브라우저에서 Mermaid 다이어그램을 그리고, 내 컴퓨터에 `.mmd` 파일로 저장하는 한국어 에디터입니다.
오픈소스 [Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor)(MIT)를 바탕으로 만들었습니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버: http://localhost:3000
npm run build    # 정적 사이트를 out/ 폴더에 생성
npm start        # out/ 폴더를 로컬에서 서빙
npm test         # 데이터 보존·공유 상태 회귀 테스트
npm run check    # lint + 타입 검사 + 테스트 + 빌드
```

`out/` 폴더를 그대로 올리면 어떤 정적 호스팅(Netlify, Vercel, S3 등)에서도 동작합니다.
하위 경로에 올릴 때는 `BASE_PATH=/경로 npm run build`로 빌드하세요.

## 배포

`main`에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 lint·타입 검사·빌드를 거쳐
GitHub Pages에 배포합니다: https://wisestar311.github.io/mermaid-editor/

## 기능

- Monaco 코드 에디터(자동완성, 오류 줄 표시), 설정(JSON) 탭
- 실시간 미리보기, 확대·축소·이동, 손그림 스타일, 배경 격자, 앱 안 전체 화면
- 파일 저장: 저장(⌘S), 다른 이름으로 저장(⇧⌘S), 열기(⌘O)
  - 형식: Mermaid(.mmd), Markdown(.md, mermaid 코드 블록), SVG, PNG
  - SVG·PNG는 사본으로 저장하고, 편집 중인 파일은 그대로 둡니다
  - .md 파일을 열면 첫 mermaid 코드 블록을 불러옵니다. 일반 저장은 앞뒤 본문과 다른 코드 블록을 보존합니다. 다른 이름으로 저장은 현재 다이어그램만 새 문서로 내보냅니다.
  - Chrome·Edge: 고른 파일에 바로 덮어쓰기 / Safari·Firefox: 다운로드
- 공유: 링크 복사, 기기 공유 시트(메시지·메일·카카오톡 등), 이미지로 공유,
  이메일·X·Facebook·LinkedIn·Telegram·LINE, GitHub·Notion용 코드 블록 복사
- PNG·SVG 내보내기, 이미지·마크다운 복사, Gist 불러오기
- 기록(저장한 버전, 자동 타임라인, 샘플·기록·파일 불러오기 직전 코드 백업), 다크 모드
- 편집·파일 저장은 브라우저에서 처리합니다. 공유 링크에는 코드·설정이 포함됩니다.
- mermaid.ink·Kroki 외부 렌더러 및 외부 이미지 마크다운 사용 시 다이어그램이 해당 서비스로 전송됩니다. Gist는 GitHub, 아이콘 글꼴은 CDN에 연결합니다.

## 구성

| 경로 | 내용 |
| --- | --- |
| `src/app/` | 레이아웃과 `/` 페이지 |
| `src/components/editor/` | 에디터 전체 (`live-editor.tsx`가 진입점) |
| `src/components/editor/diagram-file.ts` | 파일 저장·열기, 형식, 단축키 |
| `src/components/editor/save-as-dialog.tsx` | 다른 이름으로 저장 창 |
| `src/components/editor/share-dialog.tsx` | 공유 창 |
| `src/components/editor/exporters.ts` | SVG·PNG 생성 (내보내기·저장·공유 공용) |
| `src/components/editor/ko.ts` | 샘플 다이어그램 이름 번역 |
| `src/components/editor/fonts/` | Recursive(OFL), Pretendard(OFL, 라이선스 포함) |
| `docs/UPSTREAM-LICENSE-mermaid-live-editor.txt` | 원본 에디터의 MIT 라이선스 |

## 보관함·모바일·오프라인

- **보관함**: 상단 또는 메인 메뉴의 보관함에서 현재 코드와 설정을 이름으로 저장합니다. 썸네일 미리보기, 이름·코드 검색, 즐겨찾기, 이름 변경, 현재 작업으로 갱신, 삭제를 지원합니다. 브라우저별 로컬 저장소를 사용하므로 `백업 내보내기`로 JSON 파일을 만들어 두고, 다른 기기에서는 `백업 가져오기`로 합칩니다(같은 항목은 더 최근 것만 반영).
- **간편 삽입**: 코드 아래의 `＋ 간편 삽입`에서 플로차트에는 노드·조건·화살표를, 시퀀스 다이어그램에는 참여자·메시지를 끝에 추가합니다. 모바일은 기본 텍스트 입력창으로 편집합니다.
- **기록 비교**: 기록 패널의 비교 버튼으로 기록과 현재 코드를 나란히 비교하고 복원합니다.
- **Markdown 선택 편집**: `.md`를 열면 코드 위 선택 상자에서 다이어그램을 고르고, `전체 미리보기`로 문서의 모든 다이어그램을 한 화면에서 봅니다. 블록을 바꿔도 편집 내용이 유지되며, 저장과 다른 이름으로 저장(.md) 모두 문서 본문과 모든 다이어그램을 함께 저장합니다. 코드에 블록을 닫는 줄(```` ``` ````)이 있으면 문서가 깨지지 않도록 저장을 막습니다.
- **PWA**: 빌드 후 `scripts/build-pwa.mjs`가 아이콘·매니페스트·서비스 워커를 생성합니다. 설치할 때는 첫 화면에 필요한 파일(약 0.6MB)만 받고, 나머지는 쓰는 순간 캐시합니다. 메인 메뉴의 `오프라인·앱 설치`에서 모든 기능을 한 번에 내려받을 수 있습니다(약 26MB). 새 버전이 나와도 바뀌지 않은 파일은 다시 받지 않습니다. 외부 아이콘 글꼴·Gist·외부 렌더러는 인터넷이 필요합니다.
- **설치**: 지원 브라우저에는 앱 설치 버튼이 표시됩니다. iPhone·iPad는 Safari 공유 메뉴에서 홈 화면에 추가합니다. 새 배포는 `새 버전 적용` 버튼으로 전환합니다.
- **저장 안 됨 표시**: 파일과 연결된 작업만 저장 안 됨(●)과 페이지 이탈 경고를 표시합니다. 파일 없이 하는 작업은 URL과 로컬 저장소에 자동 보관됩니다.
- `BASE_PATH=/mermaid-editor npm run build`로 하위 경로 배포를 지원합니다. 서비스 워커 캐시는 해당 경로 안에서만 동작합니다.

브라우저 데이터 삭제 시 보관함과 오프라인 캐시도 사라질 수 있으므로 중요한 작업은 파일로도 저장하세요.
