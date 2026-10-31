# starlight-compass

## 0.2.0

### Minor Changes

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Adds the `AskDocs` and `Feedback` components with the `createAskHandler()` and `createFeedbackHandler()` handlers from `starlight-compass/handlers`, for setups that need more control than the `ask` option.

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Adds the `ask` option, which adds a sparkle button next to the search field and an endpoint that link readers to the pages answering their question.

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Adds the `duplicates()` rule, which finds pages covering the same topic without linking to each other.

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Adds the `metadata()` and `unfinished()` rules to check titles and descriptions, and to find placeholders and stubs.

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Adds the `openaiCompatible()` provider for any service or server that implements the OpenAI chat completions API with structured outputs.

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Adds the `tags()`, `topics()` and `blog()` rules to review the frontmatter of plugins like `starlight-tags`, `starlight-sidebar-topics` and `starlight-blog`.

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Adds the `quality()` rule, which rates pages against rubrics like "states its prerequisites".

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Passes a context with all known pages to rules as an additional argument. Rules can return no questions to report findings without a provider, and `CompassPage` gains `headings`, `locale` and `sidebar`.

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Adds the `sidebar()` rule, which reports pages in a sidebar group they do not belong to.

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Adds documentation type badges below page titles, controlled by the new `badges` option.

- [#6](https://github.com/trueberryless/starlight-compass/pull/6) [`9f346ff`](https://github.com/trueberryless/starlight-compass/commit/9f346fff3851dc00b35d251e8c6303ced7394b8d) Thanks [@trueberryless](https://github.com/trueberryless)! - Removes the default provider. The `provider` option of `starlightCompass()` and of `createAskHandler()` and `createFeedbackHandler()` is now required, e.g. `provider: typesafe()`.

### Patch Changes

- [#9](https://github.com/trueberryless/starlight-compass/pull/9) [`9591e0c`](https://github.com/trueberryless/starlight-compass/commit/9591e0c7f6d77b5bb9592b65e4864607d89cd43f) Thanks [@trueberryless-bot](https://github.com/trueberryless-bot)! - Updates the repository links after the move from the `trueberryless-org` GitHub organization to the `trueberryless` account.

## 0.1.0

### Minor Changes

- [`c523d5a`](https://github.com/trueberryless-org/starlight-compass/commit/c523d5a454e2f4cfc22c8b825bb5c178a372e6ba) Thanks [@trueberryless](https://github.com/trueberryless)! - Initial public release with the `diataxis` rule, the `typesafe` provider, a dev toolbar app reviewing the current page, and opt-in audits for CI.
