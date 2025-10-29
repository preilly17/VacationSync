import { isUnauthorizedError } from "@/lib/authUtils";

class FakeApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

describe("isUnauthorizedError", () => {
  it("returns true for ApiError with 401 status", () => {
    const error = new FakeApiError(401, "Unauthorized");
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("returns false for ApiError with non-401 status", () => {
    const error = new FakeApiError(403, "Forbidden");
    expect(isUnauthorizedError(error)).toBe(false);
  });

  it("uses status property when available", () => {
    const error = Object.assign(new Error("Forbidden"), { status: 401 });
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("falls back to message matching", () => {
    const error = new Error("401: Unauthorized access");
    expect(isUnauthorizedError(error)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    expect(isUnauthorizedError(new Error("Something else"))).toBe(false);
    expect(isUnauthorizedError({})).toBe(false);
    expect(isUnauthorizedError(null)).toBe(false);
  });
});
