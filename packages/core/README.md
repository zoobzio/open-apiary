# @open-apiary/core

The runtime service. `makeApiary` takes a bundle and returns a service
with a registry, a container, and `invoke`. The service does no HTTP. The
public [`open-apiary`](../open-apiary) package re-exports it.

## Install

```sh
pnpm add open-apiary zod
```

## Usage

```ts
import bundle from "@acme/api";
import { makeApiary, ApiaryError } from "open-apiary";

const api = makeApiary(bundle, {
  authorize: (caller, scopes) => scopes.every((s) => caller.scopes.includes(s)),
});
await api.start();

api.registry.list(); // [{ id, method, route, status, errors, scopes, tags }]
api.registry.match("GET", "/users/42"); // { id: "getUsersById", params: { id: "42" } }

try {
  const { status, body } = await api.invoke(
    "getUsersById",
    { path: { id: "42" }, query: {}, headers: {} },
    { scopes: ["users:read"] },
  );
} catch (error) {
  if (error instanceof ApiaryError) {
    // error.status, error.body
  }
}

api.on("invoke:end", ({ id, status, duration }) => {});
await api.stop();
```

`invoke` runs these steps:

1. It checks the scopes of the endpoint against the caller with `authorize`.
   A failure is `ForbiddenError`, status 403.
2. It parses `path`, `query`, `headers`, and `body` with the validators of
   the endpoint. A missing `path`, `query`, or `headers` is an empty object.
   A failure is `InvalidInputError`, status 400, with the issues of every
   part.
3. It runs the handler with a context: `use` for services, `caller`, and
   `endpoint`.
4. It parses the value with the output validator. A failure is
   `InvalidOutputError`, status 500.

The result is `{ status, body }`. The body is typed from the output
validator of the endpoint. An `ApiaryError` from the handler propagates as
it is.

The container makes each singleton at `start` and runs its `setup`. Each
call opens a scope for the scoped services and disposes it at the end.
`UnknownServiceError`, `CircularServiceError`, and `CaptiveServiceError`
report a `use` that cannot resolve.

The events are `invoke:start`, `invoke:end`, `invoke:error`, and
`service:create`. `on` returns a function that removes the listener.
