import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["./src/module.ts"],
      outDir: ".dist",
      rolldown: { external: ["@nuxt/schema"] },
    },
  ],
});
