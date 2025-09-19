import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"), // still point to client
build: {
  outDir: "dist", // ✅ relative to client → ends up in VacationSync/dist
  emptyOutDir: true,
},

  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    proxy: {
      "/health": "http://127.0.0.1:3000",
      "/search": "http://127.0.0.1:3000",
    },
  },
});
