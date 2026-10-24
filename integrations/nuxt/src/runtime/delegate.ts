import type { EventHandler, H3Event } from "h3";
import type { Caller } from "open-apiary";

import {
  createError,
  defineEventHandler,
  getQuery,
  getRequestHeaders,
  getRequestURL,
  readBody,
  setResponseStatus,
} from "h3";
import { ApiaryError } from "open-apiary";

import { base } from "#open-apiary/options";

import { useApiary } from "./instance";

/** The methods that carry a body. */
const WITH_BODY = new Set(["POST", "PUT", "PATCH"]);

/** The caller with no scopes, for a request that no middleware describes. */
const ANONYMOUS: Caller = { scopes: [] };

/**
 * Returns the caller of a request: `event.context.apiary.caller` when a
 * middleware set it, else the anonymous caller.
 */
export const callerOf = (event: H3Event): Caller => {
  const context = event.context as { apiary?: { caller?: Caller } };
  return context.apiary?.caller ?? ANONYMOUS;
};

/** The path of a request under `base`. The root is `/`. */
export const pathOf = (event: H3Event): string => {
  const { pathname } = getRequestURL(event);
  const rest = pathname.startsWith(base)
    ? pathname.slice(base.length)
    : pathname;
  return rest === "" ? "/" : rest;
};

/**
 * Delegates a request to the service. The handler matches the method and the
 * path against the registry, reads the parts of the request, and invokes the
 * endpoint. A match failure is a 404. An `ApiaryError` becomes a response
 * with its status and body. Any other error propagates to Nitro.
 */
const handler: EventHandler = defineEventHandler(async (event) => {
  const api = useApiary();
  const method = event.method.toUpperCase();
  const matched = api.registry.match(method, pathOf(event));
  if (matched === undefined) {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }

  const raw = {
    path: matched.params,
    query: getQuery(event),
    headers: getRequestHeaders(event),
    body: WITH_BODY.has(method) ? await readBody(event) : undefined,
  };

  try {
    const { status, body } = await api.invoke(matched.id, raw, callerOf(event));
    setResponseStatus(event, status);
    return body;
  } catch (error) {
    if (error instanceof ApiaryError) {
      setResponseStatus(event, error.status);
      return error.body ?? { error: error.message };
    }
    throw error;
  }
});

export default handler;
