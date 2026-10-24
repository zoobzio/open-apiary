# @open-apiary/schema

The authoring API: the endpoint builder, the service base class, the error,
and the types of a bundle. The package has no runtime of its own. The
public [`open-apiary`](../open-apiary) package re-exports it.

## Install

```sh
pnpm add open-apiary zod
```

## Endpoints

`apiary` has one function for each method: `GET`, `POST`, `PUT`, `PATCH`,
and `DELETE`. Each takes the route, the validators of the input, and the
validator of the output. The route is an OpenAPI path. A `path` validator
has one member for each parameter of the route. `GET` and `DELETE` take no
`body`.

```ts
import { apiary, ApiaryError } from "open-apiary";
import { z } from "zod";

export default apiary
  .POST("/users", { body: NewUser }, User)
  .handle(async (ctx, input) => ctx.use(Users).create(input.body))
  .withStatus(201)
  .withErrors({ 409: Problem })
  .withScopes("users:write")
  .withTags("users")
  .withSpec({ summary: "Create a user" });
```

- `handle` sets the handler. It receives the context and the parsed input.
  It returns a value that the output validator accepts. The types follow
  the validators.
- `withScopes` sets the scopes a caller needs. The core checks them. The
  kit lists them under `security`.
- `withStatus` sets the success status. The default is 200, and 201 for
  `POST`.
- `withErrors` declares the error bodies by status, for the document. A
  handler throws `new ApiaryError(status, message, body)`.
- `withTags` and `withSpec` extend the OpenAPI operation. `withSpec` merges
  over what the kit infers. `operationId` replaces the derived id.

Each method returns a new endpoint. The definition is under the
`DEFINITION` symbol. `isEndpoint` tests for it.

## Services

```ts
import { Service } from "open-apiary";

export default class Audit extends Service {
  static override readonly lifetime = "scoped";
  static override readonly id = "audit";

  private readonly clock = this.use(Clock);

  override async setup() {}
  override async dispose() {}
}
```

- `lifetime` is `singleton` or `scoped`. A singleton is made once, at
  start. A scoped service is made for one call and disposed after it. A
  singleton cannot use a scoped service.
- `id` names the service. The default is the class name. Set it when a
  bundle is minified.
- `use` resolves another service. The class is the key and the type.
- `setup` runs for each singleton at start, in dependency order. `dispose`
  runs at stop, and at the end of the call for a scoped service.

`isService`, `serviceId`, and `serviceLifetime` read a class.
