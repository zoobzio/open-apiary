import { apiary } from "open-apiary";
import { z } from "zod";

import { User } from "../schemas";
import Users from "../services/users";

/** Lists the users. `limit` caps the count. */
export default apiary
  .GET(
    "/users",
    {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
      }),
    },
    z.array(User),
  )
  .handle((ctx, input) => ctx.use(Users).list().slice(0, input.query.limit))
  .withScopes("users:read")
  .withTags("users")
  .withSpec({ summary: "List users" });
