import { apiary } from "@open-apiary/schema";
import { z } from "zod";

import { Problem, User } from "../helpers";

/** Returns one user. */
export default apiary
  .GET("/users/{id}", { path: z.object({ id: z.uuid() }) }, User)
  .handle((_ctx, input) => ({ id: input.path.id, name: "Ada" }))
  .withErrors({ 404: Problem })
  .withScopes("users:read")
  .withTags("users")
  .withSpec({ summary: "Get a user" });
