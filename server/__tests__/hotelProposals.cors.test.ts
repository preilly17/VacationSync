import request from "supertest";
import type { Express, NextFunction } from "express";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

let createApp: typeof import("../app").createApp;
let storageModule: any;

beforeAll(async () => {
  jest.resetModules();
  process.env.CLIENT_URL = "http://localhost:3000";
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

  const sessionUserId = "test-user";

  await jest.unstable_mockModule("../sessionAuth", () => ({
    __esModule: true,
    setupAuth: jest.fn(),
    createSessionMiddleware: () => (req: any, _res: any, next: NextFunction) => {
      req.session = req.session ?? {};
      return next();
    },
    isAuthenticated: (req: any, _res: any, next: NextFunction) => {
      req.session = req.session ?? {};
      req.session.userId = sessionUserId;
      req.user = { ...(req.user ?? {}), id: sessionUserId };
      return next();
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

  const storageSpies: Record<string | symbol, jest.Mock> = {};
  const storageProxy = new Proxy(storageSpies, {
    get(target, prop: string | symbol) {
      if (!target[prop]) {
        target[prop] = jest.fn();
      }
      return target[prop];
    },
  });

  storageSpies.ensureHotelProposalForSavedHotel = jest.fn().mockResolvedValue({
    proposal: {
      id: 42,
      tripId: 10,
      hotelName: "Test Hotel",
    },
    wasCreated: true,
    stayId: 123,
  });

  storageSpies.getTripHotelProposals = jest.fn().mockResolvedValue([]);

  await jest.unstable_mockModule("../storage", () => ({
    __esModule: true,
    storage: storageProxy,
    ActivityInviteMembershipError: class ActivityInviteMembershipError extends Error {},
    ActivityDuplicateError: class ActivityDuplicateError extends Error {},
  }));

  const appModule = await import("../app");
  createApp = appModule.createApp;
  storageModule = { storage: storageProxy };
});

describe("Hotel proposal CORS", () => {
  let app: Express;
  let httpServer: import("http").Server;

  beforeEach(() => {
    jest.clearAllMocks();
    const result = createApp();
    app = result.app;
    httpServer = result.server;

    storageModule.storage.ensureHotelProposalForSavedHotel.mockResolvedValue({
      proposal: {
        id: 101,
        tripId: 10,
        hotelName: "Mock Stay",
      },
      wasCreated: true,
      stayId: 55,
    });
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("returns the expected headers for hotel proposal preflight", async () => {
    const response = await request(app)
      .options("/api/trips/10/proposals/hotels")
      .set("Origin", "https://www.tripsyncbeta.com")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,authorization")
      .expect(204);

    expect(response.headers["access-control-allow-origin"]).toBe("https://www.tripsyncbeta.com");

    const allowMethods = response.headers["access-control-allow-methods"];
    expect(typeof allowMethods).toBe("string");
    expect(allowMethods).toContain("POST");

    const allowHeaders = response.headers["access-control-allow-headers"];
    expect(typeof allowHeaders).toBe("string");
    expect(allowHeaders.toLowerCase()).toContain("authorization");
    expect(allowHeaders.toLowerCase()).toContain("x-activities-version");
  });

  it("mirrors the origin header on hotel proposal POST", async () => {
    const response = await request(app)
      .post("/api/trips/10/proposals/hotels")
      .set("Origin", "https://www.tripsyncbeta.com")
      .set("Authorization", "Bearer demo")
      .set("Content-Type", "application/json")
      .send({ hotelId: 55 });

    expect(response.headers["access-control-allow-origin"]).toBe("https://www.tripsyncbeta.com");
    expect([200, 201, 204, 400, 401, 403, 404]).toContain(response.status);
  });

  it("rejects origins that are not on the allow list", async () => {
    await request(app)
      .options("/api/trips/10/proposals/hotels")
      .set("Origin", "https://malicious.example.com")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,authorization")
      .expect(500);
  });
});

