import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("DatabaseStorage.acceptRestaurantProposal", () => {
  let storage: typeof import("../storage").storage;
  let clientQuery: jest.Mock;
  let clientRelease: jest.Mock;

  beforeEach(async () => {
    jest.resetModules();
    clientQuery = jest.fn();
    clientRelease = jest.fn();

    jest.doMock("../db", () => ({
      query: jest.fn(),
      pool: {
        connect: jest.fn().mockResolvedValue({
          query: clientQuery,
          release: clientRelease,
        }),
        query: jest.fn(),
        end: jest.fn(),
      },
    }));

    ({ storage } = await import("../storage"));

    jest.spyOn(storage as any, "ensureRestaurantProposalAcceptanceColumns").mockResolvedValue(undefined);
    jest.spyOn(storage as any, "ensureProposalLinkStructures").mockResolvedValue(undefined);
    jest.spyOn(storage as any, "ensureActivityTypeColumn").mockResolvedValue(undefined);
    jest.spyOn(storage as any, "ensureActivityVotingDeadlineColumn").mockResolvedValue(undefined);
    jest.spyOn(storage as any, "ensureActivityInviteStructures").mockResolvedValue(undefined);
    jest.spyOn(storage, "getRestaurantProposalById").mockResolvedValue({
      id: 1,
      tripId: 55,
      status: "accepted",
    } as any);
    jest.spyOn(storage, "getTripActivities").mockResolvedValue([
      { id: 200 },
    ] as any);
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("creates a scheduled activity when accepting a proposal", async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            trip_id: 55,
            proposed_by: "member-a",
            restaurant_name: "Bistro Uno",
            address: "123 Main St",
            preferred_meal_time: "dinner",
            preferred_dates: ["2025-02-10"],
            status: "proposed",
          },
        ],
      }) // proposal
      .mockResolvedValueOnce({
        rows: [
          { created_by: "member-a", start_date: "2025-02-10", timezone: null },
        ],
      }) // trip
      .mockResolvedValueOnce({
        rows: [
          { user_id: "member-a" },
          { user_id: "member-b" },
        ],
      }) // members
      .mockResolvedValueOnce({ rows: [] }) // restaurant link
      .mockResolvedValueOnce({ rows: [] }) // activity link
      .mockResolvedValueOnce({ rows: [{ timezone: "America/New_York" }] }) // user timezone
      .mockResolvedValueOnce({ rows: [{ id: 200 }] }) // insert activity
      .mockResolvedValueOnce({ rows: [] }) // pending invites
      .mockResolvedValueOnce({ rows: [] }) // accepted invite
      .mockResolvedValueOnce({ rows: [] }) // insert link
      .mockResolvedValueOnce({ rows: [] }) // update proposal
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const result = await storage.acceptRestaurantProposal(1, "member-b");

    expect(result.activity?.id).toBe(200);

    const executedSql = clientQuery.mock.calls.map(([sql]) => String(sql));
    const insertedActivity = executedSql.some((sql) => sql.includes("INSERT INTO activities"));
    const insertedLink = executedSql.some((sql) => sql.includes("INSERT INTO proposal_schedule_links"));

    expect(insertedActivity).toBe(true);
    expect(insertedLink).toBe(true);
  });

  it("does not create a duplicate activity when already accepted", async () => {
    clientQuery
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            trip_id: 55,
            proposed_by: "member-a",
            restaurant_name: "Bistro Uno",
            address: "123 Main St",
            preferred_meal_time: "dinner",
            preferred_dates: ["2025-02-10"],
            status: "accepted",
          },
        ],
      }) // proposal
      .mockResolvedValueOnce({
        rows: [
          { created_by: "member-a", start_date: "2025-02-10", timezone: null },
        ],
      }) // trip
      .mockResolvedValueOnce({
        rows: [
          { user_id: "member-a" },
          { user_id: "member-b" },
        ],
      }) // members
      .mockResolvedValueOnce({ rows: [] }) // restaurant link
      .mockResolvedValueOnce({ rows: [{ id: 9, scheduled_id: 200 }] }) // activity link
      .mockResolvedValueOnce({ rows: [] }) // update proposal
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await storage.acceptRestaurantProposal(1, "member-b");

    const executedSql = clientQuery.mock.calls.map(([sql]) => String(sql));
    const insertedActivity = executedSql.some((sql) => sql.includes("INSERT INTO activities"));

    expect(insertedActivity).toBe(false);
  });
});
