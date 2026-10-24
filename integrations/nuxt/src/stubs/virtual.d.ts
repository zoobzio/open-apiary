// Type stubs for the virtual modules that the Nuxt module writes.
declare module "#open-apiary/bundle" {
  import type { Bundle } from "open-apiary";

  const bundle: Bundle;
  export default bundle;
}

declare module "#open-apiary/options" {
  export const base: string;
}
