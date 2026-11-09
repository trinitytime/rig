/** Rig kernel entry. Keep this minimal: lifecycle, RPC/event bus, service registry, server. */
export const RIG_API_VERSION = 1;

export interface PluginManifest {
  name: string;
  apiVersion: number;
  backend?: string;
  ui?: { entry: string; slot: string };
  requires?: string[];
  permissions?: string[];
}
export * from "./server.js";
