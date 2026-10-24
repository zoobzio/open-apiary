import type { H3Event } from "h3";
import type { NitroApp } from "nitropack/types";

import { createApp, defineEventHandler, toWebHandler } from "h3";
import { beforeAll, describe, expect, it, vi } from "vitest";

import bundle, { FOUND, MISSING, TIME, state } from "./fixtures/bundle";

import delegate, { callerOf, pathOf } from "../src/runtime/delegate";
import docs, { page } from "../src/runtime/docs";
import { useApiary } from "../src/runtime/instance";
import openapi from "../src/runtime/openapi";
import plugin from "../src/runtime/plugin";

/**
 * The server, as Nitro would assemble it: a middleware that reads the caller
 * from the request, the three handlers of the module under `/api`, and a
 * probe that reports what the delegate sees. The tests send `Request`
 * objects through the web handler.
 */
const app = createApp();

app.use(
  defineEventHandler((event) => {
    const scopes = event.headers.get("x-scopes");
    const subject = event.headers.get("x-subject");
    if (scopes !== null) {
      event.context.apiary = {
        caller: {
          scopes: scopes === "" ? [] : scopes.split(","),
          ...(subject !== null && { subject }),
        },
      };
    }
  }),
);
app.use(
  "/api/probe",
  defineEventHandler((event) => ({
    path: event.path,
    under: pathOf(event),
    caller: callerOf(event),
  })),
);
app.use("/api/openapi.json", openapi);
app.use("/api/docs", docs);
app.use("/api", delegate);

const handle = toWebHandler(app);

/** Sends a request to the server. */
const send = (
  path: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Promise<Response> => handle(new Request(`http://localhost${path}`, init));

/** Sends a JSON body. */
const json = (
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> =>
  send(path, {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });

/** The hooks that the plugin registers on the Nitro app, by name. */
const hooks: Record<string, () => Promise<void>> = {};

const nitroApp = {
  hooks: {
    hook: vi.fn((name: string, fn: () => Promise<void>) => {
      hooks[name] = fn;
    }),
  },
};

it("has no service before the plugin ran", () => {
  expect(() => useApiary()).toThrow(/the service is not started/);
});

describe("the plugin", () => {
  beforeAll(async () => {
    await plugin(nitroApp as unknown as NitroApp);
  });

  it("makes the service over the bundle and starts it", () => {
    const api = useApiary();
    expect(state.live).toBe(1);
    expect(api.openapi).toBe(bundle.openapi);
    expect(api.registry.list().map((entry) => entry.id)).toEqual([
      "getHealth",
      "getUsersById",
      "getUsersMe",
      "postUsers",
    ]);
  });

  it("registers the close hook", () => {
    expect(Object.keys(hooks)).toEqual(["close"]);
  });
});

describe("the openapi handler", () => {
  it("serves the document of the bundle as JSON", async () => {
    const res = await send("/api/openapi.json");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual(bundle.openapi);
  });
});

describe("the docs handler", () => {
  it("serves the Scalar page over the document under the base", async () => {
    const res = await send("/api/docs");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    const html = await res.text();
    expect(html).toBe(page("/api/openapi.json"));
    expect(html).toContain('url: "/api/openapi.json"');
    expect(html).toContain(
      "https://cdn.jsdelivr.net/npm/@scalar/api-reference",
    );
    expect(html).toContain("Scalar.createApiReference");
  });

  it("escapes the url in the page", () => {
    expect(page('/a"b/openapi.json')).toContain('url: "/a\\"b/openapi.json"');
  });
});

describe("pathOf and callerOf", () => {
  it("read the full pathname under the base, not the mounted rest", async () => {
    const res = await send("/api/probe/x/y?q=1");
    expect(await res.json()).toEqual({
      path: "/x/y?q=1",
      under: "/probe/x/y",
      caller: { scopes: [] },
    });
  });

  it("answer the root for the base itself", async () => {
    const res = await send("/api/probe");
    expect((await res.json()).under).toBe("/probe");
    const event = {
      path: "/api",
      headers: new Headers(),
      node: {
        req: { url: "/api", headers: { host: "localhost" }, socket: {} },
      },
      context: {},
    } as unknown as H3Event;
    expect(pathOf(event)).toBe("/");
  });

  it("read the caller that a middleware set", async () => {
    const res = await send("/api/probe", {
      headers: { "x-scopes": "a,b", "x-subject": "ada" },
    });
    expect((await res.json()).caller).toEqual({
      scopes: ["a", "b"],
      subject: "ada",
    });
  });

  it("fall back to the anonymous caller", () => {
    const bare = { context: {} } as H3Event;
    const empty = { context: { apiary: {} } } as unknown as H3Event;
    expect(callerOf(bare)).toEqual({ scopes: [] });
    expect(callerOf(empty)).toEqual({ scopes: [] });
  });
});

describe("the delegate", () => {
  it("runs an endpoint with no scopes for an anonymous request", async () => {
    const res = await send("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, time: TIME });
  });

  it("prefers the static route over the parameter", async () => {
    const res = await send("/api/users/me");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "me", name: "" });
  });

  it("gives the handler the caller of the middleware", async () => {
    const res = await send("/api/users/me", {
      headers: { "x-scopes": "", "x-subject": "ada" },
    });
    expect(await res.json()).toEqual({ id: "me", name: "ada" });
  });

  it("answers 403 with the scopes when the caller lacks them", async () => {
    const res = await send(`/api/users/${FOUND}`);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "forbidden",
      scopes: ["users:read"],
    });
  });

  it("runs the endpoint when the caller has the scopes", async () => {
    const res = await send(`/api/users/${FOUND}`, {
      headers: { "x-scopes": "users:read" },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: FOUND, name: "Ada" });
  });

  it("sends the status and the body of an ApiaryError", async () => {
    const res = await send(`/api/users/${MISSING}`, {
      headers: { "x-scopes": "users:read" },
    });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
  });

  it("answers 400 for a path parameter that fails its validator", async () => {
    const res = await send("/api/users/not-a-uuid", {
      headers: { "x-scopes": "users:read" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_input");
    expect(body.issues).toEqual([
      expect.objectContaining({ part: "path", path: ["id"] }),
    ]);
  });

  it("reads the body of a POST and answers with the status of the endpoint", async () => {
    const res = await json("POST", "/api/users", { name: "Grace" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ id: FOUND, name: "Grace" });
  });

  it("answers 400 for a body that fails its validator", async () => {
    const res = await json("POST", "/api/users", { name: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_input");
  });

  it("answers 400 for a POST with no body", async () => {
    const res = await send("/api/users", { method: "POST" });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_input");
    expect(body.issues[0].part).toBe("body");
  });

  it("answers 404 for a path that no route matches", async () => {
    const res = await send("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      statusCode: 404,
      statusMessage: "Not Found",
    });
  });

  it("answers 404 for a method that no route has", async () => {
    const res = await send("/api/health", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});

describe("the close hook", () => {
  it("stops the service and clears it", async () => {
    await hooks.close!();
    expect(() => useApiary()).toThrow(/the service is not started/);
    expect(state.live).toBe(0);
  });

  it("leaves the handlers failing with the error of useApiary", async () => {
    // h3 logs an error that is not an H3Error as unhandled.
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await send("/api/health");
      expect(res.status).toBe(500);
      const document = await send("/api/openapi.json");
      expect(document.status).toBe(500);
      expect(log).toHaveBeenCalledTimes(2);
      for (const [tag, kind, error] of log.mock.calls) {
        expect([tag, kind]).toEqual(["[h3]", "[unhandled]"]);
        expect((error as Error).message).toMatch(/the service is not started/);
      }
    } finally {
      log.mockRestore();
    }
  });
});
