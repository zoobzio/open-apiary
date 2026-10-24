import type { EventHandler } from "h3";

import { defineEventHandler, setHeader } from "h3";

import { base } from "#open-apiary/options";

/** The Scalar page over the document. The script loads from the CDN of Scalar. */
export const page = (url: string): string => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API Reference</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference("#app", { url: ${JSON.stringify(url)} });
    </script>
  </body>
</html>
`;

/** Serves the Scalar page, pointed at the document under `base`. */
const handler: EventHandler = defineEventHandler((event) => {
  setHeader(event, "content-type", "text/html; charset=utf-8");
  return page(`${base}/openapi.json`);
});

export default handler;
