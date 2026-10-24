import type { Endpoint } from "../src/types";

import { describe, it, expect, expectTypeOf } from "vitest";
import { z } from "zod";

import { DEFAULT_STATUS, DEFINITION } from "../src/constant";
import { apiary, isEndpoint } from "../src/endpoint";
import { Id, NotFound, User } from "./fixture";

describe("definition functions", () => {
  it("answers 200 by default for GET, PUT, PATCH, and DELETE", () => {
    expect(apiary.GET("/users", {}, User)[DEFINITION].status).toBe(200);
    expect(apiary.PUT("/users", {}, User)[DEFINITION].status).toBe(200);
    expect(apiary.PATCH("/users", {}, User)[DEFINITION].status).toBe(200);
    expect(apiary.DELETE("/users", {}, User)[DEFINITION].status).toBe(200);
  });

  it("answers 201 by default for POST", () => {
    expect(apiary.POST("/users", {}, User)[DEFINITION].status).toBe(201);
    expect(DEFAULT_STATUS.POST).toBe(201);
  });

  it("records the method, the route, the validators, and the output", () => {
    const input = { path: Id };
    const definition = apiary.GET("/users/{id}", input, User)[DEFINITION];
    expect(definition.method).toBe("GET");
    expect(definition.route).toBe("/users/{id}");
    expect(definition.input).toBe(input);
    expect(definition.output).toBe(User);
  });

  it("starts with empty metadata and no handler", () => {
    const definition = apiary.GET("/users", {}, User)[DEFINITION];
    expect(definition.errors).toEqual({});
    expect(definition.scopes).toEqual([]);
    expect(definition.tags).toEqual([]);
    expect(definition.spec).toEqual({});
    expect(definition.handler).toBeUndefined();
  });

  it("stores the definition under a registered symbol", () => {
    expect(DEFINITION).toBe(Symbol.for("open-apiary.definition"));
    const endpoint = apiary.GET("/users", {}, User);
    expect(Object.getOwnPropertySymbols(endpoint)).toEqual([DEFINITION]);
  });
});

describe("immutability", () => {
  it("returns a new endpoint from each method and leaves the old one as it is", () => {
    const base = apiary.GET("/users", {}, User);
    const before = base[DEFINITION];
    const changed = [
      base.withScopes("a"),
      base.withTags("t"),
      base.withStatus(204),
      base.withErrors({ 404: NotFound }),
      base.withSpec({ summary: "s" }),
      base.handle(() => ({ id: "1", name: "n" })),
    ];
    for (const endpoint of changed) {
      expect(endpoint).not.toBe(base);
      expect(endpoint[DEFINITION]).not.toBe(before);
    }
    expect(base[DEFINITION]).toBe(before);
    expect(before.scopes).toEqual([]);
    expect(before.tags).toEqual([]);
    expect(before.status).toBe(200);
    expect(before.errors).toEqual({});
    expect(before.spec).toEqual({});
    expect(before.handler).toBeUndefined();
  });

  it("does not share the scope and tag arrays between endpoints", () => {
    const base = apiary.GET("/users", {}, User).withScopes("a");
    const next = base.withScopes("b");
    expect(base[DEFINITION].scopes).not.toBe(next[DEFINITION].scopes);
    expect(base[DEFINITION].scopes).toEqual(["a"]);
  });
});

describe("withScopes / withTags", () => {
  it("appends scopes across calls", () => {
    const endpoint = apiary
      .GET("/users", {}, User)
      .withScopes("users:read", "users:list")
      .withScopes("admin");
    expect(endpoint[DEFINITION].scopes).toEqual([
      "users:read",
      "users:list",
      "admin",
    ]);
  });

  it("appends tags across calls", () => {
    const endpoint = apiary
      .GET("/users", {}, User)
      .withTags("users")
      .withTags("public", "v1");
    expect(endpoint[DEFINITION].tags).toEqual(["users", "public", "v1"]);
  });
});

describe("withStatus", () => {
  it("replaces the success status", () => {
    const endpoint = apiary.POST("/users", {}, User).withStatus(202);
    expect(endpoint[DEFINITION].status).toBe(202);
  });

  it("keeps the last status", () => {
    const endpoint = apiary
      .GET("/users", {}, User)
      .withStatus(202)
      .withStatus(204);
    expect(endpoint[DEFINITION].status).toBe(204);
  });
});

describe("withErrors", () => {
  it("merges the errors across calls", () => {
    const Conflict = z.object({ code: z.literal("conflict") });
    const endpoint = apiary
      .GET("/users", {}, User)
      .withErrors({ 404: NotFound })
      .withErrors({ 409: Conflict });
    expect(endpoint[DEFINITION].errors).toEqual({
      404: NotFound,
      409: Conflict,
    });
  });

  it("lets a later call replace a status", () => {
    const Other = z.object({ reason: z.string() });
    const endpoint = apiary
      .GET("/users", {}, User)
      .withErrors({ 404: NotFound })
      .withErrors({ 404: Other });
    expect(endpoint[DEFINITION].errors[404]).toBe(Other);
  });
});

describe("withSpec", () => {
  it("merges the spec across calls", () => {
    const endpoint = apiary
      .GET("/users", {}, User)
      .withSpec({ summary: "List users" })
      .withSpec({ deprecated: true, "x-internal": true });
    expect(endpoint[DEFINITION].spec).toEqual({
      summary: "List users",
      deprecated: true,
      "x-internal": true,
    });
  });

  it("lets a later call replace a key", () => {
    const endpoint = apiary
      .GET("/users", {}, User)
      .withSpec({ operationId: "a" })
      .withSpec({ operationId: "b" });
    expect(endpoint[DEFINITION].spec.operationId).toBe("b");
  });
});

describe("handle", () => {
  it("stores the handler", () => {
    const handler = () => ({ id: "1", name: "n" });
    const endpoint = apiary.GET("/users", {}, User).handle(handler);
    expect(endpoint[DEFINITION].handler).toBe(handler);
  });

  it("keeps the handler when metadata is set after it", () => {
    const handler = () => ({ id: "1", name: "n" });
    const endpoint = apiary
      .GET("/users", {}, User)
      .handle(handler)
      .withScopes("users:read")
      .withTags("users")
      .withStatus(200)
      .withErrors({ 404: NotFound })
      .withSpec({ summary: "s" });
    expect(endpoint[DEFINITION].handler).toBe(handler);
    expect(endpoint[DEFINITION].scopes).toEqual(["users:read"]);
  });

  it("keeps the metadata when the handler is set after it", () => {
    const endpoint = apiary
      .GET("/users", {}, User)
      .withScopes("users:read")
      .withTags("users")
      .handle(() => ({ id: "1", name: "n" }));
    expect(endpoint[DEFINITION].scopes).toEqual(["users:read"]);
    expect(endpoint[DEFINITION].tags).toEqual(["users"]);
  });

  it("replaces an earlier handler", () => {
    const first = () => ({ id: "1", name: "first" });
    const second = () => ({ id: "2", name: "second" });
    const endpoint = apiary
      .GET("/users", {}, User)
      .handle(first)
      .handle(second);
    expect(endpoint[DEFINITION].handler).toBe(second);
  });
});

describe("isEndpoint", () => {
  it("is true for a built endpoint, with or without a handler", () => {
    const endpoint = apiary.GET("/users", {}, User);
    expect(isEndpoint(endpoint)).toBe(true);
    expect(isEndpoint(endpoint.handle(() => ({ id: "1", name: "n" })))).toBe(
      true,
    );
  });

  it("is true for any object with a definition under the symbol", () => {
    expect(isEndpoint({ [DEFINITION]: {} })).toBe(true);
  });

  it("is false for plain objects, null, primitives, and functions", () => {
    expect(isEndpoint({})).toBe(false);
    expect(isEndpoint({ handle: () => {} })).toBe(false);
    expect(isEndpoint(null)).toBe(false);
    expect(isEndpoint(undefined)).toBe(false);
    expect(isEndpoint("endpoint")).toBe(false);
    expect(isEndpoint(42)).toBe(false);
    expect(isEndpoint(() => {})).toBe(false);
    expect(isEndpoint(apiary.GET)).toBe(false);
  });
});

describe("types", () => {
  it("infers the input of the handler from the validators", () => {
    apiary
      .GET(
        "/users/{id}",
        {
          path: Id,
          query: z.object({ verbose: z.coerce.boolean().default(false) }),
          headers: z.object({ "x-trace": z.string().optional() }),
        },
        User,
      )
      .handle((ctx, input) => {
        expectTypeOf(input.path.id).toEqualTypeOf<string>();
        expectTypeOf(input.query.verbose).toEqualTypeOf<boolean>();
        expectTypeOf(input.headers["x-trace"]).toEqualTypeOf<
          string | undefined
        >();
        expectTypeOf(input).not.toHaveProperty("body");
        expectTypeOf(ctx.caller.scopes).toEqualTypeOf<readonly string[]>();
        expectTypeOf(ctx.endpoint.id).toEqualTypeOf<string>();
        return { id: input.path.id, name: "n" };
      });
  });

  it("leaves a part with no validator out of the input", () => {
    apiary.GET("/users", {}, User).handle((_ctx, input) => {
      expectTypeOf(input).not.toHaveProperty("path");
      expectTypeOf(input).not.toHaveProperty("query");
      return { id: "1", name: "n" };
    });
  });

  it("types the body of a POST from its validator", () => {
    const Body = z.object({ name: z.string() });
    apiary.POST("/users", { body: Body }, User).handle((_ctx, input) => {
      expectTypeOf(input.body).toEqualTypeOf<{ name: string }>();
      return { id: "1", name: input.body.name };
    });
  });

  it("binds the return of the handler to the output validator", () => {
    const endpoint = apiary.GET("/users", {}, User);
    endpoint.handle(() => ({ id: "1", name: "n" }));
    endpoint.handle(async () => ({ id: "1", name: "n" }));
    // @ts-expect-error -- the output requires a `name`
    endpoint.handle(() => ({ id: "1" }));
    // @ts-expect-error -- the output requires a string `id`
    endpoint.handle(() => ({ id: 1, name: "n" }));
    // @ts-expect-error -- a promise of the wrong shape
    endpoint.handle(async () => ({ id: "1" }));
  });

  it("marks the endpoint as handled after `handle`", () => {
    const raw = apiary.GET("/users", {}, User);
    const handled = raw.handle(() => ({ id: "1", name: "n" }));
    expectTypeOf(raw[DEFINITION].handler).toEqualTypeOf<undefined>();
    expectTypeOf(handled[DEFINITION].handler).toBeFunction();
    expectTypeOf(handled).toMatchTypeOf<
      Endpoint<"GET", "/users", object, typeof User, true>
    >();
    expectTypeOf(handled.withScopes("a")).toMatchTypeOf<
      Endpoint<"GET", "/users", object, typeof User, true>
    >();
  });

  it("rejects a body on GET and DELETE", () => {
    // @ts-expect-error -- GET takes no body
    apiary.GET("/users", { body: z.string() }, User);
    // @ts-expect-error -- DELETE takes no body
    apiary.DELETE("/users", { body: z.string() }, User);
  });

  it("requires a path validator for a route with parameters", () => {
    // @ts-expect-error -- `{id}` needs a `path` validator
    apiary.GET("/users/{id}", {}, User);
    // @ts-expect-error -- the `path` validator misses `id`
    apiary.GET("/users/{id}", { path: z.object({ other: z.string() }) }, User);
  });

  it("forbids a path validator for a route without parameters", () => {
    // @ts-expect-error -- `/users` has no parameters
    apiary.GET("/users", { path: Id }, User);
  });
});
