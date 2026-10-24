/** The config file that the CLI reads from the project root when `--config` is absent. */
export const FILENAME = "apiary.config.ts";

/** The default output directory, relative to the project root. */
export const OUT_DIR = ".dist";

/** The directory of the generated entry module, relative to the project root. */
export const ENTRY_DIR = ".apiary";

/** The name of the generated entry module. The bundle takes its name from it. */
export const ENTRY = "index.ts";

/** The OpenAPI document that a build writes beside the bundle. */
export const OPENAPI = "openapi.json";

/** The version of the OpenAPI specification that the kit writes. */
export const OPENAPI_VERSION = "3.1.0";

/** The extensions of the source files that the scan imports. */
export const EXTENSIONS = [".ts", ".mts", ".js", ".mjs"] as const;

/** The reason phrases of the statuses that a response description names. */
export const REASONS: { readonly [status: number]: string } = {
  200: "OK",
  201: "Created",
  202: "Accepted",
  204: "No Content",
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  410: "Gone",
  412: "Precondition Failed",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
};
