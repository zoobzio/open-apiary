import type { Apiary, Lifetime } from "open-apiary";

import { fileURLToPath } from "node:url";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  expectTypeOf,
  it,
} from "vitest";

import { generate } from "@open-apiary/kit";
import { bootApiary, mockCaller } from "@open-apiary/testing";
import { ApiaryError, ForbiddenError, serviceId } from "open-apiary";

import config from "../apiary.config";
import bundle, { endpoints, openapi, services } from "../.dist/index.mjs";
import document from "../.dist/openapi.json";
import pkg from "../package.json";

/** The directory of the example package. */
const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** The operation ids of the bundle, in id order. */
const IDS = [
  "deleteUsersById",
  "getHealth",
  "getUsers",
  "getUsersById",
  "postUsers",
];

/** An operation of the document, by id. */
const operation = (id: string): Record<string, unknown> => {
  for (const item of Object.values(document.paths)) {
    for (const op of Object.values(item) as Record<string, unknown>[]) {
      if (op.operationId === id) {
        return op;
      }
    }
  }
  throw new Error(`no operation ${id}`);
};

describe("the built module", () => {
  it("exports the bundle with every endpoint by id", () => {
    expect(Object.keys(bundle.endpoints).sort()).toEqual(IDS);
    expect(bundle.endpoints).toBe(endpoints);
  });

  it("exports the three service classes", () => {
    expect(bundle.services).toBe(services);
    expect(services.map((service) => serviceId(service)).sort()).toEqual([
      "Audit",
      "Clock",
      "Users",
    ]);
    for (const service of services) {
      expect(typeof service).toBe("function");
    }
  });

  it("carries the OpenAPI document that sits beside it", () => {
    expect(bundle.openapi).toBe(openapi);
    expect(openapi).toEqual(document);
  });
});

describe("the OpenAPI document", () => {
  it("names the API and takes the version of the package", () => {
    expect(document.openapi).toBe("3.1.0");
    expect(document.info.title).toBe("Example API");
    expect(document.info.version).toBe(pkg.version);
    expect(document.servers).toEqual([{ url: "/api" }]);
  });

  it("declares the bearer scheme and binds the scopes to it", () => {
    expect(document.components.securitySchemes.bearer).toEqual({
      type: "http",
      scheme: "bearer",
    });
    const scoped: Record<string, string[]> = {
      deleteUsersById: ["users:write"],
      getUsers: ["users:read"],
      getUsersById: ["users:read"],
      postUsers: ["users:write"],
    };
    for (const [id, scopes] of Object.entries(scoped)) {
      expect(operation(id).security).toEqual([{ bearer: scopes }]);
    }
    expect(operation("getHealth")).not.toHaveProperty("security");
  });

  it("lists every operation once under its path", () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      "/health",
      "/users",
      "/users/{id}",
    ]);
    const ids = Object.values(document.paths).flatMap((item) =>
      Object.values(item).map((op) => op.operationId),
    );
    expect(ids.sort()).toEqual(IDS);
  });

  it("describes the delete as 204 with no content and 404 with a problem", () => {
    const responses = operation("deleteUsersById").responses as Record<
      string,
      Record<string, unknown>
    >;
    expect(Object.keys(responses).sort()).toEqual(["204", "404"]);
    expect(responses["204"]).toEqual({ description: "No Content" });
    expect(responses["404"]).toMatchObject({
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["error", "message"],
          },
        },
      },
    });
  });

  it("requires the body of the create", () => {
    expect(operation("postUsers").requestBody).toMatchObject({
      required: true,
      content: {
        "application/json": {
          schema: { type: "object", required: ["name", "email"] },
        },
      },
    });
    expect(operation("postUsers").responses).toHaveProperty("201");
  });

  it("coerces the limit of the list in the document", () => {
    expect(operation("getUsers").parameters).toEqual([
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
    ]);
  });
});

describe("the running service", () => {
  let api: Apiary<typeof bundle>;
  const created: { id: string; lifetime: Lifetime }[] = [];
  const reader = mockCaller(["users:read"], { subject: "reader" });
  const writer = mockCaller(["users:write"], { subject: "writer" });
  let userId: string;

  beforeAll(async () => {
    api = await bootApiary(bundle);
    api.on("service:create", (event) => created.push(event));
  });

  afterAll(async () => {
    await api.stop();
  });

  it("reports health with the time of the clock", async () => {
    const { status, body } = await api.invoke("getHealth", {}, mockCaller());
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(Number.isNaN(Date.parse(body.time))).toBe(false);
  });

  it("makes a user with a uuid id", async () => {
    const { status, body } = await api.invoke(
      "postUsers",
      { body: { name: "Ada", email: "ada@example.com" } },
      writer,
    );
    expect(status).toBe(201);
    expect(body).toMatchObject({ name: "Ada", email: "ada@example.com" });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Number.isNaN(Date.parse(body.createdAt))).toBe(false);
    userId = body.id;
  });

  it("returns the user by id", async () => {
    const { status, body } = await api.invoke(
      "getUsersById",
      { path: { id: userId } },
      reader,
    );
    expect(status).toBe(200);
    expect(body.id).toBe(userId);
    expect(body.name).toBe("Ada");
  });

  it("types the body of a user", () => {
    expectTypeOf(api.invoke("getUsersById", { path: { id: userId } }, reader))
      .resolves.toHaveProperty("body")
      .toMatchObjectType<{
        id: string;
        name: string;
      }>();
  });

  it("coerces the limit of the list from the query string", async () => {
    await api.invoke(
      "postUsers",
      { body: { name: "Grace", email: "grace@example.com" } },
      writer,
    );
    const all = await api.invoke("getUsers", {}, reader);
    expect(all.body.map((user) => user.name)).toEqual(["Ada", "Grace"]);
    const one = await api.invoke("getUsers", { query: { limit: "1" } }, reader);
    expect(one.body).toHaveLength(1);
    expect(one.body[0]?.id).toBe(userId);
  });

  it("rejects a limit outside the range", async () => {
    await expect(
      api.invoke("getUsers", { query: { limit: "0" } }, reader),
    ).rejects.toMatchObject({
      status: 400,
      body: { error: "invalid_input" },
    });
  });

  it("removes a user with no body", async () => {
    const result = await api.invoke(
      "deleteUsersById",
      { path: { id: userId } },
      writer,
    );
    expect(result).toEqual({ status: 204, body: undefined });
  });

  it("answers 404 for the removed user", async () => {
    const call = api.invoke("getUsersById", { path: { id: userId } }, reader);
    await expect(call).rejects.toThrow(ApiaryError);
    await expect(call).rejects.toMatchObject({
      status: 404,
      body: { error: "not_found", message: `no user with id ${userId}` },
    });
    await expect(
      api.invoke("deleteUsersById", { path: { id: userId } }, writer),
    ).rejects.toMatchObject({ status: 404, body: { error: "not_found" } });
  });

  it("refuses a caller without the scope", async () => {
    await expect(
      api.invoke("getUsers", {}, mockCaller(["users:write"])),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      api.invoke(
        "postUsers",
        { body: { name: "Eve", email: "eve@example.com" } },
        reader,
      ),
    ).rejects.toThrow(ForbiddenError);
    await expect(
      api.invoke("getUsersById", { path: { id: userId } }, mockCaller()),
    ).rejects.toMatchObject({
      status: 403,
      body: { error: "forbidden", scopes: ["users:read"] },
    });
  });

  it("makes the audit trail once for each create and nothing else", () => {
    // The singletons were made at start, before the listener, so the list
    // holds the scoped service only: one Audit for each successful create.
    expect(created).toEqual([
      { id: "Audit", lifetime: "scoped" },
      { id: "Audit", lifetime: "scoped" },
    ]);
  });

  it("makes the singletons at start only", async () => {
    const seen: { id: string; lifetime: Lifetime }[] = [];
    const fresh = await bootApiary(bundle);
    const off = fresh.on("service:create", (event) => seen.push(event));
    await fresh.stop();
    await fresh.start();
    expect(seen.map((event) => event.id).sort()).toEqual(["Clock", "Users"]);
    expect(seen.every((event) => event.lifetime === "singleton")).toBe(true);
    await fresh.invoke("getHealth", {}, mockCaller());
    expect(seen).toHaveLength(2);
    off();
    await fresh.stop();
  });

  it("stops and refuses a call", async () => {
    const other = await bootApiary(bundle);
    await other.stop();
    await expect(other.invoke("getHealth", {}, mockCaller())).rejects.toThrow(
      /not started/,
    );
  });
});

describe("a build from the source", () => {
  it("finds the same endpoints, services, and document", async () => {
    const kit = await generate(config, { cwd: ROOT, version: pkg.version });
    expect(kit.endpoints.map((endpoint) => endpoint.id)).toEqual(IDS);
    expect(
      kit.services.map((found) => serviceId(found.service)).sort(),
    ).toEqual(["Audit", "Clock", "Users"]);
    expect(kit.openapi).toEqual(document);
    expect(kit.outDir).toBe(".dist");
  });
});
