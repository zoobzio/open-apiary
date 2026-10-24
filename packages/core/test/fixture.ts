import type { Caller } from "@open-apiary/schema";

import { Service, apiary } from "@open-apiary/schema";
import { z } from "zod";

/* The setup and dispose calls of the services, in order. Tests clear it. */
export const log: string[] = [];

/* A singleton with no dependencies. */
export class Db extends Service {
  override setup() {
    log.push("setup:Db");
  }
  override dispose() {
    log.push("dispose:Db");
  }
  get(id: string) {
    return { id, name: `user-${id}` };
  }
}

/* A singleton that uses `Db`. */
export class Users extends Service {
  private readonly db = this.use(Db);
  override setup() {
    log.push("setup:Users");
  }
  override dispose() {
    log.push("dispose:Users");
  }
  find(id: string) {
    return this.db.get(id);
  }
}

/* A scoped service that uses the `Db` singleton. */
export class Session extends Service {
  static override readonly lifetime = "scoped";
  readonly db = this.use(Db);
  override dispose() {
    log.push("dispose:Session");
  }
}

/* A scoped service that uses another scoped service. */
export class Audit extends Service {
  static override readonly lifetime = "scoped";
  readonly session = this.use(Session);
  override dispose() {
    log.push("dispose:Audit");
  }
}

/* The validators of the endpoints. */
export const User = z.object({ id: z.string(), name: z.string() });
export const Id = z.object({ id: z.string() });
export const NotFound = z.object({ code: z.literal("not_found") });

/* An endpoint over `Users`, with a scope, a tag, and an error. */
export const getUser = apiary
  .GET("/users/{id}", { path: Id }, User)
  .handle((ctx, input) => ctx.use(Users).find(input.path.id))
  .withScopes("users:read")
  .withTags("users")
  .withErrors({ 404: NotFound });

/* An endpoint with a static route that competes with `getUser`. */
export const getMe = apiary
  .GET("/users/me", {}, User)
  .handle(() => ({ id: "me", name: "user-me" }));

/* An endpoint with a body and a custom status. */
export const createUser = apiary
  .POST("/users", { body: z.object({ name: z.string() }) }, User)
  .handle((_ctx, input) => ({ id: "new", name: input.body.name }))
  .withStatus(202)
  .withScopes("users:write", "users:read");

/* A caller with the scope of `getUser`. */
export const caller: Caller = { scopes: ["users:read"] };

/* A caller with no scopes. */
export const anonymous: Caller = { scopes: [] };
