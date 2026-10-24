/** A parameter segment of a route: a name in braces. */
const PARAM = /^\{([^{}/]+)\}$/;

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
