import { z } from "zod";

/* The output validator that the endpoints of the tests answer with. */
export const User = z.object({ id: z.string(), name: z.string() });

/* The path validator of a route with one `id` parameter. */
export const Id = z.object({ id: z.string() });

/* The error body that the endpoints of the tests declare. */
export const NotFound = z.object({ code: z.literal("not_found") });
