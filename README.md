# Rig

기능 없는 빈 JS 플러그인 호스트. 커널(`core`)은 최소로 유지하고, 나머지 기능은 플러그인으로 제공합니다.

## 구조

```
packages/
  core/               # 구동부(커널): 플러그인 로드, RPC/이벤트 버스, 서비스 레지스트리, 서버
  plugin-browser/     # `browser` 서비스: 숨은 브라우저 자동화
  plugin-storage/     # `storage` 서비스
  plugin-ui-layout/   # `ui-layout` 서비스: 셸 슬롯
```

## 개발

```bash
npm install
npm run build
npm run typecheck
```

npm workspaces 기반이며, 새 패키지는 `packages/` 아래에 추가하면 자동으로 워크스페이스에 포함됩니다.

## 빌드 산출물

`core`(`tsc -b`)의 빌드 결과는 저장소 루트 `dist/core/`에 생성되고, `npm run bundle`은 단일 파일 `dist/rig.js`를 만듭니다.
플러그인은 빌드하지 않고 소스(`.ts`)를 그대로 실행합니다. `npm run typecheck`는 `core`와 플러그인(`tsconfig.plugins.json`)의 타입만 검사합니다.

## 플러그인 매니페스트

각 플러그인 폴더의 `manifest.json`이 플러그인 매니페스트입니다. `entry`는 백엔드 파일(`.ts` 또는 `.js`) 하나를 정확히 가리키는, `manifest.json`이 있는 폴더 기준 상대경로입니다. 플러그인 폴더 밖을 가리키는 경로(절대경로, `..`, 폴더 밖으로 향하는 심볼릭 링크)는 거부되며, UI 전용 플러그인은 `entry`를 생략합니다.
