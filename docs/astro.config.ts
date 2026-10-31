import netlify from "@astrojs/netlify";
import node from "@astrojs/node";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightCompass, {
  diataxis,
  duplicates,
  metadata,
  quality,
  sidebar,
  typesafe,
  unfinished,
} from "starlight-compass";

const site =
  (process.env.CONTEXT === "deploy-preview" ||
  process.env.CONTEXT === "branch-deploy"
    ? process.env.DEPLOY_PRIME_URL
    : process.env.URL) ?? "https://starlight-compass.netlify.app";

export default defineConfig({
  // Netlify sets `NETLIFY` while building. Elsewhere, `pnpm preview` serves the site and its endpoints with Node.js.
  adapter: process.env.NETLIFY ? netlify() : node({ mode: "standalone" }),
  site,
  integrations: [
    starlight({
      title: "Starlight Compass",
      credits: true,
      components: {
        Footer: "./src/components/Footer.astro",
      },
      head: [
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: new URL("og.png", site).href,
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image:alt",
            content: "Review docs with typed AI decisions.",
          },
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/trueberryless/starlight-compass/edit/main/docs/",
      },
      plugins: [
        starlightCompass({
          ask: true,
          provider: typesafe(),
          rules: [
            diataxis(),
            quality(),
            metadata(),
            unfinished(),
            duplicates(),
            sidebar(),
          ],
        }),
      ],
      sidebar: [
        {
          label: "Start Here",
          items: [
            { slug: "getting-started" },
            { slug: "getting-started/typesafe" },
            { slug: "getting-started/openai-decisions" },
            { slug: "getting-started/openai-compatible" },
            { slug: "getting-started/review-your-first-page" },
          ],
        },
        {
          label: "Guides",
          items: [
            { slug: "guides/audit-in-ci" },
            { slug: "guides/write-a-custom-rule" },
            { slug: "guides/write-a-custom-provider" },
            { slug: "guides/documentation-type-badges" },
            { slug: "guides/ask-the-docs" },
            { slug: "guides/set-up-ask-the-docs-yourself" },
            { slug: "guides/triage-feedback" },
          ],
        },
        {
          label: "Reference",
          items: [
            { slug: "reference/configuration" },
            { slug: "reference/providers" },
            { slug: "reference/handlers-and-components" },
            { slug: "reference/rules" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { slug: "concepts/how-it-works" },
            { slug: "concepts/ask-the-docs" },
            { slug: "concepts/diataxis" },
          ],
        },
      ],
      social: [
        {
          icon: "blueSky",
          label: "BlueSky",
          href: "https://bsky.app/profile/felixs.dev",
        },
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/trueberryless/starlight-compass",
        },
      ],
    }),
  ],
});
