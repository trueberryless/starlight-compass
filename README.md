# `starlight-compass` 🧭

Starlight plugin to review your documentation with typed AI decisions.

## Features

- **Reviews while you write.** The Astro dev toolbar reviews the page you are viewing, and opt-in audits fail pull requests in CI.
- **Nine rules.** Classify pages with [Diátaxis](https://diataxis.fr), rate them against quality rubrics, find duplicates, check titles, descriptions, tags, topics, sidebar placement and blog posts, and find unfinished content.
- **Typed decisions.** Rules ask yes-or-no, multiple choice and scoring questions instead of generating text, so findings are reliable enough to fail a build.
- **Your choice of model.** Use TypeSafe's Jev, OpenAI Decisions, any OpenAI-compatible service or local model, or your own provider.
- **For readers.** Documentation type badges, a sparkle button to ask the docs that links to matching pages without generating answers, and feedback triage.

## Documentation

Read the [Starlight Compass docs](https://starlight-compass.netlify.app).

## Package

If you are looking for the Starlight plugin package, you can find it in the [`packages/starlight-compass/`](https://github.com/trueberryless-org/starlight-compass/tree/main/packages/starlight-compass) directory.

## Project structure

This project uses pnpm workspaces to develop a single Starlight plugin from the `packages/starlight-compass/` directory. A Starlight documentation site is also available in the `docs/` directory that is also used for testing and demonstrating the Starlight plugin.

## License

Licensed under the MIT License, Copyright © trueberryless.

See [LICENSE](https://github.com/trueberryless-org/starlight-compass/blob/main/LICENSE) for more information.
