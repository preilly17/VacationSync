import express, { type Request, Response, NextFunction } from "express";
import session from "express-session"; // ✅ add import
import { setupRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedTravelTipsDatabase } from "./travelTipsService";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Add session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretfallback",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

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
    await seedTravelTipsDatabase();
    log("🌱 Travel tips database initialization completed");
  } catch (error) {
    log(`❌ Failed to initialize travel tips database: ${error}`);
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




