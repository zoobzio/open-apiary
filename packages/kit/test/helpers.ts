import type {
  AnyDefinition,
  AnyEndpoint,
  ServiceClass,
} from "@open-apiary/schema";
import type {
  Found,
  FoundEndpoint,
  FoundService,
  Identified,
  KitConfig,
} from "../src/types";

import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFINITION } from "@open-apiary/schema";

import { identify } from "../src/identify";

/** The fixtures directory as a trailing-slash file URL. */
export const FIXTURES = new URL("./fixtures/", import.meta.url);

/** The absolute root of the fixture project: a consumer with a config and a source. */
export const PROJECT = fileURLToPath(new URL("project", FIXTURES));

/** The absolute source directory of the fixture project. */
export const SOURCE = join(PROJECT, "src");

/**
 * A fake project root for the tests that build `Found` objects in memory. No
 * file lives there. Issues name files relative to it.
 */
export const ROOT = "/project";

/** The smallest config. The source tests do not read the file system. */
export const CONFIG: KitConfig = { source: "./src" };

/**
 * Makes a found endpoint from a definition, as the scan would. `file` is
 * relative to {@link ROOT}. `over` replaces members of the definition, which
 * lets a test build a shape the types of `apiary` forbid.
 */
export const endpointOf = (
  endpoint: AnyEndpoint,
  file: string,
  over: Partial<AnyDefinition> = {},
): FoundEndpoint => ({
  file: join(ROOT, file),
  definition: { ...endpoint[DEFINITION], ...over },
});

/** Makes an identified endpoint. The id defaults to the derived one. */
export const identifiedOf = (
  endpoint: AnyEndpoint,
  file: string,
  id?: string,
): Identified => {
  const found = endpointOf(endpoint, file);
  const { method, route } = found.definition;
  return { ...found, id: id ?? identify(method, route) };
};

/** Makes a found service, as the scan would. `file` is relative to {@link ROOT}. */
export const serviceOf = (
  service: ServiceClass,
  file: string,
): FoundService => ({ file: join(ROOT, file), service });

/** Makes a scan result from found endpoints and services. */
export const foundOf = (
  endpoints: FoundEndpoint[] = [],
  services: FoundService[] = [],
): Found => ({
  endpoints,
  services,
  files: [...endpoints, ...services].map((item) => item.file),
});

/**
 * Runs a function and returns the error of the given class that it throws.
 * Any other outcome fails the test.
 */
export const thrown = <E extends Error>(
  fn: () => unknown,
  type: new (...args: never[]) => E,
): E => {
  try {
    fn();
  } catch (error) {
    if (error instanceof type) {
      return error;
    }
    throw error;
  }
  throw new Error(`expected ${type.name} to be thrown`);
};
