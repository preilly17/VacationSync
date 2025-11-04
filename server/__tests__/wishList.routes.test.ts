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
let storageModule: typeof import("../storage");

const createDate = (value: string) => new Date(value);

const findRouteHandler = (
  app: express.Express,
  path: string,
  method: "get" | "post" | "put" | "delete" | "patch",
): RouteHandler => {
  const stack = ((app as unknown as { _router?: { stack?: any[] } })._router?.stack ?? []) as any[];

  for (const layer of stack) {
    if (layer?.route?.path === path && layer.route?.methods?.[method]) {
      const handlers = layer.route.stack ?? [];
      const last = handlers[handlers.length - 1];
      if (!last) {
        throw new Error(`No handlers found for ${method.toUpperCase()} ${path}`);
      }
      return last.handle as RouteHandler;
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

  await jest.unstable_mockModule("../db", () => ({
    __esModule: true,
    pool: {
      connect: jest.fn(),
      query: jest.fn(),
      end: jest.fn(),
    },
    query: jest.fn(),
  }));

  await jest.unstable_mockModule("../sessionAuth", () => ({
    __esModule: true,
    setupAuth: jest.fn(),
    createSessionMiddleware: () => (req: any, _res: any, next: any) => {
      req.session = req.session ?? {};
      return next();
    },
    isAuthenticated: (req: any, _res: any, next: any) => {
      req.session = req.session ?? {};
      req.session.userId = req.session.userId ?? "user-123";
      req.user = { ...(req.user ?? {}), id: req.session.userId };
      next();
    },
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
});

describe("POST /api/trips/:tripId/wish-list", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/trips/:tripId/wish-list", "post");
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("falls back to the base idea when the detailed lookup fails", async () => {
    const createdAt = createDate("2024-01-02T03:04:05Z");
    const updatedAt = createDate("2024-01-03T04:05:06Z");

    const isTripMemberMock = jest
      .spyOn(storageModule.storage, "isTripMember")
      .mockResolvedValue(true);
    const createIdeaMock = jest
      .spyOn(storageModule.storage, "createWishListIdea")
      .mockResolvedValue({
        id: 55,
        tripId: 42,
        title: "Late-night ramen",
        url: null,
        notes: null,
        tags: [],
        thumbnailUrl: null,
        imageUrl: null,
        metadata: null,
        createdBy: "user-123",
        promotedDraftId: null,
        createdAt,
        updatedAt,
      });
    const detailedLookupMock = jest
      .spyOn(storageModule.storage, "getWishListIdeaForUser")
      .mockResolvedValue(undefined);
    const getUserMock = jest.spyOn(storageModule.storage, "getUser").mockResolvedValue({
      id: "user-123",
      email: "user@example.com",
      username: "user123",
      firstName: "User",
      lastName: "Example",
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
      createdAt: null,
      updatedAt: null,
    });
    const isTripAdminMock = jest
      .spyOn(storageModule.storage, "isTripAdmin")
      .mockResolvedValue(false);

    const req: any = {
      params: { tripId: "42" },
      body: { title: "Late-night ramen" },
      session: { userId: "user-123" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(isTripMemberMock).toHaveBeenCalledWith(42, "user-123");
    expect(createIdeaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 42,
        title: "Late-night ramen",
      }),
      "user-123",
    );
    expect(detailedLookupMock).toHaveBeenCalledWith(55, "user-123");
    expect(getUserMock).toHaveBeenCalledWith("user-123");
    expect(isTripAdminMock).toHaveBeenCalledWith(42, "user-123");

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      idea: {
        id: 55,
        tripId: 42,
        title: "Late-night ramen",
        url: null,
        notes: null,
        tags: [],
        thumbnailUrl: null,
        imageUrl: null,
        metadata: null,
        createdBy: "user-123",
        promotedDraftId: null,
        createdAt: createdAt,
        updatedAt: updatedAt,
        creator: {
          id: "user-123",
          email: "user@example.com",
          username: "user123",
          firstName: "User",
          lastName: "Example",
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
          createdAt: null,
          updatedAt: null,
        },
        saveCount: 0,
        commentCount: 0,
        currentUserSaved: false,
        canDelete: true,
      },
    });

    isTripMemberMock.mockRestore();
    createIdeaMock.mockRestore();
    detailedLookupMock.mockRestore();
    getUserMock.mockRestore();
    isTripAdminMock.mockRestore();
  });
});

describe("GET /api/trips/:tripId/wish-list", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/trips/:tripId/wish-list", "get");
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("includes membership metadata in the response", async () => {
    const createdAt = createDate("2024-04-01T10:00:00Z");
    const updatedAt = createDate("2024-04-02T10:00:00Z");

    const isTripMemberMock = jest
      .spyOn(storageModule.storage, "isTripMember")
      .mockResolvedValue(false);
    const isTripAdminMock = jest
      .spyOn(storageModule.storage, "isTripAdmin")
      .mockResolvedValue(false);
    const getIdeasMock = jest
      .spyOn(storageModule.storage, "getTripWishListIdeas")
      .mockResolvedValue([
        {
          id: 7,
          tripId: 42,
          title: "Hidden speakeasy",
          url: null,
          notes: null,
          tags: ["Nightlife"],
          thumbnailUrl: null,
          imageUrl: null,
          metadata: null,
          createdBy: "user-1",
          promotedDraftId: null,
          createdAt,
          updatedAt,
          creator: {
            id: "user-1",
            email: "user@example.com",
            username: "user1",
            firstName: "User",
            lastName: "Example",
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
            createdAt: null,
            updatedAt: null,
          },
          saveCount: 0,
          commentCount: 0,
          currentUserSaved: false,
        },
      ]);

    const req: any = {
      params: { tripId: "42" },
      query: {},
      session: { userId: "user-123" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(isTripMemberMock).toHaveBeenCalledWith(42, "user-123");
    expect(isTripAdminMock).not.toHaveBeenCalled();
    expect(getIdeasMock).toHaveBeenCalledWith(42, "user-123", {
      sort: "newest",
      tag: null,
      submittedBy: null,
      search: null,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({
          isAdmin: false,
          isMember: false,
          sort: "newest",
        }),
      }),
    );

    isTripMemberMock.mockRestore();
    isTripAdminMock.mockRestore();
    getIdeasMock.mockRestore();
  });
});
