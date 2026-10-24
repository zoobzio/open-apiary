import type { Apiary } from "open-apiary";

let instance: Apiary | undefined;

/** Stores the service of the server. The plugin calls it at start. */
export const setApiary = (api: Apiary | undefined): void => {
  instance = api;
};

/**
 * Returns the service of the server. The plugin makes it at start.
 *
 * @throws When the plugin has not run.
 */
export const useApiary = (): Apiary => {
  if (instance === undefined) {
    throw new Error("@open-apiary/nuxt: the service is not started");
  }
  return instance;
};
