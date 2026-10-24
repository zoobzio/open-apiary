import { apiary } from "@open-apiary/schema";

import { User } from "../helpers";

/** Makes a user. The status is 201. */
export default apiary
  .POST("/users", { body: User.pick({ name: true }) }, User)
  .handle((_ctx, input) => ({ id: crypto.randomUUID(), name: input.body.name }))
  .withScopes("users:write")
  .withTags("users");
