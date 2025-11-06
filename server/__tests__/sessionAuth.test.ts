import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe("buildSessionOptions", () => {
  it("forces secure cookies when SameSite=None in production", async () => {
    process.env.NODE_ENV = "production";
    delete process.env.SESSION_COOKIE_SECURE;
    delete process.env.SESSION_COOKIE_SAMESITE;

    const warnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { __testables__ } = await import("../sessionAuth");
    const options = __testables__.buildSessionOptions();

    expect(options.cookie?.sameSite).toBe("none");
    expect(options.cookie?.secure).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      "⚠️ SameSite=None cookies require the Secure attribute; forcing secure cookies to keep authentication working on modern browsers.",
    );

    warnSpy.mockRestore();
  });

  it("falls back to lax when SameSite=None is requested without secure cookies", async () => {
    process.env.NODE_ENV = "production";
    process.env.SESSION_COOKIE_SECURE = "false";
    process.env.SESSION_COOKIE_SAMESITE = "none";

    const warnSpy = jest
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { __testables__ } = await import("../sessionAuth");
    const options = __testables__.buildSessionOptions();

    expect(options.cookie?.sameSite).toBe("lax");
    expect(options.cookie?.secure).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "⚠️ SESSION_COOKIE_SAMESITE was set to \"none\" but secure cookies are disabled; falling back to \"lax\" to satisfy browser requirements.",
    );

    warnSpy.mockRestore();
  });
});
