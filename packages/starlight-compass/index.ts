import type { StarlightPlugin } from "@astrojs/starlight/types";

import { vitePluginAsk } from "./libs/ask-route";
import { runAudit } from "./libs/audit";
import {
  type StarlightCompassConfig,
  type StarlightCompassUserConfig,
  validateConfig,
} from "./libs/config";
import { isAuditRequested, loadEnv } from "./libs/env";
import { throwPluginError } from "./libs/error";
import { COMPASS_TRANSLATIONS } from "./libs/i18n";
import { getCompassPages } from "./libs/store";
import { TOOLBAR_APP_ID, setupToolbarServer } from "./libs/toolbar";

export { openaiCompatible } from "./providers/openai-compatible";
export { openaiDecisions } from "./providers/openai-decisions";
export { typesafe } from "./providers/typesafe";
export { blog } from "./rules/blog";
export { diataxis } from "./rules/diataxis";
export { duplicates } from "./rules/duplicates";
export { metadata } from "./rules/metadata";
export { QUALITY_RUBRICS, quality } from "./rules/quality";
export { sidebar } from "./rules/sidebar";
export { tags } from "./rules/tags";
export { topics } from "./rules/topics";
export { unfinished } from "./rules/unfinished";

export type { StarlightCompassConfig, StarlightCompassUserConfig };
export type {
  CompassAnswer,
  CompassClient,
  CompassProvider,
  CompassProviderContext,
  CompassQuestion,
  CompassRequest,
  CompassResponse,
} from "./libs/provider";
export type {
  CompassFinding,
  CompassFindingLevel,
  CompassPage,
  CompassPageSidebar,
  CompassRule,
  CompassRuleContext,
  CompassRuleResult,
} from "./libs/rule";
export type { OpenAICompatibleOptions } from "./providers/openai-compatible";
export type { OpenAIDecisionsOptions } from "./providers/openai-decisions";
export type { TypesafeOptions } from "./providers/typesafe";
export type { BlogOptions } from "./rules/blog";
export type { DiataxisOptions, DiataxisType } from "./rules/diataxis";
export type { DuplicatesOptions } from "./rules/duplicates";
export type { MetadataOptions } from "./rules/metadata";
export type {
  QualityOptions,
  QualityRubric,
  QualityRubricId,
} from "./rules/quality";
export type { SidebarOptions } from "./rules/sidebar";
export type { TagsOptions } from "./rules/tags";
export type { Topic, TopicsOptions } from "./rules/topics";
export type { UnfinishedOptions } from "./rules/unfinished";

const TOOLBAR_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>';

export default function starlightCompass(
  userConfig: StarlightCompassUserConfig
): StarlightPlugin {
  const config = validateConfig(userConfig);

  return {
    name: "starlight-compass",
    hooks: {
      "i18n:setup"({ injectTranslations }) {
        injectTranslations({ en: COMPASS_TRANSLATIONS });
      },
      "config:setup"({
        addIntegration,
        addRouteMiddleware,
        astroConfig,
        command,
        config: starlightConfig,
        logger,
        updateConfig,
      }) {
        const components = { ...starlightConfig.components };
        if (config.badges) {
          if (components.PageTitle) {
            logger.warn(
              "Skipped the documentation type badges as the `PageTitle` component is already overridden. Set `badges: false` to hide this warning, or render `starlight-compass/components/PageTitle.astro` from your override."
            );
          } else {
            components.PageTitle =
              "starlight-compass/components/PageTitle.astro";
          }
        }

        const { ask } = config;
        if (ask) {
          if (!astroConfig.adapter) {
            throwPluginError(
              "The `ask` option of starlight-compass needs an Astro adapter.",
              "Add an adapter, e.g. `@astrojs/netlify`, `@astrojs/node` or `@astrojs/cloudflare`, because the endpoint answering questions runs on a server. See https://docs.astro.build/en/guides/on-demand-rendering/"
            );
          }

          if (components.Search) {
            logger.warn(
              "Skipped the ask button as the `Search` component is already overridden. Render `starlight-compass/components/AskButton.astro` from your override."
            );
          } else {
            components.Search = "starlight-compass/components/Search.astro";
          }

          addIntegration({
            name: "starlight-compass-ask-integration",
            hooks: {
              "astro:config:setup"({ injectRoute, updateConfig: updateAstro }) {
                updateAstro({
                  vite: { plugins: [vitePluginAsk(ask, config.provider)] },
                });
                injectRoute({
                  entrypoint: "starlight-compass/routes/ask",
                  pattern: ask.route,
                  prerender: false,
                });
              },
            },
          });
        }

        updateConfig({ components });

        if (command !== "dev" && command !== "build") return;

        const env = loadEnv(
          astroConfig.root,
          command === "dev" ? "development" : "production",
          process.env
        );
        const isAudit = command === "build" && isAuditRequested(env);
        const isDevToolbar = command === "dev" && config.devToolbar;
        if (!isAudit && !isDevToolbar) return;

        const client = config.provider.createClient({ env });
        if (ask && command === "dev" && !client) {
          logger.warn(
            `The \`ask\` option needs a \`${config.provider.name}\` provider, so the ask button reports an error. ${config.provider.setupHint}`
          );
        }
        if (!client) {
          const message = `No \`${config.provider.name}\` provider is configured. ${config.provider.setupHint}`;
          if (isAudit)
            throwPluginError(
              "Cannot run the starlight-compass audit.",
              message
            );

          logger.info(
            `The starlight-compass dev toolbar app is disabled. ${message}`
          );
          return;
        }

        addRouteMiddleware({ entrypoint: "starlight-compass/middleware" });

        addIntegration({
          name: "starlight-compass-integration",
          hooks: {
            "astro:config:setup"({ addDevToolbarApp }) {
              if (!isDevToolbar) return;

              addDevToolbarApp({
                entrypoint: "starlight-compass/toolbar",
                icon: TOOLBAR_ICON,
                id: TOOLBAR_APP_ID,
                name: "Compass",
              });
            },
            "astro:server:setup"({ logger: integrationLogger, toolbar }) {
              setupToolbarServer(toolbar, {
                cacheDir: astroConfig.cacheDir,
                client,
                config,
                logger: integrationLogger,
              });
            },
            async "astro:build:done"({ logger: integrationLogger }) {
              if (!isAudit) return;

              await runAudit([...getCompassPages().values()], {
                cacheDir: astroConfig.cacheDir,
                client,
                config,
                env,
                logger: integrationLogger,
                root: astroConfig.root,
              });
            },
          },
        });
      },
    },
  };
}
