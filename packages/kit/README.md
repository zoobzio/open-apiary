# @open-apiary/kit

The build kit. `apiary build` reads `apiary.config.ts`, imports every module
under the source directory, keeps the endpoints and the services, derives
the OpenAPI document, and bundles a module that exports them.

## Install

```sh
pnpm add -D @open-apiary/kit
```

## Usage

```ts
// apiary.config.ts
import { defineConfig } from "@open-apiary/kit";

export default defineConfig({
  source: "./src",
  outDir: ".dist",
  security: "bearer",
  openapi: {
    info: { title: "Example API" },
    servers: [{ url: "/api" }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    },
  },
});
```

```sh
apiary build
```

- `source` is the directory to scan. The kit imports every `.ts`, `.mts`,
  `.js`, and `.mjs` file under it through jiti. A default export that is an
  endpoint or a service class joins the bundle. Every other file is
  ignored. The structure of the directory means nothing.
- `outDir` is where the build writes. The kit owns it and empties it first.
  The default is `.dist`.
- `openapi` sets parts of the document. It merges last, so each member
  wins. `info` defaults to the name and the version of the `package.json`.
- `security` names the scheme that scopes bind to. An endpoint with scopes
  requires it. The scheme must be in `openapi.components.securitySchemes`.

The build writes:

- `index.mjs`, the bundle. Its default export is `{ endpoints, services, openapi }`.
  `endpoints` is keyed by operation id. The dependencies of the package
  stay external.
- `index.d.mts`, with the type of each endpoint, so `invoke` is typed.
- `openapi.json`, the document.

The generated entry module is at `.apiary/index.ts`. Add `.apiary` to
`.gitignore`.

## Rules

The build fails with `InvalidSourceError` when:

- an endpoint has no handler;
- two endpoints share a method and a route;
- the `path` validator does not match the parameters of the route;
- two endpoints share an operation id;
- an endpoint has scopes and the config has no `security`;
- two services share an id;
- a validator has no JSON Schema form.

The operation id is derived from the method and the route: `GET /users/{id}`
is `getUsersById`. `withSpec({ operationId })` replaces it.

## API

`generate(config, { cwd })` runs the scan and the validation and returns
the endpoints, the services, and the document. It writes nothing.
`build({ root, config })` runs the whole build. `derive`, `entry`,
`identify`, `scan`, `validateConfig`, and `validateSource` are the steps.
