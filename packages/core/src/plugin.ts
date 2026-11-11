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

export interface PluginContext {
  log: PluginLogger;
  /** 사용자 데이터 폴더 아래 이 플러그인 전용 폴더 경로. */
  dataDir: string;
  timer: PluginTimer;
  signal: PluginSignal;
  services: {
    /** 이 플러그인 이름과 같은 이름의 서비스를 제공한다. */
    provide(impl: unknown): void;
    /** manifest의 requires에 선언한 서비스만 가져올 수 있다. */
    get<T = unknown>(name: string): T;
  };
}

/** 정리 함수. ctx로 등록한 것은 코어가 알아서 해제하므로, 그 밖의 외부 자원을 닫을 때만 필요하다. */
export type PluginCleanup = () => void | Promise<void>;

/** 백엔드 모듈이 default export로 내보내야 하는 함수. 정리 함수를 반환할 수 있다. */
export type RigPlugin = (ctx: PluginContext) => void | PluginCleanup | Promise<void | PluginCleanup>;

export const definePlugin = (p: RigPlugin): RigPlugin => p;
