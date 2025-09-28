import type { IntegrationAdapter } from "../types/index.js";

export class IntegrationHost {
  private readonly adapters = new Map<string, IntegrationAdapter>();

  register(adapter: IntegrationAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error("Adapter " + adapter.name + " already registered.");
    }
    this.adapters.set(adapter.name, adapter);
  }

  unregister(name: string): void {
    this.adapters.delete(name);
  }

  list(): IntegrationAdapter[] {
    return Array.from(this.adapters.values());
  }

  async invoke<TArgs, TResult>(name: string, args: TArgs): Promise<TResult> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error("Unknown adapter " + name + ".");
    }
    const result = await adapter.invoke(args);
    return result as TResult;
  }
}
