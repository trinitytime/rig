export interface PluginLogger {
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface PluginContext {
  name: string;
  log: PluginLogger;
  /** 사용자 데이터 폴더 아래 이 플러그인 전용 폴더 경로. */
  dataDir: string;
  services: {
    /** 이 플러그인 이름과 같은 이름의 서비스를 제공한다. */
    provide(impl: unknown): void;
    /** manifest의 requires에 선언한 서비스만 가져올 수 있다. */
    get<T = unknown>(name: string): T;
  };
}

/** 백엔드 모듈이 default export로 내보내야 하는 형태. */
export interface RigPlugin {
  activate(ctx: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

export const definePlugin = (p: RigPlugin): RigPlugin => p;
