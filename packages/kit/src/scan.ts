import type { Found } from "./types";

import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

import { isEndpoint, isService, DEFINITION } from "@open-apiary/schema";
import { createJiti } from "jiti";

import { EXTENSIONS } from "./constant";

/** Whether a file name is a source file: a known extension, and not a declaration. */
const isSource = (name: string): boolean => {
  if (name.endsWith(".d.ts") || name.endsWith(".d.mts")) {
    return false;
  }
  return (EXTENSIONS as readonly string[]).includes(extname(name));
};

/**
 * Lists the source files under a directory, at every depth, in path order.
 * The walk skips `node_modules` and every entry whose name starts with a dot.
 *
 * @param dir - The absolute directory.
 */
export const walk = async (dir: string): Promise<string[]> => {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(path)));
    } else if (entry.isFile() && isSource(entry.name)) {
      files.push(path);
    }
  }
  return files;
};

/**
 * Imports every source file under a directory and sorts the default exports.
 * A default export that is an endpoint joins `endpoints`. One that is a
 * service class joins `services`. Every other file is ignored. The function
 * imports through jiti, so a TypeScript file needs no build. An error that a
 * file throws while it runs reaches the caller.
 *
 * @param source - The absolute source directory.
 */
export const scan = async (source: string): Promise<Found> => {
  const jiti = createJiti(import.meta.url, { moduleCache: false });
  const found: Found = { endpoints: [], services: [], files: [] };
  for (const file of await walk(source)) {
    found.files.push(file);
    const value = await jiti.import<unknown>(file, { default: true });
    if (isEndpoint(value)) {
      found.endpoints.push({ file, definition: value[DEFINITION] });
    } else if (isService(value)) {
      found.services.push({ file, service: value });
    }
  }
  return found;
};
