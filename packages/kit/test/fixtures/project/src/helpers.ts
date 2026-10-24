import { z } from "zod";

/** A module with no default export. The scan imports it and ignores it. */
export const User = z.object({
  id: z.uuid(),
  name: z.string().min(1),
});

export type User = z.output<typeof User>;

/** The body of an error response. */
export const Problem = z.object({
  error: z.string(),
  message: z.string(),
});
