import type { EventHandler } from "h3";

import { defineEventHandler } from "h3";

import { useApiary } from "./instance";

/** Serves the OpenAPI document of the bundle. */
const handler: EventHandler = defineEventHandler(() => useApiary().openapi);

export default handler;
