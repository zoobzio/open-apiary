/** Whether a value is a plain record: an object that is not null and not an array. */
export const record = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/**
 * Merges `over` onto `base` and returns a new value. Records merge by key, at
 * every depth. Any other value of `over`, an array included, replaces the
 * value of `base`. An `undefined` member of `over` leaves the member of
 * `base` as it is.
 */
export const merge = (base: unknown, over: unknown): unknown => {
  if (!record(base) || !record(over)) {
    return over === undefined ? base : over;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) {
      continue;
    }
    result[key] = key in result ? merge(result[key], value) : value;
  }
  return result;
};

/** Makes pretty JSON with a final newline. */
export const json = (value: unknown): string => {
  return `${JSON.stringify(value, null, 2)}\n`;
};

/** Turns a string into PascalCase: `user-posts` becomes `UserPosts`. */
export const pascal = (value: string): string => {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter((part) => part !== "")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join("");
};
