import type { OpenApiConfig } from "../src/types";

import { join } from "node:path";
import { apiary, Service } from "@open-apiary/schema";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { InvalidConfigError, InvalidSourceError } from "../src/error";
import { validateConfig, validateSource } from "../src/validate";
import {
  CONFIG,
  PROJECT,
  endpointOf,
  foundOf,
  serviceOf,
  thrown,
} from "./helpers";

/** A config whose `security` names a declared scheme. */
const secured = {
  source: "./src",
  security: "bearer",
  openapi: {
    components: { securitySchemes: { bearer: { type: "http" } } },
  },
};

describe("validateConfig", () => {
  it("returns the absolute source and the default output directory", () => {
    expect(validateConfig({ source: "./src" }, PROJECT)).toEqual({
      source: join(PROJECT, "src"),
      outDir: ".dist",
    });
  });

  it("normalizes the output directory relative to the root", () => {
    expect(
      validateConfig({ source: "src", outDir: "./out/" }, PROJECT),
    ).toEqual({ source: join(PROJECT, "src"), outDir: "out" });
    expect(
      validateConfig({ source: "src", outDir: "a/../build/api" }, PROJECT)
        .outDir,
    ).toBe(join("build", "api"));
  });

  it("accepts a security scheme that the components declare", () => {
    expect(() => validateConfig(secured, PROJECT)).not.toThrow();
  });

  it("rejects an empty source", () => {
    expect(() => validateConfig({ source: "" }, PROJECT)).toThrow(
      InvalidConfigError,
    );
    const error = thrown(
      () => validateConfig({ source: "" }, PROJECT),
      InvalidConfigError,
    );
    expect(error.issues).toEqual(["`source` is empty"]);
  });

  it("rejects a source that does not exist", () => {
    const error = thrown(
      () => validateConfig({ source: "./nowhere" }, PROJECT),
      InvalidConfigError,
    );
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toContain("`source` is not a directory");
    expect(error.issues[0]).toContain(join(PROJECT, "nowhere"));
  });

  it("rejects a source that is a file", () => {
    const error = thrown(
      () => validateConfig({ source: "./package.json" }, PROJECT),
      InvalidConfigError,
    );
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toContain("`source` is not a directory");
  });

  it.each(["..", "../sibling", ".", "./", "src/..", "/tmp/elsewhere"])(
    "rejects the output directory %s",
    (outDir) => {
      const error = thrown(
        () => validateConfig({ source: "./src", outDir }, PROJECT),
        InvalidConfigError,
      );
      expect(error.issues).toHaveLength(1);
      expect(error.issues[0]).toContain(
        "`outDir` must be inside the project root",
      );
    },
  );

  it("rejects a security scheme that the components do not declare", () => {
    const error = thrown(
      () =>
        validateConfig(
          {
            source: "./src",
            security: "oauth",
            openapi: { components: { securitySchemes: { bearer: {} } } },
          },
          PROJECT,
        ),
      InvalidConfigError,
    );
    expect(error.issues).toEqual([
      '`security` names "oauth", but `openapi.components.securitySchemes` does not declare it',
    ]);
  });

  it("rejects a security scheme when there are no components", () => {
    const error = thrown(
      () => validateConfig({ source: "./src", security: "bearer" }, PROJECT),
      InvalidConfigError,
    );
    expect(error.issues).toHaveLength(1);
    expect(error.issues[0]).toContain('`security` names "bearer"');
  });

  it("rejects an empty security name", () => {
    const error = thrown(
      () => validateConfig({ ...secured, security: "" }, PROJECT),
      InvalidConfigError,
    );
    expect(error.issues).toEqual([
      "`security` must be the name of a security scheme",
    ]);
  });

  it("rejects an openapi member that is not an object", () => {
    const error = thrown(
      () =>
        validateConfig(
          { source: "./src", openapi: "yes" as unknown as OpenApiConfig },
          PROJECT,
        ),
      InvalidConfigError,
    );
    expect(error.issues).toEqual(["`openapi` must be an object"]);
  });

  it("reports every problem at once", () => {
    const error = thrown(
      () =>
        validateConfig(
          { source: "", outDir: "..", security: "bearer" },
          PROJECT,
        ),
      InvalidConfigError,
    );
    expect(error.issues).toHaveLength(3);
    expect(error.message).toContain("`source` is empty");
    expect(error.message).toContain("`outDir` must be inside");
    expect(error.message).toContain('`security` names "bearer"');
  });
});

/** The output of the endpoints under test. */
const Out = z.object({ ok: z.boolean() });

/** A complete endpoint on a route with one parameter. */
const getUser = apiary
  .GET("/users/{id}", { path: z.object({ id: z.string() }) }, Out)
  .handle(() => ({ ok: true }));

/** A complete endpoint on a route with no parameters. */
const listUsers = apiary.GET("/users", {}, Out).handle(() => ({ ok: true }));

describe("validateSource", () => {
  it("returns the endpoints with their ids, sorted by id", () => {
    const found = foundOf([
      endpointOf(listUsers, "src/list.ts"),
      endpointOf(getUser, "src/get.ts"),
      endpointOf(
        apiary.POST("/users", {}, Out).handle(() => ({ ok: true })),
        "src/create.ts",
      ),
      endpointOf(
        apiary
          .DELETE("/users/{id}", { path: z.object({ id: z.string() }) }, Out)
          .handle(() => ({ ok: true })),
        "src/remove.ts",
      ),
    ]);
    const identified = validateSource(found, CONFIG, "/project");
    expect(identified.map((endpoint) => endpoint.id)).toEqual([
      "deleteUsersById",
      "getUsers",
      "getUsersById",
      "postUsers",
    ]);
    expect(identified[1]).toEqual({ ...found.endpoints[0], id: "getUsers" });
  });

  it("honors the operation id of withSpec", () => {
    const found = foundOf([
      endpointOf(listUsers.withSpec({ operationId: "listUsers" }), "src/a.ts"),
      endpointOf(getUser, "src/b.ts"),
    ]);
    expect(validateSource(found, CONFIG, "/project").map((e) => e.id)).toEqual([
      "getUsersById",
      "listUsers",
    ]);
  });

  it("derives the id when the operation id of withSpec is empty", () => {
    const found = foundOf([
      endpointOf(listUsers.withSpec({ operationId: "" }), "src/a.ts"),
    ]);
    expect(validateSource(found, CONFIG, "/project")[0]?.id).toBe("getUsers");
  });

  it("returns an empty list for an empty scan", () => {
    expect(validateSource(foundOf(), CONFIG, "/project")).toEqual([]);
  });

  it("rejects an endpoint with no handler", () => {
    const found = foundOf([
      endpointOf(apiary.GET("/users", {}, Out), "src/list.ts"),
    ]);
    expect(() => validateSource(found, CONFIG, "/project")).toThrow(
      InvalidSourceError,
    );
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      "src/list.ts: the endpoint has no handler — call .handle()",
    ]);
  });

  it("rejects two endpoints on one method and route", () => {
    const found = foundOf([
      endpointOf(listUsers, "src/a.ts"),
      endpointOf(listUsers.withSpec({ operationId: "other" }), "src/b.ts"),
    ]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      "src/b.ts: GET /users is also defined in src/a.ts",
    ]);
  });

  it("allows one route under two methods", () => {
    const found = foundOf([
      endpointOf(listUsers, "src/a.ts"),
      endpointOf(
        apiary.POST("/users", {}, Out).handle(() => ({ ok: true })),
        "src/b.ts",
      ),
    ]);
    expect(() => validateSource(found, CONFIG, "/project")).not.toThrow();
  });

  it("rejects a path validator that misses a parameter", () => {
    const found = foundOf([
      endpointOf(getUser, "src/get.ts", { input: { path: z.object({}) } }),
    ]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      "src/get.ts: the route has the parameters [id] but the `path` validator has []",
    ]);
  });

  it("rejects a route with parameters and no path validator", () => {
    const found = foundOf([endpointOf(getUser, "src/get.ts", { input: {} })]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues[0]).toContain(
      "the route has the parameters [id] but the `path` validator has []",
    );
  });

  it("rejects a path validator with an extra member", () => {
    const found = foundOf([
      endpointOf(getUser, "src/get.ts", {
        input: { path: z.object({ id: z.string(), extra: z.string() }) },
      }),
    ]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      "src/get.ts: the route has the parameters [id] but the `path` validator has [id, extra]",
    ]);
  });

  it("rejects a path validator on a route with no parameters", () => {
    const found = foundOf([
      endpointOf(listUsers, "src/list.ts", {
        input: { path: z.object({ id: z.string() }) },
      }),
    ]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      "src/list.ts: the route has the parameters [] but the `path` validator has [id]",
    ]);
  });

  it("accepts a path validator whose members are in another order", () => {
    const found = foundOf([
      endpointOf(
        apiary
          .GET(
            "/a/{x}/b/{y}",
            { path: z.object({ y: z.string(), x: z.string() }) },
            Out,
          )
          .handle(() => ({ ok: true })),
        "src/ab.ts",
      ),
    ]);
    expect(() => validateSource(found, CONFIG, "/project")).not.toThrow();
  });

  it("rejects two endpoints with one derived operation id", () => {
    const found = foundOf([
      endpointOf(listUsers, "src/a.ts"),
      endpointOf(
        apiary.GET("/users/", {}, Out).handle(() => ({ ok: true })),
        "src/b.ts",
      ),
    ]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      'src/b.ts: the operation id "getUsers" is also used by src/a.ts',
    ]);
  });

  it("rejects an operation id of withSpec that another endpoint derives", () => {
    const found = foundOf([
      endpointOf(listUsers, "src/a.ts"),
      endpointOf(getUser.withSpec({ operationId: "getUsers" }), "src/b.ts"),
    ]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      'src/b.ts: the operation id "getUsers" is also used by src/a.ts',
    ]);
  });

  it("rejects scopes when the config sets no security scheme", () => {
    const found = foundOf([
      endpointOf(listUsers.withScopes("users:read"), "src/a.ts"),
    ]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      "src/a.ts: the endpoint has scopes, but the config sets no `security` scheme",
    ]);
    expect(() => validateSource(found, secured, "/project")).not.toThrow();
  });

  it("rejects two services with one explicit id", () => {
    class Clock extends Service {
      static override readonly id = "time";
    }
    class Timer extends Service {
      static override readonly id = "time";
    }
    const found = foundOf(
      [],
      [serviceOf(Clock, "src/clock.ts"), serviceOf(Timer, "src/timer.ts")],
    );
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      'src/timer.ts: the service id "time" is also used by src/clock.ts',
    ]);
  });

  it("rejects two services with one class name", () => {
    const make = () => class Thing extends Service {};
    const found = foundOf(
      [],
      [serviceOf(make(), "src/a.ts"), serviceOf(make(), "src/b.ts")],
    );
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      'src/b.ts: the service id "Thing" is also used by src/a.ts',
    ]);
  });

  it("accepts services whose ids differ", () => {
    class Clock extends Service {}
    class Users extends Service {
      static override readonly id = "directory";
    }
    const found = foundOf(
      [],
      [serviceOf(Clock, "src/a.ts"), serviceOf(Users, "src/b.ts")],
    );
    expect(validateSource(found, CONFIG, "/project")).toEqual([]);
  });

  it("reports every issue of every endpoint at once", () => {
    const found = foundOf([
      endpointOf(apiary.GET("/users", {}, Out).withScopes("x"), "src/a.ts"),
      endpointOf(listUsers, "src/b.ts"),
    ]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues).toEqual([
      "src/a.ts: the endpoint has no handler — call .handle()",
      "src/a.ts: the endpoint has scopes, but the config sets no `security` scheme",
      "src/b.ts: GET /users is also defined in src/a.ts",
      'src/b.ts: the operation id "getUsers" is also used by src/a.ts',
    ]);
    expect(error.message).toContain("the source is invalid");
  });

  it("names files relative to the root", () => {
    const found = foundOf([
      endpointOf(apiary.GET("/users", {}, Out), "deep/nested/list.ts"),
    ]);
    const error = thrown(
      () => validateSource(found, CONFIG, "/project"),
      InvalidSourceError,
    );
    expect(error.issues[0]?.startsWith("deep/nested/list.ts: ")).toBe(true);
  });
});
