import type { NuxtModule } from "@nuxt/schema";

import {
  addServerHandler,
  addServerPlugin,
  addServerTemplate,
  createResolver,
  defineNuxtModule,
} from "@nuxt/kit";

import { BUNDLE, OPTIONS } from "./constant";

/**
 * The options of the Nuxt module.
 *
 * - `package` names the package that `apiary build` produced. Its default
 *   export is the bundle. The module imports it in the server build.
 * - `base` is the path that the API mounts at. Defaults to `/api`.
 *
 * ```ts
 * export default defineNuxtConfig({
 *   modules: ["@open-apiary/nuxt"],
 *   openApiary: { package: "@acme/api", base: "/api" },
 * });
 * ```
 */
export interface ModuleOptions {
  package?: string;
  base?: string;
}

/** Normalizes a base path: one leading slash, no trailing slash, `""` for the root. */
export const normalizeBase = (base: string): string => {
  const trimmed = base.trim().replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "" : `/${trimmed}`;
};

/**
 * The Nuxt module for open-apiary. The module mounts a bundle under `base`.
 * The server plugin makes the service at start and stops it at close. Three
 * handlers serve the API:
 *
 * - `GET <base>/openapi.json` is the OpenAPI document of the bundle.
 * - `GET <base>/docs` is a Scalar page over the document.
 * - `<base>/**` delegates to the service: it matches the route, reads the
 *   parts of the request, and sends the result or the error.
 *
 * The caller comes from `event.context.apiary.caller`. A server middleware
 * sets it from the request. Without one, the caller has no scopes.
 */
const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: { name: "@open-apiary/nuxt", configKey: "openApiary" },
  defaults: { base: "/api" },
  setup: (options) => {
    if (typeof options.package !== "string" || options.package === "") {
      throw new Error(
        "@open-apiary/nuxt: `package` names the package that `apiary build` produced",
      );
    }
    const resolver = createResolver(import.meta.url);
    const base = normalizeBase(options.base ?? "/api");
    const pkg = options.package;

    addServerTemplate({
      filename: BUNDLE,
      getContents: () => `export { default } from ${JSON.stringify(pkg)};\n`,
    });
    addServerTemplate({
      filename: OPTIONS,
      getContents: () => `export const base = ${JSON.stringify(base)};\n`,
    });

    addServerPlugin(resolver.resolve("./runtime/plugin"));

    addServerHandler({
      route: `${base}/openapi.json`,
      method: "get",
      handler: resolver.resolve("./runtime/openapi"),
    });
    addServerHandler({
      route: `${base}/docs`,
      method: "get",
      handler: resolver.resolve("./runtime/docs"),
    });
    addServerHandler({
      route: `${base}/**`,
      handler: resolver.resolve("./runtime/delegate"),
    });
  },
});

export default module;
