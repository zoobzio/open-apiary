import type { AnyEndpoint, Bundle, Caller, ServiceClass } from "open-apiary";

/** The options of {@link mockBundle}: the services and the OpenAPI document. */
export interface BundleOptions {
  /** The service classes. Defaults to none. */
  services?: readonly ServiceClass[];

  /** The OpenAPI document. Defaults to an empty document. */
  openapi?: Record<string, unknown>;
}

/**
 * Makes a bundle by hand, with no build. A test writes the endpoints by
 * operation id and names the services. The result is what `apiary build`
 * would write, less the inferred OpenAPI document.
 *
 * ```ts
 * const bundle = mockBundle({ getHealth: health }, { services: [Clock] });
 * ```
 *
 * @param endpoints - The endpoints by operation id.
 * @param options - The services and the document.
 */
export const mockBundle = <E extends { readonly [id: string]: AnyEndpoint }>(
  endpoints: E,
  options: BundleOptions = {},
): Bundle<E> => {
  return {
    endpoints,
    services: options.services ?? [],
    openapi: options.openapi ?? { openapi: "3.1.0", paths: {} },
  };
};

/**
 * Makes a caller with scopes. The other members are for the handler.
 *
 * @param scopes - The scopes of the caller. Defaults to none.
 * @param rest - Any other member.
 */
export const mockCaller = (
  scopes: readonly string[] = [],
  rest: Record<string, unknown> = {},
): Caller => {
  return { ...rest, scopes };
};
