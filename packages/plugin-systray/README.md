# systray

시스템 트레이 아이콘의 메뉴를 shared의 `tray` 공간 값으로 구성하는 플러그인입니다.
메뉴에 항목을 넣으려면 다른 플러그인이 `tray` 공간에 값을 쓰면 됩니다. `requires` 선언은 필요 없습니다.

## 값 넣기

- 공간(workspace): `tray`
- key: 항목마다 하나. 영문자, 숫자, `.`, `-`, `_` 1~64자 (shared의 key 규칙). 보통 `id`와 같은 값을 씁니다.
- value: 아래 형태의 JSON 객체

```json
{ "id": "open-dashboard", "name": "Dashboard 열기", "signal": "myplugin:open-dashboard", "order": 10 }
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 항목 식별자 |
| `name` | string | 메뉴에 표시되는 이름 |
| `signal` | string | 항목을 클릭하면 발행되는 신호 이름 |
| `order` | number | 정렬 순서. 작을수록 위에 표시되고, 같으면 `name` 순 |

```ts
const plugin: RigPlugin = async (ctx) => {
  await ctx.shared.set("tray", "open-dashboard", {
    id: "open-dashboard",
    name: "Dashboard 열기",
    signal: "myplugin:open-dashboard",
    order: 10,
  });
  ctx.signal.on("myplugin:open-dashboard", () => {
    // 메뉴를 클릭했을 때 실행할 일
  });
};
```

## 동작

- 값을 쓰거나 지우면(`shared:tray` 신호) 메뉴가 전체를 다시 만들어 갱신됩니다.
- 항목을 클릭하면 `signal`이 payload 없이 발행됩니다.
- 항목을 지우려면 `ctx.shared.delete("tray", key)` 또는 `ctx.shared.set("tray", key, null)`을 호출합니다. 값을 쓴 플러그인이 비활성화되면 그 플러그인의 항목은 자동으로 사라집니다.
- 같은 key는 처음 쓴 플러그인만 바꾸거나 지울 수 있습니다 (shared의 소유권 규칙).
- 코어가 `Exit` 항목(`order: 9999`, `signal: "core:exit"`)을 기본으로 넣어 둡니다. 맨 아래에 두려면 `order`를 9999보다 작게 쓰세요.

## 주의

- 위 네 필드 중 하나라도 없거나 타입이 다른 값은 경고 로그를 남기고 메뉴에서 제외됩니다.
- 신호 이름은 영문자, 숫자, `.`, `:`, `-`, `_` 1~128자이어야 하고, `shared:`로 시작하면 코어 전용이라 발행에 실패합니다 (오류 로그만 남고 아무 일도 일어나지 않습니다).
- 하위 메뉴, 구분선, 체크 표시, 비활성 항목은 지원하지 않습니다.

## 아이콘

`assets/rig-icons/tray`의 파일을 사용합니다: Windows `rig-tray-dark.ico`, macOS `rigTemplate-2x.png`, Linux `rig-tray-22.png`.
