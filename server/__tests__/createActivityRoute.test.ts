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
import type { ActivityWithDetails, TripWithDetails } from "@shared/schema";

type RouteHandler = (req: any, res: any, next?: any) => Promise<unknown> | unknown;

let setupRoutes: (app: express.Express) => import("http").Server;
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
    convertActivitiesV2ToLegacy: jest.fn(),
    listActivitiesForTripV2: jest.fn(),
    getActivityByLegacyIdV2: jest.fn(),
    applyInviteStatusForLegacyId: jest.fn(),
    convertProposalToScheduledV2: jest.fn(),
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

  const storageModule = await import("../storage");
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
    process.env.FEATURE_ACTIVITIES_V2 = "true";
    process.env.FEATURE_ACTIVITIES_V2_WRITES = "true";
    logActivityCreationFailure = jest.spyOn(observabilityModule, "logActivityCreationFailure");
    trackActivityCreationMetric = jest.spyOn(observabilityModule, "trackActivityCreationMetric");
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/trips/:id/activities", "post");
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    delete process.env.FEATURE_ACTIVITIES_V2;
    delete process.env.FEATURE_ACTIVITIES_V2_WRITES;
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("normalizes ISO inputs and surfaces invite validation errors from the v2 pipeline", async () => {
    const trip: TripWithDetails = {
      id: 101,
      createdBy: "organizer",
      members: [
        { userId: "organizer", user: { firstName: "Org" } },
        { userId: "friend", user: { firstName: "Friend" } },
      ],
    } as TripWithDetails;

    const requestBody = {
      name: "Sunrise Hike",
      startTime: new Date("2024-03-01T09:00:00Z").toISOString(),
      endTime: new Date("2024-03-01T11:30:00Z").toISOString(),
      attendeeIds: ["former-member"],
      category: "outdoors",
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    const validationError = Object.assign(new Error("invalid_invitees"), {
      code: "VALIDATION",
      details: [
        { field: "invitee_ids", message: "All invitees must be members of this trip." },
      ],
    });

    const createActivitySpy = jest
      .spyOn(activitiesV2Module, "createActivityV2")
      .mockRejectedValueOnce(validationError);

    await handler(req, res);

    expect(createActivitySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        trip,
        creatorId: "organizer",
        body: expect.objectContaining({
          date: "2024-03-01",
          start_time: "09:00",
          end_time: "11:30",
          invitee_ids: ["former-member"],
        }),
      }),
    );

    expect(res.status).toHaveBeenCalledWith(422);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({
      message: "All invitees must be members of this trip.",
      errors: validationError.details,
    });

    expect(logActivityCreationFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        step: "validate",
        tripId: trip.id,
        mode: "SCHEDULED",
        validationFields: ["invitee_ids"],
      }),
    );

    expect(trackActivityCreationMetric).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "SCHEDULED", outcome: "failure", reason: "validation" }),
    );
  });

  it("rejects dates outside the trip window before invoking the v2 pipeline", async () => {
    const trip: TripWithDetails = {
      id: 202,
      createdBy: "organizer",
      members: [{ userId: "organizer", user: { firstName: "Org" } }],
      startDate: "2024-05-01",
      endDate: "2024-05-05",
    } as TripWithDetails;

    const requestBody = {
      name: "Boat Tour",
      startTime: new Date("2024-05-10T15:00:00Z").toISOString(),
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

    const createActivitySpy = jest.spyOn(activitiesV2Module, "createActivityV2");

    await handler(req, res);

    expect(createActivitySpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toMatchObject({
      message: "Pick a date between May 1, 2024 and May 5, 2024.",
      errors: expect.arrayContaining([expect.objectContaining({ field: "date" })]),
    });
  });

  it("creates a scheduled activity via the v2 pipeline and dispatches notifications", async () => {
    const trip: TripWithDetails = {
      id: 303,
      createdBy: "organizer",
      members: [
        { userId: "organizer", user: { firstName: "Org", email: "org@example.com" } },
        { userId: "friend", user: { firstName: "Friend", email: "friend@example.com" } },
      ],
      timezone: "America/New_York",
    } as TripWithDetails;

    const requestBody = {
      name: "Morning Run",
      description: "Shake off the jet lag",
      category: "outdoor",
      startTime: new Date("2024-06-01T07:30:00Z").toISOString(),
      attendeeIds: ["friend"],
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      headers: { "x-activities-version": "2" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    const v2Activity = {
      id: "activity-1",
      tripId: String(trip.id),
      creatorId: "organizer",
      title: requestBody.name,
      description: requestBody.description,
      category: requestBody.category,
      date: "2024-06-01",
      startTime: "07:30",
      endTime: null,
      timezone: trip.timezone ?? "UTC",
      location: null,
      costPerPerson: null,
      maxParticipants: null,
      status: "scheduled" as const,
      visibility: "trip" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      invitees: [
        {
          activityId: "activity-1",
          userId: "organizer",
          role: "participant" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: { id: "organizer" },
        },
        {
          activityId: "activity-1",
          userId: "friend",
          role: "participant" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: { id: "friend" },
        },
      ],
      votes: [],
      rsvps: [
        {
          activityId: "activity-1",
          userId: "organizer",
          response: "yes" as const,
          respondedAt: new Date().toISOString(),
          user: { id: "organizer" },
        },
      ],
      creator: { id: "organizer", email: "org@example.com" },
      currentUserVote: null,
      currentUserRsvp: null,
    };

    const legacyActivity = {
      id: 987654321,
      tripCalendarId: trip.id,
      name: requestBody.name,
      description: requestBody.description,
      startTime: new Date("2024-06-01T07:30:00Z").toISOString(),
      endTime: null,
      location: null,
      cost: null,
      maxCapacity: null,
      category: requestBody.category,
      status: "active",
      type: "SCHEDULED",
      invites: [
        { userId: "organizer", status: "accepted", respondedAt: expect.any(String), user: { id: "organizer" } },
        { userId: "friend", status: "pending", respondedAt: null, user: { id: "friend" } },
      ],
    } as unknown as ActivityWithDetails;

    const createActivityV2Spy = jest
      .spyOn(activitiesV2Module, "createActivityV2")
      .mockResolvedValueOnce(v2Activity as any);

    jest
      .spyOn(activitiesV2Module, "convertActivitiesV2ToLegacy")
      .mockReturnValueOnce([legacyActivity]);

    const notificationSpy = jest
      .spyOn(storage, "createNotification")
      .mockResolvedValue(undefined as any);

    await handler(req, res);

    expect(createActivityV2Spy).toHaveBeenCalled();
    expect(notificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "friend", type: "activity_invite" }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: legacyActivity.id }));
  });

  it("returns 409 and existing activity data when the v2 pipeline deduplicates a request", async () => {
    const trip: TripWithDetails = {
      id: 404,
      createdBy: "organizer",
      members: [{ userId: "organizer", user: { firstName: "Org" } }],
    } as TripWithDetails;

    const requestBody = {
      name: "Duplicate Dinner",
      startTime: new Date("2024-08-01T19:00:00Z").toISOString(),
      attendeeIds: ["organizer"],
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      headers: { "x-activities-version": "2" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    const v2Activity = {
      id: "activity-duplicate",
      tripId: String(trip.id),
      creatorId: "organizer",
      title: requestBody.name,
      description: null,
      category: null,
      date: "2024-08-01",
      startTime: "19:00",
      endTime: null,
      timezone: "UTC",
      location: null,
      costPerPerson: null,
      maxParticipants: null,
      status: "scheduled" as const,
      visibility: "trip" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      invitees: [],
      votes: [],
      rsvps: [],
      creator: { id: "organizer" },
      currentUserVote: null,
      currentUserRsvp: null,
      wasDeduplicated: true,
    };

    const legacyActivity = {
      id: 555,
      tripCalendarId: trip.id,
      name: requestBody.name,
      type: "SCHEDULED",
      invites: [],
    } as unknown as ActivityWithDetails;

    jest
      .spyOn(activitiesV2Module, "createActivityV2")
      .mockResolvedValueOnce(v2Activity as any);

    jest
      .spyOn(activitiesV2Module, "convertActivitiesV2ToLegacy")
      .mockReturnValueOnce([legacyActivity]);

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "We already created this activity. Try refreshing.",
        activity: legacyActivity,
      }),
    );
  });

  it("allows inviting the trip creator even if they are not in the members list", async () => {
    const trip: TripWithDetails = {
      id: 505,
      createdBy: "trip-owner",
      members: [
        { userId: "organizer", user: { firstName: "Org", email: "org@example.com" } },
        { userId: "friend", user: { firstName: "Friend", email: "friend@example.com" } },
      ],
    } as TripWithDetails;

    const requestBody = {
      name: "Owner Dinner",
      startTime: new Date("2024-05-01T18:00:00Z").toISOString(),
      attendeeIds: ["trip-owner"],
      category: "dining",
    };

    const req: any = {
      params: { id: String(trip.id) },
      body: requestBody,
      session: { userId: "organizer" },
      headers: { "x-activities-version": "2" },
      isAuthenticated: jest.fn(() => true),
    };

    const res = createMockResponse();

    jest.spyOn(storage, "getTripById").mockResolvedValueOnce(trip as any);

    const v2Activity = {
      id: "activity-owner",
      tripId: String(trip.id),
      creatorId: "organizer",
      title: requestBody.name,
      description: null,
      category: requestBody.category,
      date: "2024-05-01",
      startTime: "18:00",
      endTime: null,
      timezone: "UTC",
      location: null,
      costPerPerson: null,
      maxParticipants: null,
      status: "scheduled" as const,
      visibility: "trip" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      invitees: [
        {
          activityId: "activity-owner",
          userId: "organizer",
          role: "participant" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: { id: "organizer" },
        },
        {
          activityId: "activity-owner",
          userId: "trip-owner",
          role: "participant" as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: { id: "trip-owner" },
        },
      ],
      votes: [],
      rsvps: [
        {
          activityId: "activity-owner",
          userId: "organizer",
          response: "yes" as const,
          respondedAt: new Date().toISOString(),
          user: { id: "organizer" },
        },
      ],
      creator: { id: "organizer" },
      currentUserVote: null,
      currentUserRsvp: null,
    };

    const legacyActivity = {
      id: 123456,
      tripCalendarId: trip.id,
      name: requestBody.name,
      type: "SCHEDULED",
      invites: [
        { userId: "organizer", status: "accepted" },
        { userId: "trip-owner", status: "pending" },
      ],
    } as unknown as ActivityWithDetails;

    const createActivityV2Spy = jest
      .spyOn(activitiesV2Module, "createActivityV2")
      .mockResolvedValueOnce(v2Activity as any);

    jest
      .spyOn(activitiesV2Module, "convertActivitiesV2ToLegacy")
      .mockReturnValueOnce([legacyActivity]);

    jest.spyOn(storage, "createNotification").mockResolvedValue(undefined as any);

    await handler(req, res);

    expect(createActivityV2Spy).toHaveBeenCalledWith(
      expect.objectContaining({
        trip,
        body: expect.objectContaining({ invitee_ids: ["trip-owner"] }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: legacyActivity.id }));
  });
});

