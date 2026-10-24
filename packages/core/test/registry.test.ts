import { describe, it, expect } from "vitest";
import { apiary } from "@open-apiary/schema";
import { z } from "zod";

import { makeRegistry } from "../src/registry";
import { Id, User, createUser, getMe, getUser } from "./fixture";

describe("list", () => {
  it("lists each endpoint as data only", () => {
    const registry = makeRegistry({ getUser, createUser });
    expect(registry.list()).toEqual([
      {
        id: "getUser",
        method: "GET",
        route: "/users/{id}",
        status: 200,
        errors: [404],
        scopes: ["users:read"],
        tags: ["users"],
      },
      {
        id: "createUser",
        method: "POST",
        route: "/users",
        status: 202,
        errors: [],
        scopes: ["users:write", "users:read"],
        tags: [],
      },
    ]);
  });

  it("is empty for an empty bundle", () => {
    expect(makeRegistry({}).list()).toEqual([]);
  });

  it("returns a fresh array on each call", () => {
    const registry = makeRegistry({ getUser });
    expect(registry.list()).not.toBe(registry.list());
  });
});

describe("get", () => {
  it("returns the entry of an id", () => {
    const registry = makeRegistry({ getUser, getMe });
    expect(registry.get("getMe")).toEqual({
      id: "getMe",
      method: "GET",
      route: "/users/me",
      status: 200,
      errors: [],
      scopes: [],
      tags: [],
    });
  });

  it("returns undefined for an unknown id", () => {
    expect(makeRegistry({ getUser }).get("nope")).toBeUndefined();
  });
});

describe("lookup", () => {
  it("returns the entry, the definition, and the pattern", () => {
    const registered = makeRegistry({ getUser }).lookup("getUser");
    expect(registered?.entry.id).toBe("getUser");
    expect(registered?.definition.handler).toBeTypeOf("function");
    expect(registered?.pattern.names).toEqual(["id"]);
  });

  it("returns undefined for an unknown id", () => {
    expect(makeRegistry({ getUser }).lookup("nope")).toBeUndefined();
  });
});

describe("match", () => {
  it("prefers a static route over a parameter when it is listed first", () => {
    const registry = makeRegistry({ getMe, getUser });
    expect(registry.match("GET", "/users/me")).toEqual({
      id: "getMe",
      params: {},
    });
  });

  it("prefers a static route over a parameter when it is listed last", () => {
    const registry = makeRegistry({ getUser, getMe });
    expect(registry.match("GET", "/users/me")).toEqual({
      id: "getMe",
      params: {},
    });
  });

  it("returns the decoded parameters", () => {
    const registry = makeRegistry({ getUser, getMe });
    expect(registry.match("GET", "/users/42")).toEqual({
      id: "getUser",
      params: { id: "42" },
    });
    expect(registry.match("GET", "/users/john%20doe")).toEqual({
      id: "getUser",
      params: { id: "john doe" },
    });
  });

  it("ignores the case of the method", () => {
    const registry = makeRegistry({ getUser, createUser });
    expect(registry.match("get", "/users/42")?.id).toBe("getUser");
    expect(registry.match("Post", "/users")?.id).toBe("createUser");
  });

  it("returns undefined for the wrong method", () => {
    const registry = makeRegistry({ getUser, createUser });
    expect(registry.match("DELETE", "/users/42")).toBeUndefined();
    expect(registry.match("GET", "/users")).toBeUndefined();
  });

  it("returns undefined for a path that no route matches", () => {
    const registry = makeRegistry({ getUser, getMe });
    expect(registry.match("GET", "/posts/42")).toBeUndefined();
    expect(registry.match("GET", "/users/42/posts")).toBeUndefined();
  });

  it("breaks a tie in weight by id", () => {
    const a = apiary.GET("/items/{id}", { path: Id }, User);
    const b = apiary.GET(
      "/items/{key}",
      { path: z.object({ key: z.string() }) },
      User,
    );
    const registry = makeRegistry({ b, a });
    expect(registry.match("GET", "/items/1")?.id).toBe("a");
  });
});
