import { throwPluginError } from "../libs/error";
import { fetchWithRetry } from "../libs/http";
import type {
  CompassAnswer,
  CompassProvider,
  CompassQuestion,
  CompassRequest,
  CompassResponse,
} from "../libs/provider";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-6-luna";
const API_KEY_ENV = "OPENAI_API_KEY";
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
// The API accepts 400 questions, but only 200 during the public beta.
const MAX_QUESTIONS_PER_REQUEST = 200;
// The limits of an `input_json` part. Larger states are sent as JSON text.
const MAX_INPUT_JSON_BYTES = 256 * 1024;
const MAX_INPUT_JSON_DEPTH = 32;
const MAX_INPUT_JSON_VALUES = 10_000;

/**
 * Answers questions with the OpenAI Decisions API, which returns calibrated typed answers like TypeSafe's Jev.
 *
 * @see https://starlight-compass.netlify.app/reference/providers/#openaidecisions
 * @see https://developers.openai.com/api/docs/guides/decisions
 */
export function openaiDecisions(
  options?: OpenAIDecisionsOptions
): CompassProvider {
  const baseUrl = (options?.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = options?.model ?? DEFAULT_MODEL;

  return {
    name: "openai-decisions",
    serialization: {
      factory: "openaiDecisions",
      options: {
        apiKey: options?.apiKey,
        baseUrl: options?.baseUrl,
        model: options?.model,
      },
    },
    setupHint: `Set the \`${API_KEY_ENV}\` environment variable, e.g. in a \`.env\` file, or pass the \`apiKey\` option to \`openaiDecisions()\`. Servers on a custom \`baseUrl\`, like LocalAI, don't need a key.`,
    createClient({ env }) {
      const apiKey = options?.apiKey ?? env[API_KEY_ENV];
      if (!apiKey && baseUrl === DEFAULT_BASE_URL) return;

      return {
        ask: (request) =>
          askOpenAIDecisions(request, {
            apiKey,
            baseUrl,
            fetch: options?.fetch,
            model,
          }),
        id:
          baseUrl === DEFAULT_BASE_URL
            ? `openai-decisions/${model}`
            : `openai-decisions/${baseUrl}/${model}`,
      };
    },
  };
}

export async function askOpenAIDecisions(
  request: CompassRequest,
  options: AskOpenAIDecisionsOptions
): Promise<CompassResponse> {
  const entries = Object.entries(request.questions);
  const input = getDecisionInput(request.state);

  // Every batch sends the same input first, so the API can reuse its prompt cache across batches.
  const batches = await Promise.all(
    getBatches(entries, MAX_QUESTIONS_PER_REQUEST).map((batch) =>
      askBatch(batch, input, options)
    )
  );

  return {
    answers: Object.fromEntries(batches.flatMap(({ answers }) => answers)),
    model: batches[0]?.model ?? options.model,
  };
}

async function askBatch(
  entries: [string, CompassQuestion][],
  input: DecisionInput,
  options: AskOpenAIDecisionsOptions
) {
  const { apiKey, baseUrl, fetch: _fetch = fetch, model } = options;

  const response = await fetchWithRetry(
    _fetch,
    `${baseUrl}/decisions`,
    {
      body: JSON.stringify({
        input,
        model,
        questions: entries.map(([key, question]) =>
          toDecisionQuestion(key, question)
        ),
      }),
      headers: {
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined),
        "Content-Type": "application/json",
      },
      method: "POST",
    },
    RETRYABLE_STATUSES
  );

  if (!response.ok)
    throwDecisionsError(response.status, await response.text(), model);

  return fromDecisionResponse(entries, await response.json());
}

function getBatches<T>(items: T[], size: number) {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }

  return batches;
}

/**
 * Sends a structured state as an `input_json` part, which the model reads as data and not as instructions, and falls
 * back to JSON text when the state exceeds the limits of such a part.
 */
export function getDecisionInput(state: unknown): DecisionInput {
  if (typeof state === "string") return state;

  const json = JSON.stringify(state) ?? "null";
  const isInputJson =
    (isRecord(state) || (Array.isArray(state) && state.every(isRecord))) &&
    new TextEncoder().encode(json).byteLength <= MAX_INPUT_JSON_BYTES &&
    isWithinJsonLimits(state);

  return [
    {
      content: [
        isInputJson
          ? { data: state, type: "input_json" }
          : { text: json, type: "input_text" },
      ],
      role: "user",
    },
  ];
}

function isWithinJsonLimits(value: unknown) {
  let values = 0;

  function visit(node: unknown, depth: number): boolean {
    values++;
    if (values > MAX_INPUT_JSON_VALUES) return false;
    if (typeof node !== "object" || node === null) return true;
    if (depth > MAX_INPUT_JSON_DEPTH) return false;

    return Object.values(node).every((child) => visit(child, depth + 1));
  }

  return visit(value, 1);
}

function toDecisionQuestion(name: string, question: CompassQuestion) {
  switch (question.type) {
    case "boolean":
      // Predicates have no criteria, so their meaning becomes part of the instructions.
      return {
        instructions: question.criteria
          ? `${question.instructions}\nYes means: ${question.criteria.true}\nNo means: ${question.criteria.false}`
          : question.instructions,
        name,
        type: "predicate",
      };
    case "choice":
      return {
        choices: Object.entries(question.options).map(([value, description]) =>
          description === null ? { value } : { description, value }
        ),
        instructions: question.instructions,
        name,
        type: "choice",
      };
    case "score":
      return {
        instructions: question.instructions,
        levels: question.levels.map((label) => ({ label })),
        name,
        type: "score",
      };
  }
}

function fromDecisionResponse(
  entries: [string, CompassQuestion][],
  response: unknown
) {
  if (
    !isRecord(response) ||
    !Array.isArray(response["answers"]) ||
    typeof response["model"] !== "string"
  )
    throwUnexpectedResponse("The response has no `answers` or `model`.");

  const answers = response["answers"];
  const answersByName = new Map(
    answers.filter(isRecord).map((answer) => [answer["name"], answer])
  );

  return {
    answers: entries.map(([key, question], index): [string, CompassAnswer] => [
      key,
      // Answers echo the name of their question and keep the order of the questions.
      fromDecisionAnswer(
        key,
        question,
        answersByName.get(key) ?? answers[index]
      ),
    ]),
    model: response["model"],
  };
}

function fromDecisionAnswer(
  key: string,
  question: CompassQuestion,
  answer: unknown
): CompassAnswer {
  if (!isRecord(answer))
    throwUnexpectedResponse(`The answer to \`${key}\` is missing.`);

  if (answer["type"] === "refusal") {
    throwPluginError(
      `The model refused to answer the question \`${key}\`.`,
      "Check the content of your pages against the OpenAI usage policies, or disable the rule asking the question."
    );
  }

  switch (question.type) {
    case "boolean":
      if (answer["type"] !== "predicate") break;
      if (!isNumber(answer["probability"])) break;

      return { probability: answer["probability"], type: "boolean" };
    case "choice": {
      if (answer["type"] !== "choice") break;
      const { choice, confidence, probabilities } = answer;
      if (
        typeof choice !== "string" ||
        !isNumber(confidence) ||
        !Array.isArray(probabilities)
      )
        break;

      return {
        choice,
        confidence,
        probabilities: Object.fromEntries(
          Object.keys(question.options).map((option) => [
            option,
            findProbability(
              probabilities,
              (entry) => entry["value"] === option
            ),
          ])
        ),
        type: "choice",
      };
    }
    case "score": {
      if (answer["type"] !== "score") break;
      const { confidence, probabilities, score } = answer;
      if (
        !isNumber(confidence) ||
        !isNumber(score) ||
        !Array.isArray(probabilities)
      )
        break;

      return {
        confidence,
        // The levels are numbered from 0 by their `value`.
        probabilities: question.levels.map((_level, index) =>
          findProbability(probabilities, (entry) => entry["value"] === index)
        ),
        score,
        type: "score",
      };
    }
  }

  throwUnexpectedResponse(
    `The answer to \`${key}\` does not match its \`${question.type}\` question.`
  );
}

function findProbability(
  probabilities: unknown[],
  predicate: (entry: Record<string, unknown>) => boolean
) {
  const probability = probabilities.filter(isRecord).find(predicate)?.[
    "probability"
  ];

  return isNumber(probability) ? probability : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}

function throwUnexpectedResponse(reason: string): never {
  throwPluginError(
    `The OpenAI Decisions API returned an unexpected response. ${reason}`,
    "The Decisions API may have changed. Check for an update of starlight-compass."
  );
}

function throwDecisionsError(
  status: number,
  body: string,
  model: string
): never {
  const message = getErrorMessage(body);

  if (status === 401) {
    throwPluginError(
      "The OpenAI Decisions API rejected the API key.",
      `Check the \`${API_KEY_ENV}\` environment variable or the \`apiKey\` option of \`openaiDecisions()\`. You can create a key at https://platform.openai.com/api-keys.`
    );
  }

  if (status === 403 || status === 404) {
    throwPluginError(
      `The OpenAI Decisions API is not available for the model \`${model}\`: ${message}`,
      "Check that your organization has access to the Decisions API and that the `model` option names a decision model, like `gpt-6-luna`."
    );
  }

  throwPluginError(
    `The OpenAI Decisions API responded with status \`${status}\`: ${message}`
  );
}

/** Extracts the message of an OpenAI error, which is nested in an `error` object, or a plain string elsewhere. */
function getErrorMessage(body: string) {
  try {
    const { error } = JSON.parse(body) as { error?: unknown };
    if (typeof error === "string") return error;
    if (isRecord(error) && typeof error["message"] === "string")
      return error["message"];
  } catch {
    // The body is not JSON, e.g. the error page of a proxy.
  }

  return body;
}

export interface OpenAIDecisionsOptions {
  /**
   * The OpenAI API key. Prefer the `OPENAI_API_KEY` environment variable to keep the key out of your repository.
   * Servers on a custom `baseUrl`, like LocalAI, don't need one.
   *
   * @default process.env.OPENAI_API_KEY
   */
  apiKey?: string;
  /**
   * The base URL of an API implementing the Decisions API, without `/decisions`.
   *
   * @default "https://api.openai.com/v1"
   */
  baseUrl?: string;
  /** A custom `fetch` implementation, e.g. to route requests through a proxy. Not used by the `ask` option. */
  fetch?: typeof fetch;
  /**
   * The decision model to query.
   *
   * @default "gpt-6-luna"
   * @see https://developers.openai.com/api/docs/guides/decisions
   */
  model?: string;
}

type DecisionInput =
  | string
  | {
      content: (
        | { data: unknown; type: "input_json" }
        | { text: string; type: "input_text" }
      )[];
      role: "user";
    }[];

interface AskOpenAIDecisionsOptions {
  apiKey: string | undefined;
  baseUrl: string;
  fetch: typeof fetch | undefined;
  model: string;
}
