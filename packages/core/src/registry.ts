import type { AnyDefinition, Endpoints } from "@open-apiary/schema";
import type { Pattern } from "./route";
import type { Entry, Match, Registry } from "./types";

import { DEFINITION } from "@open-apiary/schema";

import { compile, match } from "./route";

/** An endpoint as the registry holds it: the entry, the definition, and the pattern. */
export interface Registered {
  readonly entry: Entry;
  readonly definition: AnyDefinition;
  readonly pattern: Pattern;
}

/** The registry with the definitions, for the invoker. */
export interface InternalRegistry extends Registry {
  /** Returns the registered endpoint of an id, or `undefined`. */
  lookup(id: string): Registered | undefined;
}

/**
 * Makes the registry of a bundle. The registry reads the definition of each
 * endpoint once. `match` checks the endpoints of a method from the most
 * static route to the least, so `/users/me` wins over `/users/{id}`.
 */
export const makeRegistry = (endpoints: Endpoints): InternalRegistry => {
  const registered = new Map<string, Registered>();

  for (const [id, endpoint] of Object.entries(endpoints)) {
    const definition = endpoint[DEFINITION];
    registered.set(id, {
      definition,
      pattern: compile(definition.route),
      entry: {
        id,
        method: definition.method,
        route: definition.route,
        status: definition.status,
        errors: Object.keys(definition.errors).map(Number),
        scopes: definition.scopes,
        tags: definition.tags,
      },
    });
  }

  /** The endpoints in match order: by weight, highest first, then by id. */
  const ordered = [...registered.values()].sort(
    (a, b) =>
      b.pattern.weight - a.pattern.weight ||
      a.entry.id.localeCompare(b.entry.id),
  );

  return {
    list: () => [...registered.values()].map((item) => item.entry),
    get: (id) => registered.get(id)?.entry,
    lookup: (id) => registered.get(id),
    match: (method, path): Match | undefined => {
      const upper = method.toUpperCase();
      for (const item of ordered) {
        if (item.entry.method !== upper) {
          continue;
        }
        const params = match(item.pattern, path);
        if (params) {
          return { id: item.entry.id, params };
        }
      }
      return undefined;
    },
  };
};
