import type { z } from "zod";
import type { DEFINITION, METHODS } from "./constant";
import type { Service, ServiceClass } from "./service";

/** An HTTP method that `apiary` defines. */
export type Method = (typeof METHODS)[number];

/**
 * The route of an endpoint. It starts with a slash. A path parameter is a
 * name in braces, as OpenAPI writes it: `/users/{id}`.
 */
export type Route = `/${string}`;

/** The names of the path parameters of a route, as a union. */
export type PathParams<R extends string> =
  R extends `${string}{${infer P}}${infer Rest}` ? P | PathParams<Rest> : never;

/**
 * The validators of an endpoint without a body. Each member validates one
 * part of the input. A missing member means the endpoint reads no such part.
 */
export interface Validators {
  path?: z.ZodObject;
  query?: z.ZodObject;
  headers?: z.ZodObject;
}

/** The validators of an endpoint with a body. */
export interface BodyValidators extends Validators {
  body?: z.ZodType;
}

/**
 * The validators that a method accepts. `GET` and `DELETE` have no body, so
 * `body` is `never` for them, and a `body` member fails even beside other
 * members.
 */
export type ValidatorsOf<M extends Method> = M extends "GET" | "DELETE"
  ? Validators & { body?: never }
  : BodyValidators;

/**
 * The rule that binds the `path` validator to the route. A route with
 * parameters requires a `path` object with one member for each parameter. A
 * route without parameters forbids `path`.
 */
export type PathCheck<R extends string> = [PathParams<R>] extends [never]
  ? { path?: never }
  : { path: z.ZodObject<{ [K in PathParams<R>]: z.ZodType }> };

/**
 * The input of a handler: the parsed value of each validator that the
 * endpoint has. A part that has no validator is absent.
 */
export type InputOf<I> = {
  readonly [
    K in keyof I as NonNullable<I[K]> extends z.ZodType ? K : never
  ]: z.output<NonNullable<I[K]> & z.ZodType>;
};

/**
 * What a handler returns: a value that the output validator accepts, or a
 * promise of one.
 */
export type OutputOf<O extends z.ZodType> = z.input<O> | Promise<z.input<O>>;

/**
 * The caller of an endpoint. The framework builds it from the request, for
 * example from a bearer token. `scopes` is what the core checks against the
 * scopes of the endpoint. The other members are for the handler.
 */
export interface Caller {
  readonly scopes: readonly string[];
  readonly [key: string]: unknown;
}

/**
 * Resolves a service by its class. The class is the key and the type. A
 * singleton resolves to the one instance of the run. A scoped service
 * resolves to the one instance of the call.
 */
export interface Resolver {
  use<T extends Service>(service: ServiceClass<T>): T;
}

/** The endpoint of a call, as the context reports it. */
export interface Operation {
  readonly id: string;
  readonly method: Method;
  readonly route: Route;
}

/**
 * The context of one call of a handler. `use` resolves a service. `caller` is
 * who calls. `endpoint` names the endpoint.
 */
export interface Context extends Resolver {
  readonly caller: Caller;
  readonly endpoint: Operation;
}

/** The handler of an endpoint, typed by its validators. */
export type Handler<I, O extends z.ZodType> = (
  ctx: Context,
  input: InputOf<I>,
) => OutputOf<O>;

/**
 * The handler of an endpoint with its validators erased. The core and the kit
 * hold handlers of every shape under this type.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- the erased form takes any input
export type AnyHandler = (ctx: Context, input: any) => unknown;

/**
 * An extension of the OpenAPI operation. The kit merges it over the operation
 * that it infers from the definition. `operationId` replaces the inferred id.
 * Every other member merges by key, and an array replaces the inferred one.
 */
export interface Spec {
  operationId?: string;
  summary?: string;
  description?: string;
  deprecated?: boolean;
  [key: string]: unknown;
}

/**
 * The definition of an endpoint. The builder fills it. The kit reads it to
 * write the OpenAPI document. The core reads it to run the call. `handler`
 * is set when `handle` ran.
 */
export interface Definition<
  M extends Method = Method,
  R extends Route = Route,
  I extends BodyValidators = BodyValidators,
  O extends z.ZodType = z.ZodType,
  H extends boolean = boolean,
> {
  readonly method: M;
  readonly route: R;
  readonly input: I;
  readonly output: O;
  readonly status: number;
  readonly errors: { readonly [status: number]: z.ZodType };
  readonly scopes: readonly string[];
  readonly tags: readonly string[];
  readonly spec: Spec;
  readonly handler: H extends true ? Handler<I, O> : undefined;
}

/**
 * An endpoint under construction, or complete. Each method returns a new
 * endpoint and leaves this one as it is. `handle` sets the handler. The
 * other methods set metadata, before or after `handle`. The definition is
 * under {@link DEFINITION}.
 */
export interface Endpoint<
  M extends Method = Method,
  R extends Route = Route,
  I extends BodyValidators = BodyValidators,
  O extends z.ZodType = z.ZodType,
  H extends boolean = boolean,
> {
  readonly [DEFINITION]: Definition<M, R, I, O, H>;

  /** Sets the handler. The handler returns a value that `output` accepts. */
  handle(handler: Handler<I, O>): Endpoint<M, R, I, O, true>;

  /** Sets the scopes that a caller needs. The kit lists them under `security`. */
  withScopes(...scopes: string[]): Endpoint<M, R, I, O, H>;

  /** Sets the OpenAPI tags. */
  withTags(...tags: string[]): Endpoint<M, R, I, O, H>;

  /** Sets the success status. The default is 200, and 201 for `POST`. */
  withStatus(status: number): Endpoint<M, R, I, O, H>;

  /** Declares the error bodies by status. The kit lists each one under `responses`. */
  withErrors(errors: { [status: number]: z.ZodType }): Endpoint<M, R, I, O, H>;

  /** Extends the OpenAPI operation. */
  withSpec(spec: Spec): Endpoint<M, R, I, O, H>;
}

/** A definition with its validators erased. The core and the kit read this form. */
export interface AnyDefinition {
  readonly method: Method;
  readonly route: Route;
  readonly input: BodyValidators;
  readonly output: z.ZodType;
  readonly status: number;
  readonly errors: { readonly [status: number]: z.ZodType };
  readonly scopes: readonly string[];
  readonly tags: readonly string[];
  readonly spec: Spec;
  readonly handler: AnyHandler | undefined;
}

/** An endpoint of any shape. Every `Endpoint` satisfies it. */
export interface AnyEndpoint {
  readonly [DEFINITION]: AnyDefinition;
}

/** The endpoints of a bundle, by operation id. */
export type Endpoints = { readonly [id: string]: AnyEndpoint };

/**
 * What `apiary build` writes as the default export of the bundle. The core
 * runs it. `endpoints` has each endpoint by operation id. `services` has each
 * service class. `openapi` is the OpenAPI document.
 */
export interface Bundle<E extends Endpoints = Endpoints> {
  readonly endpoints: E;
  readonly services: readonly ServiceClass[];
  readonly openapi: Record<string, unknown>;
}

/** The output validator of an endpoint of a bundle, by operation id. */
export type OutputSchema<
  B extends Bundle,
  K extends keyof B["endpoints"],
> = B["endpoints"][K][typeof DEFINITION]["output"];
