import type { Bundle } from "@open-apiary/schema";
import type { Apiary, Options } from "./types";

import { makeContainer } from "./container";
import { makeEmitter } from "./events";
import { makeInvoker } from "./invoke";
import { makeRegistry } from "./registry";

/**
 * Makes the runtime service over a bundle. The bundle is the default export
 * of the module that `apiary build` wrote. The service reads the endpoints
 * into its registry and the service classes into its container. It runs no
 * code of the bundle until `start`.
 *
 * ```ts
 * import bundle from "@acme/api";
 *
 * const api = makeApiary(bundle);
 * await api.start();
 * const { status, body } = await api.invoke("getUsersById", { path: { id } }, caller);
 * ```
 *
 * @param bundle - The bundle.
 * @param options - The authorization function.
 * @throws DuplicateServiceError when two services share an id.
 */
export const makeApiary = <B extends Bundle>(
  bundle: B,
  options: Options = {},
): Apiary<B> => {
  const emitter = makeEmitter();
  const registry = makeRegistry(bundle.endpoints);
  const container = makeContainer(bundle.services, emitter);

  let started = false;
  const invoke = makeInvoker(
    registry,
    container,
    emitter,
    options,
    () => started,
  );

  return {
    registry,
    openapi: bundle.openapi,
    start: async () => {
      if (started) {
        return;
      }
      await container.start();
      started = true;
    },
    stop: async () => {
      if (!started) {
        return;
      }
      started = false;
      await container.stop();
    },
    invoke: invoke as Apiary<B>["invoke"],
    on: emitter.on,
  };
};
