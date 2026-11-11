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
  /** 신호를 구독한다. 이름은 `<발행자 id>:<이벤트>` (예: "storage:changed"). 반환값은 구독 해제 함수. */
  on(signal: string, fn: (payload: unknown) => void | Promise<void>): () => void;
  /** 이 플러그인의 이벤트를 발행한다. 이름에는 이벤트만 쓴다 (코어가 `<내 id>:` 를 붙인다). payload는 JSON 값만. */
  emit(event: string, payload?: unknown): void;
}

export interface PluginService {
  /** 이 플러그인의 함수를 등록한다. 외부 이름은 `<내 id>.<name>`. 인자와 반환값은 JSON 값만. 반환값은 등록 해제 함수. */
  provide(name: string, fn: (...args: any[]) => unknown): () => void;
  /** 다른 플러그인의 함수를 부른다 (예: "storage.get"). manifest의 requires에 선언한 플러그인만 가능. */
  call<T = unknown>(target: string, ...args: unknown[]): Promise<T>;
}

export interface PluginContext {
  log: PluginLogger;
  /** 사용자 데이터 폴더 아래 이 플러그인 전용 폴더 경로. */
  dataDir: string;
  timer: PluginTimer;
  signal: PluginSignal;
  service: PluginService;
}

/** 정리 함수. ctx로 등록한 것은 코어가 알아서 해제하므로, 그 밖의 외부 자원을 닫을 때만 필요하다. */
export type PluginCleanup = () => void | Promise<void>;

/** 백엔드 모듈이 default export로 내보내야 하는 함수. 정리 함수를 반환할 수 있다. */
export type RigPlugin = (ctx: PluginContext) => void | PluginCleanup | Promise<void | PluginCleanup>;

export const definePlugin = (p: RigPlugin): RigPlugin => p;
