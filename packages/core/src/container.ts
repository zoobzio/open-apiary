import type { Resolver, Service, ServiceClass } from "@open-apiary/schema";
import type { Emitter } from "./events";

import { serviceId, serviceLifetime } from "@open-apiary/schema";

import {
  CaptiveServiceError,
  CircularServiceError,
  DuplicateServiceError,
  UnknownServiceError,
} from "./error";

/**
 * A scope of instances. The root scope holds the singletons. A call scope
 * holds the scoped instances of one call. `dispose` runs `dispose` on each
 * instance in reverse order of creation and forgets them.
 */
export interface Scope extends Resolver {
  dispose(): Promise<void>;
}

/** The container of a service: the root scope, and a call scope on demand. */
export interface Container {
  /** Makes every singleton and runs `setup` on each, in order of creation. */
  start(): Promise<void>;

  /** Disposes the singletons. */
  stop(): Promise<void>;

  /** Opens a scope for one call. */
  scope(): Scope;
}

/**
 * Makes the container of a bundle. The container knows the service classes
 * of the bundle, and no other. `use` with another class throws
 * `UnknownServiceError`.
 *
 * @throws DuplicateServiceError when two classes share an id.
 */
export const makeContainer = (
  services: readonly ServiceClass[],
  emitter: Emitter,
): Container => {
  const known = new Set<ServiceClass>();
  const ids = new Map<string, ServiceClass>();
  for (const service of services) {
    const id = serviceId(service);
    const other = ids.get(id);
    if (other !== undefined && other !== service) {
      throw new DuplicateServiceError(id);
    }
    ids.set(id, service);
    known.add(service);
  }

  /** The singletons, in order of creation. */
  const root: { instances: Map<ServiceClass, Service>; order: Service[] } = {
    instances: new Map(),
    order: [],
  };

  /**
   * Resolves a class. A singleton lives in the root. A scoped instance lives
   * in `store`, the scope of the call. `chain` holds the ids under
   * construction, for the loop check. `captive` is the nearest singleton in
   * the chain, when there is one: a singleton cannot hold a scoped instance,
   * because the instance would outlive its call.
   */
  const resolve = <T extends Service>(
    service: ServiceClass<T>,
    store: { instances: Map<ServiceClass, Service>; order: Service[] },
    chain: readonly string[],
    captive: string | undefined,
  ): T => {
    if (!known.has(service)) {
      throw new UnknownServiceError(serviceId(service));
    }
    const id = serviceId(service);
    const lifetime = serviceLifetime(service);
    if (lifetime === "scoped" && captive !== undefined) {
      throw new CaptiveServiceError(id, captive);
    }
    const target = lifetime === "singleton" ? root : store;
    const existing = target.instances.get(service);
    if (existing !== undefined) {
      return existing as T;
    }
    if (chain.includes(id)) {
      throw new CircularServiceError([...chain, id]);
    }
    const next = [...chain, id];
    const resolver: Resolver = {
      use: (dependency) =>
        resolve(
          dependency,
          target,
          next,
          lifetime === "singleton" ? id : captive,
        ),
    };
    const instance = new service(resolver);
    target.instances.set(service, instance);
    target.order.push(instance);
    emitter.emit("service:create", { id, lifetime });
    return instance;
  };

  /** Disposes the instances of a store in reverse order and empties it. */
  const dispose = async (store: {
    instances: Map<ServiceClass, Service>;
    order: Service[];
  }): Promise<void> => {
    const instances = store.order.splice(0).reverse();
    store.instances.clear();
    for (const instance of instances) {
      await instance.dispose();
    }
  };

  return {
    start: async () => {
      for (const service of services) {
        if (serviceLifetime(service) === "singleton") {
          resolve(service, root, [], undefined);
        }
      }
      for (const instance of [...root.order]) {
        await instance.setup();
      }
    },
    stop: () => dispose(root),
    scope: () => {
      const store = { instances: new Map<ServiceClass, Service>(), order: [] };
      return {
        use: (service) => resolve(service, store, [], undefined),
        dispose: () => dispose(store),
      };
    },
  };
};
