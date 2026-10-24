import { describe, expect, it } from "vitest";
import { z } from "zod";

import { apiary, ForbiddenError, NotStartedError, Service } from "open-apiary";

import { bootApiary, mockBundle, mockCaller } from "../src";

class Clock extends Service {
  ready = false;

  override setup(): void {
    this.ready = true;
  }

  override dispose(): void {
    this.ready = false;
  }
}

const bundle = mockBundle(
  {
    getReady: apiary
      .GET("/ready", {}, z.object({ ready: z.boolean() }))
      .handle((ctx) => ({ ready: ctx.use(Clock).ready })),
    getSecret: apiary
      .GET("/secret", {}, z.object({ ok: z.literal(true) }))
      .handle(() => ({ ok: true }))
      .withScopes("secret:read"),
  },
  { services: [Clock] },
);

describe("bootApiary", () => {
  it("returns a started service whose singletons are set up", async () => {
    const api = await bootApiary(bundle);
    const result = await api.invoke("getReady", {}, mockCaller());
    expect(result).toEqual({ status: 200, body: { ready: true } });
    await api.stop();
  });

  it("stops the service so a call throws", async () => {
    const api = await bootApiary(bundle);
    await api.stop();
    await expect(api.invoke("getReady", {}, mockCaller())).rejects.toThrow(
      NotStartedError,
    );
  });

  it("passes the options to makeApiary", async () => {
    const api = await bootApiary(bundle, { authorize: () => true });
    const result = await api.invoke("getSecret", {}, mockCaller());
    expect(result.body).toEqual({ ok: true });
    await api.stop();
  });

  it("checks the scopes of the caller by default", async () => {
    const api = await bootApiary(bundle);
    await expect(api.invoke("getSecret", {}, mockCaller())).rejects.toThrow(
      ForbiddenError,
    );
    const result = await api.invoke(
      "getSecret",
      {},
      mockCaller(["secret:read"]),
    );
    expect(result.status).toBe(200);
    await api.stop();
  });

  it("exposes the registry and the document of the bundle", async () => {
    const api = await bootApiary(bundle);
    expect(api.registry.list().map((entry) => entry.id)).toEqual([
      "getReady",
      "getSecret",
    ]);
    expect(api.openapi).toBe(bundle.openapi);
    await api.stop();
  });
});
