import express, { type Request, Response, NextFunction } from "express";
import { setupRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { seedTravelTipsDatabase } from "./travelTipsService";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

(async () => {
  // Initialize travel tips database with seed data
  try {
    await seedTravelTipsDatabase();
    log("🌱 Travel tips database initialization completed");
  } catch (error) {
    log(`❌ Failed to initialize travel tips database: ${error}`);
  }

  const server = setupRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    // Only setup Vite in development
    await setupVite(app, server);
  } else {
    // Serve static frontend in production
    serveStatic(app);
  }

  // ✅ Use Render's PORT if available, fallback to 5000 for local dev
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  const host = "0.0.0.0";

  server.listen(
    {
      port,
      host,
      reusePort: true,
    },
    () => {
      log(`🚀 Server running on http://${host}:${port}`);
    }
  );
})();

