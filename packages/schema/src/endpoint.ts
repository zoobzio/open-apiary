import type { z } from "zod";
import type {
  AnyEndpoint,
  BodyValidators,
  Definition,
  Endpoint,
  Handler,
  Method,
  PathCheck,
  Route,
  Spec,
  ValidatorsOf,
} from "./types";

import { DEFAULT_STATUS, DEFINITION } from "./constant";

/**
 * Makes an endpoint over a definition. Each method copies the definition with
 * one change and makes a new endpoint over the copy.
 */
const makeEndpoint = <
  M extends Method,
  R extends Route,
  I extends BodyValidators,
  O extends z.ZodType,
  H extends boolean,
>(
  definition: Definition<M, R, I, O, H>,
): Endpoint<M, R, I, O, H> => {
  const next = <N extends boolean>(
    change: Partial<Definition<M, R, I, O, N>>,
  ): Endpoint<M, R, I, O, N> =>
    makeEndpoint<M, R, I, O, N>({
      ...(definition as unknown as Definition<M, R, I, O, N>),
      ...change,
    });

  return {
    [DEFINITION]: definition,
    handle: (handler: Handler<I, O>) => next<true>({ handler }),
    withScopes: (...scopes: string[]) =>
      next<H>({ scopes: [...definition.scopes, ...scopes] }),
    withTags: (...tags: string[]) =>
      next<H>({ tags: [...definition.tags, ...tags] }),
    withStatus: (status: number) => next<H>({ status }),
    withErrors: (errors: { [status: number]: z.ZodType }) =>
      next<H>({ errors: { ...definition.errors, ...errors } }),
    withSpec: (spec: Spec) =>
      next<H>({ spec: { ...definition.spec, ...spec } }),
  };
};

/**
 * Makes the definition function of one method. The function takes the route,
 * the validators, and the output validator, and returns an endpoint with no
 * handler.
 */
const define =
  <M extends Method>(method: M) =>
  <
    R extends Route,
    I extends ValidatorsOf<M> & PathCheck<R>,
    O extends z.ZodType,
  >(
    route: R,
    input: I,
    output: O,
  ): Endpoint<M, R, I, O, false> =>
    makeEndpoint<M, R, I, O, false>({
      method,
      route,
      input,
      output,
      status: DEFAULT_STATUS[method],
      errors: {},
      scopes: [],
      tags: [],
      spec: {},
      handler: undefined,
    });

/**
 * The definition functions, one for each method. Each takes the route, the
 * validators of the input, and the validator of the output. The route is an
 * OpenAPI path: `/users/{id}`. The `path` validator has one member for each
 * parameter of the route. `GET` and `DELETE` take no `body`.
 *
 * ```ts
 * export default apiary
 *   .GET("/users/{id}", { path: z.object({ id: z.uuid() }) }, User)
 *   .handle(async (ctx, input) => ctx.use(Users).find(input.path.id))
 *   .withScopes("users:read")
 *   .withTags("users");
 * ```
 */
export const apiary = {
  GET: define("GET"),
  POST: define("POST"),
  PUT: define("PUT"),
  PATCH: define("PATCH"),
  DELETE: define("DELETE"),
};

/** Whether a value is an endpoint: an object with a definition under {@link DEFINITION}. */
export const isEndpoint = (value: unknown): value is AnyEndpoint => {
  return typeof value === "object" && value !== null && DEFINITION in value;
};
