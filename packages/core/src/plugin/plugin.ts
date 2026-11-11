export interface PluginLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

/** 반환값은 취소 함수. 플러그인이 내려가면 남은 타이머는 코어가 모두 취소한다. */
export interface PluginTimer {
  setTimeout(fn: () => void | Promise<void>, delay: number): () => void;
  /** 이전 실행이 끝나지 않았으면 그 주기는 건너뛴다. */
  setInterval(fn: () => void | Promise<void>, interval: number): () => void;
}

export interface PluginSignal {
  /** 신호를 구독한다. 이름은 자유롭게 쓰며, 누가 emit했든 같은 이름이면 전달된다. 반환값은 구독 해제 함수. */
  on(signal: string, fn: (payload: unknown) => void | Promise<void>): () => void;
  /** 신호를 발행한다. payload는 JSON 값만. `shared:` 로 시작하는 이름은 코어 전용이라 쓸 수 없다. */
  emit(signal: string, payload?: unknown): void;
}

export interface PluginService {
  /** 이 플러그인의 함수를 등록한다. 외부 이름은 `<내 id>.<name>`. 인자와 반환값은 JSON 값만. 반환값은 등록 해제 함수. */
  provide(name: string, fn: (...args: any[]) => unknown): () => void;
  /** 다른 플러그인의 함수를 부른다 (예: "storage.get"). manifest의 requires에 선언한 플러그인만 가능. */
  call<T = unknown>(target: string, ...args: unknown[]): Promise<T>;
}

export interface PluginHttp {
  /**
   * 웹 API 핸들러를 등록한다 (플러그인당 1개). `/api/<내 id>/*` 요청이 오며,
   * 요청 경로에서 접두사가 제거된다 (예: /api/<id>/items → /items). 반환값은 등록 해제 함수.
   */
  fetch(handler: (req: Request) => Response | Promise<Response>): () => void;
}

/**
 * 메모리에만 있는 플러그인 간 공유 값. workspace에는 소유자가 없고 key마다 소유자가 있다:
 * key를 처음 쓴 플러그인이 소유자이며 소유자만 바꾸거나 지울 수 있고, 읽기는 누구나 가능하다.
 * 지우면 소유권도 사라지고, 소유자가 비활성화되면 그 플러그인의 key는 모두 지워진다.
 */
export interface PluginShared {
  /** 값을 쓴다 (JSON만). null이나 undefined를 쓰면 삭제로 처리한다. */
  set(workspace: string, key: string, value: unknown): Promise<void>;
  /** 값을 읽는다. 없으면 undefined. */
  get<T = unknown>(workspace: string, key: string): Promise<T | undefined>;
  /** workspace의 모든 key/value를 읽는다. 없으면 {}. */
  get<T = Record<string, unknown>>(workspace: string): Promise<T>;
  /** key를 지운다 (소유자만). 없으면 아무 일도 없다. */
  delete(workspace: string, key: string): Promise<void>;
}

/** 플러그인 전용 폴더의 data.json 하나에 JSON 값 하나를 저장한다. */
export interface PluginStorage {
  /** 값(JSON)을 그대로 data.json에 저장한다. 이전 내용은 덮어쓴다. */
  save(value: unknown): Promise<void>;
  /** data.json을 읽어서 반환한다. 저장한 적이 없으면 undefined. */
  load<T = unknown>(): Promise<T | undefined>;
}

export interface PluginContext {
  log: PluginLogger;
  /** 사용자 데이터 폴더 아래 이 플러그인 전용 폴더 경로. */
  dataDir: string;
  timer: PluginTimer;
  signal: PluginSignal;
  http: PluginHttp;
  storage: PluginStorage;
  shared: PluginShared;
  service: PluginService;
}

/** 정리 함수. ctx로 등록한 것은 코어가 알아서 해제하므로, 그 밖의 외부 자원을 닫을 때만 필요하다. */
export type PluginCleanup = () => void | Promise<void>;

/** 백엔드 모듈이 default export로 내보내야 하는 함수. 정리 함수를 반환할 수 있다. */
export type RigPlugin = (ctx: PluginContext) => void | PluginCleanup | Promise<void | PluginCleanup>;

export const definePlugin = (p: RigPlugin): RigPlugin => p;
