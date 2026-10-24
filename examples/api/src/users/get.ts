import { apiary, ApiaryError } from "open-apiary";
import { z } from "zod";

import { Problem, User } from "../schemas";
import Users from "../services/users";

/** Returns one user. A missing user is a 404. */
export default apiary
  .GET("/users/{id}", { path: z.object({ id: z.uuid() }) }, User)
  .handle((ctx, input) => {
    const user = ctx.use(Users).find(input.path.id);
    if (user === undefined) {
      throw new ApiaryError(404, "no such user", {
        error: "not_found",
        message: `no user with id ${input.path.id}`,
      });
    }
    return user;
  })
  .withErrors({ 404: Problem })
  .withScopes("users:read")
  .withTags("users")
  .withSpec({ summary: "Get a user" });
