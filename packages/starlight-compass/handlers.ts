import {
  getAskPages,
  getAskQuestions,
  getAskState,
  parseAskRequest,
} from "./libs/ask";
import type { AskResponse } from "./libs/ask";
import { createJsonHandler } from "./libs/endpoint";
import {
  FEEDBACK_QUESTION,
  FEEDBACK_QUESTION_KEY,
  type TriagedFeedback,
  isFeedbackCategory,
  parseFeedbackRequest,
} from "./libs/feedback";
import type { CompassProvider } from "./libs/provider";

export { FEEDBACK_CATEGORIES } from "./libs/feedback";
export type { AskPage, AskResponse } from "./libs/ask";
export type { FeedbackCategory, TriagedFeedback } from "./libs/feedback";

/**
 * Creates a handler answering the questions of readers with links to the pages of your documentation that answer them.
 * A search shortlist of pages comes with every request, and the provider only rates how well each page helps to answer the
 * question. It never writes an answer, so it cannot hallucinate one, and it says so when the docs have no answer.
 *
 * @see https://starlight-compass.netlify.app/guides/ask-the-docs/
 */
export function createAskHandler(options: AskHandlerOptions) {
  const maxCandidates = options.maxCandidates ?? 8;
  const maxPages = options.maxPages ?? 3;
  const minProbability = options.minProbability ?? 0.3;

  return createJsonHandler<AskResponse>(
    {
      env: options.env ?? getProcessEnv(),
      provider: options.provider,
    },
    async (body, client) => {
      const request = parseAskRequest(body, maxCandidates);
      if (typeof request === "string") return request;

      const { answers } = await client.ask({
        questions: getAskQuestions(request.candidates),
        state: getAskState(request),
      });
      const pages = getAskPages(request.candidates, answers, {
        maxPages,
        minProbability,
      });

      return pages.length > 0
        ? { pages, status: "answered" }
        : { status: "unanswered" };
    }
  );
}

/**
 * Creates a handler classifying free-text feedback about a page into typos, bugs, missing information and confusing
 * content, and passing it to your `onFeedback()` callback, e.g. to label an issue or to notify a channel.
 *
 * @see https://starlight-compass.netlify.app/guides/triage-feedback/
 */
export function createFeedbackHandler(options: FeedbackHandlerOptions) {
  return createJsonHandler<{ category: string; confidence: number }>(
    {
      env: options.env ?? getProcessEnv(),
      provider: options.provider,
    },
    async (body, client) => {
      const request = parseFeedbackRequest(body);
      if (typeof request === "string") return request;

      const { answers } = await client.ask({
        questions: { [FEEDBACK_QUESTION_KEY]: FEEDBACK_QUESTION },
        state: { feedback: request.feedback },
      });
      const answer = answers[FEEDBACK_QUESTION_KEY];
      if (answer?.type !== "choice" || !isFeedbackCategory(answer.choice)) {
        throw new Error(
          "The provider returned an unexpected answer for the feedback category."
        );
      }

      const { choice: category, confidence } = answer;
      await options.onFeedback({ ...request, category, confidence });

      return { category, confidence };
    }
  );
}

/** Edge runtimes like Cloudflare Workers have no `process`. */
function getProcessEnv(): Record<string, string | undefined> {
  return globalThis.process?.env ?? {};
}

export interface AskHandlerOptions {
  /**
   * Environment variables passed to the provider.
   *
   * @default process.env
   */
  env?: Record<string, string | undefined>;
  /**
   * The maximum number of candidate pages accepted in a request. Lower it to limit the cost of every question.
   *
   * @default 8
   */
  maxCandidates?: number;
  /**
   * The maximum number of pages to return, most likely first.
   *
   * @default 3
   */
  maxPages?: number;
  /**
   * The probability that a page helps to answer the question above which it is returned. Models are conservative with
   * short excerpts, so the default is low.
   *
   * @default 0.3
   */
  minProbability?: number;
  /** The provider answering the questions, e.g. `typesafe()`, `openaiDecisions()` or `openaiCompatible()`. */
  provider: CompassProvider;
}

export interface FeedbackHandlerOptions {
  /**
   * Environment variables passed to the provider.
   *
   * @default process.env
   */
  env?: Record<string, string | undefined>;
  /**
   * Receives every triaged feedback, e.g. to create a labeled GitHub issue. Errors turn the response into a failure.
   */
  onFeedback: (feedback: TriagedFeedback) => Promise<void> | void;
  /** The provider answering the questions, e.g. `typesafe()`, `openaiDecisions()` or `openaiCompatible()`. */
  provider: CompassProvider;
}
