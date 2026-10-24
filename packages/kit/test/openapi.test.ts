import type { Identified, KitConfig } from "../src/types";

import { apiary } from "@open-apiary/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { InvalidSourceError } from "../src/error";
import { derive } from "../src/openapi";
import { CONFIG, ROOT, endpointOf, identifiedOf, thrown } from "./helpers";

/** The identity of the project under test. */
const identity = { name: "fixture", version: "1.2.3" };

/** A config whose `security` names a declared scheme. */
const secured: KitConfig = {
  source: "./src",
  security: "bearer",
  openapi: {
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    },
  },
};

/** The output of most endpoints under test. */
const User = z.object({ id: z.string(), name: z.string() });

/** The body of an error response. */
const Problem = z.object({ message: z.string() });

/** A complete endpoint with nothing but a route and an output. */
const listUsers = apiary.GET("/users", {}, z.array(User)).handle(() => []);

/** Derives the document of one or more endpoints under the default config. */
const document = (
  endpoints: Identified[],
  config: KitConfig = CONFIG,
): Record<string, unknown> => derive(endpoints, config, identity, ROOT);

/** Reads the operation of a method and route out of a document. */
const operationOf = (
  doc: Record<string, unknown>,
  route: string,
  method: string,
): Record<string, unknown> => {
  const paths = doc.paths as Record<string, Record<string, unknown>>;
  return paths[route]![method] as Record<string, unknown>;
};

describe("derive", () => {
  it("writes the OpenAPI version and the identity of the project", () => {
    const doc = document([]);
    expect(doc.openapi).toBe("3.1.0");
    expect(doc.info).toEqual({ title: "fixture", version: "1.2.3" });
    expect(doc.paths).toEqual({});
  });

  it("falls back to API and 0.0.0 when the identity is empty", () => {
    expect(derive([], CONFIG, {}, ROOT).info).toEqual({
      title: "API",
      version: "0.0.0",
    });
    expect(derive([], CONFIG, { name: "only" }, ROOT).info).toEqual({
      title: "only",
      version: "0.0.0",
    });
  });

  it("makes one path item per route with lower-case method keys", () => {
    const doc = document([
      identifiedOf(listUsers, "src/list.ts"),
      identifiedOf(
        apiary
          .POST("/users", { body: User }, User)
          .handle(() => ({ id: "", name: "" })),
        "src/create.ts",
      ),
      identifiedOf(
        apiary
          .GET("/users/{id}", { path: z.object({ id: z.string() }) }, User)
          .handle(() => ({ id: "", name: "" })),
        "src/get.ts",
      ),
    ]);
    expect(Object.keys(doc.paths as object)).toEqual(["/users", "/users/{id}"]);
    const users = (doc.paths as Record<string, object>)["/users"];
    expect(Object.keys(users!)).toEqual(["get", "post"]);
    expect(operationOf(doc, "/users", "get").operationId).toBe("getUsers");
    expect(operationOf(doc, "/users", "post").operationId).toBe("postUsers");
    expect(operationOf(doc, "/users/{id}", "get").operationId).toBe(
      "getUsersById",
    );
  });

  it("writes the operation id the validation assigned", () => {
    const doc = document([identifiedOf(listUsers, "src/list.ts", "listUsers")]);
    expect(operationOf(doc, "/users", "get").operationId).toBe("listUsers");
  });

  it("omits parameters, tags, and security on a bare endpoint", () => {
    const op = operationOf(
      document([identifiedOf(listUsers, "src/a.ts")]),
      "/users",
      "get",
    );
    expect(op).not.toHaveProperty("parameters");
    expect(op).not.toHaveProperty("tags");
    expect(op).not.toHaveProperty("security");
    expect(op).not.toHaveProperty("requestBody");
  });

  it("makes a required parameter for each path member", () => {
    const doc = document([
      identifiedOf(
        apiary
          .GET(
            "/teams/{team}/users/{id}",
            { path: z.object({ team: z.string(), id: z.uuid() }) },
            User,
          )
          .handle(() => ({ id: "", name: "" })),
        "src/get.ts",
      ),
    ]);
    const op = operationOf(doc, "/teams/{team}/users/{id}", "get");
    expect(op.parameters).toEqual([
      { name: "team", in: "path", required: true, schema: { type: "string" } },
      {
        name: "id",
        in: "path",
        required: true,
        schema: expect.objectContaining({ type: "string", format: "uuid" }),
      },
    ]);
  });

  it("requires a path parameter even when its validator is optional", () => {
    const getUser = apiary
      .GET("/users/{id}", { path: z.object({ id: z.string() }) }, User)
      .handle(() => ({ id: "", name: "" }));
    const doc = document([
      {
        ...endpointOf(getUser, "src/get.ts", {
          input: { path: z.object({ id: z.string().optional() }) },
        }),
        id: "getUsersById",
      },
    ]);
    expect(operationOf(doc, "/users/{id}", "get").parameters).toEqual([
      { name: "id", in: "path", required: true, schema: { type: "string" } },
    ]);
  });

  it("makes query parameters whose required flag follows the validator", () => {
    const doc = document([
      identifiedOf(
        apiary
          .GET(
            "/users",
            {
              query: z.object({
                limit: z.coerce.number().default(20),
                q: z.string().optional(),
                sort: z.enum(["asc", "desc"]),
              }),
            },
            z.array(User),
          )
          .handle(() => []),
        "src/list.ts",
      ),
    ]);
    const op = operationOf(doc, "/users", "get");
    expect(op.parameters).toEqual([
      {
        name: "limit",
        in: "query",
        required: false,
        schema: { type: "number", default: 20 },
      },
      { name: "q", in: "query", required: false, schema: { type: "string" } },
      {
        name: "sort",
        in: "query",
        required: true,
        schema: { type: "string", enum: ["asc", "desc"] },
      },
    ]);
  });

  it("makes header parameters and lists path, query, then headers", () => {
    const doc = document([
      identifiedOf(
        apiary
          .GET(
            "/users/{id}",
            {
              path: z.object({ id: z.string() }),
              query: z.object({ expand: z.string().optional() }),
              headers: z.object({ "x-request-id": z.string() }),
            },
            User,
          )
          .handle(() => ({ id: "", name: "" })),
        "src/get.ts",
      ),
    ]);
    const op = operationOf(doc, "/users/{id}", "get");
    expect(
      (op.parameters as { name: string; in: string; required: boolean }[]).map(
        ({ name, in: location, required }) => [name, location, required],
      ),
    ).toEqual([
      ["id", "path", true],
      ["expand", "query", false],
      ["x-request-id", "header", true],
    ]);
  });

  it("makes a required JSON request body from a plain object validator", () => {
    const doc = document([
      identifiedOf(
        apiary
          .POST("/users", { body: User }, User)
          .handle(() => ({ id: "", name: "" })),
        "src/create.ts",
      ),
    ]);
    expect(operationOf(doc, "/users", "post").requestBody).toEqual({
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { id: { type: "string" }, name: { type: "string" } },
            required: ["id", "name"],
          },
        },
      },
    });
  });

  it("makes an optional request body from an optional validator", () => {
    const doc = document([
      identifiedOf(
        apiary
          .PATCH(
            "/users/{id}",
            {
              path: z.object({ id: z.string() }),
              body: User.partial().optional(),
            },
            User,
          )
          .handle(() => ({ id: "", name: "" })),
        "src/patch.ts",
      ),
    ]);
    const body = operationOf(doc, "/users/{id}", "patch").requestBody as {
      required: boolean;
    };
    expect(body.required).toBe(false);
  });

  it("writes the success response under the status with a JSON schema", () => {
    const doc = document([
      identifiedOf(listUsers, "src/list.ts"),
      identifiedOf(
        apiary
          .POST("/users", { body: User }, User)
          .handle(() => ({ id: "", name: "" })),
        "src/create.ts",
      ),
      identifiedOf(
        apiary
          .PUT("/users", {}, User)
          .withStatus(202)
          .handle(() => ({ id: "", name: "" })),
        "src/put.ts",
      ),
    ]);
    expect(operationOf(doc, "/users", "get").responses).toEqual({
      200: {
        description: "OK",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string" },
                },
                required: ["id", "name"],
                additionalProperties: false,
              },
            },
          },
        },
      },
    });
    expect(
      Object.keys(operationOf(doc, "/users", "post").responses as object),
    ).toEqual(["201"]);
    expect(
      (
        operationOf(doc, "/users", "post").responses as Record<
          string,
          { description: string }
        >
      )[201]?.description,
    ).toBe("Created");
    expect(
      Object.keys(operationOf(doc, "/users", "put").responses as object),
    ).toEqual(["202"]);
  });

  it("writes a 204 response with no content", () => {
    const doc = document([
      identifiedOf(
        apiary
          .DELETE(
            "/users/{id}",
            { path: z.object({ id: z.string() }) },
            z.void(),
          )
          .withStatus(204)
          .handle(() => undefined),
        "src/remove.ts",
      ),
    ]);
    expect(operationOf(doc, "/users/{id}", "delete").responses).toEqual({
      204: { description: "No Content" },
    });
  });

  it("describes an unlisted status by its number", () => {
    const doc = document([
      identifiedOf(listUsers.withStatus(299), "src/list.ts"),
    ]);
    const responses = operationOf(doc, "/users", "get").responses as Record<
      string,
      { description: string }
    >;
    expect(responses[299]?.description).toBe("Response 299");
  });

  it("adds a response for each error of withErrors", () => {
    const doc = document([
      identifiedOf(
        listUsers.withErrors({ 404: Problem }).withErrors({ 403: Problem }),
        "src/list.ts",
      ),
    ]);
    const responses = operationOf(doc, "/users", "get").responses as Record<
      string,
      unknown
    >;
    expect(Object.keys(responses)).toEqual(["200", "403", "404"]);
    expect(responses[404]).toEqual({
      description: "Not Found",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: { message: { type: "string" } },
            required: ["message"],
            additionalProperties: false,
          },
        },
      },
    });
    expect((responses[403] as { description: string }).description).toBe(
      "Forbidden",
    );
  });

  it("copies the tags", () => {
    const doc = document([
      identifiedOf(listUsers.withTags("users").withTags("public"), "src/a.ts"),
    ]);
    expect(operationOf(doc, "/users", "get").tags).toEqual(["users", "public"]);
  });

  it("lists the scopes under the security scheme of the config", () => {
    const doc = document(
      [
        identifiedOf(
          listUsers.withScopes("users:read", "users:list"),
          "src/a.ts",
        ),
      ],
      secured,
    );
    expect(operationOf(doc, "/users", "get").security).toEqual([
      { bearer: ["users:read", "users:list"] },
    ]);
  });

  it("omits security when the endpoint has no scopes", () => {
    const doc = document([identifiedOf(listUsers, "src/a.ts")], secured);
    expect(operationOf(doc, "/users", "get")).not.toHaveProperty("security");
  });

  it("omits security when the config sets no scheme", () => {
    const doc = document([identifiedOf(listUsers.withScopes("x"), "src/a.ts")]);
    expect(operationOf(doc, "/users", "get")).not.toHaveProperty("security");
  });

  it("merges the spec over the operation", () => {
    const doc = document([
      identifiedOf(
        listUsers.withTags("users").withSpec({
          summary: "List users",
          deprecated: true,
          operationId: "ignored",
          tags: ["replaced"],
          responses: { 200: { description: "A page of users" } },
        }),
        "src/a.ts",
      ),
    ]);
    const op = operationOf(doc, "/users", "get");
    expect(op.summary).toBe("List users");
    expect(op.deprecated).toBe(true);
    expect(op.operationId).toBe("getUsers");
    expect(op.tags).toEqual(["replaced"]);
    const responses = op.responses as Record<string, Record<string, unknown>>;
    expect(responses[200]?.description).toBe("A page of users");
    expect(responses[200]).toHaveProperty("content");
  });

  it("merges the openapi of the config last", () => {
    const doc = document([identifiedOf(listUsers, "src/a.ts")], {
      source: "./src",
      openapi: {
        info: { title: "Overridden", description: "Added" },
        servers: [{ url: "/api" }],
        tags: [{ name: "users" }],
        components: { schemas: { Empty: { type: "object" } } },
        paths: { "/users": { get: { summary: "From the config" } } },
      },
    });
    expect(doc.info).toEqual({
      title: "Overridden",
      version: "1.2.3",
      description: "Added",
    });
    expect(doc.servers).toEqual([{ url: "/api" }]);
    expect(doc.tags).toEqual([{ name: "users" }]);
    expect(doc.components).toEqual({ schemas: { Empty: { type: "object" } } });
    const op = operationOf(doc, "/users", "get");
    expect(op.summary).toBe("From the config");
    expect(op.operationId).toBe("getUsers");
  });

  it("strips $schema from every schema", () => {
    const doc = document([
      identifiedOf(
        apiary
          .POST(
            "/users/{id}",
            {
              path: z.object({ id: z.string() }),
              query: z.object({ q: z.string() }),
              headers: z.object({ h: z.string() }),
              body: User,
            },
            User,
          )
          .withErrors({ 400: Problem })
          .handle(() => ({ id: "", name: "" })),
        "src/a.ts",
      ),
    ]);
    expect(JSON.stringify(doc)).not.toContain("$schema");
  });

  it("rejects an output validator with no JSON Schema form", () => {
    const endpoints = [
      identifiedOf(
        apiary
          .GET(
            "/custom",
            {},
            z.custom<string>(() => true),
          )
          .handle(() => ""),
        "src/custom.ts",
      ),
    ];
    expect(() => document(endpoints)).toThrow(InvalidSourceError);
    const error = thrown(() => document(endpoints), InvalidSourceError);
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toMatch(/^src\/custom\.ts: /);
    expect(error.issues[0]).toContain("cannot be represented in JSON Schema");
  });

  it("rejects an output validator with a transform", () => {
    const error = thrown(
      () =>
        document([
          identifiedOf(
            apiary
              .GET(
                "/count",
                {},
                z.string().transform((s) => s.length),
              )
              .handle(() => "abc"),
            "src/count.ts",
          ),
        ]),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      "src/count.ts: Transforms cannot be represented in JSON Schema",
    ]);
  });

  it("accepts a transform on an input validator", () => {
    const doc = document([
      identifiedOf(
        apiary
          .GET(
            "/users",
            { query: z.object({ n: z.string().transform((s) => s.length) }) },
            z.array(User),
          )
          .handle(() => []),
        "src/a.ts",
      ),
    ]);
    expect(operationOf(doc, "/users", "get").parameters).toEqual([
      { name: "n", in: "query", required: true, schema: { type: "string" } },
    ]);
  });

  it("reports every endpoint that fails, and keeps the ones that pass", () => {
    const error = thrown(
      () =>
        document([
          identifiedOf(
            apiary.GET("/a", {}, z.date()).handle(() => new Date()),
            "src/a.ts",
          ),
          identifiedOf(listUsers, "src/b.ts"),
          identifiedOf(
            apiary
              .GET(
                "/c",
                {},
                z.custom(() => true),
              )
              .handle(() => 1),
            "src/c.ts",
          ),
        ]),
      InvalidSourceError,
    );
    expect(error.issues.map((issue) => issue.split(":")[0])).toEqual([
      "src/a.ts",
      "src/c.ts",
    ]);
  });
});
