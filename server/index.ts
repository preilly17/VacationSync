import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { setupRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createSessionMiddleware } from "./sessionAuth";
import { storage } from "./storage";
import { createCorsOptions } from "./corsConfig";

const app = express();
app.set("trust proxy", 1);

const defaultClientUrl = process.env.CLIENT_URL ?? "http://localhost:3000";

const parseOrigins = (value?: string | null) =>
  value
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const envConfiguredOrigins = new Set([
  ...parseOrigins(process.env.CORS_ORIGINS),
  ...parseOrigins(process.env.CORS_ORIGIN),
  ...parseOrigins(process.env.CLIENT_URL),
]);

const defaultOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://www.tripsyncbeta.com",
  "https://tripsyncbeta.com",
]);

if (defaultClientUrl) {
  defaultOrigins.add(defaultClientUrl);
}

const allowedOrigins = envConfiguredOrigins.size
  ? Array.from(envConfiguredOrigins)
  : Array.from(defaultOrigins);

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

const normalizedAllowedOrigins = new Set(
  allowedOrigins
    .map((origin) => parseOriginValue(origin)?.normalized)
    .filter((value): value is string => Boolean(value)),
);

const isTripsyncBetaDomain = (hostname: string) =>
  hostname === "tripsyncbeta.com" || hostname.endsWith(".tripsyncbeta.com");

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

// ✅ FIXED CORS CONFIG
app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(createSessionMiddleware());

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Setup routes first
const server = setupRoutes(app);

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  log(`❌ Error: ${message}`);
});

// ✅ Always start server, even if DB or Vite fails
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const host = "0.0.0.0";
server.listen({ port, host, reusePort: true }, () => {
  log(`🚀 Server running on http://${host}:${port}`);
});

// Run setup tasks *after* server starts
(async () => {
  try {
    await storage.initializeWishList();
    log("📝 Wish list tables ready");
  } catch (error) {
    log(`❌ Failed to initialize wish list tables: ${error}`);
  }

  try {
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
  } catch (error) {
    log(`⚠️ Vite/static setup failed: ${error}`);
  }
})();
