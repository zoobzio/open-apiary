import type { z } from "zod";
import type {
  Bundle,
  Caller,
  Lifetime,
  Method,
  OutputSchema,
  Route,
} from "@open-apiary/schema";

/**
 * The input of a call, as the framework hands it over. Each part is what the
 * request carried, with no parse. The core runs the validators of the
 * endpoint on it. A missing `path`, `query`, or `headers` counts as an empty
 * object.
 */
export interface RawInput {
  path?: unknown;
  query?: unknown;
  headers?: unknown;
  body?: unknown;
}

/** The answer of a call: the success status and the validated body. */
export interface Result<T> {
  status: number;
  body: T;
}

/**
 * One endpoint as the registry lists it. The members are data, with no
 * validators and no handler, so a framework can log or print them.
 */
export interface Entry {
  readonly id: string;
  readonly method: Method;
  readonly route: Route;
  readonly status: number;
  readonly errors: readonly number[];
  readonly scopes: readonly string[];
  readonly tags: readonly string[];
}

/** The endpoint that a method and a path name, with the path parameters. */
export interface Match {
  readonly id: string;
  readonly params: { readonly [name: string]: string };
}

/**
 * The registry of a service. It answers what the bundle has. `match` finds
 * the endpoint of a method and a path. It is a string match over the routes,
 * not an HTTP router. A static segment wins over a parameter.
 */
export interface Registry {
  /** Lists every endpoint. */
  list(): Entry[];

  /** Returns the entry of an operation id, or `undefined`. */
  get(id: string): Entry | undefined;

  /** Finds the endpoint of a method and a path, or `undefined`. */
  match(method: string, path: string): Match | undefined;
}

/** One issue of an input or an output that fails its validator. */
export interface Issue {
  /** The part of the input, or `output`. */
  readonly part: "path" | "query" | "headers" | "body" | "output";
  readonly path: readonly PropertyKey[];
  readonly message: string;
}

/**
 * The events of a service, keyed by name. Each value is the argument list of
 * a listener.
 *
 * - `invoke:start`: a call began. The input is not parsed yet.
 * - `invoke:end`: a call returned. `duration` is in milliseconds.
 * - `invoke:error`: a call threw. `error` is what it threw.
 * - `service:create`: the container made an instance.
 */
export type Events = {
  "invoke:start": [event: { id: string }];
  "invoke:end": [event: { id: string; status: number; duration: number }];
  "invoke:error": [event: { id: string; error: unknown; duration: number }];
  "service:create": [event: { id: string; lifetime: Lifetime }];
};

/** The name of an event. */
export type Event = keyof Events;

/** A listener for one event. */
export type Listener<E extends Event> = (...args: Events[E]) => void;

/**
 * The options of {@link makeApiary}. `authorize` decides whether a caller
 * has the scopes of an endpoint. The default requires every scope of the
 * endpoint in `caller.scopes`. The core skips the check for an endpoint with
 * no scopes.
 */
export interface Options {
  authorize?: (caller: Caller, scopes: readonly string[]) => boolean;
}

/**
 * The runtime service over a bundle. It holds the registry, the container,
 * and the OpenAPI document. It runs a call with `invoke`. It does no HTTP.
 * The framework turns a request into a {@link RawInput} and a
 * {@link Caller}, calls `invoke`, and sends the {@link Result}.
 */
export interface Apiary<B extends Bundle = Bundle> {
  /** The endpoints of the bundle. */
  readonly registry: Registry;

  /** The OpenAPI document of the bundle. */
  readonly openapi: Record<string, unknown>;

  /**
   * Makes every singleton and runs its `setup`, in dependency order. A call
   * before `start` throws `NotStartedError`. A second `start` does nothing.
   */
  start(): Promise<void>;

  /** Runs `dispose` on every singleton in reverse order and forgets them. */
  stop(): Promise<void>;

  /**
   * Runs one endpoint. The steps are: check the scopes, parse the input, run
   * the handler, parse the output. Each step that fails throws an
   * `ApiaryError` with the status of the failure. The body of the result is
   * the parsed output.
   */
  invoke<K extends keyof B["endpoints"] & string>(
    id: K,
    raw: RawInput,
    caller: Caller,
  ): Promise<Result<z.output<OutputSchema<B, K>>>>;

  /** Subscribes a listener to an event. Returns a function that removes it. */
  on<E extends Event>(event: E, listener: Listener<E>): () => void;
}
