import { mockBundle } from "@open-apiary/testing";
import { apiary, ApiaryError, Service } from "open-apiary";
import { z } from "zod";

/** The id of the one user that `getUsersById` finds. */
export const FOUND = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** The id that `getUsersById` answers with a 404. */
export const MISSING = "00000000-0000-0000-0000-000000000000";

/** The time that the clock reports. */
export const TIME = "2026-01-01T00:00:00.000Z";

/** The count of live clocks: up at `setup`, down at `dispose`. */
export const state = { live: 0 };

/** A singleton that the health endpoint uses. */
export class Clock extends Service {
  override setup(): void {
    state.live += 1;
  }

  override dispose(): void {
    state.live -= 1;
  }

  now(): string {
    return TIME;
  }
}

const User = z.object({ id: z.string(), name: z.string() });

/**
 * The bundle of the `#open-apiary/bundle` fixture: four endpoints over one
 * service, in the shape that `apiary build` writes.
 */
export default mockBundle(
  {
    getHealth: apiary
      .GET("/health", {}, z.object({ ok: z.literal(true), time: z.string() }))
      .handle((ctx) => ({ ok: true, time: ctx.use(Clock).now() })),
    getUsersById: apiary
      .GET("/users/{id}", { path: z.object({ id: z.uuid() }) }, User)
      .handle((_ctx, input) => {
        if (input.path.id === MISSING) {
          throw new ApiaryError(404, "no such user", { error: "not_found" });
        }
        return { id: input.path.id, name: "Ada" };
      })
      .withScopes("users:read"),
    getUsersMe: apiary
      .GET("/users/me", {}, User)
      .handle((ctx) => ({ id: "me", name: String(ctx.caller.subject ?? "") })),
    postUsers: apiary
      .POST("/users", { body: z.object({ name: z.string().min(1) }) }, User)
      .handle((_ctx, input) => ({ id: FOUND, name: input.body.name })),
  },
  {
    services: [Clock],
    openapi: {
      openapi: "3.1.0",
      info: { title: "Fixture", version: "0.0.0" },
      paths: {},
    },
  },
);
