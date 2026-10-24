import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { MalformedConfigError, MissingConfigError } from "../src/error";
import { loadConfig } from "../src/load";
import { FIXTURES } from "./helpers";

/** The absolute path of a config fixture. */
const at = (name: string): string =>
  fileURLToPath(new URL(`configs/${name}`, FIXTURES));

describe("loadConfig", () => {
  it("loads the default export of a TypeScript config", async () => {
    await expect(loadConfig(at("valid.config.ts"))).resolves.toEqual({
      source: "./src",
      outDir: "out",
      security: "bearer",
      openapi: {
        info: { title: "Loaded" },
        components: {
          securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
        },
      },
    });
  });

  it("throws when there is no file", async () => {
    const path = at("absent.config.ts");
    const error = await loadConfig(path).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MissingConfigError);
    expect((error as MissingConfigError).path).toBe(path);
  });

  it("throws when the default export has no source", async () => {
    const path = at("malformed.config.ts");
    const error = await loadConfig(path).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MalformedConfigError);
    expect((error as MalformedConfigError).path).toBe(path);
  });

  it("lets an error the file throws reach the caller", async () => {
    await expect(loadConfig(at("throws.config.ts"))).rejects.toThrow(
      "the config exploded",
    );
  });
});
