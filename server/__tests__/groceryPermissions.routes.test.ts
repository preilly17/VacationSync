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

const CREATOR_ONLY_MESSAGE = "Only the creator can edit or cancel this.";
const TRIP_ACCESS_DENIED_MESSAGE = "Trip not found";

let setupRoutes: (app: express.Express) => import("http").Server;
let storageModule: typeof import("../storage");

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
  res.send = jest.fn().mockReturnValue(res);
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

describe("PATCH /api/groceries/:id", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/groceries/:id", "patch");
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("allows creators to update grocery items", async () => {
    const updateMock = jest
      .spyOn(storageModule.storage, "updateGroceryItem")
      .mockResolvedValue({
        id: 1,
        tripId: 9,
        addedBy: "user-123",
        item: "Apples",
        category: "general",
        quantity: null,
        estimatedCost: null,
        notes: null,
        isPurchased: false,
        actualCost: null,
        receiptLineItem: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    const getMock = jest
      .spyOn(storageModule.storage, "getGroceryItemWithDetails")
      .mockResolvedValue({
        id: 1,
        tripId: 9,
        addedBy: "user-123",
        item: "Apples",
        category: "general",
        quantity: null,
        estimatedCost: null,
        notes: null,
        isPurchased: false,
        actualCost: null,
        receiptLineItem: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        participants: [],
      });

    const req: any = {
      params: { id: "1" },
      body: { item: "Apples" },
      session: { userId: "user-123" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(updateMock).toHaveBeenCalledWith(1, { item: "Apples" }, "user-123");
    expect(getMock).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalled();
  });

  it("returns 403 when a non-creator updates a grocery item", async () => {
    jest
      .spyOn(storageModule.storage, "updateGroceryItem")
      .mockRejectedValue(new Error(CREATOR_ONLY_MESSAGE));

    const req: any = {
      params: { id: "2" },
      body: { item: "Milk" },
      session: { userId: "user-456" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: CREATOR_ONLY_MESSAGE });
  });

  it("returns 404 when a non-member updates a grocery item", async () => {
    jest
      .spyOn(storageModule.storage, "updateGroceryItem")
      .mockRejectedValue(new Error("Trip membership required"));

    const req: any = {
      params: { id: "3" },
      body: { item: "Bread" },
      session: { userId: "user-789" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: TRIP_ACCESS_DENIED_MESSAGE });
  });
});

describe("DELETE /api/groceries/:id", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/groceries/:id", "delete");
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("allows creators to delete grocery items", async () => {
    const deleteMock = jest
      .spyOn(storageModule.storage, "deleteGroceryItem")
      .mockResolvedValue();

    const req: any = {
      params: { id: "4" },
      session: { userId: "user-123" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(deleteMock).toHaveBeenCalledWith(4, "user-123");
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it("returns 403 when a non-creator deletes a grocery item", async () => {
    jest
      .spyOn(storageModule.storage, "deleteGroceryItem")
      .mockRejectedValue(new Error(CREATOR_ONLY_MESSAGE));

    const req: any = {
      params: { id: "5" },
      session: { userId: "user-456" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: CREATOR_ONLY_MESSAGE });
  });

  it("returns 404 when a non-member deletes a grocery item", async () => {
    jest
      .spyOn(storageModule.storage, "deleteGroceryItem")
      .mockRejectedValue(new Error("Trip membership required"));

    const req: any = {
      params: { id: "6" },
      session: { userId: "user-999" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: TRIP_ACCESS_DENIED_MESSAGE });
  });
});

describe("DELETE /api/wish-list/:ideaId/comments/:commentId", () => {
  let app: express.Express;
  let httpServer: import("http").Server;
  let handler: RouteHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    httpServer = setupRoutes(app);
    handler = findRouteHandler(app, "/api/wish-list/:ideaId/comments/:commentId", "delete");
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("allows comment creators to delete their own comments", async () => {
    const deleteMock = jest
      .spyOn(storageModule.storage, "deleteWishListComment")
      .mockResolvedValue();

    const req: any = {
      params: { ideaId: "10", commentId: "99" },
      session: { userId: "user-123" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(deleteMock).toHaveBeenCalledWith(10, 99, "user-123");
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });

  it("returns 403 when deleting someone else's comment", async () => {
    jest
      .spyOn(storageModule.storage, "deleteWishListComment")
      .mockRejectedValue(new Error(CREATOR_ONLY_MESSAGE));

    const req: any = {
      params: { ideaId: "10", commentId: "100" },
      session: { userId: "user-456" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: CREATOR_ONLY_MESSAGE });
  });

  it("returns 404 when a non-member deletes a comment", async () => {
    jest
      .spyOn(storageModule.storage, "deleteWishListComment")
      .mockRejectedValue(new Error("Trip membership required"));

    const req: any = {
      params: { ideaId: "10", commentId: "101" },
      session: { userId: "user-789" },
    };
    const res = createMockResponse();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: TRIP_ACCESS_DENIED_MESSAGE });
  });
});
