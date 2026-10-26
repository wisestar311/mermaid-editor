# Mermaid 에디터

로그인 없이 브라우저에서 Mermaid 다이어그램을 그리고, 내 컴퓨터에 `.mmd` 파일로 저장하는 한국어 에디터입니다.
오픈소스 [Mermaid Live Editor](https://github.com/mermaid-js/mermaid-live-editor)(MIT)를 바탕으로 만들었습니다.

## 실행

```bash
npm install
npm run dev      # 개발 서버: http://localhost:3000
npm run build    # 정적 사이트를 out/ 폴더에 생성
npm start        # out/ 폴더를 로컬에서 서빙
npm run check    # lint + 타입 검사 + 빌드
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
  - .md 파일을 열면 첫 mermaid 코드 블록을 불러옵니다
  - Chrome·Edge: 고른 파일에 바로 덮어쓰기 / Safari·Firefox: 다운로드
- 공유: 링크 복사, 기기 공유 시트(메시지·메일·카카오톡 등), 이미지로 공유,
  이메일·X·Facebook·LinkedIn·Telegram·LINE, GitHub·Notion용 코드 블록 복사
- PNG·SVG 내보내기, 이미지·마크다운 복사, Gist 불러오기
- 기록(저장한 버전, 자동 타임라인), 다크 모드
- 다이어그램은 URL과 브라우저 로컬 저장소에만 보관되며 서버로 보내지 않습니다.

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
