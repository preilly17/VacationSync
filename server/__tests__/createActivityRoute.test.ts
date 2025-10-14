import express from "express";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

type RouteHandler = (req: any, res: any, next?: any) => Promise<unknown> | unknown;

let setupRoutes: (app: express.Express) => import("http").Server;
let storageModule: any;
let storage: any;
let observabilityModule: any;
let activitiesV2Module: any;
let logActivityCreationFailure: jest.SpyInstance;
let trackActivityCreationMetric: jest.SpyInstance;

const findRouteHandler = (
  app: express.Express,
  path: string,
  method: "get" | "post" | "put" | "delete" | "patch",
): RouteHandler => {
  const stack = ((app as unknown as { _router?: { stack?: any[] } })._router?.stack ?? []) as any[];

  for (const layer of stack) {
    if (layer?.route?.path === path && layer.route?.methods?.[method]) {
      return layer.route.stack[0].handle as RouteHandler;
    }
  }

  throw new Error(`Route handler for ${method.toUpperCase()} ${path} not found`);
};

const createMockResponse = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

beforeAll(async () => {
  jest.resetModules();
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

  await jest.unstable_mockModule("../observability", () => ({
    __esModule: true,
    logCoverPhotoFailure: jest.fn(),
    logActivityCreationFailure: jest.fn(),
    trackActivityCreationMetric: jest.fn(),
  }));

  await jest.unstable_mockModule("../vite", () => ({
    __esModule: true,
    log: jest.fn(),
    setupVite: jest.fn(),
    serveStatic: jest.fn(),
  }));

  await jest.unstable_mockModule("../sessionAuth", () => ({
    __esModule: true,
    setupAuth: jest.fn(),
    isAuthenticated: (_req: any, _res: any, next: any) => next?.(),
  }));

  await jest.unstable_mockModule("../coverPhotoUpload", () => ({
    __esModule: true,
    registerCoverPhotoUploadRoutes: jest.fn(),
  }));

  await jest.unstable_mockModule("../activitiesV2", () => ({
    __esModule: true,
    createActivityV2: jest.fn(),
  }));

  await jest.unstable_mockModule("ws", () => ({
    __esModule: true,
    WebSocketServer: jest.fn(() => ({
      on: jest.fn(),
      close: jest.fn(),
    })),
    WebSocket: { OPEN: 1 },
  }));

  const routesModule: any = await import("../routes");
  setupRoutes = routesModule.setupRoutes;

  storageModule = await import("../storage");
  storage = storageModule.storage;

  observabilityModule = await import("../observability");
  activitiesV2Module = await import("../activitiesV2");
});


describe("POST /api/trips/:id/activities", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    logActivityCreationFailure = jest.spyOn(observabilityModule, "logActivityCreationFailure");
    trackActivityCreationMetric = jest.spyOn(observabilityModule, "trackActivityCreationMetric");
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/trips/:id/activities", "post");
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("returns 400 with invite details when a constraint violation occurs", async () => {
    const trip = {
      id: 123,
      members: [
        { userId: "organizer", user: { firstName: "Org" } },
        { userId: "former-member", user: { firstName: "Former" } },
      ],
    };

    const requestBody = {
      name: "Brunch",
      startTime: new Date("2024-01-01T10:00:00Z").toISOString(),
      endTime: new Date("2024-01-01T12:00:00Z").toISOString(),
      category: "food",
      attendeeIds: ["former-member"],
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest
      .spyOn(storage, "getTripById")
      .mockResolvedValueOnce(trip as any);

    const fkError = Object.assign(new Error("violates foreign key constraint"), {
      code: "23503",
      detail:
        "Key (user_id)=(former-member) is not present in table \"trip_members\".",
    });

    jest
      .spyOn(storage, "createActivityWithInvites")
      .mockRejectedValueOnce(fkError as never);

    const setInviteStatusSpy = jest
      .spyOn(storage, "setActivityInviteStatus")
      .mockResolvedValue(undefined as any);

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("x-correlation-id", expect.any(String));
    const headerCorrelationId = res.setHeader.mock.calls[0][1];

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({
      message: "One or more invitees are no longer members of this trip.",
      correlationId: expect.any(String),
      invalidInviteeIds: ["former-member"],
      errors: expect.arrayContaining([
        expect.objectContaining({ field: "attendeeIds" }),
      ]),
    });
    expect(payload.correlationId).toBe(headerCorrelationId);

    expect(logActivityCreationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: payload.correlationId,
        step: "save",
        userId: "organizer",
        tripId: trip.id,
        error: fkError,
        mode: "SCHEDULED",
        payloadSummary: expect.objectContaining({
          name: requestBody.name,
          startTime: requestBody.startTime,
        }),
      }),
    );

    expect(trackActivityCreationMetric).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "SCHEDULED", outcome: "failure", reason: "constraint" }),
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Activity creation failed due to invite constraint violation",
      expect.objectContaining({
        correlationId: payload.correlationId,
        tripId: trip.id,
        userId: "organizer",
        invalidInviteeIds: ["former-member"],
        attemptedInviteeIds: ["former-member"],
        error: fkError,
      }),
    );

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(setInviteStatusSpy).not.toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("returns a trip date range message when the legacy payload is outside the window", async () => {
    const trip = {
      id: 321,
      members: [{ userId: "organizer", user: { firstName: "Org" } }],
      createdBy: "organizer",
      startDate: "2024-01-01",
      endDate: "2024-01-10",
    };

    const requestBody = {
      name: "Boat tour",
      startTime: new Date("2024-01-15T15:00:00Z").toISOString(),
      category: "manual",
      attendeeIds: ["organizer"],
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    const createSpy = jest.spyOn(storage, "createActivityWithInvites");

    await handler(req, res);

    expect(createSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toBe("Pick a date between Jan 1, 2024 and Jan 10, 2024.");
    expect(payload.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "startDate" })]),
    );
  });

  it("returns 400 when invitees are no longer trip members", async () => {
    const trip = {
      id: 789,
      createdBy: "former-member",
      members: [
        { userId: "organizer", user: { firstName: "Org" } },
        { userId: "friend", user: { firstName: "Friend" } },
      ],
    };

    const requestBody = {
      name: "Sunset Cruise",
      startTime: new Date("2024-04-01T18:00:00Z").toISOString(),
      endTime: null,
      category: "entertainment",
      attendeeIds: ["friend", "former-member"],
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest
      .spyOn(storage, "getTripById")
      .mockResolvedValueOnce(trip as any);

    const membershipError = new storageModule.ActivityInviteMembershipError({
      invalidInviteeIds: ["former-member"],
      attemptedInviteeIds: ["friend", "former-member"],
    });

    const createSpy = jest
      .spyOn(storage, "createActivityWithInvites")
      .mockRejectedValueOnce(membershipError as never);

    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("x-correlation-id", expect.any(String));

    expect(res.status).toHaveBeenCalledWith(400);
    const membershipPayload = res.json.mock.calls[0][0];
    expect(membershipPayload).toEqual(
      expect.objectContaining({
        message: "One or more invitees are no longer members of this trip.",
        correlationId: expect.any(String),
        invalidInviteeIds: ["former-member"],
        errors: expect.arrayContaining([
          expect.objectContaining({ field: "attendeeIds" }),
        ]),
      }),
    );
    expect(membershipPayload.correlationId).toBe(res.setHeader.mock.calls[0][1]);

    expect(logActivityCreationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: expect.any(String),
        step: "save",
        userId: "organizer",
        tripId: trip.id,
        error: membershipError,
        mode: "SCHEDULED",
        payloadSummary: expect.objectContaining({
          name: requestBody.name,
          startTime: requestBody.startTime,
        }),
      }),
    );

    expect(trackActivityCreationMetric).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "SCHEDULED", outcome: "failure", reason: "invalid-invite" }),
    );

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Activity creation blocked due to non-member invites",
      expect.objectContaining({
        correlationId: expect.any(String),
        tripId: trip.id,
        userId: "organizer",
        invalidInviteeIds: ["former-member"],
        attemptedInviteeIds: ["friend", "former-member"],
        error: membershipError,
      }),
    );

    expect(createSpy).toHaveBeenCalled();

    consoleWarnSpy.mockRestore();
  });

  it("allows inviting the trip creator even if they are not in members", async () => {
    const trip = {
      id: 654,
      createdBy: "trip-owner",
      members: [
        { userId: "organizer", user: { firstName: "Org" } },
        { userId: "friend", user: { firstName: "Friend" } },
      ],
    };

    const requestBody = {
      name: "Owner Dinner",
      startTime: new Date("2024-05-01T18:00:00Z").toISOString(),
      endTime: null,
      category: "food",
      attendeeIds: ["trip-owner"],
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    const createdActivity = {
      id: 321,
      tripCalendarId: trip.id,
      name: requestBody.name,
      description: null,
      startTime: requestBody.startTime,
      endTime: requestBody.endTime,
      location: null,
      cost: null,
      maxCapacity: null,
      category: requestBody.category,
      type: "SCHEDULED",
    };

    const createActivitySpy = jest
      .spyOn(storage, "createActivityWithInvites")
      .mockResolvedValueOnce(createdActivity as any);

    jest
      .spyOn(storage, "getTripActivities")
      .mockResolvedValueOnce([createdActivity] as any);

    jest
      .spyOn(storage, "createNotification")
      .mockResolvedValue(undefined as any);

    await handler(req, res);

    expect(createActivitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tripCalendarId: trip.id,
        name: requestBody.name,
      }),
      "organizer",
      ["trip-owner"],
    );

    expect(trackActivityCreationMetric).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "SCHEDULED", outcome: "success" }),
    );

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: createdActivity.id }));
  });

  it("allows manual entry activities to be created", async () => {
    const trip = {
      id: 456,
      createdBy: "organizer",
      members: [
        { userId: "organizer", user: { firstName: "Org" } },
        { userId: "friend", user: { firstName: "Friend" } },
      ],
    };

    const requestBody = {
      name: "Manual Museum Visit",
      location: "City Museum",
      startTime: new Date("2024-03-10T15:00:00Z").toISOString(),
      endTime: null,
      description: "Manual entry · Status: Confirmed · Currency: USD",
      cost: 25,
      category: "manual",
      attendeeIds: ["friend"],
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    const createdActivity = {
      id: 99,
      tripCalendarId: trip.id,
      name: requestBody.name,
      description: requestBody.description,
      startTime: requestBody.startTime,
      endTime: requestBody.endTime,
      location: requestBody.location,
      cost: requestBody.cost,
      maxCapacity: null,
      category: requestBody.category,
      type: "SCHEDULED",
    };

    const createActivitySpy = jest
      .spyOn(storage, "createActivityWithInvites")
      .mockResolvedValueOnce(createdActivity as any);

    const getActivitiesSpy = jest
      .spyOn(storage, "getTripActivities")
      .mockResolvedValueOnce([createdActivity] as any);

    const createNotificationSpy = jest
      .spyOn(storage, "createNotification")
      .mockResolvedValue(undefined as any);

    await handler(req, res);

    expect(createActivitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "manual",
        tripCalendarId: trip.id,
      }),
      "organizer",
      ["friend"],
    );

    expect(getActivitiesSpy).toHaveBeenCalledWith(trip.id, "organizer");
    expect(createNotificationSpy).toHaveBeenCalledTimes(1);
    expect(trackActivityCreationMetric).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "SCHEDULED", outcome: "success" }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: createdActivity.id, category: "manual" }),
    );
  });

  it("uses the activities v2 pipeline only when the client opts in", async () => {
    const trip = {
      id: 987,
      createdBy: "organizer",
      members: [
        { userId: "organizer", user: { firstName: "Org", email: "org@example.com" } },
        { userId: "friend", user: { firstName: "Friend", email: "friend@example.com" } },
      ],
    };

    const requestBody = {
      name: "Morning Run",
      description: "Shake off the jet lag",
      category: "outdoor",
      date: "2024-06-01",
      start_time: "07:30",
      timezone: "America/New_York",
      attendeeIds: ["friend"],
      idempotency_key: "test-key-123",
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      headers: { "x-activities-version": "2" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();
    const previousFeatureFlag = process.env.FEATURE_ACTIVITIES_V2;
    process.env.FEATURE_ACTIVITIES_V2 = "true";

    try {
      jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

      const legacyCreateSpy = jest
        .spyOn(storage, "createActivityWithInvites")
        .mockResolvedValueOnce(null as any);

      jest
        .spyOn(storage, "createNotification")
        .mockResolvedValue(undefined as any);

      const now = new Date().toISOString();
      const activityId = "activity-v2-id";
      const v2Response = {
        id: activityId,
        tripId: String(trip.id),
        creatorId: "organizer",
        title: requestBody.name,
        description: requestBody.description,
        category: requestBody.category,
        date: requestBody.date,
        startTime: requestBody.start_time,
        endTime: null,
        timezone: requestBody.timezone,
        location: null,
        costPerPerson: null,
        maxParticipants: null,
        status: "scheduled",
        visibility: "trip",
        createdAt: now,
        updatedAt: now,
        version: 1,
        invitees: [
          {
            activityId,
            userId: "organizer",
            role: "participant",
            createdAt: now,
            updatedAt: now,
            user: trip.members[0]?.user ?? null,
          },
          {
            activityId,
            userId: "friend",
            role: "participant",
            createdAt: now,
            updatedAt: now,
            user: trip.members[1]?.user ?? null,
          },
        ],
        votes: [],
        rsvps: [],
        creator: trip.members[0]?.user ?? null,
        initialVoteOrRsvpState: { organizer: "yes", friend: "pending" },
        wasDeduplicated: false,
      };

      const createActivityV2Spy = jest
        .spyOn(activitiesV2Module, "createActivityV2")
        .mockResolvedValueOnce(v2Response as any);

      await handler(req, res);

      expect(createActivityV2Spy).toHaveBeenCalledWith(
        expect.objectContaining({
          trip,
          creatorId: "organizer",
          body: expect.objectContaining({
            title: requestBody.name,
            start_time: requestBody.start_time,
            timezone: requestBody.timezone,
            invitee_ids: ["friend"],
            idempotency_key: requestBody.idempotency_key,
          }),
        }),
      );

      expect(legacyCreateSpy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(v2Response);
    } finally {
      process.env.FEATURE_ACTIVITIES_V2 = previousFeatureFlag;
    }
  });

  it("returns a trip date range message when the v2 payload is outside the window", async () => {
    const previousFeatureFlag = process.env.FEATURE_ACTIVITIES_V2;
    process.env.FEATURE_ACTIVITIES_V2 = "true";

    const trip = {
      id: 555,
      members: [{ userId: "organizer", user: { firstName: "Org", email: "org@example.com" } }],
      createdBy: "organizer",
      startDate: "2024-01-01",
      endDate: "2024-01-10",
      timezone: "UTC",
    };

    const requestBody = {
      mode: "scheduled",
      title: "Dinner",
      date: "2024-01-15",
      start_time: "18:00",
      timezone: "UTC",
      invitee_ids: ["organizer"],
      idempotency_key: "date-range-test",
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      headers: { "x-activities-version": "2" },
      session: { userId: "organizer" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    try {
      jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

      const createActivityV2Spy = jest.spyOn(activitiesV2Module, "createActivityV2");

      await handler(req, res);

      expect(createActivityV2Spy).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(422);
      const payload = res.json.mock.calls[0][0];
      expect(payload.message).toBe("Pick a date between Jan 1, 2024 and Jan 10, 2024.");
      expect(payload.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: "date" })]),
      );
    } finally {
      process.env.FEATURE_ACTIVITIES_V2 = previousFeatureFlag;
    }
  });

  it("allows activity proposals without a start time when using the v2 pipeline", async () => {
    const trip = {
      id: 321,
      createdBy: "organizer",
      timezone: "",
      members: [
        { userId: "organizer", user: { firstName: "Org", email: "org@example.com" } },
        { userId: "friend", user: { firstName: "Friend", email: "friend@example.com" } },
      ],
    };

    const requestBody = {
      name: "Sunset Stroll",
      description: "Relaxed walk along the beach",
      category: "outdoor",
      date: "2025-08-15",
      start_time: null,
      timezone: "",
      mode: "proposed",
      invitee_ids: ["friend"],
      idempotency_key: "proposal-123",
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      headers: { "x-activities-version": "2" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();
    const previousFeatureFlag = process.env.FEATURE_ACTIVITIES_V2;
    process.env.FEATURE_ACTIVITIES_V2 = "true";

    try {
      jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

      jest.spyOn(storage, "createActivityWithInvites").mockResolvedValueOnce(null as any);

      const createNotificationSpy = jest
        .spyOn(storage, "createNotification")
        .mockResolvedValue(undefined as any);

      const now = new Date().toISOString();
      const activityId = "proposal-activity";
      const v2Response = {
        id: activityId,
        tripId: String(trip.id),
        creatorId: "organizer",
        title: requestBody.name,
        description: requestBody.description,
        category: requestBody.category,
        date: requestBody.date,
        startTime: null,
        endTime: null,
        timezone: "UTC",
        location: null,
        costPerPerson: null,
        maxParticipants: null,
        status: "proposed",
        visibility: "trip",
        createdAt: now,
        updatedAt: now,
        version: 1,
        invitees: [
          {
            activityId,
            userId: "organizer",
            role: "participant",
            createdAt: now,
            updatedAt: now,
            user: trip.members[0]?.user ?? null,
          },
          {
            activityId,
            userId: "friend",
            role: "participant",
            createdAt: now,
            updatedAt: now,
            user: trip.members[1]?.user ?? null,
          },
        ],
        votes: [],
        rsvps: [],
        creator: trip.members[0]?.user ?? null,
        initialVoteOrRsvpState: { organizer: "pending", friend: "pending" },
        wasDeduplicated: false,
      };

      const createActivityV2Spy = jest
        .spyOn(activitiesV2Module, "createActivityV2")
        .mockResolvedValueOnce(v2Response as any);

      await handler(req, res);

      expect(createActivityV2Spy).toHaveBeenCalledWith(
        expect.objectContaining({
          trip,
          creatorId: "organizer",
          body: expect.objectContaining({
            mode: "proposed",
            start_time: "",
            timezone: "UTC",
            invitee_ids: ["friend"],
            idempotency_key: requestBody.idempotency_key,
          }),
        }),
      );

      expect(createNotificationSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "friend",
          type: "activity_proposal",
          tripId: trip.id,
          activityId,
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(v2Response);
    } finally {
      process.env.FEATURE_ACTIVITIES_V2 = previousFeatureFlag;
    }
  });

  it("ensures the demo user exists before creating an activity in development", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const trip = {
      id: 789,
      createdBy: "demo-user",
      members: [],
    };

    const requestBody = {
      name: "Gallery Visit",
      startTime: new Date("2024-05-01T18:00:00Z").toISOString(),
      endTime: null,
      category: "culture",
      attendeeIds: ["demo-user"],
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: {},
      headers: {},
      isAuthenticated: jest.fn(() => false),
    };

    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    const getUserSpy = jest
      .spyOn(storage, "getUser")
      .mockResolvedValueOnce(undefined as any);

    const upsertUserSpy = jest
      .spyOn(storage, "upsertUser")
      .mockResolvedValueOnce({ id: "demo-user" } as any);

    const createdActivity = {
      id: 321,
      tripCalendarId: trip.id,
      postedBy: "demo-user",
      name: requestBody.name,
      description: null,
      startTime: requestBody.startTime,
      endTime: requestBody.endTime,
      location: null,
      cost: null,
      maxCapacity: null,
      category: requestBody.category,
      status: "active",
      type: "SCHEDULED",
    };

    jest
      .spyOn(storage, "createActivityWithInvites")
      .mockResolvedValueOnce(createdActivity as any);

    jest
      .spyOn(storage, "getTripActivities")
      .mockResolvedValueOnce([createdActivity] as any);

    try {
      await handler(req, res);

      expect(getUserSpy).toHaveBeenCalledWith("demo-user");
      expect(upsertUserSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: "demo-user", email: "demo@example.com" }),
      );
      expect(res.status).toHaveBeenCalledWith(201);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
