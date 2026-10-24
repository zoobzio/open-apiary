import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** A path under `test/fixtures/`, for the virtual modules of the module. */
const fixture = (name: string): string =>
  fileURLToPath(new URL(`./test/fixtures/${name}`, import.meta.url));

export default defineConfig({
  // The runtime imports the virtual modules that the Nuxt module writes. The
  // tests point them at fixtures.
  resolve: {
    alias: {
      "#open-apiary/bundle": fixture("bundle.ts"),
      "#open-apiary/options": fixture("options.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: ".coverage",
      include: ["src/**/*.ts"],
    },
  },
});
