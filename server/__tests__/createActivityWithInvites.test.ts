import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import type { InsertActivity } from "@shared/schema";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

const queryMock = jest.fn();

let storage: typeof import("../storage")["storage"];
let dbQuerySpy: jest.SpiedFunction<typeof import("../db")["query"]>;
let connectSpy: jest.SpiedFunction<typeof import("../db")["pool"]["connect"]>;
let releaseMock: jest.Mock;

beforeAll(async () => {
  jest.resetModules();
  const dbModule: any = await import("../db");
  releaseMock = jest.fn();
  dbQuerySpy = jest.spyOn(dbModule, "query").mockImplementation(queryMock as any);
  connectSpy = jest
    .spyOn(dbModule.pool, "connect")
    .mockImplementation(async () => ({
      query: queryMock,
      release: releaseMock,
    }));
  const storageModule: any = await import("../storage");
  storage = storageModule.storage;
});

beforeEach(() => {
  queryMock.mockReset();
  releaseMock = jest.fn();
  dbQuerySpy.mockImplementation(queryMock as any);
  connectSpy.mockImplementation(async () => ({
    query: queryMock,
    release: releaseMock,
  }));
  (storage as any).activityTypeColumnInitialized = true;
  (storage as any).activityInvitesInitialized = true;
});

describe("createActivityWithInvites", () => {
  it("rolls back the activity creation when invite persistence fails", async () => {
    const error = new Error("failed to persist invites");

    const activityInput: InsertActivity = {
      tripCalendarId: 42,
      name: "Beach Bonfire",
      description: null,
      startTime: new Date().toISOString(),
      endTime: null,
      location: null,
      cost: null,
      maxCapacity: null,
      category: "fun",
      type: "SCHEDULED",
    };

    const activityRow = {
      id: 99,
      trip_calendar_id: 42,
      posted_by: "organizer",
      name: activityInput.name,
      description: null,
      start_time: activityInput.startTime,
      end_time: null,
      location: null,
      cost: null,
      max_capacity: null,
      category: activityInput.category,
      status: "active",
      type: activityInput.type,
      created_at: new Date(),
      updated_at: new Date(),
    };

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [activityRow] }) // insert activity
      .mockRejectedValueOnce(error) // insert invites
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      storage.createActivityWithInvites(activityInput, "organizer", ["friend"]),
    ).rejects.toThrow("failed to persist invites");

    expect(queryMock).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(queryMock).toHaveBeenNthCalledWith(
      4,
      "ROLLBACK",
    );
    expect(
      queryMock.mock.calls.map(([sql]) => sql),
    ).not.toContain("COMMIT");
    expect(releaseMock).toHaveBeenCalledTimes(1);
  });
});
