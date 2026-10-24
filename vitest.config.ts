import { defineConfig } from "vitest/config";

/**
 * The root vitest config. Each package has its own `vitest.config.ts`. This
 * config lists them as projects for a root `vitest` run. `pnpm test` runs the
 * packages in parallel.
 */
export default defineConfig({
  test: {
    projects: [
      "packages/*/vitest.config.ts",
      "integrations/*/vitest.config.ts",
      "examples/*/vitest.config.ts",
    ],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: ".coverage",
      include: [
        "packages/*/src/**/*.{ts,vue}",
        "integrations/*/src/**/*.{ts,vue}",
      ],
    },
  },
});
