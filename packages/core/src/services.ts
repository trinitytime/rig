/** 플러그인이 제공하는 서비스의 레지스트리. */
export class ServiceRegistry {
  private services = new Map<string, { owner: string; impl: unknown }>();

  provide(owner: string, name: string, impl: unknown): void {
    const existing = this.services.get(name);
    if (existing) throw new Error(`service "${name}" is already provided by "${existing.owner}"`);
    this.services.set(name, { owner, impl });
  }

  get<T = unknown>(name: string): T {
    const s = this.services.get(name);
    if (!s) throw new Error(`service "${name}" is not available`);
    return s.impl as T;
  }

  /** 플러그인이 내려갈 때 그 플러그인이 등록한 서비스를 모두 제거한다. */
  removeOwner(owner: string): void {
    for (const [name, s] of this.services) if (s.owner === owner) this.services.delete(name);
  }
}
