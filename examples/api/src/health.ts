import { apiary } from "open-apiary";
import { z } from "zod";

import Clock from "./services/clock";

/** Reports that the API is up, with the time of the server. */
export default apiary
  .GET("/health", {}, z.object({ ok: z.literal(true), time: z.iso.datetime() }))
  .handle((ctx) => ({ ok: true, time: ctx.use(Clock).now().toISOString() }))
  .withTags("system")
  .withSpec({ summary: "Health check" });
