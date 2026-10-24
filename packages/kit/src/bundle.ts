import type { Kit } from "./types";

import { join } from "node:path";

import { build as obuild } from "obuild";

import { entryPath } from "./emit";

/**
 * Bundles the entry module with obuild, which runs rolldown. The bundle is
 * `index.mjs` under the output directory, with `index.d.mts` beside it. The
 * dependencies of the `package.json` of the project stay external, so the
 * bundle imports `open-apiary` and `zod` at runtime. Every other import is
 * bundled. The input is named `index`, so the output takes that name and not
 * the path of the entry module.
 *
 * @param kit - The validated build.
 */
export const bundle = async (kit: Kit): Promise<void> => {
  await obuild({
    cwd: kit.root,
    entries: [
      {
        type: "bundle",
        input: entryPath(),
        outDir: kit.outDir,
        dts: true,
        license: false,
      },
    ],
    hooks: {
      // obuild names the output after the path of the input. The hook sets
      // the one input under the name `index`, so the output is `index.mjs`.
      rolldownConfig: (config) => {
        config.input = { index: join(kit.root, entryPath()) };
      },
    },
  });
};
