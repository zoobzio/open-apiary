import type { AnyDefinition, ServiceClass } from "@open-apiary/schema";

/**
 * The parts of an OpenAPI document that a config sets. The kit merges the
 * object over the document that it infers, so each member here wins. Objects
 * merge by key. An array replaces the inferred one.
 */
export interface OpenApiConfig {
  info?: { title?: string; version?: string; [key: string]: unknown };
  servers?: Record<string, unknown>[];
  tags?: Record<string, unknown>[];
  components?: {
    securitySchemes?: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * The authored `apiary.config.ts`. It sets where the source lives, where the
 * build writes, and what the OpenAPI document says beyond what the kit
 * infers.
 */
export interface KitConfig {
  /**
   * The directory of the source, relative to the project root. The kit
   * imports every `.ts`, `.mts`, `.js`, and `.mjs` file under it. A file
   * whose default export is an endpoint or a service class joins the bundle.
   * Every other file is ignored. The structure of the directory means
   * nothing.
   */
  source: string;

  /**
   * The output directory, relative to the project root. The kit owns it: a
   * build empties it first. Defaults to `.dist`.
   */
  outDir?: string;

  /**
   * The parts of the OpenAPI document to set. `info` defaults to the name
   * and the version of the `package.json` of the project root.
   */
  openapi?: OpenApiConfig;

  /**
   * The security scheme that the scopes of an endpoint bind to. The name is a
   * key of `openapi.components.securitySchemes`. An endpoint with scopes
   * requires it. The kit lists the scopes of each endpoint under that scheme
   * in the `security` of its operation.
   */
  security?: string;
}

/** One endpoint that the scan found. */
export interface FoundEndpoint {
  /** The absolute path of the file. */
  file: string;

  /** The definition of the endpoint. */
  definition: AnyDefinition;
}

/** One service that the scan found. */
export interface FoundService {
  /** The absolute path of the file. */
  file: string;

  /** The service class. */
  service: ServiceClass;
}

/** What the scan found in the source. */
export interface Found {
  endpoints: FoundEndpoint[];
  services: FoundService[];

  /** The absolute path of every file that the scan imported. */
  files: string[];
}

/** An endpoint with its operation id, after validation. */
export interface Identified extends FoundEndpoint {
  id: string;
}

/**
 * The validated form of a build. The emitters read it. A consumer that holds
 * the endpoints and the services of a bundle, such as a framework module,
 * can build one and emit the same modules that the CLI writes.
 */
export interface Kit {
  /** The endpoints, in id order. */
  endpoints: Identified[];

  /** The services, in file order. */
  services: FoundService[];

  /** The OpenAPI document. */
  openapi: Record<string, unknown>;

  /** The absolute project root. */
  root: string;

  /** The output directory, normalized and relative to the project root. */
  outDir: string;

  /** The absolute path of every source file that the scan imported. */
  files: string[];
}

/** The options of {@link generate}: the project root and the identity of the project. */
export interface GenerateOptions {
  /** The project root. The source and the output directory resolve from it. Defaults to the working directory. */
  cwd?: string;

  /** The name of the project, for the default `info.title`. */
  name?: string;

  /** The version of the project, for the default `info.version`. */
  version?: string;
}

/** The options of {@link build}: the project root and the config file. */
export interface BuildOptions {
  /** The project root. Defaults to the working directory. */
  root?: string;

  /** The config file, relative to the root. Defaults to `apiary.config.ts`. */
  config?: string;
}

/** What {@link build} wrote. */
export interface Output {
  /** The output directory, relative to the project root. */
  outDir: string;

  /** The paths of the files, relative to the output directory. */
  files: string[];
}
