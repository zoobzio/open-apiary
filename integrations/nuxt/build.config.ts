import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { defineBuildConfig } from "obuild/config";

export default defineBuildConfig({
  entries: [
    {
      type: "bundle",
      input: ["./src/module.ts", "./src/constant.ts"],
      outDir: ".dist",
      rolldown: { external: ["@nuxt/schema"] },
    },
    {
      type: "transform",
      input: "./src/runtime",
      outDir: ".dist/runtime",
      dts: (file) => !file.endsWith("plugin.ts"),
    },
  ],
  hooks: {
    end: async (ctx) => {
      const dir = join(ctx.pkgDir, ".dist/runtime");
      for (const file of await readdir(dir)) {
        if (!file.endsWith(".d.mts")) continue;
        const name = file.slice(0, -".d.mts".length);
        await writeFile(
          join(dir, `${name}.d.ts`),
          `export * from "./${name}.mjs";\n`,
        );
      }
    },
  },
});
