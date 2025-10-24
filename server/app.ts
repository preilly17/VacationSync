import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors, { type CorsOptions } from "cors";

import { setupRoutes } from "./routes";
import { createSessionMiddleware } from "./sessionAuth";
import { createCorsOptions } from "./corsConfig";
import { log } from "./vite";

const parseOrigins = (value?: string | null): string[] =>
  value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://www.tripsyncbeta.com",
  "https://tripsyncbeta.com",
];

type ParsedOrigin = {
  normalized: string;
  hostname: string;
};

const parseOriginValue = (origin: string): ParsedOrigin | null => {
  const trimmed = origin.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    const protocol = url.protocol.toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      return null;
    }

    const hostname = url.hostname.toLowerCase();
    const isHttps = protocol === "https:";
    const defaultPort = isHttps ? "443" : "80";
    const port = url.port && url.port !== defaultPort ? `:${url.port}` : "";

    return {
      normalized: `${protocol}//${hostname}${port}`,
      hostname,
    };
  } catch {
    const lower = trimmed.toLowerCase();
    return {
      normalized: lower,
      hostname: lower,
    };
  }
};

const isTripsyncBetaDomain = (hostname: string): boolean =>
  hostname === "tripsyncbeta.com" || hostname.endsWith(".tripsyncbeta.com");

export type CorsState = {
  isOriginAllowed: (origin?: string | null) => boolean;
  allowedOrigins: string[];
  corsOptions: CorsOptions;
};

const buildCorsState = (): CorsState => {
  const defaultClientUrl = process.env.CLIENT_URL ?? "http://localhost:3000";

  const envConfiguredOrigins = new Set([
    ...parseOrigins(process.env.CORS_ORIGINS),
    ...parseOrigins(process.env.CORS_ORIGIN),
    ...parseOrigins(process.env.CLIENT_URL),
  ]);

  const defaultOrigins = new Set(DEFAULT_ORIGINS);

  if (defaultClientUrl) {
    defaultOrigins.add(defaultClientUrl);
  }

  const allowedOrigins = envConfiguredOrigins.size
    ? Array.from(envConfiguredOrigins)
    : Array.from(defaultOrigins);

  const normalizedAllowedOrigins = new Set(
    allowedOrigins
      .map((origin) => parseOriginValue(origin)?.normalized)
      .filter((value): value is string => Boolean(value)),
  );

  const isOriginAllowed = (origin?: string | null): boolean => {
    if (!origin) {
      return true;
    }

    const parsed = parseOriginValue(origin);
    if (!parsed) {
      return false;
    }

    if (normalizedAllowedOrigins.has(parsed.normalized)) {
      return true;
    }

    if (isTripsyncBetaDomain(parsed.hostname)) {
      return true;
    }

    return false;
  };

  const corsOptions = createCorsOptions(isOriginAllowed);

  return {
    isOriginAllowed,
    allowedOrigins,
    corsOptions,
  };
};

export type CreateAppResult = {
  app: Express;
  server: import("http").Server;
  corsOptions: CorsOptions;
  isOriginAllowed: (origin?: string | null) => boolean;
  allowedOrigins: string[];
};

export const createApp = (): CreateAppResult => {
  const app = express();
  app.set("trust proxy", 1);

  const { corsOptions, isOriginAllowed, allowedOrigins } = buildCorsState();

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use(createSessionMiddleware());

  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined;

    const originalResJson = res.json.bind(res);
    res.json = function jsonWithCapture(bodyJson: Record<string, any>, ...args: any[]) {
      capturedJsonResponse = bodyJson;
      return originalResJson(bodyJson, ...args);
    } as typeof res.json;

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = `${logLine.slice(0, 79)}…`;
        }

        log(logLine);
      }
    });

    next();
  });

  const server = setupRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    log(`❌ Error: ${message}`);
  });

  return {
    app,
    server,
    corsOptions,
    isOriginAllowed,
    allowedOrigins,
  };
};

export const __testables__ = {
  parseOrigins,
  parseOriginValue,
  buildCorsState,
  isTripsyncBetaDomain,
};

