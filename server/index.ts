import { setupVite, serveStatic, log } from "./vite";
import { storage } from "./storage";
import { createApp } from "./app";

const { app, server } = createApp();

const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5000;
const host = "0.0.0.0";

server.listen({ port, host, reusePort: true }, () => {
  log(`🚀 Server running on http://${host}:${port}`);
});

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
