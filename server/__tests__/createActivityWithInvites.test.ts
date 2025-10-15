import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import type { InsertActivity } from "@shared/schema";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

const queryMock = jest.fn();

let storageModule: typeof import("../storage");
let storage: typeof import("../storage")["storage"];
let dbQuerySpy: jest.SpiedFunction<typeof import("../db")["query"]>;
let poolConnectSpy: jest.SpiedFunction<typeof import("../db")["pool"]["connect"]>;
let mockClient: { query: typeof queryMock; release: jest.Mock };

beforeAll(async () => {
  jest.resetModules();
  const dbModule: any = await import("../db");
  dbQuerySpy = jest.spyOn(dbModule, "query").mockImplementation(queryMock as any);
  poolConnectSpy = jest.spyOn(dbModule.pool, "connect");
  storageModule = await import("../storage");
  storage = storageModule.storage;
});

beforeEach(() => {
  queryMock.mockReset();
  dbQuerySpy.mockImplementation(queryMock as any);
  mockClient = {
    query: queryMock,
    release: jest.fn(),
  } as any;
  poolConnectSpy.mockResolvedValue(mockClient as any);
  (storage as any).activityTypeColumnInitialized = true;
  (storage as any).activityStatusColumnInitialized = true;
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
      .mockResolvedValueOnce({ rows: [] }) // duplicate check
      .mockResolvedValueOnce({ rows: [activityRow] }) // insert activity
      .mockResolvedValueOnce({ rows: [{ user_id: "friend" }] }) // validate members
      .mockResolvedValueOnce({ rows: [{ created_by: "organizer" }] }) // fetch creator
      .mockRejectedValueOnce(error) // insert invites
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      storage.createActivityWithInvites(activityInput, "organizer", ["friend"]),
    ).rejects.toThrow("failed to persist invites");

    expect(queryMock).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(queryMock).toHaveBeenNthCalledWith(7, "ROLLBACK");
    expect(
      queryMock.mock.calls.map(([sql]) => sql),
    ).not.toContain("COMMIT");
  });

  it("throws ActivityInviteMembershipError when invitees are no longer members", async () => {
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
      .mockResolvedValueOnce({ rows: [] }) // duplicate check
      .mockResolvedValueOnce({ rows: [activityRow] }) // insert activity
      .mockResolvedValueOnce({ rows: [] }) // validate members returns none
      .mockResolvedValueOnce({ rows: [{ created_by: "organizer" }] }) // fetch creator
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      storage.createActivityWithInvites(activityInput, "organizer", ["former-member"]),
    ).rejects.toBeInstanceOf(storageModule.ActivityInviteMembershipError);

    expect(queryMock).toHaveBeenNthCalledWith(6, "ROLLBACK");
  });
});
