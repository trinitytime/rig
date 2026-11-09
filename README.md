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

모든 패키지의 빌드 결과는 저장소 루트 `dist/<패키지 폴더>/`에 생성됩니다.

```
dist/core/  dist/plugin-browser/  dist/plugin-storage/  dist/plugin-ui-layout/
```

각 플러그인 폴더의 `manifest.json`이 플러그인 매니페스트입니다. `backend`는 해당 플러그인의 빌드 출력 폴더(`dist/<폴더>/`) 기준 상대경로입니다.
