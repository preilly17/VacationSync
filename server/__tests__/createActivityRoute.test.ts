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
let activityValidationModule: any;
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
  activityValidationModule = await import("@shared/activityValidation");
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

  it("returns a friendly attendee error when validation omits attendeeIds", async () => {
    const trip = {
      id: 456,
      createdBy: "organizer",
      members: [
        { userId: "organizer", user: { firstName: "Org" } },
        { userId: "friend", user: { firstName: "Friend" } },
      ],
    };

    const requestBody = {
      name: "Dinner",
      startTime: new Date("2024-02-02T19:00:00Z").toISOString(),
      endTime: new Date("2024-02-02T21:00:00Z").toISOString(),
      category: "food",
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

    const validateSpy = jest
      .spyOn(activityValidationModule, "validateActivityInput")
      .mockReturnValueOnce({
        data: {
          tripCalendarId: trip.id,
          name: requestBody.name,
          description: null,
          startTime: requestBody.startTime,
          endTime: requestBody.endTime,
          location: null,
          cost: null,
          maxCapacity: null,
          category: "food",
          type: "SCHEDULED",
        },
        attendeeIds: undefined,
        errors: undefined,
      });

    const createActivitySpy = jest.spyOn(storage, "createActivityWithInvites");

    await handler(req, res);

    expect(validateSpy).toHaveBeenCalled();
    expect(createActivitySpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);

    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({
      message: activityValidationModule.ATTENDEE_REQUIRED_MESSAGE,
      correlationId: expect.any(String),
    });
    expect(payload.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "attendeeIds",
          message: activityValidationModule.ATTENDEE_REQUIRED_MESSAGE,
        }),
      ]),
    );

    validateSpy.mockRestore();
  });

  it("normalizes alternate field names to support new composer payloads", async () => {
    const trip = {
      id: 912,
      createdBy: "organizer",
      members: [
        { userId: "organizer", user: { firstName: "Org" } },
        { userId: "friend", user: { firstName: "Friend" } },
        { userId: "guest", user: { firstName: "Guest" } },
      ],
    };

    const requestBody = {
      title: "Evening Cruise",
      details: "Enjoy the skyline at sunset",
      start_time: new Date("2024-06-01T00:30:00Z").toISOString(),
      end_time: new Date("2024-06-01T02:00:00Z").toISOString(),
      address: "City Harbor",
      cost_per_person: "125.50",
      max_participants: 6,
      invitees: [
        { user_id: "friend" },
        { id: "guest" },
        { user: { id: "organizer" } },
      ],
      activity_category: "entertainment",
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
      id: 444,
      tripCalendarId: trip.id,
      name: requestBody.title,
      description: requestBody.details,
      startTime: requestBody.start_time,
      endTime: requestBody.end_time,
      location: requestBody.address,
      cost: 125.5,
      maxCapacity: 6,
      category: "entertainment",
      type: "SCHEDULED" as const,
    };

    const createActivitySpy = jest
      .spyOn(storage, "createActivityWithInvites")
      .mockResolvedValueOnce(createdActivity as any);

    jest.spyOn(storage, "getTripActivities").mockResolvedValueOnce([createdActivity] as any);
    jest.spyOn(storage, "createNotification").mockResolvedValue(undefined as any);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(createActivitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tripCalendarId: trip.id,
        name: requestBody.title,
        description: requestBody.details,
        startTime: requestBody.start_time,
        endTime: requestBody.end_time,
        location: requestBody.address,
        cost: 125.5,
        maxCapacity: 6,
        category: "entertainment",
      }),
      "organizer",
      expect.arrayContaining(["friend", "guest"]),
    );
    const inviteArgument = createActivitySpy.mock.calls[0]?.[2] as string[];
    expect(inviteArgument).not.toContain("organizer");
  });

  it("accepts camelCase startAt and endAt fields", async () => {
    const trip = {
      id: 613,
      createdBy: "organizer",
      members: [
        { userId: "organizer", user: { firstName: "Org" } },
        { userId: "friend", user: { firstName: "Friend" } },
      ],
    };

    const requestBody = {
      name: "Morning Kayak",
      startAt: "2024-07-04T09:00:00-05:00",
      endAt: "2024-07-04T11:00:00-05:00",
      activityDate: "2024-07-04",
      category: "outdoor",
      attendees: ["organizer", "friend"],
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
      id: 556,
      tripCalendarId: trip.id,
      name: requestBody.name,
      description: null,
      startTime: new Date(requestBody.startAt).toISOString(),
      endTime: new Date(requestBody.endAt).toISOString(),
      location: null,
      cost: null,
      maxCapacity: null,
      category: "outdoor",
      type: "SCHEDULED" as const,
    };

    const createActivitySpy = jest
      .spyOn(storage, "createActivityWithInvites")
      .mockResolvedValueOnce(createdActivity as any);

    jest.spyOn(storage, "getTripActivities").mockResolvedValueOnce([createdActivity] as any);
    jest.spyOn(storage, "createNotification").mockResolvedValue(undefined as any);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(createActivitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tripCalendarId: trip.id,
        name: requestBody.name,
        startTime: new Date(requestBody.startAt).toISOString(),
        endTime: new Date(requestBody.endAt).toISOString(),
        category: "outdoor",
      }),
      "organizer",
      expect.arrayContaining(["friend"]),
    );

    const inviteArgument = createActivitySpy.mock.calls[0]?.[2] as string[];
    expect(inviteArgument).not.toContain("organizer");
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

  it("returns validation errors when an alternate payload is outside the trip window", async () => {
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
      session: { userId: "organizer" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toBe(activityValidationModule.ACTIVITY_CATEGORY_MESSAGE);
    expect(payload.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "category" }),
        expect.objectContaining({ field: "startDate" }),
        expect.objectContaining({ field: "startTime" }),
      ]),
    );
  });

  it("allows activity proposals without a start time via the legacy pipeline", async () => {
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
      startTime: null,
      endTime: null,
      attendeeIds: ["friend"],
    };

    const req: any = {
      params: { tripId: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      isAuthenticated: jest.fn(() => true),
    };

    const proposalHandler = findRouteHandler(app, "/api/trips/:tripId/proposals/activities", "post");
    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    const createdActivity = {
      id: 55,
      tripCalendarId: trip.id,
      name: requestBody.name,
      description: requestBody.description,
      startTime: null,
      endTime: null,
      location: null,
      cost: null,
      maxCapacity: null,
      category: requestBody.category,
      status: "pending",
      type: "PROPOSE",
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

    await proposalHandler(req, res);

    expect(createActivitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tripCalendarId: trip.id,
        name: requestBody.name,
        type: "PROPOSE",
      }),
      "organizer",
      ["friend"],
    );
    expect(getActivitiesSpy).toHaveBeenCalledWith(trip.id, "organizer");
    expect(createNotificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "friend",
        type: "activity_proposal",
        tripId: trip.id,
        activityId: createdActivity.id,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: createdActivity.id }));
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
