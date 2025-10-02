import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

let applyActivityResponse: any;
let storage: any;
let dbQueryMock: jest.Mock;

beforeAll(async () => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

  jest.resetModules();

  dbQueryMock = jest.fn().mockResolvedValue({ rows: [] });

  (globalThis as any).__TEST_DB_QUERY__ = dbQueryMock;

  await jest.unstable_mockModule("../observability", () => ({
    logCoverPhotoFailure: jest.fn(),
  }));

  await jest.unstable_mockModule("../vite", () => ({
    log: jest.fn(),
    setupVite: jest.fn(),
    serveStatic: jest.fn(),
  }));

  const routesModule: any = await import("../routes");
  applyActivityResponse = routesModule.__testables.applyActivityResponse;

  const storageModule: any = await import("../storage");
  storage = storageModule.storage;
});

afterAll(() => {
  delete (globalThis as any).__TEST_DB_QUERY__;
});

describe("applyActivityResponse", () => {
  let consoleErrorSpy: { mockRestore: () => void } | undefined;

  beforeEach(() => {
    jest.restoreAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    consoleErrorSpy?.mockRestore();
  });

  it("returns the updated invite even when RSVP notification persistence fails", async () => {
    const activity = {
      id: 1,
      tripCalendarId: 99,
      postedBy: "host-user",
      name: "Beach Day",
      invites: [
        { id: 1, userId: "host-user", status: "accepted", createdAt: new Date().toISOString() },
        { id: 2, userId: "guest-user", status: "pending", createdAt: new Date().toISOString() },
      ],
    } as any;

    const trip = {
      id: 99,
      members: [
        { userId: "host-user", user: { firstName: "Host" } },
        { userId: "guest-user", user: { firstName: "Guest" } },
      ],
    } as any;

    const updatedInvite = { id: 2, userId: "guest-user", status: "accepted" };
    const updatedActivity = {
      ...activity,
      invites: [
        { ...activity.invites[0] },
        { ...updatedInvite, createdAt: activity.invites[1].createdAt },
      ],
    };

    jest.spyOn(storage, "getActivityById").mockResolvedValue(activity);
    jest.spyOn(storage, "getTripById").mockResolvedValue(trip);
    jest
      .spyOn(storage, "setActivityInviteStatus")
      .mockResolvedValue(updatedInvite as any);
    jest
      .spyOn(storage, "getTripActivities")
      .mockResolvedValue([updatedActivity] as any);
    jest
      .spyOn(storage, "createNotification")
      .mockRejectedValue(new Error("failed to save notification"));

    let caughtError: unknown;
    let result: any;
    try {
      result = await applyActivityResponse(1, "guest-user", "accepted");
    } catch (error) {
      caughtError = error;
    }

    if (caughtError) {
      console.error("Test caught error", caughtError);
      throw caughtError;
    }

    expect(result).toEqual(
      expect.objectContaining({
        activity,
        trip,
        updatedInvite,
        updatedActivity,
        promotedUserId: null,
      }),
    );
    expect(storage.createNotification).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to persist RSVP notification:",
      expect.any(Error),
    );
  });

  it("continues promoting waitlisted invites when notification persistence fails", async () => {
    const activity = {
      id: 2,
      tripCalendarId: 77,
      postedBy: "organizer",
      name: "Museum Tour",
      maxCapacity: 2,
      invites: [
        { id: 1, userId: "organizer", status: "accepted", createdAt: new Date().toISOString() },
        { id: 2, userId: "responder", status: "pending", createdAt: new Date().toISOString() },
        {
          id: 3,
          userId: "waitlisted-user",
          status: "waitlisted",
          createdAt: new Date(Date.now() - 1000).toISOString(),
        },
      ],
    } as any;

    const trip = {
      id: 77,
      members: [
        { userId: "organizer", user: { firstName: "Org" } },
        { userId: "responder", user: { firstName: "Res" } },
        { userId: "waitlisted-user", user: { firstName: "Wait" } },
      ],
    } as any;

    const responderInvite = { id: 2, userId: "responder", status: "declined" };
    const promotedInvite = { id: 3, userId: "waitlisted-user", status: "accepted" };

    const activityBeforePromotion = {
      ...activity,
      invites: [
        activity.invites[0],
        { ...responderInvite, createdAt: activity.invites[1].createdAt },
        activity.invites[2],
      ],
    };

    const activityAfterPromotion = {
      ...activity,
      invites: [
        activity.invites[0],
        { ...responderInvite, createdAt: activity.invites[1].createdAt },
        { ...promotedInvite, createdAt: activity.invites[2].createdAt },
      ],
    };

    jest.spyOn(storage, "getActivityById").mockResolvedValue(activity);
    jest.spyOn(storage, "getTripById").mockResolvedValue(trip);
    jest
      .spyOn(storage, "setActivityInviteStatus")
      .mockResolvedValueOnce(responderInvite as any)
      .mockResolvedValueOnce(promotedInvite as any);
    jest
      .spyOn(storage, "getTripActivities")
      .mockResolvedValueOnce([activityBeforePromotion] as any)
      .mockResolvedValueOnce([activityAfterPromotion] as any);
    jest
      .spyOn(storage, "createNotification")
      .mockResolvedValueOnce(undefined as any)
      .mockRejectedValueOnce(new Error("failed to save waitlist notification"));

    let caughtError: unknown;
    let result: any;
    try {
      result = await applyActivityResponse(2, "responder", "declined");
    } catch (error) {
      caughtError = error;
    }

    if (caughtError) {
      console.error("Test caught error", caughtError);
      throw caughtError;
    }

    expect(result).toEqual(
      expect.objectContaining({
        activity,
        trip,
        updatedInvite: responderInvite,
        updatedActivity: activityAfterPromotion,
        promotedUserId: "waitlisted-user",
      }),
    );

    expect(storage.createNotification).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to persist waitlist promotion notification:",
      expect.any(Error),
    );
  });
});
