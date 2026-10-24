# open-apiary

The public package. It exports the authoring API of
[`@open-apiary/schema`](../schema) and the runtime of
[`@open-apiary/core`](../core). An API package depends on it. A framework
integration depends on it.

## Install

```sh
pnpm add open-apiary zod
```

## Usage

```ts
import { apiary, Service, ApiaryError, makeApiary } from "open-apiary";
```

See the [root README](../../README.md) for the whole flow.
