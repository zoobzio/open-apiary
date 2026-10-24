import type { Resolver } from "./types";

import { SERVICE } from "./constant";

/**
 * How long an instance of a service lives. A `singleton` is made once, at
 * start, and lives for the run. A `scoped` service is made at most once for
 * each call of a handler and is disposed when the call ends.
 */
export type Lifetime = "singleton" | "scoped";

/**
 * The base class of a service. A consumer exports a subclass as the default
 * export of a module. The kit finds it, and the core makes the instances. A
 * handler gets one with `ctx.use(TheClass)`. A service gets another with
 * `this.use(TheClass)`.
 *
 * - `lifetime` sets how long an instance lives. The default is `singleton`.
 * - `id` names the service. The default is the class name. Two services with
 *   one id fail the build.
 * - `setup` runs once for each singleton at start, in dependency order. The
 *   core does not call it on a scoped service.
 * - `dispose` runs at stop for a singleton, and at the end of the call for a
 *   scoped service, in reverse order of creation.
 *
 * ```ts
 * export default class Users extends Service {
 *   static override readonly lifetime = "singleton";
 *   private readonly db = this.use(Db);
 *   find(id: string) { return this.db.get(id); }
 * }
 * ```
 */
export abstract class Service {
  static readonly [SERVICE] = true;

  /** How long an instance lives. */
  static readonly lifetime: Lifetime = "singleton";

  /** The id of the service. The default is the class name. */
  static readonly id?: string;

  readonly #resolver: Resolver;

  constructor(resolver: Resolver) {
    this.#resolver = resolver;
  }

  /** Resolves another service in the same scope. */
  protected use<T extends Service>(service: ServiceClass<T>): T {
    return this.#resolver.use(service);
  }

  /** Runs once at start. Singletons only. */
  setup(): void | Promise<void> {}

  /** Runs when the instance ends. */
  dispose(): void | Promise<void> {}
}

/**
 * A concrete subclass of {@link Service}. The core constructs it with a
 * resolver. The static members come from the base class or the subclass.
 */
export interface ServiceClass<T extends Service = Service> {
  new (resolver: Resolver): T;
  readonly name: string;
  readonly lifetime?: Lifetime;
  readonly id?: string;
}

/** Returns the id of a service class: `id` when set, else the class name. */
export const serviceId = (service: ServiceClass): string => {
  return service.id ?? service.name;
};

/** Returns the lifetime of a service class. The default is `singleton`. */
export const serviceLifetime = (service: ServiceClass): Lifetime => {
  return service.lifetime ?? "singleton";
};

/**
 * Whether a value is a service class: a function that carries the brand of
 * {@link Service}. The test does not use `instanceof`, so a class from a
 * second copy of this package passes.
 */
export const isService = (value: unknown): value is ServiceClass => {
  return (
    typeof value === "function" &&
    (value as { [SERVICE]?: unknown })[SERVICE] === true
  );
};
