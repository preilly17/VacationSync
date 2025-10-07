import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

describe("activities v2 setup", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it("creates activities tables during module initialization", async () => {
    const queryMock = jest.fn().mockResolvedValue({ rows: [] });

    jest.doMock("../db", () => ({
      query: queryMock,
      pool: { connect: jest.fn() },
    }));

    await import("../activitiesV2");
    await new Promise((resolve) => setImmediate(resolve));

    expect(
      queryMock.mock.calls.some(([sql]) =>
        typeof sql === "string" && sql.includes("CREATE TABLE IF NOT EXISTS activities_v2"),
      ),
    ).toBe(true);
    expect(
      queryMock.mock.calls.every(([sql]) => typeof sql !== "string" || !sql.includes("CREATE EXTENSION")),
    ).toBe(true);
  });
});
