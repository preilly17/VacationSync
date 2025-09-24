import express, { type Request, Response, NextFunction } from "express";
import cors, { type CorsOptions } from "cors";
import { setupRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createSessionMiddleware } from "./sessionAuth";
import { storage } from "./storage";

const app = express();
app.set("trust proxy", 1);

const defaultClientUrl = process.env.CLIENT_URL ?? "http://localhost:3000";
const allowedOrigins = Array.from(
  new Set(
    [
      process.env.CORS_ORIGINS,
      process.env.CORS_ORIGIN,
      defaultClientUrl,
      "https://vacation-sync-urgg.vercel.app",
      "http://localhost:3000",
      "https://www.tripsyncbeta.com",
    ]
      .filter(Boolean)
      .flatMap((originString) => originString!.split(","))
      .map((origin) => origin.trim())
      .filter(Boolean)
  )
);

const corsOptions: CorsOptions = {
  origin: allowedOrigins,
  credentials: true,
};

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
    await storage.ensureTripCoverPhotoColumn();
    log("🖼️ Trip cover photo column ready");
  } catch (error) {
    log(`⚠️ Failed to ensure trip cover photo column: ${error}`);
  }

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




