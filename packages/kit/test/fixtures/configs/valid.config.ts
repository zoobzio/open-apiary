/** A config in TypeScript, to prove jiti transpiles the file before it loads. */
const source: string = "./src";

export default {
  source,
  outDir: "out",
  security: "bearer",
  openapi: {
    info: { title: "Loaded" },
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    },
  },
};
