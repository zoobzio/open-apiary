import { join } from "node:path";
import { DEFINITION, isEndpoint, isService } from "@open-apiary/schema";
import { describe, expect, it } from "vitest";

import { scan, walk } from "../src/scan";
import { SOURCE } from "./helpers";

/** The source files of the fixture project, in the order the walk lists them. */
const FILES = [
  "config.ts",
  "health.ts",
  "helpers.ts",
  "services/clock.ts",
  "users/create.ts",
  "users/get.ts",
  "version.mjs",
].map((file) => join(SOURCE, file));

describe("walk", () => {
  it("lists the source files at every depth as sorted absolute paths", async () => {
    expect(await walk(SOURCE)).toEqual(FILES);
  });

  it("skips declarations, other extensions, dotfiles, dot directories, and node_modules", async () => {
    const files = await walk(SOURCE);
    expect(files.some((file) => file.endsWith(".d.ts"))).toBe(false);
    expect(files.some((file) => file.endsWith(".md"))).toBe(false);
    expect(files.some((file) => file.includes("/.hidden"))).toBe(false);
    expect(files.some((file) => file.includes("/.cache/"))).toBe(false);
    expect(files.some((file) => file.includes("/node_modules/"))).toBe(false);
  });

  it("skips a dot entry and node_modules only below the directory it starts from", async () => {
    expect(await walk(join(SOURCE, "node_modules"))).toEqual([
      join(SOURCE, "node_modules", "trap", "index.ts"),
    ]);
  });
});

describe("scan", () => {
  it("lists every file it imported", async () => {
    const found = await scan(SOURCE);
    expect(found.files).toEqual(FILES);
  });

  it("keeps the default exports that are endpoints, in file order", async () => {
    const found = await scan(SOURCE);
    expect(found.endpoints.map((endpoint) => endpoint.file)).toEqual([
      join(SOURCE, "health.ts"),
      join(SOURCE, "users/create.ts"),
      join(SOURCE, "users/get.ts"),
    ]);
    expect(
      found.endpoints.map(
        ({ definition }) => `${definition.method} ${definition.route}`,
      ),
    ).toEqual(["GET /health", "POST /users", "GET /users/{id}"]);
    for (const { definition } of found.endpoints) {
      expect(isEndpoint({ [DEFINITION]: definition })).toBe(true);
      expect(definition.handler).toBeTypeOf("function");
    }
  });

  it("keeps the default exports that are service classes", async () => {
    const found = await scan(SOURCE);
    expect(found.services.map((service) => service.file)).toEqual([
      join(SOURCE, "services/clock.ts"),
    ]);
    expect(isService(found.services[0]?.service)).toBe(true);
    expect(found.services[0]?.service.name).toBe("Clock");
  });

  it("ignores a module with no default export and one that exports a plain value", async () => {
    const found = await scan(SOURCE);
    const kept = [...found.endpoints, ...found.services].map(
      (item) => item.file,
    );
    expect(kept).not.toContain(join(SOURCE, "helpers.ts"));
    expect(kept).not.toContain(join(SOURCE, "config.ts"));
    expect(kept).not.toContain(join(SOURCE, "version.mjs"));
  });

  it("lets an error a module throws reach the caller", async () => {
    await expect(scan(join(SOURCE, "node_modules"))).rejects.toThrow(
      "the scan imported a file under node_modules",
    );
  });
});
