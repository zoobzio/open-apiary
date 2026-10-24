import { apiary } from "open-apiary";

import { NewUser, User } from "../schemas";
import Audit from "../services/audit";
import Users from "../services/users";

/** Makes a user. The status is 201. */
export default apiary
  .POST("/users", { body: NewUser }, User)
  .handle((ctx, input) => {
    const user = ctx.use(Users).create(input.body);
    ctx.use(Audit).note(ctx.caller, `created ${user.id}`);
    return user;
  })
  .withScopes("users:write")
  .withTags("users")
  .withSpec({ summary: "Create a user" });
