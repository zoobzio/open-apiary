import { parseArgs } from "node:util";

import { build } from "./build";

const HELP = `Usage: apiary build [options]

Builds the API apiary.config.ts points at: scans the source for endpoints
and services, writes the bundle and the OpenAPI document to the output
directory.

Options:
  -c, --config <file>  Config file (default: apiary.config.ts)
  -r, --root <dir>     Project root (default: current directory)
  -h, --help           Show this help`;

const main = async (argv: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      config: { type: "string", short: "c" },
      root: { type: "string", short: "r" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(HELP);
    return;
  }
  if (positionals.length !== 1 || positionals[0] !== "build") {
    console.error(HELP);
    process.exitCode = 1;
    return;
  }

  const output = await build({ config: values.config, root: values.root });
  console.log(
    `@open-apiary/kit: wrote ${output.files.length} files to ${output.outDir}`,
  );
};

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
