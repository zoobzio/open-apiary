import { describe, expect, it } from "vitest";

import { json, merge, pascal, record } from "../src/util";

describe("record", () => {
  it("accepts a plain object", () => {
    expect(record({})).toBe(true);
    expect(record({ a: 1 })).toBe(true);
  });

  it("rejects null, arrays, and primitives", () => {
    expect(record(null)).toBe(false);
    expect(record([])).toBe(false);
    expect(record("a")).toBe(false);
    expect(record(1)).toBe(false);
    expect(record(undefined)).toBe(false);
  });
});

describe("merge", () => {
  it("merges records by key at every depth", () => {
    expect(
      merge(
        { info: { title: "A", version: "1" }, paths: { "/a": { get: {} } } },
        { info: { title: "B" }, paths: { "/b": {} } },
      ),
    ).toEqual({
      info: { title: "B", version: "1" },
      paths: { "/a": { get: {} }, "/b": {} },
    });
  });

  it("replaces an array instead of merging it", () => {
    expect(merge({ tags: ["a", "b"] }, { tags: ["c"] })).toEqual({
      tags: ["c"],
    });
  });

  it("leaves a member alone when the override is undefined", () => {
    expect(merge({ a: 1, b: 2 }, { a: undefined })).toEqual({ a: 1, b: 2 });
  });

  it("replaces a scalar", () => {
    expect(merge({ a: 1 }, { a: "one" })).toEqual({ a: "one" });
    expect(merge(1, 2)).toBe(2);
    expect(merge({ a: 1 }, "x")).toBe("x");
  });

  it("returns the base when the override itself is undefined", () => {
    expect(merge({ a: 1 }, undefined)).toEqual({ a: 1 });
  });

  it("adds a member the base does not have", () => {
    expect(merge({ a: 1 }, { b: { c: 2 } })).toEqual({ a: 1, b: { c: 2 } });
  });

  it("does not mutate either argument", () => {
    const base = { a: { b: 1 } };
    const over = { a: { c: 2 } };
    merge(base, over);
    expect(base).toEqual({ a: { b: 1 } });
    expect(over).toEqual({ a: { c: 2 } });
  });
});

describe("json", () => {
  it("pretty-prints with two spaces and ends with a newline", () => {
    expect(json({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}\n');
  });
});

describe("pascal", () => {
  it("capitalizes a single word", () => {
    expect(pascal("users")).toBe("Users");
  });

  it("joins kebab-case parts", () => {
    expect(pascal("user-posts")).toBe("UserPosts");
  });

  it("splits on any run of non-alphanumeric characters", () => {
    expect(pascal("team_id.v2--x")).toBe("TeamIdV2X");
  });

  it("keeps the case of the rest of each part", () => {
    expect(pascal("userID")).toBe("UserID");
  });

  it("returns an empty string for no parts", () => {
    expect(pascal("---")).toBe("");
  });
});
