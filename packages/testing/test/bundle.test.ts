import { describe, expect, it } from "vitest";
import { z } from "zod";

import { apiary, Service } from "open-apiary";

import { mockBundle, mockCaller } from "../src";

const health = apiary
  .GET("/health", {}, z.object({ ok: z.literal(true) }))
  .handle(() => ({ ok: true }));

class Clock extends Service {
  now(): number {
    return 0;
  }
}

describe("mockBundle", () => {
  it("keeps the endpoints and fills the rest with defaults", () => {
    const bundle = mockBundle({ getHealth: health });
    expect(bundle.endpoints.getHealth).toBe(health);
    expect(bundle.services).toEqual([]);
    expect(bundle.openapi).toEqual({ openapi: "3.1.0", paths: {} });
  });

  it("passes the services and the document through", () => {
    const openapi = { openapi: "3.1.0", info: { title: "t" }, paths: {} };
    const bundle = mockBundle(
      { getHealth: health },
      { services: [Clock], openapi },
    );
    expect(bundle.services).toEqual([Clock]);
    expect(bundle.openapi).toBe(openapi);
  });

  it("makes a bundle with no endpoints", () => {
    expect(mockBundle({})).toEqual({
      endpoints: {},
      services: [],
      openapi: { openapi: "3.1.0", paths: {} },
    });
  });
});

describe("mockCaller", () => {
  it("has no scopes by default", () => {
    expect(mockCaller()).toEqual({ scopes: [] });
  });

  it("keeps the scopes and the other members", () => {
    expect(mockCaller(["a"], { subject: "x" })).toEqual({
      scopes: ["a"],
      subject: "x",
    });
  });

  it("lets the scopes win over a scopes member of the rest", () => {
    expect(mockCaller(["a"], { scopes: ["b"] }).scopes).toEqual(["a"]);
  });
});
