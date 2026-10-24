# @open-apiary/testing

Mocks for tests of an API package or of an integration.

## Install

```sh
pnpm add -D @open-apiary/testing
```

## Usage

```ts
import { bootApiary, mockBundle, mockCaller } from "@open-apiary/testing";

const bundle = mockBundle({ getHealth: health }, { services: [Clock] });
const api = await bootApiary(bundle);

const { body } = await api.invoke("getHealth", {}, mockCaller(["system:read"]));

await api.stop();
```

- `mockBundle(endpoints, { services, openapi })` makes a bundle by hand, as
  `apiary build` would write it, less the inferred document.
- `mockCaller(scopes, rest)` makes a caller.
- `bootApiary(bundle, options)` makes a service and starts it.
