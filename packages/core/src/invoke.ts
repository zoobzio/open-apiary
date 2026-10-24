import type { z } from "zod";
import type { BodyValidators, Caller, Context } from "@open-apiary/schema";
import type { Container } from "./container";
import type { Emitter } from "./events";
import type { InternalRegistry } from "./registry";
import type { Issue, Options, RawInput, Result } from "./types";

import {
  ForbiddenError,
  InvalidInputError,
  InvalidOutputError,
  NotStartedError,
  UnhandledEndpointError,
  UnknownEndpointError,
} from "./error";

/** The parts of the input, in the order of the checks. */
const PARTS = ["path", "query", "headers", "body"] as const;

/** The default authorization: the caller holds every scope of the endpoint. */
const subset = (caller: Caller, scopes: readonly string[]): boolean =>
  scopes.every((scope) => caller.scopes.includes(scope));

/** Maps the issues of a zod error to issues of a part. */
const issuesOf = (part: Issue["part"], error: z.ZodError): Issue[] =>
  error.issues.map((issue) => ({
    part,
    path: issue.path,
    message: issue.message,
  }));

/**
 * Parses each part of the raw input with its validator. A part without a
 * validator is absent from the result. A missing `path`, `query`, or
 * `headers` parses as an empty object. The function collects the issues of
 * every part before it throws.
 *
 * @throws InvalidInputError when a part fails.
 */
export const parseInput = (
  validators: BodyValidators,
  raw: RawInput,
): { [part: string]: unknown } => {
  const input: { [part: string]: unknown } = {};
  const issues: Issue[] = [];
  for (const part of PARTS) {
    const validator = validators[part];
    if (validator === undefined) {
      continue;
    }
    const value = raw[part] ?? (part === "body" ? undefined : {});
    const result = validator.safeParse(value);
    if (result.success) {
      input[part] = result.data;
    } else {
      issues.push(...issuesOf(part, result.error));
    }
  }
  if (issues.length > 0) {
    throw new InvalidInputError(issues);
  }
  return input;
};

/**
 * Makes the `invoke` function of a service over its registry and container.
 * `started` reports whether `start` ran.
 */
export const makeInvoker = (
  registry: InternalRegistry,
  container: Container,
  emitter: Emitter,
  options: Options,
  started: () => boolean,
) => {
  const authorize = options.authorize ?? subset;

  return async (
    id: string,
    raw: RawInput,
    caller: Caller,
  ): Promise<Result<unknown>> => {
    if (!started()) {
      throw new NotStartedError();
    }
    const registered = registry.lookup(id);
    if (registered === undefined) {
      throw new UnknownEndpointError(id);
    }
    const { definition, entry } = registered;
    const began = performance.now();
    const scope = container.scope();
    const ctx: Context = {
      use: (service) => scope.use(service),
      caller,
      endpoint: { id, method: entry.method, route: entry.route },
    };

    emitter.emit("invoke:start", { id });
    try {
      if (
        definition.scopes.length > 0 &&
        !authorize(caller, definition.scopes)
      ) {
        throw new ForbiddenError(definition.scopes);
      }
      const input = parseInput(definition.input, raw);
      if (definition.handler === undefined) {
        throw new UnhandledEndpointError(id);
      }
      const body = await definition.handler(ctx, input);
      const output = definition.output.safeParse(body);
      if (!output.success) {
        throw new InvalidOutputError(issuesOf("output", output.error));
      }
      const result = { status: definition.status, body: output.data };
      emitter.emit("invoke:end", {
        id,
        status: result.status,
        duration: performance.now() - began,
      });
      return result;
    } catch (error) {
      emitter.emit("invoke:error", {
        id,
        error,
        duration: performance.now() - began,
      });
      throw error;
    } finally {
      await scope.dispose();
    }
  };
};
