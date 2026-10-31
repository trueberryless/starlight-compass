/**
 * A provider answers typed questions about a page, e.g. by querying a System One model like TypeSafe's Jev.
 *
 * @see https://starlight-compass.netlify.app/reference/providers/
 */
export interface CompassProvider {
  /** Creates a client, or returns `undefined` when the provider is not configured, e.g. because of a missing API key. */
  createClient(context: CompassProviderContext): CompassClient | undefined;
  /** A unique name for the provider, e.g. `typesafe`. */
  name: string;
  /**
   * Describes how to recreate the provider in the server bundle, where code like the route of the `ask` option runs
   * without access to the Astro configuration. Providers without it cannot be used there.
   */
  serialization?: CompassProviderSerialization;
  /** A sentence explaining how to configure the provider, logged when `createClient()` returns `undefined`. */
  setupHint: string;
}

export interface CompassProviderSerialization {
  /** The name of a built-in provider factory to call with the `options`. */
  factory: "openaiCompatible" | "openaiDecisions" | "typesafe";
  /** The JSON-serializable options of the factory. */
  options: unknown;
}

export interface CompassProviderContext {
  /** Environment variables, including the ones loaded from `.env` files in the project root. */
  env: Record<string, string | undefined>;
}

export interface CompassClient {
  /** Answers every question of a request in a single call. */
  ask(request: CompassRequest): Promise<CompassResponse>;
  /** Identifies the provider and the requested model, e.g. `typesafe/jev-latest`. Used as part of the cache key. */
  id: string;
}

export interface CompassRequest {
  questions: Record<string, CompassQuestion>;
  state: unknown;
}

export interface CompassResponse {
  answers: Record<string, CompassAnswer>;
  /** The exact model that answered, e.g. `jev-1.13.0`. */
  model: string;
}

export type CompassQuestion =
  | {
      /** Optional descriptions of what a yes (`true`) and a no (`false`) mean. */
      criteria?: { false: string; true: string };
      instructions: string;
      type: "boolean";
    }
  | {
      instructions: string;
      /** A map of option keys to descriptions. */
      options: Record<string, string | null>;
      type: "choice";
    }
  | {
      instructions: string;
      /** Ordered level descriptions, from lowest to highest. */
      levels: string[];
      type: "score";
    };

export type CompassAnswer =
  | {
      /** The probability that the answer is yes, between `0` and `1`. */
      probability: number;
      type: "boolean";
    }
  | {
      choice: string;
      confidence: number;
      probabilities: Record<string, number>;
      type: "choice";
    }
  | {
      confidence: number;
      probabilities: number[];
      /** The probability-weighted level index, which can land between levels. */
      score: number;
      type: "score";
    };
