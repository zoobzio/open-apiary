import type { Apiary } from "open-apiary";

import { describe, expect, it } from "vitest";

import { setApiary, useApiary } from "../src/runtime/instance";

describe("useApiary", () => {
  it("throws before the plugin stored a service", () => {
    expect(() => useApiary()).toThrow(/the service is not started/);
  });

  it("returns the service that setApiary stored", () => {
    const api = {} as Apiary;
    setApiary(api);
    expect(useApiary()).toBe(api);
  });

  it("throws again once the service is cleared", () => {
    setApiary(undefined);
    expect(() => useApiary()).toThrow(/the service is not started/);
  });
});
