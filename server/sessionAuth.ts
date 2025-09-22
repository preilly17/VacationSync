import type { Express, RequestHandler } from "express";
import session, { type CookieOptions, type SessionOptions } from "express-session";
import connectPg from "connect-pg-simple";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

declare module "express-session" {
  interface SessionData {
    userId?: string;
    authProvider?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
      user?: {
        id: string;
        [key: string]: unknown;
      };
    }
  }
}

const PgStore = connectPg(session);

function buildSessionOptions(): SessionOptions {
  const isProduction = process.env.NODE_ENV === "production";
  const sameSite = (process.env.SESSION_COOKIE_SAMESITE as "lax" | "none" | "strict" | undefined)
    ?? (isProduction ? "none" : "lax");
  const cookieDomain = process.env.SESSION_COOKIE_DOMAIN;

  const cookie: CookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite,
    maxAge: ONE_WEEK_MS,
  };

  if (cookieDomain) {
    cookie.domain = cookieDomain;
  }

  const options: SessionOptions = {
    secret: process.env.SESSION_SECRET || "supersecretfallback",
    resave: false,
    saveUninitialized: false,
    cookie,
    rolling: false,
    proxy: true,
  };

  if (process.env.DATABASE_URL) {
    options.store = new PgStore({
      conString: process.env.DATABASE_URL,
      tableName: "sessions",
      createTableIfMissing: false,
    });
  } else {
    console.warn("⚠️ DATABASE_URL is not set; falling back to in-memory session storage");
  }

  return options;
}

export function createSessionMiddleware() {
  return session(buildSessionOptions());
}

const attachSessionHelpers: RequestHandler = (req, _res, next) => {
  if (typeof req.isAuthenticated !== "function") {
    req.isAuthenticated = () => Boolean(req.session?.userId);
  }

  if (req.session?.userId) {
    req.user = {
      ...(req.user ?? {}),
      id: req.session.userId,
    };
  }

  next();
};

export function setupAuth(app: Express) {
  app.use(attachSessionHelpers);

  app.get("/api/login", (_req, res) => {
    res.status(400).json({
      message: "Password-based login is handled by the frontend application.",
      redirect: "/login",
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (process.env.NODE_ENV === "development" && !req.session?.userId) {
    req.user = {
      id: "demo-user",
    };
    return next();
  }

  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = {
    ...(req.user ?? {}),
    id: req.session.userId,
  };

  return next();
};
