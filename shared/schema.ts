import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  decimal,
  unique,
  date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table - supports both custom auth and Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique().notNull(),
  username: varchar("username").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phoneNumber: varchar("phone_number"), // For payment app integration
  passwordHash: varchar("password_hash"), // For custom authentication
  profileImageUrl: varchar("profile_image_url"),
  cashAppUsername: varchar("cashapp_username"),
  cashAppPhone: varchar("cashapp_phone"), // For direct phone-based payments
  venmoUsername: varchar("venmo_username"),
  venmoPhone: varchar("venmo_phone"), // For direct phone-based payments
  timezone: varchar("timezone").default("UTC"),
  defaultLocation: varchar("default_location"), // User's default departure location
  defaultLocationCode: varchar("default_location_code"), // IATA code for flights
  defaultCity: varchar("default_city"), // City name for display
  defaultCountry: varchar("default_country"), // Country for location context
  authProvider: varchar("auth_provider").default("custom"), // 'custom' or 'replit'
  notificationPreferences: jsonb("notification_preferences").default('{"oneHour": true, "thirtyMinutes": true, "newActivities": true, "updates": true}'),
  hasSeenHomeOnboarding: boolean("has_seen_home_onboarding").default(false),
  hasSeenTripOnboarding: boolean("has_seen_trip_onboarding").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tripCalendars = pgTable("trip_calendars", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  shareCode: varchar("share_code", { length: 32 }).unique().notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tripMembers = pgTable("trip_members", {
  id: serial("id").primaryKey(),
  tripCalendarId: integer("trip_calendar_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("member"), // 'organizer' or 'member'
  departureLocation: varchar("departure_location", { length: 255 }), // City/location they're departing from
  departureAirport: varchar("departure_airport", { length: 10 }), // Airport code (e.g., JFK, LAX)
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  tripCalendarId: integer("trip_calendar_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  postedBy: varchar("posted_by").notNull().references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  location: varchar("location", { length: 500 }),
  cost: decimal("cost", { precision: 10, scale: 2 }),
  maxCapacity: integer("max_capacity"),
  category: varchar("category", { length: 50 }).notNull().default("other"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const activityAcceptances = pgTable("activity_acceptances", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  acceptedAt: timestamp("accepted_at").defaultNow(),
});

export const activityResponses = pgTable("activity_responses", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  response: varchar("response", { length: 20 }).notNull(), // 'accepted' or 'declined'
  respondedAt: timestamp("responded_at").defaultNow(),
}, (table) => ({
  uniqueActivityUser: unique("unique_activity_user").on(table.activityId, table.userId),
}));

export const activityComments = pgTable("activity_comments", {
  id: serial("id").primaryKey(),
  activityId: integer("activity_id").notNull().references(() => activities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});


export const packingItems = pgTable("packing_items", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  item: varchar("item", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).default("general"),
  itemType: varchar("item_type", { length: 20 }).notNull().default("personal"), // 'personal' or 'group'
  isChecked: boolean("is_checked").default(false),
  assignedUserId: varchar("assigned_user_id").references(() => users.id), // For group items, who will handle it
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  paidBy: varchar("paid_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 6 }),
  originalCurrency: varchar("original_currency", { length: 3 }),
  convertedAmounts: jsonb("converted_amounts"), // Store converted amounts for different currencies
  description: varchar("description", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  activityId: integer("activity_id").references(() => activities.id, { onDelete: "cascade" }),
  splitType: varchar("split_type", { length: 20 }).notNull().default("equal"), // equal, percentage, exact
  splitData: jsonb("split_data"), // stores split details for each participant
  receiptUrl: varchar("receipt_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const expenseShares = pgTable("expense_shares", {
  id: serial("id").primaryKey(),
  expenseId: integer("expense_id").notNull().references(() => expenses.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  isPaid: boolean("is_paid").default(false),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 50 }).notNull(), // 'new_member', 'new_activity', 'payment_due', 'payment_received'
  title: varchar("title", { length: 255 }).notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  tripId: integer("trip_id").references(() => tripCalendars.id, { onDelete: "cascade" }),
  activityId: integer("activity_id").references(() => activities.id, { onDelete: "cascade" }),
  expenseId: integer("expense_id").references(() => expenses.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groceryItems = pgTable("grocery_items", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  addedBy: varchar("added_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  item: varchar("item", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("other"), // 'produce', 'dairy', 'meat', 'snacks', 'alcohol', 'other'
  quantity: varchar("quantity", { length: 100 }).default("1"),
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  isPurchased: boolean("is_purchased").default(false),
  actualCost: decimal("actual_cost", { precision: 10, scale: 2 }),
  receiptLineItem: varchar("receipt_line_item", { length: 500 }), // For receipt parsing
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const groceryItemParticipants = pgTable("grocery_item_participants", {
  id: serial("id").primaryKey(),
  groceryItemId: integer("grocery_item_id").notNull().references(() => groceryItems.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  willConsume: boolean("will_consume").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const groceryReceipts = pgTable("grocery_receipts", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiptImageUrl: varchar("receipt_image_url", { length: 500 }),
  storeName: varchar("store_name", { length: 255 }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  purchaseDate: timestamp("purchase_date").notNull(),
  parsedItems: jsonb("parsed_items"), // Stores parsed receipt data
  isProcessed: boolean("is_processed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const flights = pgTable("flights", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Flight details
  flightNumber: varchar("flight_number", { length: 10 }).notNull(),
  airline: varchar("airline", { length: 100 }).notNull(),
  airlineCode: varchar("airline_code", { length: 3 }).notNull(),
  
  // Departure info
  departureAirport: varchar("departure_airport", { length: 100 }).notNull(),
  departureCode: varchar("departure_code", { length: 3 }).notNull(),
  departureTime: timestamp("departure_time").notNull(),
  departureTerminal: varchar("departure_terminal", { length: 10 }),
  departureGate: varchar("departure_gate", { length: 10 }),
  
  // Arrival info
  arrivalAirport: varchar("arrival_airport", { length: 100 }).notNull(),
  arrivalCode: varchar("arrival_code", { length: 3 }).notNull(),
  arrivalTime: timestamp("arrival_time").notNull(),
  arrivalTerminal: varchar("arrival_terminal", { length: 10 }),
  arrivalGate: varchar("arrival_gate", { length: 10 }),
  
  // Booking details
  bookingReference: varchar("booking_reference", { length: 20 }),
  seatNumber: varchar("seat_number", { length: 10 }),
  seatClass: varchar("seat_class", { length: 20 }), // 'economy', 'premium', 'business', 'first'
  price: decimal("price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Flight type and status
  flightType: varchar("flight_type", { length: 20 }).notNull(), // 'outbound', 'return', 'connecting'
  status: varchar("status", { length: 20 }).default("confirmed"), // 'confirmed', 'cancelled', 'delayed', 'completed'
  
  // Layover information (JSON array for multiple layovers)
  layovers: jsonb("layovers"), // [{ airport: "JFK", code: "JFK", duration: 120, terminal: "4" }]
  
  // Booking source
  bookingSource: varchar("booking_source", { length: 50 }).default("manual"), // 'manual', 'app_purchase', 'external'
  purchaseUrl: varchar("purchase_url", { length: 500 }), // For app purchases
  
  // Additional info
  aircraft: varchar("aircraft", { length: 100 }),
  flightDuration: integer("flight_duration"), // in minutes
  baggage: jsonb("baggage"), // { carry_on: true, checked: 1, weight: "23kg" }
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const hotels = pgTable("hotels", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Hotel details
  hotelName: varchar("hotel_name", { length: 200 }).notNull(),
  hotelChain: varchar("hotel_chain", { length: 100 }),
  hotelRating: integer("hotel_rating"), // 1-5 stars
  
  // Location info
  address: varchar("address", { length: 300 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  zipCode: varchar("zip_code", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  
  // Stay details
  checkInDate: timestamp("check_in_date").notNull(),
  checkOutDate: timestamp("check_out_date").notNull(),
  roomType: varchar("room_type", { length: 100 }), // 'standard', 'deluxe', 'suite', 'penthouse'
  roomCount: integer("room_count").default(1),
  guestCount: integer("guest_count").default(1),
  
  // Booking details
  bookingReference: varchar("booking_reference", { length: 30 }),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }),
  pricePerNight: decimal("price_per_night", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Status and source
  status: varchar("status", { length: 20 }).default("confirmed"), // 'confirmed', 'cancelled', 'pending'
  bookingSource: varchar("booking_source", { length: 50 }).default("manual"), // 'manual', 'app_purchase', 'external'
  purchaseUrl: varchar("purchase_url", { length: 500 }), // For app purchases
  
  // Additional info
  amenities: jsonb("amenities"), // ['wifi', 'pool', 'gym', 'spa', 'restaurant', 'parking']
  images: jsonb("images"), // Array of image URLs
  policies: jsonb("policies"), // Cancellation, check-in policies etc.
  contactInfo: jsonb("contact_info"), // { phone, email, website }
  
  // New fields for enhanced functionality
  bookingPlatform: varchar("booking_platform", { length: 50 }),
  bookingUrl: varchar("booking_url", { length: 500 }),
  cancellationPolicy: text("cancellation_policy"),
  
  // User notes
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Hotel proposals for group voting
export const hotelProposals = pgTable("hotel_proposals", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  proposedBy: varchar("proposed_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Hotel details from search
  hotelName: varchar("hotel_name", { length: 200 }).notNull(),
  location: varchar("location", { length: 300 }).notNull(),
  price: varchar("price", { length: 50 }).notNull(),
  pricePerNight: varchar("price_per_night", { length: 50 }),
  rating: decimal("rating", { precision: 3, scale: 1 }).notNull(),
  amenities: text("amenities"),
  platform: varchar("platform", { length: 50 }).notNull(),
  bookingUrl: varchar("booking_url", { length: 500 }).notNull(),
  
  // Proposal status
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'selected', 'rejected'
  averageRanking: decimal("average_ranking", { precision: 3, scale: 2 }), // calculated field
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Hotel ranking votes from group members
export const hotelRankings = pgTable("hotel_rankings", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => hotelProposals.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ranking: integer("ranking").notNull(), // 1 = favorite, higher = less preferred
  notes: text("notes"), // optional member notes about their preference
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.proposalId, table.userId), // One vote per user per proposal
]);

// Flight proposals for group voting
export const flightProposals = pgTable("flight_proposals", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  proposedBy: varchar("proposed_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Flight details from search
  airline: varchar("airline", { length: 100 }).notNull(),
  flightNumber: varchar("flight_number", { length: 20 }).notNull(),
  
  // Departure info
  departureAirport: varchar("departure_airport", { length: 10 }).notNull(),
  departureTime: varchar("departure_time", { length: 50 }).notNull(),
  departureTerminal: varchar("departure_terminal", { length: 10 }),
  
  // Arrival info
  arrivalAirport: varchar("arrival_airport", { length: 10 }).notNull(),
  arrivalTime: varchar("arrival_time", { length: 50 }).notNull(),
  arrivalTerminal: varchar("arrival_terminal", { length: 10 }),
  
  // Flight details
  duration: varchar("duration", { length: 20 }).notNull(),
  stops: integer("stops").notNull().default(0),
  aircraft: varchar("aircraft", { length: 50 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  
  // Booking URLs
  bookingUrl: varchar("booking_url", { length: 500 }).notNull(),
  platform: varchar("platform", { length: 50 }).notNull().default("Amadeus"),
  
  // Proposal status
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'selected', 'rejected'
  averageRanking: decimal("average_ranking", { precision: 3, scale: 2 }), // calculated field
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Flight ranking votes from group members
export const flightRankings = pgTable("flight_rankings", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => flightProposals.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ranking: integer("ranking").notNull(), // 1 = favorite, higher = less preferred
  notes: text("notes"), // optional member notes about their preference
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.proposalId, table.userId), // One vote per user per proposal
]);

// Activity proposals for group voting
export const activityProposals = pgTable("activity_proposals", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  proposedBy: varchar("proposed_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Activity details from search
  activityName: varchar("activity_name", { length: 200 }).notNull(),
  description: text("description"),
  location: varchar("location", { length: 300 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(), // sightseeing, outdoor, cultural, entertainment, etc.
  duration: varchar("duration", { length: 50 }), // "2 hours", "half day", "full day"
  
  // Pricing and availability
  price: decimal("price", { precision: 10, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("USD"),
  priceType: varchar("price_type", { length: 30 }), // "per person", "per group", "free"
  
  // Timing
  availableDates: jsonb("available_dates"), // Array of available date strings
  preferredTime: varchar("preferred_time", { length: 50 }), // "morning", "afternoon", "evening", "flexible"
  
  // Additional details
  difficulty: varchar("difficulty", { length: 20 }), // "easy", "moderate", "challenging"
  minGroupSize: integer("min_group_size"),
  maxGroupSize: integer("max_group_size"),
  ageRestrictions: varchar("age_restrictions", { length: 100 }),
  requirements: text("requirements"), // What to bring, physical requirements, etc.
  
  // Booking info
  bookingUrl: varchar("booking_url", { length: 500 }),
  contactInfo: jsonb("contact_info"), // { phone, email, website }
  platform: varchar("platform", { length: 50 }).notNull().default("Manual"),
  
  // Proposal status
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'selected', 'rejected'
  averageRanking: decimal("average_ranking", { precision: 3, scale: 2 }), // calculated field
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Activity ranking votes from group members
export const activityRankings = pgTable("activity_rankings", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => activityProposals.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ranking: integer("ranking").notNull(), // 1 = favorite, higher = less preferred
  notes: text("notes"), // optional member notes about their preference
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.proposalId, table.userId), // One vote per user per proposal
]);

// Restaurant proposals for group voting
export const restaurantProposals = pgTable("restaurant_proposals", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  proposedBy: varchar("proposed_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Restaurant details from search
  restaurantName: varchar("restaurant_name", { length: 200 }).notNull(),
  address: varchar("address", { length: 300 }).notNull(),
  cuisineType: varchar("cuisine_type", { length: 100 }),
  priceRange: varchar("price_range", { length: 10 }), // $, $$, $$$, $$$$
  rating: decimal("rating", { precision: 3, scale: 1 }),
  
  // Contact and booking
  phoneNumber: varchar("phone_number", { length: 20 }),
  website: varchar("website", { length: 500 }),
  reservationUrl: varchar("reservation_url", { length: 500 }),
  platform: varchar("platform", { length: 50 }).notNull().default("Foursquare"),
  
  // Dining details
  atmosphere: varchar("atmosphere", { length: 100 }), // "casual", "upscale", "family-friendly"
  specialties: text("specialties"), // Notable dishes or features
  dietaryOptions: jsonb("dietary_options"), // ["vegetarian", "vegan", "gluten-free", "halal"]
  
  // Availability preferences
  preferredMealTime: varchar("preferred_meal_time", { length: 20 }), // "breakfast", "lunch", "dinner", "brunch"
  preferredDates: jsonb("preferred_dates"), // Array of preferred date strings
  
  // Additional info
  features: jsonb("features"), // ["outdoor seating", "live music", "bar", "private dining"]
  
  // Proposal status
  status: varchar("status", { length: 20 }).default("active"), // 'active', 'selected', 'rejected'
  averageRanking: decimal("average_ranking", { precision: 3, scale: 2 }), // calculated field
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Restaurant ranking votes from group members
export const restaurantRankings = pgTable("restaurant_rankings", {
  id: serial("id").primaryKey(),
  proposalId: integer("proposal_id").notNull().references(() => restaurantProposals.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ranking: integer("ranking").notNull(), // 1 = favorite, higher = less preferred
  notes: text("notes"), // optional member notes about their preference
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique().on(table.proposalId, table.userId), // One vote per user per proposal
]);

export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => tripCalendars.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Restaurant details
  name: varchar("name", { length: 200 }).notNull(),
  cuisineType: varchar("cuisine_type", { length: 100 }),
  address: varchar("address", { length: 300 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  zipCode: varchar("zip_code", { length: 20 }),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  phoneNumber: varchar("phone_number", { length: 20 }),
  website: varchar("website", { length: 500 }),
  openTableUrl: varchar("opentable_url", { length: 500 }),
  priceRange: varchar("price_range", { length: 10 }).notNull().default("$$"), // $, $$, $$$, $$$$
  rating: decimal("rating", { precision: 3, scale: 1 }).default("4.0"),
  
  // Reservation details
  reservationDate: date("reservation_date").notNull(),
  reservationTime: varchar("reservation_time", { length: 20 }).notNull(),
  partySize: integer("party_size").notNull().default(2),
  confirmationNumber: varchar("confirmation_number", { length: 50 }),
  reservationStatus: varchar("reservation_status", { length: 20 }).default("pending"), // pending, confirmed, cancelled
  
  // Additional info
  specialRequests: text("special_requests"),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Travel Tips - Store personalized travel advice and recommendations
export const travelTips = pgTable("travel_tips", {
  id: serial("id").primaryKey(),
  
  // Core tip content
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).notNull(), // packing, local_customs, weather, transportation, dining, safety, activities, etc.
  
  // Location matching
  destination: varchar("destination", { length: 200 }), // Specific city/country like "Paris, France"
  applicableRegions: jsonb("applicable_regions"), // Broader matching: ["Europe", "Western Europe", "EU"]
  
  // Activity and context matching  
  activityCategories: jsonb("activity_categories"), // Array of activity types: ["sightseeing", "outdoor", "cultural"]
  seasonality: jsonb("seasonality"), // Season-specific tips: ["winter", "summer", "spring", "fall"]
  
  // Tip metadata
  priority: integer("priority").notNull().default(3), // 1-5 scale, 5 being highest priority
  tags: jsonb("tags"), // Flexible matching tags: ["budget", "family-friendly", "solo-travel"]
  isActive: boolean("is_active").default(true),
  
  // Attribution (optional - could be system-generated or user-contributed)
  createdBy: varchar("created_by"), // Could reference users.id for user-contributed tips
  source: varchar("source", { length: 100 }), // "system", "user", "api", etc.
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Travel Tip Preferences - Store user preferences for tip personalization
export const userTipPreferences = pgTable("user_tip_preferences", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // User preferences
  preferredCategories: jsonb("preferred_categories"), // Array of tip categories user prefers
  dismissedTips: jsonb("dismissed_tips"), // Array of tip IDs user has dismissed
  preferredLanguage: varchar("preferred_language", { length: 10 }).default("en"), // For future localization
  
  // Personalization settings
  showSeasonalTips: boolean("show_seasonal_tips").default(true),
  showLocationTips: boolean("show_location_tips").default(true),
  showActivityTips: boolean("show_activity_tips").default(true),
  tipFrequency: varchar("tip_frequency", { length: 20 }).default("normal"), // "minimal", "normal", "detailed"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  createdTrips: many(tripCalendars),
  tripMemberships: many(tripMembers),
  postedActivities: many(activities),
  activityAcceptances: many(activityAcceptances),
  activityResponses: many(activityResponses),
  comments: many(activityComments),
  packingItems: many(packingItems),
  expenses: many(expenses),
  expenseShares: many(expenseShares),
  notifications: many(notifications),
  groceryItems: many(groceryItems),
  groceryParticipations: many(groceryItemParticipants),
  groceryReceipts: many(groceryReceipts),
  flights: many(flights),
  hotels: many(hotels),
  restaurants: many(restaurants),
  proposedHotels: many(hotelProposals),
  hotelVotes: many(hotelRankings),
  proposedFlights: many(flightProposals),
  flightVotes: many(flightRankings),
  proposedActivities: many(activityProposals),
  activityVotes: many(activityRankings),
  proposedRestaurants: many(restaurantProposals),
  restaurantVotes: many(restaurantRankings),
  tipPreferences: one(userTipPreferences),
}));

export const tripCalendarsRelations = relations(tripCalendars, ({ one, many }) => ({
  creator: one(users, {
    fields: [tripCalendars.createdBy],
    references: [users.id],
  }),
  members: many(tripMembers),
  activities: many(activities),
  packingItems: many(packingItems),
  expenses: many(expenses),
  groceryItems: many(groceryItems),
  groceryReceipts: many(groceryReceipts),
  flights: many(flights),
  hotels: many(hotels),
  restaurants: many(restaurants),
  hotelProposals: many(hotelProposals),
  flightProposals: many(flightProposals),
  activityProposals: many(activityProposals),
  restaurantProposals: many(restaurantProposals),
}));

export const tripMembersRelations = relations(tripMembers, ({ one }) => ({
  trip: one(tripCalendars, {
    fields: [tripMembers.tripCalendarId],
    references: [tripCalendars.id],
  }),
  user: one(users, {
    fields: [tripMembers.userId],
    references: [users.id],
  }),
}));

export const activitiesRelations = relations(activities, ({ one, many }) => ({
  trip: one(tripCalendars, {
    fields: [activities.tripCalendarId],
    references: [tripCalendars.id],
  }),
  poster: one(users, {
    fields: [activities.postedBy],
    references: [users.id],
  }),
  acceptances: many(activityAcceptances),
  responses: many(activityResponses),
  comments: many(activityComments),
  expenses: many(expenses),

}));

export const activityAcceptancesRelations = relations(activityAcceptances, ({ one }) => ({
  activity: one(activities, {
    fields: [activityAcceptances.activityId],
    references: [activities.id],
  }),
  user: one(users, {
    fields: [activityAcceptances.userId],
    references: [users.id],
  }),
}));

export const activityResponsesRelations = relations(activityResponses, ({ one }) => ({
  activity: one(activities, {
    fields: [activityResponses.activityId],
    references: [activities.id],
  }),
  user: one(users, {
    fields: [activityResponses.userId],
    references: [users.id],
  }),
}));

export const activityCommentsRelations = relations(activityComments, ({ one }) => ({
  activity: one(activities, {
    fields: [activityComments.activityId],
    references: [activities.id],
  }),
  user: one(users, {
    fields: [activityComments.userId],
    references: [users.id],
  }),
}));


export const packingItemsRelations = relations(packingItems, ({ one }) => ({
  trip: one(tripCalendars, {
    fields: [packingItems.tripId],
    references: [tripCalendars.id],
  }),
  user: one(users, {
    fields: [packingItems.userId],
    references: [users.id],
  }),
  assignedUser: one(users, {
    fields: [packingItems.assignedUserId],
    references: [users.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one, many }) => ({
  trip: one(tripCalendars, {
    fields: [expenses.tripId],
    references: [tripCalendars.id],
  }),
  paidBy: one(users, {
    fields: [expenses.paidBy],
    references: [users.id],
  }),
  activity: one(activities, {
    fields: [expenses.activityId],
    references: [activities.id],
  }),
  shares: many(expenseShares),
}));

export const expenseSharesRelations = relations(expenseShares, ({ one }) => ({
  expense: one(expenses, {
    fields: [expenseShares.expenseId],
    references: [expenses.id],
  }),
  user: one(users, {
    fields: [expenseShares.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  trip: one(tripCalendars, {
    fields: [notifications.tripId],
    references: [tripCalendars.id],
  }),
  activity: one(activities, {
    fields: [notifications.activityId],
    references: [activities.id],
  }),
  expense: one(expenses, {
    fields: [notifications.expenseId],
    references: [expenses.id],
  }),
}));

export const groceryItemsRelations = relations(groceryItems, ({ one, many }) => ({
  trip: one(tripCalendars, {
    fields: [groceryItems.tripId],
    references: [tripCalendars.id],
  }),
  addedBy: one(users, {
    fields: [groceryItems.addedBy],
    references: [users.id],
  }),
  participants: many(groceryItemParticipants),
}));

export const groceryItemParticipantsRelations = relations(groceryItemParticipants, ({ one }) => ({
  groceryItem: one(groceryItems, {
    fields: [groceryItemParticipants.groceryItemId],
    references: [groceryItems.id],
  }),
  user: one(users, {
    fields: [groceryItemParticipants.userId],
    references: [users.id],
  }),
}));

export const groceryReceiptsRelations = relations(groceryReceipts, ({ one }) => ({
  trip: one(tripCalendars, {
    fields: [groceryReceipts.tripId],
    references: [tripCalendars.id],
  }),
  uploadedBy: one(users, {
    fields: [groceryReceipts.uploadedBy],
    references: [users.id],
  }),
}));

export const flightsRelations = relations(flights, ({ one }) => ({
  trip: one(tripCalendars, {
    fields: [flights.tripId],
    references: [tripCalendars.id],
  }),
  user: one(users, {
    fields: [flights.userId],
    references: [users.id],
  }),
}));

export const hotelsRelations = relations(hotels, ({ one }) => ({
  trip: one(tripCalendars, {
    fields: [hotels.tripId],
    references: [tripCalendars.id],
  }),
  user: one(users, {
    fields: [hotels.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertTripCalendarSchema = createInsertSchema(tripCalendars).omit({
  id: true,
  shareCode: true,
  createdBy: true,
  createdAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  postedBy: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  cost: z.coerce.string().optional(),
});

export const insertActivityCommentSchema = createInsertSchema(activityComments).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertPackingItemSchema = createInsertSchema(packingItems).omit({
  id: true,
  userId: true,
  createdAt: true,
}).extend({
  itemType: z.enum(["personal", "group"]).default("personal"),
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  paidBy: true,
  createdAt: true,
  updatedAt: true,
});

export const insertExpenseShareSchema = createInsertSchema(expenseShares).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertGroceryItemSchema = createInsertSchema(groceryItems).omit({
  id: true,
  addedBy: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  estimatedCost: z.coerce.string().optional(),
  actualCost: z.coerce.string().optional(),
});

export const insertGroceryItemParticipantSchema = createInsertSchema(groceryItemParticipants).omit({
  id: true,
  createdAt: true,
});

export const insertGroceryReceiptSchema = createInsertSchema(groceryReceipts).omit({
  id: true,
  uploadedBy: true,
  createdAt: true,
}).extend({
  totalAmount: z.coerce.string(),
});

export const insertFlightSchema = createInsertSchema(flights).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  price: z.coerce.string().optional(),
  departureTime: z.coerce.date(),
  arrivalTime: z.coerce.date(),
});

export const insertHotelSchema = createInsertSchema(hotels).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  totalPrice: z.coerce.string().optional(),
  pricePerNight: z.coerce.string().optional(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
});

export const insertHotelProposalSchema = createInsertSchema(hotelProposals).omit({
  id: true,
  proposedBy: true,
  averageRanking: true,
  createdAt: true,
}).extend({
  rating: z.coerce.string(),
});

export const insertHotelRankingSchema = createInsertSchema(hotelRankings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFlightProposalSchema = createInsertSchema(flightProposals).omit({
  id: true,
  proposedBy: true,
  averageRanking: true,
  createdAt: true,
}).extend({
  price: z.coerce.string(),
});

export const insertFlightRankingSchema = createInsertSchema(flightRankings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivityProposalSchema = createInsertSchema(activityProposals).omit({
  id: true,
  proposedBy: true,
  averageRanking: true,
  createdAt: true,
}).extend({
  price: z.coerce.string().optional(),
});

export const insertActivityRankingSchema = createInsertSchema(activityRankings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRestaurantProposalSchema = createInsertSchema(restaurantProposals).omit({
  id: true,
  proposedBy: true,
  averageRanking: true,
  createdAt: true,
}).extend({
  rating: z.coerce.string().optional(),
});

export const insertRestaurantRankingSchema = createInsertSchema(restaurantRankings).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTravelTipSchema = createInsertSchema(travelTips).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserTipPreferencesSchema = createInsertSchema(userTipPreferences).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});


// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type TripCalendar = typeof tripCalendars.$inferSelect;
export type InsertTripCalendar = z.infer<typeof insertTripCalendarSchema>;
export type TripMember = typeof tripMembers.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type ActivityAcceptance = typeof activityAcceptances.$inferSelect;
export type ActivityResponse = typeof activityResponses.$inferSelect;
export type ActivityComment = typeof activityComments.$inferSelect;
export type InsertActivityComment = z.infer<typeof insertActivityCommentSchema>;
export type PackingItem = typeof packingItems.$inferSelect;
export type InsertPackingItem = z.infer<typeof insertPackingItemSchema>;
export type Expense = typeof expenses.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type ExpenseShare = typeof expenseShares.$inferSelect;
export type InsertExpenseShare = z.infer<typeof insertExpenseShareSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type GroceryItem = typeof groceryItems.$inferSelect;
export type InsertGroceryItem = z.infer<typeof insertGroceryItemSchema>;
export type GroceryItemParticipant = typeof groceryItemParticipants.$inferSelect;
export type InsertGroceryItemParticipant = z.infer<typeof insertGroceryItemParticipantSchema>;
export type GroceryReceipt = typeof groceryReceipts.$inferSelect;
export type InsertGroceryReceipt = z.infer<typeof insertGroceryReceiptSchema>;
export type Flight = typeof flights.$inferSelect;
export type InsertFlight = z.infer<typeof insertFlightSchema>;


export type Hotel = typeof hotels.$inferSelect;
export type InsertHotel = z.infer<typeof insertHotelSchema>;
export type HotelWithDetails = Hotel & {
  user: User;
  trip: TripCalendar;
  // Mapped properties for backward compatibility with UI
  name?: string; // maps to hotelName
  location?: string; // maps to address
  rating?: number; // maps to hotelRating
  guests?: number; // maps to guestCount
  description?: string; // maps to notes
};

// API response types for better type safety
export type TripWithDates = {
  id: number;
  name: string;
  destination: string;
  startDate: string | Date;
  endDate: string | Date;
  shareCode: string;
  createdBy: string;
  createdAt?: string | Date;
};

// Hotel search API response type
export type HotelSearchResult = {
  id: string;
  name: string;
  location: string;
  address?: string;
  rating: number;
  price: string;
  pricePerNight?: string;
  pricePerNightValue?: number;
  amenities?: string;
  platform: string;
  bookingUrl: string;
  description?: string;
  isGroupProposal?: boolean;
  proposedBy?: User;
};

export type HotelProposal = typeof hotelProposals.$inferSelect;
export type InsertHotelProposal = z.infer<typeof insertHotelProposalSchema>;
export type HotelRanking = typeof hotelRankings.$inferSelect;
export type InsertHotelRanking = z.infer<typeof insertHotelRankingSchema>;

export type HotelProposalWithDetails = HotelProposal & {
  proposer: User;
  rankings: (HotelRanking & { user: User })[];
  currentUserRanking?: HotelRanking;
};

export type FlightProposal = typeof flightProposals.$inferSelect;
export type InsertFlightProposal = z.infer<typeof insertFlightProposalSchema>;
export type FlightRanking = typeof flightRankings.$inferSelect;
export type InsertFlightRanking = z.infer<typeof insertFlightRankingSchema>;

export type FlightProposalWithDetails = FlightProposal & {
  proposer: User;
  rankings: (FlightRanking & { user: User })[];
  currentUserRanking?: FlightRanking;
};

// Activity Proposal types
export type ActivityProposal = typeof activityProposals.$inferSelect;
export type InsertActivityProposal = z.infer<typeof insertActivityProposalSchema>;
export type ActivityRanking = typeof activityRankings.$inferSelect;
export type InsertActivityRanking = z.infer<typeof insertActivityRankingSchema>;

export type ActivityProposalWithDetails = ActivityProposal & {
  proposer: User;
  rankings: (ActivityRanking & { user: User })[];
  currentUserRanking?: ActivityRanking;
};

// Restaurant Proposal types
export type RestaurantProposal = typeof restaurantProposals.$inferSelect;
export type InsertRestaurantProposal = z.infer<typeof insertRestaurantProposalSchema>;
export type RestaurantRanking = typeof restaurantRankings.$inferSelect;
export type InsertRestaurantRanking = z.infer<typeof insertRestaurantRankingSchema>;

export type RestaurantProposalWithDetails = RestaurantProposal & {
  proposer: User;
  rankings: (RestaurantRanking & { user: User })[];
  currentUserRanking?: RestaurantRanking;
};

// Extended types for API responses
export type ActivityWithDetails = Activity & {
  poster: User;
  acceptances: (ActivityAcceptance & { user: User })[];
  comments: (ActivityComment & { user: User })[];
  acceptedCount: number;
  isAccepted?: boolean;
  hasResponded?: boolean;
};

export type TripWithDetails = TripCalendar & {
  creator: User;
  members: (TripMember & { user: User })[];
  memberCount: number;
};

export type ExpenseWithDetails = Expense & {
  paidBy: User;
  activity?: Activity;
  shares: (ExpenseShare & { user: User })[];
  totalAmount: number;
};

export type GroceryItemWithDetails = GroceryItem & {
  addedBy: User;
  participants: (GroceryItemParticipant & { user: User })[];
  participantCount: number;
  costPerPerson: number;
};

export type GroceryReceiptWithDetails = GroceryReceipt & {
  uploadedBy: User;
  items: GroceryItemWithDetails[];
};

export type FlightWithDetails = Flight & {
  user: User;
  trip: TripCalendar;
};

export const restaurantsRelations = relations(restaurants, ({ one }) => ({
  trip: one(tripCalendars, {
    fields: [restaurants.tripId],
    references: [tripCalendars.id],
  }),
  user: one(users, {
    fields: [restaurants.userId],
    references: [users.id],
  }),
}));

export const hotelProposalsRelations = relations(hotelProposals, ({ one, many }) => ({
  trip: one(tripCalendars, {
    fields: [hotelProposals.tripId],
    references: [tripCalendars.id],
  }),
  proposer: one(users, {
    fields: [hotelProposals.proposedBy],
    references: [users.id],
  }),
  rankings: many(hotelRankings),
}));

export const flightProposalsRelations = relations(flightProposals, ({ one, many }) => ({
  trip: one(tripCalendars, {
    fields: [flightProposals.tripId],
    references: [tripCalendars.id],
  }),
  proposer: one(users, {
    fields: [flightProposals.proposedBy],
    references: [users.id],
  }),
  rankings: many(flightRankings),
}));

export const flightRankingsRelations = relations(flightRankings, ({ one }) => ({
  proposal: one(flightProposals, {
    fields: [flightRankings.proposalId],
    references: [flightProposals.id],
  }),
  user: one(users, {
    fields: [flightRankings.userId],
    references: [users.id],
  }),
}));

export const hotelRankingsRelations = relations(hotelRankings, ({ one }) => ({
  proposal: one(hotelProposals, {
    fields: [hotelRankings.proposalId],
    references: [hotelProposals.id],
  }),
  user: one(users, {
    fields: [hotelRankings.userId],
    references: [users.id],
  }),
}));

// Activity proposal relations
export const activityProposalsRelations = relations(activityProposals, ({ one, many }) => ({
  trip: one(tripCalendars, {
    fields: [activityProposals.tripId],
    references: [tripCalendars.id],
  }),
  proposer: one(users, {
    fields: [activityProposals.proposedBy],
    references: [users.id],
  }),
  rankings: many(activityRankings),
}));

export const activityRankingsRelations = relations(activityRankings, ({ one }) => ({
  proposal: one(activityProposals, {
    fields: [activityRankings.proposalId],
    references: [activityProposals.id],
  }),
  user: one(users, {
    fields: [activityRankings.userId],
    references: [users.id],
  }),
}));

// Restaurant proposal relations
export const restaurantProposalsRelations = relations(restaurantProposals, ({ one, many }) => ({
  trip: one(tripCalendars, {
    fields: [restaurantProposals.tripId],
    references: [tripCalendars.id],
  }),
  proposer: one(users, {
    fields: [restaurantProposals.proposedBy],
    references: [users.id],
  }),
  rankings: many(restaurantRankings),
}));

export const restaurantRankingsRelations = relations(restaurantRankings, ({ one }) => ({
  proposal: one(restaurantProposals, {
    fields: [restaurantRankings.proposalId],
    references: [restaurantProposals.id],
  }),
  user: one(users, {
    fields: [restaurantRankings.userId],
    references: [users.id],
  }),
}));

// Travel tips relations
export const travelTipsRelations = relations(travelTips, ({ one }) => ({
  creator: one(users, {
    fields: [travelTips.createdBy],
    references: [users.id],
  }),
}));

export const userTipPreferencesRelations = relations(userTipPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userTipPreferences.userId],
    references: [users.id],
  }),
}));

// Restaurant types
export type Restaurant = typeof restaurants.$inferSelect;
export const insertRestaurantSchema = createInsertSchema(restaurants);
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type RestaurantWithDetails = Restaurant & {
  user: User;
  trip: TripCalendar;
};

// Travel Tips types
export type TravelTip = typeof travelTips.$inferSelect;
export type InsertTravelTip = z.infer<typeof insertTravelTipSchema>;
export type TravelTipWithDetails = TravelTip & {
  creator?: User;
};

export type UserTipPreferences = typeof userTipPreferences.$inferSelect;
export type InsertUserTipPreferences = z.infer<typeof insertUserTipPreferencesSchema>;
export type UserTipPreferencesWithUser = UserTipPreferences & {
  user: User;
};
