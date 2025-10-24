import path from "path";
import { fileURLToPath } from "url";
import { beforeAll, describe, expect, it, jest } from "@jest/globals";

import type {
  ActivityAcceptance,
  ActivityComment,
  ActivityInvite,
  ActivityWithDetails,
  User,
} from "@shared/schema";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

const queryMock = jest.fn();
const poolConnectMock = jest.fn();

let mapActivityWithDetails: (typeof import("../storage"))
  ["__testables"]["mapActivityWithDetails"];
let storageInstance: (typeof import("../storage"))["storage"];

beforeAll(async () => {
  jest.resetModules();
  const dbModuleSpecifier = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../db",
  );
  await jest.unstable_mockModule(dbModuleSpecifier, () => ({
    query: queryMock,
    pool: { connect: poolConnectMock },
  }));
  const storageModule: any = await import("../storage");
  mapActivityWithDetails = storageModule.__testables.mapActivityWithDetails;
  storageInstance = storageModule.storage;
});

beforeEach(() => {
  queryMock.mockReset();
  poolConnectMock.mockReset();
});

describe("mapActivityWithDetails", () => {
  it("preserves proposal type when mapping activity rows", () => {
    const now = new Date();

    const poster: User = {
      id: "organizer",
      email: "organizer@example.com",
      username: "organizer",
      firstName: "Org",
      lastName: "User",
      phoneNumber: null,
      passwordHash: null,
      profileImageUrl: null,
      cashAppUsername: null,
      cashAppUsernameLegacy: null,
      cashAppPhone: null,
      cashAppPhoneLegacy: null,
      venmoUsername: null,
      venmoPhone: null,
      timezone: null,
      defaultLocation: null,
      defaultLocationCode: null,
      defaultCity: null,
      defaultCountry: null,
      authProvider: null,
      notificationPreferences: null,
      hasSeenHomeOnboarding: false,
      hasSeenTripOnboarding: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const invites: (ActivityInvite & { user: User })[] = [];
    const acceptances: (ActivityAcceptance & { user: User })[] = [];
    const comments: (ActivityComment & { user: User })[] = [];

    const mapped = mapActivityWithDetails({
      id: 42,
      trip_calendar_id: 77,
      posted_by: "organizer",
      name: "Food tour poll",
      description: null,
      start_time: now,
      end_time: null,
      location: null,
      cost: null,
      max_capacity: null,
      category: "food",
      status: "active",
      type: "PROPOSE",
      created_at: now,
      updated_at: now,
      poster,
      invites,
      acceptances,
      comments,
      currentUserId: "organizer",
    });

    expect(mapped.type).toBe<ActivityWithDetails["type"]>("PROPOSE");
    expect(mapped).toMatchObject({
      id: 42,
      name: "Food tour poll",
      poster,
      invites: [],
      acceptances: [],
      comments: [],
      acceptedCount: 0,
      permissions: { canCancel: true },
    });
  });
});

describe("getTripActivities", () => {
  it("filters out canceled activities from calendar queries", async () => {
    const executedSql: string[] = [];

    queryMock.mockImplementation(async (sql: string) => {
      executedSql.push(sql);

      if (sql.includes("SELECT data_type, udt_name")) {
        return { rows: [{ data_type: "text", udt_name: null }] };
      }

      return { rows: [] };
    });

    await storageInstance.getTripActivities(123, "user-123");

    const activitiesQuery = executedSql.find((statement) =>
      statement.includes("FROM activities a"),
    );

    expect(activitiesQuery).toBeDefined();
    expect(activitiesQuery).toContain("a.status <> 'canceled'");
  });
});
