import { z } from "zod";

type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue };

type IsoDate = string | Date;

export interface User {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  passwordHash: string | null;
  profileImageUrl: string | null;
  cashAppUsername: string | null;
  cashAppPhone: string | null;
  venmoUsername: string | null;
  venmoPhone: string | null;
  timezone: string | null;
  defaultLocation: string | null;
  defaultLocationCode: string | null;
  defaultCity: string | null;
  defaultCountry: string | null;
  authProvider: string | null;
  notificationPreferences: Record<string, JsonValue> | null;
  hasSeenHomeOnboarding: boolean;
  hasSeenTripOnboarding: boolean;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export interface UpsertUser {
  id: string;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  passwordHash?: string | null;
  profileImageUrl?: string | null;
  cashAppUsername?: string | null;
  cashAppPhone?: string | null;
  venmoUsername?: string | null;
  venmoPhone?: string | null;
  timezone?: string | null;
  defaultLocation?: string | null;
  defaultLocationCode?: string | null;
  defaultCity?: string | null;
  defaultCountry?: string | null;
  authProvider?: string | null;
  notificationPreferences?: Record<string, JsonValue> | null;
  hasSeenHomeOnboarding?: boolean;
  hasSeenTripOnboarding?: boolean;
}

export interface TripCalendar {
  id: number;
  name: string;
  destination: string;
  startDate: IsoDate;
  endDate: IsoDate;
  shareCode: string;
  createdBy: string;
  createdAt: IsoDate | null;
}

export const insertTripCalendarSchema = z.object({
  name: z.string().min(1, "Trip name is required"),
  destination: z.string().min(1, "Destination is required"),
  startDate: z.union([z.date(), z.string()]),
  endDate: z.union([z.date(), z.string()]),
});

export type InsertTripCalendar = z.infer<typeof insertTripCalendarSchema>;

export interface TripMember {
  id: number;
  tripCalendarId: number;
  userId: string;
  role: string;
  departureLocation: string | null;
  departureAirport: string | null;
  joinedAt: IsoDate | null;
}

export interface Activity {
  id: number;
  tripCalendarId: number;
  postedBy: string;
  name: string;
  description: string | null;
  startTime: IsoDate;
  endTime: IsoDate | null;
  location: string | null;
  cost: string | null;
  maxCapacity: number | null;
  category: string;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertActivitySchema = z.object({
  tripCalendarId: z.number(),
  name: z.string().min(1, "Activity name is required"),
  description: z.string().nullable().optional(),
  startTime: z.union([z.date(), z.string()]),
  endTime: z.union([z.date(), z.string()]).nullable().optional(),
  location: z.string().nullable().optional(),
  cost: z.union([z.number(), z.string()]).nullable().optional(),
  maxCapacity: z.union([z.number(), z.string()]).nullable().optional(),
  category: z.string().default("other"),
});

export type InsertActivity = z.infer<typeof insertActivitySchema>;

export interface ActivityAcceptance {
  id: number;
  activityId: number;
  userId: string;
  acceptedAt: IsoDate | null;
}

export interface ActivityResponse {
  id: number;
  activityId: number;
  userId: string;
  response: string;
  respondedAt: IsoDate | null;
}

export interface ActivityComment {
  id: number;
  activityId: number;
  userId: string;
  comment: string;
  createdAt: IsoDate | null;
}

export const insertActivityCommentSchema = z.object({
  activityId: z.number(),
  comment: z.string().min(1, "Comment is required"),
});

export type InsertActivityComment = z.infer<typeof insertActivityCommentSchema>;

export interface PackingItem {
  id: number;
  tripId: number;
  userId: string;
  item: string;
  category: string | null;
  itemType: "personal" | "group";
  isChecked: boolean;
  assignedUserId: string | null;
  createdAt: IsoDate | null;
}

export const insertPackingItemSchema = z.object({
  tripId: z.number(),
  item: z.string().min(1, "Item is required"),
  category: z.string().nullable().optional(),
  itemType: z.enum(["personal", "group"]).default("personal"),
  assignedUserId: z.string().nullable().optional(),
  isChecked: z.boolean().optional(),
});

export type InsertPackingItem = z.infer<typeof insertPackingItemSchema>;

export interface Expense {
  id: number;
  tripId: number;
  paidBy: string;
  amount: string;
  currency: string;
  exchangeRate: string | null;
  originalCurrency: string | null;
  convertedAmounts: Record<string, JsonValue> | null;
  description: string;
  category: string;
  activityId: number | null;
  splitType: "equal" | "percentage" | "exact";
  splitData: Record<string, JsonValue> | null;
  receiptUrl: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertExpenseSchema = z.object({
  tripId: z.number(),
  description: z.string().min(1, "Description is required"),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .positive("Amount must be greater than zero"),
  currency: z.string().min(1, "Currency is required"),
  category: z.string().min(1, "Category is required"),
  activityId: z.number().nullable().optional(),
  splitType: z.enum(["equal", "percentage", "exact"]).default("equal"),
  splitData: z.record(z.any()).nullable().optional(),
  receiptUrl: z.string().url().nullable().optional(),
  exchangeRate: z.number().nullable().optional(),
  originalCurrency: z.string().nullable().optional(),
  convertedAmounts: z.record(z.any()).nullable().optional(),
  paidBy: z.string().optional(),
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;

export interface ExpenseShare {
  id: number;
  expenseId: number;
  userId: string;
  amount: string;
  isPaid: boolean;
  paidAt: IsoDate | null;
  createdAt: IsoDate | null;
}

export const insertExpenseShareSchema = z.object({
  expenseId: z.number(),
  userId: z.string(),
  amount: z
    .number({ invalid_type_error: "Amount must be a number" })
    .nonnegative("Amount must be non-negative"),
  isPaid: z.boolean().optional(),
  paidAt: z.union([z.date(), z.string()]).nullable().optional(),
});

export type InsertExpenseShare = z.infer<typeof insertExpenseShareSchema>;

export interface Notification {
  id: number;
  userId: string;
  type: string;
  title: string;
  message: string;
  tripId: number | null;
  activityId: number | null;
  expenseId: number | null;
  isRead: boolean;
  createdAt: IsoDate | null;
}

export const insertNotificationSchema = z.object({
  userId: z.string(),
  type: z.string().min(1, "Type is required"),
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  tripId: z.number().nullable().optional(),
  activityId: z.number().nullable().optional(),
  expenseId: z.number().nullable().optional(),
  isRead: z.boolean().optional(),
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;

const groceryNoteDetailsSchema = z.object({
  text: z.string().nullable().optional(),
  allergies: z.array(z.string()).optional(),
  exclusions: z.array(z.string()).optional(),
});

export const groceryNotesSchema = z.union([z.string(), groceryNoteDetailsSchema]);

export type GroceryNotes = z.infer<typeof groceryNotesSchema>;

export interface GroceryItem {
  id: number;
  tripId: number;
  addedBy: string;
  item: string;
  category: string;
  quantity: string | null;
  estimatedCost: string | null;
  notes: GroceryNotes | null;
  isPurchased: boolean;
  actualCost: string | null;
  receiptLineItem: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertGroceryItemSchema = z.object({
  tripId: z.number(),
  item: z.string().min(1, "Item is required"),
  category: z.string().min(1, "Category is required"),
  quantity: z.string().nullable().optional(),
  estimatedCost: z.union([z.string(), z.number()]).nullable().optional(),
  notes: groceryNotesSchema.nullable().optional(),
  isPurchased: z.boolean().optional(),
  actualCost: z.union([z.string(), z.number()]).nullable().optional(),
  receiptLineItem: z.string().nullable().optional(),
});

export type InsertGroceryItem = z.infer<typeof insertGroceryItemSchema>;

export interface GroceryItemParticipant {
  id: number;
  groceryItemId: number;
  userId: string;
  willConsume: boolean;
  createdAt: IsoDate | null;
}

export const insertGroceryItemParticipantSchema = z.object({
  groceryItemId: z.number(),
  userId: z.string(),
  willConsume: z.boolean().optional(),
});

export type InsertGroceryItemParticipant = z.infer<
  typeof insertGroceryItemParticipantSchema
>;

export interface GroceryReceipt {
  id: number;
  tripId: number;
  uploadedBy: string;
  receiptImageUrl: string | null;
  storeName: string | null;
  totalAmount: string;
  purchaseDate: IsoDate;
  parsedItems: Record<string, JsonValue> | null;
  isProcessed: boolean;
  createdAt: IsoDate | null;
}

export const insertGroceryReceiptSchema = z.object({
  tripId: z.number(),
  totalAmount: z.union([z.string(), z.number()]).transform((value) =>
    typeof value === "number" ? value.toString() : value
  ),
  purchaseDate: z.union([z.date(), z.string()]),
  receiptImageUrl: z.string().nullable().optional(),
  storeName: z.string().nullable().optional(),
  parsedItems: z.record(z.any()).nullable().optional(),
  isProcessed: z.boolean().optional(),
});

export type InsertGroceryReceipt = z.infer<typeof insertGroceryReceiptSchema>;

export interface Flight {
  id: number;
  tripId: number;
  userId: string;
  flightNumber: string;
  airline: string;
  airlineCode: string;
  departureAirport: string;
  departureCode: string;
  departureTime: IsoDate;
  departureTerminal: string | null;
  departureGate: string | null;
  arrivalAirport: string;
  arrivalCode: string;
  arrivalTime: IsoDate;
  arrivalTerminal: string | null;
  arrivalGate: string | null;
  bookingReference: string | null;
  seatNumber: string | null;
  seatClass: string | null;
  price: string | null;
  currency: string;
  flightType: string;
  status: string;
  layovers: JsonValue;
  bookingSource: string | null;
  purchaseUrl: string | null;
  aircraft: string | null;
  flightDuration: number | null;
  baggage: JsonValue;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertFlightSchema = z.object({
  tripId: z.number(),
  flightNumber: z.string().min(1, "Flight number is required"),
  airline: z.string().min(1, "Airline is required"),
  airlineCode: z.string().min(1, "Airline code is required"),
  departureAirport: z.string().min(1, "Departure airport is required"),
  departureCode: z.string().min(1, "Departure code is required"),
  departureTime: z.union([z.date(), z.string()]),
  arrivalAirport: z.string().min(1, "Arrival airport is required"),
  arrivalCode: z.string().min(1, "Arrival code is required"),
  arrivalTime: z.union([z.date(), z.string()]),
  flightType: z.string().min(1, "Flight type is required"),
  status: z.string().default("confirmed"),
  currency: z.string().default("USD"),
  bookingReference: z.string().nullable().optional(),
  departureTerminal: z.string().nullable().optional(),
  departureGate: z.string().nullable().optional(),
  arrivalTerminal: z.string().nullable().optional(),
  arrivalGate: z.string().nullable().optional(),
  seatNumber: z.string().nullable().optional(),
  seatClass: z.string().nullable().optional(),
  price: z.union([z.number(), z.string()]).nullable().optional(),
  layovers: z.any().nullable().optional(),
  bookingSource: z.string().nullable().optional(),
  purchaseUrl: z.string().nullable().optional(),
  aircraft: z.string().nullable().optional(),
  flightDuration: z.number().nullable().optional(),
  baggage: z.any().nullable().optional(),
});

export type InsertFlight = z.infer<typeof insertFlightSchema>;

export interface Hotel {
  id: number;
  tripId: number;
  userId: string;
  hotelName: string;
  hotelChain: string | null;
  hotelRating: number | null;
  address: string;
  city: string;
  country: string;
  zipCode: string | null;
  latitude: string | null;
  longitude: string | null;
  checkInDate: IsoDate;
  checkOutDate: IsoDate;
  roomType: string | null;
  roomCount: number | null;
  guestCount: number | null;
  bookingReference: string | null;
  totalPrice: string | null;
  pricePerNight: string | null;
  currency: string;
  status: string;
  bookingSource: string | null;
  purchaseUrl: string | null;
  amenities: JsonValue;
  images: JsonValue;
  policies: JsonValue;
  contactInfo: JsonValue;
  bookingPlatform: string | null;
  bookingUrl: string | null;
  cancellationPolicy: string | null;
  notes: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertHotelSchema = z.object({
  tripId: z.number(),
  hotelName: z.string().min(1, "Hotel name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  checkInDate: z.union([z.date(), z.string()]),
  checkOutDate: z.union([z.date(), z.string()]),
  guestCount: z.number().nullable().optional(),
  roomCount: z.number().nullable().optional(),
  roomType: z.string().nullable().optional(),
  hotelChain: z.string().nullable().optional(),
  hotelRating: z.union([z.number(), z.string()]).nullable().optional(),
  bookingReference: z.string().nullable().optional(),
  totalPrice: z.union([z.number(), z.string()]).nullable().optional(),
  pricePerNight: z.union([z.number(), z.string()]).nullable().optional(),
  currency: z.string().default("USD"),
  status: z.string().default("confirmed"),
  bookingSource: z.string().nullable().optional(),
  purchaseUrl: z.string().nullable().optional(),
  amenities: z.any().nullable().optional(),
  images: z.any().nullable().optional(),
  policies: z.any().nullable().optional(),
  contactInfo: z.any().nullable().optional(),
  bookingPlatform: z.string().nullable().optional(),
  bookingUrl: z.string().nullable().optional(),
  cancellationPolicy: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  latitude: z.union([z.number(), z.string()]).nullable().optional(),
  longitude: z.union([z.number(), z.string()]).nullable().optional(),
  zipCode: z.string().nullable().optional(),
});

export type InsertHotel = z.infer<typeof insertHotelSchema>;

export type HotelWithDetails = Hotel & {
  user: User;
  trip: TripCalendar;
  name?: string;
  location?: string;
  rating?: number;
  guests?: number;
  description?: string;
};

export type TripWithDates = {
  id: number;
  name: string;
  destination: string;
  startDate: IsoDate;
  endDate: IsoDate;
  shareCode: string;
  createdBy: string;
  createdAt?: IsoDate;
};

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

export interface HotelProposal {
  id: number;
  tripId: number;
  proposedBy: string;
  hotelName: string;
  location: string;
  price: string;
  pricePerNight: string | null;
  rating: number | null;
  amenities: string | null;
  platform: string;
  bookingUrl: string;
  status: string;
  averageRanking: string | null;
  createdAt: IsoDate | null;
}

export const insertHotelProposalSchema = z.object({
  tripId: z.number(),
  hotelName: z.string().min(1, "Hotel name is required"),
  location: z.string().min(1, "Location is required"),
  price: z.string().min(1, "Price is required"),
  pricePerNight: z.string().nullable().optional(),
  rating: z.union([z.number(), z.string()]).nullable().optional(),
  amenities: z.string().nullable().optional(),
  platform: z.string().min(1, "Platform is required"),
  bookingUrl: z.string().min(1, "Booking URL is required"),
  status: z.string().default("active"),
});

export type InsertHotelProposal = z.infer<typeof insertHotelProposalSchema>;

export interface HotelRanking {
  id: number;
  proposalId: number;
  userId: string;
  ranking: number;
  notes: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertHotelRankingSchema = z.object({
  proposalId: z.number(),
  ranking: z.number().min(1),
  notes: z.string().nullable().optional(),
});

export type InsertHotelRanking = z.infer<typeof insertHotelRankingSchema>;

export interface HotelProposalWithDetails extends HotelProposal {
  proposer: User;
  rankings: (HotelRanking & { user: User })[];
  currentUserRanking?: HotelRanking;
}

export interface FlightProposal {
  id: number;
  tripId: number;
  proposedBy: string;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  departureTime: string;
  departureTerminal: string | null;
  arrivalAirport: string;
  arrivalTime: string;
  arrivalTerminal: string | null;
  duration: string;
  stops: number;
  aircraft: string | null;
  price: string;
  currency: string;
  bookingUrl: string;
  platform: string;
  status: string;
  averageRanking: string | null;
  createdAt: IsoDate | null;
}

export const insertFlightProposalSchema = z.object({
  tripId: z.number(),
  airline: z.string().min(1, "Airline is required"),
  flightNumber: z.string().min(1, "Flight number is required"),
  departureAirport: z.string().min(1, "Departure airport is required"),
  departureTime: z.string().min(1, "Departure time is required"),
  arrivalAirport: z.string().min(1, "Arrival airport is required"),
  arrivalTime: z.string().min(1, "Arrival time is required"),
  duration: z.string().min(1, "Duration is required"),
  stops: z.number().min(0).default(0),
  aircraft: z.string().nullable().optional(),
  price: z.union([z.number(), z.string()]).transform((value) =>
    typeof value === "number" ? value.toFixed(2) : value
  ),
  currency: z.string().default("USD"),
  bookingUrl: z.string().min(1, "Booking URL is required"),
  platform: z.string().default("Amadeus"),
  status: z.string().default("active"),
  departureTerminal: z.string().nullable().optional(),
  arrivalTerminal: z.string().nullable().optional(),
});

export type InsertFlightProposal = z.infer<typeof insertFlightProposalSchema>;

export interface FlightRanking {
  id: number;
  proposalId: number;
  userId: string;
  ranking: number;
  notes: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertFlightRankingSchema = z.object({
  proposalId: z.number(),
  ranking: z.number().min(1),
  notes: z.string().nullable().optional(),
});

export type InsertFlightRanking = z.infer<typeof insertFlightRankingSchema>;

export type FlightProposalWithDetails = FlightProposal & {
  proposer: User;
  rankings: (FlightRanking & { user: User })[];
  currentUserRanking?: FlightRanking;
};

export interface ActivityProposal {
  id: number;
  tripId: number;
  proposedBy: string;
  activityName: string;
  description: string | null;
  location: string;
  category: string;
  duration: string | null;
  price: string | null;
  currency: string;
  priceType: string | null;
  availableDates: JsonValue;
  preferredTime: string | null;
  difficulty: string | null;
  minGroupSize: number | null;
  maxGroupSize: number | null;
  ageRestrictions: string | null;
  requirements: string | null;
  bookingUrl: string | null;
  contactInfo: JsonValue;
  platform: string;
  status: string;
  averageRanking: string | null;
  createdAt: IsoDate | null;
}

export const insertActivityProposalSchema = z.object({
  tripId: z.number(),
  activityName: z.string().min(1, "Activity name is required"),
  location: z.string().min(1, "Location is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  price: z.union([z.number(), z.string()]).nullable().optional(),
  currency: z.string().default("USD"),
  priceType: z.string().nullable().optional(),
  availableDates: z.any().nullable().optional(),
  preferredTime: z.string().nullable().optional(),
  difficulty: z.string().nullable().optional(),
  minGroupSize: z.number().nullable().optional(),
  maxGroupSize: z.number().nullable().optional(),
  ageRestrictions: z.string().nullable().optional(),
  requirements: z.string().nullable().optional(),
  bookingUrl: z.string().nullable().optional(),
  contactInfo: z.any().nullable().optional(),
  platform: z.string().default("Manual"),
  status: z.string().default("active"),
});

export type InsertActivityProposal = z.infer<typeof insertActivityProposalSchema>;

export interface ActivityRanking {
  id: number;
  proposalId: number;
  userId: string;
  ranking: number;
  notes: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertActivityRankingSchema = z.object({
  proposalId: z.number(),
  ranking: z.number().min(1),
  notes: z.string().nullable().optional(),
});

export type InsertActivityRanking = z.infer<typeof insertActivityRankingSchema>;

export type ActivityProposalWithDetails = ActivityProposal & {
  proposer: User;
  rankings: (ActivityRanking & { user: User })[];
  currentUserRanking?: ActivityRanking;
};

export interface RestaurantProposal {
  id: number;
  tripId: number;
  proposedBy: string;
  restaurantName: string;
  address: string;
  cuisineType: string | null;
  priceRange: string | null;
  rating: string | null;
  phoneNumber: string | null;
  website: string | null;
  reservationUrl: string | null;
  platform: string;
  atmosphere: string | null;
  specialties: string | null;
  dietaryOptions: JsonValue;
  preferredMealTime: string | null;
  preferredDates: JsonValue;
  features: JsonValue;
  status: string;
  averageRanking: string | null;
  createdAt: IsoDate | null;
}

export const insertRestaurantProposalSchema = z.object({
  tripId: z.number(),
  restaurantName: z.string().min(1, "Restaurant name is required"),
  address: z.string().min(1, "Address is required"),
  cuisineType: z.string().nullable().optional(),
  priceRange: z.string().nullable().optional(),
  rating: z.union([z.number(), z.string()]).nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  reservationUrl: z.string().nullable().optional(),
  platform: z.string().default("Foursquare"),
  atmosphere: z.string().nullable().optional(),
  specialties: z.string().nullable().optional(),
  dietaryOptions: z.any().nullable().optional(),
  preferredMealTime: z.string().nullable().optional(),
  preferredDates: z.any().nullable().optional(),
  features: z.any().nullable().optional(),
  status: z.string().default("active"),
});

export type InsertRestaurantProposal = z.infer<
  typeof insertRestaurantProposalSchema
>;

export interface RestaurantRanking {
  id: number;
  proposalId: number;
  userId: string;
  ranking: number;
  notes: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertRestaurantRankingSchema = z.object({
  proposalId: z.number(),
  ranking: z.number().min(1),
  notes: z.string().nullable().optional(),
});

export type InsertRestaurantRanking = z.infer<typeof insertRestaurantRankingSchema>;

export type RestaurantProposalWithDetails = RestaurantProposal & {
  proposer: User;
  rankings: (RestaurantRanking & { user: User })[];
  currentUserRanking?: RestaurantRanking;
};

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

export interface Restaurant {
  id: number;
  tripId: number;
  userId: string;
  name: string;
  cuisineType: string | null;
  address: string;
  city: string;
  country: string;
  zipCode: string | null;
  latitude: string | null;
  longitude: string | null;
  phoneNumber: string | null;
  website: string | null;
  openTableUrl: string | null;
  priceRange: string;
  rating: string | null;
  reservationDate: IsoDate;
  reservationTime: string;
  partySize: number;
  confirmationNumber: string | null;
  reservationStatus: string;
  specialRequests: string | null;
  notes: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertRestaurantSchema = z.object({
  tripId: z.number(),
  name: z.string().min(1, "Restaurant name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  country: z.string().min(1, "Country is required"),
  reservationDate: z.union([z.date(), z.string()]),
  reservationTime: z.string().min(1, "Reservation time is required"),
  partySize: z.number().min(1),
  cuisineType: z.string().nullable().optional(),
  zipCode: z.string().nullable().optional(),
  latitude: z.union([z.number(), z.string()]).nullable().optional(),
  longitude: z.union([z.number(), z.string()]).nullable().optional(),
  phoneNumber: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  openTableUrl: z.string().nullable().optional(),
  priceRange: z.string().default("$$"),
  rating: z.union([z.number(), z.string()]).nullable().optional(),
  confirmationNumber: z.string().nullable().optional(),
  reservationStatus: z.string().default("pending"),
  specialRequests: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;

export type RestaurantWithDetails = Restaurant & {
  user: User;
  trip: TripCalendar;
};

export interface TravelTip {
  id: number;
  content: string;
  category: string;
  destination: string | null;
  applicableRegions: JsonValue;
  activityCategories: JsonValue;
  seasonality: JsonValue;
  priority: number;
  tags: JsonValue;
  isActive: boolean;
  createdBy: string | null;
  source: string | null;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertTravelTipSchema = z.object({
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  destination: z.string().nullable().optional(),
  applicableRegions: z.any().nullable().optional(),
  activityCategories: z.any().nullable().optional(),
  seasonality: z.any().nullable().optional(),
  priority: z.number().default(3),
  tags: z.any().nullable().optional(),
  isActive: z.boolean().default(true),
  createdBy: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
});

export type InsertTravelTip = z.infer<typeof insertTravelTipSchema>;

export type TravelTipWithDetails = TravelTip & {
  creator?: User;
};

export interface UserTipPreferences {
  id: number;
  userId: string;
  preferredCategories: JsonValue;
  dismissedTips: JsonValue;
  preferredLanguage: string | null;
  showSeasonalTips: boolean;
  showLocationTips: boolean;
  showActivityTips: boolean;
  tipFrequency: string;
  createdAt: IsoDate | null;
  updatedAt: IsoDate | null;
}

export const insertUserTipPreferencesSchema = z.object({
  userId: z.string().optional(),
  preferredCategories: z.any().nullable().optional(),
  dismissedTips: z.any().nullable().optional(),
  preferredLanguage: z.string().nullable().optional(),
  showSeasonalTips: z.boolean().default(true),
  showLocationTips: z.boolean().default(true),
  showActivityTips: z.boolean().default(true),
  tipFrequency: z.string().default("normal"),
});

export type InsertUserTipPreferences = z.infer<
  typeof insertUserTipPreferencesSchema
>;

export type UserTipPreferencesWithUser = UserTipPreferences & {
  user: User;
};
