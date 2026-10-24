import type { Caller, ServiceClass } from "@open-apiary/schema";
import type { Endpoints } from "@open-apiary/schema";
import type { Options } from "../src/types";

import { describe, it, expect, expectTypeOf, beforeEach } from "vitest";
import { ApiaryError, Service, apiary } from "@open-apiary/schema";
import { z } from "zod";

import {
  ForbiddenError,
  InvalidInputError,
  InvalidOutputError,
  NotStartedError,
  UnhandledEndpointError,
  UnknownEndpointError,
} from "../src/error";
import { makeApiary } from "../src/factory";
import {
  Db,
  Id,
  Session,
  User,
  Users,
  anonymous,
  caller,
  createUser,
  getMe,
  getUser,
  log,
} from "./fixture";

/** Makes a started service over hand-made endpoints. */
const boot = async <E extends Endpoints>(
  endpoints: E,
  services: readonly ServiceClass[] = [Db, Users, Session],
  options: Options = {},
) => {
  const api = makeApiary({ endpoints, services, openapi: {} }, options);
  await api.start();
  return api;
};

/** Returns what a promise rejects with. */
const capture = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("the promise did not reject");
};

beforeEach(() => {
  log.splice(0);
});

describe("makeApiary", () => {
  it("exposes the registry and passes the OpenAPI document through", () => {
    const openapi = { openapi: "3.1.0", paths: {} };
    const api = makeApiary({ endpoints: { getUser }, services: [], openapi });
    expect(api.openapi).toBe(openapi);
    expect(api.registry.list().map((entry) => entry.id)).toEqual(["getUser"]);
    expect(api.registry.match("GET", "/users/1")?.id).toBe("getUser");
  });

  it("runs no code of the services before start", () => {
    makeApiary({ endpoints: {}, services: [Db, Users], openapi: {} });
    expect(log).toEqual([]);
  });
});

describe("start / stop", () => {
  it("sets up the singletons on start and disposes them on stop", async () => {
    const api = makeApiary({
      endpoints: {},
      services: [Users, Db],
      openapi: {},
    });
    await api.start();
    expect(log).toEqual(["setup:Db", "setup:Users"]);
    await api.stop();
    expect(log).toEqual([
      "setup:Db",
      "setup:Users",
      "dispose:Users",
      "dispose:Db",
    ]);
  });

  it("does nothing on a second start", async () => {
    const api = makeApiary({ endpoints: {}, services: [Db], openapi: {} });
    await api.start();
    await api.start();
    expect(log).toEqual(["setup:Db"]);
  });

  it("does nothing on stop before start", async () => {
    const api = makeApiary({ endpoints: {}, services: [Db], openapi: {} });
    await api.stop();
    expect(log).toEqual([]);
  });

  it("can start again after stop", async () => {
    const api = makeApiary({
      endpoints: { getMe },
      services: [Db],
      openapi: {},
    });
    await api.start();
    await api.stop();
    await api.start();
    expect(log).toEqual(["setup:Db", "dispose:Db", "setup:Db"]);
    await expect(api.invoke("getMe", {}, anonymous)).resolves.toEqual({
      status: 200,
      body: { id: "me", name: "user-me" },
    });
  });

  it("rejects a call after stop", async () => {
    const api = await boot({ getMe });
    await api.stop();
    await expect(api.invoke("getMe", {}, anonymous)).rejects.toThrow(
      NotStartedError,
    );
  });
});

describe("invoke / lookup", () => {
  it("throws before start", async () => {
    const api = makeApiary({ endpoints: { getMe }, services: [], openapi: {} });
    await expect(api.invoke("getMe", {}, anonymous)).rejects.toThrow(
      NotStartedError,
    );
  });

  it("throws for an unknown id", async () => {
    const api = await boot({ getMe });
    const error = await capture(
      Reflect.apply(api.invoke, undefined, ["nope", {}, anonymous]),
    );
    expect(error).toBeInstanceOf(UnknownEndpointError);
    expect(error).toMatchObject({ id: "nope" });
  });

  it("throws for an endpoint with no handler", async () => {
    const unhandled = apiary.GET("/raw", {}, User);
    const api = await boot({ unhandled });
    const error = await capture(api.invoke("unhandled", {}, anonymous));
    expect(error).toBeInstanceOf(UnhandledEndpointError);
    expect(error).toMatchObject({ id: "unhandled" });
  });

  it("runs the handler and answers with the status and the parsed body", async () => {
    const api = await boot({ getUser, createUser });
    await expect(
      api.invoke("getUser", { path: { id: "42" } }, caller),
    ).resolves.toEqual({ status: 200, body: { id: "42", name: "user-42" } });
    await expect(
      api.invoke(
        "createUser",
        { body: { name: "new" } },
        { scopes: ["users:write", "users:read"] },
      ),
    ).resolves.toEqual({ status: 202, body: { id: "new", name: "new" } });
  });

  it("hands the caller and the operation to the handler", async () => {
    let seen: unknown;
    const whoami = apiary
      .GET("/whoami", {}, z.object({ ok: z.boolean() }))
      .handle((ctx) => {
        seen = { caller: ctx.caller, endpoint: ctx.endpoint };
        return { ok: true };
      });
    const api = await boot({ whoami });
    const who: Caller = { scopes: ["a"], subject: "alice" };
    await api.invoke("whoami", {}, who);
    expect(seen).toEqual({
      caller: who,
      endpoint: { id: "whoami", method: "GET", route: "/whoami" },
    });
  });
});

describe("invoke / scopes", () => {
  it("throws ForbiddenError when the caller lacks a scope", async () => {
    const api = await boot({ getUser });
    const error = await capture(
      api.invoke("getUser", { path: { id: "1" } }, anonymous),
    );
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error).toBeInstanceOf(ApiaryError);
    expect(error).toMatchObject({
      status: 403,
      scopes: ["users:read"],
      body: { error: "forbidden", scopes: ["users:read"] },
    });
  });

  it("requires every scope of the endpoint", async () => {
    const api = await boot({ createUser });
    await expect(
      api.invoke("createUser", { body: { name: "n" } }, caller),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      api.invoke(
        "createUser",
        { body: { name: "n" } },
        {
          scopes: ["users:read", "users:write", "extra"],
        },
      ),
    ).resolves.toMatchObject({ status: 202 });
  });

  it("checks the scopes before the input", async () => {
    const api = await boot({ getUser });
    await expect(api.invoke("getUser", {}, anonymous)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("skips the check for an endpoint with no scopes", async () => {
    const api = await boot({ getMe }, [], {
      authorize: () => {
        throw new Error("should not run");
      },
    });
    await expect(api.invoke("getMe", {}, anonymous)).resolves.toMatchObject({
      status: 200,
    });
  });

  it("uses a custom authorize option", async () => {
    const asked: unknown[] = [];
    const api = await boot({ getUser }, [Db, Users], {
      authorize: (who, scopes) => {
        asked.push([who, scopes]);
        return who.role === "admin";
      },
    });
    const admin: Caller = { scopes: [], role: "admin" };
    await expect(
      api.invoke("getUser", { path: { id: "1" } }, admin),
    ).resolves.toMatchObject({ status: 200 });
    await expect(
      api.invoke("getUser", { path: { id: "1" } }, caller),
    ).rejects.toThrow(ForbiddenError);
    expect(asked).toEqual([
      [admin, ["users:read"]],
      [caller, ["users:read"]],
    ]);
  });
});

describe("invoke / input", () => {
  const Page = z.object({
    limit: z.coerce.number().int().default(10),
    cursor: z.string().optional(),
  });

  it("parses a missing query, path, and headers as empty objects", async () => {
    const list = apiary
      .GET(
        "/users",
        {
          query: Page,
          headers: z.object({ "x-trace": z.string().default("none") }),
        },
        z.object({ limit: z.number(), trace: z.string() }),
      )
      .handle((_ctx, input) => ({
        limit: input.query.limit,
        trace: input.headers["x-trace"],
      }));
    const api = await boot({ list });
    await expect(api.invoke("list", {}, anonymous)).resolves.toEqual({
      status: 200,
      body: { limit: 10, trace: "none" },
    });
  });

  it("parses each part with its validator", async () => {
    const list = apiary
      .GET("/users", { query: Page }, z.object({ limit: z.number() }))
      .handle((_ctx, input) => ({ limit: input.query.limit }));
    const api = await boot({ list });
    await expect(
      api.invoke("list", { query: { limit: "25" } }, anonymous),
    ).resolves.toEqual({ status: 200, body: { limit: 25 } });
  });

  it("parses a missing body as undefined", async () => {
    const seen: unknown[] = [];
    const Note = z.object({ text: z.string() });
    const post = apiary
      .POST("/notes", { body: Note.optional() }, z.object({ ok: z.boolean() }))
      .handle((_ctx, input) => {
        seen.push(input.body);
        return { ok: true };
      });
    const api = await boot({ post });
    await api.invoke("post", {}, anonymous);
    expect(seen).toEqual([undefined]);
  });

  it("leaves a part with no validator out of the input", async () => {
    let seen: unknown;
    const bare = apiary.GET("/bare", {}, z.object({})).handle((_ctx, input) => {
      seen = input;
      return {};
    });
    const api = await boot({ bare });
    await api.invoke(
      "bare",
      { query: { a: 1 }, headers: { b: 2 }, body: { c: 3 } },
      anonymous,
    );
    expect(seen).toEqual({});
  });

  it("throws InvalidInputError with the issues of a failing part", async () => {
    const api = await boot({ getUser });
    const error = await capture(
      api.invoke("getUser", { path: { id: 42 } }, caller),
    );
    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error).toBeInstanceOf(ApiaryError);
    expect(error).toMatchObject({
      status: 400,
      issues: [{ part: "path", path: ["id"], message: expect.any(String) }],
      body: {
        error: "invalid_input",
        issues: [{ part: "path", path: ["id"], message: expect.any(String) }],
      },
    });
  });

  it("collects the issues of every failing part", async () => {
    const update = apiary
      .PUT(
        "/users/{id}",
        { path: Id, body: z.object({ name: z.string() }) },
        User,
      )
      .handle((_ctx, input) => ({ id: input.path.id, name: input.body.name }));
    const api = await boot({ update });
    const error = (await capture(
      api.invoke("update", { path: {}, body: { name: 1 } }, anonymous),
    )) as InvalidInputError;
    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error.issues.map((issue) => [issue.part, ...issue.path])).toEqual([
      ["path", "id"],
      ["body", "name"],
    ]);
    expect(error.message).toContain("path.id");
    expect(error.message).toContain("body.name");
  });

  it("reports a missing required body under the body part", async () => {
    const api = await boot({ createUser });
    const error = await capture(
      api.invoke("createUser", {}, { scopes: ["users:write", "users:read"] }),
    );
    expect(error).toBeInstanceOf(InvalidInputError);
    expect(error).toMatchObject({ issues: [{ part: "body", path: [] }] });
  });

  it("does not run the handler when the input fails", async () => {
    let calls = 0;
    const strict = apiary
      .GET("/strict", { query: z.object({ n: z.number() }) }, z.object({}))
      .handle(() => {
        calls += 1;
        return {};
      });
    const api = await boot({ strict });
    await expect(api.invoke("strict", {}, anonymous)).rejects.toThrow(
      InvalidInputError,
    );
    expect(calls).toBe(0);
  });
});

describe("invoke / output", () => {
  it("parses the value of the handler with the output validator", async () => {
    const Out = z.object({ id: z.string(), role: z.string().default("user") });
    const whoami = apiary.GET("/whoami", {}, Out).handle(() => ({ id: "1" }));
    const api = await boot({ whoami });
    await expect(api.invoke("whoami", {}, anonymous)).resolves.toEqual({
      status: 200,
      body: { id: "1", role: "user" },
    });
  });

  it("throws InvalidOutputError with the issues, and a body without them", async () => {
    const bad = apiary
      .GET("/bad", {}, User)
      .handle(() => ({ id: "1" }) as unknown as { id: string; name: string });
    const api = await boot({ bad });
    const error = await capture(api.invoke("bad", {}, anonymous));
    expect(error).toBeInstanceOf(InvalidOutputError);
    expect(error).toBeInstanceOf(ApiaryError);
    expect(error).toMatchObject({
      status: 500,
      issues: [{ part: "output", path: ["name"] }],
      body: { error: "invalid_output" },
    });
    expect((error as InvalidOutputError).body).not.toHaveProperty("issues");
  });

  it("answers with the status of withStatus", async () => {
    const api = await boot({ createUser });
    const result = await api.invoke(
      "createUser",
      { body: { name: "n" } },
      { scopes: ["users:write", "users:read"] },
    );
    expect(result.status).toBe(202);
  });

  it("awaits an async handler", async () => {
    const slow = apiary
      .GET("/slow", {}, z.object({ ok: z.boolean() }))
      .handle(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ok: true };
      });
    const api = await boot({ slow });
    await expect(api.invoke("slow", {}, anonymous)).resolves.toEqual({
      status: 200,
      body: { ok: true },
    });
  });
});

describe("invoke / errors of the handler", () => {
  it("propagates an ApiaryError unchanged", async () => {
    const thrown = new ApiaryError(404, "no such user", { code: "not_found" });
    const missing = apiary.GET("/missing", {}, User).handle(() => {
      throw thrown;
    });
    const api = await boot({ missing });
    await expect(api.invoke("missing", {}, anonymous)).rejects.toBe(thrown);
  });

  it("propagates any other error unchanged", async () => {
    const thrown = new TypeError("boom");
    const broken = apiary.GET("/broken", {}, User).handle(() => {
      throw thrown;
    });
    const api = await boot({ broken });
    await expect(api.invoke("broken", {}, anonymous)).rejects.toBe(thrown);
  });
});

describe("invoke / services", () => {
  it("resolves a scoped service once per call and disposes it after", async () => {
    const seen: unknown[] = [];
    const touch = apiary
      .GET("/touch", {}, z.object({ same: z.boolean() }))
      .handle((ctx) => {
        const session = ctx.use(Session);
        seen.push(session);
        return { same: ctx.use(Session) === session };
      });
    const api = await boot({ touch });
    await expect(api.invoke("touch", {}, anonymous)).resolves.toMatchObject({
      body: { same: true },
    });
    expect(log).toEqual(["setup:Db", "setup:Users", "dispose:Session"]);
    await api.invoke("touch", {}, anonymous);
    expect(seen[0]).not.toBe(seen[1]);
    expect(log.filter((entry) => entry === "dispose:Session")).toHaveLength(2);
  });

  it("disposes the scoped services when the handler throws", async () => {
    const fail = apiary.GET("/fail", {}, User).handle((ctx) => {
      ctx.use(Session);
      throw new ApiaryError(404, "no such user");
    });
    const api = await boot({ fail });
    await expect(api.invoke("fail", {}, anonymous)).rejects.toThrow(
      ApiaryError,
    );
    expect(log).toContain("dispose:Session");
  });

  it("disposes the scoped services when the output fails", async () => {
    const fail = apiary.GET("/fail", {}, User).handle((ctx) => {
      ctx.use(Session);
      return {} as unknown as { id: string; name: string };
    });
    const api = await boot({ fail });
    await expect(api.invoke("fail", {}, anonymous)).rejects.toThrow(
      InvalidOutputError,
    );
    expect(log).toContain("dispose:Session");
  });

  it("hands the singletons of the run to the handler", async () => {
    const api = await boot({ getUser });
    const a = await api.invoke("getUser", { path: { id: "1" } }, caller);
    const b = await api.invoke("getUser", { path: { id: "1" } }, caller);
    expect(a).toEqual(b);
    expect(log.filter((entry) => entry.startsWith("setup:"))).toHaveLength(2);
  });

  it("rejects two services with one id", () => {
    class A extends Service {
      static override readonly id = "same";
    }
    class B extends Service {
      static override readonly id = "same";
    }
    expect(() =>
      makeApiary({ endpoints: {}, services: [A, B], openapi: {} }),
    ).toThrow('two services share the id "same"');
  });
});

describe("events", () => {
  it("emits start and end around a call, in order", async () => {
    const api = await boot({ getMe });
    const seen: unknown[] = [];
    api.on("invoke:start", (event) => {
      seen.push(["start", event]);
    });
    api.on("invoke:end", (event) => {
      seen.push(["end", event]);
    });
    api.on("invoke:error", (event) => {
      seen.push(["error", event]);
    });
    await api.invoke("getMe", {}, anonymous);
    expect(seen).toEqual([
      ["start", { id: "getMe" }],
      ["end", { id: "getMe", status: 200, duration: expect.any(Number) }],
    ]);
    const end = seen[1] as [string, { duration: number }];
    expect(end[1].duration).toBeGreaterThanOrEqual(0);
  });

  it("emits start and error when a call throws, with what it threw", async () => {
    const api = await boot({ getUser });
    const seen: unknown[] = [];
    api.on("invoke:start", (event) => {
      seen.push(["start", event]);
    });
    api.on("invoke:end", (event) => {
      seen.push(["end", event]);
    });
    api.on("invoke:error", (event) => {
      seen.push(["error", event]);
    });
    const error = await capture(
      api.invoke("getUser", { path: { id: "1" } }, anonymous),
    );
    expect(seen).toEqual([
      ["start", { id: "getUser" }],
      ["error", { id: "getUser", error, duration: expect.any(Number) }],
    ]);
  });

  it("emits service:create for each instance with its lifetime", async () => {
    const touch = apiary.GET("/touch", {}, z.object({})).handle((ctx) => {
      ctx.use(Session);
      return {};
    });
    const api = makeApiary({
      endpoints: { touch },
      services: [Users, Db, Session],
      openapi: {},
    });
    const seen: unknown[] = [];
    api.on("service:create", (event) => {
      seen.push(event);
    });
    await api.start();
    await api.invoke("touch", {}, anonymous);
    expect(seen).toEqual([
      { id: "Db", lifetime: "singleton" },
      { id: "Users", lifetime: "singleton" },
      { id: "Session", lifetime: "scoped" },
    ]);
  });

  it("returns an unsubscribe from on", async () => {
    const api = await boot({ getMe });
    let calls = 0;
    const off = api.on("invoke:start", () => {
      calls += 1;
    });
    await api.invoke("getMe", {}, anonymous);
    off();
    await api.invoke("getMe", {}, anonymous);
    expect(calls).toBe(1);
  });

  it("does not emit start before the lookup and the started check", async () => {
    const api = makeApiary({ endpoints: { getMe }, services: [], openapi: {} });
    let calls = 0;
    api.on("invoke:start", () => {
      calls += 1;
    });
    await expect(api.invoke("getMe", {}, anonymous)).rejects.toThrow(
      NotStartedError,
    );
    expect(calls).toBe(0);
  });
});

describe("types", () => {
  it("types the body of the result from the output validator", async () => {
    const api = await boot({ getUser, createUser });
    const result = await api.invoke("getUser", { path: { id: "1" } }, caller);
    expectTypeOf(result.status).toEqualTypeOf<number>();
    expectTypeOf(result.body).toEqualTypeOf<{ id: string; name: string }>();
    expectTypeOf(api.invoke<"createUser">).returns.resolves.toHaveProperty(
      "body",
    );
  });

  it("accepts only an id of the bundle", async () => {
    const api = await boot({ getMe });
    // @ts-expect-error -- `nope` is not an endpoint of the bundle
    await expect(api.invoke("nope", {}, anonymous)).rejects.toThrow(
      UnknownEndpointError,
    );
  });
});
