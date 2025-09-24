// @ts-nocheck
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./sessionAuth";
import { AuthService } from "./auth";
import { insertTripCalendarSchema, createActivityWithAttendeesSchema, insertActivityCommentSchema, insertPackingItemSchema, insertGroceryItemSchema, insertGroceryReceiptSchema, insertFlightSchema, insertHotelSchema, insertHotelProposalSchema, insertHotelRankingSchema, insertFlightProposalSchema, insertFlightRankingSchema, insertRestaurantProposalSchema, insertRestaurantRankingSchema, insertWishListIdeaSchema, insertWishListCommentSchema } from "@shared/schema";
import { z } from "zod";
import { unfurlLinkMetadata } from "./wishListService";

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
import { searchLocations, getAirportFromLocation, getAirportCodes } from "./locationDatabase";
import { getCurrentWeather, getWeatherForecast, getFullWeatherData, getWeatherAdvice, formatTemperature } from "./weatherService";

function getRequestUserId(req: any): string | undefined {
  if (req.session?.userId) {
    return req.session.userId;
  }

  if (req.user?.id) {
    return req.user.id;
  }

  return req.user?.claims?.sub;
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
  console.log("Setting up routes...");
  
  // Setup auth routes FIRST before any middleware
  setupAuth(app);
  
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
      const errorMessage = error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error";
      if (errorMessage.includes("Username is already taken") || 
          errorMessage.includes("Email is already registered")) {
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
      const errorMessage = error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error";
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
      console.log("Auth user endpoint called");
      
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

  // Simple test route to verify Express is working
  app.get("/api/test", (req, res) => {
    console.log("Test route called");
    res.json({ message: "API is working", timestamp: new Date().toISOString() });
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

  // Location search endpoint - uses Google Maps autocomplete with fallback
  app.get("/api/locations/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      
      // If query is too short, return empty results
      if (query.trim().length < 2) {
        return res.json([]);
      }
      
      console.log(`🔍 Location search for: "${query}"`);
      
      try {
        // Try Google Maps autocomplete first
        const googleResults = await googleMapsService.autocompleteLocation(query.trim());
        
        if (googleResults && googleResults.length > 0) {
          // Transform Google Maps results to SmartLocationSearch expected format
          const transformedResults = googleResults.map((location, index) => {
            // Better type detection based on Google Places types
            let locationType: 'airport' | 'city' | 'metro' | 'state' | 'country' = 'city';
            
            console.log(`🔍 Analyzing location types for "${location.name}":`, location.types);
            
            // More specific type detection for Google Places
            if (location.types?.includes('airport')) {
              locationType = 'airport';
            } else if (location.types?.includes('country')) {
              locationType = 'country';
            } else if (location.types?.includes('administrative_area_level_1')) {
              locationType = 'state';  
            } else if (location.types?.includes('locality') || location.types?.includes('postal_town')) {
              locationType = 'city';
            } else if (location.types?.includes('sublocality') || location.types?.includes('neighborhood')) {
              locationType = 'metro';
            } else if (location.types?.includes('administrative_area_level_2')) {
              locationType = 'city'; // Often represents cities/counties
            } else {
              // Default fallback based on display name analysis
              const displayLower = location.displayName.toLowerCase();
              if (displayLower.includes('airport') || displayLower.includes('international')) {
                locationType = 'airport';
              } else {
                locationType = 'city'; // Safe default
              }
            }
            
            // Better parsing of display name components
            const displayParts = location.displayName.split(',').map((part: string) => part.trim());
            const country = displayParts.length > 0 ? displayParts[displayParts.length - 1] : '';
            const state = displayParts.length > 2 ? displayParts[displayParts.length - 2] : '';
            
            return {
              id: index,
              name: location.name,
              displayName: location.displayName,
              type: locationType,
              code: location.place_id, // Use place_id as code for Google Places
              country: country,
              state: state,
              airports: [] // Will be populated for cities that have airports
            };
          });
          
          console.log(`✅ Google Maps found ${transformedResults.length} locations for "${query}"`);
          return res.json(transformedResults);
        }
      } catch (googleError) {
        console.error("Google Maps autocomplete failed, falling back to internal database:", googleError);
      }
      
      // Fallback to our internal location database
      const results = searchLocations(query.trim());
      
      // Transform to SmartLocationSearch expected format
      const transformedResults = results.map((location, index) => ({
        id: index,
        name: location.name,
        displayName: location.displayName,
        type: location.type,
        code: location.code,
        country: location.country,
        state: location.state,
        airports: location.airports || []
      }));
      
      console.log(`✅ Internal database found ${transformedResults.length} locations for "${query}"`);
      res.json(transformedResults);
    } catch (error: unknown) {
      console.error("Location search error:", error);
      res.status(500).json({ error: "Location search failed" });
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

      console.log("Creating trip with data:", req.body);
      
      // Parse and convert dates
      const sanitizedCoverImageUrl =
        typeof req.body.coverImageUrl === "string" && req.body.coverImageUrl.trim().length > 0
          ? req.body.coverImageUrl
          : null;

      const tripData = {
        ...req.body,
        coverImageUrl: sanitizedCoverImageUrl,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
      };

      console.log("Converted trip data:", tripData);
      
      const validatedData = insertTripCalendarSchema.parse(tripData);
      const trip = await storage.createTrip(validatedData, userId);

      res.json(trip);
    } catch (error: unknown) {
      console.error("Error creating trip:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid trip data", errors: error.errors });
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

  app.put("/api/trips/:id", async (req: any, res) => {
    try {
      let userId = getRequestUserId(req);
      
      // Development bypass - use demo user
      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
        console.log("Development mode: demo user updating trip");
        userId = 'demo-user';
      }
      
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const tripId = parseInt(req.params.id);
      if (!tripId || isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip ID" });
      }

      console.log("Updating trip with data:", req.body);
      
      // Parse and convert dates if provided
      const updateData: any = { ...req.body };
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }

      if (Object.prototype.hasOwnProperty.call(updateData, "coverImageUrl")) {
        const value = updateData.coverImageUrl;
        updateData.coverImageUrl =
          typeof value === "string" && value.trim().length > 0 ? value : null;
      }

      console.log("Converted trip update data:", updateData);
      
      // Validate only the fields that are being updated
      const updateSchema = insertTripCalendarSchema.partial();
      const validatedData = updateSchema.parse(updateData);
      
      const updatedTrip = await storage.updateTrip(tripId, validatedData, userId);

      res.json(updatedTrip);
    } catch (error: unknown) {
      console.error("Error updating trip:", error);
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({ message: "Invalid trip data", errors: error.errors });
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
      const { origin, destination, departureDate, returnDate, passengers, flightClass, airline, provider } = searchParams;
      
      console.log(`🔍 Flight Search Request:`);
      console.log(`  📍 Route: ${origin} → ${destination}`);
      console.log(`  📅 Departure: ${departureDate}${returnDate ? `, Return: ${returnDate}` : ''}`);
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
                  console.log(`  ❌ Amadeus ${originCode}→${destCode}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }
            }
            
            const mapped = amadeusResults.map(flight => mapToUnifiedFormat(flight, 'Amadeus'));
            allFlights.push(...mapped);
            console.log(`  ✅ Amadeus: ${mapped.length} flights`);
          } catch (error) {
            const msg = `Amadeus error: ${error instanceof Error ? error.message : 'Unknown'}`;
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
                  console.log(`  ❌ Duffel ${originCode}→${destCode}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
              }
            }
            
            const mapped = duffelResults.map(flight => mapToUnifiedFormat(flight, 'Duffel'));
            allFlights.push(...mapped);
            console.log(`  ✅ Duffel: ${mapped.length} flights`);
          } catch (error) {
            const msg = `Duffel error: ${error instanceof Error ? error.message : 'Unknown'}`;
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
      const { origin, destination, departureDate, returnDate, passengers, class: flightClass, airline, provider, page, limit, filter } = validatedData;

      // Get cached flight results
      const searchParams = { origin, destination, departureDate, returnDate, passengers, flightClass, airline, provider };
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
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
      const { query, type, limit = 10, useApi = false } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: "Query parameter is required" });
      }
      
      const results = await locationService.searchLocations(query, type, limit, useApi);
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
      if (!isMember) {
        return res.status(403).json({ message: "You are no longer a member of this trip" });
      }
      
      const activities = await storage.getTripActivities(tripId, userId);
      res.json(activities);
    } catch (error: unknown) {
      console.error("Error fetching activities:", error);
      res.status(500).json({ message: "Failed to fetch activities" });
    }
  });

  app.post('/api/trips/:id/activities', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip ID" });
      }

      let userId = getRequestUserId(req);

      if (process.env.NODE_ENV === 'development' && !req.isAuthenticated()) {
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

      const rawData = {
        ...req.body,
        tripCalendarId: tripId,
      };

      const validatedData = createActivityWithAttendeesSchema.parse(rawData);
      const { attendeeIds = [], ...activityData } = validatedData;

      const activity = await storage.createActivity(activityData, userId);

      const validMemberIds = new Set(trip.members.map((member) => member.userId));
      const uniqueAttendeeIds = Array.from(
        new Set(attendeeIds.filter((id) => typeof id === 'string' && validMemberIds.has(id))),
      );

      if (uniqueAttendeeIds.length > 0) {
        await Promise.all(uniqueAttendeeIds.map((attendeeId) => storage.acceptActivity(activity.id, attendeeId)));
      }

      const organizerMember = trip.members.find((member) => member.userId === userId);
      const organizerName =
        organizerMember?.user.firstName?.trim() ||
        organizerMember?.user.username ||
        organizerMember?.user.email ||
        'A trip member';

      const attendeesToNotify = uniqueAttendeeIds.filter((attendeeId) => attendeeId !== userId);

      if (attendeesToNotify.length > 0) {
        const eventDate = new Date(activity.startTime);
        const formattedDate = eventDate.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });

        await Promise.all(
          attendeesToNotify.map((attendeeId) =>
            storage
              .createNotification({
                userId: attendeeId,
                type: 'activity_attendance',
                title: `${organizerName} added you to ${activity.name}`,
                message: `You're marked as attending ${activity.name} on ${formattedDate}.`,
                tripId: tripId,
                activityId: activity.id,
              })
              .catch((notificationError) => {
                console.error('Failed to create activity notification:', notificationError);
              }),
          ),
        );
      }

      broadcastToTrip(tripId, {
        type: 'activity_created',
        activityId: activity.id,
      });

      const activities = await storage.getTripActivities(tripId, userId);
      const createdActivity = activities.find((item) => item.id === activity.id);

      res.json(createdActivity ?? activity);
    } catch (error: unknown) {
      console.error('Error creating activity:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: 'Invalid activity data', errors: error.errors });
      } else {
        res.status(500).json({ message: 'Failed to create activity' });
      }
    }
  });

  // WebSocket setup
  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const clients = new Map<WebSocket, { userId: string; tripId?: number }>();

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('WebSocket client connected');

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'join_trip') {
          clients.set(ws, { 
            userId: data.userId, 
            tripId: data.tripId 
          });
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

  function broadcastToTrip(tripId: number, message: any) {
    clients.forEach((clientInfo, ws) => {
      if (clientInfo.tripId === tripId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

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
        tripId: tripId
      });
      
      res.json({ success: true, message: "Trip deleted successfully" });
    } catch (error: unknown) {
      console.error("Error deleting trip:", error);
      if (error instanceof Error ? error.message : "Unknown error".includes("Only the trip creator")) {
        res.status(403).json({ message: error instanceof Error ? error.message : "Unknown error" });
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
        error: error instanceof Error ? error.message : "Unknown error" 
      });
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
      
      const packingItems = await storage.getTripPackingItems(tripId);
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
      
      await storage.togglePackingItem(itemId, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error toggling packing item:", error);
      res.status(500).json({ message: "Failed to toggle packing item" });
    }
  });

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

      const expenseData = {
        ...req.body,
        tripId,
        paidBy: userId
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

  // Hotel proposals and ranking routes (accessible for development)
  app.get('/api/trips/:id/hotel-proposals', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = "demo-user"; // Use demo user ID for development
      
      const proposals = await storage.getTripHotelProposals(tripId, userId);
      res.json(proposals);
    } catch (error: unknown) {
      console.error("Error fetching hotel proposals:", error);
      res.status(500).json({ message: "Failed to fetch hotel proposals" });
    }
  });

  app.post('/api/trips/:id/hotel-proposals', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = "demo-user"; // Use demo user ID for development
      
      // Create proposal data directly without schema validation to avoid proposedBy issue
      const proposalData = {
        tripId,
        proposedBy: userId,
        hotelName: req.body.hotelName || 'Unknown Hotel',
        location: req.body.location || 'Unknown Location',
        price: req.body.price?.toString() || '0',
        pricePerNight: req.body.pricePerNight?.toString() || req.body.price?.toString() || '0',
        rating: req.body.rating?.toString() || '4.0',
        amenities: req.body.amenities || 'WiFi, Restaurant, Room Service',
        platform: req.body.platform || 'Amadeus',
        bookingUrl: req.body.bookingUrl || '',
        status: 'active'
      };
      
      const proposal = await storage.createHotelProposal(proposalData, userId);
      res.json(proposal);
    } catch (error: unknown) {
      console.error("Error creating hotel proposal:", error);
      res.status(500).json({ message: "Failed to create hotel proposal" });
    }
  });

  app.post('/api/hotel-proposals/:id/rank', async (req: any, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const userId = "demo-user"; // Use demo user ID for development
      const { ranking } = req.body;
      
      const validatedData = insertHotelRankingSchema.parse({
        proposalId,
        userId,
        ranking: parseInt(ranking)
      });
      
      await storage.rankHotelProposal(validatedData, userId);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error ranking hotel proposal:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid ranking data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to rank hotel proposal" });
      }
    }
  });

  // Flight proposal routes (accessible for development)
  app.get('/api/trips/:id/flight-proposals', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = "demo-user"; // Use demo user ID for development
      
      const proposals = await storage.getTripFlightProposals(tripId, userId);
      res.json(proposals);
    } catch (error: unknown) {
      console.error("Error fetching flight proposals:", error);
      res.status(500).json({ message: "Failed to fetch flight proposals" });
    }
  });

  app.post('/api/trips/:id/flight-proposals', async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
      const userId = "demo-user"; // Use demo user ID for development
      
      // Create proposal data matching hotel proposal pattern
      const proposalData = {
        tripId,
        proposedBy: userId,
        airline: req.body.airline || 'Unknown Airline',
        flightNumber: req.body.flightNumber || 'Unknown',
        departureAirport: req.body.departureAirport || 'ATL',
        departureTime: req.body.departureTime || new Date().toISOString(),
        arrivalAirport: req.body.arrivalAirport || 'CLT',
        arrivalTime: req.body.arrivalTime || new Date().toISOString(),
        duration: req.body.duration || '2h 0m',
        stops: req.body.stops || 0,
        price: parseFloat(req.body.price) || 299,
        currency: req.body.currency || 'USD',
        bookingUrl: req.body.bookingUrl || 'https://example.com',
        platform: req.body.platform || 'Amadeus',
        status: 'active'
      };
      
      const proposal = await storage.createFlightProposal(proposalData, userId);
      res.json(proposal);
    } catch (error: unknown) {
      console.error("Error creating flight proposal:", error);
      res.status(500).json({ message: "Failed to create flight proposal" });
    }
  });

  app.post('/api/flight-proposals/:id/rank', async (req: any, res) => {
    try {
      const proposalId = parseInt(req.params.id);
      const userId = "demo-user"; // Use demo user ID for development
      const { ranking } = req.body;
      
      const validatedData = insertFlightRankingSchema.parse({
        proposalId,
        ranking: parseInt(ranking)
      });
      
      await storage.rankFlightProposal(validatedData, userId);
      await storage.updateFlightProposalAverageRanking(proposalId);
      
      res.json({ success: true });
    } catch (error: unknown) {
      console.error("Error ranking flight proposal:", error);
      if (error instanceof Error && 'name' in error && error.name === 'ZodError' && 'errors' in error) {
        res.status(400).json({ message: "Invalid ranking data", errors: (error as any).errors });
      } else {
        res.status(500).json({ message: "Failed to rank flight proposal" });
      }
    }
  });

  // Restaurant proposal routes
  app.get('/api/trips/:id/restaurant-proposals', isAuthenticated, async (req: any, res) => {
    try {
      const tripId = parseInt(req.params.id);
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
      const tripId = parseInt(req.params.id);
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
      const proposalId = parseInt(req.params.id);
      const userId = getRequestUserId(req);
      const { ranking, notes } = req.body;
      
      if (!userId) {
        return res.status(401).json({ message: "User ID not found" });
      }
      
      const validatedData = insertRestaurantRankingSchema.parse({
        proposalId,
        ranking: parseInt(ranking),
        notes
      });
      
      await storage.rankRestaurantProposal(validatedData, userId);
      await storage.updateRestaurantProposalAverageRanking(proposalId);
      
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

  // Hotel booking routes  
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
      
      const validatedData = insertHotelSchema.parse({
        ...req.body,
        tripId,
        bookedBy: userId
      });
      
      const hotel = await storage.addHotel(validatedData, userId);
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
      res.status(500).json({ message: "Failed to convert currency", error: error instanceof Error ? error.message : "Unknown error" });
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
        error: error instanceof Error ? error instanceof Error ? error.message : "Unknown error" : "Unknown error"
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
        error: error instanceof Error ? error.message : "Unknown error" 
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
        error: error instanceof Error ? error.message : "Unknown error" 
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

  // Wish List / Ideas board routes
  app.get("/api/trips/:tripId/wish-list", isAuthenticated, async (req: any, res) => {
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

      const isAdmin = await storage.isTripAdmin(tripId, userId);

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

      const ideas = await storage.getTripWishListIdeas(tripId, userId, {
        sort,
        tag,
        submittedBy,
        search,
      });

      const enrichedIdeas = ideas.map((idea) => ({
        ...idea,
        canDelete: isAdmin || idea.createdBy === userId,
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

      if (Number.isNaN(tripId)) {
        return res.status(400).json({ message: "Invalid trip ID" });
      }

      const isMember = await storage.isTripMember(tripId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "Access denied" });
      }

      const validatedData = insertWishListIdeaSchema.parse({
        ...req.body,
        tripId,
      });

      const created = await storage.createWishListIdea(validatedData, userId);
      const detailedIdea = await storage.getWishListIdeaForUser(created.id, userId);

      if (!detailedIdea) {
        throw new Error("Failed to load created wish list idea");
      }

      const isAdmin = await storage.isTripAdmin(tripId, userId);

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

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const isMember = await storage.isTripMember(idea.tripId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "Access denied" });
      }

      const result = await storage.toggleWishListSave(ideaId, userId);
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

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const isMember = await storage.isTripMember(idea.tripId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "Access denied" });
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

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const isMember = await storage.isTripMember(idea.tripId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "Access denied" });
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

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const isMember = await storage.isTripMember(idea.tripId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "Access denied" });
      }

      const isAdmin = await storage.isTripAdmin(idea.tripId, userId);
      if (!isAdmin && idea.createdBy !== userId) {
        return res.status(403).json({ message: "Only the creator or a trip admin can delete this idea" });
      }

      await storage.deleteWishListIdea(ideaId);
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

      if (Number.isNaN(ideaId)) {
        return res.status(400).json({ message: "Invalid idea ID" });
      }

      const idea = await storage.getWishListIdeaById(ideaId);
      if (!idea) {
        return res.status(404).json({ message: "Idea not found" });
      }

      const isMember = await storage.isTripMember(idea.tripId, userId);
      if (!isMember) {
        return res.status(403).json({ message: "Access denied" });
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

