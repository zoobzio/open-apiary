/**
 * The key that holds the definition of an endpoint. The builder stores the
 * definition under it, and the kit and the core read it from there. The key is
 * a registered symbol, so a module that loads twice still shares it.
 */
export const DEFINITION: unique symbol = Symbol.for("open-apiary.definition");

/**
 * The static brand of a service class. `Service` sets it, and a subclass
 * inherits it. The kit and the core test it in place of `instanceof`, so a
 * class from a second copy of this package is still a service.
 */
export const SERVICE: unique symbol = Symbol.for("open-apiary.service");

/**
 * The HTTP methods that `apiary` defines. The order is the order of the
 * OpenAPI operations under one path.
 */
export const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/**
 * The success status that a method answers with when the endpoint does not
 * set one with `withStatus`.
 */
export const DEFAULT_STATUS: {
  readonly [M in (typeof METHODS)[number]]: number;
} = {
  GET: 200,
  POST: 201,
  PUT: 200,
  PATCH: 200,
  DELETE: 200,
};
