import type { Apiary, Bundle, Options } from "open-apiary";

import { makeApiary } from "open-apiary";

/**
 * Makes a service over a bundle and starts it. The result is ready for
 * `invoke`. Call `stop` at the end of the test.
 *
 * @param bundle - The bundle, usually from {@link mockBundle}.
 * @param options - The options of `makeApiary`.
 */
export const bootApiary = async <B extends Bundle>(
  bundle: B,
  options: Options = {},
): Promise<Apiary<B>> => {
  const api = makeApiary(bundle, options);
  await api.start();
  return api;
};
