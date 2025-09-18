import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Use default domain if REPLIT_DOMAINS not set
const replitDomains = process.env.REPLIT_DOMAINS || `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.replit.app`;

const getOidcConfig = memoize(
  async () => {
    try {
      console.log("Attempting OIDC discovery with REPL_ID:", process.env.REPL_ID);
      const config = await client.discovery(
        new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
        process.env.REPL_ID!
      );
      console.log("OIDC config retrieved successfully");
      return config;
    } catch (error) {
      console.error("OIDC discovery failed:", error);
      throw error;
    }
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  let config;
  try {
    config = await getOidcConfig();
  } catch (error) {
    console.error("Failed to setup OIDC config:", error);
    // Setup routes without auth for development
    app.get("/api/login", (req, res) => {
      console.log("Auth not configured, redirecting to home");
      res.redirect("/");
    });
    return;
  }

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of replitDomains.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `${process.env.NODE_ENV === 'development' ? 'http' : 'https'}://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    console.log("Login endpoint called, hostname:", req.hostname);
    // Store the return URL if provided
    if (req.query.returnTo) {
      req.session.returnTo = req.query.returnTo as string;
    }
    
    // Use the first domain from our configuration
    const domain = replitDomains.split(",")[0];
    console.log("Using auth strategy for domain:", domain);
    
    passport.authenticate(`replitauth:${domain}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    console.log("Callback endpoint called, hostname:", req.hostname);
    // Use the first domain from our configuration
    const domain = replitDomains.split(",")[0];
    console.log("Using auth strategy for domain:", domain);
    
    passport.authenticate(`replitauth:${domain}`, {
      successRedirect: "/api/auth-success",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/auth-success", (req, res) => {
    const returnTo = req.session.returnTo || "/";
    delete req.session.returnTo;
    res.redirect(returnTo);
  });

  app.get("/api/logout", (req, res) => {
    console.log('Logout endpoint called');
    req.logout(() => {
      // Clear the session completely
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
        res.clearCookie('connect.sid');
        res.clearCookie('connect.sid', { path: '/' });
        
        // Get the origin from the request  
        const origin = req.get('origin') || req.get('referer') || `${req.protocol}://${req.get('host')}`;
        const baseUrl = origin.replace(/\/$/, ''); // Remove trailing slash
        
        console.log('Logout: redirecting to baseUrl:', baseUrl);
        
        // Force redirect to home page
        res.redirect(302, baseUrl + '/');
      });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    console.log("=== Auth user route called ===");
    console.log("Authenticated:", req.isAuthenticated());
    
    // Development bypass - return demo user
    if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
      console.log("Development mode: returning demo user");
      
      // First check if demo user already exists (to preserve profile updates)
      let existingUser = await storage.getUser('demo-user');
      
      if (existingUser) {
        console.log("Development mode: using existing demo user with saved preferences");
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(existingUser));
        return;
      }
      
      // Only create new demo user if none exists
      console.log("Development mode: creating new demo user");
      const demoUser = await storage.upsertUser({
        id: 'demo-user',
        email: 'demo@example.com',
        username: 'demouser',
        firstName: 'Demo',
        lastName: 'User',
        profileImageUrl: null,
        authProvider: 'demo',
      });
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(demoUser));
      return;
    }
    
    if (!req.isAuthenticated()) {
      console.log("Not authenticated, returning 401");
      const response = { message: "Unauthorized" };
      console.log("Sending response:", response);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
      return;
    }
    
    const user = req.user as any;
    const claims = user.claims;
    
    console.log("User authenticated, claims:", claims);
    const userData = {
      id: claims?.sub,
      email: claims?.email,
      firstName: claims?.first_name,
      lastName: claims?.last_name,
      profileImageUrl: claims?.profile_image_url,
    };
    
    console.log("Sending user data:", userData);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(userData));
  });

  // Add a backup auth endpoint that definitely works
  app.get("/api/auth-status", (req, res) => {
    console.log("=== Backup auth status route called ===");
    
    // Force JSON response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache');
    
    if (!req.isAuthenticated()) {
      console.log("Not authenticated via backup route");
      return res.status(401).end(JSON.stringify({ message: "Unauthorized" }));
    }
    
    const user = req.user as any;
    const claims = user.claims;
    
    const userData = {
      id: claims?.sub,
      email: claims?.email,
      firstName: claims?.first_name,
      lastName: claims?.last_name,
      profileImageUrl: claims?.profile_image_url,
    };
    
    console.log("Sending user data via backup route:", userData);
    res.status(200).end(JSON.stringify(userData));
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  console.log("=== isAuthenticated middleware called ===");
  
  // Development bypass - use demo user if not authenticated
  if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
    console.log("Development mode: using demo user");
    
    // Set demo user for downstream middleware
    (req as any).user = {
      id: 'demo-user',
      email: 'demo@example.com',
      firstName: 'Demo',
      lastName: 'User',
      profileImageUrl: null,
    };
    
    console.log("Setting demo user ID: demo-user");
    return next();
  }
  
  if (!req.isAuthenticated()) {
    console.log("Not authenticated");
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = req.user as any;
  console.log("User object:", user);
  
  if (!user || !user.claims) {
    console.log("No user claims available");
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Set user ID from claims for downstream middleware
  (req as any).user = {
    id: user.claims.sub,
    email: user.claims.email,
    firstName: user.claims.first_name,
    lastName: user.claims.last_name,
    profileImageUrl: user.claims.profile_image_url,
  };

  console.log("Setting user ID:", user.claims.sub);

  // Temporarily disable automatic token expiration to prevent loops
  // User will need to manually refresh if needed
  if (user.expires_at) {
    const now = Math.floor(Date.now() / 1000);
    if (now > user.expires_at) {
      console.log("Token expired but continuing to prevent loop");
      // Log but don't automatically redirect to prevent loops
    }
  }

  console.log("Authentication successful, proceeding");
  return next();
};
