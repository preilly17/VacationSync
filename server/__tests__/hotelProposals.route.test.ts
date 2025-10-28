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
let createHotelMock: jest.SpyInstance;
let ensureHotelProposalMock: jest.SpyInstance;

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
    isAuthenticated: (_req: any, _res: any, next: any) => next(),
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

describe("POST /api/trips/:tripId/proposals/hotels", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/trips/:tripId/proposals/hotels", "post");

    createHotelMock = jest.spyOn(storageModule.storage, "createHotel");
    ensureHotelProposalMock = jest.spyOn(
      storageModule.storage,
      "ensureHotelProposalForSavedHotel",
    );
  });

  afterEach(async () => {
    createHotelMock.mockRestore();
    ensureHotelProposalMock.mockRestore();

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("creates a hotel before proposing when no hotelId is supplied", async () => {
    const checkInDate = new Date("2024-06-01T15:00:00Z").toISOString();
    const checkOutDate = new Date("2024-06-05T11:00:00Z").toISOString();

    createHotelMock.mockResolvedValueOnce({
      id: 77,
      tripId: 10,
    });

    ensureHotelProposalMock.mockResolvedValueOnce({
      id: 991,
      hotelId: 77,
      tripId: 10,
    });

    const req: any = {
      params: { tripId: "10" },
      body: {
        tripId: 1,
        hotelName: "Riverside Inn",
        address: "500 River Rd",
        city: "Portland",
        country: "USA",
        checkInDate,
        checkOutDate,
        guestCount: 2,
        roomCount: 1,
        status: "tentative",
        currency: "USD",
      },
      session: { userId: "test-user" },
      user: { id: "test-user" },
      headers: {},
      get: jest.fn(),
      header: jest.fn(),
    };

    const res = createMockResponse();

    await handler(req, res);

    expect(createHotelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 10,
        hotelName: "Riverside Inn",
        address: "500 River Rd",
        city: "Portland",
        country: "USA",
      }),
      "test-user",
    );

    expect(ensureHotelProposalMock).toHaveBeenCalledWith({
      hotelId: 77,
      tripId: 10,
      currentUserId: "test-user",
    });

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 991,
        hotelId: 77,
        tripId: 10,
      }),
    );
  });
});
