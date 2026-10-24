/**
 * Thrown when no config file exists at the path of the build. `path` holds the
 * path that the build checked.
 */
export class MissingConfigError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(`@open-apiary/kit: no config file at ${path}`);
    this.name = "MissingConfigError";
    this.path = path;
  }
}

/**
 * Thrown when a config file loads but its default export is not a config.
 * `path` holds the path of the file.
 */
export class MalformedConfigError extends Error {
  readonly path: string;

  constructor(path: string) {
    super(
      `@open-apiary/kit: ${path} must default-export a config (defineConfig({ source }))`,
    );
    this.name = "MalformedConfigError";
    this.path = path;
  }
}

/**
 * Thrown when a config breaks a rule of the kit. Examples are a source that
 * is not a directory, an output directory outside the project root, and a
 * security scheme that the components do not declare. `issues` holds every
 * issue found.
 */
export class InvalidConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    const lines = issues.map((issue) => `  ${issue}`).join("\n");
    super(`@open-apiary/kit: the config is invalid —\n${lines}`);
    this.name = "InvalidConfigError";
    this.issues = issues;
  }
}

/**
 * Thrown when the source breaks a rule of the kit. Examples are an endpoint
 * with no handler, two endpoints on one method and route, a `path` validator
 * that does not match the parameters of the route, two endpoints with one
 * operation id, two services with one id, and a validator with no JSON
 * Schema form. `issues` holds every issue found. Each issue names the file.
 */
export class InvalidSourceError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    const lines = issues.map((issue) => `  ${issue}`).join("\n");
    super(`@open-apiary/kit: the source is invalid —\n${lines}`);
    this.name = "InvalidSourceError";
    this.issues = issues;
  }
}
