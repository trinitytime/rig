/** 플러그인이 제공하는 서비스의 레지스트리. */
export class ServiceRegistry {
  private services = new Map<string, { owner: string; impl: unknown }>();

  /** 등록하고, 등록을 해제하는 함수를 돌려준다. */
  provide(owner: string, name: string, impl: unknown): () => void {
    const existing = this.services.get(name);
    if (existing) throw new Error(`service "${name}" is already provided by "${existing.owner}"`);
    const entry = { owner, impl };
    this.services.set(name, entry);
    return () => {
      if (this.services.get(name) === entry) this.services.delete(name);
    };
  }

  get<T = unknown>(name: string): T {
    const s = this.services.get(name);
    if (!s) throw new Error(`service "${name}" is not available`);
    return s.impl as T;
  }
}
