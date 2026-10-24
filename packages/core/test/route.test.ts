import { describe, it, expect } from "vitest";

import { compile, match, params } from "../src/route";

describe("params", () => {
  it("lists the parameter names in order", () => {
    expect(params("/users/{id}/posts/{postId}")).toEqual(["id", "postId"]);
  });

  it("is empty for a static route", () => {
    expect(params("/users")).toEqual([]);
    expect(params("/")).toEqual([]);
  });

  it("takes only a whole segment in braces as a parameter", () => {
    expect(params("/files/{name}.json")).toEqual([]);
    expect(params("/files/{a}{b}")).toEqual([]);
  });
});

describe("compile", () => {
  it("names the parameters in order", () => {
    expect(compile("/users/{id}/posts/{postId}").names).toEqual([
      "id",
      "postId",
    ]);
  });

  it("weighs a route by its static segments", () => {
    expect(compile("/users").weight).toBe(1);
    expect(compile("/users/{id}").weight).toBe(1);
    expect(compile("/users/me").weight).toBe(2);
    expect(compile("/users/{id}/posts/{postId}").weight).toBe(2);
  });

  it("matches the route itself", () => {
    expect(compile("/users").regex.test("/users")).toBe(true);
    expect(compile("/users/{id}").regex.test("/users/42")).toBe(true);
  });

  it("accepts a trailing slash on the path", () => {
    expect(compile("/users").regex.test("/users/")).toBe(true);
    expect(compile("/users/{id}").regex.test("/users/42/")).toBe(true);
  });

  it("rejects a missing, an empty, or an extra segment", () => {
    const pattern = compile("/users/{id}");
    expect(pattern.regex.test("/users")).toBe(false);
    expect(pattern.regex.test("/users/")).toBe(false);
    expect(pattern.regex.test("/users//")).toBe(false);
    expect(pattern.regex.test("/users/42/posts")).toBe(false);
    expect(pattern.regex.test("/api/users/42")).toBe(false);
  });

  it("escapes the special characters of a static segment", () => {
    const pattern = compile("/v1.0/users");
    expect(pattern.regex.test("/v1.0/users")).toBe(true);
    expect(pattern.regex.test("/v1x0/users")).toBe(false);
    const plus = compile("/a+b/(c)");
    expect(plus.regex.test("/a+b/(c)")).toBe(true);
    expect(plus.regex.test("/aab/c")).toBe(false);
  });
});

describe("match", () => {
  it("returns the parameters by name", () => {
    const pattern = compile("/users/{id}/posts/{postId}");
    expect(match(pattern, "/users/42/posts/7")).toEqual({
      id: "42",
      postId: "7",
    });
  });

  it("returns an empty object for a static route", () => {
    expect(match(compile("/users"), "/users")).toEqual({});
    expect(match(compile("/users"), "/users/")).toEqual({});
  });

  it("returns undefined when the path does not match", () => {
    const pattern = compile("/users/{id}");
    expect(match(pattern, "/users")).toBeUndefined();
    expect(match(pattern, "/posts/42")).toBeUndefined();
    expect(match(pattern, "users/42")).toBeUndefined();
  });

  it("decodes an escaped parameter", () => {
    const pattern = compile("/users/{id}");
    expect(match(pattern, "/users/john%20doe")).toEqual({ id: "john doe" });
    expect(match(pattern, "/users/a%2Fb")).toEqual({ id: "a/b" });
  });

  it("returns a malformed escape as it is", () => {
    const pattern = compile("/users/{id}");
    expect(match(pattern, "/users/%E0%A4%A")).toEqual({ id: "%E0%A4%A" });
    expect(match(pattern, "/users/100%")).toEqual({ id: "100%" });
  });
});
