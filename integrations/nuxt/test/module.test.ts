import type { ModuleOptions } from "../src/module";

import { beforeEach, describe, expect, it, vi } from "vitest";

const kit = vi.hoisted(() => ({
  addServerHandler: vi.fn(),
  addServerPlugin: vi.fn(),
  addServerTemplate: vi.fn(),
  createResolver: vi.fn(() => ({ resolve: (p: string) => `/resolved/${p}` })),
}));

vi.mock("@nuxt/kit", () => ({
  defineNuxtModule: (def: unknown) => def,
  ...kit,
}));

import module, { normalizeBase } from "../src/module";

/** The definition that the mocked `defineNuxtModule` hands back. */
interface ModuleDef {
  meta: { name: string; configKey: string };
  defaults: ModuleOptions;
  setup: (options: ModuleOptions, nuxt: unknown) => void;
}
const mod = module as unknown as ModuleDef;

/** A stand-in for the Nuxt instance. The module reads nothing from it. */
const nuxt = {};

/** The registered server template with the filename, or `undefined`. */
const template = (filename: string) => {
  return kit.addServerTemplate.mock.calls
    .map((call): { filename: string; getContents: () => string } => call[0])
    .find((entry) => entry.filename === filename);
};

/** The registered server handlers, as `[route, method, handler]`. */
const handlers = () => {
  return kit.addServerHandler.mock.calls.map(
    (call): [string, string | undefined, string] => [
      call[0].route,
      call[0].method,
      call[0].handler,
    ],
  );
};

describe("normalizeBase", () => {
  it("keeps a clean base as it is", () => {
    expect(normalizeBase("/api")).toBe("/api");
    expect(normalizeBase("/v1/api")).toBe("/v1/api");
  });

  it("adds the leading slash and drops the trailing one", () => {
    expect(normalizeBase("api")).toBe("/api");
    expect(normalizeBase("api/")).toBe("/api");
    expect(normalizeBase("/api/")).toBe("/api");
    expect(normalizeBase("//api//")).toBe("/api");
  });

  it("ignores surrounding whitespace", () => {
    expect(normalizeBase("  /api ")).toBe("/api");
  });

  it("normalizes the root to an empty string", () => {
    expect(normalizeBase("/")).toBe("");
    expect(normalizeBase("")).toBe("");
    expect(normalizeBase("   ")).toBe("");
  });
});

describe("the module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has the expected meta and defaults", () => {
    expect(mod.meta).toEqual({
      name: "@open-apiary/nuxt",
      configKey: "openApiary",
    });
    expect(mod.defaults).toEqual({ base: "/api" });
  });

  it("requires the package name", () => {
    expect(() => mod.setup({}, nuxt)).toThrow(/`package` names the package/);
    expect(() => mod.setup({ package: "" }, nuxt)).toThrow(
      /`package` names the package/,
    );
    expect(() => mod.setup({ package: 1 as unknown as string }, nuxt)).toThrow(
      /`package` names the package/,
    );
    expect(kit.addServerTemplate).not.toHaveBeenCalled();
    expect(kit.addServerHandler).not.toHaveBeenCalled();
  });

  it("writes a bundle template that re-exports the package", () => {
    mod.setup({ package: "@acme/api", base: "/api" }, nuxt);
    expect(kit.addServerTemplate).toHaveBeenCalledTimes(2);
    expect(template("#open-apiary/bundle")!.getContents()).toBe(
      'export { default } from "@acme/api";\n',
    );
  });

  it("writes an options template that holds the base", () => {
    mod.setup({ package: "@acme/api", base: "/api" }, nuxt);
    expect(template("#open-apiary/options")!.getContents()).toBe(
      'export const base = "/api";\n',
    );
  });

  it("registers the server plugin from the runtime", () => {
    mod.setup({ package: "@acme/api", base: "/api" }, nuxt);
    expect(kit.addServerPlugin).toHaveBeenCalledTimes(1);
    expect(kit.addServerPlugin).toHaveBeenCalledWith(
      "/resolved/./runtime/plugin",
    );
  });

  it("registers the document, the docs, and the delegate under the base", () => {
    mod.setup({ package: "@acme/api", base: "/api" }, nuxt);
    expect(handlers()).toEqual([
      ["/api/openapi.json", "get", "/resolved/./runtime/openapi"],
      ["/api/docs", "get", "/resolved/./runtime/docs"],
      ["/api/**", undefined, "/resolved/./runtime/delegate"],
    ]);
  });

  it("falls back to /api when no base is given", () => {
    mod.setup({ package: "@acme/api" }, nuxt);
    expect(handlers().map(([route]) => route)).toEqual([
      "/api/openapi.json",
      "/api/docs",
      "/api/**",
    ]);
    expect(template("#open-apiary/options")!.getContents()).toContain('"/api"');
  });

  it("normalizes a base without the leading slash or with a trailing one", () => {
    for (const base of ["api/", "/api/", "api"]) {
      vi.clearAllMocks();
      mod.setup({ package: "@acme/api", base }, nuxt);
      expect(handlers().map(([route]) => route)).toEqual([
        "/api/openapi.json",
        "/api/docs",
        "/api/**",
      ]);
      expect(template("#open-apiary/options")!.getContents()).toBe(
        'export const base = "/api";\n',
      );
    }
  });

  it("mounts at the root when the base is a slash", () => {
    mod.setup({ package: "@acme/api", base: "/" }, nuxt);
    expect(handlers().map(([route]) => route)).toEqual([
      "/openapi.json",
      "/docs",
      "/**",
    ]);
    expect(template("#open-apiary/options")!.getContents()).toBe(
      'export const base = "";\n',
    );
  });

  it("escapes the package name in the bundle template", () => {
    mod.setup({ package: 'a"b', base: "/api" }, nuxt);
    expect(template("#open-apiary/bundle")!.getContents()).toBe(
      'export { default } from "a\\"b";\n',
    );
  });
});
