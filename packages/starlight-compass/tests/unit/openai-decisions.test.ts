import { afterEach, describe, expect, test, vi } from "vitest";

import { getProviderModule } from "../../libs/ask-route";
import type { CompassRequest } from "../../libs/provider";
import { askOpenAIDecisions, getDecisionInput, openaiDecisions } from "../../providers/openai-decisions";

const request: CompassRequest = {
  questions: {
    level: { instructions: "How advanced is this?", levels: ["Beginner", "Expert"], type: "score" },
    topic: { instructions: "Which topic?", options: { cli: null, config: "Configuration" }, type: "choice" },
    urgent: { criteria: { false: "Calm", true: "Urgent" }, instructions: "Is this urgent?", type: "boolean" },
  },
  state: { body: "Help!", title: "Support" },
};

const decisionResponse = {
  answers: [
    {
      confidence: 0.9,
      name: "level",
      probabilities: [
        { label: "Beginner", probability: 0.95, value: 0 },
        { label: "Expert", probability: 0.05, value: 1 },
      ],
      score: 0.05,
      type: "score",
    },
    {
      choice: "cli",
      confidence: 0.8,
      name: "topic",
      probabilities: [
        { probability: 0.9, value: "cli" },
        { probability: 0.1, value: "config" },
      ],
      type: "choice",
    },
    { name: "urgent", probability: 0.97, type: "predicate" },
  ],
  model: "gpt-6-luna-2026-09-29",
  usage: {
    input_tokens: 300,
    input_tokens_details: { cache_write_tokens: 0, cached_tokens: 0 },
    output_tokens: 0,
    output_tokens_details: { reasoning_tokens: 0 },
    total_tokens: 300,
  },
};

const options = { apiKey: "sk-test", baseUrl: "https://api.openai.com/v1", fetch: undefined, model: "gpt-6-luna" };

describe("openaiDecisions", () => {
  test("creates a client with the API key from the environment", () => {
    expect(openaiDecisions().createClient({ env: { OPENAI_API_KEY: "sk-test" } })?.id).toBe(
      "openai-decisions/gpt-6-luna"
    );
  });

  test("returns no client without an API key for OpenAI", () => {
    expect(openaiDecisions().createClient({ env: {} })).toBeUndefined();
  });

  test("creates a client without an API key for a custom base URL", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(decisionResponse));
    const client = openaiDecisions({ baseUrl: "http://localhost:8080/v1/", fetch }).createClient({ env: {} });

    await client?.ask(request);

    expect(client?.id).toBe("openai-decisions/http://localhost:8080/v1/gpt-6-luna");
    expect(fetch.mock.calls[0]?.[0]).toBe("http://localhost:8080/v1/decisions");
    expect(fetch.mock.calls[0]?.[1]?.headers).not.toHaveProperty("Authorization");
  });

  test("can be recreated in the server bundle", () => {
    const module = getProviderModule(openaiDecisions({ model: "gpt-6-luna" }));

    expect(module).toContain("import { openaiDecisions } from");
    expect(module).toContain("openai-decisions.ts");
    expect(module).toContain('openaiDecisions({"model":"gpt-6-luna"})');
  });
});

describe("askOpenAIDecisions", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test("maps questions and answers to and from the Decisions API", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(decisionResponse));

    const response = await askOpenAIDecisions(request, { ...options, fetch });

    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.openai.com/v1/decisions");
    expect(JSON.parse(String(fetch.mock.calls[0]?.[1]?.body))).toEqual({
      input: [{ content: [{ data: { body: "Help!", title: "Support" }, type: "input_json" }], role: "user" }],
      model: "gpt-6-luna",
      questions: [
        {
          instructions: "How advanced is this?",
          levels: [{ label: "Beginner" }, { label: "Expert" }],
          name: "level",
          type: "score",
        },
        {
          choices: [{ value: "cli" }, { description: "Configuration", value: "config" }],
          instructions: "Which topic?",
          name: "topic",
          type: "choice",
        },
        { instructions: "Is this urgent?\nYes means: Urgent\nNo means: Calm", name: "urgent", type: "predicate" },
      ],
    });
    expect(response).toEqual({
      answers: {
        level: { confidence: 0.9, probabilities: [0.95, 0.05], score: 0.05, type: "score" },
        topic: { choice: "cli", confidence: 0.8, probabilities: { cli: 0.9, config: 0.1 }, type: "choice" },
        urgent: { probability: 0.97, type: "boolean" },
      },
      model: "gpt-6-luna-2026-09-29",
    });
  });

  test("matches answers by name before position", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ ...decisionResponse, answers: decisionResponse.answers.toReversed() })
    );

    const { answers } = await askOpenAIDecisions(request, { ...options, fetch });

    expect(answers["urgent"]).toEqual({ probability: 0.97, type: "boolean" });
  });

  test("falls back to the position of answers without a name", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ ...decisionResponse, answers: decisionResponse.answers.map(({ name: _name, ...answer }) => answer) })
    );

    const { answers } = await askOpenAIDecisions(request, { ...options, fetch });

    expect(answers["urgent"]).toEqual({ probability: 0.97, type: "boolean" });
  });

  test("splits many questions into batches with the same input", async () => {
    const questions = Object.fromEntries(
      Array.from({ length: 450 }, (_, index) => [`q${index}`, { instructions: "Yes?", type: "boolean" as const }])
    );
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { questions: { name: string }[] };

      return Response.json({
        answers: body.questions.map(({ name }) => ({ name, probability: 0.5, type: "predicate" })),
        model: "gpt-6-luna",
      });
    });

    const { answers } = await askOpenAIDecisions({ questions, state: "Hi" }, { ...options, fetch });

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).questions.length)).toEqual([200, 200, 50]);
    expect(new Set(fetch.mock.calls.map(([, init]) => JSON.stringify(JSON.parse(String(init?.body)).input)))).toEqual(
      new Set(['"Hi"'])
    );
    expect(Object.keys(answers)).toHaveLength(450);
  });

  test("sends the first batch before the others to reuse its prompt cache", async () => {
    const questions = Object.fromEntries(
      Array.from({ length: 450 }, (_, index) => [`q${index}`, { instructions: "Yes?", type: "boolean" as const }])
    );
    let pending = 0;
    const pendingAtStart: number[] = [];
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      pendingAtStart.push(pending++);
      await Promise.resolve();
      pending--;
      const body = JSON.parse(String(init?.body)) as { questions: { name: string }[] };

      return Response.json({
        answers: body.questions.map(({ name }) => ({ name, probability: 0.5, type: "predicate" })),
        model: "gpt-6-luna",
      });
    });

    await askOpenAIDecisions({ questions, state: "Hi" }, { ...options, fetch });

    expect(pendingAtStart).toEqual([0, 0, 1]);
  });

  test.each([
    ["a score question with 11 levels", { instructions: "?", levels: Array.from({ length: 11 }, String), type: "score" as const }, "has 11 levels, but the OpenAI Decisions API accepts 2 to 10."],
    ["a choice question with 1 option", { instructions: "?", options: { only: null }, type: "choice" as const }, "has 1 options, but the OpenAI Decisions API accepts 2 to 255."],
  ])("rejects %s before sending a request", async (_name, question, message) => {
    const fetch = vi.fn(async () => Response.json(decisionResponse));

    await expect(
      askOpenAIDecisions({ ...request, questions: { ...request.questions, unsupported: question } }, { ...options, fetch })
    ).rejects.toThrow(message);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("retries rate-limited requests", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(Response.json(decisionResponse));

    const response = askOpenAIDecisions(request, { ...options, fetch });
    await vi.runAllTimersAsync();

    await expect(response).resolves.toMatchObject({ model: "gpt-6-luna-2026-09-29" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("explains a refused question", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        ...decisionResponse,
        answers: [...decisionResponse.answers.slice(0, 2), { name: "urgent", type: "refusal" }],
      })
    );

    await expect(askOpenAIDecisions(request, { ...options, fetch })).rejects.toThrow(
      "The model refused to answer the question `urgent`."
    );
  });

  test.each([
    ["a mismatched answer type", { name: "urgent", probability: 0.9, type: "score" }, "does not match"],
    ["a missing field", { name: "urgent", type: "predicate" }, "does not match"],
  ])("rejects a response with %s before it is cached", async (_name, answer, message) => {
    const fetch = vi.fn(async () =>
      Response.json({ ...decisionResponse, answers: [...decisionResponse.answers.slice(0, 2), answer] })
    );

    await expect(askOpenAIDecisions(request, { ...options, fetch })).rejects.toThrow(message);
  });

  test.each([
    [
      "a choice that is not an option",
      { choice: "nope", confidence: 0.8, name: "topic", probabilities: [{ probability: 1, value: "nope" }], type: "choice" },
    ],
    [
      "a missing choice probability",
      { choice: "cli", confidence: 0.8, name: "topic", probabilities: [{ probability: 1, value: "cli" }], type: "choice" },
    ],
  ])("rejects a response with %s", async (_name, answer) => {
    const fetch = vi.fn(async () =>
      Response.json({ ...decisionResponse, answers: decisionResponse.answers.map((entry) => (entry.name === "topic" ? answer : entry)) })
    );

    await expect(askOpenAIDecisions(request, { ...options, fetch })).rejects.toThrow(
      "The answer to `topic` does not match its `choice` question."
    );
  });

  test("rejects a response with a missing score probability", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        ...decisionResponse,
        answers: decisionResponse.answers.map((entry) =>
          entry.name === "level" ? { ...entry, probabilities: entry.probabilities?.slice(0, 1) } : entry
        ),
      })
    );

    await expect(askOpenAIDecisions(request, { ...options, fetch })).rejects.toThrow(
      "The answer to `level` does not match its `score` question."
    );
  });

  test("does not take the answer of another question for a missing answer", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ answers: [{ name: "b", probability: 0.9, type: "predicate" }], model: "gpt-6-luna" })
    );
    const questions = {
      a: { instructions: "A?", type: "boolean" as const },
      b: { instructions: "B?", type: "boolean" as const },
    };

    await expect(askOpenAIDecisions({ questions, state: {} }, { ...options, fetch })).rejects.toThrow(
      "The answer to `a` is missing."
    );
  });

  test("rejects a response without answers", async () => {
    const fetch = vi.fn(async () => Response.json({ model: "gpt-6-luna" }));

    await expect(askOpenAIDecisions(request, { ...options, fetch })).rejects.toThrow("unexpected response");
  });

  test("rejects a response with a missing answer", async () => {
    const fetch = vi.fn(async () => Response.json({ ...decisionResponse, answers: decisionResponse.answers.slice(0, 2) }));

    await expect(askOpenAIDecisions(request, { ...options, fetch })).rejects.toThrow(
      "The answer to `urgent` is missing."
    );
  });

  test("throws a helpful error for an invalid API key", async () => {
    const fetch = vi.fn(async () => Response.json({ error: { message: "Incorrect API key" } }, { status: 401 }));

    await expect(askOpenAIDecisions(request, { ...options, fetch })).rejects.toThrow(
      "The OpenAI Decisions API rejected the API key."
    );
  });

  test("explains a model without access to the Decisions API", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ error: { message: "The model `gpt-6-luna` does not exist." } }, { status: 404 })
    );

    await expect(askOpenAIDecisions(request, { ...options, fetch })).rejects.toThrow(
      "not available for the model `gpt-6-luna`: The model `gpt-6-luna` does not exist."
    );
  });
});

describe("getDecisionInput", () => {
  test("sends a string as plain text", () => {
    expect(getDecisionInput("Hello")).toBe("Hello");
  });

  test("sends an array of objects as JSON", () => {
    expect(getDecisionInput([{ a: 1 }])).toEqual([{ content: [{ data: [{ a: 1 }], type: "input_json" }], role: "user" }]);
  });

  test.each([
    ["a primitive", 42],
    ["an array of primitives", [1, 2]],
    ["a state larger than 256 KiB", { body: "a".repeat(300 * 1024) }],
    ["a state with too many values", { items: Array.from({ length: 10_001 }, () => 1) }],
    ["a state nested too deep", JSON.parse(`${'{"a":'.repeat(40)}1${"}".repeat(40)}`)],
  ])("falls back to JSON text for %s", (_name, state) => {
    expect(getDecisionInput(state)).toEqual([
      { content: [{ text: JSON.stringify(state), type: "input_text" }], role: "user" },
    ]);
  });
});
