import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { createActivityWithAttendeesSchema } from "@shared/schema";

describe("activity proposals", () => {
  let storage: any;
  let queryMock: jest.Mock;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

    jest.resetModules();

    queryMock = jest.fn();

    (globalThis as any).__TEST_DB_QUERY__ = queryMock;

    const storageModule: any = await import("../storage");
    storage = storageModule.storage;
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    queryMock.mockReset();
  });

  afterAll(() => {
    delete (globalThis as any).__TEST_DB_QUERY__;
  });

  it("allows proposals without a fixed start time", () => {
    expect(() => {
      createActivityWithAttendeesSchema.parse({
        tripCalendarId: 99,
        name: "Morning yoga",
        description: "Stretch together",
        category: "wellness",
        attendeeIds: [],
        type: "PROPOSE",
      });
    }).not.toThrow();
  });

  it("merges stored proposals into trip activities", async () => {
    const tripId = 42;
    const currentUserId = "user-1";

    const proposalRow = {
      id: 7,
      trip_id: tripId,
      proposed_by: currentUserId,
      name: "City food crawl",
      description: "Sample the best bites downtown",
      start_time: null,
      end_time: null,
      location: "Downtown",
      cost: null,
      max_capacity: null,
      category: "food",
      status: "proposed",
      time_options: ["2024-09-02T15:00:00.000Z"],
      created_at: new Date("2024-08-01T15:00:00.000Z"),
      updated_at: new Date("2024-08-01T15:00:00.000Z"),
      poster_id: currentUserId,
      poster_email: "host@example.com",
      poster_username: "host",
      poster_first_name: "Host",
      poster_last_name: "User",
      poster_phone_number: null,
      poster_password_hash: null,
      poster_profile_image_url: null,
      poster_cashapp_username: null,
      poster_cash_app_username: null,
      poster_cashapp_phone: null,
      poster_cash_app_phone: null,
      poster_venmo_username: null,
      poster_venmo_phone: null,
      poster_timezone: null,
      poster_default_location: null,
      poster_default_location_code: null,
      poster_default_city: null,
      poster_default_country: null,
      poster_auth_provider: null,
      poster_notification_preferences: null,
      poster_has_seen_home_onboarding: false,
      poster_has_seen_trip_onboarding: false,
      poster_created_at: null,
      poster_updated_at: null,
    };

    const voteRow = {
      id: 1,
      proposal_id: proposalRow.id,
      user_id: "user-2",
      vote: "YES",
      created_at: new Date("2024-08-01T16:00:00.000Z"),
      updated_at: new Date("2024-08-01T16:00:00.000Z"),
    };

    queryMock.mockImplementation((sql: string) => {
      const normalized = sql.replace(/\s+/g, " ").trim();

      if (normalized.includes("FROM activities")) {
        return Promise.resolve({ rows: [] });
      }

      if (normalized.startsWith("CREATE TABLE IF NOT EXISTS activity_proposals")) {
        return Promise.resolve({ rows: [] });
      }

      if (normalized.startsWith("CREATE TABLE IF NOT EXISTS activity_proposal_votes")) {
        return Promise.resolve({ rows: [] });
      }

      if (normalized.includes("idx_activity_proposals_trip")) {
        return Promise.resolve({ rows: [] });
      }

      if (normalized.includes("idx_activity_proposal_votes_proposal")) {
        return Promise.resolve({ rows: [] });
      }

      if (normalized.includes("FROM activity_proposals")) {
        return Promise.resolve({ rows: [proposalRow] });
      }

      if (normalized.includes("FROM activity_proposal_votes")) {
        return Promise.resolve({ rows: [voteRow] });
      }

      throw new Error(`Unexpected query: ${normalized}`);
    });

    const activities = await storage.getTripActivities(tripId, currentUserId);

    expect(activities).toHaveLength(1);
    const proposal = activities[0];
    expect(proposal.type).toBe("PROPOSE");
    expect(proposal.timeOptions).toEqual(["2024-09-02T15:00:00.000Z"]);
    expect(proposal.proposalVotes).toEqual(
      expect.objectContaining({
        total: 1,
        counts: expect.objectContaining({ YES: 1, NO: 0, MAYBE: 0 }),
      }),
    );
    expect(proposal.poster.email).toBe("host@example.com");
  });
});
