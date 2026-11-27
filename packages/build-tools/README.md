# @rig-works/build-tools

패키지 빌드를 `build.config.ts`에 Task 목록으로 적고, `rig-build` 명령으로 실행하는 도구입니다.

## 사용법

패키지 폴더에 `build.config.ts`를 두고 실행합니다.

```sh
rig-build              # 정의된 모든 작업을 정의된 순서대로 실행
rig-build build        # 이름을 준 작업만 실행
rig-build types bundle # 여러 개도 가능
```

- 설정 파일은 현재 디렉터리의 `build.config.ts`입니다. 모든 경로는 현재 디렉터리 기준입니다.
- 없는 작업 이름을 주면 아무것도 실행하지 않고 종료 코드 1로 끝납니다.
- Task가 하나라도 실패하면 그 작업을 멈추고 종료 코드 1로 끝납니다.

`package.json`에서는 보통 이렇게 연결합니다.

```json
{
  "scripts": { "build": "rig-build build" },
  "devDependencies": { "@rig-works/build-tools": "workspace:*" }
}
```

## build.config.ts 작성

`defineBuild`에 작업(Job) 이름과 Task 목록을 적어서 default export 합니다.

```ts
import { clean, copy, defineBuild, job, json, on, run, set } from '@rig-works/build-tools'

export default defineBuild({
  build: job([
    set({ outDir: 'dist' }),
    clean(),
    run(({ outDir }) => `tsdown src/index.ts --dts --out-dir ${outDir}`),
    on('README.md', copy()),
    on('package.json', json((pkg) => ({ ...pkg, scripts: undefined }))),
  ]),
  check: job([run('tsc --noEmit')]), // outDir 없이도 쓸 수 있다
})
```

- **Job**: `job([...Task])`는 이름이 붙은 작업 하나입니다. Task는 위에서 아래로 순서대로 실행됩니다.
- **변수 공간(ctx)**: Job마다 빈 변수 공간에서 시작합니다. Job끼리는 공유하지 않습니다.

## Task

### `set(vars)`

변수 공간에 값을 씁니다. 같은 키는 덮어씁니다. 이후 Task가 이 값을 읽습니다.

```ts
set({ outDir: 'dist', minify: true })
```

`outDir`은 예약된 변수로, `on()`이 파일을 쓸 위치입니다. 같은 Job 안에서 여러 번 바꿀 수 있습니다.

### `run(command)`

명령을 실행합니다. 종료 코드가 0이 아니면 Job을 멈춥니다.

```ts
run('tsc --noEmit')
run(({ outDir }) => `tsdown src/index.ts --out-dir ${outDir}`) // 변수를 꺼내 쓰는 함수 형태
```

zx로 실행하며 기본 셸은 bash입니다. 명령은 문자열 그대로 셸에 전달됩니다(따옴표 처리 없음).

### `clean()`

`outDir`을 지웁니다. `outDir`이 없으면 아무것도 하지 않습니다.
현재 디렉터리 안쪽의 하위 경로만 지웁니다. 현재 디렉터리 자신, 상위 경로, 바깥 경로는 경고만 하고 건너뜁니다.

### `on(patterns, processors?)`

파일 선택과 처리를 분리해서 적습니다.

```ts
on('README.md', copy())
on('assets/**/*.png', resizeProcessor)
on(['a.json', 'b.json'], [json(fn1), json(fn2)])
```

- `patterns`: glob 문자열이나 배열입니다. 현재 디렉터리 기준입니다.
- `processors`: 처리 하나 또는 배열입니다. 배열이면 앞 처리의 결과를 다음 처리가 받는 파이프라인입니다. 생략하면 복사합니다.
- 결과는 `outDir` 아래 **원본과 같은 상대 경로**로 씁니다. 필요한 폴더는 만듭니다.
- 같은 파일에 여러 `on()`이 걸리면 뒤에 실행된 것이 덮어씁니다. 입력은 항상 원본 파일에서 읽습니다. 앞 Task가 쓴 결과물을 이어받지 않으므로, 여러 처리를 이어야 하면 배열로 씁니다.
- `outDir`이 설정되지 않았으면 에러입니다. 고른 파일이 없으면 에러 없이 건너뜁니다. glob이나 경로 오타도 조용히 지나가니 주의하세요.

## 처리(Processor)

`on()`에 넣는 처리입니다.

### `copy(dest?)`

내용은 그대로 두고, 쓸 경로를 바꿀 수 있습니다. 경로는 `outDir` 기준입니다.

```ts
on('aaa/bbb.js', copy('ccc/bbb.js'))                          // <outDir>/ccc/bbb.js
on('aaa/**/*.js', copy((file) => file.replace('aaa', 'ccc'))) // 구조를 유지하며 폴더 이동
```

글롭으로 여러 파일을 고르면서 문자열 목적지를 쓰면 같은 경로에 서로 덮어씁니다. 그때는 함수 형태를 쓰세요.

### `json(fn)`

JSON 파일을 읽어 `fn(data, ctx)`가 돌려준 값으로 바꿔 씁니다(2칸 들여쓰기, 끝에 줄바꿈).

```ts
on('package.json', json((pkg, ctx) => ({ ...pkg, scripts: undefined })))
```

### `workspaceDeps()`

`package.json`의 `dependencies`, `peerDependencies`, `optionalDependencies`에서 `workspace:` 항목을 실제 버전 범위로 바꿉니다. 배포할 `package.json`에 `workspace:*`가 남아 있으면 설치가 실패하기 때문입니다.

```ts
on('package.json', [json((pkg) => ({ ...pkg, scripts: null })), workspaceDeps()])
```

- `workspace:*`와 `workspace:^`는 `^<버전>`, `workspace:~`는 `~<버전>`으로 바꿉니다. `workspace:^1.0.0`처럼 범위를 직접 쓰면 `workspace:`만 뗍니다.
- 버전은 현재 디렉터리부터 위로 올라가며 찾은 `node_modules/<이름>/package.json`(워크스페이스 링크)에서 읽습니다. 설치가 안 되어 있으면 에러입니다.

### 직접 만들기

처리는 함수입니다. `(content, file, ctx) => Buffer | { content, file }` 모양이면 됩니다.

```ts
on('dist/index.mjs', (content) => Buffer.concat([Buffer.from('#!/usr/bin/env node\n'), content]))
```

- `content`는 `Buffer`, `file`은 현재까지 정해진 쓸 경로입니다.
- `Buffer`만 돌려주면 내용만 바뀝니다. `{ content, file }`을 돌려주면 쓸 경로도 바뀝니다.

## 알아둘 점

- **제자리 수정**: `on()`은 `outDir` 아래에 쓰므로, 이미 만든 파일을 제자리에서 고치려면 `set({ outDir: '.' })`로 바꾼 뒤 `on('dist/index.mjs', ...)`처럼 씁니다.
- **변수 타입**: 변수 공간은 `Record<string, unknown>`입니다. 값의 타입은 검사하지 않습니다.
- **병렬 실행 없음**: Task와 Job은 모두 순서대로 실행됩니다.
- **Windows**: `run()`의 기본 셸이 bash라서 bash가 없는 환경에서는 동작하지 않을 수 있습니다.
