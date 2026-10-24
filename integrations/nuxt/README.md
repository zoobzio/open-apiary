# @open-apiary/nuxt

The Nuxt module for open-apiary. It mounts a bundle that `apiary build`
produced.

## Install

```sh
pnpm add @open-apiary/nuxt open-apiary @acme/api
```

## Setup

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@open-apiary/nuxt"],
  openApiary: { package: "@acme/api", base: "/api" },
});
```

- `package` names the package whose default export is the bundle.
- `base` is the path the API mounts at. The default is `/api`.

The module adds a server plugin and three handlers:

- The plugin makes the service at start and stops it at close.
- `GET <base>/openapi.json` serves the document of the bundle.
- `GET <base>/docs` serves a Scalar page over it.
- `<base>/**` delegates to the service. It matches the route, reads the
  path parameters, the query, the headers, and the body, and invokes the
  endpoint. An `ApiaryError` becomes a response with its status and body.

## The caller

The delegate reads the caller from `event.context.apiary.caller`. A server
middleware sets it from the request:

```ts
// server/middleware/auth.ts
export default defineEventHandler((event) => {
  const token = getHeader(event, "authorization");
  event.context.apiary = {
    caller: { scopes: scopesOf(token), subject: subjectOf(token) },
  };
});
```

Without a middleware, the caller has no scopes, and an endpoint with scopes
answers 403.
