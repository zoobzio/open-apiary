import type {
  BuildOptions,
  GenerateOptions,
  Kit,
  KitConfig,
  Output,
} from "./types";

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import { bundle } from "./bundle";
import { FILENAME, OPENAPI } from "./constant";
import { entry, entryPath } from "./emit";
import { loadConfig } from "./load";
import { derive } from "./openapi";
import { scan } from "./scan";
import { json, record } from "./util";
import { validateConfig, validateSource } from "./validate";

/** Types an `apiary.config.ts`. The function returns the config that it receives. */
export const defineConfig = (config: KitConfig): KitConfig => config;

/**
 * Reads the name and the version of the `package.json` of a root. Returns
 * an empty identity when the file is missing or unreadable.
 */
const identity = async (
  root: string,
): Promise<{ name?: string; version?: string }> => {
  try {
    const pkg: unknown = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    );
    if (!record(pkg)) {
      return {};
    }
    return {
      ...(typeof pkg.name === "string" && { name: pkg.name }),
      ...(typeof pkg.version === "string" && { version: pkg.version }),
    };
  } catch {
    return {};
  }
};

/**
 * Validates a config, scans its source, and derives the OpenAPI document.
 * The function writes nothing. {@link build} takes the result to the
 * bundler. A consumer that wants the endpoints, the services, or the
 * document without a bundle, such as a framework module, calls this one.
 *
 * @param config - The kit config.
 * @param options - The project root and the identity of the project.
 * @throws InvalidConfigError when the config breaks a rule. The function
 * throws before it reads a file.
 * @throws InvalidSourceError when the source breaks a rule.
 */
export const generate = async (
  config: KitConfig,
  options: GenerateOptions = {},
): Promise<Kit> => {
  const root = resolve(options.cwd ?? process.cwd());
  const { source, outDir } = validateConfig(config, root);
  const found = await scan(source);
  const endpoints = validateSource(found, config, root);
  const openapi = derive(endpoints, config, options, root);
  return {
    endpoints,
    services: found.services,
    openapi,
    root,
    outDir,
    files: found.files,
  };
};

/** Lists the files under a directory, at every depth, relative to it. */
const list = async (dir: string, base = dir): Promise<string[]> => {
  const files: string[] = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...(await list(path, base)));
    } else {
      files.push(relative(base, path));
    }
  }
  return files.sort();
};

/**
 * Runs the whole build. The function loads the config, generates the kit,
 * empties the output directory, writes the entry module, bundles it, and
 * writes the OpenAPI document beside the bundle. The CLI runs this function.
 *
 * @param options - The root and the config path.
 */
export const build = async (options: BuildOptions = {}): Promise<Output> => {
  const root = resolve(options.root ?? process.cwd());
  const config = await loadConfig(resolve(root, options.config ?? FILENAME));
  const kit = await generate(config, { cwd: root, ...(await identity(root)) });

  const out = join(root, kit.outDir);
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  const entryFile = join(root, entryPath());
  await mkdir(dirname(entryFile), { recursive: true });
  await writeFile(entryFile, entry(kit));

  await bundle(kit);
  await writeFile(join(out, OPENAPI), json(kit.openapi));

  return { outDir: kit.outDir, files: await list(out) };
};
