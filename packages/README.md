# Packages

| Package                             | Directory              | Description                                                                                   |
| ----------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------- |
| [`open-apiary`](./open-apiary)      | `packages/open-apiary` | The public package. It exports the authoring API and the runtime.                             |
| [`@open-apiary/schema`](./schema)   | `packages/schema`      | Defines endpoints with `apiary.GET` and services with `Service`. The types of a bundle.       |
| [`@open-apiary/core`](./core)       | `packages/core`        | Makes the runtime service over a bundle with `makeApiary`.                                    |
| [`@open-apiary/kit`](./kit)         | `packages/kit`         | Builds the source into the bundle and the OpenAPI document with `apiary build`.               |
| [`@open-apiary/testing`](./testing) | `packages/testing`     | Makes bundles and callers for tests with `mockBundle`, and boots a service with `bootApiary`. |

The framework integrations are in [`../integrations`](../integrations).
