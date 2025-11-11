import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("ensureActivityTypeColumn", () => {
  let queryMock: jest.Mock;
  let DatabaseStorage: typeof import("../storage").DatabaseStorage;
  const ORIGINAL_DB_URL = process.env.DATABASE_URL;
  let restoreQuery: (() => void) | null = null;

  beforeEach(async () => {
    jest.resetModules();
    queryMock = jest.fn();
    process.env.DATABASE_URL = process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

    const dbModule = await import("../db");
    const querySpy = jest.spyOn(dbModule, "query").mockImplementation(queryMock);
    restoreQuery = () => querySpy.mockRestore();

    ({ DatabaseStorage } = await import("../storage"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.DATABASE_URL = ORIGINAL_DB_URL;
    restoreQuery?.();
    restoreQuery = null;
  });

  it("sets enum defaults when the column uses a user-defined type", async () => {
    queryMock.mockImplementation(async (sql: unknown) => {
      if (typeof sql === "string" && sql.includes("SELECT data_type, udt_name")) {
        return { rows: [{ data_type: "USER-DEFINED", udt_name: "activity_type" }] };
      }

      return { rows: [] };
    });

    const storage = new DatabaseStorage();
    await (storage as any).ensureActivityTypeColumn();

    const defaultCall = queryMock.mock.calls.find(([sql]) =>
      typeof sql === "string" && sql.includes("ALTER TABLE activities ALTER COLUMN type SET DEFAULT"),
    );
    expect(defaultCall?.[0]).toContain("'SCHEDULED'::activity_type");

    const updateCall = queryMock.mock.calls.find(([sql]) =>
      typeof sql === "string" && sql.includes("UPDATE activities SET type"),
    );
    expect(updateCall?.[0]).toContain("'SCHEDULED'::activity_type");
  });

  it("cleans blank string values for text columns", async () => {
    queryMock.mockImplementation(async (sql: unknown) => {
      if (typeof sql === "string" && sql.includes("SELECT data_type, udt_name")) {
        return { rows: [{ data_type: "text", udt_name: null }] };
      }

      return { rows: [] };
    });

    const storage = new DatabaseStorage();
    await (storage as any).ensureActivityTypeColumn();

    const updateCall = queryMock.mock.calls.find(([sql]) =>
      typeof sql === "string" && sql.includes("UPDATE activities SET type"),
    );
    expect(updateCall?.[0]).toContain("TRIM(type) = ''");
  });
});

