/**
 * The error that an endpoint answers with. A handler throws one to end the
 * call with a status other than the success status. `status` is the HTTP
 * status. `body` is the response body, when the handler gives one. The
 * framework sends both. The core throws subclasses of it for an input that
 * fails its validator, for a caller without the scopes, and for an output
 * that fails its validator.
 *
 * ```ts
 * throw new ApiaryError(404, "no such user", { code: "not_found" });
 * ```
 */
export class ApiaryError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiaryError";
    this.status = status;
    this.body = body;
  }
}
