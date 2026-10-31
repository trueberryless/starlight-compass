import { z } from "astro/zod";

import { diataxis } from "../rules/diataxis";
import { throwPluginError } from "./error";
import type { CompassProvider } from "./provider";
import type { CompassRule } from "./rule";

const providerSchema = z.custom<CompassProvider>(
  (value) =>
    isObjectWith(value, "name", "string") &&
    isObjectWith(value, "createClient", "function"),
  {
    message:
      "Expected a provider, e.g. `typesafe()`, `openaiDecisions()` or `openaiCompatible()`.",
  }
);

const ruleSchema = z.custom<CompassRule>(
  (value) =>
    isObjectWith(value, "name", "string") &&
    isObjectWith(value, "getQuestions", "function") &&
    isObjectWith(value, "getResult", "function"),
  { message: "Expected a rule, e.g. `diataxis()`." }
);

const askSchema = z.object({
  /**
   * The maximum number of pages returned for a question, most likely first.
   *
   * @default 3
   */
  maxPages: z.number().int().positive().default(3),
  /**
   * The probability that a page helps to answer the question above which it is returned.
   *
   * @default 0.3
   */
  minProbability: z.number().min(0).max(1).default(0.3),
  /**
   * The maximum number of questions per client address and minute. Every question costs one provider request. The
   * limit lives in the memory of the server, so hosts with several instances limit each of them. Use `0` to disable.
   *
   * @default 20
   */
  rateLimit: z.number().int().nonnegative().default(20),
  /**
   * The pathname of the endpoint answering questions.
   *
   * @default "/api/ask"
   */
  route: z.string().startsWith("/").default("/api/ask"),
});

const configSchema = z.object({
  /**
   * Settings for audits, which review every page at the end of a build run with the `STARLIGHT_COMPASS_AUDIT=1`
   * environment variable.
   *
   * @see https://starlight-compass.netlify.app/guides/audit-in-ci/
   */
  audit: z
    .object({
      /**
       * The finding level that fails the audit.
       *
       * @default "error"
       */
      failOn: z.enum(["error", "warning", "never"]).default("error"),
    })
    .prefault({}),
  /**
   * Adds an "Ask the docs" button with a sparkle icon next to the search field, which opens a form linking readers
   * to the pages that answer their question. Requires an Astro adapter, because it adds an endpoint that queries
   * your provider, and a provider that can be recreated on the server: `typesafe()`, `openaiDecisions()` or `openaiCompatible()`.
   *
   * The button replaces the `Search` component, so it is skipped with a warning when you already override it.
   *
   * @default false
   * @see https://starlight-compass.netlify.app/guides/ask-the-docs/
   */
  ask: z
    .union([z.boolean(), askSchema])
    .default(false)
    .transform((ask) =>
      ask === true ? askSchema.parse({}) : ask === false ? undefined : ask
    ),
  /**
   * Whether to show a badge with the Diátaxis documentation type below the title of pages declaring a `diataxis`
   * frontmatter type. The badge replaces the `PageTitle` component, so it is skipped with a warning when you
   * already override it.
   *
   * @default true
   * @see https://starlight-compass.netlify.app/guides/documentation-type-badges/
   */
  badges: z.boolean().default(true),
  /**
   * Whether to review the current page in the Astro dev toolbar during development.
   * Requires a configured provider, e.g. a `TYPESAFE_API_KEY` environment variable.
   *
   * @default true
   */
  devToolbar: z.boolean().default(true),
  /**
   * The provider answering the questions of every rule, e.g. `typesafe()`, `openaiDecisions()` or `openaiCompatible()`.
   *
   * @see https://starlight-compass.netlify.app/reference/providers/
   */
  provider: providerSchema,
  /**
   * The rules reviewing every page.
   *
   * @default [diataxis()]
   * @see https://starlight-compass.netlify.app/reference/rules/
   */
  rules: z
    .array(ruleSchema)
    .default(() => [diataxis()])
    .refine(
      (rules) => new Set(rules.map((rule) => rule.name)).size === rules.length,
      {
        message: "Every rule must have a unique name.",
      }
    ),
});

export function validateConfig(userConfig: unknown): StarlightCompassConfig {
  const config = configSchema.safeParse(userConfig ?? {});

  if (!config.success) {
    throwPluginError(`Invalid starlight-compass configuration:

${z.prettifyError(config.error)}
`);
  }

  return config.data;
}

function isObjectWith(
  value: unknown,
  key: string,
  type: "function" | "string"
) {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>)[key] === type
  );
}

export type AskConfig = z.output<typeof askSchema>;
export type StarlightCompassUserConfig = z.input<typeof configSchema>;
export type StarlightCompassConfig = z.output<typeof configSchema>;
