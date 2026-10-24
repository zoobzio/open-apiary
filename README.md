# open-apiary

open-apiary is a toolkit for a headless API service. You write endpoints
and services as TypeScript modules. A build kit turns them into a bundle
with an OpenAPI document. A runtime service runs the bundle: it checks the
scopes, validates the input and the output, and resolves the services. A
framework integration maps HTTP onto it.

This repo contains the authoring library, the runtime, the build kit, a
Nuxt module, and an example API package.

## Anatomy

An endpoint is the default export of a module. The route, the validators,
and the output validator are the arguments. The handler and the metadata are
method calls:

```ts
import { apiary } from "open-apiary";
import { z } from "zod";

import { User } from "../schemas";
import Users from "../services/users";

export default apiary
  .GET("/users/{id}", { path: z.object({ id: z.uuid() }) }, User)
  .handle((ctx, input) => ctx.use(Users).find(input.path.id))
  .withScopes("users:read")
  .withTags("users")
  .withSpec({ summary: "Get a user" });
```

A service is the default export of a module too. It extends `Service`. A
handler gets one with `ctx.use(TheClass)`. A service gets another with
`this.use(TheClass)`. A `singleton` is made at start. A `scoped` service is
made for one call:

```ts
import { Service } from "open-apiary";

import Clock from "./clock";

export default class Users extends Service {
  private readonly clock = this.use(Clock);
  find(id: string) {
    /* ... */
  }
}
```

The folder structure means nothing. `apiary.config.ts` names the source
directory, and the kit imports every module under it:

```ts
import { defineConfig } from "@open-apiary/kit";

export default defineConfig({
  source: "./src",
  outDir: ".dist",
  security: "bearer",
  openapi: {
    info: { title: "Example API" },
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
    },
  },
});
```

```sh
apiary build
```

The build writes `index.mjs`, `index.d.mts`, and `openapi.json`. The default
export of the module is the bundle. The runtime takes it:

```ts
import bundle from "@acme/api";
import { makeApiary } from "open-apiary";

const api = makeApiary(bundle);
await api.start();

const { status, body } = await api.invoke(
  "getUsersById",
  { path: { id } },
  { scopes: ["users:read"] },
);
```

`invoke` checks the scopes of the caller, parses each part of the input,
runs the handler, and parses the output. Each failure is an `ApiaryError`
with a status. The body is typed from the output validator. The service
does no HTTP. The Nuxt module does:

```ts
export default defineNuxtConfig({
  modules: ["@open-apiary/nuxt"],
  openApiary: { package: "@acme/api", base: "/api" },
});
```

It serves `/api/openapi.json`, `/api/docs` with Scalar, and delegates
`/api/**` to the service.

## Workspace

| Directory                        | Contents                                                         |
| -------------------------------- | ---------------------------------------------------------------- |
| [`packages`](./packages)         | The authoring library, the runtime, the build kit, and the mocks |
| [`integrations`](./integrations) | The Nuxt module                                                  |
| [`examples`](./examples)         | An API package that the kit builds                               |

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

## License

MIT
