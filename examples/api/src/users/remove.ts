import { apiary, ApiaryError } from "open-apiary";
import { z } from "zod";

import { Problem } from "../schemas";
import Users from "../services/users";

/** Removes a user. The status is 204, with no body. */
export default apiary
  .DELETE("/users/{id}", { path: z.object({ id: z.uuid() }) }, z.undefined())
  .handle((ctx, input) => {
    if (!ctx.use(Users).remove(input.path.id)) {
      throw new ApiaryError(404, "no such user", {
        error: "not_found",
        message: `no user with id ${input.path.id}`,
      });
    }
    return undefined;
  })
  .withStatus(204)
  .withErrors({ 404: Problem })
  .withScopes("users:write")
  .withTags("users")
  .withSpec({ summary: "Delete a user" });
