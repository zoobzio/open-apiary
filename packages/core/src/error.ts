import type { Issue } from "./types";

import { ApiaryError } from "@open-apiary/schema";

/**
 * Thrown by `invoke` when the id names no endpoint of the bundle. `id` holds
 * the name.
 */
export class UnknownEndpointError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`no endpoint registered under "${id}"`);
    this.name = "UnknownEndpointError";
    this.id = id;
  }
}

/**
 * Thrown by `invoke` when the endpoint has no handler. `apiary build` rejects
 * such an endpoint, so the error shows a bundle that was made by hand. `id`
 * holds the name.
 */
export class UnhandledEndpointError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`the endpoint "${id}" has no handler — call .handle()`);
    this.name = "UnhandledEndpointError";
    this.id = id;
  }
}

/** Thrown by `invoke` before `start` ran. */
export class NotStartedError extends Error {
  constructor() {
    super("the service is not started — call start() first");
    this.name = "NotStartedError";
  }
}

/**
 * Thrown by `invoke` when the caller lacks a scope of the endpoint. The
 * status is 403. `scopes` holds the scopes of the endpoint.
 */
export class ForbiddenError extends ApiaryError {
  readonly scopes: readonly string[];

  constructor(scopes: readonly string[]) {
    super(403, `the caller lacks a scope of: ${scopes.join(", ")}`, {
      error: "forbidden",
      scopes,
    });
    this.name = "ForbiddenError";
    this.scopes = scopes;
  }
}

/**
 * Thrown by `invoke` when a part of the input fails its validator. The status
 * is 400. `issues` holds every issue of every part. The body lists them.
 */
export class InvalidInputError extends ApiaryError {
  readonly issues: readonly Issue[];

  constructor(issues: readonly Issue[]) {
    super(400, `the input is invalid —\n${describe(issues)}`, {
      error: "invalid_input",
      issues,
    });
    this.name = "InvalidInputError";
    this.issues = issues;
  }
}

/**
 * Thrown by `invoke` when the value of the handler fails the output
 * validator. The status is 500. The body does not list the issues, since
 * they describe the service and not the request. `issues` holds them.
 */
export class InvalidOutputError extends ApiaryError {
  readonly issues: readonly Issue[];

  constructor(issues: readonly Issue[]) {
    super(500, `the output is invalid —\n${describe(issues)}`, {
      error: "invalid_output",
    });
    this.name = "InvalidOutputError";
    this.issues = issues;
  }
}

/**
 * Thrown by `use` when the class is not a service of the bundle. `id` holds
 * the id of the class.
 */
export class UnknownServiceError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`no service registered under "${id}"`);
    this.name = "UnknownServiceError";
    this.id = id;
  }
}

/**
 * Thrown by `makeApiary` when two service classes share an id. `id` holds
 * it.
 */
export class DuplicateServiceError extends Error {
  readonly id: string;

  constructor(id: string) {
    super(`two services share the id "${id}"`);
    this.name = "DuplicateServiceError";
    this.id = id;
  }
}

/**
 * Thrown by `use` when the services resolve in a loop. `chain` holds the ids,
 * up to and including the repeated one.
 */
export class CircularServiceError extends Error {
  readonly chain: readonly string[];

  constructor(chain: readonly string[]) {
    super(`service chain loops: ${chain.join(" → ")}`);
    this.name = "CircularServiceError";
    this.chain = chain;
  }
}

/**
 * Thrown by `use` when a singleton resolves a scoped service. The scoped
 * instance would live as long as the singleton, which breaks its lifetime.
 * `id` is the scoped service. `from` is the singleton.
 */
export class CaptiveServiceError extends Error {
  readonly id: string;
  readonly from: string;

  constructor(id: string, from: string) {
    super(`the singleton "${from}" cannot use the scoped service "${id}"`);
    this.name = "CaptiveServiceError";
    this.id = id;
    this.from = from;
  }
}

/** Formats issues as indented lines. */
const describe = (issues: readonly Issue[]): string => {
  return issues
    .map(
      (issue) => `  ${[issue.part, ...issue.path].join(".")}: ${issue.message}`,
    )
    .join("\n");
};
