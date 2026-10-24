import type { KitConfig } from "./types";

import { existsSync } from "node:fs";

import { createJiti } from "jiti";

import { MalformedConfigError, MissingConfigError } from "./error";
import { record } from "./util";

/** Whether a value is a plain record with a `source` string. {@link validateConfig} checks the rest. */
const isConfig = (value: unknown): value is KitConfig => {
  return record(value) && typeof value.source === "string";
};

/**
 * Loads a config file through jiti and returns its default export. The file
 * can be TypeScript or JavaScript. The function checks the outer shape of the
 * export. An error that the file throws while it runs reaches the caller.
 *
 * @param path - The absolute path to the config file.
 * @throws MissingConfigError when no file exists at `path`.
 * @throws MalformedConfigError when the default export is not a config.
 */
export const loadConfig = async (path: string): Promise<KitConfig> => {
  if (!existsSync(path)) {
    throw new MissingConfigError(path);
  }
  const jiti = createJiti(import.meta.url, { moduleCache: false });
  const config = await jiti.import<unknown>(path, { default: true });
  if (!isConfig(config)) {
    throw new MalformedConfigError(path);
  }
  return config;
};
