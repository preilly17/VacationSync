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
let createHotelProposalMock: jest.SpyInstance;
let getTripByIdMock: jest.SpyInstance;
let isTripMemberMock: jest.SpyInstance;
let getTripHotelProposalsMock: jest.SpyInstance;

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
    createHotelProposalMock = jest.spyOn(storageModule.storage, "createHotelProposal");
    getTripByIdMock = jest.spyOn(storageModule.storage, "getTripById");
    isTripMemberMock = jest.spyOn(storageModule.storage, "isTripMember");
    getTripHotelProposalsMock = jest.spyOn(storageModule.storage, "getTripHotelProposals");
    getTripByIdMock.mockResolvedValue({ id: 10 });
    isTripMemberMock.mockResolvedValue(true);
    getTripHotelProposalsMock.mockResolvedValue([]);
  });

  afterEach(async () => {
    createHotelMock.mockRestore();
    ensureHotelProposalMock.mockRestore();
    createHotelProposalMock.mockRestore();
    getTripHotelProposalsMock.mockRestore();

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
      proposal: {
        id: 991,
        tripId: 10,
        hotelName: "Riverside Inn",
      },
      wasCreated: true,
      stayId: 77,
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

    expect(isTripMemberMock).toHaveBeenCalledWith(10, "test-user");
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
      overrideDetails: expect.objectContaining({
        hotelName: "Riverside Inn",
        address: "500 River Rd",
        city: "Portland",
        country: "USA",
      }),
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 991,
        tripId: 10,
        hotelName: "Riverside Inn",
      }),
    );
  });

  it("returns a 400 with details when the saved stay is missing required data", async () => {
    ensureHotelProposalMock.mockRejectedValueOnce(
      new Error(
        "Saved stay is missing required details: hotel name, address, city, check-in date. Add them before sharing with the group.",
      ),
    );

    const req: any = {
      params: { tripId: "10" },
      body: { hotelId: 77 },
      session: { userId: "test-user" },
      user: { id: "test-user" },
      headers: {},
      get: jest.fn(),
      header: jest.fn(),
    };

    const res = createMockResponse();

    await handler(req, res);

    expect(ensureHotelProposalMock).toHaveBeenCalledWith({
      hotelId: 77,
      tripId: 10,
      currentUserId: "test-user",
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Saved stay is missing required details: hotel name, address, city, check-in date. Add them before sharing with the group.",
    });
  });

  it("normalizes price strings before creating a fallback proposal", async () => {
    createHotelProposalMock.mockResolvedValueOnce({
      id: 991,
      tripId: 10,
    });

    const req: any = {
      params: { tripId: "10" },
      body: {
        tripId: 10,
        hotelName: "Oceanview Resort",
        location: "Miami, USA",
        price: "$1,234 total",
        pricePerNight: "$567/night",
        platform: "Amadeus",
        bookingUrl: "https://example.com/booking",
      },
      session: { userId: "test-user" },
      user: { id: "test-user" },
      headers: {},
      get: jest.fn(),
      header: jest.fn(),
    };

    const res = createMockResponse();

    await handler(req, res);

    expect(isTripMemberMock).toHaveBeenCalledWith(10, "test-user");
    expect(createHotelProposalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        price: "1234",
        pricePerNight: "567",
      }),
      "test-user",
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 991 }));
  });

  it("returns a 403 when proposing an unsaved stay without trip access", async () => {
    isTripMemberMock.mockResolvedValueOnce(false);
    getTripByIdMock.mockResolvedValueOnce({ id: 10 });

    const req: any = {
      params: { tripId: "10" },
      body: {
        tripId: 10,
        hotelName: "Oceanview Resort",
        location: "Miami, USA",
        price: "$1,234 total",
        pricePerNight: "$567/night",
        platform: "Amadeus",
        bookingUrl: "https://example.com/booking",
      },
      session: { userId: "test-user" },
      user: { id: "test-user" },
      headers: {},
      get: jest.fn(),
      header: jest.fn(),
    };

    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You must be a member of this trip to share stays with the group.",
    });
    expect(createHotelMock).not.toHaveBeenCalled();
    expect(createHotelProposalMock).not.toHaveBeenCalled();
  });

  it("returns a 404 when the target trip no longer exists", async () => {
    isTripMemberMock.mockResolvedValueOnce(false);
    getTripByIdMock.mockResolvedValueOnce(undefined);

    const req: any = {
      params: { tripId: "99" },
      body: {
        tripId: 99,
        hotelName: "Sunrise Suites",
        location: "Miami, USA",
        price: "$800",
        pricePerNight: "$200",
        platform: "Amadeus",
        bookingUrl: "https://example.com/booking",
      },
      session: { userId: "test-user" },
      user: { id: "test-user" },
      headers: {},
      get: jest.fn(),
      header: jest.fn(),
    };

    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Trip not found" });
    expect(createHotelMock).not.toHaveBeenCalled();
    expect(createHotelProposalMock).not.toHaveBeenCalled();
  });

  it("maps database constraint violations to a 400 during ad-hoc proposals", async () => {
    createHotelProposalMock.mockRejectedValueOnce({ code: "23503" });

    const req: any = {
      params: { tripId: "10" },
      body: {
        tripId: 10,
        hotelName: "Oceanview Resort",
        location: "Miami, USA",
        price: "$1,234 total",
        pricePerNight: "$567/night",
        platform: "Amadeus",
        bookingUrl: "https://example.com/booking",
      },
      session: { userId: "test-user" },
      user: { id: "test-user" },
      headers: {},
      get: jest.fn(),
      header: jest.fn(),
    };

    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to share this stay with your group. Refresh the trip and try again.",
    });
  });

  it("recovers existing hotel proposals even when stay IDs are strings", async () => {
    ensureHotelProposalMock.mockRejectedValueOnce({ code: "23505" });

    const existingProposal = {
      id: 512,
      tripId: 10,
      stayId: "77",
      hotelName: "Historic Inn",
    };

    getTripHotelProposalsMock.mockResolvedValueOnce([existingProposal]);

    const req: any = {
      params: { tripId: "10" },
      body: { hotelId: 77 },
      session: { userId: "test-user" },
      user: { id: "test-user" },
      headers: {},
      get: jest.fn(),
      header: jest.fn(),
    };

    const res = createMockResponse();

    await handler(req, res);

    expect(getTripHotelProposalsMock).toHaveBeenCalledWith(10, "test-user");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(existingProposal);
  });
});
