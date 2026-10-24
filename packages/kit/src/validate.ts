import type { Found, Identified, KitConfig } from "./types";

import { existsSync, statSync } from "node:fs";
import { isAbsolute, normalize, relative, resolve, sep } from "node:path";

import { serviceId } from "@open-apiary/schema";

import { OUT_DIR } from "./constant";
import { InvalidConfigError, InvalidSourceError } from "./error";
import { identify } from "./identify";
import { params } from "./route";
import { record } from "./util";

/** The paths of a config, resolved against the project root. */
export interface ResolvedPaths {
  /** The absolute source directory. */
  source: string;

  /** The output directory, normalized and relative to the project root. */
  outDir: string;
}

/** Whether a relative path stays inside its base: it is not empty and does not climb out. */
const inside = (rel: string): boolean => {
  return (
    rel !== "" &&
    rel !== ".." &&
    !rel.startsWith(`..${sep}`) &&
    !isAbsolute(rel)
  );
};

/**
 * Checks a config against the rules of the kit and resolves its paths. The
 * source is a directory that exists. The output directory stays inside the
 * project root and is not the root, because a build empties it. A `security`
 * names a scheme that `openapi.components.securitySchemes` declares.
 *
 * @param config - The config.
 * @param root - The absolute project root.
 * @throws InvalidConfigError when the config breaks a rule.
 */
export const validateConfig = (
  config: KitConfig,
  root: string,
): ResolvedPaths => {
  const issues: string[] = [];

  const source = resolve(root, config.source);
  if (config.source === "") {
    issues.push("`source` is empty");
  } else if (!existsSync(source) || !statSync(source).isDirectory()) {
    issues.push(`\`source\` is not a directory: ${source}`);
  }

  const outDir = normalize(config.outDir ?? OUT_DIR);
  const relOut = relative(root, resolve(root, outDir));
  if (!inside(relOut)) {
    issues.push(
      `\`outDir\` must be inside the project root and not the root itself: ${outDir}`,
    );
  }

  if (config.openapi !== undefined && !record(config.openapi)) {
    issues.push("`openapi` must be an object");
  }

  if (config.security !== undefined) {
    const schemes = config.openapi?.components?.securitySchemes;
    if (typeof config.security !== "string" || config.security === "") {
      issues.push("`security` must be the name of a security scheme");
    } else if (!record(schemes) || !(config.security in schemes)) {
      issues.push(
        `\`security\` names "${config.security}", but \`openapi.components.securitySchemes\` does not declare it`,
      );
    }
  }

  if (issues.length > 0) {
    throw new InvalidConfigError(issues);
  }
  return { source, outDir: relOut };
};

/** Whether two string lists hold the same members, in any order. */
const same = (a: readonly string[], b: readonly string[]): boolean => {
  return (
    a.length === b.length &&
    [...a].sort().join("\0") === [...b].sort().join("\0")
  );
};

/**
 * Checks what the scan found against the rules of the kit and assigns each
 * endpoint its operation id. The rules are:
 *
 * - Every endpoint has a handler.
 * - No two endpoints share a method and a route.
 * - The `path` validator of an endpoint has one member for each parameter of
 *   the route, and no other.
 * - No two endpoints share an operation id.
 * - An endpoint with scopes requires `security` in the config.
 * - No two services share an id.
 *
 * @param found - What the scan found.
 * @param config - The config.
 * @param root - The absolute project root. Issues name files relative to it.
 * @returns The endpoints with their ids, in id order.
 * @throws InvalidSourceError when the source breaks a rule.
 */
export const validateSource = (
  found: Found,
  config: KitConfig,
  root: string,
): Identified[] => {
  const issues: string[] = [];
  const at = (file: string): string => relative(root, file);

  const routes = new Map<string, string>();
  const ids = new Map<string, string>();
  const identified: Identified[] = [];

  for (const endpoint of found.endpoints) {
    const { file, definition } = endpoint;
    const where = at(file);

    if (definition.handler === undefined) {
      issues.push(`${where}: the endpoint has no handler — call .handle()`);
    }

    const key = `${definition.method} ${definition.route}`;
    const other = routes.get(key);
    if (other !== undefined) {
      issues.push(`${where}: ${key} is also defined in ${other}`);
    } else {
      routes.set(key, where);
    }

    const expected = params(definition.route);
    const actual = Object.keys(definition.input.path?.shape ?? {});
    if (!same(expected, actual)) {
      issues.push(
        `${where}: the route has the parameters [${expected.join(", ")}] but the \`path\` validator has [${actual.join(", ")}]`,
      );
    }

    const spec = definition.spec.operationId;
    const id =
      typeof spec === "string" && spec !== ""
        ? spec
        : identify(definition.method, definition.route);
    const holder = ids.get(id);
    if (holder !== undefined) {
      issues.push(
        `${where}: the operation id "${id}" is also used by ${holder}`,
      );
    } else {
      ids.set(id, where);
    }

    if (definition.scopes.length > 0 && config.security === undefined) {
      issues.push(
        `${where}: the endpoint has scopes, but the config sets no \`security\` scheme`,
      );
    }

    identified.push({ ...endpoint, id });
  }

  const services = new Map<string, string>();
  for (const { file, service } of found.services) {
    const id = serviceId(service);
    const holder = services.get(id);
    if (holder !== undefined) {
      issues.push(
        `${at(file)}: the service id "${id}" is also used by ${holder}`,
      );
    } else {
      services.set(id, at(file));
    }
  }

  if (issues.length > 0) {
    throw new InvalidSourceError(issues);
  }
  return identified.sort((a, b) => a.id.localeCompare(b.id));
};
