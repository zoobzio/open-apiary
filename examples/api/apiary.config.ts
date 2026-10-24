import { defineConfig } from "@open-apiary/kit";

/**
 * The build of the API. The kit imports every module under `src/`, takes
 * the endpoints and the services, and writes the bundle and the OpenAPI
 * document to `.dist/`. The scopes of an endpoint bind to the `bearer`
 * scheme.
 */
export default defineConfig({
  source: "./src",
  outDir: ".dist",
  security: "bearer",
  openapi: {
    info: {
      title: "Example API",
      description: "A small user directory over open-apiary.",
    },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer" },
      },
    },
  },
});
