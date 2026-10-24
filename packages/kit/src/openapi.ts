import type { z } from "zod";
import type { Identified, KitConfig } from "./types";

import { relative } from "node:path";

import { z as zod } from "zod";

import { OPENAPI_VERSION, REASONS } from "./constant";
import { InvalidSourceError } from "./error";
import { merge, record } from "./util";

/** The location of a parameter in a request. */
type Location = "path" | "query" | "header";

/** The JSON Schema of a validator, with the `$schema` member removed. */
const schemaOf = (
  validator: z.ZodType,
  io: "input" | "output",
): Record<string, unknown> => {
  const schema: Record<string, unknown> = zod.toJSONSchema(validator, { io });
  delete schema.$schema;
  return schema;
};

/**
 * Makes the parameters of one part. The part is a validator of an object.
 * Each property is one parameter. A path parameter is always required. Any
 * other parameter is required when the object requires it.
 */
const parameters = (
  validator: z.ZodObject,
  location: Location,
): Record<string, unknown>[] => {
  const schema = schemaOf(validator, "input");
  const properties = record(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: location,
    required: location === "path" || required.includes(name),
    schema: property,
  }));
};

/** The description of a response: the reason phrase, or the status. */
const describe = (status: number): string =>
  REASONS[status] ?? `Response ${status}`;

/** Makes a response with a JSON body, or with no body for 204. */
const response = (
  status: number,
  validator: z.ZodType,
): Record<string, unknown> => {
  if (status === 204) {
    return { description: describe(status) };
  }
  return {
    description: describe(status),
    content: { "application/json": { schema: schemaOf(validator, "output") } },
  };
};

/**
 * Makes the operation of an endpoint. The operation has the id, the tags,
 * the parameters of `path`, `query`, and `headers`, the request body, the
 * success response, each error response, and the security requirement. The
 * `spec` of the endpoint merges over it, less `operationId`.
 */
const operation = (
  endpoint: Identified,
  security: string | undefined,
): Record<string, unknown> => {
  const { id, definition } = endpoint;
  const { input, output, status, errors, scopes, tags, spec } = definition;

  const inferred: Record<string, unknown> = { operationId: id };
  if (tags.length > 0) {
    inferred.tags = [...tags];
  }

  const params = [
    ...(input.path ? parameters(input.path, "path") : []),
    ...(input.query ? parameters(input.query, "query") : []),
    ...(input.headers ? parameters(input.headers, "header") : []),
  ];
  if (params.length > 0) {
    inferred.parameters = params;
  }

  if (input.body) {
    inferred.requestBody = {
      required: !input.body.safeParse(undefined).success,
      content: {
        "application/json": { schema: schemaOf(input.body, "input") },
      },
    };
  }

  const responses: Record<string, unknown> = {
    [status]: response(status, output),
  };
  for (const [code, validator] of Object.entries(errors)) {
    responses[code] = response(Number(code), validator);
  }
  inferred.responses = responses;

  if (scopes.length > 0 && security !== undefined) {
    inferred.security = [{ [security]: [...scopes] }];
  }

  const extension: Record<string, unknown> = { ...spec };
  delete extension.operationId;
  return merge(inferred, extension) as Record<string, unknown>;
};

/**
 * Derives the OpenAPI document of a build. The document has one path item
 * for each route and one operation for each endpoint. `info` defaults to
 * the identity of the project. The `openapi` of the config merges over the
 * whole document.
 *
 * @param endpoints - The validated endpoints, in id order.
 * @param config - The config.
 * @param identity - The name and the version of the project.
 * @param root - The absolute project root. Issues name files relative to it.
 * @throws InvalidSourceError when a validator has no JSON Schema form.
 */
export const derive = (
  endpoints: Identified[],
  config: KitConfig,
  identity: { name?: string; version?: string },
  root: string,
): Record<string, unknown> => {
  const paths: Record<string, Record<string, unknown>> = {};
  const issues: string[] = [];

  for (const endpoint of endpoints) {
    const { route, method } = endpoint.definition;
    try {
      const item = (paths[route] ??= {});
      item[method.toLowerCase()] = operation(endpoint, config.security);
    } catch (error) {
      issues.push(
        `${relative(root, endpoint.file)}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (issues.length > 0) {
    throw new InvalidSourceError(issues);
  }

  const document: Record<string, unknown> = {
    openapi: OPENAPI_VERSION,
    info: {
      title: identity.name ?? "API",
      version: identity.version ?? "0.0.0",
    },
    paths,
  };
  return merge(document, config.openapi ?? {}) as Record<string, unknown>;
};
