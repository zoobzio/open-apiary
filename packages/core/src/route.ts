import type { Route } from "@open-apiary/schema";

/** A route compiled for matching. */
export interface Pattern {
  /** The names of the parameters, in order. */
  readonly names: readonly string[];

  /** The expression that matches a path and captures the parameters. */
  readonly regex: RegExp;

  /** The count of static segments. A match prefers a higher weight. */
  readonly weight: number;
}

/** A parameter segment: a name in braces. */
const PARAM = /^\{([^{}/]+)\}$/;

/** Escapes the characters of a static segment that are special in an expression. */
const escape = (segment: string): string =>
  segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Returns the parameter names of a route, in order. */
export const params = (route: string): string[] => {
  const names: string[] = [];
  for (const segment of route.split("/")) {
    const match = PARAM.exec(segment);
    if (match?.[1] !== undefined) {
      names.push(match[1]);
    }
  }
  return names;
};

/**
 * Compiles a route. A parameter segment matches one non-empty segment of a
 * path. A static segment matches itself. A trailing slash on the route is
 * dropped, and a trailing slash on the path is accepted. The root route
 * matches `/`.
 */
export const compile = (route: Route): Pattern => {
  const names: string[] = [];
  let weight = 0;
  const parts = route
    .split("/")
    .slice(1)
    .filter(
      (segment, index, all) => !(segment === "" && index === all.length - 1),
    )
    .map((segment) => {
      const match = PARAM.exec(segment);
      if (match?.[1] !== undefined) {
        names.push(match[1]);
        return "([^/]+)";
      }
      weight += 1;
      return escape(segment);
    });
  return {
    names,
    regex: new RegExp(parts.length === 0 ? "^/$" : `^/${parts.join("/")}/?$`),
    weight,
  };
};

/**
 * Matches a path against a pattern. Returns the decoded parameters, or
 * `undefined` when the path does not match.
 */
export const match = (
  pattern: Pattern,
  path: string,
): { [name: string]: string } | undefined => {
  const found = pattern.regex.exec(path);
  if (!found) {
    return undefined;
  }
  const result: { [name: string]: string } = {};
  pattern.names.forEach((name, index) => {
    const value = found[index + 1];
    if (value !== undefined) {
      result[name] = safeDecode(value);
    }
  });
  return result;
};

/** Decodes a path segment. A malformed escape returns the segment as it is. */
const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
