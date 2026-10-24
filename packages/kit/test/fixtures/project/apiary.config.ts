import type { KitConfig } from "../../../src/types";

/** The build of the fixture project. The scopes of an endpoint bind to `bearer`. */
export default {
  source: "./src",
  security: "bearer",
  openapi: {
    info: { title: "Fixture API" },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: {
        bearer: { type: "http", scheme: "bearer" },
      },
    },
  },
} satisfies KitConfig;
