import { describe, it, expect } from "vitest";

import { ApiaryError } from "../src/error";

describe("ApiaryError", () => {
  it("carries the status, the message, and the body", () => {
    const body = { code: "not_found" };
    const error = new ApiaryError(404, "no such user", body);
    expect(error.status).toBe(404);
    expect(error.message).toBe("no such user");
    expect(error.body).toBe(body);
  });

  it("is named after the class", () => {
    expect(new ApiaryError(500, "boom").name).toBe("ApiaryError");
  });

  it("leaves the body undefined when the handler gives none", () => {
    expect(new ApiaryError(404, "no such user").body).toBeUndefined();
  });

  it("is an Error", () => {
    const error = new ApiaryError(404, "no such user");
    expect(error).toBeInstanceOf(Error);
    expect(error.stack).toBeDefined();
    expect(() => {
      throw error;
    }).toThrow(ApiaryError);
  });

  it("keeps instanceof through a subclass", () => {
    class NotFoundError extends ApiaryError {
      constructor(id: string) {
        super(404, `no such user: ${id}`, { code: "not_found", id });
        this.name = "NotFoundError";
      }
    }
    const error = new NotFoundError("42");
    expect(error).toBeInstanceOf(NotFoundError);
    expect(error).toBeInstanceOf(ApiaryError);
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(404);
    expect(error.body).toEqual({ code: "not_found", id: "42" });
    expect(error.name).toBe("NotFoundError");
  });
});
