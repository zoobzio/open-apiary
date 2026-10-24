import type { NitroAppPlugin } from "nitropack/types";

import { makeApiary } from "open-apiary";

import bundle from "#open-apiary/bundle";

import { setApiary } from "./instance";

/**
 * The server plugin. It makes the service over the bundle, starts it, and
 * stops it when the server closes.
 */
const plugin: NitroAppPlugin = async (nitroApp) => {
  const api = makeApiary(bundle);
  await api.start();
  setApiary(api);
  nitroApp.hooks.hook("close", async () => {
    setApiary(undefined);
    await api.stop();
  });
};

export default plugin;
