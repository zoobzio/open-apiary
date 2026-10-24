import { z } from "zod";

/** A user of the directory. */
export const User = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  email: z.email(),
  createdAt: z.iso.datetime(),
});

export type User = z.output<typeof User>;

/** What a request sends to make a user. */
export const NewUser = User.pick({ name: true, email: true });

/** The body of an error response. */
export const Problem = z.object({
  error: z.string(),
  message: z.string(),
});
