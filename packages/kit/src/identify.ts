import type { Method, Route } from "@open-apiary/schema";

import { pascal } from "./util";

/**
 * Derives the operation id of an endpoint from its method and route. The id
 * is the method in lower case, then each segment of the route in PascalCase.
 * A parameter segment becomes `By` and the name. The root route becomes
 * `Root`.
 *
 * - `GET /users` is `getUsers`.
 * - `GET /users/{id}` is `getUsersById`.
 * - `POST /users/{id}/posts` is `postUsersByIdPosts`.
 *
 * `withSpec({ operationId })` replaces the derived id.
 */
export const identify = (method: Method, route: Route): string => {
  const segments = route
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => {
      const param = /^\{(.+)\}$/.exec(segment);
      return param?.[1] !== undefined
        ? `By${pascal(param[1])}`
        : pascal(segment);
    });
  return method.toLowerCase() + (segments.join("") || "Root");
};
