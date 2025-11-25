// @ts-nocheck
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { ActivityInviteMembershipError, ActivityDuplicateError, storage } from "./storage";
import { setupAuth, isAuthenticated } from "./sessionAuth";
import { AuthService } from "./auth";
import { query } from "./db";
import {
  insertTripCalendarSchema,
  insertActivityCommentSchema,
  insertPackingItemSchema,
  insertGroceryItemSchema,
  updateGroceryItemSchema,
  insertGroceryReceiptSchema,
  insertFlightSchema,
  insertHotelSchema,
  insertHotelProposalSchema,
  insertHotelRankingSchema,
  insertFlightProposalSchema,
  insertFlightRankingSchema,
  insertRestaurantProposalSchema,
  insertRestaurantRankingSchema,
  insertRestaurantSchema,
  insertWishListIdeaSchema,
  insertWishListCommentSchema,
  activityInviteStatusSchema,
  type ActivityAcceptance,
  type ActivityComment,
  type ActivityInvite,
  type ActivityInviteStatus,
  type ActivityType,
  type ActivityWithDetails,
  type InsertHotel,
  type User,
} from "@shared/schema";
import { ATTENDEE_REQUIRED_MESSAGE, validateActivityInput } from "@shared/activityValidation";
import { z } from "zod";
import { unfurlLinkMetadata } from "./wishListService";
import { registerCoverPhotoUploadRoutes } from "./coverPhotoUpload";
import { logCoverPhotoFailure, logActivityCreationFailure, trackActivityCreationMetric } from "./observability";
import { nanoid } from "nanoid";

type PostgresError = Error & {
  code?: string;
  detail?: string;
};

const extractStayIdFromConstraintDetail = (detail?: string): number | null => {
  if (typeof detail !== "string" || detail.trim().length === 0) {
    return null;
  }

  const stayIdMatch = detail.match(/stay[_\s]?id[^=]*=\(([^)]+)\)/i);
  if (stayIdMatch?.[1]) {
    const candidates = stayIdMatch[1]
      .split(/[,\s]+/)
      .map((entry) => Number.parseInt(entry, 10))
      .filter((value) => Number.isFinite(value));

    const parsed = candidates.pop();
    if (parsed != null) {
      return parsed;
    }
  }

  return null;
};

const CONSTRAINT_VIOLATION_CODES = new Set(["23503", "23514", "23505", "23502"]);

const isPostgresConstraintViolation = (error: unknown): error is PostgresError => {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as PostgresError;
  return typeof maybeError.code === "string" && CONSTRAINT_VIOLATION_CODES.has(maybeError.code);
};

const extractInviteeIdsFromDetail = (detail?: string): string[] => {
  if (!detail || typeof detail !== "string") {
    return [];
  }

  const matches = new Set<string>();
  const regex = /\(([^)]+)\)=\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(detail)) !== null) {
    const column = match[1];
    const value = match[2];

    if (column && /user|member|invitee/i.test(column) && value) {
      matches.add(value);
    }
  }

  return Array.from(matches);
};

const CORRELATION_HEADER_CANDIDATES = ["x-correlation-id", "x-request-id", "x-idempotency-key"];

const ACTIVITY_LOG_DATE_KEYS = new Set([
  "startTime",
  "endTime",
  "start_time",
  "end_time",
  "date",
  "startDate",
  "createdAt",
  "updatedAt",
  "responded_at",
]);

const sanitizeActivityLogValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeActivityLogValue(entry));
  }

  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (ACTIVITY_LOG_DATE_KEYS.has(key)) {
        if (typeof entry === "string" && entry.trim().length > 0) {
          result[key] = "[redacted-date]";
        } else {
          result[key] = entry;
        }
        continue;
      }

      result[key] = sanitizeActivityLogValue(entry);
    }
    return result;
  }

  return value;
};

const toDateOnlyIsoString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed.toISOString().slice(0, 10);
  }

  return null;
};

const formatTripDateLabel = (value: string): string => {
  try {
    const [yearStr, monthStr, dayStr] = value.split("-");
    const year = Number.parseInt(yearStr ?? "", 10);
    const month = Number.parseInt(monthStr ?? "", 10);
    const day = Number.parseInt(dayStr ?? "", 10);

    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
      return value;
    }

    const date = new Date(Date.UTC(year, month - 1, day));
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return value;
  }
};

const buildTripDateRangeMessage = (
  min: string | null,
  max: string | null,
): string => {
  const minLabel = min ? formatTripDateLabel(min) : null;
  const maxLabel = max ? formatTripDateLabel(max) : null;

  if (minLabel && maxLabel) {
    return `Pick a date between ${minLabel} and ${maxLabel}.`;
  }

  if (minLabel) {
    return `Pick a date on or after ${minLabel}.`;
  }

  if (maxLabel) {
    return `Pick a date on or before ${maxLabel}.`;
  }

  return "Pick a date within the trip dates.";
};

const logActivityEvent = (stage: string, details: Record<string, unknown>) => {
  console.info(`[activity:create] ${stage}`, sanitizeActivityLogValue(details));
};

const getCorrelationIdFromRequest = (req: { headers?: Record<string, unknown> }): string => {
  const headers = req?.headers ?? {};

  for (const key of CORRELATION_HEADER_CANDIDATES) {
    const rawValue = headers[key];
    if (typeof rawValue === "string" && rawValue.trim().length > 0) {
      return rawValue.trim();
    }

    if (Array.isArray(rawValue) && rawValue.length > 0) {
      const [first] = rawValue;
      if (typeof first === "string" && first.trim().length > 0) {
        return first.trim();
      }
    }
  }

  return nanoid();
};

// Validation schemas for route parameters
const notificationIdSchema = z.object({
  id: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0) {
      throw new Error("Invalid notification ID");
    }
    return num;
  }),
});

const getUserDisplayName = (user: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
}): string => {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();

  if (first && last) {
    return `${first} ${last}`;
  }

  if (first) {
    return first;
  }

  if (user.username && user.username.trim()) {
    return user.username.trim();
  }

  return user.email?.trim() ?? "Trip member";
};

const RSVP_ACTION_MAP: Record<string, ActivityInviteStatus> = {
  ACCEPT: "accepted",
  DECLINE: "declined",
  WAITLIST: "waitlisted",
  MAYBE: "pending",
};

const getWaitlistOrderingTimestamp = (invite: ActivityWithDetails["invites"][number]) => {
  if (invite.respondedAt) {
    return new Date(invite.respondedAt).getTime();
  }
  if (invite.createdAt) {
    return new Date(invite.createdAt).getTime();
  }
  return invite.id ?? Number.MAX_SAFE_INTEGER;
};

const promoteWaitlistedInviteIfNeeded = async (
  activity: ActivityWithDetails,
): Promise<string | null> => {
  if (!activity.maxCapacity) {
    return null;
  }

  const acceptedInvites = activity.invites.filter((invite) => invite.status === "accepted");
  if (acceptedInvites.length >= activity.maxCapacity) {
    return null;
  }

  const waitlistedInvites = activity.invites
    .filter((invite) => invite.status === "waitlisted")
    .sort((a, b) => getWaitlistOrderingTimestamp(a) - getWaitlistOrderingTimestamp(b));

  const nextInvite = waitlistedInvites[0];
  if (!nextInvite) {
    return null;
  }

  await storage.setActivityInviteStatus(activity.id, nextInvite.userId, "accepted");

  return nextInvite.userId;
};

type ClientInfo = { userId: string; tripId?: number };

export const assignClientToTrip = (
  clientMap: Map<WebSocket, ClientInfo>,
  ws: WebSocket,
  data: { userId?: string; tripId?: unknown },
): void => {
  const userId = typeof data.userId === "string" ? data.userId : "";
  const parsedTripId = Number.parseInt(String(data.tripId), 10);

  if (Number.isNaN(parsedTripId)) {
    console.warn("Received invalid trip ID in join_trip message:", data.tripId);
    clientMap.set(ws, { userId });
    return;
  }

  clientMap.set(ws, {
    userId,
    tripId: parsedTripId,
  });
};

export const broadcastMessageToTripClients = (
  clientMap: Map<WebSocket, ClientInfo>,
  tripId: number,
  message: any,
  wsLib: typeof WebSocket,
): void => {
  if (!Number.isFinite(tripId)) {
    return;
  }

  clientMap.forEach((clientInfo, ws) => {
    if (
      typeof clientInfo.tripId === "number" &&
      Number.isFinite(clientInfo.tripId) &&
      clientInfo.tripId === tripId &&
      ws.readyState === wsLib.OPEN
    ) {
      ws.send(JSON.stringify(message));
    }
  });
};

let broadcastToTrip = (_tripId: number, _message: any) => {};

const applyActivityResponse = async (
  activityId: number,
  userId: string,
  status: ActivityInviteStatus,
) => {
  const activity = await storage.getActivityById(activityId);
  if (!activity) {
    return { error: { status: 404, message: "Activity not found" } } as const;
  }

  const trip = await storage.getTripById(activity.tripCalendarId);
  if (!trip) {
    return { error: { status: 404, message: "Trip not found" } } as const;
  }

  const isMember = trip.members.some((member) => member.userId === userId);
  if (!isMember) {
    return {
      error: {
        status: 403,
        message: "You are no longer a member of this trip",
      },
    } as const;
  }

  const updatedInvite = await storage.setActivityInviteStatus(
    activityId,
    userId,
    status,
  );

  if (activity.postedBy !== userId && (status === "accepted" || status === "declined")) {
    const responderMember = trip.members.find((member) => member.userId === userId);
    const responderName = responderMember
      ? getUserDisplayName(responderMember.user)
      : "A trip member";

    const message =
      status === "accepted"
        ? `${responderName} accepted ${activity.name}.`
        : `${responderName} declined ${activity.name}.`;

    try {
      await storage.createNotification({
        userId: activity.postedBy,
        type: "activity_rsvp",
        title: "RSVP update",
        message,
        tripId: activity.tripCalendarId,
        activityId: activity.id,
      });
    } catch (notificationError) {
      console.error("Failed to persist RSVP notification:", notificationError);
    }
  }

  broadcastToTrip(activity.tripCalendarId, {
    type: "activity_invite_updated",
    activityId,
    userId,
    status,
  });

  const activitiesForUser = await storage.getTripActivities(
    activity.tripCalendarId,
    userId,
  );
  let updatedActivity =
    activitiesForUser.find((item) => item.id === activityId) ?? null;

  let promotedUserId: string | null = null;
  if (updatedActivity) {
    promotedUserId = await promoteWaitlistedInviteIfNeeded(updatedActivity);

    if (promotedUserId) {
      const promotedMember = trip.members.find(
        (member) => member.userId === promotedUserId,
      );

      if (promotedMember) {
        try {
          await storage.createNotification({
            userId: promotedUserId,
            type: "activity_waitlist",
            title: "You're in!",
            message: `A spot opened up for ${activity.name}.`,
            tripId: activity.tripCalendarId,
            activityId: activity.id,
          });
        } catch (notificationError) {
          console.error(
            "Failed to persist waitlist promotion notification:",
            notificationError,
          );
        }
      }

      broadcastToTrip(activity.tripCalendarId, {
        type: "activity_invite_updated",
        activityId,
        userId: promotedUserId,
        status: "accepted",
      });

      const refreshedActivities = await storage.getTripActivities(
        activity.tripCalendarId,
        userId,
      );

      updatedActivity =
        refreshedActivities.find((item) => item.id === activityId) ?? updatedActivity;
    }
  }

  return {
    activity,
    trip,
    updatedInvite,
    updatedActivity,
    promotedUserId,
  } as const;
};

export const __testables = {
  applyActivityResponse,
};

const hotelSearchSchema = z.object({
  cityCode: z.string().min(3).max(3, "City code must be 3 characters"),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-in date must be YYYY-MM-DD format"),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Check-out date must be YYYY-MM-DD format"),
  adults: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0 || num > 30) {
      throw new Error("Adults must be between 1-30");
    }
    return num;
  }).optional(),
  roomQuantity: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0 || num > 10) {
      throw new Error("Room quantity must be between 1-10");
    }
    return num;
  }).optional(),
});

const activitiesDiscoverSchema = z.object({
  latitude: z.string().transform((val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < -90 || num > 90) {
      throw new Error("Latitude must be between -90 and 90");
    }
    return num;
  }),
  longitude: z.string().transform((val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < -180 || num > 180) {
      throw new Error("Longitude must be between -180 and 180");
    }
    return num;
  }),
  radius: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0 || num > 100) {
      throw new Error("Radius must be between 1-100 km");
    }
    return num;
  }).optional(),
});

const logSharedExpenseSchema = z.object({
  sourceAmountMinorUnits: z
    .number()
    .int()
    .positive("Amount must be greater than zero"),
  sourceCurrency: z
    .string()
    .min(1, "Currency is required")
    .transform((value) => value.trim()),
  targetCurrency: z
    .string()
    .min(1, "Request currency is required")
    .transform((value) => value.trim()),
  exchangeRate: z
    .coerce
    .number()
    .positive("Conversion rate must be greater than zero"),
  exchangeRateLockedAt: z.string().datetime().optional(),
  exchangeRateProvider: z
    .string()
    .trim()
    .optional(),
  description: z
    .string()
    .min(1, "Description is required")
    .transform((value) => value.trim()),
  category: z
    .string()
    .min(1, "Category is required")
    .transform((value) => value.trim()),
  participantUserIds: z
    .array(z.string())
    .min(1, "Choose at least one person to split with."),
  payerUserId: z.string().optional(),
  receiptUrl: z
    .string()
    .trim()
    .url("Enter a valid receipt URL")
    .optional(),
});

const weatherSearchSchema = z.object({
  location: z.string().min(1, "Location is required").max(100, "Location must be less than 100 characters"),
  units: z.enum(["C", "F"]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD format").optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD format").optional(),
});

const restaurantSearchSchema = z.object({
  location: z.string().min(1, "Location is required"),
  cuisine: z.string().optional(),
  priceRange: z.enum(["$", "$$", "$$$", "$$$$"]).optional(),
  limit: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0 || num > 50) {
      throw new Error("Limit must be between 1-50");
    }
    return num;
  }).optional(),
  radius: z.string().transform((val) => {
    const num = parseInt(val, 10);
    if (isNaN(num) || num <= 0 || num > 50) {
      throw new Error("Radius must be between 1-50 km");
    }
    return num;
  }).optional(),
});

const flightSearchSchema = z.object({
  origin: z.string().min(1, "Origin is required"),
  destination: z.string().min(1, "Destination is required"),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Departure date must be YYYY-MM-DD format"),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Return date must be YYYY-MM-DD format").optional(),
  passengers: z.number().min(1).max(9).optional(),
  class: z.enum(["ECONOMY", "PREMIUM_ECONOMY", "BUSINESS", "FIRST"]).optional(),
  airline: z.string().optional(),
  tripType: z.enum(["oneway", "roundtrip"]).default("roundtrip"),
  provider: z.enum(["amadeus", "duffel", "both"]).default("both"),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(20),
  filter: z.enum(["best", "cheapest", "fastest"]).optional().default("best"),
});
import { searchFlights, searchHotels, searchActivities, getAirportCode, getHotelCityCode, getCityCoordinates } from "./amadeusService";
import { searchDuffelFlights } from "./duffelService";
import { foursquareService } from "./foursquareService";
import memoize from 'memoizee';
import { googleMapsService } from "./googleMapsService";
import { locationService } from "./locationService";
import { getAirportCodes } from "./locationDatabase";
import { getCurrentWeather, getWeatherForecast, getFullWeatherData, getWeatherAdvice, formatTemperature } from "./weatherService";

const getErrorMessage = (error: unknown, fallback = "Unknown error"): string =>
  error instanceof Error ? error.message : fallback;

function getRequestUserId(req: any): string | undefined {
  if (req.session?.userId) {
    return req.session.userId;
  }

  const user = req.user ?? {};

  const possibleIds = [
    user.id,
    user.userId,
    user.user_id,
    user.sub,
    user.subject,
    user.profile?.id,
    user.profile?.sub,
    user.claims?.sub,
    user.claims?.id,
  ];

  for (const candidate of possibleIds) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return undefined;
}

const sanitizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const createFallbackUserFromRequest = (req: any, userId: string): User => {
  const requestUser = req?.user ?? {};

  const firstName =
    sanitizeOptionalString(requestUser.firstName ?? requestUser.given_name) ?? null;
  const lastName =
    sanitizeOptionalString(requestUser.lastName ?? requestUser.family_name) ?? null;
  const username =
    sanitizeOptionalString(requestUser.username ?? requestUser.preferred_username) ?? null;
  const email =
    sanitizeOptionalString(requestUser.email) ??
    (username ? `${username}@vacationsync.local` : `${userId}@vacationsync.local`);

  return {
    id: userId,
    email,
    username,
    firstName,
    lastName,
    phoneNumber: null,
    passwordHash: null,
    profileImageUrl: null,
    cashAppUsername: null,
    cashAppUsernameLegacy: null,
    cashAppPhone: null,
    cashAppPhoneLegacy: null,
    venmoUsername: null,
    venmoPhone: null,
    timezone: null,
    defaultLocation: null,
    defaultLocationCode: null,
    defaultCity: null,
    defaultCountry: null,
    authProvider: null,
    notificationPreferences: null,
    hasSeenHomeOnboarding: false,
    hasSeenTripOnboarding: false,
    createdAt: null,
    updatedAt: null,
  };
};

const DEMO_USER_ID = "demo-user";
const demoUserSeed = {
  id: DEMO_USER_ID,
  email: "demo@example.com",
  username: "demouser",
  firstName: "Demo",
  lastName: "User",
  phoneNumber: null,
  passwordHash: null,
  authProvider: "demo",
};

let demoUserEnsured = false;
let demoUserEnsurePromise: Promise<void> | null = null;

const ensureDemoUserExists = async () => {
  if (process.env.NODE_ENV !== "development") {
    return;
  }

  if (demoUserEnsured) {
    return;
  }

  if (demoUserEnsurePromise) {
    await demoUserEnsurePromise;
    return;
  }

  demoUserEnsurePromise = (async () => {
    const existingUser = await storage.getUser(DEMO_USER_ID);
    if (existingUser) {
      demoUserEnsured = true;
      return;
    }

    await storage.upsertUser(demoUserSeed);
    demoUserEnsured = true;
  })();

  try {
    await demoUserEnsurePromise;
  } catch (error) {
    demoUserEnsured = false;
    console.error("Failed to ensure demo user exists:", error);
    throw error;
  } finally {
    demoUserEnsurePromise = null;
  }
};

const parsePriceFromInput = (value: unknown): string | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const cleaned = trimmed.replace(/[^0-9.,-]/g, '');
    if (!cleaned) {
      return null;
    }

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    let normalized = cleaned;
    if (lastComma >= 0 || lastDot >= 0) {
      if (lastComma >= 0 && lastDot >= 0) {
        normalized = lastComma > lastDot
          ? cleaned.replace(/\./g, '').replace(/,/g, '.')
          : cleaned.replace(/,/g, '');
      } else if (lastComma >= 0) {
        const decimalDigits = cleaned.length - lastComma - 1;
        normalized = decimalDigits > 0 && decimalDigits <= 2
          ? cleaned.replace(/,/g, '.')
          : cleaned.replace(/,/g, '');
      } else if (lastDot >= 0) {
        const decimalDigits = cleaned.length - lastDot - 1;
        normalized = decimalDigits > 0 && decimalDigits <= 2
          ? cleaned
          : cleaned.replace(/\./g, '');
      }
    }

    normalized = normalized.replace(/,/g, '');

    const parsed = Number.parseFloat(normalized);
    if (!Number.isFinite(parsed)) {
      return null;
    }

    return parsed.toString();
  }

  return null;
};

function parseBooleanQueryParam(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => parseBooleanQueryParam(item));
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return false;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };
}

export function setupRoutes(app: Express) {
  
  // Setup auth routes FIRST before any middleware
  setupAuth(app);

  registerCoverPhotoUploadRoutes(app, {
    isAuthenticated,
    getUserId: (req: any) => getRequestUserId(req),
  });
  
  // Custom auth routes
  app.post('/api/auth/register', async (req: any, res) => {
    try {
      const { firstName, lastName, email, phoneNumber, username, password } = req.body;
      
      if (!firstName || !lastName || !email || !phoneNumber || !username || !password) {
        return res.status(400).json({ message: "All fields are required" });
      }
      
      const user = await AuthService.register({ firstName, lastName, email, phoneNumber, username, password });
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.status(201).json(userResponse);
    } catch (error: unknown) {
      console.error("Registration error:", error);
      const errorMessage = getErrorMessage(error);
      if (
        errorMessage.includes("Username is already taken") ||
        errorMessage.includes("Email is already registered")
      ) {
        // Generic error message to prevent user enumeration
        res.status(409).json({ message: "Account with this username or email already exists" });
      } else {
        res.status(500).json({ message: "Failed to create account" });
      }
    }
  });

  app.post('/api/auth/login', async (req: any, res) => {
    try {
      const { usernameOrEmail, password } = req.body;
      
      if (!usernameOrEmail || !password) {
        return res.status(400).json({ message: "Username/email and password are required" });
      }
      
      const user = await AuthService.login({ usernameOrEmail, password });
      
      // Create session
      req.session.userId = user.id;
      req.session.authProvider = 'custom';
      
      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;
      res.json(userResponse);
    } catch (error: unknown) {
      console.error("Login error:", error);
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes("User not found")) {
        res.status(401).json({ message: "Invalid credentials" });
      } else if (errorMessage.includes("Invalid password")) {
        res.status(401).json({ message: "Invalid credentials" });
      } else if (errorMessage.includes("external authentication")) {
        // Generic error to prevent account type enumeration
        res.status(401).json({ message: "Invalid credentials" });
      } else {
        res.status(500).json({ message: "Failed to log in" });
      }
    }
  });

  app.post('/api/auth/logout', (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to log out" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  // Auth user endpoint with development bypass and custom auth support
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Check for custom auth session first
      if (req.session?.userId && req.session?.authProvider === 'custom') {
        try {
          const user = await storage.getUser(req.session.userId);
          if (user) {
            const { passwordHash, ...userResponse } = user;
            return res.json(userResponse);
          }
        } catch (error: unknown) {
          console.log("Custom auth user lookup failed, falling back to demo");
        }
      }
      
      // Development bypass - return demo user, respecting saved preferences
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        console.log("Development mode: returning demo user");
        
        // First check if demo user already exists (to preserve profile updates)
        try {
          const existingUser = await storage.getUser('demo-user');
          
          if (existingUser) {
            console.log("Development mode: using existing demo user with saved preferences");
            return res.json(existingUser);
          }
        } catch (error: unknown) {
          console.log("Could not fetch existing demo user, creating new one");
        }
        
        // Only create new demo user if none exists
        console.log("Development mode: creating new demo user");
        const demoUser = {
          id: 'demo-user',
          email: 'demo@example.com',
          username: 'demouser',
          defaultLocation: 'New York, NY',
          defaultLocationCode: 'NYC',
          defaultCity: 'New York',
          defaultCountry: 'United States',
          firstName: 'Demo',
          lastName: 'User',
          profileImageUrl: null,
          authProvider: 'demo',
          hasSeenHomeOnboarding: true,
          hasSeenTripOnboarding: true,
        };
        
        // Save the demo user to database so future updates persist
        try {
          const savedUser = await storage.upsertUser(demoUser);
          return res.json(savedUser);
        } catch (error: unknown) {
          console.log("Could not save demo user to database, returning hardcoded version");
          return res.json(demoUser);
        }
      }
      
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);

      if (!user) {
        if (req.user?.claims) {
          console.log("User not found, creating user from OIDC claims");
          const newUser = await storage.upsertUser({
            id: req.user.claims.sub,
            email: req.user.claims.email,
            firstName: req.user.claims.first_name,
            lastName: req.user.claims.last_name,
            profileImageUrl: req.user.claims.profile_image_url,
          });
          return res.json(newUser);
        }

        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error: unknown) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile update endpoint
  app.put('/api/profile', async (req: any, res) => {
    try {
      let userId = getRequestUserId(req);
      
      // Check for custom auth session
      if (req.session?.userId && req.session?.authProvider === 'custom') {
        userId = req.session.userId;
      }
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        console.log("Development mode: profile update for demo user");
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const allowedFields = [
        'cashAppUsername', 
        'venmoUsername',
        'defaultLocation',
        'defaultLocationCode', 
        'defaultCity',
        'defaultCountry'
      ];
      
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      await storage.updateUserProfile(userId, updateData);
      res.json({ success: true, message: "Profile updated successfully" });
    } catch (error: unknown) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Onboarding tracking routes
  app.post('/api/onboarding/:type', async (req: any, res) => {
    try {
      const type = req.params.type as 'home' | 'trip';
      
      if (!['home', 'trip'].includes(type)) {
        return res.status(400).json({ message: 'Invalid onboarding type' });
      }

      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        console.log(`Development mode: marking ${type} onboarding complete for demo user`);
        userId = 'demo-user';
      }
      
      if (!userId && req.isAuthenticated() === false) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      await storage.updateOnboardingStatus(userId, type);
      res.json({ success: true, message: `${type} onboarding marked as complete` });
    } catch (error: unknown) {
      console.error('Error updating onboarding status:', error);
      res.status(500).json({ message: 'Failed to update onboarding status' });
    }
  });

  // 🚨 SECURITY FIX: Google Maps Photo Proxy Endpoint
  // This endpoint prevents API key exposure by proxying photo requests server-side
  app.get("/api/gmaps/photo", async (req, res) => {
    try {
      const photoReference = req.query.ref as string;
      const maxwidth = req.query.maxwidth as string || '400';
      
      if (!photoReference) {
        return res.status(400).json({ error: "Photo reference parameter 'ref' is required" });
      }
      
      // Validate maxwidth parameter
      const width = parseInt(maxwidth);
      if (isNaN(width) || width < 1 || width > 1600) {
        return res.status(400).json({ error: "Invalid maxwidth parameter (1-1600)" });
      }
      
      // Get Google API key from environment (server-side only)
      const googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!googleApiKey) {
        console.error('🚨 Google Maps API key not configured for photo proxy');
        return res.status(503).json({ error: "Photo service temporarily unavailable" });
      }
      
      // Construct Google Photos API URL with server-side API key injection
      const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${width}&photoreference=${encodeURIComponent(photoReference)}&key=${googleApiKey}`;
      
      console.log(`📸 Proxying Google Maps photo: ${photoReference.substring(0, 10)}...`);
      
      // Fetch image from Google Maps API
      const response = await fetch(photoUrl);
      
      if (!response.ok) {
        console.error(`❌ Google Maps photo API error: ${response.status}`);
        return res.status(response.status).json({ error: "Failed to fetch photo" });
      }
      
      // Get content type from Google's response
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      // Ensure it's actually an image
      if (!contentType.startsWith('image/')) {
        console.error(`❌ Invalid content type from Google Photos API: ${contentType}`);
        return res.status(500).json({ error: "Invalid image response" });
      }
      
      // Set appropriate headers for image response
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'X-Served-By': 'VacationSync-Photo-Proxy' // Identification header
      });
      
      // Stream the image data back to client (without exposing API key)
      response.body?.pipe(res);
      
    } catch (error) {
      console.error("❌ Photo proxy error:", error);
      res.status(500).json({ error: "Internal server error in photo proxy" });
    }
  });

  // Unified location search endpoint used by both flights (GET) and hotels (POST)
  app.get("/api/locations/search", async (req, res) => {
    let query = "";
    let parsedTypes: string[] = [];
    let limit = 10;
    let useApi = false;

    try {
      const rawQuery = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
      query = typeof rawQuery === "string" ? rawQuery.trim() : "";

      if (!query) {
        return res.status(400).json({ message: "Query parameter 'q' is required" });
      }

      if (query.length < 2) {
        return res.json([]);
      }

      const typesParam = Array.isArray(req.query.types)
        ? req.query.types
        : req.query.types
          ? [req.query.types]
          : [];
      parsedTypes = typesParam.flatMap((value) =>
        typeof value === "string"
          ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
      );

      const limitRaw = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
      limit = limitRaw && !isNaN(Number(limitRaw)) ? parseInt(limitRaw as string, 10) : 10;

      const useApiRaw = Array.isArray(req.query.useApi) ? req.query.useApi[0] : req.query.useApi;
      useApi = typeof useApiRaw === "string"
        ? ["true", "1", "yes"].includes(useApiRaw.toLowerCase())
        : false;

      const results = await locationService.searchLocationsForApi({
        query,
        types: parsedTypes,
        limit,
        useApi,
      });

      return res.json(results);
    } catch (error: unknown) {
      console.error("Location search error:", error, {
        query,
        parsedTypes,
        limit,
        useApi,
      });
      return res.status(500).json({ error: "Location search failed" });
    }
  });

  app.get("/api/flights/airports", async (req, res) => {
    try {
      const latitudeParam = req.query.latitude;
      const longitudeParam = req.query.longitude;

      if (typeof latitudeParam !== 'string' || typeof longitudeParam !== 'string') {
        return res.status(400).json({
          error: "Query parameters 'latitude' and 'longitude' are required",
        });
      }

      const latitude = Number(latitudeParam);
      const longitude = Number(longitudeParam);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({
          error: "Latitude and longitude must be valid numbers",
        });
      }

      const cityName = typeof req.query.city_name === 'string' ? req.query.city_name : null;
      const countryName = typeof req.query.country_name === 'string' ? req.query.country_name : null;

      const parseDbNumber = (value: unknown): number | null => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      };

      const result = await query(
        `SELECT iata_code, name, municipality, iso_country, latitude, longitude,
          ( 6371 * acos( cos( radians($1) ) * cos( radians(latitude) )
          * cos( radians(longitude) - radians($2) ) + sin( radians($1) )
          * sin( radians(latitude) ) ) ) AS distance_km
        FROM airports
        WHERE iata_code IS NOT NULL
          AND type IN ('large_airport','medium_airport')
        ORDER BY distance_km
        LIMIT 5;`,
        [latitude, longitude],
      );

      const airports = result.rows
        .map((row: any) => {
          const iata = row.iata_code || row.iata || null;
          const distanceKm = parseDbNumber(row.distance_km);
          const latitudeDeg = parseDbNumber(row.latitude);
          const longitudeDeg = parseDbNumber(row.longitude);

          if (!iata || !row.name) {
            return null;
          }

          return {
            iata,
            name: row.name,
            municipality: row.municipality ?? null,
            iso_country: row.iso_country ?? null,
            latitude: latitudeDeg,
            longitude: longitudeDeg,
            distance_km: distanceKm,
          };
        })
        .filter((airport: any): airport is Record<string, unknown> => Boolean(airport));

      return res.json({
        city_name: cityName,
        country_name: countryName,
        latitude,
        longitude,
        airports,
      });
    } catch (error) {
      console.error('Nearest airports lookup failed:', error);
      return res.status(500).json({ error: 'Failed to fetch nearest airports' });
    }
  });

  // Trip routes
  app.post("/api/trips", async (req: any, res) => {
    try {
      let userId = getRequestUserId(req);

      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        console.log("Development mode: using demo user for trip creation");
        userId = 'demo-user';
        // No need to create demo user in database for development mode
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parseDate = (value: unknown): Date | null => {
        if (value instanceof Date) {
          return Number.isNaN(value.getTime()) ? null : value;
        }

        if (typeof value === "string" && value.trim().length > 0) {
          const parsed = new Date(value);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        }

        return null;
      };

      const startDate = parseDate(req.body?.startDate);
      const endDate = parseDate(req.body?.endDate);

      if (!startDate) {
        return res.status(400).json({ message: "Start date must be a valid date." });
      }

      if (!endDate) {
        return res.status(400).json({ message: "End date must be a valid date." });
      }

      if (endDate < startDate) {
        return res.status(400).json({ message: "End date cannot be before the start date." });
      }

      const tripData = {
        ...req.body,
        name: typeof req.body?.name === "string" ? req.body.name.trim() : req.body?.name,
        destination:
          typeof req.body?.destination === "string" ? req.body.destination.trim() : req.body?.destination,
        startDate,
        endDate,
      };

      const validationResult = insertTripCalendarSchema.safeParse(tripData);

      if (!validationResult.success) {
        const issues = validationResult.error.issues ?? [];
        const firstIssue = issues[0];
        return res.status(400).json({
          message: firstIssue?.message ?? "Trip details are invalid.",
          errors: issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      const trip = await storage.createTrip(validationResult.data, userId);

      res.json(trip);
    } catch (error: unknown) {
      console.error("Error creating trip:", error);
      if (error instanceof z.ZodError) {
        const issues = error.issues ?? [];
        const firstIssue = issues[0];
        return res.status(400).json({
          message: firstIssue?.message ?? "Trip details are invalid.",
          errors: issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }

      if (isPostgresConstraintViolation(error)) {
        return res.status(400).json({
          message: "We couldn't save this trip because some details were invalid.",
        });
      }

      if (error instanceof Error) {
        return res.status(500).json({ message: error.message || "Failed to create trip" });
      }

      res.status(500).json({ message: "Failed to create trip" });
    }
  });

  app.get("/api/trips", async (req: any, res) => {
    try {
      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const trips = await storage.getUserTrips(userId);
      res.json(trips);
    } catch (error: unknown) {
      console.error("Error fetching trips:", error);
      res.status(500).json({ message: "Failed to fetch trips" });
    }
  });

  app.get("/api/trips/:id", async (req: any, res) => {
    try {
      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const tripId = parseInt(req.params.id);
      const trip = await storage.getTripById(tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      // Check if user is a member of this trip
      const isMember = await storage.isTripMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "Not a member of this trip" });
      }

      res.json(trip);
    } catch (error: unknown) {
      console.error("Error fetching trip:", error);
      res.status(500).json({ message: "Failed to fetch trip" });
    }
  });

  app.get("/api/trips/share/:shareCode", isAuthenticated, async (req: any, res) => {
    try {
      const { shareCode } = req.params;

      if (!shareCode || typeof shareCode !== "string") {
        return res.status(400).json({ message: "Share code is required" });
      }

      const trip = await storage.getTripByShareCode(shareCode);

      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      res.json(trip);
    } catch (error: unknown) {
      console.error("Error fetching shared trip:", error);
      res.status(500).json({ message: "Failed to fetch trip" });
    }
  });

  app.post("/api/trips/join/:shareCode", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { shareCode } = req.params;

      if (!shareCode || typeof shareCode !== "string") {
        return res.status(400).json({ message: "Share code is required" });
      }

      const departureLocation =
        typeof req.body?.departureLocation === "string"
          ? req.body.departureLocation.trim() || null
          : null;
      const departureAirport =
        typeof req.body?.departureAirport === "string"
          ? req.body.departureAirport.trim().toUpperCase() || null
          : null;

      const trip = await storage.joinTrip(shareCode, userId, {
        departureLocation: departureLocation ?? undefined,
        departureAirport: departureAirport ?? undefined,
      });

      res.json(trip);
    } catch (error: unknown) {
      console.error("Error joining trip:", error);
      const message = getErrorMessage(error, "Failed to join trip");
      if (message === "Trip not found") {
        return res.status(404).json({ message });
      }
      res.status(500).json({ message: "Failed to join trip" });
    }
  });

  app.delete(
    "/api/trips/:tripId/members/:memberId",
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tripId = Number.parseInt(req.params.tripId, 10);
        const memberIdParam =
          typeof req.params.memberId === "string" ? req.params.memberId : "";

        if (!Number.isFinite(tripId) || !memberIdParam) {
          return res
            .status(400)
            .json({ message: "Invalid member removal request" });
        }

        const userId = getRequestUserId(req);

        if (!userId) {
          return res.status(401).json({ message: "Unauthorized" });
        }

        const updatedTrip = await storage.removeTripMember(
          tripId,
          memberIdParam,
          userId,
        );

        res.json(updatedTrip);
      } catch (error: unknown) {
        console.error("Error removing trip member:", error);
        if (error instanceof Error) {
          if (error.message === "Trip not found") {
            return res.status(404).json({ message: error.message });
          }
          if (error.message === "Member ID is required") {
            return res.status(400).json({ message: error.message });
          }
          if (error.message === "Only the trip creator can remove members") {
            return res.status(403).json({ message: error.message });
          }
          if (error.message === "Trip creator cannot be removed") {
            return res.status(400).json({ message: error.message });
          }
          if (error.message === "Trip member not found") {
            return res.status(404).json({ message: error.message });
          }
        }

        res.status(500).json({ message: "Failed to remove trip member" });
      }
    },
  );

  app.put("/api/trips/:id", async (req: any, res) => {
    let userId = getRequestUserId(req);
    let tripId: number | null = null;
    try {
      let effectiveUserId = userId;

      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        console.log("Development mode: demo user updating trip");
        effectiveUserId = 'demo-user';
      }

      if (!effectiveUserId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const parsedTripId = parseInt(req.params.id);
      if (!parsedTripId || isNaN(parsedTripId)) {
        return res.status(400).json({ message: "Invalid trip ID" });
      }
      tripId = parsedTripId;

      // Parse and convert dates if provided
      const updateData: any = { ...req.body };
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }

      // Validate only the fields that are being updated
      const updateSchema = insertTripCalendarSchema.partial();
      const validatedData = updateSchema.parse(updateData);

      userId = effectiveUserId;

      const updatedTrip = await storage.updateTrip(
        tripId,
        validatedData,
        effectiveUserId,
      );

      res.json(updatedTrip);
    } catch (error: unknown) {
      console.error("Error updating trip:", error);
      if (req.body?.coverPhotoStorageKey) {
        const rawSize = req.body.coverPhotoUploadSize;
        const numericSize =
          typeof rawSize === "number"
            ? rawSize
            : typeof rawSize === "string"
              ? Number(rawSize)
              : null;
        const fileType =
          typeof req.body.coverPhotoUploadType === "string"
            ? req.body.coverPhotoUploadType
            : null;
        logCoverPhotoFailure({
          step: "save",
          userId: userId ?? null,
          tripId,
          fileSize: Number.isFinite(numericSize as number)
            ? (numericSize as number)
            : null,
          fileType,
          storageKey: req.body.coverPhotoStorageKey,
          error,
        });
      }
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes("Only the trip creator")) {
        res.status(403).json({ message: "Only the trip creator can edit the trip" });
      } else {
        res.status(500).json({ message: "Failed to update trip" });
      }
    }
  });

  // Unified FlightOffer interface
  interface UnifiedFlightOffer {
    id: string;
    price: number;
    priceNumber: number;
    duration: string;
    durationMinutes: number;
    airlines: string[];
    segments: Array<{
      departure: { airport: string; time: string; terminal?: string };
      arrival: { airport: string; time: string; terminal?: string };
      airline: string;
      flightNumber: string;
      aircraft?: string;
    }>;
    bookingUrl: string;
    provider: string;
    stops: number;
    currency: string;
    flightSignature: string; // For deduplication
  }

  // Major US airline codes for Duffel optimization
  const MAJOR_US_CARRIERS = ['AA', 'UA', 'DL']; // American, United, Delta

  // Utility functions for flight processing
  const getDurationMinutes = (duration: string): number => {
    if (!duration) return 999999;
    const hours = duration.match(/(\d+)H/)?.[1] || '0';
    const minutes = duration.match(/(\d+)M/)?.[1] || '0';
    return parseInt(hours) * 60 + parseInt(minutes);
  };

  const createFlightSignature = (flight: any): string => {
    const firstSegment = flight.itineraries?.[0]?.segments?.[0] || flight.segments?.[0];
    const lastSegment = flight.itineraries?.[0]?.segments?.slice(-1)[0] || flight.segments?.slice(-1)[0];
    
    if (!firstSegment || !lastSegment) return Math.random().toString();
    
    return `${firstSegment.carrierCode || firstSegment.airline}-${firstSegment.number || firstSegment.flightNumber}-${firstSegment.departure?.at || firstSegment.departure?.time}-${lastSegment.arrival?.at || lastSegment.arrival?.time}`;
  };

  const mapToUnifiedFormat = (flight: any, provider: string): UnifiedFlightOffer => {
    const isAmadeus = provider.toLowerCase().includes('amadeus');
    const isDuffel = provider.toLowerCase().includes('duffel');
    
    let segments, price, duration, currency;
    
    if (isAmadeus || isDuffel) {
      segments = flight.itineraries?.[0]?.segments || [];
      price = parseFloat(flight.price?.total || '0');
      duration = flight.itineraries?.[0]?.duration || 'PT0H0M';
      currency = flight.price?.currency || 'USD';
    } else {
      // Handle other formats if needed
      segments = flight.segments || [];
      price = flight.price || 0;
      duration = flight.duration || 'PT0H0M';
      currency = flight.currency || 'USD';
    }

    const firstSegment = segments[0] || {};
    const lastSegment = segments[segments.length - 1] || {};
    const airlines = [...new Set(segments.map((s: any) => s.carrierCode || s.airline).filter(Boolean))];

    // Enhanced booking URL construction using airline codes
    const originCode = firstSegment.departure?.iataCode || firstSegment.departure?.airport;
    const destCode = lastSegment.arrival?.iataCode || lastSegment.arrival?.airport;
    const depDate = firstSegment.departure?.at?.split('T')[0] || new Date().toISOString().split('T')[0];
    
    const bookingUrl = `https://www.kayak.com/flights/${originCode}-${destCode}/${depDate}`;

    return {
      id: flight.id || Math.random().toString(),
      price,
      priceNumber: price,
      duration,
      durationMinutes: getDurationMinutes(duration),
      airlines,
      segments: segments.map((s: any) => ({
        departure: {
          airport: s.departure?.iataCode || s.departure?.airport || '',
          time: s.departure?.at || s.departure?.time || '',
          terminal: s.departure?.terminal
        },
        arrival: {
          airport: s.arrival?.iataCode || s.arrival?.airport || '',
          time: s.arrival?.at || s.arrival?.time || '',
          terminal: s.arrival?.terminal
        },
        airline: s.carrierCode || s.airline || '',
        flightNumber: s.number || s.flightNumber || '',
        aircraft: s.aircraft?.code || s.aircraft
      })),
      bookingUrl,
      provider,
      stops: segments.length - 1,
      currency,
      flightSignature: createFlightSignature(flight)
    };
  };

  // Cached flight search function with 5-minute TTL
  const searchFlightsCached = memoize(
    async (searchParams: any) => {
      const { origin, destination, departureDate, returnDate, passengers, flightClass, airline, provider, tripType } = searchParams;

      console.log(`🔍 Flight Search Request:`);
      console.log(`  📍 Route: ${origin} → ${destination}`);
      console.log(`  📅 Departure: ${departureDate}${returnDate ? `, Return: ${returnDate}` : ''}`);
      console.log(`  🔁 Trip Type: ${tripType || (returnDate ? 'roundtrip' : 'oneway')}`);
      console.log(`  👥 Passengers: ${passengers || 1}`);
      console.log(`  💺 Class: ${flightClass || 'ECONOMY'}`);
      console.log(`  ✈️ Airline Filter: ${airline || 'Any'}`);
      console.log(`  🏢 Provider: ${provider}`);

      // Enhanced airport code resolution
      const originCodes = getAirportCodes(origin);
      const destinationCodes = getAirportCodes(destination);
      console.log(`  🛩️ Airport codes: ${originCodes.join('/')} → ${destinationCodes.join('/')}`);  

      const allFlights: UnifiedFlightOffer[] = [];
      const searchPromises: Promise<void>[] = [];
      const errors: string[] = [];

      // Amadeus search
      if (provider === 'amadeus' || provider === 'both') {
        const amadeusPromise = async () => {
          try {
            console.log('🔍 Searching Amadeus...');
            let amadeusResults: any[] = [];
            
            for (const originCode of originCodes) {
              for (const destCode of destinationCodes) {
                try {
                  const flights = await searchFlights(
                    originCode, destCode, departureDate,
                    passengers || 1, returnDate,
                    (flightClass || 'ECONOMY').toUpperCase(),
                    airline
                  );
                  amadeusResults.push(...flights);
                } catch (error) {
                  console.log(`  ❌ Amadeus ${originCode}→${destCode}: ${getErrorMessage(error)}`);
                }
              }
            }

            const mapped = amadeusResults.map(flight => mapToUnifiedFormat(flight, 'Amadeus'));
            allFlights.push(...mapped);
            console.log(`  ✅ Amadeus: ${mapped.length} flights`);
          } catch (error) {
            const msg = `Amadeus error: ${getErrorMessage(error, 'Unknown')}`;
            console.error(`  ❌ ${msg}`);
            errors.push(msg);
          }
        };
        searchPromises.push(amadeusPromise());
      }

      // Enhanced Duffel search with major carrier optimization
      if (provider === 'duffel' || provider === 'both') {
        const duffelPromise = async () => {
          try {
            console.log('🔍 Searching Duffel with major carrier optimization...');
            let duffelResults: any[] = [];
            
            for (const originCode of originCodes) {
              for (const destCode of destinationCodes) {
                try {
                  // Enhanced Duffel call with included_carriers for major airlines
                  const flights = await searchDuffelFlights(
                    originCode, destCode, departureDate,
                    passengers || 1, returnDate,
                    (flightClass || 'ECONOMY').toUpperCase(),
                    airline,
                    MAJOR_US_CARRIERS // Pass major carriers for optimization
                  );
                  duffelResults.push(...flights);
                } catch (error) {
                  console.log(`  ❌ Duffel ${originCode}→${destCode}: ${getErrorMessage(error)}`);
                }
              }
            }

            const mapped = duffelResults.map(flight => mapToUnifiedFormat(flight, 'Duffel'));
            allFlights.push(...mapped);
            console.log(`  ✅ Duffel: ${mapped.length} flights`);
          } catch (error) {
            const msg = `Duffel error: ${getErrorMessage(error, 'Unknown')}`;
            console.error(`  ❌ ${msg}`);
            errors.push(msg);
          }
        };
        searchPromises.push(duffelPromise());
      }

      await Promise.all(searchPromises);

      // Advanced deduplication by flight signature
      const uniqueFlights = allFlights.filter((flight, index, self) => 
        index === self.findIndex(f => f.flightSignature === flight.flightSignature)
      );

      console.log(`🎯 Search Results: ${allFlights.length} total, ${uniqueFlights.length} unique`);
      
      return { 
        flights: uniqueFlights, 
        errors,
        sources: {
          amadeus: allFlights.filter(f => f.provider.includes('Amadeus')).length,
          duffel: allFlights.filter(f => f.provider.includes('Duffel')).length
        }
      };
    },
    {
      maxAge: 5 * 60 * 1000, // 5 minutes TTL
      normalizer: (args) => JSON.stringify(args[0]) // Cache by search parameters
    }
  );

  // Server-side filter sorting with min-max normalization
  const sortFlights = (flights: UnifiedFlightOffer[], filter: string): UnifiedFlightOffer[] => {
    if (flights.length === 0) return flights;
    
    const sorted = [...flights];

    switch (filter) {
      case 'cheapest':
        return sorted.sort((a, b) => a.priceNumber - b.priceNumber);
      
      case 'fastest':
        return sorted.sort((a, b) => a.durationMinutes - b.durationMinutes);
      
      case 'best':
      default:
        // Min-max normalization for weighted scoring
        const prices = flights.map(f => f.priceNumber);
        const durations = flights.map(f => f.durationMinutes);
        
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        
        return sorted.sort((a, b) => {
          const priceNormA = maxPrice > minPrice ? (a.priceNumber - minPrice) / (maxPrice - minPrice) : 0;
          const priceNormB = maxPrice > minPrice ? (b.priceNumber - minPrice) / (maxPrice - minPrice) : 0;
          
          const durationNormA = maxDuration > minDuration ? (a.durationMinutes - minDuration) / (maxDuration - minDuration) : 0;
          const durationNormB = maxDuration > minDuration ? (b.durationMinutes - minDuration) / (maxDuration - minDuration) : 0;
          
          // Weighted score: 60% price, 40% duration
          const scoreA = 0.6 * priceNormA + 0.4 * durationNormA;
          const scoreB = 0.6 * priceNormB + 0.4 * durationNormB;
          
          return scoreA - scoreB;
        });
    }
  };

  // Enhanced Flight Search API - Unified Aggregator
  app.post("/api/search/flights", async (req: any, res) => {
    try {
      const validatedData = flightSearchSchema.parse(req.body);
      const { origin, destination, departureDate, returnDate, passengers, class: flightClass, airline, provider, tripType, page, limit, filter } = validatedData;
      const normalizedReturnDate = tripType === 'oneway' ? undefined : returnDate;

      // Get cached flight results
      const searchParams = { origin, destination, departureDate, returnDate: normalizedReturnDate, passengers, flightClass, airline, provider, tripType };
      const { flights: allFlights, errors, sources } = await searchFlightsCached(searchParams);

      if (allFlights.length === 0) {
        const message = airline 
          ? `No ${airline} flights available for ${origin} → ${destination} on ${departureDate}`
          : `No flights found for ${origin} → ${destination} on ${departureDate}`;
        
        return res.status(404).json({ 
          error: "No flights found",
          message,
          searchErrors: errors.length > 0 ? errors : undefined
        });
      }

      // Calculate filter counts (before sorting for UI badges)
      const cheapestSorted = sortFlights(allFlights, 'cheapest');
      const fastestSorted = sortFlights(allFlights, 'fastest');
      const bestSorted = sortFlights(allFlights, 'best');

      const filterCounts = {
        cheapest: cheapestSorted.length,
        fastest: fastestSorted.length,
        best: bestSorted.length
      };

      // Apply requested filter sorting
      const sortedFlights = sortFlights(allFlights, filter);

      // Apply pagination 
      const totalFlights = sortedFlights.length;
      const totalPages = Math.ceil(totalFlights / limit);
      const startIndex = (page - 1) * limit;
      const paginatedFlights = sortedFlights.slice(startIndex, startIndex + limit);

      console.log(`✅ Flight Search Complete: ${totalFlights} flights, page ${page}/${totalPages}`);
      console.log(`  🔢 Sources: Amadeus(${sources.amadeus}), Duffel(${sources.duffel})`);
      console.log(`  🎯 Filter: ${filter} (${paginatedFlights.length} results)`);

      // Enhanced response format as specified
      res.json({
        flights: paginatedFlights,
        pagination: {
          page,
          limit,
          total: totalFlights,
          totalPages
        },
        sources,
        filters: filterCounts
      });
    } catch (error: unknown) {
      console.error('❌ Flight search error:', error);
      
      if (error instanceof Error && 'name' in error && error.name === 'ZodError') {
        return res.status(400).json({ 
          error: 'Invalid request parameters', 
          details: (error as any).errors 
        });
      }
      
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes('DUFFEL_ACCESS_TOKEN')) {
        res.status(500).json({ error: 'Duffel API configuration error' });
      } else if (errorMessage.includes('Amadeus')) {
        res.status(500).json({ error: 'Amadeus API error', details: errorMessage });
      } else {
        res.status(500).json({ error: 'Failed to search flights', details: errorMessage });
      }
    }
  });

  // Hotel Search API using Google Maps with Amadeus fallback
  app.post("/api/hotels/search", async (req: any, res) => {
    try {
      const { location, checkInDate, checkOutDate, adults, radius } = req.body;
      
      if (!location || !checkInDate || !checkOutDate) {
        return res.status(400).json({ error: "Missing required search parameters" });
      }
      
      try {
        // Try Google Maps first with check-in/out dates for proper price calculation
        const hotels = await googleMapsService.searchHotels(location, {
          radius: (radius || 10) * 1000, // Convert km to meters
          limit: 20,
          checkInDate, // 🔧 INTEGRATION FIX: Pass dates for proper nights calculation
          checkOutDate // 🔧 INTEGRATION FIX: Pass dates for proper total price calculation
        });
        
        console.log(`✅ Google Maps returned ${hotels.length} hotels`);
        res.json(hotels);
      } catch (googleError) {
        console.error("Google Maps hotel search failed, falling back to Amadeus:", googleError);
        
        // Fallback to Amadeus
        const cityCode = getHotelCityCode(location);
        
        const amadeusHotels = await searchHotels(
          cityCode,
          checkInDate,
          checkOutDate,
          adults || 1,
          radius || 5,
          'KM'
        );
        
        // Transform Amadeus results to our format
        const transformedHotels = amadeusHotels.map((hotel, index) => ({
          id: `hotel-${index}`,
          name: hotel.hotel.name,
          rating: parseFloat(hotel.hotel.rating || '4.0'),
          price: hotel.offers[0]?.price?.total || '200',
          currency: hotel.offers[0]?.price?.currency || 'USD',
          location: hotel.hotel.address?.cityName || location,
          amenities: hotel.hotel.amenities?.join(', ') || 'WiFi, Restaurant, Room Service',
          description: hotel.hotel.name,
          imageUrl: hotel.hotel.media?.[0]?.uri || '',
          bookingUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.hotel.name + ', ' + (hotel.hotel.address?.cityName || location))}&checkin=${checkInDate}&checkout=${checkOutDate}&group_adults=${adults || 1}`,
          platform: 'Amadeus',
          latitude: hotel.hotel.latitude,
          longitude: hotel.hotel.longitude,
          chainCode: hotel.hotel.chainCode,
          distance: hotel.hotel.hotelDistance?.distance || 0,
          contact: {
            phone: hotel.hotel.contact?.phone || '',
            email: hotel.hotel.contact?.email || ''
          },
          bookingLinks: [
            {
              text: "Search Booking.com",
              url: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotel.hotel.name + ', ' + (hotel.hotel.address?.cityName || location))}&checkin=${checkInDate}&checkout=${checkOutDate}&group_adults=${adults || 1}`,
              type: "search"
            }
          ]
        }));
        
        console.log(`✅ Amadeus fallback returned ${transformedHotels.length} hotels`);
        res.json(transformedHotels);
      }
      
    } catch (error: unknown) {
      console.error('Hotel search error:', error);
      res.status(500).json({ error: 'Failed to search hotels' });
    }
  });

  // Enhanced Activity Search - Google Maps + Amadeus Integration
  app.post("/api/activities/search", async (req: any, res) => {
    try {
      const { location, radius } = req.body;
      
      if (!location) {
        return res.status(400).json({ error: "Missing required search parameters" });
      }
      
      console.log(`🔍 Starting enhanced activity search for: ${location} (radius: ${radius || 10}km)`);
      
      let allActivities: any[] = [];
      let googleActivities: any[] = [];
      let amadeusActivities: any[] = [];

      // 1. Try Google Maps first for rich data (photos, reviews, opening hours)
      try {
        console.log('📍 Searching Google Maps for activities...');
        googleActivities = await googleMapsService.searchActivities(location, {
          radius: radius || 10,
          limit: 25,
          type: 'activity'
        });
        
        console.log(`✅ Google Maps found ${googleActivities.length} activities`);
        allActivities = allActivities.concat(googleActivities);
      } catch (googleError: unknown) {
        console.log('⚠️ Google Maps search failed, will try Amadeus fallback:', googleError instanceof Error ? googleError.message : 'Unknown error');
      }

      // 2. Always try Amadeus for booking data and additional activities
      try {
        console.log('🎫 Searching Amadeus for activities...');
        
        const coordinates = await getCityCoordinates(location);
        if (coordinates) {
          const amadeusResults = await searchActivities(
            coordinates.lat,
            coordinates.lng,
            radius || 10
          );
          
          // Transform Amadeus results to our format
          amadeusActivities = amadeusResults.map((activity, index) => ({
            id: `amadeus-${activity.id || index}`,
            name: activity.name,
            description: activity.shortDescription,
            longDescription: activity.description || activity.shortDescription,
            price: activity.price ? parseFloat(activity.price.amount) : 50,
            currency: activity.price?.currencyCode || 'USD',
            rating: parseFloat(activity.rating || '4.0'),
            duration: activity.minimumDuration || '2-3 hours',
            category: 'sightseeing',
            location: location,
            latitude: activity.geoCode.latitude,
            longitude: activity.geoCode.longitude,
            images: activity.pictures || [],
            bookingUrl: activity.bookingLink || `https://www.amadeus.com/activities/${activity.id}`,
            provider: 'Amadeus',
            // Amadeus specific data
            amadeusId: activity.id,
            destination: activity.destination
          }));
          
          console.log(`✅ Amadeus found ${amadeusActivities.length} activities`);
        }
      } catch (amadeusError: unknown) {
        console.log('⚠️ Amadeus search failed:', amadeusError instanceof Error ? amadeusError.message : 'Unknown error');
      }

      // 3. Merge and enhance results - prioritize Google Maps data, enhance with Amadeus booking info
      const enhancedActivities = [...googleActivities];
      
      // Add unique Amadeus activities that aren't already covered by Google Maps
      for (const amadeusActivity of amadeusActivities) {
        // Check if we already have this activity from Google Maps (by name similarity and proximity)
        const duplicate = enhancedActivities.find(existing => {
          const nameMatch = existing.name.toLowerCase().includes(amadeusActivity.name.toLowerCase()) ||
                           amadeusActivity.name.toLowerCase().includes(existing.name.toLowerCase());
          const proximityMatch = Math.abs(existing.latitude - amadeusActivity.latitude) < 0.001 &&
                                Math.abs(existing.longitude - amadeusActivity.longitude) < 0.001;
          return nameMatch && proximityMatch;
        });
        
        if (!duplicate) {
          enhancedActivities.push(amadeusActivity);
        } else {
          // Enhance existing Google Maps entry with Amadeus booking data
          if (amadeusActivity.bookingUrl && !duplicate.bookingUrl?.includes('google.com')) {
            duplicate.amadeusBookingUrl = amadeusActivity.bookingUrl;
            duplicate.amadeusPrice = amadeusActivity.price;
            duplicate.amadeusCurrency = amadeusActivity.currency;
          }
        }
      }

      // 4. Sort by rating and relevance (Google Maps entries first due to richer data)
      const sortedActivities = enhancedActivities.sort((a, b) => {
        // Prioritize Google Maps results
        if (a.provider === 'Google Maps' && b.provider !== 'Google Maps') return -1;
        if (b.provider === 'Google Maps' && a.provider !== 'Google Maps') return 1;
        
        // Then sort by rating
        return b.rating - a.rating;
      });

      // 5. Limit results and ensure variety
      const finalActivities = sortedActivities.slice(0, 30);
      
      console.log(`🎯 Enhanced search complete: ${finalActivities.length} total activities (${googleActivities.length} from Google Maps, ${amadeusActivities.length} from Amadeus)`);
      
      // Provide fallback if no results found
      if (finalActivities.length === 0) {
        console.log('❌ No activities found from either source');
        return res.json([]);
      }

      res.json(finalActivities);
    } catch (error: unknown) {
      console.error('❌ Enhanced activity search error:', error);
      res.status(500).json({ error: 'Failed to search activities' });
    }
  });

  // Activities discover endpoint for trip destination
  app.get("/api/activities/discover", async (req: any, res) => {
    try {
      const { location } = req.query;
      
      if (!location) {
        return res.status(400).json({ error: "Location parameter is required" });
      }
      
      const coordinates = await getCityCoordinates(location as string);
      if (!coordinates) {
        return res.status(400).json({ error: "Unable to find coordinates for location" });
      }
      
      // For country-level searches, search multiple major cities
      let activities: any[] = [];
      
      if (location.toString().toLowerCase().includes('croatia')) {
        // Search multiple Croatian cities for comprehensive results
        const croatianCities = [
          { lat: 45.8150, lng: 15.9819 }, // Zagreb
          { lat: 42.6507, lng: 18.0944 }, // Dubrovnik
          { lat: 44.1194, lng: 15.2314 }, // Zadar
          { lat: 43.5081, lng: 16.4402 }, // Split
          { lat: 45.3271, lng: 14.4422 }, // Rijeka
          { lat: 45.1, lng: 15.2 },       // General Croatia coordinates
        ];
        
        for (const city of croatianCities) {
          const cityActivities = await searchActivities(city.lat, city.lng, 30);
          activities = activities.concat(cityActivities);
        }
        
        // Remove duplicates based on activity name and location
        const uniqueActivities = activities.filter((activity, index, self) => 
          index === self.findIndex(a => 
            a.name === activity.name && 
            Math.abs(a.geoCode.latitude - activity.geoCode.latitude) < 0.01
          )
        );
        activities = uniqueActivities;
      } else {
        // Single city search
        activities = await searchActivities(
          coordinates.lat,
          coordinates.lng,
          20 // 20km radius for good coverage
        );
      }
      
      // Transform Amadeus results to frontend format
      const transformedActivities = activities.map((activity, index) => ({
        id: activity.id || `activity-${index}`,
        name: activity.name || 'Activity Experience',
        description: activity.shortDescription || activity.description || 'Discover this amazing experience',
        longDescription: activity.description || activity.shortDescription || 'Discover this amazing experience',
        price: activity.price ? parseFloat(activity.price.amount) : 50,
        currency: activity.price?.currencyCode || 'USD',
        rating: parseFloat(activity.rating || '4.0'),
        duration: activity.minimumDuration || '2-3 hours',
        category: 'sightseeing',
        location: location as string, // Use the search location instead of coordinates
        latitude: activity.geoCode?.latitude,
        longitude: activity.geoCode?.longitude,
        images: activity.pictures || [],
        bookingUrl: activity.bookingLink || `https://www.amadeus.com/activities/${activity.id}`,
        provider: 'Amadeus'
      }));
      
      // Limit results to prevent frontend crashes with large datasets
      const limitedActivities = transformedActivities.slice(0, 20);
      
      console.log(`✅ Returning ${limitedActivities.length} activities for ${location} (limited from ${transformedActivities.length})`);
      
      res.json(limitedActivities);
    } catch (error: unknown) {
      console.error('Activities discover error:', error);
      res.status(500).json({ error: 'Failed to discover activities' });
    }
  });

  // Location service routes
  app.get("/api/locations/stats", async (req, res) => {
    try {
      const stats = await locationService.getLocationStats();
      res.json(stats);
    } catch (error: unknown) {
      console.error("Error getting location stats:", error);
      res.status(500).json({ message: "Failed to get location stats" });
    }
  });

  app.post("/api/locations/search", async (req, res) => {
    try {
      const { query, type, types, limit, useApi } = req.body ?? {};

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query parameter is required" });
      }

      const typeList = Array.isArray(types)
        ? types
        : typeof types === 'string'
          ? [types]
          : undefined;

      const results = await locationService.searchLocationsForApi({
        query,
        type,
        types: typeList,
        limit,
        useApi,
      });
      res.json(results);
    } catch (error: unknown) {
      console.error("Error searching locations:", error);
      res.status(500).json({ message: "Failed to search locations" });
    }
  });

  app.post("/api/locations/refresh", async (req, res) => {
    try {
      console.log("🔄 Starting location data refresh...");
      
      const onProgress = (current: number, total: number, type: string) => {
        console.log(`📊 ${type}: ${current}/${total} (${Math.round(current/total*100)}%)`);
      };
      
      const data = await locationService.fetchAllLocations(onProgress);
      
      res.json({
        success: true,
        message: "Location data refreshed successfully",
        stats: {
          airports: data.airports.length,
          cities: data.cities.length,
          countries: data.countries.length,
          lastUpdated: data.lastUpdated
        }
      });
    } catch (error: unknown) {
      console.error("Error refreshing location data:", error);
      res.status(500).json({ message: "Failed to refresh location data" });
    }
  });

  // Trip flights route
  app.get('/api/trips/:id/flights', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = getRequestUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      // Check if user is still a member of the trip
      const trip = await storage.getTripById(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }
      
      const isMember = trip.members.some(member => member.userId === userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are no longer a member of this trip" });
      }
      
      const flights = await storage.getTripFlights(tripId);
      res.json(flights);
    } catch (error: unknown) {
      console.error("Error fetching flights:", error);
      res.status(500).json({ message: "Failed to fetch flights" });
    }
  });

  // Trip location route
  app.get('/api/trips/:id/my-location', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = getRequestUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      // Check if user is still a member of the trip
      const trip = await storage.getTripById(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }
      
      const isMember = trip.members.some(member => member.userId === userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are no longer a member of this trip" });
      }
      
      // Return the trip destination for location-based searches
      res.json({ destination: trip.destination });
    } catch (error: unknown) {
      console.error("Error fetching trip location:", error);
      res.status(500).json({ message: "Failed to fetch trip location" });
    }
  });

  // Trip activities route
  app.get('/api/trips/:id/activities', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      // Check if user is still a member of the trip
      const trip = await storage.getTripById(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }
      
      const isMember = trip.members.some(member => member.userId === userId);
      const isCreator = trip.createdBy === userId;
      if (!isMember && !isCreator) {
        return res.status(403).json({ message: "You are no longer a member of this trip" });
      }

      const activities = await storage.getTripActivities(tripId, userId);

      res.json(activities);
    } catch (error: unknown) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  const getTripMemberDisplayName = (
    member?: { user?: { firstName?: string | null; lastName?: string | null; username?: string | null; email?: string | null } },
  ): string => {
    if (!member?.user) {
      return "A trip member";
    }

    return getUserDisplayName({
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      username: member.user.username,
      email: member.user.email,
    });
  };

  const hasMeaningfulValue = (value: unknown): boolean => {
    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value === "string") {
      return value.trim().length > 0;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return true;
  };

  const coerceArrayFromDelimitedString = (value: string): string[] => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((entry) => (entry === null || entry === undefined ? "" : String(entry).trim()))
            .filter((entry) => entry.length > 0);
        }
      } catch (error) {
        console.warn("Failed to parse attendee JSON payload", { error, value: trimmed });
      }
    }

    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  };

  const coerceAttendeeIdCollection = (value: unknown): string[] | undefined => {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (Array.isArray(value)) {
      const normalized = value
        .map((entry) => {
          if (entry === null || entry === undefined) {
            return "";
          }

          if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
            return String(entry).trim();
          }

          if (typeof entry === "object") {
            const record = entry as Record<string, unknown>;
            const possibleIds = [
              record.id,
              record.userId,
              record.user_id,
              (record.user as Record<string, unknown> | undefined)?.id,
              (record.user as Record<string, unknown> | undefined)?.userId,
              (record.user as Record<string, unknown> | undefined)?.user_id,
            ];

            for (const candidate of possibleIds) {
              if (typeof candidate === "string" || typeof candidate === "number" || typeof candidate === "boolean") {
                return String(candidate).trim();
              }
            }
          }

          return "";
        })
        .filter((entry) => entry.length > 0);

      return normalized;
    }

    if (typeof value === "string") {
      return coerceArrayFromDelimitedString(value);
    }

    if (typeof value === "number" || typeof value === "boolean") {
      const candidate = String(value).trim();
      return candidate.length > 0 ? [candidate] : [];
    }

    return undefined;
  };

  const normalizeActivityRequestPayload = (
    body: unknown,
    tripId: number,
    mode: ActivityType,
  ): Record<string, unknown> => {
    const base = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const normalized: Record<string, unknown> = { ...base };

    const ensureField = (field: string, candidates: unknown[]) => {
      const current = normalized[field];

      if (Array.isArray(current)) {
        if (current.length > 0) {
          return;
        }
      } else if (hasMeaningfulValue(current)) {
        return;
      }

      for (const candidate of candidates) {
        if (candidate === undefined) {
          continue;
        }

        if (Array.isArray(candidate)) {
          if (candidate.length === 0) {
            continue;
          }
          normalized[field] = candidate;
          return;
        }

        if (hasMeaningfulValue(candidate)) {
          normalized[field] = candidate;
          return;
        }
      }
    };

    ensureField("name", [base.title, base.activityName, base.label]);
    ensureField("description", [base.details, base.summary, base.notes, base.descriptionText]);
    ensureField("location", [base.address, base.venue, base.place, base.location_name, base.locationName]);
    ensureField("cost", [base.cost_per_person, base.price_per_person, base.pricePerPerson, base.price, base.amount]);
    ensureField("maxCapacity", [base.max_participants, base.max_attendees, base.maxGuests, base.capacity]);
    ensureField("category", [base.activity_category, base.category_value]);
    ensureField("startTime", [
      base.start_time,
      base.start,
      base.startDateTime,
      base.start_date_time,
      base.starts_at,
      base.startsAt,
      base.start_at,
      base.startAt,
    ]);
    ensureField("endTime", [
      base.end_time,
      base.end,
      base.endDateTime,
      base.end_date_time,
      base.ends_at,
      base.endsAt,
      base.end_at,
      base.endAt,
    ]);
    ensureField("startDate", [
      base.start_date,
      base.startDate,
      base.date,
      base.activity_date,
      base.activityDate,
      base.event_date,
      base.eventDate,
    ]);

    if (!Array.isArray(normalized.attendeeIds) || normalized.attendeeIds.length === 0) {
      const attendeeCandidates = [
        base.attendeeIds,
        base.attendee_ids,
        base.inviteeIds,
        base.invitee_ids,
        base.attendees,
        base.invitees,
      ];

      for (const candidate of attendeeCandidates) {
        const coerced = coerceAttendeeIdCollection(candidate);
        if (coerced) {
          normalized.attendeeIds = coerced;
          break;
        }
      }
    }

    return {
      ...normalized,
      tripCalendarId: tripId,
      type: mode,
    } as Record<string, unknown>;
  };

  const handleTripActivityCreation = async (
    req: any,
    res: any,
    { tripIdParam, mode }: { tripIdParam: "id" | "tripId"; mode: ActivityType },
  ) => {
    let tripId: number | null = null;
    let userId: string | null = null;
    let hotelId: number | null = null;
    let attemptedInviteeIds: string[] = [];
    const correlationId = getCorrelationIdFromRequest(req);
    res.setHeader("x-correlation-id", correlationId);
    let payloadSummary: Record<string, unknown> | undefined;

    logActivityEvent("request", {
      correlationId,
      mode,
      tripIdParam: req.params?.[tripIdParam],
      body: req.body ?? {},
    });

    try {
      tripId = Number.parseInt(req.params[tripIdParam], 10);
      if (Number.isNaN(tripId)) {
        logActivityEvent("failure", {
          correlationId,
          mode,
          reason: "invalid-trip",
          tripIdParam: req.params?.[tripIdParam],
        });
        res.status(400).json({ message: "Invalid trip ID", correlationId });
        trackActivityCreationMetric({ mode, outcome: "failure", reason: "invalid-trip" });
        return;
      }

      userId = getRequestUserId(req);

      if (process.env.NODE_ENV === "development" && !req.isAuthenticated?.()) {
        userId = "demo-user";
      }

      if (!userId) {
        logActivityEvent("failure", {
          correlationId,
          mode,
          tripId,
          reason: "no-user",
        });
        res.status(401).json({ message: "User ID not found", correlationId });
        trackActivityCreationMetric({ mode, outcome: "failure", reason: "no-user" });
        return;
      }

      if (userId === DEMO_USER_ID) {
        await ensureDemoUserExists();
      }

      const trip = await storage.getTripById(tripId);
      if (!trip) {
        logActivityEvent("failure", {
          correlationId,
          mode,
          tripId,
          reason: "missing-trip",
        });
        res.status(404).json({ message: "Trip not found", correlationId });
        trackActivityCreationMetric({ mode, outcome: "failure", reason: "missing-trip" });
        return;
      }

      const isMember = trip.members.some((member) => member.userId === userId);
      const isCreator = trip.createdBy === userId;
      if (!isMember && !isCreator) {
        logActivityEvent("failure", {
          correlationId,
          mode,
          tripId,
          reason: "not-member",
          userId,
        });
        res.status(403).json({ message: "You are no longer a member of this trip", correlationId });
        trackActivityCreationMetric({ mode, outcome: "failure", reason: "not-member" });
        return;
      }

      const validMemberIds = new Set(
        trip.members
          .map((member) => member.userId)
          .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
          .map((id) => id.trim()),
      );
      if (trip.createdBy) {
        const creatorId = String(trip.createdBy).trim();
        if (creatorId) {
          validMemberIds.add(creatorId);
        }
      }
      if (userId) {
        const normalizedUserId = String(userId).trim();
        if (normalizedUserId) {
          validMemberIds.add(normalizedUserId);
        }
      }

      const rawData = normalizeActivityRequestPayload(req.body, tripId, mode);

      logActivityEvent("payload-prepared", {
        correlationId,
        mode,
        tripId,
        pipeline: "legacy",
        payload: rawData,
      });

      payloadSummary = {
        name: typeof rawData.name === "string" ? rawData.name : "",
        startTime: typeof rawData.startTime === "string" ? rawData.startTime : "",
        type: mode,
        attendeeCount: Array.isArray(rawData.attendeeIds) ? rawData.attendeeIds.length : 0,
      };

      const validationResult = validateActivityInput(rawData, {
        tripCalendarId: tripId,
        userId,
        validMemberIds,
        tripStartDate: trip.startDate ?? null,
        tripEndDate: trip.endDate ?? null,
      });

      const attendeeIds = Array.isArray(validationResult.attendeeIds) ? validationResult.attendeeIds : [];
      const validationIssues = Array.isArray(validationResult.errors)
        ? [...validationResult.errors]
        : [];

      if (attendeeIds.length === 0) {
        const hasAttendeeIssue = validationIssues.some((issue) => issue?.field === "attendeeIds");
        if (!hasAttendeeIssue) {
          validationIssues.push({ field: "attendeeIds", message: ATTENDEE_REQUIRED_MESSAGE });
        }
      }

      if (validationIssues.length > 0 || !validationResult.data || attendeeIds.length === 0) {
        const validationFields = validationIssues.map((issue) => issue.field).filter(Boolean);

        logActivityCreationFailure({
          correlationId,
          step: "validate",
          userId,
          tripId,
          error: validationIssues.length > 0 ? validationIssues : "Unknown validation error",
          mode,
          validationFields,
          payloadSummary,
        });
        trackActivityCreationMetric({
          mode,
          outcome: "failure",
          reason: "validation",
          validationFields,
        });

        logActivityEvent("validation-error", {
          correlationId,
          mode,
          tripId,
          pipeline: "legacy",
          reason: "server-validation",
          errors: validationIssues,
        });

        const firstErrorMessage = validationIssues[0]?.message
          ?? "Activity could not be created due to validation errors.";

        res.status(400).json({
          message: firstErrorMessage,
          correlationId,
          errors: validationIssues,
        });
        return;
      }

      const attendeeIdSet = new Set(attendeeIds);
      attendeeIdSet.delete(userId);
      const inviteeIds = Array.from(attendeeIdSet);
      attemptedInviteeIds = inviteeIds;

      payloadSummary = {
        name: validationResult.data.name,
        startTime: validationResult.data.startTime,
        type: validationResult.data.type,
        attendeeCount: attendeeIds.length,
      };

      const normalizedData = { ...validationResult.data, type: mode };

      const activity = await storage.createActivityWithInvites(normalizedData, userId, inviteeIds);

      payloadSummary = {
        ...payloadSummary,
        activityId: activity.id,
      };

      logActivityEvent("success", {
        correlationId,
        mode,
        tripId,
        pipeline: "legacy",
        activityId: activity.id,
      });

      const attendeesToNotify = inviteeIds.filter((attendeeId) => attendeeId !== userId);

      if (attendeesToNotify.length > 0) {
        const eventDate = activity.startTime ? new Date(activity.startTime) : null;
        const fallbackDateString = (() => {
          if (typeof rawData.startDate === "string" && rawData.startDate.trim().length > 0) {
            return rawData.startDate.trim();
          }
          if (typeof rawData.date === "string" && rawData.date.trim().length > 0) {
            return rawData.date.trim();
          }
          return null;
        })();
        const fallbackDate = fallbackDateString ? new Date(`${fallbackDateString}T00:00:00Z`) : null;
        const hasValidFallbackDate = fallbackDate && !Number.isNaN(fallbackDate.getTime());
        const formattedDate = eventDate
          ? eventDate.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : hasValidFallbackDate
            ? fallbackDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "the selected date";

        const proposerMember = trip.members.find((member) => member.userId === userId);
        const proposerName = getTripMemberDisplayName(proposerMember);
        const notificationType = mode === "PROPOSE" ? "activity_proposal" : "activity_invite";
        const notificationTitle =
          mode === "PROPOSE"
            ? `${proposerName} proposed ${activity.name}`
            : `You've been invited to ${activity.name}`;
        const notificationMessage =
          mode === "PROPOSE"
            ? `${proposerName} suggested ${activity.name} on ${formattedDate}${eventDate ? "" : " (time TBD)"}. Vote when you're ready.`
            : `You've been invited to ${activity.name} on ${formattedDate}${eventDate ? "" : " (time TBD)"}.`;

        const notificationResults = await Promise.allSettled(
          attendeesToNotify.map((attendeeId) =>
            storage.createNotification({
              userId: attendeeId,
              type: notificationType,
              title: notificationTitle,
              message: notificationMessage,
              tripId: tripId,
              activityId: activity.id,
            }),
          ),
        );

        const failedNotification = notificationResults.find(
          (result): result is PromiseRejectedResult => result.status === "rejected",
        );

        if (failedNotification) {
          console.warn("Activity notification dispatch failed", {
            correlationId,
            tripId,
            userId,
            failedCount: notificationResults.filter((result) => result.status === "rejected").length,
            error: failedNotification.reason,
          });

          logActivityCreationFailure({
            correlationId,
            step: "notify",
            userId,
            tripId,
            error: failedNotification.reason,
            mode,
            payloadSummary,
          });
        }
      }

      broadcastToTrip(tripId, {
        type: "activity_created",
        activityId: activity.id,
        activityType: mode,
      });

      const activities = await storage.getTripActivities(tripId, userId);
      const createdActivity = activities.find((item) => item.id === activity.id);

      const responsePayload =
        createdActivity
        ?? (mode === "PROPOSE"
          ? (() => {
              const posterMember = trip.members.find((member) => member.userId === userId);
              const fallbackPoster: User =
                posterMember?.user
                ?? ({
                  id: userId,
                  email: "",
                  username: null,
                  firstName: null,
                  lastName: null,
                  phoneNumber: null,
                  passwordHash: null,
                  profileImageUrl: null,
                  cashAppUsername: null,
                  cashAppUsernameLegacy: null,
                  cashAppPhone: null,
                  cashAppPhoneLegacy: null,
                  venmoUsername: null,
                  venmoPhone: null,
                  timezone: null,
                  defaultLocation: null,
                  defaultLocationCode: null,
                  defaultCity: null,
                  defaultCountry: null,
                  authProvider: null,
                  notificationPreferences: null,
                  hasSeenHomeOnboarding: false,
                  hasSeenTripOnboarding: false,
                  createdAt: activity.createdAt ?? new Date().toISOString(),
                  updatedAt:
                    activity.updatedAt
                    ?? activity.createdAt
                    ?? new Date().toISOString(),
                } satisfies User);

              return {
                ...activity,
                type: "PROPOSE" as ActivityWithDetails["type"],
                poster: fallbackPoster,
                invites: [] as (ActivityInvite & { user: User })[],
                acceptances: [] as (ActivityAcceptance & { user: User })[],
                comments: [] as (ActivityComment & { user: User })[],
                acceptedCount: 0,
                pendingCount: 0,
                declinedCount: 0,
                waitlistedCount: 0,
                currentUserInvite: null,
                isAccepted: undefined,
                hasResponded: undefined,
                permissions: { canCancel: true },
              } satisfies ActivityWithDetails;
            })()
          : activity);

      trackActivityCreationMetric({ mode, outcome: "success" });

      res.status(201).json(responsePayload);
    } catch (error: unknown) {
      if (error instanceof ActivityInviteMembershipError) {
        const { invalidInviteeIds, attemptedInviteeIds: invalidAttemptedInviteeIds } = error;

        console.warn("Activity creation blocked due to non-member invites", {
          correlationId,
          tripId,
          userId,
          invalidInviteeIds,
          attemptedInviteeIds: invalidAttemptedInviteeIds,
          error,
        });

        logActivityCreationFailure({
          correlationId,
          step: "save",
          userId,
          tripId,
          error,
          mode,
          payloadSummary,
        });

        trackActivityCreationMetric({ mode, outcome: "failure", reason: "invalid-invite" });

        logActivityEvent("failure", {
          correlationId,
          mode,
          tripId,
          pipeline: "legacy",
          reason: "invalid-invitees",
          invalidInviteeIds,
        });

        res.status(400).json({
          message: error.message,
          correlationId,
          invalidInviteeIds,
          errors: [
            {
              field: "attendeeIds",
              message: error.message,
            },
          ],
        });
        return;
      }

      if (error instanceof ActivityDuplicateError) {
        console.warn("Activity creation blocked due to duplicate activity", {
          correlationId,
          tripId,
          userId,
          activityId: error.existingActivityId,
          activityName: error.activityName,
          startTime: error.startTime,
          mode,
        });

        logActivityCreationFailure({
          correlationId,
          step: "save",
          userId,
          tripId,
          error,
          mode,
          payloadSummary,
        });

        trackActivityCreationMetric({ mode, outcome: "failure", reason: "duplicate" });

        res.status(409).json({
          message: "This looks like a duplicate activity.",
          correlationId,
          duplicateActivityId: error.existingActivityId,
          errors: [
            {
              field: "name",
              message: "An activity with this name and start time already exists for this trip.",
            },
            {
              field: "startTime",
              message: "Pick a different time or rename the activity to avoid duplicates.",
            },
          ],
        });
        return;
      }

      if (isPostgresConstraintViolation(error)) {
        const invalidInviteeIds = extractInviteeIdsFromDetail(error.detail);

        console.warn("Activity creation failed due to invite constraint violation", {
          correlationId,
          tripId,
          userId,
          invalidInviteeIds,
          attemptedInviteeIds,
          error,
        });

        logActivityCreationFailure({
          correlationId,
          step: "save",
          userId,
          tripId,
          error,
          mode,
          payloadSummary,
        });

        trackActivityCreationMetric({ mode, outcome: "failure", reason: "constraint" });

        res.status(400).json({
          message: "One or more invitees are no longer members of this trip.",
          correlationId,
          invalidInviteeIds,
          errors: [
            {
              field: "attendeeIds",
              message: "Some selected invitees are no longer part of this trip.",
            },
          ],
        });
        return;
      }

      console.error("Error creating activity:", error);
      logActivityCreationFailure({
        correlationId,
        step: "save",
        userId,
        tripId,
        error,
        mode,
        payloadSummary,
      });

      trackActivityCreationMetric({ mode, outcome: "failure", reason: "exception" });

      const errorMessage = getErrorMessage(error, "We couldn’t create this activity. Nothing was saved. Please try again.");

      logActivityEvent("failure", {
        correlationId,
        mode,
        tripId,
        pipeline: "legacy",
        message: errorMessage,
      });

      res.status(500).json({
        message: errorMessage,
        correlationId,
      });
    }
  };

  app.post('/api/trips/:id/activities', async (req: any, res) => {
    await handleTripActivityCreation(req, res, { tripIdParam: "id", mode: "SCHEDULED" });
  });

  app.post('/api/trips/:tripId/proposals/activities', async (req: any, res) => {
    await handleTripActivityCreation(req, res, { tripIdParam: "tripId", mode: "PROPOSE" });
  });

  app.post('/api/activities/:activityId/responses', async (req: any, res) => {
    try {
      const activityId = parseInt(req.params.activityId);
      if (isNaN(activityId)) {
        return res.status(400).json({ message: 'Invalid activity ID' });
      }

      let userId = getRequestUserId(req);
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const rsvpRaw =
        typeof req.body?.rsvp === 'string'
          ? req.body.rsvp.trim().toUpperCase()
          : '';
      const mappedStatus = RSVP_ACTION_MAP[rsvpRaw as keyof typeof RSVP_ACTION_MAP];

      if (!mappedStatus) {
        return res.status(400).json({ message: 'Invalid RSVP status' });
      }

      const result = await applyActivityResponse(activityId, userId, mappedStatus);

      if ('error' in result) {
        return res.status(result.error.status).json({ message: result.error.message });
      }

      res.json({
        invite: result.updatedInvite,
        activity: result.updatedActivity,
        promotedUserId: result.promotedUserId,
      });
    } catch (error: unknown) {
      console.error('Error responding to activity invite:', error);
      res.status(500).json({ message: 'Failed to update activity invite' });
    }
  });

  app.post('/api/activities/:activityId/respond', async (req: any, res) => {
    try {
      const activityId = parseInt(req.params.activityId);
      if (isNaN(activityId)) {
        return res.status(400).json({ message: 'Invalid activity ID' });
      }

      let userId = getRequestUserId(req);
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }

      if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
      }

      const rawStatus = typeof req.body?.status === 'string' ? req.body.status.toLowerCase() : '';
      const statusResult = activityInviteStatusSchema.safeParse(rawStatus);
      if (!statusResult.success) {
        return res.status(400).json({ message: 'Invalid RSVP status' });
      }

      const normalizedStatus = statusResult.data;
      const result = await applyActivityResponse(activityId, userId, normalizedStatus);

      if ('error' in result) {
        return res.status(result.error.status).json({ message: result.error.message });
      }

      res.json({
        invite: result.updatedInvite,
        activity: result.updatedActivity,
        promotedUserId: result.promotedUserId,
      });
    } catch (error: unknown) {
      console.error('Error responding to activity invite:', error);
      res.status(500).json({ message: 'Failed to update activity invite' });
    }
  });

  app.post('/api/activities/:activityId/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const activityId = parseInt(req.params.activityId);
      if (Number.isNaN(activityId)) {
        return res.status(400).json({ message: 'Invalid activity ID' });
      }

      let userId = getRequestUserId(req);
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }

      if (!userId) {
        return res.status(401).json({ message: 'User ID not found' });
      }

      const activity = await storage.cancelActivity(activityId, userId);

      broadcastToTrip(activity.tripCalendarId, {
        type: 'activity_canceled',
        activityId,
      });

      res.json({ success: true, activityId });
    } catch (error: unknown) {
      console.error('Error canceling activity:', error);
      if (error instanceof Error) {
        if (error.message === 'Activity not found' || error.message === 'Trip not found') {
          return res.status(404).json({ message: error.message });
        }
        if (
          error.message.includes('cancel activities you created') ||
          error.message.includes('no longer a member')
        ) {
          return res.status(403).json({ message: error.message });
        }
      }

      res.status(500).json({ message: 'Failed to cancel activity' });
    }
  });

  app.post('/api/activities/:activityId/convert', isAuthenticated, async (req: any, res) => {
    try {
      const activityId = Number.parseInt(req.params.activityId, 10);
      if (Number.isNaN(activityId)) {
        return res.status(400).json({ message: 'Invalid activity ID' });
      }

      let userId = getRequestUserId(req);
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated?.()) {
        userId = 'demo-user';
      }

      if (!userId) {
        return res.status(401).json({ message: 'User ID not found' });
      }

      const updatedActivity = await storage.convertActivityProposalToScheduled(activityId, userId);

      const trip = await storage.getTripById(updatedActivity.tripCalendarId);
      const proposerMember = trip?.members.find((member) => member.userId === userId);
      const proposerName = getTripMemberDisplayName(proposerMember);

      const eventDate = updatedActivity.startTime ? new Date(updatedActivity.startTime) : null;
      const formattedDate = eventDate && !Number.isNaN(eventDate.getTime())
        ? eventDate.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : null;

      const notificationTitle = `${proposerName} scheduled ${updatedActivity.name}`;
      const notificationMessage = formattedDate
        ? `${proposerName} booked ${updatedActivity.name} for ${formattedDate}. RSVP when you can.`
        : `${proposerName} booked ${updatedActivity.name}. RSVP when you can.`;

      const inviteeIds = Array.from(
        new Set(
          (updatedActivity.invites ?? [])
            .map((invite) => invite.userId)
            .filter((inviteId): inviteId is string => Boolean(inviteId && inviteId !== userId)),
        ),
      );

      if (inviteeIds.length > 0) {
        const notificationResults = await Promise.allSettled(
          inviteeIds.map((inviteeId) =>
            storage.createNotification({
              userId: inviteeId,
              type: 'activity_invite',
              title: notificationTitle,
              message: notificationMessage,
              tripId: updatedActivity.tripCalendarId,
              activityId: updatedActivity.id,
            }),
          ),
        );

        const failedNotification = notificationResults.find(
          (result): result is PromiseRejectedResult => result.status === 'rejected',
        );

        if (failedNotification) {
          console.warn('Activity conversion notification dispatch failed', {
            tripId: updatedActivity.tripCalendarId,
            activityId: updatedActivity.id,
            userId,
            failedCount: notificationResults.filter((result) => result.status === 'rejected').length,
            error: failedNotification.reason,
          });
        }
      }

      broadcastToTrip(updatedActivity.tripCalendarId, {
        type: 'activity_converted',
        activityId: updatedActivity.id,
      });

      res.json(updatedActivity);
    } catch (error: unknown) {
      console.error('Error converting activity proposal:', error);
      if (error instanceof Error) {
        if (error.message === 'Activity not found' || error.message === 'Trip not found') {
          return res.status(404).json({ message: error.message });
        }
        if (
          error.message.includes('convert activities you created') ||
          error.message.includes('no longer a member')
        ) {
          return res.status(403).json({ message: error.message });
        }
        if (
          error.message.includes('already scheduled') ||
          error.message.includes('Add a start time') ||
          error.message.includes('canceled')
        ) {
          return res.status(400).json({ message: error.message });
        }
      }

      res.status(500).json({ message: 'Failed to convert activity proposal' });
    }
  });

  // WebSocket setup
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<WebSocket, ClientInfo>();

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'join_trip') {
          assignClientToTrip(clients, ws, data);
        }
      } catch (error: unknown) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket client disconnected');
    });
  });

  broadcastToTrip = (tripId: number, message: any) => {
    broadcastMessageToTripClients(clients, tripId, message, WebSocket);
  };

  // Delete trip route
  app.delete('/api/trips/:id', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      await storage.deleteTrip(tripId, userId);
      
      // Broadcast trip deletion to all members
      broadcastToTrip(tripId, {
        type: 'trip_deleted',
        tripId
      });
      
      res.json({ success: true, message: "Trip deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting trip:", error);
      const errorMessage = getErrorMessage(error);
      if (errorMessage.includes("Only the trip creator")) {
        res.status(403).json({ message: errorMessage });
      } else {
        res.status(500).json({ message: "Failed to delete trip" });
      }
    }
  });

  // Restaurant search endpoint using Google Maps API with Foursquare fallback
  app.get("/api/restaurants/search", async (req: any, res) => {
    try {
      const { location, cuisine, priceRange, limit = 20, radius = 5000 } = req.query;

      if (!location) {
        return res.status(400).json({ message: "Location parameter is required" });
      }

      const options = {
        limit: parseInt(limit as string) || 20,
        radius: parseInt(radius as string) || 5000,
        cuisine: cuisine as string,
        priceRange: priceRange as string
      };

      try {
        // Try Google Maps first
        const restaurants = await googleMapsService.searchRestaurants(location as string, options);
        console.log(`✅ Google Maps returned ${restaurants.length} restaurants`);
        res.json(restaurants);
      } catch (googleError) {
        console.error("Google Maps restaurant search failed, falling back to Foursquare/OpenStreetMap:", googleError);
        
        // Fallback to existing Foursquare/OpenStreetMap service
        const restaurants = await foursquareService.searchRestaurants(location as string, options);
        console.log(`✅ Fallback service returned ${restaurants.length} restaurants`);
        res.json(restaurants);
      }
      
    } catch (error: unknown) {
      console.error("Error searching restaurants:", error);
      res.status(500).json({
        message: "Failed to search restaurants",
        error: getErrorMessage(error)
      });
    }
  });

  app.get('/api/trips/:id/restaurants', async (req: any, res) => {
    try {
      const tripId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip id" });
      }

      let userId = getRequestUserId(req);
      if (process.env.NODE_ENV === 'development' && typeof req.isAuthenticated === 'function' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const trip = await storage.getTripById(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const tripMembers = Array.isArray(trip.members) ? trip.members : [];
      const isMember =
        trip.createdBy === userId || tripMembers.some((member) => member.userId === userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are no longer a member of this trip" });
      }

      const restaurants = await storage.getTripRestaurants(tripId);
      res.json(restaurants);
    } catch (error: unknown) {
      console.error("Error fetching restaurants:", error);
      res.status(500).json({ message: "Failed to fetch restaurants" });
    }
  });

  app.post('/api/trips/:id/restaurants', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const trip = await storage.getTripById(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const tripMembers = Array.isArray(trip.members) ? trip.members : [];
      const isMember =
        trip.createdBy === userId || tripMembers.some((member) => member.userId === userId);
      if (!isMember) {
        return res.status(403).json({ message: "You are no longer a member of this trip" });
      }

      const rawBody = req.body ?? {};
      const validatedData = insertRestaurantSchema.parse({
        ...rawBody,
        reservationDate: rawBody.reservationDate ?? rawBody.reservation_date,
        reservationTime: rawBody.reservationTime ?? rawBody.reservation_time,
        partySize: rawBody.partySize ?? rawBody.party_size,
        tripId,
      });

      const reservationDateIso = toDateOnlyIsoString(validatedData.reservationDate);
      if (!reservationDateIso) {
        return res.status(400).json({ message: "Invalid reservation date" });
      }

      const restaurant = await storage.createRestaurant(
        {
          ...validatedData,
          reservationDate: reservationDateIso,
        },
        userId,
      );

      res.status(201).json(restaurant);
    } catch (error: unknown) {
      console.error("Error adding restaurant:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid restaurant data", errors: error.errors });
        return;
      }

      if (isPostgresConstraintViolation(error)) {
        res.status(400).json({ message: getErrorMessage(error) });
        return;
      }

      res.status(500).json({ message: "Failed to add restaurant" });
    }
  });

  // Packing list routes
  app.get('/api/trips/:id/packing', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const packingItems = await storage.getTripPackingItems(tripId, userId);
      res.json(packingItems);
    } catch (error: unknown) {
      console.error("Error fetching packing items:", error);
      res.status(500).json({ message: "Failed to fetch packing items" });
    }
  });

  app.post('/api/trips/:id/packing', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const validatedData = insertPackingItemSchema.parse({
        ...req.body,
        tripId
      });
      
      const packingItem = await storage.addPackingItem(validatedData, userId);
      res.json(packingItem);
    } catch (error: unknown) {
      console.error("Error adding packing item:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid packing item data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to add packing item" });
      }
    }
  });

  app.patch('/api/packing/:id/toggle', async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.id);
      let userId = getRequestUserId(req);

      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const packingItem = await storage.getPackingItemById(itemId);
      if (!packingItem) {
        return res.status(404).json({ message: "Packing item not found" });
      }

      if (packingItem.itemType === "personal" && packingItem.userId !== userId) {
        return res.status(403).json({ message: "You are not allowed to update this item" });
      }

      await storage.togglePackingItem(itemId, userId, packingItem.itemType);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error toggling packing item:", error);
      res.status(500).json({ message: "Failed to toggle packing item" });
    }
  });

  app.post(
    '/api/trips/:tripId/packing/group-items/:itemId/handled',
    async (req: any, res) => {
      try {
        const tripId = parseInt(req.params.tripId);
        const itemId = parseInt(req.params.itemId);
        if (Number.isNaN(tripId) || Number.isNaN(itemId)) {
          return res.status(400).json({ message: "Invalid packing item" });
        }

        let userId = getRequestUserId(req);

        if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
          userId = 'demo-user';
        }

        if (!userId) {
          return res.status(401).json({ message: "User ID not found" });
        }

        const packingItem = await storage.getPackingItemById(itemId);
        if (!packingItem || packingItem.tripId !== tripId) {
          return res.status(404).json({ message: "Packing item not found" });
        }

        if (packingItem.itemType !== "group") {
          return res.status(400).json({ message: "Only group items support handled status" });
        }

        const isMember = await storage.isTripMember(tripId, userId);
        if (!isMember) {
          return res.status(403).json({ message: "You are not allowed to update this item" });
        }

        const updatedItem = await storage.markGroupItemHandled(
          itemId,
          tripId,
          userId,
        );
        res.json(updatedItem);
      } catch (error: unknown) {
        console.error("Error marking group item handled:", error);
        res.status(500).json({ message: "Failed to update group item status" });
      }
    },
  );

  app.delete(
    '/api/trips/:tripId/packing/group-items/:itemId/handled',
    async (req: any, res) => {
      try {
        const tripId = parseInt(req.params.tripId);
        const itemId = parseInt(req.params.itemId);
        if (Number.isNaN(tripId) || Number.isNaN(itemId)) {
          return res.status(400).json({ message: "Invalid packing item" });
        }

        let userId = getRequestUserId(req);

        if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
          userId = 'demo-user';
        }

        if (!userId) {
          return res.status(401).json({ message: "User ID not found" });
        }

        const packingItem = await storage.getPackingItemById(itemId);
        if (!packingItem || packingItem.tripId !== tripId) {
          return res.status(404).json({ message: "Packing item not found" });
        }

        if (packingItem.itemType !== "group") {
          return res.status(400).json({ message: "Only group items support handled status" });
        }

        const isMember = await storage.isTripMember(tripId, userId);
        if (!isMember) {
          return res.status(403).json({ message: "You are not allowed to update this item" });
        }

        const updatedItem = await storage.markGroupItemUnhandled(
          itemId,
          tripId,
          userId,
        );
        res.json(updatedItem);
      } catch (error: unknown) {
        console.error("Error marking group item unhandled:", error);
        res.status(500).json({ message: "Failed to update group item status" });
      }
    },
  );

  app.delete('/api/packing/:id', async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.id);
      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const packingItem = await storage.getPackingItemById(itemId);
      if (!packingItem) {
        return res.status(404).json({ message: "Packing item not found" });
      }

      if (packingItem.userId !== userId) {
        return res.status(403).json({ message: "You are not allowed to delete this item" });
      }

      await storage.deletePackingItem(itemId, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error deleting packing item:", error);
      res.status(500).json({ message: "Failed to delete packing item" });
    }
  });

  // Expenses routes
  app.get('/api/trips/:id/expenses', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const expenses = await storage.getTripExpenses(tripId);
      res.json(expenses);
    } catch (error: unknown) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post('/api/trips/:id/expenses', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const parsed = logSharedExpenseSchema.safeParse(req.body);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Invalid expense payload";
        return res.status(400).json({ message });
      }

      const {
        sourceAmountMinorUnits,
        sourceCurrency,
        targetCurrency,
        exchangeRate,
        exchangeRateLockedAt,
        exchangeRateProvider,
        description,
        category,
        participantUserIds,
        receiptUrl,
      } = parsed.data;

      const normalizedParticipants = Array.from(new Set(participantUserIds))
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && id !== userId);

      if (normalizedParticipants.length === 0) {
        return res
          .status(400)
          .json({ message: "Choose at least one person to split with." });
      }

      const expenseData = {
        tripId,
        paidBy: userId,
        sourceAmountMinorUnits,
        sourceCurrency,
        targetCurrency,
        exchangeRate,
        exchangeRateLockedAt,
        exchangeRateProvider,
        description,
        category,
        participantUserIds: normalizedParticipants,
        ...(receiptUrl ? { receiptUrl } : {}),
      };

      const expense = await storage.createExpense(expenseData, userId);
      res.json(expense);
    } catch (error: unknown) {
      console.error("Error adding expense:", error);
      res.status(500).json({ message: "Failed to add expense" });
    }
  });

  app.delete('/api/expenses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const expenseId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(expenseId)) {
        return res.status(400).json({ message: "Invalid expense ID" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      await storage.deleteExpense(expenseId, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error deleting expense:", error);
      if (error instanceof Error) {
        if (error.message === "Expense not found") {
          return res.status(404).json({ message: error.message });
        }
        if (error.message === "Only the payer can delete this expense") {
          return res.status(403).json({ message: error.message });
        }
      }

      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  app.patch('/api/expenses/:id/mark-paid', isAuthenticated, async (req: any, res) => {
    try {
      const expenseId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(expenseId)) {
        return res.status(400).json({ message: "Invalid expense ID" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      await storage.markExpenseAsPaid(expenseId, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error marking expense as paid:", error);
      if (error instanceof Error && error.message === "Expense share not found") {
        return res.status(404).json({ message: error.message });
      }

      res.status(500).json({ message: "Failed to mark expense as paid" });
    }
  });

  app.get('/api/trips/:id/expenses/balances', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = getRequestUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const balances = await storage.getUserExpenseBalances(tripId, userId);
      res.json(balances);
    } catch (error: unknown) {
      console.error("Error fetching expense balances:", error);
      res.status(500).json({ message: "Failed to fetch expense balances" });
    }
  });

  // Grocery list routes
  app.get('/api/trips/:id/groceries', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = getRequestUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const groceryItems = await storage.getTripGroceryItems(tripId);
      res.json(groceryItems);
    } catch (error: unknown) {
      console.error("Error fetching grocery items:", error);
      res.status(500).json({ message: "Failed to fetch grocery items" });
    }
  });

  app.post('/api/trips/:id/groceries', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const validatedData = insertGroceryItemSchema.parse({
        ...req.body,
        tripId,
        addedBy: userId
      });

      const groceryItem = await storage.createGroceryItem(validatedData, userId);
      res.json(groceryItem);
    } catch (error: unknown) {
      console.error("Error adding grocery item:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid grocery item data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to add grocery item" });
      }
    }
  });

  app.patch('/api/groceries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.id, 10);
      if (Number.isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid grocery item ID" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const updates = updateGroceryItemSchema.parse(req.body ?? {});
      await storage.updateGroceryItem(itemId, updates);
      const groceryItem = await storage.getGroceryItemWithDetails(itemId);
      res.json(groceryItem);
    } catch (error: unknown) {
      console.error("Error updating grocery item:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid grocery item data", errors: (error as any).errors });
      } else if (error instanceof Error && error.message === "Grocery item not found") {
        res.status(404).json({ message: "Grocery item not found" });
      } else {
        res.status(500).json({ message: "Failed to update grocery item" });
      }
    }
  });

  app.post('/api/groceries/:id/participate', isAuthenticated, async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.id, 10);
      if (Number.isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid grocery item ID" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const requestedUserId =
        typeof req.body?.userId === "string" && req.body.userId.trim().length > 0
          ? req.body.userId.trim()
          : undefined;
      const targetUserId = requestedUserId ?? userId;

      await storage.toggleGroceryItemParticipation(itemId, targetUserId);
      const groceryItem = await storage.getGroceryItemWithDetails(itemId);
      res.json(groceryItem);
    } catch (error: unknown) {
      console.error("Error updating grocery participation:", error);
      if (error instanceof Error && error.message === "Grocery item not found") {
        res.status(404).json({ message: "Grocery item not found" });
      } else {
        res.status(500).json({ message: "Failed to update grocery participation" });
      }
    }
  });

  app.patch('/api/groceries/:id/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.id, 10);
      if (Number.isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid grocery item ID" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const { actualCost, isPurchased } = req.body ?? {};
      let parsedActualCost: string | number | null | undefined = undefined;

      if (actualCost === null) {
        parsedActualCost = null;
      } else if (typeof actualCost === "number") {
        parsedActualCost = actualCost;
      } else if (typeof actualCost === "string") {
        const trimmed = actualCost.trim();
        parsedActualCost = trimmed === "" ? null : trimmed;
      }

      const purchaseState = typeof isPurchased === "boolean" ? isPurchased : true;

      await storage.markGroceryItemPurchased(itemId, parsedActualCost, purchaseState);
      const groceryItem = await storage.getGroceryItemWithDetails(itemId);
      res.json(groceryItem);
    } catch (error: unknown) {
      console.error("Error marking grocery item purchased:", error);
      if (error instanceof Error && error.message === "Grocery item not found") {
        res.status(404).json({ message: "Grocery item not found" });
      } else {
        res.status(500).json({ message: "Failed to update grocery item" });
      }
    }
  });

  app.delete('/api/groceries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const itemId = parseInt(req.params.id, 10);
      if (Number.isNaN(itemId)) {
        return res.status(400).json({ message: "Invalid grocery item ID" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      await storage.deleteGroceryItem(itemId);
      res.status(204).send();
    } catch (error: unknown) {
      console.error("Error deleting grocery item:", error);
      if (error instanceof Error && error.message === "Grocery item not found") {
        res.status(404).json({ message: "Grocery item not found" });
      } else {
        res.status(500).json({ message: "Failed to delete grocery item" });
      }
    }
  });

  app.get('/api/trips/:id/groceries/bill', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const groceryBill = await storage.getGroceryBill(tripId);
      res.json(groceryBill);
    } catch (error: unknown) {
      console.error("Error fetching grocery bill:", error);
      res.status(500).json({ message: "Failed to fetch grocery bill" });
    }
  });

  app.get(
    '/api/trips/:tripId/proposals/flights',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tripId = Number.parseInt(req.params.tripId, 10);
        if (Number.isNaN(tripId)) {
          return res.status(400).json({ message: "Invalid trip id" });
        }

        const userId = getRequestUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "User ID not found" });
        }

        const mineOnly = parseBooleanQueryParam(req.query?.mineOnly);
        const proposals = await storage.getTripFlightProposals(
          tripId,
          userId,
          mineOnly ? { proposedBy: userId } : undefined,
        );

        res.json(proposals);
      } catch (error: unknown) {
        console.error("Error fetching flight proposals:", error);
        res.status(500).json({ message: "Failed to fetch flight proposals" });
      }
    },
  );

  app.post(
    '/api/trips/:tripId/proposals/flights',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tripId = Number.parseInt(req.params.tripId, 10);
        if (Number.isNaN(tripId)) {
          return res.status(400).json({ message: "Invalid trip id" });
        }

        const userId = getRequestUserId(req);
        if (!userId) {
          return res.status(401).json({ message: "User ID not found" });
        }

        const parsedFlight = insertFlightSchema.safeParse(req.body);
        if (!parsedFlight.success) {
          return res
            .status(400)
            .json({ message: "Invalid flight data", errors: parsedFlight.error.issues });
        }

        if (parsedFlight.data.tripId !== tripId) {
          return res
            .status(400)
            .json({ message: "Trip ID mismatch between path and payload" });
        }

        const rawFlightId = req.body?.id ?? req.body?.flightId;
        const flightId =
          typeof rawFlightId === 'number'
            ? rawFlightId
            : rawFlightId != null
            ? Number.parseInt(String(rawFlightId), 10)
            : NaN;

        if (!Number.isFinite(flightId)) {
          return res
            .status(400)
            .json({ message: "Flight ID is required to propose to the group" });
        }

        const result = await storage.ensureFlightProposalForSavedFlight({
          flightId,
          tripId,
          currentUserId: userId,
        });

        const statusCode = result.wasCreated ? 201 : 200;

        res.status(statusCode).json(result.proposal);

        broadcastToTrip(tripId, {
          type: result.wasCreated ? "flight_proposal_created" : "flight_proposal_updated",
          tripId,
          proposalId: result.proposal.id,
          flightId: result.flightId,
          triggeredBy: userId,
        });
      } catch (error: unknown) {
        console.error("Error proposing flight to group:", error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid flight data", errors: error.issues });
        }
        if (error instanceof Error) {
          if (error.message.includes('Flight not found')) {
            return res.status(404).json({ message: error.message });
          }
          if (error.message.includes('does not belong to this trip')) {
            return res.status(400).json({ message: error.message });
          }
          if (error.message.includes('Only the flight creator') || error.message.includes('must be a member of this trip')) {
            return res.status(403).json({ message: error.message });
          }
        }

        res.status(500).json({ message: "Failed to propose flight" });
      }
    },
  );

  const handleGetTripHotelProposals = async (req: any, res: any) => {
    try {
      const tripIdParam =
        typeof req.params.tripId === 'string' ? req.params.tripId : (req.params.id as string | undefined);
      const tripId = Number.parseInt(String(tripIdParam ?? ''), 10);
      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const mineOnly = parseBooleanQueryParam(req.query?.mineOnly);
      const proposals = await storage.getTripHotelProposals(
        tripId,
        userId,
        mineOnly ? { proposedBy: userId } : undefined,
      );

      res.json(proposals);
    } catch (error: unknown) {
      console.error("Error fetching hotel proposals:", error);
      res.status(500).json({ message: "Failed to fetch hotel proposals" });
    }
  };

    const handlePostTripHotelProposals = async (req: any, res: any) => {
      let tripId: number | null = null;
      let userId: string | null = null;
      let hotelId: number | null = null;
      let parsedHotelPayload: InsertHotel | null = null;
      let hotelPayloadIssues: z.ZodIssue[] | null = null;

      try {
        const tripIdParam =
          typeof req.params.tripId === 'string' ? req.params.tripId : (req.params.id as string | undefined);
        const parsedTripId = Number.parseInt(String(tripIdParam ?? ''), 10);
        tripId = Number.isNaN(parsedTripId) ? null : parsedTripId;

        if (!Number.isFinite(tripId)) {
          return res.status(400).json({ message: "Invalid trip id" });
        }

      userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const ensureTripMembershipForAdHocProposal = async () => {
        const isMember = await storage.isTripMember(tripId, userId);
        if (isMember) {
          return { allowed: true as const };
        }

        const trip = await storage.getTripById(tripId);
        if (!trip) {
          return { allowed: false as const, status: 404, message: "Trip not found" };
        }

        return {
          allowed: false as const,
          status: 403,
          message: "You must be a member of this trip to share stays with the group.",
        };
      };

      const proposeHotelRequestSchema = z
        .object({
          id: z.union([z.string(), z.number()]).optional(),
          hotelId: z.union([z.string(), z.number()]).optional(),
        })
        .passthrough();

      const parsedRequest = proposeHotelRequestSchema.safeParse(req.body ?? {});
      if (!parsedRequest.success) {
        return res
          .status(400)
          .json({ message: "Invalid hotel proposal request", errors: parsedRequest.error.issues });
      }

      const parsedData = parsedRequest.data as Record<string, unknown>;
      const rawHotelId = parsedData.hotelId ?? parsedData.id;
      hotelId =
        typeof rawHotelId === 'number'
          ? rawHotelId
          : rawHotelId != null
            ? Number.parseInt(String(rawHotelId), 10)
            : NaN;

      const { hotelId: _ignoredHotelId, id: _ignoredId, ...rest } = parsedData;
      const { tripId: rawTripId, ...hotelDetails } = rest as {
        tripId?: number | string;
        [key: string]: unknown;
      };

      const hasAdditionalHotelDetails = Object.keys(hotelDetails).length > 0;
      const requiresHotelDetails =
        !Number.isFinite(hotelId) || hasAdditionalHotelDetails || rawTripId !== undefined;

      if (requiresHotelDetails) {
        const normalizedTripIdFromPayload =
          typeof rawTripId === 'number'
            ? rawTripId
            : typeof rawTripId === 'string'
              ? Number.parseInt(rawTripId, 10)
              : undefined;

        if (
          normalizedTripIdFromPayload !== undefined &&
          !Number.isFinite(normalizedTripIdFromPayload)
        ) {
          return res
            .status(400)
            .json({ message: "Trip ID mismatch between path and payload" });
        }

        const parseResult = insertHotelSchema.safeParse({
          ...(hotelDetails as Record<string, unknown>),
          tripId: normalizedTripIdFromPayload ?? tripId,
        });

        if (!parseResult.success) {
          hotelPayloadIssues = parseResult.error.issues;
        } else {
          parsedHotelPayload = { ...parseResult.data, tripId };
        }
      }

      if (!Number.isFinite(hotelId)) {
        const membershipResult = await ensureTripMembershipForAdHocProposal();
        if (!membershipResult.allowed) {
          return res.status(membershipResult.status).json({ message: membershipResult.message });
        }

        if (parsedHotelPayload) {
          try {
            const createdHotel = await storage.createHotel(parsedHotelPayload, userId);
            hotelId = createdHotel.id;
          } catch (creationError: unknown) {
            console.error("Error creating hotel before proposing:", creationError);
            return res.status(500).json({ message: "Failed to prepare hotel for proposal" });
          }
        } else {
          const normalizedPrice =
            parsePriceFromInput(parsedData.price) ??
            parsePriceFromInput(parsedData.pricePerNight) ??
            '0';
          const normalizedPricePerNight =
            parsePriceFromInput(parsedData.pricePerNight) ?? normalizedPrice;

          const fallbackProposalInput = {
            tripId,
            hotelName:
              typeof parsedData.hotelName === 'string' && parsedData.hotelName.trim().length > 0
                ? parsedData.hotelName
                : 'Unknown Hotel',
            location:
              typeof parsedData.location === 'string' && parsedData.location.trim().length > 0
                ? parsedData.location
                : 'Unknown Location',
            price: normalizedPrice,
            pricePerNight: normalizedPricePerNight,
            rating:
              parsedData.rating == null ||
              (typeof parsedData.rating !== 'string' && typeof parsedData.rating !== 'number')
                ? null
                : (parsedData.rating as string | number),
            amenities:
              typeof parsedData.amenities === 'string' && parsedData.amenities.trim().length > 0
                ? (parsedData.amenities as string)
                : null,
            platform:
              typeof parsedData.platform === 'string' && parsedData.platform.trim().length > 0
                ? (parsedData.platform as string)
                : 'Amadeus',
            bookingUrl:
              typeof parsedData.bookingUrl === 'string' && parsedData.bookingUrl.trim().length > 0
                ? (parsedData.bookingUrl as string)
                : '',
            status:
              typeof parsedData.status === 'string' && parsedData.status.trim().length > 0
                ? (parsedData.status as string)
                : 'proposed',
          };

          const fallbackSchema = insertHotelProposalSchema.extend({
            bookingUrl: z.string(),
          });
          const fallbackParseResult = fallbackSchema.safeParse(fallbackProposalInput);
          if (!fallbackParseResult.success) {
            return res.status(400).json({
              message:
                "Provide either an existing hotelId or the required hotel details to share with the group.",
              errors: hotelPayloadIssues ?? fallbackParseResult.error.issues,
            });
          }

          const proposal = await storage.createHotelProposal(fallbackParseResult.data, userId);
          res.status(201).json(proposal);

          broadcastToTrip(tripId, {
            type: "hotel_proposal_created",
            tripId,
            proposalId: proposal.id,
            stayId: proposal.stayId ?? null,
            triggeredBy: userId,
          });
          return;
        }
      }

      if (!Number.isFinite(hotelId)) {
        return res.status(400).json({
          message:
            "Provide either an existing hotelId or the required hotel details to share with the group.",
          errors: hotelPayloadIssues ?? [],
        });
      }

      const result = await storage.ensureHotelProposalForSavedHotel({
        hotelId,
        tripId,
        currentUserId: userId,
        overrideDetails: parsedHotelPayload ?? undefined,
      });

      const statusCode = result.wasCreated ? 201 : 200;

      res.status(statusCode).json(result.proposal);

      broadcastToTrip(tripId, {
        type: result.wasCreated ? "hotel_proposal_created" : "hotel_proposal_updated",
        tripId,
        proposalId: result.proposal.id,
        stayId: result.stayId,
        triggeredBy: userId,
      });
    } catch (error: unknown) {
      console.error("Error proposing hotel to group:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid hotel proposal request", errors: error.issues });
      }
      if (error instanceof Error) {
        if (error.message.includes('Hotel not found')) {
          return res.status(404).json({ message: error.message });
        }
        if (error.message.includes('does not belong to this trip')) {
          return res.status(400).json({ message: error.message });
        }
        if (error.message.includes('Only the stay creator') || error.message.includes('must be a member of this trip')) {
          return res.status(403).json({ message: error.message });
        }
        if (error.message.includes('Saved stay is missing required details')) {
          return res.status(400).json({ message: error.message });
        }
      }

      if (isPostgresConstraintViolation(error)) {
        // In some edge cases a proposal already exists for the stay and the insert/update triggers
        // a database constraint. Surface the existing proposal instead of forcing the user to retry.
        if (!Number.isFinite(tripId) || !userId) {
          return res.status(400).json({
            message: "Unable to share this stay with your group. Refresh the trip and try again.",
          });
        }

        try {
          const normalizeId = (value: unknown): number | null => {
            const parsed = Number.parseInt(String(value ?? ''), 10);
            return Number.isFinite(parsed) ? parsed : null;
          };

          const proposals = await storage.getTripHotelProposals(tripId, userId);
          const targetStayId =
            normalizeId(hotelId) ?? normalizeId(extractStayIdFromConstraintDetail((error as PostgresError).detail));

          if (!Number.isFinite(targetStayId)) {
            return res.status(400).json({
              message: "Unable to share this stay with your group. Refresh the trip and try again.",
            });
          }

          const matching = proposals.find((proposal) => normalizeId(proposal.stayId) === targetStayId);

          if (matching) {
            return res.status(200).json(matching);
          }

          const stayScopedProposals = await storage.getHotelProposalsByStayId(
            targetStayId,
            userId,
          );
          const stayMatch = stayScopedProposals.find(
            (proposal) => normalizeId(proposal.stayId) === targetStayId && proposal.tripId === tripId,
          );

          if (stayMatch) {
            return res.status(200).json(stayMatch);
          }

          try {
            const recoveryResult = await storage.ensureHotelProposalForSavedHotel({
              hotelId: targetStayId,
              tripId,
              currentUserId: userId,
              overrideDetails: parsedHotelPayload ?? undefined,
            });

            return res.status(200).json(recoveryResult.proposal);
          } catch (recoveryError) {
            console.error("Error resyncing hotel proposal after constraint violation:", recoveryError);
          }
        } catch (recoveryError) {
          console.error("Error recovering hotel proposal after constraint violation:", recoveryError);
        }

        return res.status(400).json({
          message: "Unable to share this stay with your group. Refresh the trip and try again.",
        });
      }

      res.status(500).json({ message: "Failed to propose hotel" });
    }
  };

  app.get('/api/trips/:tripId/proposals/hotels', isAuthenticated, handleGetTripHotelProposals);
  app.get('/api/trips/:id/hotel-proposals', isAuthenticated, handleGetTripHotelProposals);

  app.post('/api/trips/:tripId/proposals/hotels', isAuthenticated, handlePostTripHotelProposals);
  app.post('/api/trips/:id/hotel-proposals', isAuthenticated, handlePostTripHotelProposals);

  app.get(
    '/api/trips/:tripId/proposals/restaurants',
    isAuthenticated,
    (req: any, res) => {
      const tripId = Number.parseInt(req.params.tripId, 10);
      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      res.json([]);
    },
  );

  app.get(
    '/api/trips/:tripId/proposals/activities',
    isAuthenticated,
    async (req: any, res) => {
      try {
        const tripId = Number.parseInt(req.params.tripId, 10);
        if (Number.isNaN(tripId)) {
          return res.status(400).json({ message: "Invalid trip id" });
        }

        let userId = getRequestUserId(req);

        if (process.env.NODE_ENV === 'development' && !req.isAuthenticated?.()) {
          userId = 'demo-user';
        }

        if (!userId) {
          return res.status(401).json({ message: "User ID not found" });
        }

        const trip = await storage.getTripById(tripId);
        if (!trip) {
          return res.status(404).json({ message: "Trip not found" });
        }

        const isMember = trip.members.some((member) => member.userId === userId);
        if (!isMember) {
          return res.status(403).json({ message: "You are no longer a member of this trip" });
        }

        const combinedActivities = (await storage.getTripActivities(tripId, userId))
          .filter((activity) => {
            const status = (activity.status ?? "").toString().trim().toLowerCase();
            return status !== "canceled" && status !== "cancelled";
          })
          .sort((a, b) => {
            const toTimestamp = (value: unknown): number => {
              if (!value) return Number.POSITIVE_INFINITY;
              const date = new Date(value as string);
              return Number.isNaN(date.getTime()) ? Number.POSITIVE_INFINITY : date.getTime();
            };

            const aTime = toTimestamp(a.startTime);
            const bTime = toTimestamp(b.startTime);

            if (aTime !== bTime) {
              return aTime - bTime;
            }

            return a.id - b.id;
          });

        const mineOnly = parseBooleanQueryParam(req.query?.mineOnly);

        if (mineOnly) {
          const filtered = combinedActivities.filter((activity) => {
            const proposerId = activity.postedBy ?? activity.poster?.id ?? null;
            return proposerId === userId;
          });
          res.json(filtered);
          return;
        }

        res.json(combinedActivities);
      } catch (error: unknown) {
        console.error('Error fetching activity proposals:', error);
        res.status(500).json({ message: 'Failed to fetch activity proposals' });
      }
    },
  );

  // Hotel proposals and ranking routes
  app.post('/api/hotel-proposals/:id/rank', isAuthenticated, async (req: any, res) => {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proposalId)) {
        return res.status(400).json({ message: "Invalid proposal id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const rankingValue = Number.parseInt(req.body.ranking, 10);
      if (Number.isNaN(rankingValue)) {
        return res.status(400).json({ message: "Ranking must be a number" });
      }

      const validatedData = insertHotelRankingSchema.parse({
        proposalId,
        ranking: rankingValue,
        notes: req.body.notes ?? null,
      });

      const { tripId: proposalTripId, affectedProposalIds } = await storage.rankHotelProposal(
        validatedData,
        userId,
      );
      res.json({ success: true });

      for (const proposalId of affectedProposalIds) {
        broadcastToTrip(proposalTripId, {
          type: "hotel_proposal_ranked",
          tripId: proposalTripId,
          proposalId,
          triggeredBy: userId,
        });
      }
    } catch (error: unknown) {
      console.error("Error ranking hotel proposal:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid ranking data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to rank hotel proposal" });
      }
    }
  });

  app.post('/api/hotel-proposals/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proposalId)) {
        return res.status(400).json({ message: "Invalid proposal id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const proposal = await storage.cancelHotelProposal(proposalId, userId);
      res.json(proposal);

      broadcastToTrip(proposal.tripId, {
        type: "hotel_proposal_canceled",
        tripId: proposal.tripId,
        proposalId: proposal.id,
        stayId: proposal.stayId ?? null,
        triggeredBy: userId,
      });
    } catch (error: unknown) {
      console.error("Error canceling hotel proposal:", error);
      if (error instanceof Error) {
        if (error.message.includes('only cancel proposals you created')) {
          return res.status(403).json({ message: error.message });
        }
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
      }

      res.status(500).json({ message: "Failed to cancel hotel proposal" });
    }
  });

  // Flight proposal routes
  app.get('/api/trips/:id/flight-proposals', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const proposals = await storage.getTripFlightProposals(tripId, userId);
      res.json(proposals);
    } catch (error: unknown) {
      console.error("Error fetching flight proposals:", error);
      res.status(500).json({ message: "Failed to fetch flight proposals" });
    }
  });

  app.post('/api/trips/:id/flight-proposals', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const proposalData = {
        tripId,
        airline: req.body.airline || 'Unknown Airline',
        flightNumber: req.body.flightNumber || 'Unknown',
        departureAirport: req.body.departureAirport || 'ATL',
        departureTime: req.body.departureTime || new Date().toISOString(),
        arrivalAirport: req.body.arrivalAirport || 'CLT',
        arrivalTime: req.body.arrivalTime || new Date().toISOString(),
        duration: req.body.duration || '2h 0m',
        stops: Number.isFinite(Number(req.body.stops)) ? Number(req.body.stops) : 0,
        aircraft: req.body.aircraft || null,
        price: typeof req.body.price === 'number' ? req.body.price.toFixed(2) : (req.body.price?.toString() || '0'),
        currency: req.body.currency || 'USD',
        bookingUrl: req.body.bookingUrl || 'https://example.com',
        platform: req.body.platform || 'Amadeus',
        status: 'active',
        departureTerminal: req.body.departureTerminal || null,
        arrivalTerminal: req.body.arrivalTerminal || null,
      };

      const proposal = await storage.createFlightProposal(proposalData, userId);
      res.status(201).json(proposal);

      broadcastToTrip(tripId, {
        type: "flight_proposal_created",
        tripId,
        proposalId: proposal.id,
        flightId: proposal.flightId ?? null,
        triggeredBy: userId,
      });
    } catch (error: unknown) {
      console.error("Error creating flight proposal:", error);
      res.status(500).json({ message: "Failed to create flight proposal" });
    }
  });

  app.post('/api/flight-proposals/:id/rank', isAuthenticated, async (req: any, res) => {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proposalId)) {
        return res.status(400).json({ message: "Invalid proposal id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const rankingValue = Number.parseInt(req.body.ranking, 10);
      if (Number.isNaN(rankingValue)) {
        return res.status(400).json({ message: "Ranking must be a number" });
      }

      const validatedData = insertFlightRankingSchema.parse({
        proposalId,
        ranking: rankingValue,
        notes: req.body.notes ?? null,
      });

      const { tripId: proposalTripId, affectedProposalIds } = await storage.rankFlightProposal(
        validatedData,
        userId,
      );
      res.json({ success: true });

      for (const proposalId of affectedProposalIds) {
        broadcastToTrip(proposalTripId, {
          type: "flight_proposal_ranked",
          tripId: proposalTripId,
          proposalId,
          triggeredBy: userId,
        });
      }
    } catch (error: unknown) {
      console.error("Error ranking flight proposal:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid ranking data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to rank flight proposal" });
      }
    }
  });

  app.post('/api/flight-proposals/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proposalId)) {
        return res.status(400).json({ message: "Invalid proposal id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const proposal = await storage.cancelFlightProposal(proposalId, userId);
      res.json(proposal);

      broadcastToTrip(proposal.tripId, {
        type: "flight_proposal_canceled",
        tripId: proposal.tripId,
        proposalId: proposal.id,
        flightId: proposal.flightId ?? null,
        triggeredBy: userId,
      });
    } catch (error: unknown) {
      console.error("Error canceling flight proposal:", error);
      if (error instanceof Error) {
        if (error.message.includes('only cancel proposals you created')) {
          return res.status(403).json({ message: error.message });
        }
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
      }

      res.status(500).json({ message: "Failed to cancel flight proposal" });
    }
  });

  // Restaurant proposal routes
  app.get('/api/trips/:id/restaurant-proposals', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip id" });
      }

      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const proposals = await storage.getTripRestaurantProposals(tripId, userId);
      res.json(proposals);
    } catch (error: unknown) {
      console.error("Error fetching restaurant proposals:", error);
      res.status(500).json({ message: "Failed to fetch restaurant proposals" });
    }
  });

  app.post('/api/trips/:id/restaurant-proposals', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip id" });
      }

      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      // Use Zod validation for server-side safety
      const validatedData = insertRestaurantProposalSchema.parse({
        tripId,
        restaurantName: req.body.restaurantName || req.body.name || 'Unknown Restaurant',
        address: req.body.address || 'Unknown Address', 
        cuisineType: req.body.cuisineType || req.body.cuisine,
        priceRange: req.body.priceRange || '$$',
        rating: req.body.rating,
        phoneNumber: req.body.phoneNumber || req.body.phone,
        website: req.body.website,
        reservationUrl: req.body.reservationUrl,
        platform: req.body.platform || 'Foursquare',
        atmosphere: req.body.atmosphere,
        specialties: req.body.specialties,
        dietaryOptions: req.body.dietaryOptions || [],
        preferredMealTime: req.body.preferredMealTime || 'dinner',
        preferredDates: req.body.preferredDates || [],
        features: req.body.features || [],
        status: 'active'
      });
      
      const proposal = await storage.createRestaurantProposal(validatedData, userId);
      res.json(proposal);
    } catch (error: unknown) {
      console.error("Error creating restaurant proposal:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid restaurant proposal data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to create restaurant proposal" });
      }
    }
  });

  app.post('/api/restaurant-proposals/:id/rank', isAuthenticated, async (req: any, res) => {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proposalId)) {
        return res.status(400).json({ message: "Invalid proposal id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const rankingValue = Number.parseInt(req.body.ranking, 10);
      if (Number.isNaN(rankingValue)) {
        return res.status(400).json({ message: "Ranking must be a number" });
      }

      const validatedData = insertRestaurantRankingSchema.parse({
        proposalId,
        ranking: rankingValue,
        notes: req.body.notes ?? null,
      });

      await storage.rankRestaurantProposal(validatedData, userId);

      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error ranking restaurant proposal:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid ranking data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to rank restaurant proposal" });
      }
    }
  });

  app.post('/api/restaurant-proposals/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const proposalId = Number.parseInt(req.params.id, 10);
      if (Number.isNaN(proposalId)) {
        return res.status(400).json({ message: "Invalid proposal id" });
      }

      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const proposal = await storage.cancelRestaurantProposal(proposalId, userId);
      res.json(proposal);
    } catch (error: unknown) {
      console.error("Error canceling restaurant proposal:", error);
      if (error instanceof Error) {
        if (error.message.includes('only cancel proposals you created')) {
          return res.status(403).json({ message: error.message });
        }
        if (error.message.includes('not found')) {
          return res.status(404).json({ message: error.message });
        }
      }

      res.status(500).json({ message: "Failed to cancel restaurant proposal" });
    }
  });

  // Flight booking routes
  app.get('/api/trips/:id/flights', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      
      const flights = await storage.getTripFlights(tripId);
      res.json(flights);
    } catch (error: unknown) {
      console.error("Error fetching flights:", error);
      res.status(500).json({ message: "Failed to fetch flights" });
    }
  });

  app.post('/api/trips/:id/flights', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const validatedData = insertFlightSchema.parse({
        ...req.body,
        tripId,
        bookedBy: userId
      });

      const flight = await storage.addFlight(validatedData, userId);
      res.json(flight);
    } catch (error: unknown) {
      console.error("Error adding flight:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid flight data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to add flight" });
      }
    }
  });

  app.put('/api/flights/:id', isAuthenticated, async (req: any, res) => {
    const flightId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(flightId)) {
      return res.status(400).json({ error: "Invalid flight id" });
    }

    const userId = getRequestUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "User ID not found" });
    }

    try {
      await storage.updateFlight(flightId, req.body ?? {}, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error updating flight:", error);
      if (error instanceof Error) {
        if (error.message.includes('Flight not found')) {
          return res.status(404).json({ error: "Flight not found", message: "Flight not found" });
        }

        if (error.message.includes('Only the creator')) {
          return res.status(403).json({ error: error.message, message: error.message });
        }
      }

      res.status(500).json({ error: "Failed to update flight" });
    }
  });

  app.delete('/api/flights/:id', isAuthenticated, async (req: any, res) => {
    const flightId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(flightId)) {
      return res.status(400).json({ error: "Invalid flight id" });
    }

    const userId = getRequestUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "User ID not found" });
    }

    try {
      const result = await storage.deleteFlight(flightId, userId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      console.error("Error deleting flight:", error);
      if (error instanceof Error) {
        if (error.message.includes('Flight not found')) {
          return res.status(404).json({ error: "Flight not found", message: "Flight not found" });
        }

        if (error.message.includes('Only the creator')) {
          return res.status(403).json({ error: error.message, message: error.message });
        }
      }

      res.status(500).json({ error: "Failed to delete flight" });
    }
  });

  // Hotel booking routes  
  const HOTEL_REQUEST_FIELD_MAP: Record<string, string> = {
    tripId: "trip_id",
    hotelName: "hotel_name",
    hotelChain: "hotel_chain",
    hotelRating: "hotel_rating",
    address: "address",
    city: "city",
    country: "country",
    zipCode: "zip_code",
    latitude: "latitude",
    longitude: "longitude",
    checkInDate: "check_in_date",
    checkOutDate: "check_out_date",
    roomType: "room_type",
    roomCount: "room_count",
    guestCount: "guest_count",
    bookingReference: "booking_reference",
    totalPrice: "total_price",
    pricePerNight: "price_per_night",
    currency: "currency",
    status: "status",
    bookingSource: "booking_source",
    purchaseUrl: "purchase_url",
    amenities: "amenities",
    images: "images",
    policies: "policies",
    contactInfo: "contact_info",
    bookingPlatform: "booking_platform",
    bookingUrl: "booking_url",
    cancellationPolicy: "cancellation_policy",
    notes: "notes",
  };

  const REQUIRED_HOTEL_FIELDS = [
    "hotel_name",
    "address",
    "city",
    "country",
    "check_in_date",
    "check_out_date",
  ];

  const normalizeHotelRequestBody = (
    body: Record<string, unknown> | undefined,
    tripId: number,
  ): Record<string, unknown> => {
    const source = body ?? {};
    const normalized: Record<string, unknown> = { trip_id: tripId };

    for (const [camelKey, snakeKey] of Object.entries(HOTEL_REQUEST_FIELD_MAP)) {
      if (snakeKey === "trip_id") {
        normalized[snakeKey] = tripId;
        continue;
      }

      if (Object.prototype.hasOwnProperty.call(source, snakeKey)) {
        normalized[snakeKey] = (source as Record<string, unknown>)[snakeKey];
      } else if (Object.prototype.hasOwnProperty.call(source, camelKey)) {
        normalized[snakeKey] = (source as Record<string, unknown>)[camelKey];
      }
    }

    return normalized;
  };

  const convertNormalizedHotelToCamel = (
    normalized: Record<string, unknown>,
  ): Record<string, unknown> => {
    const camelCaseData: Record<string, unknown> = {};

    for (const [camelKey, snakeKey] of Object.entries(HOTEL_REQUEST_FIELD_MAP)) {
      if (!Object.prototype.hasOwnProperty.call(normalized, snakeKey)) {
        continue;
      }

      camelCaseData[camelKey] = normalized[snakeKey];
    }

    return camelCaseData;
  };

  app.get('/api/trips/:id/hotels', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      
      const hotels = await storage.getTripHotels(tripId);
      res.json(hotels);
    } catch (error: unknown) {
      console.error("Error fetching hotels:", error);
      res.status(500).json({ message: "Failed to fetch hotels" });
    }
  });

  app.post('/api/trips/:id/hotels', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const normalizedHotelData = normalizeHotelRequestBody(req.body, tripId);

      const missingRequiredFields = REQUIRED_HOTEL_FIELDS.filter((field) => {
        if (!Object.prototype.hasOwnProperty.call(normalizedHotelData, field)) {
          return true;
        }

        const value = normalizedHotelData[field];
        if (value === null || value === undefined) {
          return true;
        }

        if (typeof value === "string" && value.trim().length === 0) {
          return true;
        }

        return false;
      });

      if (missingRequiredFields.length > 0) {
        return res.status(400).json({
          message: "Missing required hotel fields",
          missingFields: missingRequiredFields,
        });
      }

      const camelCaseHotelData = convertNormalizedHotelToCamel(normalizedHotelData);

      const validatedData = insertHotelSchema.parse({
        ...camelCaseHotelData,
        tripId,
      });

      const normalizedValidatedHotelData = normalizeHotelRequestBody(
        validatedData,
        tripId,
      );

      const hotelInsertData: Record<string, unknown> = {
        ...normalizedValidatedHotelData,
      };

      for (const key of Object.keys(hotelInsertData)) {
        if (hotelInsertData[key] === undefined) {
          hotelInsertData[key] = null;
        }
      }

      const hotel = await storage.addHotel(hotelInsertData, userId);
      res.json(hotel);
    } catch (error: unknown) {
      console.error("Error adding hotel:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid hotel data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to add hotel" });
      }
    }
  });

  app.put('/api/hotels/:id', isAuthenticated, async (req: any, res) => {
    const hotelId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(hotelId)) {
      return res.status(400).json({ error: "Invalid hotel id" });
    }

    const userId = getRequestUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "User ID not found" });
    }

    try {
      await storage.updateHotel(hotelId, req.body ?? {}, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error updating hotel:", error);
      if (error instanceof Error) {
        if (error.message.includes('Hotel not found')) {
          return res.status(404).json({ error: "Hotel not found" });
        }

        if (error.message.includes('Only the creator')) {
          return res.status(403).json({ error: error.message });
        }
      }

      res.status(500).json({ error: "Failed to update hotel" });
    }
  });

  app.delete('/api/hotels/:id', isAuthenticated, async (req: any, res) => {
    const hotelId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(hotelId)) {
      return res.status(400).json({ error: "Invalid hotel id" });
    }

    const userId = getRequestUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "User ID not found" });
    }

    try {
      await storage.deleteHotel(hotelId, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error deleting hotel:", error);
      if (error instanceof Error) {
        if (error.message.includes('Hotel not found')) {
          return res.status(404).json({ error: "Hotel not found" });
        }

        if (error.message.includes('Only the creator')) {
          return res.status(403).json({ error: error.message });
        }
      }

      res.status(500).json({ error: "Failed to delete hotel" });
    }
  });

  // Currency conversion routes
  app.get('/api/currencies', async (req, res) => {
    try {
      const { POPULAR_CURRENCIES } = await import('./currencyService');
      res.json(POPULAR_CURRENCIES);
    } catch (error: unknown) {
      console.error("Error fetching currencies:", error);
      res.status(500).json({ message: "Failed to fetch currencies" });
    }
  });

  app.get('/api/exchange-rates', async (req, res) => {
    try {
      const { getAllExchangeRates } = await import('./currencyService');
      const rates = await getAllExchangeRates();
      res.json(rates);
    } catch (error: unknown) {
      console.error("Error fetching exchange rates:", error);
      res.status(500).json({ message: "Failed to fetch exchange rates" });
    }
  });

  app.post('/api/convert-currency', async (req, res) => {
    try {
      const { amount, fromCurrency, toCurrency } = req.body;
      
      if (!amount || !fromCurrency || !toCurrency) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const { convertCurrency } = await import('./currencyService');
      const conversion = await convertCurrency(
        parseFloat(amount),
        fromCurrency,
        toCurrency
      );
      
      res.json(conversion);
    } catch (error: unknown) {
      console.error("Error converting currency:", error);
      res.status(500).json({ message: "Failed to convert currency", error: getErrorMessage(error) });
    }
  });

  app.get('/api/trip/:tripId/suggested-currency', async (req, res) => {
    try {
      const tripId = parseInt(req.params.tripId);
      const trip = await storage.getTripById(tripId);
      
      if (!trip) {
        return res.status(404).json({ message: "Trip not found" });
      }

      const { detectCurrencyByLocation } = await import('./currencyService');
      const suggestedCurrency = detectCurrencyByLocation(trip.destination);
      
      res.json({ currency: suggestedCurrency });
    } catch (error: unknown) {
      console.error("Error detecting currency:", error);
      res.status(500).json({ message: "Failed to detect currency" });
    }
  });

  // Weather routes
  app.get('/api/weather', async (req, res) => {
    try {
      const validationResult = weatherSearchSchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid weather search parameters", 
          errors: validationResult.error.errors 
        });
      }

      const { location, units = 'C', startDate, endDate } = validationResult.data;
      const weatherData = await getFullWeatherData(location, startDate, endDate);
      
      // Convert temperatures based on requested units (single conversion)
      const convertedData = {
        current: {
          ...weatherData.current,
          temperature: units === 'F' ? Math.round((weatherData.current.temperature * 9/5) + 32) : weatherData.current.temperature,
          feelsLike: units === 'F' ? Math.round((weatherData.current.feelsLike * 9/5) + 32) : weatherData.current.feelsLike
        },
        forecast: weatherData.forecast.map(day => ({
          ...day,
          temperature: {
            min: units === 'F' ? Math.round((day.temperature.min * 9/5) + 32) : day.temperature.min,
            max: units === 'F' ? Math.round((day.temperature.max * 9/5) + 32) : day.temperature.max,
            day: units === 'F' ? Math.round((day.temperature.day * 9/5) + 32) : day.temperature.day,
            night: units === 'F' ? Math.round((day.temperature.night * 9/5) + 32) : day.temperature.night,
          }
        }))
      };

      res.json({
        ...convertedData,
        units,
        advice: getWeatherAdvice(weatherData.current) // Use original Celsius data for advice
      });
    } catch (error: unknown) {
      console.error("Error fetching weather:", error);
      res.status(500).json({
        message: "Failed to fetch weather data",
        error: getErrorMessage(error)
      });
    }
  });

  app.get('/api/weather/current', async (req, res) => {
    try {
      const validationResult = weatherSearchSchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid weather search parameters", 
          errors: validationResult.error.errors 
        });
      }

      const { location, units = 'C', startDate, endDate } = validationResult.data;
      const currentWeather = await getCurrentWeather(location);
      
      // Convert temperatures based on requested units (single conversion)
      const convertedWeather = {
        ...currentWeather,
        temperature: units === 'F' ? Math.round((currentWeather.temperature * 9/5) + 32) : currentWeather.temperature,
        feelsLike: units === 'F' ? Math.round((currentWeather.feelsLike * 9/5) + 32) : currentWeather.feelsLike
      };
      
      res.json({
        ...convertedWeather,
        units,
        advice: getWeatherAdvice(currentWeather), // Use original Celsius data for advice
        temperatureFormatted: `${convertedWeather.temperature}°${units}`,
        feelsLikeFormatted: `${convertedWeather.feelsLike}°${units}`
      });
    } catch (error: unknown) {
      console.error("Error fetching current weather:", error);
      res.status(500).json({
        message: "Failed to fetch current weather",
        error: getErrorMessage(error)
      });
    }
  });

  app.get('/api/weather/forecast', async (req, res) => {
    try {
      const validationResult = weatherSearchSchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid weather search parameters", 
          errors: validationResult.error.errors 
        });
      }

      const { location, units = 'C' } = validationResult.data;
      const forecast = await getWeatherForecast(location);
      
      res.json({
        location,
        units,
        forecast: forecast.map(day => {
          // Convert temperatures based on requested units (single conversion)
          const convertedTemps = {
            min: units === 'F' ? Math.round((day.temperature.min * 9/5) + 32) : day.temperature.min,
            max: units === 'F' ? Math.round((day.temperature.max * 9/5) + 32) : day.temperature.max,
            day: units === 'F' ? Math.round((day.temperature.day * 9/5) + 32) : day.temperature.day,
            night: units === 'F' ? Math.round((day.temperature.night * 9/5) + 32) : day.temperature.night,
          };
          
          return {
            ...day,
            temperature: convertedTemps,
            temperatureFormatted: {
              min: `${convertedTemps.min}°${units}`,
              max: `${convertedTemps.max}°${units}`,
              day: `${convertedTemps.day}°${units}`,
              night: `${convertedTemps.night}°${units}`,
            }
          };
        })
      });
    } catch (error: unknown) {
      console.error("Error fetching weather forecast:", error);
      res.status(500).json({
        message: "Failed to fetch weather forecast",
        error: getErrorMessage(error)
      });
    }
  });

  // Notification routes with proper authentication and validation
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error: unknown) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const count = await storage.getUnreadNotificationCount(userId);
      res.json({ count });
    } catch (error: unknown) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      // Validate notification ID parameter
      let validatedParams;
      try {
        validatedParams = notificationIdSchema.parse(req.params);
      } catch (validationError: unknown) {
        return res.status(400).json({ 
          message: "Invalid notification ID",
          error: validationError instanceof Error ? validationError.message : "Unknown error"
        });
      }
      
      const notificationId = validatedParams.id;
      
      // Check if notification exists and belongs to user before marking as read
      const userNotifications = await storage.getUserNotifications(userId);
      const notification = userNotifications.find(n => n.id === notificationId);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      await storage.markNotificationAsRead(notificationId, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  const getShareCodeFromRequest = (req: any): string | null => {
    const rawHeader = req.headers?.["x-trip-share-code"];
    if (typeof rawHeader === "string") {
      const trimmed = rawHeader.trim();
      return trimmed.length > 0 ? trimmed.toUpperCase() : null;
    }

    if (Array.isArray(rawHeader)) {
      for (const value of rawHeader) {
        if (typeof value === "string" && value.trim().length > 0) {
          return value.trim().toUpperCase();
        }
      }
    }

    return null;
  };

  const ensureTripMembership = async (
    req: any,
    tripId: number,
    userId: string,
  ): Promise<{ isMember: boolean; message?: string }> => {
    const alreadyMember = await storage.isTripMember(tripId, userId);
    if (alreadyMember) {
      return { isMember: true };
    }

    const shareCode = getShareCodeFromRequest(req);
    if (!shareCode) {
      return { isMember: false };
    }

    try {
      const sharedTrip = await storage.getTripByShareCode(shareCode);
      if (!sharedTrip || sharedTrip.id !== tripId) {
        return {
          isMember: false,
          message: "This invite link doesn’t match the trip you’re trying to view.",
        };
      }

      await storage.joinTrip(shareCode, userId);
      return { isMember: true };
    } catch (error: unknown) {
      console.error("Failed to join trip via share code:", error);
      if (error instanceof Error) {
        if (error.message === "Trip not found") {
          return {
            isMember: false,
            message: "This invite link is no longer valid for the trip.",
          };
        }

        return { isMember: false, message: error.message };
      }

      return { isMember: false, message: "Failed to join trip" };
    }
  };

  // Wish List / Ideas board routes
  app.get("/api/trips/:tripId/wish-list", async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const tripId = parseInt(req.params.tripId, 10);

      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip ID" });
      }

      let isMember = false;
      let isAdmin = false;

      if (userId) {
        isMember = await storage.isTripMember(tripId, userId);
        if (isMember) {
          isAdmin = await storage.isTripAdmin(tripId, userId);
        }
      }

      const sortParam = typeof req.query.sort === "string" ? req.query.sort : undefined;
      const allowedSorts = new Set(["newest", "oldest", "most_saved"]);
      const sort = allowedSorts.has(sortParam ?? "")
        ? (sortParam as "newest" | "oldest" | "most_saved")
        : "newest";

      const tag =
        typeof req.query.tag === "string" && req.query.tag.trim() !== ""
          ? req.query.tag.trim()
          : null;
      const submittedBy =
        typeof req.query.submittedBy === "string" && req.query.submittedBy.trim() !== ""
          ? req.query.submittedBy.trim()
          : null;
      const search =
        typeof req.query.search === "string" && req.query.search.trim() !== ""
          ? req.query.search.trim()
          : null;

      const rawMinLikes = Array.isArray(req.query.minLikes)
        ? req.query.minLikes[0]
        : req.query.minLikes;
      const minLikes = (() => {
        if (typeof rawMinLikes !== "string") {
          return null;
        }
        const parsed = Number.parseInt(rawMinLikes, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      })();

      const ideas = await storage.getTripWishListIdeas(tripId, userId ?? null, {
        sort,
        tag,
        submittedBy,
        search,
        minLikes,
      });

      const enrichedIdeas = ideas.map((idea) => ({
        ...idea,
        canDelete: Boolean(userId && (isAdmin || idea.createdBy === userId)),
      }));

      const tagSet = new Set<string>();
      const submitterMap = new Map<string, { id: string; name: string }>();

      for (const idea of enrichedIdeas) {
        for (const ideaTag of idea.tags ?? []) {
          if (ideaTag) {
            tagSet.add(ideaTag);
          }
        }

        submitterMap.set(idea.creator.id, {
          id: idea.creator.id,
          name: getUserDisplayName(idea.creator),
        });
      }

      const availableTags = Array.from(tagSet).sort((a, b) => a.localeCompare(b));
      const submitters = Array.from(submitterMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name),
      );

      res.json({
        ideas: enrichedIdeas,
        meta: {
          availableTags,
          submitters,
          sort,
          isAdmin,
          isMember,
          minLikes,
        },
      });
    } catch (error: unknown) {
      console.error("Error fetching wish list ideas:", error);
      res.status(500).json({ message: "Failed to fetch wish list ideas" });
    }
  });

  app.post("/api/trips/:tripId/wish-list", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const tripId = parseInt(req.params.tripId, 10);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (userId === DEMO_USER_ID) {
        await ensureDemoUserExists();
      }

      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip ID" });
      }

      const membership = await ensureTripMembership(req, tripId, userId);
      if (!membership.isMember) {
        return res.status(403).json({ message: membership.message ?? "Access denied" });
      }

      const validatedData = insertWishListIdeaSchema.parse({
        ...req.body,
        tripId,
      });

      const created = await storage.createWishListIdea(validatedData, userId);
      let detailedIdea = await storage.getWishListIdeaForUser(created.id, userId);

      if (!detailedIdea) {
        const creator =
          (await storage.getUser(userId)) ?? createFallbackUserFromRequest(req, userId);

        detailedIdea = {
          ...created,
          creator,
          saveCount: 0,
          commentCount: 0,
          currentUserSaved: false,
        };
      }

      const isAdmin = await storage.isTripAdmin(tripId, userId);

      broadcastToTrip(tripId, {
        type: "wish_list_idea_created",
        tripId,
        ideaId: detailedIdea.id,
        triggeredBy: userId,
      });

      res.status(201).json({
        idea: {
          ...detailedIdea,
          canDelete: isAdmin || detailedIdea.createdBy === userId,
        },
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid idea data",
          errors: error.issues,
        });
      }

      console.error("Error creating wish list idea:", error);
      res.status(500).json({ message: "Failed to create wish list idea" });
    }
  });

  app.post("/api/wish-list/:ideaId/save", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const ideaId = parseInt(req.params.ideaId, 10);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (userId === DEMO_USER_ID) {
        await ensureDemoUserExists();
      }

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const membership = await ensureTripMembership(req, idea.tripId, userId);
      if (!membership.isMember) {
        return res.status(403).json({ message: membership.message ?? "Access denied" });
      }

      const result = await storage.toggleWishListSave(ideaId, userId);
      broadcastToTrip(idea.tripId, {
        type: "wish_list_idea_updated",
        tripId: idea.tripId,
        ideaId,
        triggeredBy: userId,
        reason: "save_toggled",
      });
      res.json(result);
    } catch (error: unknown) {
      console.error("Error toggling wish list save:", error);
      res.status(500).json({ message: "Failed to update save" });
    }
  });

  app.get("/api/wish-list/:ideaId/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const ideaId = parseInt(req.params.ideaId, 10);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (userId === DEMO_USER_ID) {
        await ensureDemoUserExists();
      }

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const membership = await ensureTripMembership(req, idea.tripId, userId);
      if (!membership.isMember) {
        return res.status(403).json({ message: membership.message ?? "Access denied" });
      }

      const comments = await storage.getWishListComments(ideaId);
      res.json(comments);
    } catch (error: unknown) {
      console.error("Error fetching wish list comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/wish-list/:ideaId/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const ideaId = parseInt(req.params.ideaId, 10);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (userId === DEMO_USER_ID) {
        await ensureDemoUserExists();
      }

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const membership = await ensureTripMembership(req, idea.tripId, userId);
      if (!membership.isMember) {
        return res.status(403).json({ message: membership.message ?? "Access denied" });
      }

      const { comment } = insertWishListCommentSchema.parse(req.body ?? {});

      const createdComment = await storage.addWishListComment(ideaId, userId, comment);
      const comments = await storage.getWishListComments(ideaId);

      res.status(201).json({
        comment: createdComment,
        commentCount: comments.length,
      });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid comment",
          errors: error.issues,
        });
      }

      console.error("Error adding wish list comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  app.delete("/api/wish-list/:ideaId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const ideaId = parseInt(req.params.ideaId, 10);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (userId === DEMO_USER_ID) {
        await ensureDemoUserExists();
      }

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const membership = await ensureTripMembership(req, idea.tripId, userId);
      if (!membership.isMember) {
        return res.status(403).json({ message: membership.message ?? "Access denied" });
      }

      const isAdmin = await storage.isTripAdmin(idea.tripId, userId);
      if (!isAdmin && idea.createdBy !== userId) {
        return res.status(403).json({ message: "Only the creator or a trip admin can delete this idea" });
      }

      await storage.deleteWishListIdea(ideaId);
      broadcastToTrip(idea.tripId, {
        type: "wish_list_idea_deleted",
        tripId: idea.tripId,
        ideaId,
        triggeredBy: userId,
      });
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error deleting wish list idea:", error);
      res.status(500).json({ message: "Failed to delete wish list idea" });
    }
  });

  app.post("/api/wish-list/:ideaId/promote", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const ideaId = parseInt(req.params.ideaId, 10);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (userId === DEMO_USER_ID) {
        await ensureDemoUserExists();
      }

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const membership = await ensureTripMembership(req, idea.tripId, userId);
      if (!membership.isMember) {
        return res.status(403).json({ message: membership.message ?? "Access denied" });
      }

      const draft = await storage.promoteWishListIdea(ideaId, userId);
      const detailedIdea = await storage.getWishListIdeaForUser(ideaId, userId);
      const isAdmin = await storage.isTripAdmin(idea.tripId, userId);

      res.json({
        draft,
        idea: detailedIdea
          ? { ...detailedIdea, canDelete: isAdmin || detailedIdea.createdBy === userId }
          : undefined,
      });
    } catch (error: unknown) {
      console.error("Error promoting wish list idea:", error);
      res.status(500).json({ message: "Failed to promote idea" });
    }
  });

  app.post("/api/wish-list/unfurl", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      const { url } = req.body ?? {};
      if (typeof url !== "string" || url.trim() === "") {
        return res.status(400).json({ message: "URL is required" });
      }

      const metadata = await unfurlLinkMetadata(url);
      res.json(metadata);
    } catch (error: unknown) {
      console.error("Error unfurling link:", error);
      res.status(400).json({ message: "Failed to fetch link metadata" });
    }
  });

  app.get("/api/trips/:tripId/proposal-drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getRequestUserId(req);
      const tripId = parseInt(req.params.tripId, 10);

      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }

      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip ID" });
      }

      const isMember = await storage.isTripMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "Access denied" });
      }

      const drafts = await storage.getTripProposalDrafts(tripId);
      res.json(drafts);
    } catch (error: unknown) {
      console.error("Error fetching proposal drafts:", error);
      res.status(500).json({ message: "Failed to fetch proposal drafts" });
    }
  });

  return httpServer;
}

