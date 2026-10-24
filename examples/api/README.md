# @open-apiary/example-api

An API package that `apiary build` turns into a bundle. It is a small user
directory: four endpoints over two singletons and one scoped service. It is
the shape of an API package for a product: endpoints and services as default
exports, a config that names the source, and nothing inferred from the
folders.

## Layout

```
apiary.config.ts      the kit config: the source, the output, the OpenAPI info, the security scheme
src/schemas.ts        the zod schemas that the endpoints share
src/health.ts         GET /health
src/users/list.ts     GET /users
src/users/get.ts      GET /users/{id}
src/users/create.ts   POST /users
src/users/remove.ts   DELETE /users/{id}
src/services/clock.ts the clock, a singleton
src/services/users.ts the directory, a singleton over the clock
src/services/audit.ts the audit trail, scoped to one call
```

## Build

```sh
pnpm build
```

The kit writes `.dist/index.mjs`, `.dist/index.d.mts`, and
`.dist/openapi.json`. The default export of the module is the bundle. The
Nuxt module takes the package name and mounts it:

```ts
export default defineNuxtConfig({
  modules: ["@open-apiary/nuxt"],
  openApiary: { package: "@open-apiary/example-api" },
});
```
