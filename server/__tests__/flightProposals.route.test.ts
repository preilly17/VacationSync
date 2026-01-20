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
let ensureFlightProposalMock: jest.SpyInstance;

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

describe("POST /api/trips/:tripId/proposals/flights", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/trips/:tripId/proposals/flights", "post");

    ensureFlightProposalMock = jest.spyOn(
      storageModule.storage,
      "ensureFlightProposalForSavedFlight",
    );
  });

  afterEach(async () => {
    ensureFlightProposalMock.mockRestore();

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("returns validation details when flightId is missing", async () => {
    const req: any = {
      params: { tripId: "16" },
      body: {},
      session: { userId: "user-1" },
      headers: { "x-correlation-id": "corr-123" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("x-correlation-id", "corr-123");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Invalid flight data",
        correlationId: "corr-123",
        issues: expect.any(Array),
        received: { flightId: null },
      }),
    );
  });

  it("proposes a saved flight when flightId is provided", async () => {
    ensureFlightProposalMock.mockResolvedValue({
      proposal: { id: 99, tripId: 16, flightId: 123 },
      wasCreated: true,
      flightId: 123,
    });

    const req: any = {
      params: { tripId: "16" },
      body: { flightId: 123 },
      session: { userId: "user-1" },
      headers: { "x-correlation-id": "corr-456" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(ensureFlightProposalMock).toHaveBeenCalledWith({
      flightId: 123,
      tripId: 16,
      currentUserId: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 99, tripId: 16, flightId: 123 });
  });
});

describe("POST /api/trips/:tripId/proposals", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/trips/:tripId/proposals", "post");

    ensureFlightProposalMock = jest.spyOn(
      storageModule.storage,
      "ensureFlightProposalForSavedFlight",
    );
  });

  afterEach(async () => {
    ensureFlightProposalMock.mockRestore();

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("returns validation details when proposal payload is missing", async () => {
    const req: any = {
      params: { tripId: "22" },
      body: {},
      session: { userId: "user-22" },
      headers: { "x-correlation-id": "corr-222" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("x-correlation-id", "corr-222");
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Invalid proposal data",
        correlationId: "corr-222",
        issues: expect.any(Array),
      }),
    );
  });

  it("creates a flight proposal when type and entityId are provided", async () => {
    ensureFlightProposalMock.mockResolvedValue({
      proposal: { id: 120, tripId: 22, flightId: 321 },
      wasCreated: true,
      flightId: 321,
    });

    const req: any = {
      params: { tripId: "22" },
      body: { type: "flight", entityId: 321 },
      session: { userId: "user-22" },
      headers: { "x-correlation-id": "corr-223" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(ensureFlightProposalMock).toHaveBeenCalledWith({
      flightId: 321,
      tripId: 22,
      currentUserId: "user-22",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 120, tripId: 22, flightId: 321 });
  });

  it("returns 200 when an open proposal already exists", async () => {
    ensureFlightProposalMock.mockResolvedValue({
      proposal: { id: 121, tripId: 22, flightId: 321 },
      wasCreated: false,
      flightId: 321,
    });

    const req: any = {
      params: { tripId: "22" },
      body: { type: "flight", entityId: 321 },
      session: { userId: "user-22" },
      headers: { "x-correlation-id": "corr-224" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ id: 121, tripId: 22, flightId: 321 });
  });
});

describe("GET /api/trips/:tripId/proposals", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;
  let getFlightProposalsMock: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/trips/:tripId/proposals", "get");

    getFlightProposalsMock = jest.spyOn(
      storageModule.storage,
      "getTripFlightProposals",
    );
  });

  afterEach(async () => {
    getFlightProposalsMock.mockRestore();

    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("filters flight proposals by status and current user", async () => {
    getFlightProposalsMock.mockResolvedValue([
      { id: 8, tripId: 22, flightId: 321, status: "open" },
    ]);

    const req: any = {
      params: { tripId: "22" },
      query: { type: "flight", status: "OPEN", createdBy: "me" },
      session: { userId: "user-22" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(getFlightProposalsMock).toHaveBeenCalledWith(22, "user-22", {
      proposedBy: "user-22",
      status: "OPEN",
    });
    expect(res.json).toHaveBeenCalledWith([
      { id: 8, tripId: 22, flightId: 321, status: "open" },
    ]);
  });
});
