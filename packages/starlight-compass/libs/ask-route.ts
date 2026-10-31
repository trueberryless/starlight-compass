import { fileURLToPath } from "node:url";

import type { AskConfig } from "./config";
import { throwPluginError } from "./error";
import type { CompassProvider } from "./provider";

export const ASK_CONFIG_MODULE = "virtual:starlight-compass/ask-config";
export const ASK_PROVIDER_MODULE = "virtual:starlight-compass/ask-provider";

const RESOLVED_PREFIX = "\0";
const FACTORY_MODULES = {
  openaiCompatible: new URL(
    "../providers/openai-compatible.ts",
    import.meta.url
  ),
  openaiDecisions: new URL("../providers/openai-decisions.ts", import.meta.url),
  typesafe: new URL("../providers/typesafe.ts", import.meta.url),
} as const;

/**
 * Exposes the ask options and the provider to the injected route and to the components as virtual modules. The route
 * runs in the server bundle, possibly in another process than the build, so it recreates the provider from its
 * serialization.
 */
export function vitePluginAsk(
  ask: AskConfig,
  provider: CompassProvider
): VirtualModulePlugin {
  const modules = new Map([
    [ASK_CONFIG_MODULE, getConfigModule(ask)],
    [ASK_PROVIDER_MODULE, getProviderModule(provider)],
  ]);

  return {
    name: "starlight-compass-ask",
    resolveId(id) {
      return modules.has(id) ? `${RESOLVED_PREFIX}${id}` : undefined;
    },
    load(id) {
      return id.startsWith(RESOLVED_PREFIX)
        ? modules.get(id.slice(RESOLVED_PREFIX.length))
        : undefined;
    },
  };
}

export function getConfigModule(ask: AskConfig) {
  return `export const ask = ${JSON.stringify(ask)};`;
}

export function getProviderModule(provider: CompassProvider) {
  const { serialization } = provider;
  if (!serialization) {
    throwPluginError(
      `The \`${provider.name}\` provider cannot be used with the \`ask\` option.`,
      "Use `typesafe()`, `openaiDecisions()` or `openaiCompatible()`, or set up the `createAskHandler()` endpoint yourself."
    );
  }

  const { factory, options } = serialization;
  const file = fileURLToPath(FACTORY_MODULES[factory]);

  return [
    `import { ${factory} } from ${JSON.stringify(file)};`,
    `export const provider = ${factory}(${JSON.stringify(options) ?? "undefined"});`,
  ].join("\n");
}

interface VirtualModulePlugin {
  load(id: string): string | undefined;
  name: string;
  resolveId(id: string): string | undefined;
}
