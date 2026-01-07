import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("DatabaseStorage.removeScheduledItemsForProposal", () => {
  let queryMock: jest.Mock;
  let storage: typeof import("../storage").storage;

  beforeEach(async () => {
    jest.resetModules();
    queryMock = jest.fn();

    jest.doMock("../db", () => ({
      query: queryMock,
      pool: {
        connect: jest.fn(),
        query: jest.fn(),
        end: jest.fn(),
      },
    }));

    ({ storage } = await import("../storage"));
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("removes only the link when the scheduled item is standalone", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] }) // ensureProposalLinkStructures -> CREATE TABLE
      .mockResolvedValueOnce({ rows: [] }) // ensureProposalLinkStructures -> CREATE INDEX
      .mockResolvedValueOnce({ rows: [] }) // ensureProposalLinkStructures -> ADD COLUMN
      .mockResolvedValueOnce({
        rows: [
          {
            id: 10,
            scheduled_table: "hotels",
            scheduled_id: 55,
            created_from_proposal: false,
          },
        ],
      }) // select links
      .mockResolvedValueOnce({ rows: [] }); // delete link

    await (storage as unknown as { removeScheduledItemsForProposal: Function })
      .removeScheduledItemsForProposal("hotel", 123);

    const executedSql = queryMock.mock.calls.map(([sql]) => String(sql));
    const deletedHotel = executedSql.some((sql) => sql.includes("DELETE FROM hotels"));
    const deletedLink = executedSql.some((sql) =>
      sql.includes("DELETE FROM proposal_schedule_links"),
    );

    expect(deletedHotel).toBe(false);
    expect(deletedLink).toBe(true);
  });

  it("removes the scheduled item when it was created from the proposal", async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] }) // ensureProposalLinkStructures -> CREATE TABLE
      .mockResolvedValueOnce({ rows: [] }) // ensureProposalLinkStructures -> CREATE INDEX
      .mockResolvedValueOnce({ rows: [] }) // ensureProposalLinkStructures -> ADD COLUMN
      .mockResolvedValueOnce({
        rows: [
          {
            id: 11,
            scheduled_table: "hotels",
            scheduled_id: 77,
            created_from_proposal: true,
          },
        ],
      }) // select links
      .mockResolvedValueOnce({ rows: [] }) // delete hotel
      .mockResolvedValueOnce({ rows: [] }); // delete link

    await (storage as unknown as { removeScheduledItemsForProposal: Function })
      .removeScheduledItemsForProposal("hotel", 456);

    const executedSql = queryMock.mock.calls.map(([sql]) => String(sql));
    const deletedHotel = executedSql.some((sql) => sql.includes("DELETE FROM hotels"));
    const deletedLink = executedSql.some((sql) =>
      sql.includes("DELETE FROM proposal_schedule_links"),
    );

    expect(deletedHotel).toBe(true);
    expect(deletedLink).toBe(true);
  });
});
