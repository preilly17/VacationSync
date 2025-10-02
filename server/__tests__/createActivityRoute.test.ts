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

  it("returns 422 with invite details when a constraint violation occurs", async () => {
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

    expect(res.status).toHaveBeenCalledWith(422);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({
      message: "One or more invitees are no longer members of this trip.",
      correlationId: expect.any(String),
      invalidInviteeIds: ["former-member"],
    });

    expect(logActivityCreationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: payload.correlationId,
        step: "save",
        userId: "organizer",
        tripId: trip.id,
        error: fkError,
        mode: "SCHEDULED",
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

  it("returns 422 when invitees are no longer trip members", async () => {
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

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "One or more invitees are no longer members of this trip.",
        correlationId: expect.any(String),
        invalidInviteeIds: ["former-member"],
      }),
    );

    expect(logActivityCreationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        correlationId: expect.any(String),
        step: "save",
        userId: "organizer",
        tripId: trip.id,
        error: membershipError,
        mode: "SCHEDULED",
      }),
    );

    expect(trackActivityCreationMetric).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "SCHEDULED", outcome: "failure", reason: "constraint" }),
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
});
