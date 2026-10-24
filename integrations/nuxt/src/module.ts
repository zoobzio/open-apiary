import type { NuxtModule } from "@nuxt/schema";

import { defineNuxtModule } from "@nuxt/kit";

export type ModuleOptions = Record<string, never>;

const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: { name: "@open-apiary/nuxt", configKey: "openApiary" },
  defaults: {},
  setup() {},
});

export default module;
