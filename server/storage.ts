import { pool, query } from "./db";
import type { PoolClient } from "pg";
import { buildCoverPhotoPublicUrlFromStorageKey } from "./coverPhotoShared";
import {
  computeSplits,
  minorUnitsToAmount,
} from "@shared/expenses";
import {
  type User,
  type UpsertUser,
  type TripCalendar,
  type InsertTripCalendar,
  type TripMember,
  type Activity,
  type ActivityType,
  type ActivityInvite,
  type ActivityInviteStatus,
  type ActivityAcceptance,
  type InsertActivity,
  type ActivityWithDetails,
  type TripWithDetails,
  type ActivityComment,
  type InsertActivityComment,
  type PackingItem,
  type InsertPackingItem,
  type Expense,
  type InsertExpense,
  type ExpenseShare,
  type InsertExpenseShare,
  type ExpenseWithDetails,
  type Notification,
  type InsertNotification,
  type GroceryItem,
  type InsertGroceryItem,
  type GroceryNotes,
  type GroceryItemWithDetails,
  type GroceryItemParticipant,
  type InsertGroceryItemParticipant,
  type GroceryReceipt,
  type InsertGroceryReceipt,
  type GroceryReceiptWithDetails,
  type Flight,
  type InsertFlight,
  type FlightWithDetails,
  type Hotel,
  type InsertHotel,
  type HotelWithDetails,
  type Restaurant,
  type InsertRestaurant,
  type RestaurantWithDetails,
  type HotelProposal,
  type InsertHotelProposal,
  type HotelRanking,
  type InsertHotelRanking,
  type HotelProposalWithDetails,
  type FlightProposal,
  type InsertFlightProposal,
  type FlightRanking,
  type InsertFlightRanking,
  type FlightProposalWithDetails,
  type RestaurantProposal,
  type InsertRestaurantProposal,
  type RestaurantRanking,
  type InsertRestaurantRanking,
  type RestaurantProposalWithDetails,
  type TravelTip,
  type InsertTravelTip,
  type TravelTipWithDetails,
  type UserTipPreferences,
  type InsertUserTipPreferences,
  type WishListIdea,
  type InsertWishListIdea,
  type WishListIdeaWithDetails,
  type WishListComment,
  type InsertWishListComment,
  type WishListCommentWithUser,
  type WishListProposalDraft,
  type InsertWishListProposalDraft,
  type WishListProposalDraftWithDetails,
} from "@shared/schema";

type CreateExpensePayload = {
  tripId: number;
  paidBy?: string;
  description: string;
  category: string;
  sourceAmountMinorUnits: number;
  sourceCurrency: string;
  targetCurrency: string;
  exchangeRate: number;
  exchangeRateLockedAt?: string | Date | null;
  exchangeRateProvider?: string | null;
  participantUserIds?: string[];
  receiptUrl?: string | null;
};

const toNumber = (value: string | number): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric value received from database: ${value}`);
  }
  return parsed;
};

const toNumberOrNull = (
  value: string | number | null | undefined,
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }
  return toNumber(value);
};

const camelToSnakeCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1_$2")
    .toLowerCase();

const toStringArray = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return toStringArray(parsed);
    } catch {
      const trimmed = value.trim();
      return trimmed ? [trimmed] : [];
    }
  }

  if (typeof value === "object") {
    const maybeArray = Object.values(value ?? {});
    return maybeArray
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
};

const normalizeUserId = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const toCandidateString = (): string => {
    if (typeof value === "string") {
      return value.trim();
    }

    return String(value).trim();
  };

  let candidate = toCandidateString();
  if (candidate.length === 0) {
    return null;
  }

  if (
    (candidate.startsWith("\"") && candidate.endsWith("\"")) ||
    (candidate.startsWith("'") && candidate.endsWith("'"))
  ) {
    candidate = candidate.slice(1, -1).trim();
  }

  if (candidate.length === 0) {
    return null;
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate)) {
    return candidate.toLowerCase();
  }

  return candidate;
};

const toOptionalString = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return typeof value === "string" ? value : String(value);
};

const safeNumberOrNull = (
  value: string | number | null | undefined,
): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toDateOnlyIso = (value: Date | string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

const parseTimeStringToMinutes = (value: string | null | undefined): number | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i);
  if (!match) {
    return null;
  }

  let hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const period = match[3]?.toLowerCase();
  if (period === "am") {
    if (hours === 12) {
      hours = 0;
    }
  } else if (period === "pm") {
    if (hours !== 12) {
      hours += 12;
    }
  }

  // Accept 24-hour times like 19:30 where no period is provided
  if (period === undefined && hours >= 24) {
    return null;
  }

  return hours * 60 + minutes;
};

const inferRestaurantMealTime = (value: string | null | undefined): string | null => {
  const minutes = parseTimeStringToMinutes(value);
  if (minutes === null) {
    return null;
  }

  if (minutes >= 300 && minutes < 660) {
    return "breakfast";
  }

  if (minutes >= 660 && minutes < 900) {
    return "lunch";
  }

  if (minutes >= 900 && minutes < 1320) {
    return "dinner";
  }

  return "drinks";
};

const parseAverageRanking = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
};

const toIsoString = (value: Date | string | null | undefined): string => {
  if (!value) {
    return "";
  }

  return value instanceof Date ? value.toISOString() : value;
};

const toInviteStatus = (value: unknown): ActivityInviteStatus => {
  if (
    value === "accepted" ||
    value === "declined" ||
    value === "pending" ||
    value === "waitlisted"
  ) {
    return value;
  }

  return "pending";
};

const toActivityType = (value: unknown): ActivityType => {
  if (value === "PROPOSE") {
    return "PROPOSE";
  }

  return "SCHEDULED";
};

export class ActivityInviteMembershipError extends Error {
  readonly invalidInviteeIds: string[];

  readonly attemptedInviteeIds: string[];

  constructor({
    invalidInviteeIds,
    attemptedInviteeIds,
  }: {
    invalidInviteeIds: string[];
    attemptedInviteeIds: string[];
  }) {
    super("One or more invitees are no longer members of this trip.");
    this.name = "ActivityInviteMembershipError";
    this.invalidInviteeIds = invalidInviteeIds;
    this.attemptedInviteeIds = attemptedInviteeIds;
    Object.setPrototypeOf(this, ActivityInviteMembershipError.prototype);
  }
}

export class ActivityDuplicateError extends Error {
  readonly existingActivityId: number;

  readonly tripCalendarId: number;

  readonly activityName: string;

  readonly startTime: string;

  readonly type: ActivityType;

  constructor({
    existingActivityId,
    tripCalendarId,
    name,
    startTime,
    type,
  }: {
    existingActivityId: number;
    tripCalendarId: number;
    name: string;
    startTime: string;
    type: ActivityType;
  }) {
    super("A matching activity already exists for this trip.");
    this.name = "ActivityDuplicateError";
    this.existingActivityId = existingActivityId;
    this.tripCalendarId = tripCalendarId;
    this.activityName = name;
    this.startTime = startTime;
    this.type = type;
    Object.setPrototypeOf(this, ActivityDuplicateError.prototype);
  }
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  // … all the rest unchanged …
}

// DB row type (snake_case)
type UserRow = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;
  password_hash: string;
  auth_provider: string;
  created_at: Date;
  updated_at: Date;
};

// Mapper: snake_case → camelCase (still useful for upsertUser)
const mapUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  username: row.username ?? null,
  firstName: row.first_name ?? null,
  lastName: row.last_name ?? null,
  phoneNumber: row.phone_number ?? null,
  passwordHash: row.password_hash ?? null,
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
  authProvider: row.auth_provider ?? null,
  notificationPreferences: null,
  hasSeenHomeOnboarding: false,
  hasSeenTripOnboarding: false,
  createdAt: row.created_at ?? null,
  updatedAt: row.updated_at ?? null,
});

type UserDetailsRow = {
  id: string;
  email: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  phone_number: string | null;
  password_hash: string | null;
  profile_image_url: string | null;
  cashapp_username: string | null;
  cash_app_username: string | null | undefined;
  cashapp_phone: string | null | undefined;
  cash_app_phone: string | null;
  venmo_username: string | null;
  venmo_phone: string | null;
  timezone: string | null;
  default_location: string | null;
  default_location_code: string | null;
  default_city: string | null;
  default_country: string | null;
  auth_provider: string | null;
  notification_preferences: Record<string, unknown> | null;
  has_seen_home_onboarding: boolean;
  has_seen_trip_onboarding: boolean;
  created_at: Date | null;
  updated_at: Date | null;
};

type PrefixedUserRow<P extends string> = {
  [K in keyof UserDetailsRow as `${P}${K & string}`]: UserDetailsRow[K];
};

type TripRow = {
  id: number;
  name: string;
  destination: string;
  start_date: Date;
  end_date: Date;
  share_code: string;
  created_by: string;
  created_at: Date | null;
  geoname_id: string | number | null;
  city_name: string | null;
  country_name: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  population: string | number | null;
  cover_photo_url: string | null;
  cover_photo_card_url: string | null;
  cover_photo_thumb_url: string | null;
  cover_photo_alt: string | null;
  cover_photo_attribution: string | null;
  cover_photo_storage_key: string | null;
  cover_photo_original_url: string | null;
  cover_photo_focal_x: string | number | null;
  cover_photo_focal_y: string | number | null;
};

type TripMemberRow = {
  id: number;
  trip_calendar_id: number;
  user_id: string;
  role: string;
  departure_location: string | null;
  departure_airport: string | null;
  joined_at: Date | null;
};

type TripMemberWithUserRow = TripMemberRow & PrefixedUserRow<"user_">;

type TripWithCreatorRow = TripRow & PrefixedUserRow<"creator_">;

type ActivityRow = {
  id: number;
  trip_calendar_id: number;
  posted_by: string;
  name: string;
  description: string | null;
  start_time: Date;
  end_time: Date | null;
  location: string | null;
  cost: string | null;
  max_capacity: number | null;
  category: string;
  status: string;
  type: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type ActivityWithPosterRow = ActivityRow & PrefixedUserRow<"poster_">;

type ActivityInviteRow = {
  id: number;
  activity_id: number;
  user_id: string;
  status: string;
  responded_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type ActivityInviteWithUserRow = ActivityInviteRow & PrefixedUserRow<"user_">;

type ActivityAcceptanceWithUserRow = {
  id: number;
  activity_id: number;
  acceptance_user_id: string;
  accepted_at: Date | null;
} & PrefixedUserRow<"user_">;

type ActivityCommentRow = {
  id: number;
  activity_id: number;
  user_id: string;
  comment: string;
  created_at: Date | null;
};

type ActivityCommentWithUserRow = {
  id: number;
  activity_id: number;
  comment_user_id: string;
  comment: string;
  created_at: Date | null;
} & PrefixedUserRow<"user_">;

type PackingItemRow = {
  id: number;
  trip_id: number;
  user_id: string;
  item: string;
  category: string | null;
  item_type: "personal" | "group";
  is_checked: boolean;
  assigned_user_id: string | null;
  created_at: Date | null;
};

type PackingItemWithUserRow = {
  id: number;
  trip_id: number;
  item_user_id: string;
  item: string;
  category: string | null;
  item_type: "personal" | "group";
  is_checked: boolean;
  assigned_user_id: string | null;
  created_at: Date | null;
} & PrefixedUserRow<"user_">;

type PackingItemWithStatusRow = PackingItemWithUserRow & {
  current_user_is_checked: boolean;
  group_checked_count: number;
  trip_member_count: number;
};

type ExpenseRow = {
  id: number;
  trip_id: number;
  paid_by: string;
  amount: string;
  currency: string;
  exchange_rate: string | null;
  original_currency: string | null;
  converted_amounts: Record<string, unknown> | null;
  description: string;
  category: string;
  activity_id: number | null;
  split_type: "equal" | "percentage" | "exact";
  split_data: Record<string, unknown> | null;
  receipt_url: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type ExpenseWithPaidByRow = ExpenseRow & PrefixedUserRow<"paid_by_">;

type ExpenseShareRow = {
  id: number;
  expense_id: number;
  user_id: string;
  amount: string;
  is_paid: boolean;
  paid_at: Date | null;
  created_at: Date | null;
};

type ExpenseShareWithUserRow = {
  id: number;
  expense_id: number;
  share_participant_id: string;
  amount: string;
  is_paid: boolean;
  paid_at: Date | null;
  created_at: Date | null;
} & PrefixedUserRow<"share_user_">;

type ExpenseShareWithContextRow = ExpenseShareWithUserRow & {
  original_currency: string | null;
  currency: string;
  converted_amounts: Record<string, unknown> | null;
  split_data: Record<string, unknown> | null;
};

type ExpenseShareBreakdown = {
  userId: string;
  sourceMinorUnits?: number | null;
  targetMinorUnits?: number | null;
};

type ExpenseConversionMetadata = {
  source?: { currency?: string | null; minorUnits?: number | null };
  target?: { currency?: string | null; minorUnits?: number | null };
  rate?: { value?: number | null; lockedAt?: string | null; provider?: string | null };
};

type NotificationRow = {
  id: number;
  user_id: string;
  type: string;
  title: string;
  message: string;
  trip_id: number | null;
  activity_id: number | null;
  expense_id: number | null;
  is_read: boolean;
  created_at: Date | null;
};

type NotificationWithDetailsRow = NotificationRow & {
  joined_trip_id: number | null;
  trip_name: string | null;
  trip_destination: string | null;
  trip_start_date: Date | null;
  trip_end_date: Date | null;
  trip_share_code: string | null;
  trip_created_by: string | null;
  trip_created_at: Date | null;
  joined_activity_id: number | null;
  activity_trip_calendar_id: number | null;
  activity_posted_by: string | null;
  activity_name: string | null;
  activity_description: string | null;
  activity_start_time: Date | null;
  activity_end_time: Date | null;
  activity_location: string | null;
  activity_cost: string | null;
  activity_max_capacity: number | null;
  activity_category: string | null;
  activity_status: string | null;
  activity_type: string | null;
  activity_created_at: Date | null;
  activity_updated_at: Date | null;
  joined_expense_id: number | null;
  expense_trip_id: number | null;
  expense_paid_by: string | null;
  expense_amount: string | null;
  expense_currency: string | null;
  expense_exchange_rate: string | null;
  expense_original_currency: string | null;
  expense_converted_amounts: Record<string, unknown> | null;
  expense_description: string | null;
  expense_category: string | null;
  expense_activity_id: number | null;
  expense_split_type: "equal" | "percentage" | "exact" | null;
  expense_split_data: Record<string, unknown> | null;
  expense_receipt_url: string | null;
  expense_created_at: Date | null;
  expense_updated_at: Date | null;
};

type GroceryItemRow = {
  id: number;
  trip_id: number;
  added_by: string;
  item: string;
  category: string;
  quantity: string | null;
  estimated_cost: string | null;
  notes: string | null;
  is_purchased: boolean;
  actual_cost: string | null;
  receipt_line_item: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type GroceryItemWithAddedByRow = GroceryItemRow & PrefixedUserRow<"added_by_">;

type GroceryItemParticipantRow = {
  id: number;
  grocery_item_id: number;
  user_id: string;
  will_consume: boolean;
  created_at: Date | null;
};

type GroceryItemParticipantWithUserRow = GroceryItemParticipantRow &
  PrefixedUserRow<"participant_user_">;

type GroceryReceiptRow = {
  id: number;
  trip_id: number;
  uploaded_by: string;
  receipt_image_url: string | null;
  store_name: string | null;
  total_amount: string;
  purchase_date: Date;
  parsed_items: Record<string, unknown> | null;
  is_processed: boolean;
  created_at: Date | null;
};

type GroceryReceiptWithUploaderRow = GroceryReceiptRow &
  PrefixedUserRow<"uploaded_by_">;

type FlightRow = {
  id: number;
  trip_id: number;
  user_id: string;
  flight_number: string;
  airline: string;
  airline_code: string;
  departure_airport: string;
  departure_code: string;
  departure_time: Date;
  departure_terminal: string | null;
  departure_gate: string | null;
  arrival_airport: string;
  arrival_code: string;
  arrival_time: Date;
  arrival_terminal: string | null;
  arrival_gate: string | null;
  booking_reference: string | null;
  seat_number: string | null;
  seat_class: string | null;
  price: string | null;
  currency: string;
  flight_type: string;
  status: string;
  layovers: Record<string, unknown> | null;
  booking_source: string | null;
  purchase_url: string | null;
  aircraft: string | null;
  flight_duration: number | null;
  baggage: Record<string, unknown> | null;
  linked_proposal_id?: number | null;
  linked_proposal_status?: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type FlightWithDetailsRow = FlightRow &
  PrefixedUserRow<"user_"> & {
    trip_name: string;
    trip_destination: string;
    trip_start_date: Date;
    trip_end_date: Date;
    trip_share_code: string;
    trip_created_by: string;
    trip_created_at: Date | null;
  };

type HotelRow = {
  id: number;
  trip_id: number;
  user_id: string;
  hotel_name: string;
  hotel_chain: string | null;
  hotel_rating: number | string | null;
  address: string;
  city: string;
  country: string;
  zip_code: string | null;
  latitude: string | null;
  longitude: string | null;
  check_in_date: Date;
  check_out_date: Date;
  room_type: string | null;
  room_count: number | null;
  guest_count: number | null;
  booking_reference: string | null;
  total_price: string | null;
  price_per_night: string | null;
  currency: string;
  status: string;
  booking_source: string | null;
  purchase_url: string | null;
  amenities: Record<string, unknown> | null;
  images: Record<string, unknown> | null;
  policies: Record<string, unknown> | null;
  contact_info: Record<string, unknown> | null;
  booking_platform: string | null;
  booking_url: string | null;
  cancellation_policy: string | null;
  notes: string | null;
  linked_proposal_id?: number | null;
  linked_proposal_status?: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type HotelWithDetailsRow = HotelRow &
  PrefixedUserRow<"user_"> & {
    trip_name: string;
    trip_destination: string;
    trip_start_date: Date;
    trip_end_date: Date;
    trip_share_code: string;
    trip_created_by: string;
    trip_created_at: Date | null;
  };

type RestaurantRow = {
  id: number;
  trip_id: number;
  user_id: string;
  name: string;
  cuisine_type: string | null;
  address: string;
  city: string;
  country: string;
  zip_code: string | null;
  latitude: string | null;
  longitude: string | null;
  phone_number: string | null;
  website: string | null;
  open_table_url: string | null;
  price_range: string;
  rating: string | null;
  reservation_date: Date;
  reservation_time: string;
  party_size: number;
  confirmation_number: string | null;
  reservation_status: string;
  special_requests: string | null;
  notes: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type RestaurantWithDetailsRow = RestaurantRow &
  PrefixedUserRow<"user_"> & {
    trip_name: string;
    trip_destination: string;
    trip_start_date: Date;
    trip_end_date: Date;
    trip_share_code: string;
    trip_created_by: string;
    trip_created_at: Date | null;
  };

type HotelProposalRow = {
  id: number;
  trip_id: number;
  proposed_by: string;
  hotel_name: string;
  location: string;
  price: string;
  price_per_night: string | number | null;
  rating: string | number | null;
  amenities: string | null;
  platform: string;
  booking_url: string;
  status: string;
  average_ranking: string | number | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type HotelProposalWithProposerRow = HotelProposalRow &
  PrefixedUserRow<"proposer_"> & {
    linked_hotel_id: number | null;
    linked_check_in_date: Date | null;
    linked_check_out_date: Date | null;
    linked_address: string | null;
    linked_city: string | null;
    linked_country: string | null;
    linked_currency: string | null;
  };

type HotelRankingRow = {
  id: number;
  proposal_id: number;
  user_id: string;
  ranking: number | string;
  notes: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type HotelRankingWithUserRow = HotelRankingRow & PrefixedUserRow<"user_">;

type FlightProposalRow = {
  id: number;
  trip_id: number;
  proposed_by: string;
  airline: string;
  flight_number: string;
  departure_airport: string;
  departure_time: Date | string;
  departure_terminal: string | null;
  arrival_airport: string;
  arrival_time: Date | string;
  arrival_terminal: string | null;
  duration: string;
  stops: number | string;
  aircraft: string | null;
  price: string | number | null;
  currency: string;
  booking_url: string;
  platform: string;
  status: string;
  average_ranking: string | number | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type FlightProposalWithProposerRow = FlightProposalRow & PrefixedUserRow<"proposer_">;

type FlightRankingRow = {
  id: number;
  proposal_id: number;
  user_id: string;
  ranking: number | string;
  notes: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type FlightRankingWithUserRow = FlightRankingRow & PrefixedUserRow<"user_">;

type RestaurantProposalRow = {
  id: number;
  trip_id: number;
  proposed_by: string;
  restaurant_name: string;
  address: string;
  cuisine_type: string | null;
  price_range: string | null;
  rating: string | number | null;
  phone_number: string | null;
  website: string | null;
  reservation_url: string | null;
  platform: string;
  atmosphere: string | null;
  specialties: string | null;
  dietary_options: unknown;
  preferred_meal_time: string | null;
  preferred_dates: unknown;
  features: unknown;
  status: string;
  average_ranking: string | number | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type RestaurantProposalWithProposerRow = RestaurantProposalRow & PrefixedUserRow<"proposer_">;

type RestaurantRankingRow = {
  id: number;
  proposal_id: number;
  user_id: string;
  ranking: number | string;
  notes: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type RestaurantRankingWithUserRow = RestaurantRankingRow & PrefixedUserRow<"user_">;

type ProposalScheduleLinkRow = {
  id: number;
  proposal_type: string;
  proposal_id: number;
  scheduled_table: string;
  scheduled_id: number;
  trip_id: number | null;
  created_at: Date | null;
};

type TravelTipRow = {
  id: number;
  content: string;
  category: string;
  destination: string | null;
  applicable_regions: unknown;
  activity_categories: unknown;
  seasonality: unknown;
  priority: number;
  tags: unknown;
  is_active: boolean;
  created_by: string | null;
  source: string | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type TravelTipWithDetailsRow = TravelTipRow &
  Partial<PrefixedUserRow<"creator_">>;

type UserTipPreferencesRow = {
  id: number;
  user_id: string;
  preferred_categories: unknown;
  dismissed_tips: unknown;
  preferred_language: string | null;
  show_seasonal_tips: boolean;
  show_location_tips: boolean;
  show_activity_tips: boolean;
  tip_frequency: string;
  created_at: Date | null;
  updated_at: Date | null;
};

type InsertTravelTipInput = Omit<InsertTravelTip, "isActive"> & {
  isActive?: boolean;
};

type WishListIdeaRow = {
  id: number;
  trip_id: number;
  title: string;
  url: string | null;
  notes: string | null;
  tags: unknown;
  thumbnail_url: string | null;
  image_url: string | null;
  metadata: unknown;
  created_by: string;
  promoted_draft_id: number | null;
  created_at: Date | null;
  updated_at: Date | null;
};

type WishListIdeaWithCountsRow = WishListIdeaRow &
  PrefixedUserRow<"creator_"> & {
    save_count: string | null;
    saved_by_user: boolean;
    comment_count: string | null;
  };

type WishListCommentRow = {
  id: number;
  item_id: number;
  user_id: string;
  comment: string;
  created_at: Date | null;
};

type WishListCommentWithUserRow = WishListCommentRow &
  PrefixedUserRow<"user_">;

type WishListProposalDraftRow = {
  id: number;
  trip_id: number;
  item_id: number;
  created_by: string;
  title: string;
  url: string | null;
  notes: string | null;
  tags: unknown;
  status: string;
  created_at: Date | null;
  updated_at: Date | null;
};

type WishListProposalDraftWithCreatorRow = WishListProposalDraftRow &
  PrefixedUserRow<"creator_">;

const mapUserFromPrefix = (
  row: Record<string, unknown>,
  prefix: string,
): User => {
  const cashAppUsernameLegacy =
    (row[`${prefix}cashapp_username`] as string | null | undefined) ?? null;
  const cashAppUsername =
    (row[`${prefix}cash_app_username`] as string | null | undefined) ??
    cashAppUsernameLegacy;
  const cashAppPhoneLegacy =
    (row[`${prefix}cashapp_phone`] as string | null | undefined) ?? null;
  const cashAppPhone =
    (row[`${prefix}cash_app_phone`] as string | null | undefined) ??
    cashAppPhoneLegacy;

  return {
    id: (row[`${prefix}id`] as string) ?? "",
    email: (row[`${prefix}email`] as string) ?? "",
    username: (row[`${prefix}username`] as string | null) ?? null,
    firstName: (row[`${prefix}first_name`] as string | null) ?? null,
    lastName: (row[`${prefix}last_name`] as string | null) ?? null,
    phoneNumber: (row[`${prefix}phone_number`] as string | null) ?? null,
    passwordHash: (row[`${prefix}password_hash`] as string | null) ?? null,
    profileImageUrl: (row[`${prefix}profile_image_url`] as string | null) ?? null,
    cashAppUsername,
    cashAppUsernameLegacy,
    cashAppPhone,
    cashAppPhoneLegacy,
    venmoUsername: (row[`${prefix}venmo_username`] as string | null) ?? null,
    venmoPhone: (row[`${prefix}venmo_phone`] as string | null) ?? null,
    timezone: (row[`${prefix}timezone`] as string | null) ?? null,
    defaultLocation: (row[`${prefix}default_location`] as string | null) ?? null,
    defaultLocationCode: (row[`${prefix}default_location_code`] as string | null) ?? null,
    defaultCity: (row[`${prefix}default_city`] as string | null) ?? null,
    defaultCountry: (row[`${prefix}default_country`] as string | null) ?? null,
    authProvider: (row[`${prefix}auth_provider`] as string | null) ?? null,
    notificationPreferences:
      (row[`${prefix}notification_preferences`] as User["notificationPreferences"]) ??
      null,
    hasSeenHomeOnboarding: Boolean(row[`${prefix}has_seen_home_onboarding`]),
    hasSeenTripOnboarding: Boolean(row[`${prefix}has_seen_trip_onboarding`]),
    createdAt: (row[`${prefix}created_at`] as Date | null) ?? null,
    updatedAt: (row[`${prefix}updated_at`] as Date | null) ?? null,
  };
};

const createFallbackUser = (userId: string | null | undefined): User => ({
  id: userId ?? "",
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
  createdAt: null,
  updatedAt: null,
});

const selectUserColumns = (alias: string, prefix: string) => `
        ${alias}.id AS ${prefix}id,
        ${alias}.email AS ${prefix}email,
        ${alias}.username AS ${prefix}username,
        ${alias}.first_name AS ${prefix}first_name,
        ${alias}.last_name AS ${prefix}last_name,
        ${alias}.phone_number AS ${prefix}phone_number,
        ${alias}.password_hash AS ${prefix}password_hash,
        ${alias}.profile_image_url AS ${prefix}profile_image_url,
        ${alias}.cashapp_username AS ${prefix}cashapp_username,
        ${alias}.cash_app_username AS ${prefix}cash_app_username,
        ${alias}.cashapp_phone AS ${prefix}cashapp_phone,
        ${alias}.cash_app_phone AS ${prefix}cash_app_phone,
        ${alias}.venmo_username AS ${prefix}venmo_username,
        ${alias}.venmo_phone AS ${prefix}venmo_phone,
        ${alias}.timezone AS ${prefix}timezone,
        ${alias}.default_location AS ${prefix}default_location,
        ${alias}.default_location_code AS ${prefix}default_location_code,
        ${alias}.default_city AS ${prefix}default_city,
        ${alias}.default_country AS ${prefix}default_country,
        ${alias}.auth_provider AS ${prefix}auth_provider,
        ${alias}.notification_preferences AS ${prefix}notification_preferences,
        ${alias}.has_seen_home_onboarding AS ${prefix}has_seen_home_onboarding,
        ${alias}.has_seen_trip_onboarding AS ${prefix}has_seen_trip_onboarding,
        ${alias}.created_at AS ${prefix}created_at,
        ${alias}.updated_at AS ${prefix}updated_at`;

const sanitizeNullableString = (
  value: string | null | undefined,
): string | null => {
  if (typeof value !== "string") {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const mapTrip = (row: TripRow): TripCalendar => {
  const normalizedCoverUrl = sanitizeNullableString(row.cover_photo_url);
  const fallbackCoverPhotoUrl =
    normalizedCoverUrl ??
    buildCoverPhotoPublicUrlFromStorageKey(row.cover_photo_storage_key) ??
    null;

  const coverPhotoOriginalUrl =
    sanitizeNullableString(row.cover_photo_original_url) ??
    fallbackCoverPhotoUrl ??
    null;

  return {
    id: row.id,
    name: row.name,
    destination: row.destination,
    startDate: row.start_date,
    endDate: row.end_date,
    shareCode: row.share_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    geonameId: toNumberOrNull(row.geoname_id),
    cityName: row.city_name,
    countryName: row.country_name,
    latitude: toNumberOrNull(row.latitude),
    longitude: toNumberOrNull(row.longitude),
    population: toNumberOrNull(row.population),
    coverImageUrl: fallbackCoverPhotoUrl,
    coverPhotoUrl: fallbackCoverPhotoUrl,
    coverPhotoCardUrl: sanitizeNullableString(row.cover_photo_card_url),
    coverPhotoThumbUrl: sanitizeNullableString(row.cover_photo_thumb_url),
    coverPhotoAlt: sanitizeNullableString(row.cover_photo_alt),
    coverPhotoAttribution: sanitizeNullableString(row.cover_photo_attribution),
    coverPhotoStorageKey: sanitizeNullableString(row.cover_photo_storage_key),
    coverPhotoOriginalUrl,
    coverPhotoFocalX: safeNumberOrNull(row.cover_photo_focal_x),
    coverPhotoFocalY: safeNumberOrNull(row.cover_photo_focal_y),
    coverPhotoUploadSize: null,
    coverPhotoUploadType: null,
  };
};

const mapTripMember = (row: TripMemberRow): TripMember => ({
  id: row.id,
  tripCalendarId: row.trip_calendar_id,
  userId: row.user_id,
  role: row.role,
  departureLocation: row.departure_location,
  departureAirport: row.departure_airport,
  joinedAt: row.joined_at,
});

const mapTripMemberWithUser = (
  row: TripMemberWithUserRow,
): (TripMember & { user: User }) => ({
  ...mapTripMember(row),
  user: mapUserFromPrefix(row, "user_"),
});

const mapTripWithDetails = (
  row: TripRow,
  creator: User,
  members: (TripMember & { user: User })[],
): TripWithDetails => ({
  ...mapTrip(row),
  creator,
  members,
  memberCount: members.length,
});

const mapHotelProposal = (row: HotelProposalRow): HotelProposal => {
  const linkedHotelId = (row as { linked_hotel_id?: number | null }).linked_hotel_id ?? null;
  const linkedCheckInDate =
    (row as { linked_check_in_date?: Date | null }).linked_check_in_date ?? null;
  const linkedCheckOutDate =
    (row as { linked_check_out_date?: Date | null }).linked_check_out_date ?? null;
  const linkedAddress = toOptionalString(
    (row as { linked_address?: string | null }).linked_address,
  );
  const linkedCity = toOptionalString((row as { linked_city?: string | null }).linked_city);
  const linkedCountry = toOptionalString(
    (row as { linked_country?: string | null }).linked_country,
  );
  const linkedCurrency = toOptionalString(
    (row as { linked_currency?: string | null }).linked_currency,
  );

  const baseLocation = toOptionalString(row.location);
  const fallbackLocationSegments = [linkedCity, linkedCountry].filter(
    (segment): segment is string => Boolean(segment && segment.trim()),
  );
  const resolvedLocation =
    baseLocation && baseLocation.trim().length > 0
      ? baseLocation
      : fallbackLocationSegments.length > 0
        ? fallbackLocationSegments.join(", ")
        : "Unknown location";

  return {
    id: row.id,
    tripId: row.trip_id,
    proposedBy: row.proposed_by,
    hotelName: row.hotel_name,
    location: resolvedLocation,
    price: toOptionalString(row.price) ?? "0",
    pricePerNight: toOptionalString(row.price_per_night),
    rating: safeNumberOrNull(row.rating),
    amenities: row.amenities,
    platform: row.platform,
    bookingUrl: row.booking_url,
    status: row.status,
    averageRanking: parseAverageRanking(row.average_ranking),
    createdAt: row.created_at,
    stayId: linkedHotelId,
    checkInDate: linkedCheckInDate,
    checkOutDate: linkedCheckOutDate,
    address: linkedAddress,
    city: linkedCity,
    country: linkedCountry,
    currency: linkedCurrency,
  };
};

const mapHotelRankingWithUser = (
  row: HotelRankingWithUserRow,
): (HotelRanking & { user: User }) => ({
  id: row.id,
  proposalId: row.proposal_id,
  userId: row.user_id,
  ranking: Number(row.ranking),
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  user: mapUserFromPrefix(row, "user_"),
});

const mapHotelProposalWithDetails = (
  row: HotelProposalWithProposerRow,
  rankings: (HotelRanking & { user: User })[],
  currentUserId?: string,
): HotelProposalWithDetails => {
  const proposerId = normalizeUserId(row.proposed_by);
  const viewerId = normalizeUserId(currentUserId);
  const hasProposerDetails =
    row.proposer_id != null && String(row.proposer_id).trim().length > 0;
  const proposer = hasProposerDetails
    ? mapUserFromPrefix(row, "proposer_")
    : createFallbackUser(row.proposed_by);

  return {
    ...mapHotelProposal(row),
    proposer,
    rankings,
    currentUserRanking:
      currentUserId != null
        ? rankings.find((ranking) => ranking.userId === currentUserId)
        : undefined,
    permissions: {
      canCancel: Boolean(proposerId && viewerId && proposerId === viewerId),
    },
  };
};

const mapFlightProposal = (row: FlightProposalRow): FlightProposal => {
  const linkedFlightId = (row as { linked_flight_id?: number | null }).linked_flight_id ?? null;
  const linkedDepartureCode = toOptionalString(
    (row as { linked_departure_code?: string | null }).linked_departure_code,
  );
  const linkedArrivalCode = toOptionalString(
    (row as { linked_arrival_code?: string | null }).linked_arrival_code,
  );
  const linkedDepartureGate = toOptionalString(
    (row as { linked_departure_gate?: string | null }).linked_departure_gate,
  );
  const linkedArrivalGate = toOptionalString(
    (row as { linked_arrival_gate?: string | null }).linked_arrival_gate,
  );
  const linkedSeatClass = toOptionalString(
    (row as { linked_seat_class?: string | null }).linked_seat_class,
  );
  const linkedSeatNumber = toOptionalString(
    (row as { linked_seat_number?: string | null }).linked_seat_number,
  );
  const linkedBookingSource = toOptionalString(
    (row as { linked_booking_source?: string | null }).linked_booking_source,
  );
  const linkedPurchaseUrl = toOptionalString(
    (row as { linked_purchase_url?: string | null }).linked_purchase_url,
  );

  return {
    id: row.id,
    tripId: row.trip_id,
    proposedBy: row.proposed_by,
    airline: row.airline,
    flightNumber: row.flight_number,
    departureAirport: row.departure_airport,
    departureCode: linkedDepartureCode ?? undefined,
    departureTime: toIsoString(row.departure_time),
    departureTerminal: row.departure_terminal,
    departureGate: linkedDepartureGate ?? undefined,
    arrivalAirport: row.arrival_airport,
    arrivalCode: linkedArrivalCode ?? undefined,
    arrivalTime: toIsoString(row.arrival_time),
    arrivalTerminal: row.arrival_terminal,
    arrivalGate: linkedArrivalGate ?? undefined,
    duration: row.duration,
    stops: typeof row.stops === "string" ? Number(row.stops) : Number(row.stops ?? 0),
    aircraft: row.aircraft,
    price: toOptionalString(row.price) ?? "",
    currency: row.currency,
    bookingUrl: row.booking_url,
    platform: row.platform,
    status: row.status,
    averageRanking: parseAverageRanking(row.average_ranking),
    createdAt: row.created_at,
    flightId: linkedFlightId,
    seatClass: linkedSeatClass ?? undefined,
    seatNumber: linkedSeatNumber ?? undefined,
    bookingSource: linkedBookingSource ?? undefined,
    purchaseUrl: linkedPurchaseUrl ?? undefined,
  };
};

const mapFlightRankingWithUser = (
  row: FlightRankingWithUserRow,
): (FlightRanking & { user: User }) => ({
  id: row.id,
  proposalId: row.proposal_id,
  userId: row.user_id,
  ranking: Number(row.ranking),
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  user: mapUserFromPrefix(row, "user_"),
});

const mapFlightProposalWithDetails = (
  row: FlightProposalWithProposerRow,
  rankings: (FlightRanking & { user: User })[],
  currentUserId?: string,
): FlightProposalWithDetails => {
  const proposerId = normalizeUserId(row.proposed_by);
  const viewerId = normalizeUserId(currentUserId);

  return {
    ...mapFlightProposal(row),
    proposer: mapUserFromPrefix(row, "proposer_"),
    rankings,
    currentUserRanking:
      currentUserId != null
        ? rankings.find((ranking) => ranking.userId === currentUserId)
        : undefined,
    permissions: {
      canCancel: Boolean(proposerId && viewerId && proposerId === viewerId),
    },
  };
};

const mapRestaurantProposal = (
  row: RestaurantProposalRow,
): RestaurantProposal => ({
  id: row.id,
  tripId: row.trip_id,
  proposedBy: row.proposed_by,
  restaurantName: row.restaurant_name,
  address: row.address,
  cuisineType: row.cuisine_type,
  priceRange: row.price_range,
  rating: toOptionalString(row.rating),
  phoneNumber: row.phone_number,
  website: row.website,
  reservationUrl: row.reservation_url,
  platform: row.platform,
  atmosphere: row.atmosphere,
  specialties: row.specialties,
  dietaryOptions: row.dietary_options as RestaurantProposal['dietaryOptions'],
  preferredMealTime: row.preferred_meal_time,
  preferredDates: row.preferred_dates as RestaurantProposal['preferredDates'],
  features: row.features as RestaurantProposal['features'],
  status: row.status,
  averageRanking: parseAverageRanking(row.average_ranking),
  createdAt: row.created_at,
});

const mapRestaurantRankingWithUser = (
  row: RestaurantRankingWithUserRow,
): (RestaurantRanking & { user: User }) => ({
  id: row.id,
  proposalId: row.proposal_id,
  userId: row.user_id,
  ranking: Number(row.ranking),
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  user: mapUserFromPrefix(row, "user_"),
});

const mapRestaurantProposalWithDetails = (
  row: RestaurantProposalWithProposerRow,
  rankings: (RestaurantRanking & { user: User })[],
  currentUserId?: string,
): RestaurantProposalWithDetails => {
  const proposerId = normalizeUserId(row.proposed_by);
  const viewerId = normalizeUserId(currentUserId);

  return {
    ...mapRestaurantProposal(row),
    proposer: mapUserFromPrefix(row, "proposer_"),
    rankings,
    currentUserRanking:
      currentUserId != null
        ? rankings.find((ranking) => ranking.userId === currentUserId)
        : undefined,
    permissions: {
      canCancel: Boolean(proposerId && viewerId && proposerId === viewerId),
    },
  };
};

const mapActivity = (row: ActivityRow): Activity => ({
  id: row.id,
  tripCalendarId: row.trip_calendar_id,
  postedBy: row.posted_by,
  name: row.name,
  description: row.description,
  startTime: row.start_time,
  endTime: row.end_time,
  location: row.location,
  cost: toNumberOrNull(row.cost),
  maxCapacity: row.max_capacity,
  category: row.category,
  status: row.status,
  type: toActivityType(row.type),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapActivityInvite = (row: ActivityInviteRow): ActivityInvite => ({
  id: row.id,
  activityId: row.activity_id,
  userId: row.user_id,
  status: toInviteStatus(row.status),
  respondedAt: row.responded_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapActivityWithDetails = (
  row: ActivityRow & {
    poster: User;
    invites: (ActivityInvite & { user: User })[];
    acceptances: (ActivityAcceptance & { user: User })[];
    comments: (ActivityComment & { user: User })[];
    currentUserInvite?: ActivityInvite & { user: User };
    isAccepted?: boolean;
    hasResponded?: boolean;
    currentUserId?: string;
  },
): ActivityWithDetails => {
  const activity = mapActivity(row);
  const proposerId = normalizeUserId(activity.postedBy);
  const viewerId = normalizeUserId(row.currentUserId);
  const invites = Array.isArray(row.invites) ? row.invites : [];
  const acceptances = Array.isArray(row.acceptances) ? row.acceptances : [];
  const comments = Array.isArray(row.comments) ? row.comments : [];
  const currentUserInvite = row.currentUserInvite ?? null;
  const acceptedCount = acceptances.length;
  const pendingCount = invites.filter((invite) => invite.status === "pending").length;
  const declinedCount = invites.filter((invite) => invite.status === "declined").length;
  const waitlistedCount = invites.filter((invite) => invite.status === "waitlisted").length;
  const isAccepted = row.isAccepted ?? undefined;
  const hasResponded = row.hasResponded ?? undefined;

  return {
    ...activity,
    poster: row.poster,
    invites,
    acceptances,
    comments,
    acceptedCount,
    pendingCount,
    declinedCount,
    waitlistedCount,
    currentUserInvite,
    isAccepted,
    hasResponded,
    permissions: {
      canCancel: Boolean(proposerId && viewerId && proposerId === viewerId),
    },
  };
};

const mapComment = (row: any): ActivityComment => ({
  id: row.id,
  activityId: row.activity_id,
  userId: row.user_id ?? row.comment_user_id ?? "",
  comment: row.comment,
  createdAt: row.created_at ?? null,
});

const mapPackingItem = (row: PackingItemRow): PackingItem => ({
  id: row.id,
  tripId: row.trip_id,
  userId: row.user_id,
  item: row.item,
  category: row.category,
  itemType: row.item_type,
  isChecked: row.is_checked,
  assignedUserId: row.assigned_user_id,
  createdAt: row.created_at,
});

const mapPackingItemWithStatus = (
  row: PackingItemWithStatusRow,
): (PackingItem & { user: User }) => {
  const base = mapPackingItem({
    id: row.id,
    trip_id: row.trip_id,
    user_id: row.item_user_id,
    item: row.item,
    category: row.category,
    item_type: row.item_type,
    is_checked: row.is_checked,
    assigned_user_id: row.assigned_user_id,
    created_at: row.created_at,
  });

  const groupStatus =
    base.itemType === "group"
      ? {
          checkedCount: Math.max(Number(row.group_checked_count ?? 0), 0),
          memberCount: Math.max(Number(row.trip_member_count ?? 0), 0),
        }
      : undefined;

  return {
    ...base,
    isChecked:
      base.itemType === "group"
        ? Boolean(row.current_user_is_checked)
        : base.isChecked,
    groupStatus,
    user: mapUserFromPrefix(row, "user_"),
  };
};

const mapExpense = (row: ExpenseRow): Expense => {
  const conversionMetadata = (row.converted_amounts ?? null) as
    | ExpenseConversionMetadata
    | null;

  const sourceMinorUnits = conversionMetadata?.source?.minorUnits ?? null;
  const targetMinorUnits = conversionMetadata?.target?.minorUnits ?? null;
  const sourceCurrency =
    conversionMetadata?.source?.currency ?? row.original_currency ?? null;
  const targetCurrency =
    conversionMetadata?.target?.currency ?? row.currency ?? null;
  const exchangeRateLockedAt = conversionMetadata?.rate?.lockedAt ?? null;
  const exchangeRateProvider = conversionMetadata?.rate?.provider ?? null;
  const exchangeRateValue =
    conversionMetadata?.rate?.value != null
      ? Number(conversionMetadata.rate.value)
      : toNumberOrNull(row.exchange_rate);

  return {
    id: row.id,
    tripId: row.trip_id,
    paidBy: row.paid_by,
    amount: toNumber(row.amount),
    currency: targetCurrency ?? row.currency,
    exchangeRate: exchangeRateValue,
    originalCurrency: sourceCurrency,
    convertedAmounts: conversionMetadata as any,
    targetCurrency,
    sourceAmountMinorUnits:
      typeof sourceMinorUnits === "number" ? sourceMinorUnits : null,
    targetAmountMinorUnits:
      typeof targetMinorUnits === "number" ? targetMinorUnits : null,
    exchangeRateLockedAt,
    exchangeRateProvider,
    description: row.description,
    category: row.category,
    activityId: row.activity_id,
    splitType: row.split_type,
    splitData: (row.split_data ?? null) as any,
    receiptUrl: row.receipt_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapExpenseShare = (
  row: ExpenseShareRow,
  breakdown?: ExpenseShareBreakdown,
  currencies?: { source?: string | null; target?: string | null },
): ExpenseShare => ({
  id: row.id,
  expenseId: row.expense_id,
  userId: row.user_id,
  amount: toNumber(row.amount),
  isPaid: row.is_paid,
  status: row.is_paid ? "paid" : "pending",
  paidAt: row.paid_at,
  createdAt: row.created_at,
  amountSourceMinorUnits:
    breakdown && typeof breakdown.sourceMinorUnits === "number"
      ? breakdown.sourceMinorUnits
      : null,
  amountTargetMinorUnits:
    breakdown && typeof breakdown.targetMinorUnits === "number"
      ? breakdown.targetMinorUnits
      : null,
  sourceCurrency: currencies?.source ?? null,
  targetCurrency: currencies?.target ?? null,
});

const mapExpenseWithDetails = (
  row: ExpenseWithPaidByRow & {
    shares: { row: ExpenseShareRow; user: User }[];
    activity?: Activity;
  },
): ExpenseWithDetails => {
  const baseExpense = mapExpense(row);
  const shareBreakdowns = new Map<string, ExpenseShareBreakdown>();

  const rawSplitData = baseExpense.splitData as
    | { shares?: ExpenseShareBreakdown[] }
    | null;
  if (rawSplitData?.shares && Array.isArray(rawSplitData.shares)) {
    for (const share of rawSplitData.shares) {
      if (!share || typeof share.userId !== "string") {
        continue;
      }
      shareBreakdowns.set(share.userId, share);
    }
  }

  const shares = row.shares.map(({ row: shareRow, user }) => {
    const mappedShare = mapExpenseShare(
      shareRow,
      shareBreakdowns.get(shareRow.user_id) ?? undefined,
      {
        source: baseExpense.originalCurrency,
        target: baseExpense.targetCurrency ?? baseExpense.currency,
      },
    );
    return { ...mappedShare, user };
  });

  return {
    ...baseExpense,
    paidBy: mapUserFromPrefix(row, "paid_by_"),
    activity: row.activity,
    shares,
    totalAmount: baseExpense.amount,
  } as unknown as ExpenseWithDetails;
};

const normalizeGroceryTags = (input: unknown): string[] =>
  Array.isArray(input)
    ? input
        .map((value) =>
          typeof value === "string"
            ? value.trim()
            : value == null
              ? ""
              : String(value).trim(),
        )
        .filter((value) => value.length > 0)
    : [];

const parseGroceryNotes = (raw: string | null): GroceryNotes | null => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const text = typeof (parsed as any).text === "string" ? (parsed as any).text.trim() : "";
      const allergies = normalizeGroceryTags((parsed as any).allergies);
      const exclusions = normalizeGroceryTags((parsed as any).exclusions);
      if (!text && allergies.length === 0 && exclusions.length === 0) {
        return null;
      }
      return {
        ...(text ? { text } : {}),
        ...(allergies.length ? { allergies } : {}),
        ...(exclusions.length ? { exclusions } : {}),
      } as GroceryNotes;
    }
  } catch {
    // ignore malformed JSON and fall back to legacy text
  }

  const legacy = raw.trim();
  return legacy.length > 0 ? legacy : null;
};

const serializeGroceryNotes = (notes: GroceryNotes | null | undefined): string | null => {
  if (notes === null || notes === undefined) return null;
  if (typeof notes === "string") {
    const trimmed = notes.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const text = typeof notes.text === "string" ? notes.text.trim() : "";
  const allergies = normalizeGroceryTags(notes.allergies);
  const exclusions = normalizeGroceryTags(notes.exclusions);

  const payload: Record<string, unknown> = {};
  if (text) payload.text = text;
  if (allergies.length) payload.allergies = allergies;
  if (exclusions.length) payload.exclusions = exclusions;

  return Object.keys(payload).length > 0 ? JSON.stringify(payload) : null;
};

const mapGroceryItem = (row: GroceryItemRow): GroceryItem => ({
  id: row.id,
  tripId: row.trip_id,
  addedBy: row.added_by,
  item: row.item,
  category: row.category,
  quantity: row.quantity,
  estimatedCost: toNumberOrNull(row.estimated_cost),
  notes: parseGroceryNotes(row.notes),
  isPurchased: row.is_purchased,
  actualCost: toNumberOrNull(row.actual_cost),
  receiptLineItem: row.receipt_line_item,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapGroceryItemParticipant = (
  row: GroceryItemParticipantRow,
): GroceryItemParticipant => ({
  id: row.id,
  groceryItemId: row.grocery_item_id,
  userId: row.user_id,
  willConsume: row.will_consume,
  createdAt: row.created_at,
});

const mapGroceryItemWithDetails = (
  row: GroceryItemRow & {
    addedByUser: User;
    participants: (GroceryItemParticipant & { user: User })[];
  },
): GroceryItemWithDetails => {
  const baseItem = mapGroceryItem(row);
  const participants = row.participants ?? [];
  const numericCost = baseItem.actualCost ?? baseItem.estimatedCost;
  const costPerPerson =
    numericCost != null && participants.length > 0
      ? numericCost / participants.length
      : 0;

  return {
    ...baseItem,
    addedBy: row.addedByUser,
    participants,
    participantCount: participants.length,
    costPerPerson: Number.isFinite(costPerPerson) ? costPerPerson : 0,
  } as GroceryItemWithDetails;
};

const mapGroceryReceipt = (row: GroceryReceiptRow): GroceryReceipt => ({
  id: row.id,
  tripId: row.trip_id,
  uploadedBy: row.uploaded_by,
  receiptImageUrl: row.receipt_image_url,
  storeName: row.store_name,
  totalAmount: toNumber(row.total_amount),
  purchaseDate: row.purchase_date,
  parsedItems: (row.parsed_items ?? null) as any,
  isProcessed: row.is_processed,
  createdAt: row.created_at,
});

const mapGroceryReceiptWithDetails = (
  row: GroceryReceiptRow & {
    uploadedByUser: User;
    items: GroceryItemWithDetails[];
  },
): GroceryReceiptWithDetails => {
  const baseReceipt = mapGroceryReceipt(row);

  return {
    ...baseReceipt,
    uploadedBy: row.uploadedByUser,
    items: row.items,
  } as GroceryReceiptWithDetails;
};

const mapNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  title: row.title,
  message: row.message,
  tripId: row.trip_id,
  activityId: row.activity_id,
  expenseId: row.expense_id,
  isRead: row.is_read,
  createdAt: row.created_at,
});

const mapFlight = (row: FlightRow): Flight => ({
  id: row.id,
  tripId: row.trip_id,
  userId: row.user_id,
  flightNumber: row.flight_number,
  airline: row.airline,
  airlineCode: row.airline_code,
  departureAirport: row.departure_airport,
  departureCode: row.departure_code,
  departureTime: row.departure_time,
  departureTerminal: row.departure_terminal,
  departureGate: row.departure_gate,
  arrivalAirport: row.arrival_airport,
  arrivalCode: row.arrival_code,
  arrivalTime: row.arrival_time,
  arrivalTerminal: row.arrival_terminal,
  arrivalGate: row.arrival_gate,
  bookingReference: row.booking_reference,
  seatNumber: row.seat_number,
  seatClass: row.seat_class,
  price: toNumberOrNull(row.price),
  currency: row.currency,
  flightType: row.flight_type,
  status: row.status,
  layovers: (row.layovers ?? null) as any,
  bookingSource: row.booking_source,
  purchaseUrl: row.purchase_url,
  aircraft: row.aircraft,
  flightDuration: row.flight_duration,
  baggage: (row.baggage ?? null) as any,
  proposalId:
    (row as { linked_proposal_id?: number | null }).linked_proposal_id ?? null,
  proposalStatus:
    (row as { linked_proposal_status?: string | null }).linked_proposal_status ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapFlightWithDetails = (row: FlightWithDetailsRow): FlightWithDetails => {
  const tripRow: TripRow = {
    id: row.trip_id,
    name: row.trip_name,
    destination: row.trip_destination,
    start_date: row.trip_start_date,
    end_date: row.trip_end_date,
    share_code: row.trip_share_code,
    created_by: row.trip_created_by,
    created_at: row.trip_created_at,
    geoname_id: null,
    city_name: null,
    country_name: null,
    latitude: null,
    longitude: null,
    population: null,
    cover_photo_url: null,
    cover_photo_card_url: null,
    cover_photo_thumb_url: null,
    cover_photo_alt: null,
    cover_photo_attribution: null,
    cover_photo_storage_key: null,
    cover_photo_original_url: null,
    cover_photo_focal_x: null,
    cover_photo_focal_y: null,
  };

  return {
    ...mapFlight(row),
    user: mapUserFromPrefix(row, "user_"),
    trip: mapTrip(tripRow),
  };
};

const mapHotel = (row: HotelRow): Hotel => ({
  id: row.id,
  tripId: row.trip_id,
  userId: row.user_id,
  hotelName: row.hotel_name,
  hotelChain: row.hotel_chain,
  hotelRating: toNumberOrNull(row.hotel_rating as string | number | null),
  address: row.address,
  city: row.city,
  country: row.country,
  zipCode: row.zip_code,
  latitude: toNumberOrNull(row.latitude),
  longitude: toNumberOrNull(row.longitude),
  checkInDate: row.check_in_date,
  checkOutDate: row.check_out_date,
  roomType: row.room_type,
  roomCount:
    row.room_count === null
      ? null
      : typeof row.room_count === "number"
        ? row.room_count
        : Number(row.room_count),
  guestCount:
    row.guest_count === null
      ? null
      : typeof row.guest_count === "number"
        ? row.guest_count
        : Number(row.guest_count),
  bookingReference: row.booking_reference,
  totalPrice: toNumberOrNull(row.total_price),
  pricePerNight: toNumberOrNull(row.price_per_night),
  currency: row.currency,
  status: row.status,
  bookingSource: row.booking_source,
  purchaseUrl: row.purchase_url,
  amenities: (row.amenities ?? null) as any,
  images: (row.images ?? null) as any,
  policies: (row.policies ?? null) as any,
  contactInfo: (row.contact_info ?? null) as any,
  bookingPlatform: row.booking_platform,
  bookingUrl: row.booking_url,
  cancellationPolicy: row.cancellation_policy,
  notes: row.notes,
  proposalId:
    (row as { linked_proposal_id?: number | null }).linked_proposal_id ?? null,
  proposalStatus:
    (row as { linked_proposal_status?: string | null }).linked_proposal_status ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapHotelWithDetails = (row: HotelWithDetailsRow): HotelWithDetails => {
  const tripRow: TripRow = {
    id: row.trip_id,
    name: row.trip_name,
    destination: row.trip_destination,
    start_date: row.trip_start_date,
    end_date: row.trip_end_date,
    share_code: row.trip_share_code,
    created_by: row.trip_created_by,
    created_at: row.trip_created_at,
    geoname_id: null,
    city_name: null,
    country_name: null,
    latitude: null,
    longitude: null,
    population: null,
    cover_photo_url: null,
    cover_photo_card_url: null,
    cover_photo_thumb_url: null,
    cover_photo_alt: null,
    cover_photo_attribution: null,
    cover_photo_storage_key: null,
    cover_photo_original_url: null,
    cover_photo_focal_x: null,
    cover_photo_focal_y: null,
  };

  return {
    ...mapHotel(row),
    user: mapUserFromPrefix(row, "user_"),
    trip: mapTrip(tripRow),
  };
};

const mapRestaurant = (row: RestaurantRow): Restaurant => ({
  id: row.id,
  tripId: row.trip_id,
  userId: row.user_id,
  name: row.name,
  cuisineType: row.cuisine_type,
  address: row.address,
  city: row.city,
  country: row.country,
  zipCode: row.zip_code,
  latitude: toNumberOrNull(row.latitude),
  longitude: toNumberOrNull(row.longitude),
  phoneNumber: row.phone_number,
  website: row.website,
  openTableUrl: row.open_table_url,
  priceRange: row.price_range,
  rating: toNumberOrNull(row.rating),
  reservationDate: row.reservation_date,
  reservationTime: row.reservation_time,
  partySize: row.party_size,
  confirmationNumber: row.confirmation_number,
  reservationStatus: row.reservation_status,
  specialRequests: row.special_requests,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRestaurantWithDetails = (
  row: RestaurantWithDetailsRow,
): RestaurantWithDetails => {
  const tripRow: TripRow = {
    id: row.trip_id,
    name: row.trip_name,
    destination: row.trip_destination,
    start_date: row.trip_start_date,
    end_date: row.trip_end_date,
    share_code: row.trip_share_code,
    created_by: row.trip_created_by,
    created_at: row.trip_created_at,
    geoname_id: null,
    city_name: null,
    country_name: null,
    latitude: null,
    longitude: null,
    population: null,
    cover_photo_url: null,
    cover_photo_card_url: null,
    cover_photo_thumb_url: null,
    cover_photo_alt: null,
    cover_photo_attribution: null,
    cover_photo_storage_key: null,
    cover_photo_original_url: null,
    cover_photo_focal_x: null,
    cover_photo_focal_y: null,
  };

  return {
    ...mapRestaurant(row),
    user: mapUserFromPrefix(row, "user_"),
    trip: mapTrip(tripRow),
  };
};

const mapTravelTip = (row: TravelTipRow): TravelTip => ({
  id: row.id,
  content: row.content,
  category: row.category,
  destination: row.destination,
  applicableRegions:
    (row.applicable_regions as TravelTip["applicableRegions"]) ?? null,
  activityCategories:
    (row.activity_categories as TravelTip["activityCategories"]) ?? null,
  seasonality: (row.seasonality as TravelTip["seasonality"]) ?? null,
  priority: row.priority,
  tags: (row.tags as TravelTip["tags"]) ?? null,
  isActive: row.is_active,
  createdBy: row.created_by,
  source: row.source,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapTravelTipWithDetails = (
  row: TravelTipWithDetailsRow,
): TravelTipWithDetails => {
  const baseTip = mapTravelTip(row);
  const creatorId = row.creator_id as string | null | undefined;

  if (!creatorId) {
    return baseTip;
  }

  return {
    ...baseTip,
    creator: mapUserFromPrefix(row as Record<string, unknown>, "creator_"),
  };
};

const mapWishListIdea = (row: WishListIdeaRow): WishListIdea => ({
  id: row.id,
  tripId: row.trip_id,
  title: row.title,
  url: row.url,
  notes: row.notes,
  tags: toStringArray(row.tags),
  thumbnailUrl: row.thumbnail_url,
  imageUrl: row.image_url,
  metadata:
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null,
  createdBy: row.created_by,
  promotedDraftId: row.promoted_draft_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWishListIdeaWithDetails = (
  row: WishListIdeaWithCountsRow,
): WishListIdeaWithDetails => ({
  ...mapWishListIdea(row),
  saveCount: Number(row.save_count ?? 0),
  commentCount: Number(row.comment_count ?? 0),
  currentUserSaved: Boolean(row.saved_by_user),
  creator: mapUserFromPrefix(row, "creator_"),
});

const mapWishListComment = (row: WishListCommentRow): WishListComment => ({
  id: row.id,
  itemId: row.item_id,
  userId: row.user_id,
  comment: row.comment,
  createdAt: row.created_at,
});

const mapWishListCommentWithUser = (
  row: WishListCommentWithUserRow,
): WishListCommentWithUser => ({
  ...mapWishListComment(row),
  user: mapUserFromPrefix(row, "user_"),
});

const mapWishListProposalDraft = (
  row: WishListProposalDraftRow,
): WishListProposalDraft => ({
  id: row.id,
  tripId: row.trip_id,
  itemId: row.item_id,
  createdBy: row.created_by,
  title: row.title,
  url: row.url,
  notes: row.notes,
  tags: toStringArray(row.tags),
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapWishListProposalDraftWithDetails = (
  row: WishListProposalDraftWithCreatorRow,
): WishListProposalDraftWithDetails => ({
  ...mapWishListProposalDraft(row),
  creator: mapUserFromPrefix(row, "creator_"),
});

const mapUserTipPreferences = (
  row: UserTipPreferencesRow,
): UserTipPreferences => ({
  id: row.id,
  userId: row.user_id,
  preferredCategories:
    (row.preferred_categories as UserTipPreferences["preferredCategories"]) ??
    null,
  dismissedTips:
    (row.dismissed_tips as UserTipPreferences["dismissedTips"]) ?? null,
  preferredLanguage: row.preferred_language,
  showSeasonalTips: row.show_seasonal_tips,
  showLocationTips: row.show_location_tips,
  showActivityTips: row.show_activity_tips,
  tipFrequency: row.tip_frequency,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toDbJson = (value: unknown): string | null =>
  value === undefined || value === null ? null : JSON.stringify(value);

const SHARE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const generateShareCode = (): string => {
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    const index = Math.floor(Math.random() * SHARE_CODE_CHARS.length);
    code += SHARE_CODE_CHARS[index];
  }
  return code;
};

export class DatabaseStorage implements IStorage {
  private wishListInitPromise: Promise<void> | null = null;

  private wishListInitialized = false;

  private proposalLinksInitPromise: Promise<void> | null = null;

  private proposalLinksInitialized = false;

  private activityStatusInitPromise: Promise<void> | null = null;

  private activityStatusColumnInitialized = false;

  private activityTypeInitPromise: Promise<void> | null = null;

  private activityTypeColumnInitialized = false;

  private activityInvitesInitPromise: Promise<void> | null = null;

  private activityInvitesInitialized = false;

  private packingInitPromise: Promise<void> | null = null;

  private packingInitialized = false;

  private coverPhotoInitPromise: Promise<void> | null = null;

  private coverPhotoColumnsInitialized = false;

  private flightDeletionAuditInitPromise: Promise<void> | null = null;

  private flightDeletionAuditInitialized = false;

  private async ensureWishListStructures(): Promise<void> {
    if (this.wishListInitialized) {
      return;
    }

    if (this.wishListInitPromise) {
      await this.wishListInitPromise;
      return;
    }

    this.wishListInitPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS trip_wish_list_items (
          id SERIAL PRIMARY KEY,
          trip_id INTEGER NOT NULL REFERENCES trip_calendars(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          url TEXT,
          notes TEXT,
          tags JSONB DEFAULT '[]'::jsonb,
          thumbnail_url TEXT,
          image_url TEXT,
          metadata JSONB,
          created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          promoted_draft_id INTEGER UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const { rows: tagColumnInfoRows } = await query<{
        data_type: string | null;
        udt_name: string | null;
      }>(
        `
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'trip_wish_list_items'
          AND column_name = 'tags'
        LIMIT 1
        `,
      );

      const tagColumnInfo = tagColumnInfoRows[0];
      const tagDataType = tagColumnInfo?.data_type?.toLowerCase();

      if (tagColumnInfo && tagDataType && tagDataType !== "jsonb") {
        await query(
          `ALTER TABLE trip_wish_list_items ALTER COLUMN tags DROP DEFAULT`,
        );

        if (tagDataType === "array" || tagColumnInfo.udt_name === "_text") {
          await query(`
            ALTER TABLE trip_wish_list_items
            ALTER COLUMN tags TYPE JSONB
            USING to_jsonb(COALESCE(tags, ARRAY[]::text[]))
          `);
        } else {
          await query(
            `ALTER TABLE trip_wish_list_items ADD COLUMN IF NOT EXISTS tags_jsonb JSONB DEFAULT '[]'::jsonb`,
          );

          const { rows: tagRows } = await query<{ id: number; tags: unknown }>(
            `SELECT id, tags FROM trip_wish_list_items`,
          );

          for (const row of tagRows) {
            const normalizedTagsJson = toDbJson(toStringArray(row.tags)) ?? "[]";
            await query(
              `
              UPDATE trip_wish_list_items
              SET tags_jsonb = $2::jsonb
              WHERE id = $1
              `,
              [row.id, normalizedTagsJson],
            );
          }

          await query(`ALTER TABLE trip_wish_list_items DROP COLUMN tags`);
          await query(`ALTER TABLE trip_wish_list_items RENAME COLUMN tags_jsonb TO tags`);
        }
      }

      await query(
        `ALTER TABLE trip_wish_list_items ALTER COLUMN tags SET DEFAULT '[]'::jsonb`,
      );

      await query(
        `ALTER TABLE trip_wish_list_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT`,
      );
      await query(
        `ALTER TABLE trip_wish_list_items ADD COLUMN IF NOT EXISTS image_url TEXT`,
      );
      await query(
        `ALTER TABLE trip_wish_list_items ADD COLUMN IF NOT EXISTS metadata JSONB`,
      );
      await query(
        `ALTER TABLE trip_wish_list_items ADD COLUMN IF NOT EXISTS promoted_draft_id INTEGER`,
      );

      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
              AND table_name = 'trip_wish_list_items'
              AND constraint_name = 'trip_wish_list_items_promoted_draft_id_key'
          ) THEN
            ALTER TABLE trip_wish_list_items
            ADD CONSTRAINT trip_wish_list_items_promoted_draft_id_key UNIQUE (promoted_draft_id);
          END IF;
        END
        $$;
      `);

      await query(
        `CREATE INDEX IF NOT EXISTS idx_trip_wish_list_items_trip ON trip_wish_list_items(trip_id)`,
      );
      await query(
        `CREATE INDEX IF NOT EXISTS idx_trip_wish_list_items_created_at ON trip_wish_list_items(trip_id, created_at DESC)`,
      );

      await query(`
        CREATE TABLE IF NOT EXISTS trip_wish_list_saves (
          id SERIAL PRIMARY KEY,
          item_id INTEGER NOT NULL REFERENCES trip_wish_list_items(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (item_id, user_id)
        )
      `);
      await query(
        `CREATE INDEX IF NOT EXISTS idx_trip_wish_list_saves_item ON trip_wish_list_saves(item_id)`,
      );

      await query(`
        CREATE TABLE IF NOT EXISTS trip_wish_list_comments (
          id SERIAL PRIMARY KEY,
          item_id INTEGER NOT NULL REFERENCES trip_wish_list_items(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          comment TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(
        `CREATE INDEX IF NOT EXISTS idx_trip_wish_list_comments_item ON trip_wish_list_comments(item_id)`,
      );

      await query(`
        CREATE TABLE IF NOT EXISTS trip_proposal_drafts (
          id SERIAL PRIMARY KEY,
          trip_id INTEGER NOT NULL REFERENCES trip_calendars(id) ON DELETE CASCADE,
          item_id INTEGER UNIQUE REFERENCES trip_wish_list_items(id) ON DELETE CASCADE,
          created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          url TEXT,
          notes TEXT,
          tags JSONB DEFAULT '[]'::jsonb,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await query(
        `CREATE INDEX IF NOT EXISTS idx_trip_proposal_drafts_trip ON trip_proposal_drafts(trip_id, created_at DESC)`,
      );

      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM information_schema.constraint_column_usage
            WHERE table_name = 'trip_wish_list_items'
              AND constraint_name = 'fk_trip_wish_list_items_promoted_draft'
          ) THEN
            ALTER TABLE trip_wish_list_items
            ADD CONSTRAINT fk_trip_wish_list_items_promoted_draft
            FOREIGN KEY (promoted_draft_id)
            REFERENCES trip_proposal_drafts(id)
            ON DELETE SET NULL;
          END IF;
        END
        $$;
      `);

      this.wishListInitialized = true;
    })();

    try {
      await this.wishListInitPromise;
    } finally {
      this.wishListInitPromise = null;
    }
  }

  private async ensureProposalLinkStructures(): Promise<void> {
    if (this.proposalLinksInitialized) {
      return;
    }

    if (this.proposalLinksInitPromise) {
      await this.proposalLinksInitPromise;
      return;
    }

    this.proposalLinksInitPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS proposal_schedule_links (
          id SERIAL PRIMARY KEY,
          proposal_type TEXT NOT NULL,
          proposal_id INTEGER NOT NULL,
          scheduled_table TEXT NOT NULL,
          scheduled_id INTEGER NOT NULL,
          trip_id INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (proposal_type, proposal_id, scheduled_table, scheduled_id)
        )
      `);

      await query(
        `CREATE INDEX IF NOT EXISTS idx_proposal_schedule_links_lookup ON proposal_schedule_links (proposal_type, proposal_id)`,
      );

      this.proposalLinksInitialized = true;
    })();

    try {
      await this.proposalLinksInitPromise;
    } finally {
      this.proposalLinksInitPromise = null;
    }
  }

  private async ensureActivityStatusColumn(): Promise<void> {
    if (this.activityStatusColumnInitialized) {
      return;
    }

    if (this.activityStatusInitPromise) {
      await this.activityStatusInitPromise;
      return;
    }

    this.activityStatusInitPromise = (async () => {
      await query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS status TEXT`);

      await query(
        `ALTER TABLE activities ALTER COLUMN status SET DEFAULT 'active'`,
      );

      await query(
        `UPDATE activities SET status = 'active' WHERE status IS NULL OR status = ''`,
      );

      await query(`ALTER TABLE activities ALTER COLUMN status SET NOT NULL`);

      this.activityStatusColumnInitialized = true;
    })();

    try {
      await this.activityStatusInitPromise;
    } finally {
      this.activityStatusInitPromise = null;
    }
  }

  private async ensureActivityTypeColumn(): Promise<void> {
    await this.ensureActivityStatusColumn();

    if (this.activityTypeColumnInitialized) {
      return;
    }

    if (this.activityTypeInitPromise) {
      await this.activityTypeInitPromise;
      return;
    }

    this.activityTypeInitPromise = (async () => {
      await query(`ALTER TABLE activities ADD COLUMN IF NOT EXISTS type TEXT`);

      const { rows: typeInfoRows } = await query<{
        data_type: string | null;
        udt_name: string | null;
      }>(
        `
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'activities'
          AND column_name = 'type'
        LIMIT 1
        `,
      );

      const typeInfo = typeInfoRows[0];
      const dataType = typeInfo?.data_type ?? null;
      const udtName = typeInfo?.udt_name ?? null;
      const isUserDefinedEnum =
        dataType === "USER-DEFINED" && typeof udtName === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(udtName);

      if (isUserDefinedEnum && udtName) {
        await query(
          `ALTER TABLE activities ALTER COLUMN type SET DEFAULT 'SCHEDULED'::${udtName}`,
        );
        await query(
          `UPDATE activities SET type = 'SCHEDULED'::${udtName} WHERE type IS NULL`,
        );
      } else {
        await query(
          `ALTER TABLE activities ALTER COLUMN type SET DEFAULT 'SCHEDULED'`,
        );

        const shouldTrimBlanks =
          dataType === "text" || dataType === "character varying" || dataType === "character";
        const updateCondition = shouldTrimBlanks
          ? "type IS NULL OR TRIM(type) = ''"
          : "type IS NULL";

        await query(
          `UPDATE activities SET type = 'SCHEDULED' WHERE ${updateCondition}`,
        );
      }

      await query(`ALTER TABLE activities ALTER COLUMN type SET NOT NULL`);
      this.activityTypeColumnInitialized = true;
    })();

    try {
      await this.activityTypeInitPromise;
    } finally {
      this.activityTypeInitPromise = null;
    }
  }

  private async ensureActivityInviteStructures(): Promise<void> {
    if (this.activityInvitesInitialized) {
      return;
    }

    if (this.activityInvitesInitPromise) {
      await this.activityInvitesInitPromise;
      return;
    }

    this.activityInvitesInitPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS activity_invites (
          id SERIAL PRIMARY KEY,
          activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status TEXT NOT NULL DEFAULT 'pending',
          responded_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (activity_id, user_id)
        )
      `);

      await query(
        `ALTER TABLE activity_invites ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ`,
      );

      await query(
        `ALTER TABLE activity_invites ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ`,
      );

      await query(
        `ALTER TABLE activity_invites ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ`,
      );

      await query(
        `UPDATE activity_invites SET created_at = NOW() WHERE created_at IS NULL`,
      );

      await query(
        `UPDATE activity_invites SET updated_at = NOW() WHERE updated_at IS NULL`,
      );

      await query(
        `ALTER TABLE activity_invites ALTER COLUMN created_at SET DEFAULT NOW()`,
      );

      await query(
        `ALTER TABLE activity_invites ALTER COLUMN updated_at SET DEFAULT NOW()`,
      );

      await query(
        `ALTER TABLE activity_invites ALTER COLUMN created_at SET NOT NULL`,
      );

      await query(
        `ALTER TABLE activity_invites ALTER COLUMN updated_at SET NOT NULL`,
      );

      await query(
        `CREATE INDEX IF NOT EXISTS idx_activity_invites_activity ON activity_invites(activity_id)`,
      );

      await query(
        `CREATE INDEX IF NOT EXISTS idx_activity_invites_user ON activity_invites(user_id)`,
      );

      this.activityInvitesInitialized = true;
    })();

    try {
      await this.activityInvitesInitPromise;
    } finally {
      this.activityInvitesInitPromise = null;
    }
  }

  private async ensurePackingStructures(): Promise<void> {
    if (this.packingInitialized) {
      return;
    }

    if (this.packingInitPromise) {
      await this.packingInitPromise;
      return;
    }

    this.packingInitPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS packing_item_statuses (
          id SERIAL PRIMARY KEY,
          item_id INTEGER NOT NULL REFERENCES packing_items(id) ON DELETE CASCADE,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          is_checked BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (item_id, user_id)
        )
      `);

      await query(
        `CREATE INDEX IF NOT EXISTS idx_packing_item_statuses_item ON packing_item_statuses(item_id)`,
      );

      await query(
        `CREATE INDEX IF NOT EXISTS idx_packing_item_statuses_user ON packing_item_statuses(user_id)`,
      );

      this.packingInitialized = true;
    })();

    try {
      await this.packingInitPromise;
    } finally {
      this.packingInitPromise = null;
    }
  }

  private async ensureCoverPhotoColumns(): Promise<void> {
    if (this.coverPhotoColumnsInitialized) {
      return;
    }

    if (this.coverPhotoInitPromise) {
      await this.coverPhotoInitPromise;
      return;
    }

    this.coverPhotoInitPromise = (async () => {
      await query(`
        ALTER TABLE trip_calendars
          ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
          ADD COLUMN IF NOT EXISTS cover_photo_card_url TEXT,
          ADD COLUMN IF NOT EXISTS cover_photo_thumb_url TEXT,
          ADD COLUMN IF NOT EXISTS cover_photo_alt TEXT,
          ADD COLUMN IF NOT EXISTS cover_photo_attribution TEXT,
          ADD COLUMN IF NOT EXISTS cover_photo_storage_key TEXT,
          ADD COLUMN IF NOT EXISTS cover_photo_original_url TEXT,
          ADD COLUMN IF NOT EXISTS cover_photo_focal_x DOUBLE PRECISION,
          ADD COLUMN IF NOT EXISTS cover_photo_focal_y DOUBLE PRECISION
      `);

      this.coverPhotoColumnsInitialized = true;
    })();

    await this.coverPhotoInitPromise;
  }

  private async ensureFlightDeletionAuditTable(): Promise<void> {
    if (this.flightDeletionAuditInitialized) {
      return;
    }

    if (this.flightDeletionAuditInitPromise) {
      await this.flightDeletionAuditInitPromise;
      return;
    }

    this.flightDeletionAuditInitPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS flight_deletion_audit (
          id SERIAL PRIMARY KEY,
          flight_id INTEGER NOT NULL,
          trip_id INTEGER NOT NULL,
          requester_id TEXT NOT NULL,
          created_by TEXT NOT NULL,
          deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      await query(
        `CREATE INDEX IF NOT EXISTS idx_flight_deletion_audit_trip ON flight_deletion_audit(trip_id)`,
      );

      await query(
        `CREATE INDEX IF NOT EXISTS idx_flight_deletion_audit_flight ON flight_deletion_audit(flight_id)`,
      );
    })();

    try {
      await this.flightDeletionAuditInitPromise;
      this.flightDeletionAuditInitialized = true;
    } finally {
      this.flightDeletionAuditInitPromise = null;
    }
  }

  private async upsertActivityInvites(
    activityId: number,
    userIds: string[],
    status: ActivityInviteStatus = "pending",
  ): Promise<void> {
    const uniqueIds = Array.from(new Set(userIds));
    if (uniqueIds.length === 0) {
      return;
    }

    await this.ensureActivityInviteStructures();

    await query(
      `
      INSERT INTO activity_invites (activity_id, user_id, status, responded_at)
      SELECT
        $1,
        uid,
        $2,
        CASE WHEN $2 = 'pending' THEN NULL ELSE NOW() END
      FROM UNNEST($3::text[]) AS uid
      ON CONFLICT (activity_id, user_id) DO UPDATE
        SET status = EXCLUDED.status,
            responded_at = EXCLUDED.responded_at,
            updated_at = NOW()
      `,
      [activityId, status, uniqueIds],
    );
  }

  async setActivityInviteStatus(
    activityId: number,
    userId: string,
    status: ActivityInviteStatus,
  ): Promise<ActivityInvite> {
    await this.ensureActivityInviteStructures();

    const { rows } = await query<ActivityInviteRow>(
      `
      INSERT INTO activity_invites (activity_id, user_id, status, responded_at)
      VALUES ($1, $2, $3, CASE WHEN $3 = 'pending' THEN NULL ELSE NOW() END)
      ON CONFLICT (activity_id, user_id) DO UPDATE
        SET status = EXCLUDED.status,
            responded_at = EXCLUDED.responded_at,
            updated_at = NOW()
      RETURNING
        id,
        activity_id,
        user_id,
        status,
        responded_at,
        created_at,
        updated_at
      `,
      [activityId, userId, status],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to update activity invite");
    }

    return mapActivityInvite(row);
  }

  async initializeWishList(): Promise<void> {
    await this.ensureWishListStructures();
  }

  async getUser(id: string): Promise<User | undefined> {
    const { rows } = await query<User>(
      `
      SELECT id,
             email,
             username,
             first_name AS "firstName",
             last_name AS "lastName",
             phone_number AS "phoneNumber",
             password_hash AS "passwordHash",
             auth_provider AS "authProvider",
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM users
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );
    return rows[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const { rows } = await query<User>(
      `
      SELECT id,
             email,
             username,
             first_name AS "firstName",
             last_name AS "lastName",
             phone_number AS "phoneNumber",
             password_hash AS "passwordHash",
             auth_provider AS "authProvider",
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM users
      WHERE email = $1
      LIMIT 1
      `,
      [email]
    );
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const { rows } = await query<User>(
      `
      SELECT id,
             email,
             username,
             first_name AS "firstName",
             last_name AS "lastName",
             phone_number AS "phoneNumber",
             password_hash AS "passwordHash",
             auth_provider AS "authProvider",
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM users
      WHERE username = $1
      LIMIT 1
      `,
      [username]
    );
    return rows[0];
  }

  async upsertUser(user: UpsertUser): Promise<User> {
    const { rows } = await query<UserRow>(
      `
      INSERT INTO users (id, email, username, first_name, last_name, phone_number, password_hash, auth_provider)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            username = EXCLUDED.username,
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            phone_number = EXCLUDED.phone_number,
            password_hash = EXCLUDED.password_hash,
            auth_provider = EXCLUDED.auth_provider,
            updated_at = NOW()
      RETURNING *;
      `,
      [
        user.id,
        user.email,
        user.username,
        user.firstName,
        user.lastName,
        user.phoneNumber,
        user.passwordHash,
        user.authProvider,
      ]
    );
    return mapUser(rows[0]);
  }

  // All other methods stubbed
  async updateUserProfile(
    userId: string,
    data: Partial<
      Pick<
        User,
        | "cashAppUsername"
        | "venmoUsername"
        | "defaultLocation"
        | "defaultLocationCode"
        | "defaultCity"
        | "defaultCountry"
      >
    >,
  ): Promise<void> {
    const fieldMap: Record<string, string> = {
      cashAppUsername: "cashapp_username",
      venmoUsername: "venmo_username",
      defaultLocation: "default_location",
      defaultLocationCode: "default_location_code",
      defaultCity: "default_city",
      defaultCountry: "default_country",
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const typedData = data as Partial<
      Record<keyof typeof fieldMap, unknown>
    >;

    for (const [key, column] of Object.entries(fieldMap) as [
      keyof typeof fieldMap,
      string,
    ][]) {
      const value = typedData[key];
      if (value !== undefined) {
        setClauses.push(`${column} = $${index}`);
        values.push(value);
        index += 1;
      }
    }

    if (setClauses.length === 0) {
      return;
    }

    setClauses.push("updated_at = NOW()");

    const sql = `
      UPDATE users
      SET ${setClauses.join(", ")}
      WHERE id = $${index}
    `;

    values.push(userId);
    await query(sql, values);
  }

  async updateOnboardingStatus(
    userId: string,
    type: "home" | "trip",
  ): Promise<void> {
    const column =
      type === "home"
        ? "has_seen_home_onboarding"
        : "has_seen_trip_onboarding";

    await query(
      `
      UPDATE users
      SET ${column} = TRUE,
          updated_at = NOW()
      WHERE id = $1
      `,
      [userId],
    );
  }

  async createTrip(
    trip: InsertTripCalendar,
    userId: string,
  ): Promise<TripCalendar> {
    await this.ensureCoverPhotoColumns();

    let shareCode = "";
    let attempts = 0;

    do {
      shareCode = generateShareCode();
      attempts += 1;
      if (attempts > 10) {
        throw new Error("Failed to generate unique share code");
      }
    } while (await this.shareCodeExists(shareCode));

    const parseNullableNumber = (value: unknown): number | null => {
      if (value === undefined || value === null) {
        return null;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const geonameIdValue = parseNullableNumber(trip.geonameId);
    const latitudeValue = parseNullableNumber(trip.latitude);
    const longitudeValue = parseNullableNumber(trip.longitude);
    const populationValue = parseNullableNumber(trip.population);

    const { rows } = await query<TripRow>(
      `
      INSERT INTO trip_calendars (
        name,
        destination,
        start_date,
        end_date,
        share_code,
        created_by,
        geoname_id,
        city_name,
        country_name,
        latitude,
        longitude,
        population,
        cover_photo_url,
        cover_photo_card_url,
        cover_photo_thumb_url,
        cover_photo_alt,
        cover_photo_attribution,
        cover_photo_storage_key,
        cover_photo_original_url,
        cover_photo_focal_x,
        cover_photo_focal_y
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        $21
      )
      RETURNING
        id,
        name,
        destination,
        start_date,
        end_date,
        share_code,
        created_by,
        created_at,
        geoname_id,
        city_name,
        country_name,
        latitude,
        longitude,
        population,
        cover_photo_url,
        cover_photo_card_url,
        cover_photo_thumb_url,
        cover_photo_alt,
        cover_photo_attribution,
        cover_photo_storage_key,
        cover_photo_original_url,
        cover_photo_focal_x,
        cover_photo_focal_y
      `,
      [
        trip.name,
        trip.destination,
        trip.startDate,
        trip.endDate,
        shareCode,
        userId,
        geonameIdValue,
        trip.cityName ?? null,
        trip.countryName ?? null,
        latitudeValue,
        longitudeValue,
        populationValue,
        sanitizeNullableString(trip.coverImageUrl ?? trip.coverPhotoUrl ?? null),
        sanitizeNullableString(trip.coverPhotoCardUrl),
        sanitizeNullableString(trip.coverPhotoThumbUrl),
        sanitizeNullableString(trip.coverPhotoAlt),
        sanitizeNullableString(trip.coverPhotoAttribution),
        sanitizeNullableString(trip.coverPhotoStorageKey),
        sanitizeNullableString(
          trip.coverPhotoOriginalUrl ?? trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
        ),
        typeof trip.coverPhotoFocalX === "number" && Number.isFinite(trip.coverPhotoFocalX)
          ? trip.coverPhotoFocalX
          : null,
        typeof trip.coverPhotoFocalY === "number" && Number.isFinite(trip.coverPhotoFocalY)
          ? trip.coverPhotoFocalY
          : null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create trip");
    }

    const { rows: memberColumnRows } = await query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trip_members'
      `,
    );

    const memberColumnNames = new Set(
      memberColumnRows.map(({ column_name }) => column_name),
    );

    const memberColumns = ["trip_calendar_id", "user_id"];
    const valuePlaceholders = ["$1", "$2"];
    const memberValues: unknown[] = [row.id, userId];
    let placeholderIndex = 3;

    if (memberColumnNames.has("role")) {
      memberColumns.push("role");
      valuePlaceholders.push(`$${placeholderIndex}`);
      memberValues.push("owner");
      placeholderIndex += 1;
    }

    if (memberColumnNames.has("is_admin")) {
      memberColumns.push("is_admin");
      valuePlaceholders.push(`$${placeholderIndex}`);
      memberValues.push(true);
      placeholderIndex += 1;
    }

    if (memberColumnNames.has("joined_at")) {
      memberColumns.push("joined_at");
      valuePlaceholders.push("NOW()");
    }

    await query(
      `
      INSERT INTO trip_members (${memberColumns.join(", ")})
      VALUES (${valuePlaceholders.join(", ")})
      ON CONFLICT (trip_calendar_id, user_id) DO NOTHING
      `,
      memberValues,
    );

    return mapTrip(row);
  }

  async getTripByShareCode(
    shareCode: string,
  ): Promise<TripWithDetails | undefined> {
    const normalizedCode = shareCode.trim().toUpperCase();
    const row = await this.fetchTripWithCreatorByShareCode(normalizedCode);
    if (!row) {
      return undefined;
    }

    const members = await this.fetchTripMembersWithUsers(row.id);
    const creator = mapUserFromPrefix(row, "creator_");

    return mapTripWithDetails(row, creator, members);
  }

  async getTripById(tripId: number): Promise<TripWithDetails | undefined> {
    const row = await this.fetchTripWithCreatorById(tripId);
    if (!row) {
      return undefined;
    }

    const members = await this.fetchTripMembersWithUsers(row.id);
    const creator = mapUserFromPrefix(row, "creator_");

    return mapTripWithDetails(row, creator, members);
  }

  async getUserTrips(userId: string): Promise<TripWithDetails[]> {
    const { rows } = await query<{ id: number }>(
      `
      SELECT tc.id
      FROM trip_calendars tc
      JOIN trip_members tm ON tm.trip_calendar_id = tc.id
      WHERE tm.user_id = $1
      ORDER BY tc.start_date ASC, tc.id ASC
      `,
      [userId],
    );

    const trips = await Promise.all(
      rows.map(async (row) => this.getTripById(row.id)),
    );

    return trips.filter(
      (trip): trip is TripWithDetails => trip !== undefined,
    );
  }

  async isTripMember(tripId: number, userId: string): Promise<boolean> {
    const { rows } = await query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1
        FROM trip_calendars tc
        WHERE tc.id = $1
          AND (tc.created_by = $2 OR EXISTS (
            SELECT 1
            FROM trip_members tm
            WHERE tm.trip_calendar_id = tc.id
              AND tm.user_id = $2
          ))
      ) AS exists
      `,
      [tripId, userId],
    );

    return rows[0]?.exists ?? false;
  }

  async isTripAdmin(tripId: number, userId: string): Promise<boolean> {
    const { rows } = await query<{ is_admin: boolean }>(
      `
      SELECT CASE
        WHEN EXISTS (
          SELECT 1
          FROM trip_calendars tc
          WHERE tc.id = $1 AND tc.created_by = $2
        ) THEN TRUE
        WHEN EXISTS (
          SELECT 1
          FROM trip_members tm
          WHERE tm.trip_calendar_id = $1
            AND tm.user_id = $2
            AND tm.role IN ('admin', 'owner', 'organizer')
        ) THEN TRUE
        ELSE FALSE
      END AS is_admin
      `,
      [tripId, userId],
    );

    return rows[0]?.is_admin ?? false;
  }

  async joinTrip(
    shareCode: string,
    userId: string,
    options?: { departureLocation?: string | null; departureAirport?: string | null },
  ): Promise<TripWithDetails> {
    const row = await this.fetchTripWithCreatorByShareCode(
      shareCode.trim().toUpperCase(),
    );

    if (!row) {
      throw new Error("Trip not found");
    }

    const { rows: memberColumnRows } = await query<{ column_name: string }>(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trip_members'
      `,
    );

    const memberColumnNames = new Set(
      memberColumnRows.map(({ column_name }) => column_name),
    );

    const memberColumns = ["trip_calendar_id", "user_id"];
    const valuePlaceholders = ["$1", "$2"];
    const memberValues: unknown[] = [row.id, userId];
    let placeholderIndex = 3;

    if (memberColumnNames.has("role")) {
      memberColumns.push("role");
      valuePlaceholders.push(`$${placeholderIndex}`);
      memberValues.push(row.created_by === userId ? "owner" : "member");
      placeholderIndex += 1;
    }

    if (memberColumnNames.has("is_admin")) {
      memberColumns.push("is_admin");
      valuePlaceholders.push(`$${placeholderIndex}`);
      memberValues.push(row.created_by === userId);
      placeholderIndex += 1;
    }

    if (memberColumnNames.has("departure_location")) {
      memberColumns.push("departure_location");
      valuePlaceholders.push(`$${placeholderIndex}`);
      memberValues.push(options?.departureLocation ?? null);
      placeholderIndex += 1;
    }

    if (memberColumnNames.has("departure_airport")) {
      memberColumns.push("departure_airport");
      valuePlaceholders.push(`$${placeholderIndex}`);
      memberValues.push(options?.departureAirport ?? null);
      placeholderIndex += 1;
    }

    if (memberColumnNames.has("joined_at")) {
      memberColumns.push("joined_at");
      valuePlaceholders.push("NOW()");
    }

    const updateAssignments: string[] = [];
    if (memberColumnNames.has("departure_location")) {
      updateAssignments.push(
        "departure_location = EXCLUDED.departure_location",
      );
    }
    if (memberColumnNames.has("departure_airport")) {
      updateAssignments.push("departure_airport = EXCLUDED.departure_airport");
    }
    if (memberColumnNames.has("is_admin")) {
      updateAssignments.push("is_admin = EXCLUDED.is_admin");
    }

    const conflictClause = updateAssignments.length
      ? `DO UPDATE SET ${updateAssignments.join(",\n            ")}`
      : "DO NOTHING";

    await query(
      `
      INSERT INTO trip_members (${memberColumns.join(", ")})
      VALUES (${valuePlaceholders.join(", ")})
      ON CONFLICT (trip_calendar_id, user_id) ${conflictClause}
      `,
      memberValues,
    );

    const trip = await this.getTripById(row.id);
    if (!trip) {
      throw new Error("Trip not found");
    }

    return trip;
  }

  async leaveTrip(tripId: number, userId: string): Promise<void> {
    const trip = await this.fetchTripWithCreatorById(tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    if (trip.created_by === userId) {
      throw new Error("Trip creators cannot leave their own trip");
    }

    await query(
      `
      DELETE FROM trip_members
      WHERE trip_calendar_id = $1 AND user_id = $2
      `,
      [tripId, userId],
    );
  }

  async removeTripMember(
    tripId: number,
    memberId: string,
    requestedById: string,
  ): Promise<TripWithDetails> {
    const normalizedMemberId = memberId.trim();
    if (!normalizedMemberId) {
      throw new Error("Member ID is required");
    }

    const trip = await this.fetchTripWithCreatorById(tripId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    if (trip.created_by !== requestedById) {
      throw new Error("Only the trip creator can remove members");
    }

    if (normalizedMemberId === trip.created_by) {
      throw new Error("Trip creator cannot be removed");
    }

    const { rowCount } = await query(
      `
      DELETE FROM trip_members
      WHERE trip_calendar_id = $1 AND user_id = $2
      RETURNING id
      `,
      [tripId, normalizedMemberId],
    );

    if (!rowCount) {
      throw new Error("Trip member not found");
    }

    const updatedTrip = await this.getTripById(tripId);
    if (!updatedTrip) {
      throw new Error("Trip not found");
    }

    return updatedTrip;
  }

  async deleteTrip(tripId: number, userId: string): Promise<void> {
    const trip = await this.fetchTripWithCreatorById(tripId);
    if (!trip) {
      return;
    }

    if (trip.created_by !== userId) {
      throw new Error("Only the trip creator can delete this trip");
    }

    await query("BEGIN");
    try {
      await query(
        `
        DELETE FROM notifications
        WHERE trip_id = $1
           OR activity_id IN (SELECT id FROM activities WHERE trip_calendar_id = $1)
           OR expense_id IN (SELECT id FROM expenses WHERE trip_id = $1)
        `,
        [tripId],
      );
      await query(
        `
        DELETE FROM activity_comments
        WHERE activity_id IN (SELECT id FROM activities WHERE trip_calendar_id = $1)
        `,
        [tripId],
      );
      await query(
        `
        DELETE FROM activity_invites
        WHERE activity_id IN (SELECT id FROM activities WHERE trip_calendar_id = $1)
        `,
        [tripId],
      );
      await query(`DELETE FROM activities WHERE trip_calendar_id = $1`, [tripId]);
      await query(
        `
        DELETE FROM expense_shares
        WHERE expense_id IN (SELECT id FROM expenses WHERE trip_id = $1)
        `,
        [tripId],
      );
      await query(`DELETE FROM expenses WHERE trip_id = $1`, [tripId]);
      await query(
        `
        DELETE FROM grocery_item_participants
        WHERE grocery_item_id IN (SELECT id FROM grocery_items WHERE trip_id = $1)
        `,
        [tripId],
      );
      await query(`DELETE FROM grocery_items WHERE trip_id = $1`, [tripId]);
      await query(`DELETE FROM grocery_receipts WHERE trip_id = $1`, [tripId]);
      await query(`DELETE FROM flights WHERE trip_id = $1`, [tripId]);
      await query(`DELETE FROM hotels WHERE trip_id = $1`, [tripId]);
      await query(`DELETE FROM restaurants WHERE trip_id = $1`, [tripId]);
      await query(
        `
        DELETE FROM hotel_rankings
        WHERE proposal_id IN (SELECT id FROM hotel_proposals WHERE trip_id = $1)
        `,
        [tripId],
      );
      await query(`DELETE FROM hotel_proposals WHERE trip_id = $1`, [tripId]);
      await query(
        `
        DELETE FROM flight_rankings
        WHERE proposal_id IN (SELECT id FROM flight_proposals WHERE trip_id = $1)
        `,
        [tripId],
      );
      await query(`DELETE FROM flight_proposals WHERE trip_id = $1`, [tripId]);
      await query(
        `
        DELETE FROM restaurant_rankings
        WHERE proposal_id IN (SELECT id FROM restaurant_proposals WHERE trip_id = $1)
        `,
        [tripId],
      );
      await query(`DELETE FROM restaurant_proposals WHERE trip_id = $1`, [tripId]);
      await query(`DELETE FROM packing_items WHERE trip_id = $1`, [tripId]);
      await query(`DELETE FROM trip_members WHERE trip_calendar_id = $1`, [tripId]);
      await query(`DELETE FROM trip_calendars WHERE id = $1`, [tripId]);
      await query("COMMIT");
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  }

  async updateTrip(
    tripId: number,
    data: Partial<InsertTripCalendar>,
    userId: string,
  ): Promise<TripCalendar> {
    await this.ensureCoverPhotoColumns();

    const existing = await this.fetchTripWithCreatorById(tripId);
    if (!existing) {
      throw new Error("Trip not found");
    }

    if (existing.created_by !== userId) {
      throw new Error("Only the trip creator can edit the trip");
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${index}`);
      values.push(data.name);
      index += 1;
    }

    if (data.destination !== undefined) {
      setClauses.push(`destination = $${index}`);
      values.push(data.destination);
      index += 1;
    }

    if (data.startDate !== undefined) {
      setClauses.push(`start_date = $${index}`);
      values.push(data.startDate);
      index += 1;
    }

    if (data.endDate !== undefined) {
      setClauses.push(`end_date = $${index}`);
      values.push(data.endDate);
      index += 1;
    }

    if (data.geonameId !== undefined) {
      const parsed =
        data.geonameId === null || data.geonameId === undefined
          ? null
          : Number(data.geonameId);
      setClauses.push(`geoname_id = $${index}`);
      values.push(Number.isFinite(parsed as number) ? parsed : null);
      index += 1;
    }

    if (data.cityName !== undefined) {
      setClauses.push(`city_name = $${index}`);
      values.push(data.cityName ?? null);
      index += 1;
    }

    if (data.countryName !== undefined) {
      setClauses.push(`country_name = $${index}`);
      values.push(data.countryName ?? null);
      index += 1;
    }

    if (data.latitude !== undefined) {
      const parsed =
        data.latitude === null || data.latitude === undefined
          ? null
          : Number(data.latitude);
      setClauses.push(`latitude = $${index}`);
      values.push(Number.isFinite(parsed as number) ? parsed : null);
      index += 1;
    }

    if (data.longitude !== undefined) {
      const parsed =
        data.longitude === null || data.longitude === undefined
          ? null
          : Number(data.longitude);
      setClauses.push(`longitude = $${index}`);
      values.push(Number.isFinite(parsed as number) ? parsed : null);
      index += 1;
    }

    if (data.population !== undefined) {
      const parsed =
        data.population === null || data.population === undefined
          ? null
          : Number(data.population);
      setClauses.push(`population = $${index}`);
      values.push(Number.isFinite(parsed as number) ? parsed : null);
      index += 1;
    }

    if (data.coverImageUrl !== undefined) {
      setClauses.push(`cover_photo_url = $${index}`);
      values.push(sanitizeNullableString(data.coverImageUrl));
      index += 1;
    } else if (data.coverPhotoUrl !== undefined) {
      setClauses.push(`cover_photo_url = $${index}`);
      values.push(sanitizeNullableString(data.coverPhotoUrl));
      index += 1;
    }

    if (data.coverPhotoCardUrl !== undefined) {
      setClauses.push(`cover_photo_card_url = $${index}`);
      values.push(sanitizeNullableString(data.coverPhotoCardUrl));
      index += 1;
    }

    if (data.coverPhotoThumbUrl !== undefined) {
      setClauses.push(`cover_photo_thumb_url = $${index}`);
      values.push(sanitizeNullableString(data.coverPhotoThumbUrl));
      index += 1;
    }

    if (data.coverPhotoAlt !== undefined) {
      setClauses.push(`cover_photo_alt = $${index}`);
      values.push(sanitizeNullableString(data.coverPhotoAlt));
      index += 1;
    }

    if (data.coverPhotoAttribution !== undefined) {
      setClauses.push(`cover_photo_attribution = $${index}`);
      values.push(sanitizeNullableString(data.coverPhotoAttribution));
      index += 1;
    }

    if (data.coverPhotoStorageKey !== undefined) {
      setClauses.push(`cover_photo_storage_key = $${index}`);
      values.push(sanitizeNullableString(data.coverPhotoStorageKey));
      index += 1;
    }

    if (data.coverPhotoOriginalUrl !== undefined) {
      setClauses.push(`cover_photo_original_url = $${index}`);
      values.push(
        sanitizeNullableString(
          data.coverPhotoOriginalUrl ?? data.coverImageUrl ?? data.coverPhotoUrl ?? null,
        ),
      );
      index += 1;
    }

    if (data.coverPhotoFocalX !== undefined) {
      const normalized =
        data.coverPhotoFocalX === null || data.coverPhotoFocalX === undefined
          ? null
          : Number(data.coverPhotoFocalX);
      setClauses.push(`cover_photo_focal_x = $${index}`);
      values.push(Number.isFinite(normalized as number) ? normalized : null);
      index += 1;
    }

    if (data.coverPhotoFocalY !== undefined) {
      const normalized =
        data.coverPhotoFocalY === null || data.coverPhotoFocalY === undefined
          ? null
          : Number(data.coverPhotoFocalY);
      setClauses.push(`cover_photo_focal_y = $${index}`);
      values.push(Number.isFinite(normalized as number) ? normalized : null);
      index += 1;
    }

    if (setClauses.length === 0) {
      return mapTrip(existing);
    }

    const sql = `
      UPDATE trip_calendars
      SET ${setClauses.join(", ")}
      WHERE id = $${index}
      RETURNING
        id,
        name,
        destination,
        start_date,
        end_date,
        share_code,
        created_by,
        created_at,
        geoname_id,
        city_name,
        country_name,
        latitude,
        longitude,
        population,
        cover_photo_url,
        cover_photo_card_url,
        cover_photo_thumb_url,
        cover_photo_alt,
        cover_photo_attribution,
        cover_photo_storage_key,
        cover_photo_original_url,
        cover_photo_focal_x,
        cover_photo_focal_y
    `;

    values.push(tripId);

    const { rows } = await query<TripRow>(sql, values);
    const row = rows[0];
    if (!row) {
      throw new Error("Trip not found");
    }

    return mapTrip(row);
  }

  async updateMemberLocation(
    tripId: number,
    userId: string,
    data: { departureLocation?: string | null; departureAirport?: string | null },
  ): Promise<void> {
    await query(
      `
      UPDATE trip_members
      SET departure_location = $1,
          departure_airport = $2
      WHERE trip_calendar_id = $3 AND user_id = $4
      `,
      [
        data.departureLocation ?? null,
        data.departureAirport ?? null,
        tripId,
        userId,
      ],
    );
  }

  async getMemberLocation(
    tripId: number,
    userId: string,
  ): Promise<{ departureLocation?: string; departureAirport?: string } | undefined> {
    const { rows } = await query<{
      departure_location: string | null;
      departure_airport: string | null;
    }>(
      `
      SELECT departure_location, departure_airport
      FROM trip_members
      WHERE trip_calendar_id = $1 AND user_id = $2
      LIMIT 1
      `,
      [tripId, userId],
    );

    const row = rows[0];
    if (!row) {
      return undefined;
    }

    const result: {
      departureLocation?: string;
      departureAirport?: string;
    } = {};

    if (row.departure_location) {
      result.departureLocation = row.departure_location;
    }

    if (row.departure_airport) {
      result.departureAirport = row.departure_airport;
    }

    return Object.keys(result).length > 0 ? result : {};
  }

  private async fetchTripWithCreatorById(
    tripId: number,
  ): Promise<TripWithCreatorRow | undefined> {
    await this.ensureCoverPhotoColumns();

    const { rows } = await query<TripWithCreatorRow>(
      `
      SELECT
        tc.id,
        tc.name,
        tc.destination,
        tc.start_date,
        tc.end_date,
        tc.share_code,
        tc.created_by,
        tc.created_at,
        tc.geoname_id,
        tc.city_name,
        tc.country_name,
        tc.latitude,
        tc.longitude,
        tc.population,
        tc.cover_photo_url,
        tc.cover_photo_card_url,
        tc.cover_photo_thumb_url,
        tc.cover_photo_alt,
        tc.cover_photo_attribution,
        tc.cover_photo_storage_key,
        tc.cover_photo_original_url,
        tc.cover_photo_focal_x,
        tc.cover_photo_focal_y,
        tc.cover_photo_storage_key,
        tc.cover_photo_original_url,
        tc.cover_photo_focal_x,
        tc.cover_photo_focal_y,
        creator.id AS creator_id,
        creator.email AS creator_email,
        creator.username AS creator_username,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name,
        creator.phone_number AS creator_phone_number,
        creator.password_hash AS creator_password_hash,
        creator.profile_image_url AS creator_profile_image_url,
        creator.cashapp_username AS creator_cashapp_username,
        creator.cash_app_username AS creator_cash_app_username,
        creator.cashapp_phone AS creator_cashapp_phone,
        creator.cash_app_phone AS creator_cash_app_phone,
        creator.venmo_username AS creator_venmo_username,
        creator.venmo_phone AS creator_venmo_phone,
        creator.timezone AS creator_timezone,
        creator.default_location AS creator_default_location,
        creator.default_location_code AS creator_default_location_code,
        creator.default_city AS creator_default_city,
        creator.default_country AS creator_default_country,
        creator.auth_provider AS creator_auth_provider,
        creator.notification_preferences AS creator_notification_preferences,
        creator.has_seen_home_onboarding AS creator_has_seen_home_onboarding,
        creator.has_seen_trip_onboarding AS creator_has_seen_trip_onboarding,
        creator.created_at AS creator_created_at,
        creator.updated_at AS creator_updated_at
      FROM trip_calendars tc
      JOIN users creator ON creator.id = tc.created_by
      WHERE tc.id = $1
      LIMIT 1
      `,
      [tripId],
    );

    return rows[0];
  }

  private async fetchTripWithCreatorByShareCode(
    shareCode: string,
  ): Promise<TripWithCreatorRow | undefined> {
    await this.ensureCoverPhotoColumns();

    const { rows } = await query<TripWithCreatorRow>(
      `
      SELECT
        tc.id,
        tc.name,
        tc.destination,
        tc.start_date,
        tc.end_date,
        tc.share_code,
        tc.created_by,
        tc.created_at,
        tc.geoname_id,
        tc.city_name,
        tc.country_name,
        tc.latitude,
        tc.longitude,
        tc.population,
        tc.cover_photo_url,
        tc.cover_photo_card_url,
        tc.cover_photo_thumb_url,
        tc.cover_photo_alt,
        tc.cover_photo_attribution,
        creator.id AS creator_id,
        creator.email AS creator_email,
        creator.username AS creator_username,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name,
        creator.phone_number AS creator_phone_number,
        creator.password_hash AS creator_password_hash,
        creator.profile_image_url AS creator_profile_image_url,
        creator.cashapp_username AS creator_cashapp_username,
        creator.cash_app_username AS creator_cash_app_username,
        creator.cashapp_phone AS creator_cashapp_phone,
        creator.cash_app_phone AS creator_cash_app_phone,
        creator.venmo_username AS creator_venmo_username,
        creator.venmo_phone AS creator_venmo_phone,
        creator.timezone AS creator_timezone,
        creator.default_location AS creator_default_location,
        creator.default_location_code AS creator_default_location_code,
        creator.default_city AS creator_default_city,
        creator.default_country AS creator_default_country,
        creator.auth_provider AS creator_auth_provider,
        creator.notification_preferences AS creator_notification_preferences,
        creator.has_seen_home_onboarding AS creator_has_seen_home_onboarding,
        creator.has_seen_trip_onboarding AS creator_has_seen_trip_onboarding,
        creator.created_at AS creator_created_at,
        creator.updated_at AS creator_updated_at
      FROM trip_calendars tc
      JOIN users creator ON creator.id = tc.created_by
      WHERE tc.share_code = $1
      LIMIT 1
      `,
      [shareCode],
    );

    return rows[0];
  }

  private async fetchTripMembersWithUsers(
    tripId: number,
  ): Promise<(TripMember & { user: User })[]> {
    const { rows } = await query<TripMemberWithUserRow>(
      `
      SELECT
        tm.id,
        tm.trip_calendar_id,
        tm.user_id,
        tm.role,
        tm.departure_location,
        tm.departure_airport,
        tm.joined_at,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM trip_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.trip_calendar_id = $1
      ORDER BY tm.joined_at ASC, tm.id ASC
      `,
      [tripId],
    );

    return rows.map(mapTripMemberWithUser);
  }

  private async shareCodeExists(shareCode: string): Promise<boolean> {
    const { rows } = await query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1 FROM trip_calendars WHERE share_code = $1
      ) AS exists
      `,
      [shareCode],
    );

    return rows[0]?.exists ?? false;
  }
  async createActivityWithInvites(
    activity: InsertActivity,
    userId: string,
    inviteeIds: string[] = [],
  ): Promise<Activity> {
    await this.ensureActivityTypeColumn();
    await this.ensureActivityInviteStructures();

    const costValue = activity.cost ?? null;

    const maxCapacityInput = activity.maxCapacity;
    const parsedMaxCapacity =
      maxCapacityInput === undefined || maxCapacityInput === null || maxCapacityInput === ""
        ? null
        : Number(maxCapacityInput);
    const maxCapacityValue =
      parsedMaxCapacity === null || Number.isNaN(parsedMaxCapacity)
        ? null
        : parsedMaxCapacity;
    const typeValue = toActivityType(activity.type);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: duplicateRows } = await client.query<ActivityRow>(
        `
        SELECT
          id,
          trip_calendar_id,
          posted_by,
          name,
          description,
          start_time,
          end_time,
          location,
          cost,
          max_capacity,
          category,
          status,
          type,
          created_at,
          updated_at
        FROM activities
        WHERE trip_calendar_id = $1
          AND LOWER(name) = LOWER($2)
          AND start_time IS NOT DISTINCT FROM $3
          AND COALESCE(type, 'SCHEDULED') = $4
        LIMIT 1
        FOR SHARE
        `,
        [activity.tripCalendarId, activity.name, activity.startTime, typeValue],
      );

      const duplicateRow = duplicateRows[0];
      if (duplicateRow) {
        throw new ActivityDuplicateError({
          existingActivityId: duplicateRow.id,
          tripCalendarId: activity.tripCalendarId,
          name: duplicateRow.name,
          startTime: toIsoString(duplicateRow.start_time),
          type: typeValue,
        });
      }

      const { rows } = await client.query<ActivityRow>(
        `
        INSERT INTO activities (
          trip_calendar_id,
          posted_by,
          name,
          description,
          start_time,
          end_time,
          location,
          cost,
          max_capacity,
          category,
          status,
          type
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING
          id,
          trip_calendar_id,
          posted_by,
          name,
          description,
          start_time,
          end_time,
          location,
          cost,
          max_capacity,
          category,
          status,
          type,
          created_at,
          updated_at
        `,
        [
          activity.tripCalendarId,
          userId,
          activity.name,
          activity.description ?? null,
          activity.startTime,
          activity.endTime ?? null,
          activity.location ?? null,
          costValue,
          maxCapacityValue,
          activity.category,
          "active",
          typeValue,
        ],
      );

      const row = rows[0];
      if (!row) {
        throw new Error("Failed to create activity");
      }

      const uniqueInviteeIds = Array.from(
        new Set(
          inviteeIds
            .map((id) => String(id).trim())
            .filter((id) => id.length > 0),
        ),
      );
      if (uniqueInviteeIds.length > 0) {
        const [{ rows: memberRows }, { rows: creatorRows }] = await Promise.all([
          client.query<{ user_id: string }>(
            `
            SELECT user_id
            FROM trip_members
            WHERE trip_calendar_id = $1
              AND user_id = ANY($2::text[])
            `,
            [activity.tripCalendarId, uniqueInviteeIds],
          ),
          client.query<{ created_by: string | null }>(
            `
            SELECT created_by
            FROM trip_calendars
            WHERE id = $1
            `,
            [activity.tripCalendarId],
          ),
        ]);

        const validMemberIds = new Set(
          memberRows
            .map((row) => row.user_id)
            .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
            .map((id) => id.trim()),
        );
        const tripCreatorId = creatorRows[0]?.created_by ?? null;
        if (tripCreatorId) {
          const normalizedCreatorId = String(tripCreatorId).trim();
          if (normalizedCreatorId) {
            validMemberIds.add(normalizedCreatorId);
          }
        }

        const invalidInviteeIds = uniqueInviteeIds.filter((id) => !validMemberIds.has(id));

        if (invalidInviteeIds.length > 0) {
          throw new ActivityInviteMembershipError({
            invalidInviteeIds,
            attemptedInviteeIds: uniqueInviteeIds,
          });
        }

        await client.query(
          `
          INSERT INTO activity_invites (activity_id, user_id, status, responded_at)
          SELECT
            $1,
            uid,
            $2,
            CASE WHEN $2 = 'pending' THEN NULL ELSE NOW() END
          FROM UNNEST($3::text[]) AS uid
          ON CONFLICT (activity_id, user_id) DO UPDATE
            SET status = EXCLUDED.status,
                responded_at = EXCLUDED.responded_at,
                updated_at = NOW()
          `,
          [row.id, "pending", uniqueInviteeIds],
        );
      }

      const { rows: organizerInviteRows } = await client.query<ActivityInviteRow>(
        `
        INSERT INTO activity_invites (activity_id, user_id, status, responded_at)
        VALUES ($1, $2, $3, CASE WHEN $3 = 'pending' THEN NULL ELSE NOW() END)
        ON CONFLICT (activity_id, user_id) DO UPDATE
          SET status = EXCLUDED.status,
              responded_at = EXCLUDED.responded_at,
              updated_at = NOW()
        RETURNING
          id,
          activity_id,
          user_id,
          status,
          responded_at,
          created_at,
          updated_at
        `,
        [row.id, userId, "accepted"],
      );

      const organizerInviteRow = organizerInviteRows[0];
      if (!organizerInviteRow) {
        throw new Error("Failed to update activity invite");
      }

      await client.query("COMMIT");

      return mapActivity(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async createActivity(
    activity: InsertActivity,
    userId: string,
    inviteeIds: string[] = [],
  ): Promise<Activity> {
    return this.createActivityWithInvites(activity, userId, inviteeIds);
  }

  async getActivityById(activityId: number): Promise<Activity | undefined> {
    await this.ensureActivityTypeColumn();

    const { rows } = await query<ActivityRow>(
      `
      SELECT
        id,
        trip_calendar_id,
        posted_by,
        name,
        description,
        start_time,
        end_time,
        location,
        cost,
        max_capacity,
        category,
        status,
        type,
        created_at,
        updated_at
      FROM activities
      WHERE id = $1
      LIMIT 1
      `,
      [activityId],
    );

    const row = rows[0];
    return row ? mapActivity(row) : undefined;
  }

  async getTripActivities(
    tripId: number,
    userId: string,
  ): Promise<ActivityWithDetails[]> {
    await this.ensureActivityTypeColumn();

    const { rows: activityRows } = await query<ActivityWithPosterRow>(
      `
      SELECT
        a.id,
        a.trip_calendar_id,
        a.posted_by,
        a.name,
        a.description,
        a.start_time,
        a.end_time,
        a.location,
        a.cost,
        a.max_capacity,
        a.category,
        a.status,
        a.type,
        a.created_at,
        a.updated_at,
        u.id AS poster_id,
        u.email AS poster_email,
        u.username AS poster_username,
        u.first_name AS poster_first_name,
        u.last_name AS poster_last_name,
        u.phone_number AS poster_phone_number,
        u.password_hash AS poster_password_hash,
        u.profile_image_url AS poster_profile_image_url,
        u.cashapp_username AS poster_cashapp_username,
        u.cash_app_username AS poster_cash_app_username,
        u.cashapp_phone AS poster_cashapp_phone,
        u.cash_app_phone AS poster_cash_app_phone,
        u.venmo_username AS poster_venmo_username,
        u.venmo_phone AS poster_venmo_phone,
        u.timezone AS poster_timezone,
        u.default_location AS poster_default_location,
        u.default_location_code AS poster_default_location_code,
        u.default_city AS poster_default_city,
        u.default_country AS poster_default_country,
        u.auth_provider AS poster_auth_provider,
        u.notification_preferences AS poster_notification_preferences,
        u.has_seen_home_onboarding AS poster_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS poster_has_seen_trip_onboarding,
        u.created_at AS poster_created_at,
        u.updated_at AS poster_updated_at
      FROM activities a
      JOIN users u ON u.id = a.posted_by
      WHERE a.trip_calendar_id = $1
        AND a.status <> 'canceled'
      ORDER BY a.start_time ASC, a.id ASC
      `,
      [tripId],
    );

    const legacyActivities: ActivityWithDetails[] = [];

    if (activityRows.length > 0) {
      const activityIds = activityRows.map((row) => row.id);

      await this.ensureActivityInviteStructures();

      const { rows: inviteRows } = await query<ActivityInviteWithUserRow>(
        `
        SELECT
          ai.id,
          ai.activity_id,
          ai.user_id,
          ai.status,
          ai.responded_at,
          ai.created_at,
          ai.updated_at,
          ${selectUserColumns("u", "user_")}
        FROM activity_invites ai
        JOIN users u ON u.id = ai.user_id
        WHERE ai.activity_id = ANY($1::int[])
        ORDER BY
          CASE ai.status
            WHEN 'accepted' THEN 0
            WHEN 'pending' THEN 1
            ELSE 2
          END,
          ai.responded_at ASC NULLS LAST,
          ai.created_at ASC,
          ai.id ASC
        `,
        [activityIds],
      );

      const { rows: commentRows } = await query<ActivityCommentWithUserRow>(
        `
        SELECT
          ac.id,
          ac.activity_id,
          ac.user_id AS comment_user_id,
          ac.comment,
          ac.created_at,
          u.id AS user_id,
          u.email AS user_email,
          u.username AS user_username,
          u.first_name AS user_first_name,
          u.last_name AS user_last_name,
          u.phone_number AS user_phone_number,
          u.password_hash AS user_password_hash,
          u.profile_image_url AS user_profile_image_url,
          u.cashapp_username AS user_cashapp_username,
          u.cash_app_username AS user_cash_app_username,
          u.cashapp_phone AS user_cashapp_phone,
          u.cash_app_phone AS user_cash_app_phone,
          u.venmo_username AS user_venmo_username,
          u.venmo_phone AS user_venmo_phone,
          u.timezone AS user_timezone,
          u.default_location AS user_default_location,
          u.default_location_code AS user_default_location_code,
          u.default_city AS user_default_city,
          u.default_country AS user_default_country,
          u.auth_provider AS user_auth_provider,
          u.notification_preferences AS user_notification_preferences,
          u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
          u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at
        FROM activity_comments ac
        JOIN users u ON u.id = ac.user_id
        WHERE ac.activity_id = ANY($1::int[])
        ORDER BY ac.created_at ASC, ac.id ASC
        `,
        [activityIds],
      );

      const inviteMap = new Map<number, (ActivityInvite & { user: User })[]>();
      for (const row of inviteRows) {
        const invite: ActivityInvite & { user: User } = {
          ...mapActivityInvite(row),
          user: mapUserFromPrefix(row, "user_"),
        };
        const list = inviteMap.get(row.activity_id) ?? [];
        list.push(invite);
        inviteMap.set(row.activity_id, list);
      }

      const commentMap = new Map<number, (ActivityComment & { user: User })[]>();
      for (const row of commentRows) {
        const comment: ActivityComment & { user: User } = {
          ...mapComment(row),
          user: mapUserFromPrefix(row, "user_"),
        };
        const list = commentMap.get(row.activity_id) ?? [];
        list.push(comment);
        commentMap.set(row.activity_id, list);
      }

      for (const row of activityRows) {
        const poster = mapUserFromPrefix(row, "poster_");
        const invites = inviteMap.get(row.id) ?? [];
        const acceptances = invites
          .filter((invite) => invite.status === "accepted")
          .map((invite, index) => ({
            id: invite.id * 1000 + index + 1,
            activityId: invite.activityId,
            userId: invite.userId,
            acceptedAt: invite.respondedAt,
            user: invite.user,
          }));
        const comments = commentMap.get(row.id) ?? [];
        const currentUserInvite = invites.find((invite) => invite.userId === userId);
        const isAccepted = currentUserInvite?.status === "accepted" ? true : undefined;
        const hasResponded =
          currentUserInvite && currentUserInvite.status !== "pending" ? true : undefined;

        const legacyActivity = {
          ...mapActivityWithDetails(row),
          poster,
          invites,
          acceptances,
          comments,
          acceptedCount: invites.filter((invite) => invite.status === "accepted").length,
          pendingCount: invites.filter((invite) => invite.status === "pending").length,
          declinedCount: invites.filter((invite) => invite.status === "declined").length,
          waitlistedCount: invites.filter((invite) => invite.status === "waitlisted").length,
          currentUserInvite: currentUserInvite ?? null,
          isAccepted,
          hasResponded,
          permissions: {
            canCancel: row.posted_by === userId,
          },
        } satisfies ActivityWithDetails & {
          poster: User;
          invites: (ActivityInvite & { user: User })[];
          acceptances: (ActivityAcceptance & { user: User })[];
          comments: (ActivityComment & { user: User })[];
          currentUserInvite: (ActivityInvite & { user: User }) | null;
          permissions: { canCancel: boolean };
        };

        legacyActivities.push(legacyActivity);
      }
    }

    const combined = [...legacyActivities];

    if (combined.length <= 1) {
      return combined;
    }

    const getSortValue = (activity: ActivityWithDetails): number => {
      const startTime = activity.startTime ? Date.parse(activity.startTime) : Number.NaN;
      if (!Number.isNaN(startTime)) {
        return startTime;
      }
      const created = activity.createdAt ? Date.parse(activity.createdAt) : Number.NaN;
      if (!Number.isNaN(created)) {
        return created;
      }
      return Number.MAX_SAFE_INTEGER;
    };

    return combined.sort((a, b) => {
      const aValue = getSortValue(a);
      const bValue = getSortValue(b);
      if (aValue !== bValue) {
        return aValue - bValue;
      }
      return a.id - b.id;
    });
  }


  async cancelActivity(activityId: number, currentUserId: string): Promise<Activity> {
    const activity = await this.getActivityById(activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    const proposerId = normalizeUserId(activity.postedBy);
    const requesterId = normalizeUserId(currentUserId);

    if (!proposerId || !requesterId || proposerId !== requesterId) {
      throw new Error("You can only cancel activities you created");
    }

    const trip = await this.getTripById(activity.tripCalendarId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    const isMember = trip.members.some((member) => member.userId === currentUserId);
    if (!isMember) {
      throw new Error("You are no longer a member of this trip");
    }

    await query("BEGIN");
    try {
      await query(`DELETE FROM activity_comments WHERE activity_id = $1`, [activityId]);
      await query(`DELETE FROM activity_invites WHERE activity_id = $1`, [activityId]);
      await query(`DELETE FROM notifications WHERE activity_id = $1`, [activityId]);
      await query(
        `DELETE FROM proposal_schedule_links WHERE scheduled_table = 'activities' AND scheduled_id = $1`,
        [activityId],
      );
      await query(
        `UPDATE activities SET status = 'canceled', updated_at = NOW() WHERE id = $1`,
        [activityId],
      );
      await query("COMMIT");
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }

    const updatedActivity = await this.getActivityById(activityId);

    await this.notifyProposalCancellation({
      tripId: activity.tripCalendarId,
      proposalType: "activity",
      proposalName: activity.name,
      canceledBy: currentUserId,
    });

    return updatedActivity ?? { ...activity, status: "canceled" };
  }

  async convertActivityProposalToScheduled(
    activityId: number,
    currentUserId: string,
  ): Promise<ActivityWithDetails> {
    await this.ensureActivityTypeColumn();

    const activity = await this.getActivityById(activityId);
    if (!activity) {
      throw new Error("Activity not found");
    }

    const proposerId = normalizeUserId(activity.postedBy);
    const requesterId = normalizeUserId(currentUserId);

    if (!proposerId || !requesterId || proposerId !== requesterId) {
      throw new Error("You can only convert activities you created");
    }

    const normalizedStatus = (activity.status ?? "").toLowerCase();
    if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
      throw new Error("This activity has been canceled");
    }

    if (toActivityType(activity.type) !== "PROPOSE") {
      throw new Error("Activity is already scheduled");
    }

    if (!activity.startTime) {
      throw new Error("Add a start time before scheduling this activity");
    }

    const trip = await this.getTripById(activity.tripCalendarId);
    if (!trip) {
      throw new Error("Trip not found");
    }

    const isMember = trip.members.some((member) => member.userId === currentUserId);
    if (!isMember) {
      throw new Error("You are no longer a member of this trip");
    }

    await query(
      `UPDATE activities SET type = 'SCHEDULED', updated_at = NOW() WHERE id = $1`,
      [activityId],
    );

    const activities = await this.getTripActivities(activity.tripCalendarId, currentUserId);
    const updatedActivity = activities.find((item) => item.id === activityId);
    if (!updatedActivity) {
      throw new Error("Failed to load updated activity");
    }

    return updatedActivity;
  }

  async acceptActivity(activityId: number, userId: string): Promise<void> {
    await this.setActivityInviteStatus(activityId, userId, "accepted");
  }

  async declineActivity(activityId: number, userId: string): Promise<void> {
    await this.setActivityInviteStatus(activityId, userId, "declined");
  }

  async addComment(
    comment: InsertActivityComment,
    userId: string,
  ): Promise<ActivityComment> {
    const { rows } = await query<ActivityCommentRow>(
      `
      INSERT INTO activity_comments (activity_id, user_id, comment)
      VALUES ($1, $2, $3)
      RETURNING id, activity_id, user_id, comment, created_at
      `,
      [comment.activityId, userId, comment.comment],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to add comment");
    }

    return mapComment(row);
  }

  async getActivityComments(
    activityId: number,
  ): Promise<(ActivityComment & { user: User })[]> {
    const { rows } = await query<ActivityCommentWithUserRow>(
      `
      SELECT
        ac.id,
        ac.activity_id,
        ac.user_id AS comment_user_id,
        ac.comment,
        ac.created_at,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM activity_comments ac
      JOIN users u ON u.id = ac.user_id
      WHERE ac.activity_id = $1
      ORDER BY ac.created_at ASC, ac.id ASC
      `,
      [activityId],
    );

    return rows.map((row) => ({
      ...mapComment(row),
      user: mapUserFromPrefix(row, "user_"),
    }));
  }

  async addPackingItem(
    item: InsertPackingItem,
    userId: string,
  ): Promise<PackingItem> {
    await this.ensurePackingStructures();

    const { rows } = await query<PackingItemRow>(
      `
      INSERT INTO packing_items (
        trip_id,
        user_id,
        item,
        category,
        item_type,
        is_checked,
        assigned_user_id
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, FALSE), $7)
      RETURNING
        id,
        trip_id,
        user_id,
        item,
        category,
        item_type,
        is_checked,
        assigned_user_id,
        created_at
      `,
      [
        item.tripId,
        userId,
        item.item,
        item.category ?? null,
        item.itemType ?? "personal",
        item.isChecked ?? false,
        item.assignedUserId ?? null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to add packing item");
    }

    return mapPackingItem(row);
  }

  async getPackingItemById(itemId: number): Promise<PackingItem | null> {
    const { rows } = await query<PackingItemRow>(
      `
      SELECT
        id,
        trip_id,
        user_id,
        item,
        category,
        item_type,
        is_checked,
        assigned_user_id,
        created_at
      FROM packing_items
      WHERE id = $1
      LIMIT 1
      `,
      [itemId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return mapPackingItem(row);
  }

  async getTripPackingItems(
    tripId: number,
    userId: string,
  ): Promise<(PackingItem & { user: User })[]> {
    await this.ensurePackingStructures();

    const { rows } = await query<PackingItemWithStatusRow>(
      `
      WITH member_counts AS (
        SELECT tm.trip_calendar_id AS trip_id, COUNT(*) AS member_count
        FROM trip_members tm
        WHERE tm.trip_calendar_id = $1
        GROUP BY tm.trip_calendar_id
      ),
      status_counts AS (
        SELECT
          pis.item_id,
          COUNT(*) FILTER (WHERE pis.is_checked) AS checked_count
        FROM packing_item_statuses pis
        WHERE pis.item_id IN (SELECT id FROM packing_items WHERE trip_id = $1)
        GROUP BY pis.item_id
      )
      SELECT
        pi.id,
        pi.trip_id,
        pi.user_id AS item_user_id,
        pi.item,
        pi.category,
        pi.item_type,
        pi.is_checked,
        pi.assigned_user_id,
        pi.created_at,
        COALESCE(pis_current.is_checked, FALSE) AS current_user_is_checked,
        COALESCE(sc.checked_count, 0) AS group_checked_count,
        COALESCE(mc.member_count, 0) AS trip_member_count,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM packing_items pi
      JOIN users u ON u.id = pi.user_id
      LEFT JOIN packing_item_statuses pis_current
        ON pis_current.item_id = pi.id AND pis_current.user_id = $2
      LEFT JOIN status_counts sc ON sc.item_id = pi.id
      LEFT JOIN member_counts mc ON mc.trip_id = pi.trip_id
      WHERE pi.trip_id = $1
        AND (
          pi.item_type = 'group'
          OR pi.user_id = $2
        )
      ORDER BY pi.created_at ASC, pi.id ASC
      `,
      [tripId, userId],
    );

    return rows.map(mapPackingItemWithStatus);
  }

  private async getPackingItemWithStatus(
    itemId: number,
    tripId: number,
    userId: string,
  ): Promise<(PackingItem & { user: User }) | null> {
    await this.ensurePackingStructures();

    const { rows } = await query<PackingItemWithStatusRow>(
      `
      WITH member_counts AS (
        SELECT tm.trip_calendar_id AS trip_id, COUNT(*) AS member_count
        FROM trip_members tm
        WHERE tm.trip_calendar_id = $2
        GROUP BY tm.trip_calendar_id
      ),
      status_counts AS (
        SELECT
          pis.item_id,
          COUNT(*) FILTER (WHERE pis.is_checked) AS checked_count
        FROM packing_item_statuses pis
        WHERE pis.item_id = $1
        GROUP BY pis.item_id
      )
      SELECT
        pi.id,
        pi.trip_id,
        pi.user_id AS item_user_id,
        pi.item,
        pi.category,
        pi.item_type,
        pi.is_checked,
        pi.assigned_user_id,
        pi.created_at,
        COALESCE(pis_current.is_checked, FALSE) AS current_user_is_checked,
        COALESCE(sc.checked_count, 0) AS group_checked_count,
        COALESCE(mc.member_count, 0) AS trip_member_count,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at
      FROM packing_items pi
      JOIN users u ON u.id = pi.user_id
      LEFT JOIN packing_item_statuses pis_current
        ON pis_current.item_id = pi.id AND pis_current.user_id = $3
      LEFT JOIN status_counts sc ON sc.item_id = pi.id
      LEFT JOIN member_counts mc ON mc.trip_id = pi.trip_id
      WHERE pi.id = $1 AND pi.trip_id = $2
      LIMIT 1
      `,
      [itemId, tripId, userId],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return mapPackingItemWithStatus(row);
  }

  async markGroupItemHandled(
    itemId: number,
    tripId: number,
    userId: string,
  ): Promise<PackingItem & { user: User }> {
    await this.ensurePackingStructures();

    await query(
      `
      INSERT INTO packing_item_statuses (item_id, user_id, is_checked)
      VALUES ($1, $2, TRUE)
      ON CONFLICT (item_id, user_id)
      DO UPDATE SET
        is_checked = TRUE,
        updated_at = NOW()
      `,
      [itemId, userId],
    );

    const updated = await this.getPackingItemWithStatus(itemId, tripId, userId);
    if (!updated) {
      throw new Error("Packing item not found after updating status");
    }

    return updated;
  }

  async markGroupItemUnhandled(
    itemId: number,
    tripId: number,
    userId: string,
  ): Promise<PackingItem & { user: User }> {
    await this.ensurePackingStructures();

    await query(
      `
      DELETE FROM packing_item_statuses
      WHERE item_id = $1 AND user_id = $2
      `,
      [itemId, userId],
    );

    const updated = await this.getPackingItemWithStatus(itemId, tripId, userId);
    if (!updated) {
      throw new Error("Packing item not found after updating status");
    }

    return updated;
  }

  async togglePackingItem(
    itemId: number,
    userId: string,
    itemType: "personal" | "group",
  ): Promise<void> {
    if (itemType === "group") {
      await this.ensurePackingStructures();

      const { rows } = await query<{ is_checked: boolean }>(
        `
        INSERT INTO packing_item_statuses (item_id, user_id, is_checked)
        VALUES ($1, $2, TRUE)
        ON CONFLICT (item_id, user_id)
        DO UPDATE SET
          is_checked = NOT packing_item_statuses.is_checked,
          updated_at = NOW()
        RETURNING is_checked
        `,
        [itemId, userId],
      );

      if (!rows[0]) {
        throw new Error("Packing item status not found");
      }

      return;
    }

    const { rows } = await query<{ id: number }>(
      `
      UPDATE packing_items
      SET is_checked = NOT is_checked
      WHERE id = $1
      RETURNING id
      `,
      [itemId],
    );

    if (!rows[0]) {
      throw new Error("Packing item not found");
    }
  }

  async deletePackingItem(itemId: number, _userId: string): Promise<void> {
    const { rows } = await query<{ id: number }>(
      `
      DELETE FROM packing_items
      WHERE id = $1
      RETURNING id
      `,
      [itemId],
    );

    if (!rows[0]) {
      throw new Error("Packing item not found");
    }
  }
  async createExpense(
    expense: CreateExpensePayload,
    userId: string,
  ): Promise<Expense> {
    await query("BEGIN");
    let participantIds: string[] = [];
    let createdExpenseRow: ExpenseRow | null = null;
    try {
      const payerId = expense.paidBy ?? userId;
      const participantUserIds = Array.isArray(expense.participantUserIds)
        ? expense.participantUserIds
        : [];

      const dedupedParticipants: string[] = [];
      const seenParticipants = new Set<string>();
      for (const rawId of participantUserIds) {
        if (typeof rawId !== "string") {
          continue;
        }
        const trimmed = rawId.trim();
        if (!trimmed || trimmed === payerId || seenParticipants.has(trimmed)) {
          continue;
        }
        seenParticipants.add(trimmed);
        dedupedParticipants.push(trimmed);
      }

      if (dedupedParticipants.length === 0) {
        throw new Error("Choose at least one person to split with.");
      }

      if (
        !Number.isInteger(expense.sourceAmountMinorUnits) ||
        expense.sourceAmountMinorUnits <= 0
      ) {
        throw new Error("Amount must be greater than zero");
      }

      const splitResult = computeSplits({
        totalSourceMinorUnits: expense.sourceAmountMinorUnits,
        debtorIds: dedupedParticipants,
        sourceCurrency: expense.sourceCurrency,
        targetCurrency: expense.targetCurrency,
        conversionRate: expense.exchangeRate,
      });

      const targetTotalMinorUnits = splitResult.totalTargetMinorUnits;
      const sourceTotalMinorUnits = splitResult.totalSourceMinorUnits;
      const targetTotalAmount = minorUnitsToAmount(
        targetTotalMinorUnits,
        expense.targetCurrency,
      );
      const sourceTotalAmount = minorUnitsToAmount(
        sourceTotalMinorUnits,
        expense.sourceCurrency,
      );

      const lockedAtDate = expense.exchangeRateLockedAt
        ? new Date(expense.exchangeRateLockedAt)
        : new Date();
      const safeLockedAt = Number.isNaN(lockedAtDate.getTime())
        ? new Date().toISOString()
        : lockedAtDate.toISOString();

      const conversionDetails = {
        source: {
          currency: expense.sourceCurrency,
          minorUnits: sourceTotalMinorUnits,
        },
        target: {
          currency: expense.targetCurrency,
          minorUnits: targetTotalMinorUnits,
        },
        rate: {
          value: expense.exchangeRate,
          lockedAt: safeLockedAt,
          provider: expense.exchangeRateProvider ?? null,
        },
      } as Record<string, unknown>;

      const splitDataToStore: Record<string, unknown> = {
        algorithm: "equal_payer_included",
        members: dedupedParticipants,
        totalSourceMinorUnits: sourceTotalMinorUnits,
        totalTargetMinorUnits: targetTotalMinorUnits,
        sourceCurrency: expense.sourceCurrency,
        targetCurrency: expense.targetCurrency,
        conversionRate: expense.exchangeRate,
        shares: splitResult.shares,
      };

      const { rows } = await query<ExpenseRow>(
        `
        INSERT INTO expenses (
          trip_id,
          paid_by,
          amount,
          currency,
          exchange_rate,
          original_currency,
          converted_amounts,
          description,
          category,
          activity_id,
          split_type,
          split_data,
          receipt_url
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13
        )
        RETURNING
          id,
          trip_id,
          paid_by,
          amount,
          currency,
          exchange_rate,
          original_currency,
          converted_amounts,
          description,
          category,
          activity_id,
          split_type,
          split_data,
          receipt_url,
          created_at,
          updated_at
        `,
        [
          expense.tripId,
          payerId,
          targetTotalAmount,
          expense.targetCurrency,
          expense.exchangeRate,
          expense.sourceCurrency,
          conversionDetails,
          expense.description,
          expense.category,
          null,
          "equal",
          splitDataToStore,
          expense.receiptUrl ?? null,
        ],
      );

      const row = rows[0];
      if (!row) {
        throw new Error("Failed to create expense");
      }

      participantIds = dedupedParticipants;

      for (const share of splitResult.shares) {
        await query(
          `
          INSERT INTO expense_shares (
            expense_id,
            user_id,
            amount,
            is_paid
          )
          VALUES ($1, $2, $3, FALSE)
          `,
          [
            row.id,
            share.userId,
            minorUnitsToAmount(share.targetMinorUnits, expense.targetCurrency),
          ],
        );
      }

      createdExpenseRow = row;
      await query("COMMIT");

      const participantsToNotify = Array.from(new Set(participantIds)).filter(
        (participantId) =>
          Boolean(participantId) && participantId !== createdExpenseRow?.paid_by,
      );

      if (participantsToNotify.length > 0) {
        try {
          const payerUser = await this.getUser(payerId);
          const payerName =
            (payerUser?.firstName && payerUser.firstName.trim()) ||
            (payerUser?.username && payerUser.username.trim()) ||
            (payerUser?.email && payerUser.email.trim()) ||
            "A trip member";

          const formattedTarget = (() => {
            try {
              return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: expense.targetCurrency,
              }).format(targetTotalAmount);
            } catch {
              return `${expense.targetCurrency} ${targetTotalAmount.toFixed(2)}`;
            }
          })();

          const formattedSource = (() => {
            try {
              return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: expense.sourceCurrency,
              }).format(sourceTotalAmount);
            } catch {
              return `${expense.sourceCurrency} ${sourceTotalAmount.toFixed(2)}`;
            }
          })();

          const trimmedDescription = expense.description.trim();
          const expenseDescription = trimmedDescription
            ? trimmedDescription
            : "an expense";
          const notificationTitle = `${payerName} added a new expense`;
          const notificationMessage =
            `${payerName} recorded ${formattedSource} (${formattedTarget} requested) for ${expenseDescription}. You're tagged to split it at a rate of ${expense.exchangeRate}.`;

          await Promise.all(
            participantsToNotify.map((participantId) =>
              this.createNotification({
                userId: participantId,
                type: "expense",
                title: notificationTitle,
                message: notificationMessage,
                tripId: expense.tripId,
                expenseId: row.id,
              }),
            ),
          );
        } catch (notificationError) {
          console.error(
            "Failed to create expense notifications:",
            notificationError,
          );
        }
      }
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }

    if (!createdExpenseRow) {
      throw new Error("Failed to create expense");
    }

    return mapExpense(createdExpenseRow);
  }

  async getTripExpenses(tripId: number): Promise<ExpenseWithDetails[]> {
    await this.ensureActivityTypeColumn();

    const { rows: expenseRows } = await query<ExpenseWithPaidByRow>(
      `
      SELECT
        e.id,
        e.trip_id,
        e.paid_by,
        e.amount,
        e.currency,
        e.exchange_rate,
        e.original_currency,
        e.converted_amounts,
        e.description,
        e.category,
        e.activity_id,
        e.split_type,
        e.split_data,
        e.receipt_url,
        e.created_at,
        e.updated_at,
        u.id AS paid_by_id,
        u.email AS paid_by_email,
        u.username AS paid_by_username,
        u.first_name AS paid_by_first_name,
        u.last_name AS paid_by_last_name,
        u.phone_number AS paid_by_phone_number,
        u.password_hash AS paid_by_password_hash,
        u.profile_image_url AS paid_by_profile_image_url,
        u.cashapp_username AS paid_by_cashapp_username,
        u.cash_app_username AS paid_by_cash_app_username,
        u.cashapp_phone AS paid_by_cashapp_phone,
        u.cash_app_phone AS paid_by_cash_app_phone,
        u.venmo_username AS paid_by_venmo_username,
        u.venmo_phone AS paid_by_venmo_phone,
        u.timezone AS paid_by_timezone,
        u.default_location AS paid_by_default_location,
        u.default_location_code AS paid_by_default_location_code,
        u.default_city AS paid_by_default_city,
        u.default_country AS paid_by_default_country,
        u.auth_provider AS paid_by_auth_provider,
        u.notification_preferences AS paid_by_notification_preferences,
        u.has_seen_home_onboarding AS paid_by_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS paid_by_has_seen_trip_onboarding,
        u.created_at AS paid_by_created_at,
        u.updated_at AS paid_by_updated_at
      FROM expenses e
      JOIN users u ON u.id = e.paid_by
      WHERE e.trip_id = $1
      ORDER BY e.created_at DESC NULLS LAST, e.id DESC
      `,
      [tripId],
    );

    if (expenseRows.length === 0) {
      return [];
    }

    const expenseIds = expenseRows.map((row) => row.id);

    const { rows: shareRows } = await query<ExpenseShareWithUserRow>(
      `
      SELECT
        es.id,
        es.expense_id,
        es.user_id AS share_participant_id,
        es.amount,
        es.is_paid,
        es.paid_at,
        es.created_at,
        su.id AS share_user_id,
        su.email AS share_user_email,
        su.username AS share_user_username,
        su.first_name AS share_user_first_name,
        su.last_name AS share_user_last_name,
        su.phone_number AS share_user_phone_number,
        su.password_hash AS share_user_password_hash,
        su.profile_image_url AS share_user_profile_image_url,
        su.cashapp_username AS share_user_cashapp_username,
        su.cash_app_username AS share_user_cash_app_username,
        su.cashapp_phone AS share_user_cashapp_phone,
        su.cash_app_phone AS share_user_cash_app_phone,
        su.venmo_username AS share_user_venmo_username,
        su.venmo_phone AS share_user_venmo_phone,
        su.timezone AS share_user_timezone,
        su.default_location AS share_user_default_location,
        su.default_location_code AS share_user_default_location_code,
        su.default_city AS share_user_default_city,
        su.default_country AS share_user_default_country,
        su.auth_provider AS share_user_auth_provider,
        su.notification_preferences AS share_user_notification_preferences,
        su.has_seen_home_onboarding AS share_user_has_seen_home_onboarding,
        su.has_seen_trip_onboarding AS share_user_has_seen_trip_onboarding,
        su.created_at AS share_user_created_at,
        su.updated_at AS share_user_updated_at
      FROM expense_shares es
      JOIN users su ON su.id = es.user_id
      WHERE es.expense_id = ANY($1::int[])
      ORDER BY es.created_at ASC NULLS LAST, es.id ASC
      `,
      [expenseIds],
    );

    const sharesByExpenseId = new Map<
      number,
      { row: ExpenseShareRow; user: User }[]
    >();

    for (const row of shareRows) {
      const shareRow: ExpenseShareRow = {
        id: row.id,
        expense_id: row.expense_id,
        user_id: row.share_participant_id,
        amount: row.amount,
        is_paid: row.is_paid,
        paid_at: row.paid_at,
        created_at: row.created_at,
      };
      const user = mapUserFromPrefix(row, "share_user_");
      const existingShares = sharesByExpenseId.get(row.expense_id) ?? [];
      existingShares.push({ row: shareRow, user });
      sharesByExpenseId.set(row.expense_id, existingShares);
    }

    const activityIds = expenseRows
      .map((row) => row.activity_id)
      .filter((id): id is number => id !== null);

    const activityMap = new Map<number, Activity>();
    if (activityIds.length > 0) {
      const { rows: activityRows } = await query<ActivityRow>(
        `
        SELECT
          id,
          trip_calendar_id,
          posted_by,
          name,
          description,
          start_time,
          end_time,
          location,
          cost,
          max_capacity,
          category,
          status,
          type,
          created_at,
          updated_at
        FROM activities
        WHERE id = ANY($1::int[])
        `,
        [activityIds],
      );

      for (const row of activityRows) {
        activityMap.set(row.id, mapActivity(row));
      }
    }

    return expenseRows.map((row) =>
      mapExpenseWithDetails({
        ...row,
        shares: sharesByExpenseId.get(row.id) ?? [],
        activity: row.activity_id ? activityMap.get(row.activity_id) : undefined,
      }),
    );
  }

  async updateExpense(
    expenseId: number,
    updates: Partial<InsertExpense> & { selectedMembers?: string[] },
    userId: string,
  ): Promise<Expense> {
    const { rows: existingRows } = await query<ExpenseRow>(
      `
      SELECT
        id,
        trip_id,
        paid_by,
        amount,
        currency,
        exchange_rate,
        original_currency,
        converted_amounts,
        description,
        category,
        activity_id,
        split_type,
        split_data,
        receipt_url,
        created_at,
        updated_at
      FROM expenses
      WHERE id = $1
      `,
      [expenseId],
    );

    const existing = existingRows[0];
    if (!existing) {
      throw new Error("Expense not found");
    }

    if (existing.paid_by !== userId) {
      throw new Error("Only the payer can update this expense");
    }

    await query("BEGIN");
    try {
      const setClauses: string[] = [];
      const values: unknown[] = [];
      let index = 1;

      if (updates.description !== undefined) {
        setClauses.push(`description = $${index}`);
        values.push(updates.description);
        index += 1;
      }

      if (updates.amount !== undefined) {
        setClauses.push(`amount = $${index}`);
        values.push(updates.amount);
        index += 1;
      }

      if (updates.currency !== undefined) {
        setClauses.push(`currency = $${index}`);
        values.push(updates.currency);
        index += 1;
      }

      if (updates.exchangeRate !== undefined) {
        setClauses.push(`exchange_rate = $${index}`);
        values.push(updates.exchangeRate);
        index += 1;
      }

      if (updates.originalCurrency !== undefined) {
        setClauses.push(`original_currency = $${index}`);
        values.push(updates.originalCurrency);
        index += 1;
      }

      if (updates.convertedAmounts !== undefined) {
        setClauses.push(`converted_amounts = $${index}`);
        values.push(updates.convertedAmounts);
        index += 1;
      }

      if (updates.category !== undefined) {
        setClauses.push(`category = $${index}`);
        values.push(updates.category);
        index += 1;
      }

      if (updates.activityId !== undefined) {
        setClauses.push(`activity_id = $${index}`);
        values.push(updates.activityId ?? null);
        index += 1;
      }

      if (updates.splitType !== undefined) {
        setClauses.push(`split_type = $${index}`);
        values.push(updates.splitType);
        index += 1;
      }

      if (updates.splitData !== undefined) {
        setClauses.push(`split_data = $${index}`);
        values.push(updates.splitData);
        index += 1;
      }

      if (updates.receiptUrl !== undefined) {
        setClauses.push(`receipt_url = $${index}`);
        values.push(updates.receiptUrl);
        index += 1;
      }

      if (updates.paidBy !== undefined) {
        setClauses.push(`paid_by = $${index}`);
        values.push(updates.paidBy);
        index += 1;
      }

      if (setClauses.length > 0) {
        setClauses.push(`updated_at = NOW()`);
      } else {
        setClauses.push(`updated_at = NOW()`);
      }

      const sql = `
        UPDATE expenses
        SET ${setClauses.join(", ")}
        WHERE id = $${index} AND paid_by = $${index + 1}
        RETURNING
          id,
          trip_id,
          paid_by,
          amount,
          currency,
          exchange_rate,
          original_currency,
          converted_amounts,
          description,
          category,
          activity_id,
          split_type,
          split_data,
          receipt_url,
          created_at,
          updated_at
      `;

      values.push(expenseId, existing.paid_by);

      const { rows: updatedRows } = await query<ExpenseRow>(sql, values);
      const updatedExpense = updatedRows[0];
      if (!updatedExpense) {
        throw new Error("Failed to update expense");
      }

      const shouldUpdateShares =
        updates.splitData !== undefined ||
        updates.selectedMembers !== undefined ||
        updates.amount !== undefined ||
        updates.splitType !== undefined;

      if (shouldUpdateShares) {
        await query(`DELETE FROM expense_shares WHERE expense_id = $1`, [
          expenseId,
        ]);

        const splitData = (updates.splitData ?? updatedExpense.split_data) as
          | Record<string, unknown>
          | null;
        const membersFromSplitData = Array.isArray(
          (splitData as Record<string, unknown>)?.members as unknown[],
        )
          ? ((splitData as { members: string[] }).members ?? [])
          : undefined;
        const selectedMembers = Array.isArray(updates.selectedMembers)
          ? updates.selectedMembers
          : undefined;
        const participantIds =
          membersFromSplitData ??
          selectedMembers ??
          (Array.isArray(
            (updatedExpense.split_data as Record<string, unknown>)?.members as unknown[],
          )
            ? (
                (updatedExpense.split_data as { members: string[] }).members ??
                []
              )
            : []);

        if (participantIds.length > 0) {
          const payerId = updates.paidBy ?? updatedExpense.paid_by;
          const dedupedParticipants: string[] = [];
          const seenParticipants = new Set<string>();

          for (const rawId of participantIds) {
            if (typeof rawId !== "string") {
              continue;
            }
            const trimmed = rawId.trim();
            if (!trimmed || trimmed === payerId || seenParticipants.has(trimmed)) {
              continue;
            }
            seenParticipants.add(trimmed);
            dedupedParticipants.push(trimmed);
          }

          if (dedupedParticipants.length > 0) {
            const conversionMetadata =
              (updatedExpense.converted_amounts ?? null) as
                | ExpenseConversionMetadata
                | null;
            const splitData = updatedExpense.split_data as
              | { totalSourceMinorUnits?: number; conversionRate?: number; sourceCurrency?: string; targetCurrency?: string }
              | null;

            const sourceMinorUnits =
              (typeof conversionMetadata?.source?.minorUnits === "number"
                ? conversionMetadata.source?.minorUnits
                : undefined) ??
              (typeof splitData?.totalSourceMinorUnits === "number"
                ? splitData.totalSourceMinorUnits
                : undefined);

            if (typeof sourceMinorUnits !== "number" || sourceMinorUnits <= 0) {
              throw new Error("Existing expense is missing source amount information");
            }

            const sourceCurrency =
              (typeof updates.originalCurrency === "string"
                ? updates.originalCurrency
                : undefined) ??
              (typeof splitData?.sourceCurrency === "string"
                ? splitData.sourceCurrency
                : undefined) ??
              (typeof conversionMetadata?.source?.currency === "string"
                ? conversionMetadata.source.currency
                : undefined) ??
              updatedExpense.original_currency ??
              updatedExpense.currency;

            const targetCurrency =
              (typeof updates.currency === "string"
                ? updates.currency
                : undefined) ??
              (typeof splitData?.targetCurrency === "string"
                ? splitData.targetCurrency
                : undefined) ??
              (typeof conversionMetadata?.target?.currency === "string"
                ? conversionMetadata.target.currency
                : undefined) ??
              updatedExpense.currency;

            const conversionRate =
              typeof updates.exchangeRate === "number"
                ? updates.exchangeRate
                : typeof splitData?.conversionRate === "number"
                ? splitData.conversionRate
                : typeof conversionMetadata?.rate?.value === "number"
                ? conversionMetadata.rate.value
                : updatedExpense.exchange_rate
                ? Number(updatedExpense.exchange_rate)
                : 1;

            const splitComputation = computeSplits({
              totalSourceMinorUnits: sourceMinorUnits,
              debtorIds: dedupedParticipants,
              sourceCurrency,
              targetCurrency,
              conversionRate,
            });

            for (const split of splitComputation.shares) {
              await query(
                `
                INSERT INTO expense_shares (
                  expense_id,
                  user_id,
                  amount,
                  is_paid
                )
                VALUES ($1, $2, $3, FALSE)
                `,
                [
                  expenseId,
                  split.userId,
                  minorUnitsToAmount(split.targetMinorUnits, targetCurrency),
                ],
              );
            }
          }
        }
      }

      await query("COMMIT");
      return mapExpense(updatedExpense);
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  }

  async deleteExpense(expenseId: number, userId: string): Promise<void> {
    const { rows } = await query<ExpenseRow>(
      `
      SELECT
        id,
        paid_by
      FROM expenses
      WHERE id = $1
      `,
      [expenseId],
    );

    const expense = rows[0];
    if (!expense) {
      throw new Error("Expense not found");
    }

    if (expense.paid_by !== userId) {
      throw new Error("Only the payer can delete this expense");
    }

    await query("BEGIN");
    try {
      await query(`DELETE FROM expense_shares WHERE expense_id = $1`, [
        expenseId,
      ]);
      await query(`DELETE FROM notifications WHERE expense_id = $1`, [
        expenseId,
      ]);
      const { rows: deleted } = await query<{ id: number }>(
        `
        DELETE FROM expenses
        WHERE id = $1 AND paid_by = $2
        RETURNING id
        `,
        [expenseId, userId],
      );

      if (!deleted[0]) {
        throw new Error("Expense not found");
      }

      await query("COMMIT");
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  }

  async markExpenseAsPaid(expenseId: number, userId: string): Promise<void> {
    const { rows } = await query<{ id: number }>(
      `
      UPDATE expense_shares
      SET is_paid = TRUE,
          paid_at = COALESCE(paid_at, NOW())
      WHERE expense_id = $1 AND user_id = $2
      RETURNING id
      `,
      [expenseId, userId],
    );

    if (!rows[0]) {
      throw new Error("Expense share not found");
    }
  }

  async getExpenseShares(
    expenseId: number,
  ): Promise<(ExpenseShare & { user: User })[]> {
    const { rows } = await query<ExpenseShareWithContextRow>(
      `
      SELECT
        es.id,
        es.expense_id,
        es.user_id AS share_participant_id,
        es.amount,
        es.is_paid,
        es.paid_at,
        es.created_at,
        e.original_currency,
        e.currency,
        e.converted_amounts,
        e.split_data,
        su.id AS share_user_id,
        su.email AS share_user_email,
        su.username AS share_user_username,
        su.first_name AS share_user_first_name,
        su.last_name AS share_user_last_name,
        su.phone_number AS share_user_phone_number,
        su.password_hash AS share_user_password_hash,
        su.profile_image_url AS share_user_profile_image_url,
        su.cashapp_username AS share_user_cashapp_username,
        su.cash_app_username AS share_user_cash_app_username,
        su.cashapp_phone AS share_user_cashapp_phone,
        su.cash_app_phone AS share_user_cash_app_phone,
        su.venmo_username AS share_user_venmo_username,
        su.venmo_phone AS share_user_venmo_phone,
        su.timezone AS share_user_timezone,
        su.default_location AS share_user_default_location,
        su.default_location_code AS share_user_default_location_code,
        su.default_city AS share_user_default_city,
        su.default_country AS share_user_default_country,
        su.auth_provider AS share_user_auth_provider,
        su.notification_preferences AS share_user_notification_preferences,
        su.has_seen_home_onboarding AS share_user_has_seen_home_onboarding,
        su.has_seen_trip_onboarding AS share_user_has_seen_trip_onboarding,
        su.created_at AS share_user_created_at,
        su.updated_at AS share_user_updated_at
      FROM expense_shares es
      JOIN users su ON su.id = es.user_id
      JOIN expenses e ON e.id = es.expense_id
      WHERE es.expense_id = $1
      ORDER BY es.created_at ASC NULLS LAST, es.id ASC
      `,
      [expenseId],
    );

    if (rows.length === 0) {
      return [];
    }

    const conversionMetadata = (rows[0].converted_amounts ?? null) as
      | ExpenseConversionMetadata
      | null;
    const shareBreakdowns = new Map<string, ExpenseShareBreakdown>();
    const splitData = rows[0].split_data as
      | { shares?: ExpenseShareBreakdown[] }
      | null;
    if (splitData?.shares && Array.isArray(splitData.shares)) {
      for (const share of splitData.shares) {
        if (!share || typeof share.userId !== "string") {
          continue;
        }
        shareBreakdowns.set(share.userId, share);
      }
    }

    const currencies = {
      source:
        conversionMetadata?.source?.currency ?? rows[0].original_currency ?? null,
      target:
        conversionMetadata?.target?.currency ?? rows[0].currency ?? null,
    };

    return rows.map((row) => {
      const shareRow: ExpenseShareRow = {
        id: row.id,
        expense_id: row.expense_id,
        user_id: row.share_participant_id,
        amount: row.amount,
        is_paid: row.is_paid,
        paid_at: row.paid_at,
        created_at: row.created_at,
      };
      const share = mapExpenseShare(
        shareRow,
        shareBreakdowns.get(row.share_participant_id) ?? undefined,
        currencies,
      );

      return {
        ...share,
        user: mapUserFromPrefix(row, "share_user_"),
      };
    });
  }

  async getUserExpenseBalances(
    tripId: number,
    userId: string,
  ): Promise<{ owes: number; owed: number; balance: number }> {
    const { rows } = await query<{ owes: string; owed: string }>(
      `
      SELECT
        COALESCE(SUM(CASE WHEN es.user_id = $2 AND es.is_paid = FALSE THEN es.amount::numeric ELSE 0 END), 0)::text AS owes,
        COALESCE(SUM(CASE WHEN e.paid_by = $2 AND es.user_id <> $2 AND es.is_paid = FALSE THEN es.amount::numeric ELSE 0 END), 0)::text AS owed
      FROM expenses e
      JOIN expense_shares es ON es.expense_id = e.id
      WHERE e.trip_id = $1
      `,
      [tripId, userId],
    );

    const owes = rows[0] ? Number(rows[0].owes ?? 0) : 0;
    const owed = rows[0] ? Number(rows[0].owed ?? 0) : 0;

    return {
      owes,
      owed,
      balance: owed - owes,
    };
  }

  async createNotification(
    notification: InsertNotification,
    client?: PoolClient,
  ): Promise<Notification> {
    const execute = <T>(sql: string, params: unknown[] = []) =>
      client ? client.query<T>(sql, params) : query<T>(sql, params);

    const { rows } = await execute<NotificationRow>(
      `
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        trip_id,
        activity_id,
        expense_id,
        is_read
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, FALSE))
      RETURNING
        id,
        user_id,
        type,
        title,
        message,
        trip_id,
        activity_id,
        expense_id,
        is_read,
        created_at
      `,
      [
        notification.userId,
        notification.type,
        notification.title,
        notification.message,
        notification.tripId ?? null,
        notification.activityId ?? null,
        notification.expenseId ?? null,
        notification.isRead ?? false,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create notification");
    }

    return mapNotification(row);
  }

  async getUserNotifications(
    userId: string,
  ): Promise<
    (Notification & { trip?: TripCalendar; activity?: Activity; expense?: Expense })[]
  > {
    await this.ensureActivityTypeColumn();

    const { rows } = await query<NotificationWithDetailsRow>(
      `
      SELECT
        n.id,
        n.user_id,
        n.type,
        n.title,
        n.message,
        n.trip_id,
        n.activity_id,
        n.expense_id,
        n.is_read,
        n.created_at,
        t.id AS joined_trip_id,
        t.name AS trip_name,
        t.destination AS trip_destination,
        t.start_date AS trip_start_date,
        t.end_date AS trip_end_date,
        t.share_code AS trip_share_code,
        t.created_by AS trip_created_by,
        t.created_at AS trip_created_at,
        a.id AS joined_activity_id,
        a.trip_calendar_id AS activity_trip_calendar_id,
        a.posted_by AS activity_posted_by,
        a.name AS activity_name,
        a.description AS activity_description,
        a.start_time AS activity_start_time,
        a.end_time AS activity_end_time,
        a.location AS activity_location,
        a.cost AS activity_cost,
        a.max_capacity AS activity_max_capacity,
        a.category AS activity_category,
        a.status AS activity_status,
        a.type AS activity_type,
        a.created_at AS activity_created_at,
        a.updated_at AS activity_updated_at,
        e.id AS joined_expense_id,
        e.trip_id AS expense_trip_id,
        e.paid_by AS expense_paid_by,
        e.amount AS expense_amount,
        e.currency AS expense_currency,
        e.exchange_rate AS expense_exchange_rate,
        e.original_currency AS expense_original_currency,
        e.converted_amounts AS expense_converted_amounts,
        e.description AS expense_description,
        e.category AS expense_category,
        e.activity_id AS expense_activity_id,
        e.split_type AS expense_split_type,
        e.split_data AS expense_split_data,
        e.receipt_url AS expense_receipt_url,
        e.created_at AS expense_created_at,
        e.updated_at AS expense_updated_at
      FROM notifications n
      LEFT JOIN trip_calendars t ON t.id = n.trip_id
      LEFT JOIN activities a ON a.id = n.activity_id
      LEFT JOIN expenses e ON e.id = n.expense_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC NULLS LAST, n.id DESC
      `,
      [userId],
    );

    return rows.map((row) => {
      const notification = mapNotification(row);
      const result: Notification & {
        trip?: TripCalendar;
        activity?: Activity;
        expense?: Expense;
      } = { ...notification };

      if (row.joined_trip_id !== null) {
        const tripRow: TripRow = {
          id: row.joined_trip_id,
          name: row.trip_name as string,
          destination: row.trip_destination as string,
          start_date: row.trip_start_date as Date,
          end_date: row.trip_end_date as Date,
          share_code: row.trip_share_code as string,
          created_by: row.trip_created_by as string,
          created_at: row.trip_created_at,
          geoname_id: null,
          city_name: null,
          country_name: null,
          latitude: null,
          longitude: null,
          population: null,
          cover_photo_url: null,
          cover_photo_card_url: null,
          cover_photo_thumb_url: null,
          cover_photo_alt: null,
          cover_photo_attribution: null,
          cover_photo_storage_key: null,
          cover_photo_original_url: null,
          cover_photo_focal_x: null,
          cover_photo_focal_y: null,
        };
        result.trip = mapTrip(tripRow);
      }

      if (row.joined_activity_id !== null) {
        const activityRow: ActivityRow = {
          id: row.joined_activity_id,
          trip_calendar_id: row.activity_trip_calendar_id as number,
          posted_by: row.activity_posted_by as string,
          name: row.activity_name as string,
          description: row.activity_description,
          start_time: row.activity_start_time as Date,
          end_time: row.activity_end_time,
          location: row.activity_location,
          cost: row.activity_cost,
          max_capacity: row.activity_max_capacity,
          category: row.activity_category as string,
          status: (row.activity_status ?? "active") as string,
          type: row.activity_type ?? null,
          created_at: row.activity_created_at,
          updated_at: row.activity_updated_at,
        };
        result.activity = mapActivity(activityRow);
      }

      if (row.joined_expense_id !== null) {
        const expenseRow: ExpenseRow = {
          id: row.joined_expense_id,
          trip_id: row.expense_trip_id as number,
          paid_by: row.expense_paid_by as string,
          amount: (row.expense_amount ?? "0").toString(),
          currency: row.expense_currency as string,
          exchange_rate: row.expense_exchange_rate,
          original_currency: row.expense_original_currency,
          converted_amounts: row.expense_converted_amounts,
          description: row.expense_description as string,
          category: row.expense_category as string,
          activity_id: row.expense_activity_id,
          split_type: (row.expense_split_type ?? "equal") as
            | "equal"
            | "percentage"
            | "exact",
          split_data: row.expense_split_data,
          receipt_url: row.expense_receipt_url,
          created_at: row.expense_created_at,
          updated_at: row.expense_updated_at,
        };
        result.expense = mapExpense(expenseRow);
      }

      return result;
    });
  }

  async markNotificationAsRead(
    notificationId: number,
    userId: string,
  ): Promise<void> {
    const { rows } = await query<{ id: number }>(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1 AND user_id = $2
      RETURNING id
      `,
      [notificationId, userId],
    );

    if (!rows[0]) {
      throw new Error("Notification not found");
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await query(
      `
      UPDATE notifications
      SET is_read = TRUE
      WHERE user_id = $1 AND is_read = FALSE
      `,
      [userId],
    );
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const { rows } = await query<{ count: string }>(
      `
      SELECT COUNT(*)::text AS count
      FROM notifications
      WHERE user_id = $1 AND is_read = FALSE
      `,
      [userId],
    );

    return rows[0] ? Number(rows[0].count ?? 0) : 0;
  }
  async createGroceryItem(
    item: InsertGroceryItem,
    userId: string,
  ): Promise<GroceryItem> {
    const estimatedCostValue =
      item.estimatedCost === undefined ? null : item.estimatedCost;

    const actualCostValue = item.actualCost === undefined ? null : item.actualCost;

    const notesValue = serializeGroceryNotes(item.notes ?? null);

    const { rows } = await query<GroceryItemRow>(
      `
      INSERT INTO grocery_items (
        trip_id,
        added_by,
        item,
        category,
        quantity,
        estimated_cost,
        notes,
        is_purchased,
        actual_cost,
        receipt_line_item
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        COALESCE($8, FALSE),
        $9,
        $10
      )
      RETURNING
        id,
        trip_id,
        added_by,
        item,
        category,
        quantity,
        estimated_cost,
        notes,
        is_purchased,
        actual_cost,
        receipt_line_item,
        created_at,
        updated_at
      `,
      [
        item.tripId,
        userId,
        item.item,
        item.category,
        item.quantity ?? null,
        estimatedCostValue,
        notesValue,
        item.isPurchased ?? false,
        actualCostValue,
        item.receiptLineItem ?? null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create grocery item");
    }

    return mapGroceryItem(row);
  }

  async getTripGroceryItems(
    tripId: number,
  ): Promise<GroceryItemWithDetails[]> {
    const { rows } = await query<GroceryItemWithAddedByRow>(
      `
      SELECT
        gi.id,
        gi.trip_id,
        gi.added_by,
        gi.item,
        gi.category,
        gi.quantity,
        gi.estimated_cost,
        gi.notes,
        gi.is_purchased,
        gi.actual_cost,
        gi.receipt_line_item,
        gi.created_at,
        gi.updated_at,
${selectUserColumns("added_by_user", "added_by_")}
      FROM grocery_items gi
      JOIN users added_by_user ON added_by_user.id = gi.added_by
      WHERE gi.trip_id = $1
      ORDER BY gi.created_at ASC, gi.id ASC
      `,
      [tripId],
    );

    if (rows.length === 0) {
      return [];
    }

    const itemIds = rows.map((row) => row.id);

    const { rows: participantRows } = await query<
      GroceryItemParticipantWithUserRow
    >(
      `
      SELECT
        gip.id,
        gip.grocery_item_id,
        gip.user_id,
        gip.will_consume,
        gip.created_at,
${selectUserColumns("participant_user", "participant_user_")}
      FROM grocery_item_participants gip
      JOIN users participant_user ON participant_user.id = gip.user_id
      WHERE gip.grocery_item_id = ANY($1::int[])
      ORDER BY gip.created_at ASC, gip.id ASC
      `,
      [itemIds],
    );

    const participantsByItemId = new Map<
      number,
      (GroceryItemParticipant & { user: User })[]
    >();

    for (const row of participantRows) {
      const participantRow: GroceryItemParticipantRow = {
        id: row.id,
        grocery_item_id: row.grocery_item_id,
        user_id: row.user_id,
        will_consume: row.will_consume,
        created_at: row.created_at,
      };

      const participant = mapGroceryItemParticipant(participantRow);
      const user = mapUserFromPrefix(row, "participant_user_");

      const existing = participantsByItemId.get(participant.groceryItemId);
      if (existing) {
        existing.push({ ...participant, user });
      } else {
        participantsByItemId.set(participant.groceryItemId, [
          { ...participant, user },
        ]);
      }
    }

    return rows.map((row) => {
      const itemRow: GroceryItemRow = {
        id: row.id,
        trip_id: row.trip_id,
        added_by: row.added_by,
        item: row.item,
        category: row.category,
        quantity: row.quantity,
        estimated_cost: row.estimated_cost,
        notes: row.notes,
        is_purchased: row.is_purchased,
        actual_cost: row.actual_cost,
        receipt_line_item: row.receipt_line_item,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };

      const participants = participantsByItemId.get(row.id) ?? [];

      return mapGroceryItemWithDetails({
        ...itemRow,
        addedByUser: mapUserFromPrefix(row, "added_by_"),
        participants,
      });
    });
  }

  async getGroceryItemTripId(itemId: number): Promise<number> {
    const { rows } = await query<{ trip_id: number }>(
      `
      SELECT trip_id
      FROM grocery_items
      WHERE id = $1
      `,
      [itemId],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Grocery item not found");
    }

    return row.trip_id;
  }

  async getGroceryItemWithDetails(
    itemId: number,
  ): Promise<GroceryItemWithDetails> {
    const tripId = await this.getGroceryItemTripId(itemId);
    const items = await this.getTripGroceryItems(tripId);
    const item = items.find((entry) => entry.id === itemId);

    if (!item) {
      throw new Error("Grocery item not found");
    }

    return item;
  }

  async updateGroceryItem(
    itemId: number,
    updates: Partial<InsertGroceryItem>,
  ): Promise<GroceryItem> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 2;

    const addClause = (column: string, value: unknown) => {
      setClauses.push(`${column} = $${paramIndex}`);
      values.push(value);
      paramIndex += 1;
    };

    if (updates.item !== undefined) {
      addClause("item", updates.item);
    }
    if (updates.category !== undefined) {
      addClause("category", updates.category);
    }
    if (updates.quantity !== undefined) {
      addClause("quantity", updates.quantity ?? null);
    }
    if (updates.estimatedCost !== undefined) {
      addClause("estimated_cost", updates.estimatedCost ?? null);
    }
    if (updates.notes !== undefined) {
      addClause("notes", serializeGroceryNotes(updates.notes ?? null));
    }
    if (updates.isPurchased !== undefined) {
      addClause("is_purchased", updates.isPurchased);
    }
    if (updates.actualCost !== undefined) {
      addClause("actual_cost", updates.actualCost ?? null);
    }
    if (updates.receiptLineItem !== undefined) {
      addClause("receipt_line_item", updates.receiptLineItem ?? null);
    }

    const setSql =
      setClauses.length > 0 ? `${setClauses.join(", ")}, ` : "";

    const { rows } = await query<GroceryItemRow>(
      `
      UPDATE grocery_items
      SET ${setSql}updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        trip_id,
        added_by,
        item,
        category,
        quantity,
        estimated_cost,
        notes,
        is_purchased,
        actual_cost,
        receipt_line_item,
        created_at,
        updated_at
      `,
      [itemId, ...values],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Grocery item not found");
    }

    return mapGroceryItem(row);
  }

  async deleteGroceryItem(itemId: number): Promise<void> {
    await query(
      `
      DELETE FROM grocery_item_participants
      WHERE grocery_item_id = $1
      `,
      [itemId],
    );

    const { rows } = await query<{ id: number }>(
      `
      DELETE FROM grocery_items
      WHERE id = $1
      RETURNING id
      `,
      [itemId],
    );

    if (!rows[0]) {
      throw new Error("Grocery item not found");
    }
  }

  async toggleGroceryItemParticipation(
    groceryItemId: number,
    userId: string,
    willConsume = true,
  ): Promise<void> {
    const { rows } = await query<{ id: number }>(
      `
      SELECT id
      FROM grocery_item_participants
      WHERE grocery_item_id = $1 AND user_id = $2
      `,
      [groceryItemId, userId],
    );

    if (rows[0]) {
      await query(
        `
        DELETE FROM grocery_item_participants
        WHERE grocery_item_id = $1 AND user_id = $2
        `,
        [groceryItemId, userId],
      );
      return;
    }

    await query(
      `
      INSERT INTO grocery_item_participants (
        grocery_item_id,
        user_id,
        will_consume
      )
      VALUES ($1, $2, COALESCE($3, TRUE))
      `,
      [groceryItemId, userId, willConsume],
    );
  }

  async markGroceryItemPurchased(
    itemId: number,
    actualCost?: string | number | null,
    isPurchased = true,
  ): Promise<void> {
    if (actualCost === undefined) {
      const { rows } = await query<{ id: number }>(
        `
        UPDATE grocery_items
        SET is_purchased = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id
        `,
        [itemId, isPurchased],
      );

      if (!rows[0]) {
        throw new Error("Grocery item not found");
      }
      return;
    }

    const actualCostValue =
      actualCost === undefined ? null : toNumberOrNull(actualCost as string | number | null);

    const { rows } = await query<{ id: number }>(
      `
      UPDATE grocery_items
      SET is_purchased = $3,
          actual_cost = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [itemId, actualCostValue, isPurchased],
    );

    if (!rows[0]) {
      throw new Error("Grocery item not found");
    }
  }

  async createGroceryReceipt(
    receipt: InsertGroceryReceipt,
    userId: string,
  ): Promise<GroceryReceipt> {
    const totalAmountValue = receipt.totalAmount ?? 0;

    const purchaseDateValue =
      typeof receipt.purchaseDate === "string"
        ? new Date(receipt.purchaseDate)
        : receipt.purchaseDate;

    const { rows } = await query<GroceryReceiptRow>(
      `
      INSERT INTO grocery_receipts (
        trip_id,
        uploaded_by,
        receipt_image_url,
        store_name,
        total_amount,
        purchase_date,
        parsed_items,
        is_processed
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        COALESCE($8, FALSE)
      )
      RETURNING
        id,
        trip_id,
        uploaded_by,
        receipt_image_url,
        store_name,
        total_amount,
        purchase_date,
        parsed_items,
        is_processed,
        created_at
      `,
      [
        receipt.tripId,
        userId,
        receipt.receiptImageUrl ?? null,
        receipt.storeName ?? null,
        totalAmountValue,
        purchaseDateValue,
        receipt.parsedItems ?? null,
        receipt.isProcessed ?? false,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create grocery receipt");
    }

    return mapGroceryReceipt(row);
  }

  async getTripGroceryReceipts(
    tripId: number,
  ): Promise<GroceryReceiptWithDetails[]> {
    const { rows } = await query<GroceryReceiptWithUploaderRow>(
      `
      SELECT
        gr.id,
        gr.trip_id,
        gr.uploaded_by,
        gr.receipt_image_url,
        gr.store_name,
        gr.total_amount,
        gr.purchase_date,
        gr.parsed_items,
        gr.is_processed,
        gr.created_at,
${selectUserColumns("u", "uploaded_by_")}
      FROM grocery_receipts gr
      JOIN users u ON u.id = gr.uploaded_by
      WHERE gr.trip_id = $1
      ORDER BY gr.purchase_date DESC, gr.id DESC
      `,
      [tripId],
    );

    if (rows.length === 0) {
      return [];
    }

    const receiptsMap = new Map<
      number,
      {
        receipt: GroceryReceiptRow;
        uploadedByUser: User;
        items: Map<
          number,
          {
            item: GroceryItemRow;
            addedByUser: User;
            participants: (GroceryItemParticipant & { user: User })[];
          }
        >;
      }
    >();

    for (const row of rows) {
      receiptsMap.set(row.id, {
        receipt: {
          id: row.id,
          trip_id: row.trip_id,
          uploaded_by: row.uploaded_by,
          receipt_image_url: row.receipt_image_url,
          store_name: row.store_name,
          total_amount: row.total_amount,
          purchase_date: row.purchase_date,
          parsed_items: row.parsed_items,
          is_processed: row.is_processed,
          created_at: row.created_at,
        },
        uploadedByUser: mapUserFromPrefix(row, "uploaded_by_"),
        items: new Map(),
      });
    }

    const receiptIds = rows.map((row) => row.id);

    const { rows: itemRows } = await query<
      {
        receipt_id: number;
        item_id: number | null;
        item_trip_id: number | null;
        item_added_by_id: string | null;
        item_name: string | null;
        item_category: string | null;
        item_quantity: string | null;
        item_estimated_cost: string | null;
        item_notes: string | null;
        item_is_purchased: boolean | null;
        item_actual_cost: string | null;
        item_receipt_line_item: string | null;
        item_created_at: Date | null;
        item_updated_at: Date | null;
        participant_id: number | null;
        participant_grocery_item_id: number | null;
        participant_user_id_raw: string | null;
        participant_will_consume: boolean | null;
        participant_created_at: Date | null;
      } & PrefixedUserRow<"item_added_by_"> & PrefixedUserRow<"participant_user_">
    >(
      `
      SELECT
        gr.id AS receipt_id,
        gi.id AS item_id,
        gi.trip_id AS item_trip_id,
        gi.added_by AS item_added_by_id,
        gi.item AS item_name,
        gi.category AS item_category,
        gi.quantity AS item_quantity,
        gi.estimated_cost AS item_estimated_cost,
        gi.notes AS item_notes,
        gi.is_purchased AS item_is_purchased,
        gi.actual_cost AS item_actual_cost,
        gi.receipt_line_item AS item_receipt_line_item,
        gi.created_at AS item_created_at,
        gi.updated_at AS item_updated_at,
${selectUserColumns("added_by_user", "item_added_by_")},
        gip.id AS participant_id,
        gip.grocery_item_id AS participant_grocery_item_id,
        gip.user_id AS participant_user_id_raw,
        gip.will_consume AS participant_will_consume,
        gip.created_at AS participant_created_at,
${selectUserColumns("participant_user", "participant_user_")}
      FROM grocery_receipts gr
      JOIN grocery_items gi ON gi.receipt_line_item = gr.id::text
      JOIN users added_by_user ON added_by_user.id = gi.added_by
      LEFT JOIN grocery_item_participants gip ON gip.grocery_item_id = gi.id
      LEFT JOIN users participant_user ON participant_user.id = gip.user_id
      WHERE gr.id = ANY($1::int[])
      ORDER BY gr.id, gi.created_at, gi.id, gip.created_at, gip.id
      `,
      [receiptIds],
    );

    for (const row of itemRows) {
      if (!row.item_id) {
        continue;
      }

      const receiptEntry = receiptsMap.get(row.receipt_id);
      if (!receiptEntry) {
        continue;
      }

      let itemEntry = receiptEntry.items.get(row.item_id);
      if (!itemEntry) {
        const itemRow: GroceryItemRow = {
          id: row.item_id,
          trip_id: row.item_trip_id ?? receiptEntry.receipt.trip_id,
          added_by: row.item_added_by_id ?? "",
          item: row.item_name ?? "",
          category: row.item_category ?? "",
          quantity: row.item_quantity,
          estimated_cost: row.item_estimated_cost,
          notes: row.item_notes,
          is_purchased: row.item_is_purchased ?? false,
          actual_cost: row.item_actual_cost,
          receipt_line_item: row.item_receipt_line_item,
          created_at: row.item_created_at,
          updated_at: row.item_updated_at,
        };

        itemEntry = {
          item: itemRow,
          addedByUser: mapUserFromPrefix(row, "item_added_by_"),
          participants: [],
        };

        receiptEntry.items.set(row.item_id, itemEntry);
      }

      if (row.participant_id) {
        const participantRow: GroceryItemParticipantRow = {
          id: row.participant_id,
          grocery_item_id: row.participant_grocery_item_id ?? itemEntry.item.id,
          user_id: row.participant_user_id_raw ?? "",
          will_consume: row.participant_will_consume ?? true,
          created_at: row.participant_created_at,
        };

        itemEntry.participants.push({
          ...mapGroceryItemParticipant(participantRow),
          user: mapUserFromPrefix(row, "participant_user_"),
        });
      }
    }

    return Array.from(receiptsMap.values()).map((entry) =>
      mapGroceryReceiptWithDetails({
        ...entry.receipt,
        uploadedByUser: entry.uploadedByUser,
        items: Array.from(entry.items.values()).map((item) =>
          mapGroceryItemWithDetails({
            ...item.item,
            addedByUser: item.addedByUser,
            participants: item.participants,
          }),
        ),
      }),
    );
  }

  async getGroceryBill(
    tripId: number,
  ): Promise<{
    totalCost: number;
    costPerPerson: number;
    items: GroceryItemWithDetails[];
  }> {
    const items = await this.getTripGroceryItems(tripId);

    const totalCost = items.reduce((sum, item) => {
      const value = item.actualCost ?? item.estimatedCost ?? 0;
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const uniqueParticipants = new Set<string>();
    for (const item of items) {
      for (const participant of item.participants) {
        if (participant.userId) {
          uniqueParticipants.add(participant.userId);
        }
      }
    }

    const costPerPerson =
      uniqueParticipants.size > 0
        ? totalCost / uniqueParticipants.size
        : totalCost;

    return {
      totalCost,
      costPerPerson: Number.isFinite(costPerPerson) ? costPerPerson : 0,
      items,
    };
  }
  async createFlight(flight: InsertFlight, userId: string): Promise<Flight> {
    const priceValue = flight.price ?? null;

    const { rows } = await query<FlightRow>(
      `
      INSERT INTO flights (
        trip_id,
        user_id,
        flight_number,
        airline,
        airline_code,
        departure_airport,
        departure_code,
        departure_time,
        departure_terminal,
        departure_gate,
        arrival_airport,
        arrival_code,
        arrival_time,
        arrival_terminal,
        arrival_gate,
        booking_reference,
        seat_number,
        seat_class,
        price,
        currency,
        flight_type,
        status,
        layovers,
        booking_source,
        purchase_url,
        aircraft,
        flight_duration,
        baggage
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28
      )
      RETURNING
        id,
        trip_id,
        user_id,
        flight_number,
        airline,
        airline_code,
        departure_airport,
        departure_code,
        departure_time,
        departure_terminal,
        departure_gate,
        arrival_airport,
        arrival_code,
        arrival_time,
        arrival_terminal,
        arrival_gate,
        booking_reference,
        seat_number,
        seat_class,
        price,
        currency,
        flight_type,
        status,
        layovers,
        booking_source,
        purchase_url,
        aircraft,
        flight_duration,
        baggage,
        created_at,
        updated_at
      `,
      [
        flight.tripId,
        userId,
        flight.flightNumber,
        flight.airline,
        flight.airlineCode,
        flight.departureAirport,
        flight.departureCode,
        flight.departureTime,
        flight.departureTerminal ?? null,
        flight.departureGate ?? null,
        flight.arrivalAirport,
        flight.arrivalCode,
        flight.arrivalTime,
        flight.arrivalTerminal ?? null,
        flight.arrivalGate ?? null,
        flight.bookingReference ?? null,
        flight.seatNumber ?? null,
        flight.seatClass ?? null,
        priceValue,
        flight.currency,
        flight.flightType,
        flight.status,
        flight.layovers ?? null,
        flight.bookingSource ?? null,
        flight.purchaseUrl ?? null,
        flight.aircraft ?? null,
        flight.flightDuration ?? null,
        flight.baggage ?? null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create flight");
    }

    return mapFlight(row);
  }

  async getTripFlights(tripId: number): Promise<FlightWithDetails[]> {
    const { rows } = await query<FlightWithDetailsRow>(
      `
      SELECT
        f.id,
        f.trip_id,
        f.user_id,
        f.flight_number,
        f.airline,
        f.airline_code,
        f.departure_airport,
        f.departure_code,
        f.departure_time,
        f.departure_terminal,
        f.departure_gate,
        f.arrival_airport,
        f.arrival_code,
        f.arrival_time,
        f.arrival_terminal,
        f.arrival_gate,
        f.booking_reference,
        f.seat_number,
        f.seat_class,
        f.price,
        f.currency,
        f.flight_type,
        f.status,
        f.layovers,
        f.booking_source,
        f.purchase_url,
        f.aircraft,
        f.flight_duration,
        f.baggage,
        f.created_at,
        f.updated_at,
        psl.proposal_id AS linked_proposal_id,
        fp.status AS linked_proposal_status,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        t.name AS trip_name,
        t.destination AS trip_destination,
        t.start_date AS trip_start_date,
        t.end_date AS trip_end_date,
        t.share_code AS trip_share_code,
        t.created_by AS trip_created_by,
        t.created_at AS trip_created_at
      FROM flights f
      LEFT JOIN proposal_schedule_links psl
        ON psl.proposal_type = 'flight'
       AND psl.scheduled_table = 'flights'
       AND psl.scheduled_id = f.id
      LEFT JOIN flight_proposals fp ON fp.id = psl.proposal_id
      JOIN users u ON u.id = f.user_id
      JOIN trip_calendars t ON t.id = f.trip_id
      WHERE f.trip_id = $1
      ORDER BY f.departure_time ASC NULLS LAST, f.id ASC
      `,
      [tripId],
    );

    return rows.map(mapFlightWithDetails);
  }

  async updateFlight(
    flightId: number,
    updates: Partial<InsertFlight>,
    userId: string,
  ): Promise<Flight> {
    const { rows: existingRows } = await query<FlightRow>(
      `
      SELECT
        id,
        trip_id,
        user_id,
        flight_number,
        airline,
        airline_code,
        departure_airport,
        departure_code,
        departure_time,
        departure_terminal,
        departure_gate,
        arrival_airport,
        arrival_code,
        arrival_time,
        arrival_terminal,
        arrival_gate,
        booking_reference,
        seat_number,
        seat_class,
        price,
        currency,
        flight_type,
        status,
        layovers,
        booking_source,
        purchase_url,
        aircraft,
        flight_duration,
        baggage,
        created_at,
        updated_at
      FROM flights
      WHERE id = $1
      `,
      [flightId],
    );

    const existing = existingRows[0];
    if (!existing) {
      throw new Error("Flight not found");
    }

    if (existing.user_id !== userId) {
      throw new Error("Only the creator can update this flight");
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const setField = (column: string, value: unknown) => {
      setClauses.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (updates.flightNumber !== undefined) {
      setField("flight_number", updates.flightNumber);
    }
    if (updates.airline !== undefined) {
      setField("airline", updates.airline);
    }
    if (updates.airlineCode !== undefined) {
      setField("airline_code", updates.airlineCode);
    }
    if (updates.departureAirport !== undefined) {
      setField("departure_airport", updates.departureAirport);
    }
    if (updates.departureCode !== undefined) {
      setField("departure_code", updates.departureCode);
    }
    if (updates.departureTime !== undefined) {
      setField("departure_time", updates.departureTime);
    }
    if (updates.departureTerminal !== undefined) {
      setField("departure_terminal", updates.departureTerminal ?? null);
    }
    if (updates.departureGate !== undefined) {
      setField("departure_gate", updates.departureGate ?? null);
    }
    if (updates.arrivalAirport !== undefined) {
      setField("arrival_airport", updates.arrivalAirport);
    }
    if (updates.arrivalCode !== undefined) {
      setField("arrival_code", updates.arrivalCode);
    }
    if (updates.arrivalTime !== undefined) {
      setField("arrival_time", updates.arrivalTime);
    }
    if (updates.arrivalTerminal !== undefined) {
      setField("arrival_terminal", updates.arrivalTerminal ?? null);
    }
    if (updates.arrivalGate !== undefined) {
      setField("arrival_gate", updates.arrivalGate ?? null);
    }
    if (updates.bookingReference !== undefined) {
      setField("booking_reference", updates.bookingReference ?? null);
    }
    if (updates.seatNumber !== undefined) {
      setField("seat_number", updates.seatNumber ?? null);
    }
    if (updates.seatClass !== undefined) {
      setField("seat_class", updates.seatClass ?? null);
    }
    if (updates.price !== undefined) {
      setField("price", updates.price ?? null);
    }
    if (updates.currency !== undefined) {
      setField("currency", updates.currency);
    }
    if (updates.flightType !== undefined) {
      setField("flight_type", updates.flightType);
    }
    if (updates.status !== undefined) {
      setField("status", updates.status);
    }
    if (updates.layovers !== undefined) {
      setField("layovers", updates.layovers ?? null);
    }
    if (updates.bookingSource !== undefined) {
      setField("booking_source", updates.bookingSource ?? null);
    }
    if (updates.purchaseUrl !== undefined) {
      setField("purchase_url", updates.purchaseUrl ?? null);
    }
    if (updates.aircraft !== undefined) {
      setField("aircraft", updates.aircraft ?? null);
    }
    if (updates.flightDuration !== undefined) {
      setField("flight_duration", updates.flightDuration ?? null);
    }
    if (updates.baggage !== undefined) {
      setField("baggage", updates.baggage ?? null);
    }

    if (setClauses.length === 0) {
      return mapFlight(existing);
    }

    setClauses.push("updated_at = NOW()");

    const sql = `
      UPDATE flights
      SET ${setClauses.join(", ")}
      WHERE id = $${index}
      RETURNING
        id,
        trip_id,
        user_id,
        flight_number,
        airline,
        airline_code,
        departure_airport,
        departure_code,
        departure_time,
        departure_terminal,
        departure_gate,
        arrival_airport,
        arrival_code,
        arrival_time,
        arrival_terminal,
        arrival_gate,
        booking_reference,
        seat_number,
        seat_class,
        price,
        currency,
        flight_type,
        status,
        layovers,
        booking_source,
        purchase_url,
        aircraft,
        flight_duration,
        baggage,
        created_at,
        updated_at
    `;

    values.push(flightId);

    const { rows } = await query<FlightRow>(sql, values);
    const updatedRow = rows[0];
    if (!updatedRow) {
      throw new Error("Failed to update flight");
    }

    return mapFlight(updatedRow);
  }

  async deleteFlight(
    flightId: number,
    userId: string,
  ): Promise<{ removedProposalIds: number[]; remainingProposalIds: number[] }> {
    const { rows } = await query<{ user_id: string; trip_id: number }>(
      `
      SELECT user_id, trip_id
      FROM flights
      WHERE id = $1
      `,
      [flightId],
    );

    const existing = rows[0];
    if (!existing) {
      throw new Error("Flight not found");
    }

    const tripId = existing.trip_id;
    const createdBy = existing.user_id;

    const [isAdmin, isMember] = await Promise.all([
      this.isTripAdmin(tripId, userId),
      this.isTripMember(tripId, userId),
    ]);

    if (!isMember && !isAdmin) {
      throw new Error("Flight not found");
    }

    const isCreator = createdBy === userId;

    if (!isCreator) {
      throw new Error("Only the creator can delete this flight.");
    }

    await this.ensureFlightDeletionAuditTable();

    await query(
      `
      INSERT INTO flight_deletion_audit (flight_id, trip_id, requester_id, created_by)
      VALUES ($1, $2, $3, $4)
      `,
      [flightId, tripId, userId, createdBy],
    );

    const proposalCleanup = await this.removeFlightProposalLinksForFlight(flightId);

    await query(
      `
      DELETE FROM flights
      WHERE id = $1
      `,
      [flightId],
    );

    return proposalCleanup;
  }

  async getUserFlights(userId: string): Promise<FlightWithDetails[]> {
    const { rows } = await query<FlightWithDetailsRow>(
      `
      SELECT
        f.id,
        f.trip_id,
        f.user_id,
        f.flight_number,
        f.airline,
        f.airline_code,
        f.departure_airport,
        f.departure_code,
        f.departure_time,
        f.departure_terminal,
        f.departure_gate,
        f.arrival_airport,
        f.arrival_code,
        f.arrival_time,
        f.arrival_terminal,
        f.arrival_gate,
        f.booking_reference,
        f.seat_number,
        f.seat_class,
        f.price,
        f.currency,
        f.flight_type,
        f.status,
        f.layovers,
        f.booking_source,
        f.purchase_url,
        f.aircraft,
        f.flight_duration,
        f.baggage,
        f.created_at,
        f.updated_at,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        t.name AS trip_name,
        t.destination AS trip_destination,
        t.start_date AS trip_start_date,
        t.end_date AS trip_end_date,
        t.share_code AS trip_share_code,
        t.created_by AS trip_created_by,
        t.created_at AS trip_created_at
      FROM flights f
      JOIN users u ON u.id = f.user_id
      JOIN trip_calendars t ON t.id = f.trip_id
      WHERE f.user_id = $1
      ORDER BY f.departure_time ASC NULLS LAST, f.id ASC
      `,
      [userId],
    );

    return rows.map(mapFlightWithDetails);
  }

  async createHotel(
    hotel: InsertHotel | Record<string, unknown>,
    userId: string,
  ): Promise<Hotel> {
    const record = hotel as Record<string, unknown>;

    const getValue = (camelKey: string): unknown => {
      if (record[camelKey] !== undefined) {
        return record[camelKey];
      }

      const snakeKey = camelToSnakeCase(camelKey);
      return record[snakeKey];
    };

    const requireValue = (camelKey: string): unknown => {
      const value = getValue(camelKey);
      if (value === undefined || value === null) {
        throw new Error(`Missing required hotel field: ${camelKey}`);
      }
      return value;
    };

    const tripIdRaw = requireValue("tripId");
    const tripId =
      typeof tripIdRaw === "number" ? tripIdRaw : Number(tripIdRaw as string);
    if (!Number.isFinite(tripId)) {
      throw new Error("Invalid trip ID for hotel insert");
    }

    const hotelName = requireValue("hotelName") as string;
    const address = requireValue("address") as string;
    const city = requireValue("city") as string;
    const country = requireValue("country") as string;
    const checkInDate = requireValue("checkInDate");
    const checkOutDate = requireValue("checkOutDate");

    const hotelRatingValue = toNumberOrNull(
      getValue("hotelRating") as string | number | null | undefined,
    );
    const totalPriceValue = toNumberOrNull(
      getValue("totalPrice") as string | number | null | undefined,
    );
    const pricePerNightValue = toNumberOrNull(
      getValue("pricePerNight") as string | number | null | undefined,
    );
    const latitudeValue = toNumberOrNull(
      getValue("latitude") as string | number | null | undefined,
    );
    const longitudeValue = toNumberOrNull(
      getValue("longitude") as string | number | null | undefined,
    );
    const roomCountValue = toNumberOrNull(
      getValue("roomCount") as string | number | null | undefined,
    );
    const guestCountValue = toNumberOrNull(
      getValue("guestCount") as string | number | null | undefined,
    );

    const { rows } = await query<HotelRow>(
      `
      INSERT INTO hotels (
        trip_id,
        user_id,
        hotel_name,
        hotel_chain,
        hotel_rating,
        address,
        city,
        country,
        zip_code,
        latitude,
        longitude,
        check_in_date,
        check_out_date,
        room_type,
        room_count,
        guest_count,
        booking_reference,
        total_price,
        price_per_night,
        currency,
        status,
        booking_source,
        purchase_url,
        amenities,
        images,
        policies,
        contact_info,
        booking_platform,
        booking_url,
        cancellation_policy,
        notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31
      )
      RETURNING
        id,
        trip_id,
        user_id,
        hotel_name,
        hotel_chain,
        hotel_rating,
        address,
        city,
        country,
        zip_code,
        latitude,
        longitude,
        check_in_date,
        check_out_date,
        room_type,
        room_count,
        guest_count,
        booking_reference,
        total_price,
        price_per_night,
        currency,
        status,
        booking_source,
        purchase_url,
        amenities,
        images,
        policies,
        contact_info,
        booking_platform,
        booking_url,
        cancellation_policy,
        notes,
        created_at,
        updated_at
      `,
      [
        tripId,
        userId,
        hotelName,
        (getValue("hotelChain") ?? null) as string | null,
        hotelRatingValue,
        address,
        city,
        country,
        (getValue("zipCode") ?? null) as string | null,
        latitudeValue,
        longitudeValue,
        checkInDate,
        checkOutDate,
        (getValue("roomType") ?? null) as string | null,
        roomCountValue,
        guestCountValue,
        (getValue("bookingReference") ?? null) as string | null,
        totalPriceValue,
        pricePerNightValue,
        (getValue("currency") ?? "USD") as string,
        (getValue("status") ?? "confirmed") as string,
        (getValue("bookingSource") ?? null) as string | null,
        (getValue("purchaseUrl") ?? null) as string | null,
        getValue("amenities") ?? null,
        getValue("images") ?? null,
        getValue("policies") ?? null,
        getValue("contactInfo") ?? null,
        (getValue("bookingPlatform") ?? null) as string | null,
        (getValue("bookingUrl") ?? null) as string | null,
        (getValue("cancellationPolicy") ?? null) as string | null,
        (getValue("notes") ?? null) as string | null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create hotel");
    }

    // PROPOSALS FEATURE: keep linked proposals updated without auto-creating new ones.
    await this.syncHotelProposalFromHotelRow(row, { allowCreate: false });

    return mapHotel(row);
  }

  // PROPOSALS FEATURE: create or update a linked hotel proposal for a manually saved hotel.
  private async syncHotelProposalFromHotelRow(
    hotel: HotelRow,
    options: { allowCreate?: boolean; client?: PoolClient; proposedBy?: string } = {},
  ): Promise<{ proposalId: number; wasCreated: boolean } | null> {
    const { allowCreate = true, client } = options;
    await this.ensureProposalLinkStructures();

    const runQuery = <T>(sql: string, params: unknown[] = []) =>
      client ? client.query<T>(sql, params) : query<T>(sql, params);

    const proposerIdForRecord =
      normalizeUserId(options.proposedBy) ?? normalizeUserId(hotel.user_id) ?? String(options.proposedBy ?? hotel.user_id ?? "");

    const { rows: existingLinks } = await runQuery<{
      id: number;
      proposal_id: number;
    }>(
      `
      SELECT id, proposal_id
      FROM proposal_schedule_links
      WHERE proposal_type = 'hotel'
        AND scheduled_table = 'hotels'
        AND scheduled_id = $1
      LIMIT 1
      `,
      [hotel.id],
    );

    const locationSegments = [hotel.city, hotel.country]
      .map((segment) => (segment ?? "").trim())
      .filter((segment) => segment.length > 0);
    const location =
      locationSegments.length > 0
        ? locationSegments.join(", ")
        : toOptionalString(hotel.address) ?? "Unknown location";

    const priceString =
      toOptionalString(hotel.total_price) ??
      toOptionalString(hotel.price_per_night) ??
      "0";
    const pricePerNightString = toOptionalString(hotel.price_per_night);
    const ratingValue = safeNumberOrNull(
      hotel.hotel_rating as string | number | null | undefined,
    );
    const amenitiesText =
      hotel.amenities == null
        ? null
        : typeof hotel.amenities === "string"
          ? hotel.amenities
          : JSON.stringify(hotel.amenities);
    const platform = toOptionalString(hotel.booking_platform) ?? "Manual Save";
    const bookingUrl =
      toOptionalString(hotel.booking_url) ??
      toOptionalString(hotel.purchase_url) ??
      "";

    const normalizedHotelStatus = (toOptionalString(hotel.status) || "").toLowerCase();
    let proposalStatus = "proposed";
    if (normalizedHotelStatus.includes("cancel")) {
      proposalStatus = "canceled";
    } else if (["selected", "booked", "scheduled"].includes(normalizedHotelStatus)) {
      proposalStatus = normalizedHotelStatus;
    }

    if (existingLinks.length > 0) {
      const link = existingLinks[0];
      const proposalId = link.proposal_id;
      await runQuery(
        `
        UPDATE hotel_proposals
        SET
          trip_id = $1,
          proposed_by = $2,
          hotel_name = $3,
          location = $4,
          price = $5,
          price_per_night = $6,
          rating = $7,
          amenities = $8,
          platform = $9,
          booking_url = $10,
          status = $11,
          updated_at = NOW()
        WHERE id = $12
        `,
        [
          hotel.trip_id,
          proposerIdForRecord,
          hotel.hotel_name,
          location,
          priceString,
          pricePerNightString,
          ratingValue,
          amenitiesText,
          platform,
          bookingUrl,
          proposalStatus,
          proposalId,
        ],
      );
      await runQuery(
        `UPDATE proposal_schedule_links SET trip_id = $1 WHERE id = $2`,
        [hotel.trip_id, link.id],
      );
      return { proposalId, wasCreated: false };
    }

    if (!allowCreate) {
      return null;
    }

    const { rows: proposalRows } = await runQuery<HotelProposalRow>(
      `
      INSERT INTO hotel_proposals (
        trip_id,
        proposed_by,
        hotel_name,
        location,
        price,
        price_per_night,
        rating,
        amenities,
        platform,
        booking_url,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'proposed'))
      RETURNING
        id,
        trip_id,
        proposed_by,
        hotel_name,
        location,
        price,
        price_per_night,
        rating,
        amenities,
        platform,
        booking_url,
        status,
        average_ranking,
        created_at,
        updated_at
      `,
      [
        hotel.trip_id,
        proposerIdForRecord,
        hotel.hotel_name,
        location,
        priceString,
        pricePerNightString,
        ratingValue,
        amenitiesText,
        platform,
        bookingUrl,
        proposalStatus,
      ],
    );

    const insertedProposal = proposalRows[0];
    if (!insertedProposal) {
      throw new Error("Failed to create hotel proposal");
    }

    await runQuery(
      `
      INSERT INTO proposal_schedule_links (
        proposal_type,
        proposal_id,
        scheduled_table,
        scheduled_id,
        trip_id
      )
      VALUES ('hotel', $1, 'hotels', $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [insertedProposal.id, hotel.id, hotel.trip_id],
    );

    return { proposalId: insertedProposal.id, wasCreated: true };
  }

  // PROPOSALS FEATURE: backfill proposals for any saved hotels missing a proposal link.
  private async ensureManualHotelsHaveProposals(tripId: number): Promise<void> {
    await this.ensureProposalLinkStructures();

    const { rows: unsyncedHotels } = await query<HotelRow>(
      `
      SELECT h.*
      FROM hotels h
      LEFT JOIN proposal_schedule_links psl
        ON psl.proposal_type = 'hotel'
       AND psl.scheduled_table = 'hotels'
       AND psl.scheduled_id = h.id
      WHERE h.trip_id = $1
        AND psl.id IS NULL
      `,
      [tripId],
    );

    if (unsyncedHotels.length === 0) {
      return;
    }

    for (const hotel of unsyncedHotels) {
      await this.syncHotelProposalFromHotelRow(hotel);
    }
  }

  async ensureHotelProposalForSavedHotel(options: {
    hotelId: number;
    tripId: number;
    currentUserId: string;
    overrideDetails?: Partial<InsertHotel>;
  }): Promise<{ proposal: HotelProposalWithDetails; wasCreated: boolean; stayId: number }> {
    const { hotelId, tripId, currentUserId, overrideDetails } = options;

    const client = await pool.connect();
    let wasCreated = false;
    let proposalId: number | null = null;
    const pendingNotifications: InsertNotification[] = [];
    try {
      await client.query("BEGIN");

      const { rows } = await client.query<HotelRow & {
        trip_created_by: string | null;
        trip_name: string | null;
        trip_start_date: Date | null;
        trip_end_date: Date | null;
      }>(
        `
        SELECT
          h.*,
          tc.created_by AS trip_created_by,
          tc.name AS trip_name,
          tc.start_date AS trip_start_date,
          tc.end_date AS trip_end_date
        FROM hotels h
        JOIN trip_calendars tc ON tc.id = h.trip_id
        WHERE h.id = $1
        FOR UPDATE
        `,
        [hotelId],
      );

      const hotel = rows[0];
      if (!hotel) {
        throw new Error("Hotel not found");
      }

      let normalizedHotelTripId =
        typeof hotel.trip_id === "number"
          ? hotel.trip_id
          : typeof hotel.trip_id === "string"
            ? Number.parseInt(hotel.trip_id, 10)
            : Number.NaN;

      if (!Number.isFinite(normalizedHotelTripId)) {
        normalizedHotelTripId = tripId;
        hotel.trip_id = tripId;
        await client.query(
          `UPDATE hotels SET trip_id = $1, updated_at = NOW() WHERE id = $2`,
          [tripId, hotelId],
        );
      }

      if (normalizedHotelTripId !== tripId) {
        throw new Error("Hotel does not belong to this trip");
      }

      const normalizedRequesterId = normalizeUserId(currentUserId);
      const normalizedStayCreatorId = normalizeUserId(hotel.user_id);
      const normalizedTripOwnerId = normalizeUserId(hotel.trip_created_by);
      const proposerIdForRecord =
        normalizedRequesterId ?? normalizedStayCreatorId ?? String(currentUserId ?? "");

      const { rows: membershipRows } = await client.query<{ role: string }>(
        `
        SELECT role
        FROM trip_members
        WHERE trip_calendar_id = $1
          AND user_id = $2
        `,
        [tripId, currentUserId],
      );

      const isTripEditor = membershipRows.some((row) =>
        typeof row.role === "string" && ["admin", "owner", "organizer"].includes(row.role.toLowerCase()),
      );
      const isTripMember = membershipRows.length > 0;
      const isTripOwner = Boolean(
        normalizedTripOwnerId && normalizedRequesterId && normalizedTripOwnerId === normalizedRequesterId,
      );

      if (!isTripMember && !isTripOwner && normalizedStayCreatorId !== normalizedRequesterId) {
        throw new Error("You must be a member of this trip to share stays with the group");
      }

      if (
        normalizedStayCreatorId !== normalizedRequesterId &&
        !isTripOwner &&
        !isTripEditor
      ) {
        throw new Error("Only the stay creator or a trip editor can propose this stay");
      }

      const hasNonEmptyString = (value: unknown): boolean =>
        typeof value === "string" && value.trim().length > 0;

      const ensureValidDate = (value: unknown): boolean => {
        if (!value) {
          return false;
        }

        const date = value instanceof Date ? value : new Date(value as string | number);
        return date instanceof Date && !Number.isNaN(date.getTime());
      };

      const pendingUpdates: Record<string, unknown> = {};

      const applyOverrideText = (
        current: string | null,
        overrideValue: unknown,
        column: string,
      ): string | null => {
        if (hasNonEmptyString(current)) {
          return current;
        }

        if (typeof overrideValue === "string" && overrideValue.trim().length > 0) {
          const normalized = overrideValue.trim();
          pendingUpdates[column] = normalized;
          return normalized;
        }

        return current;
      };

      const applyOverrideDate = (
        current: Date | string | null,
        overrideValue: unknown,
        column: string,
      ): Date | string | null => {
        if (ensureValidDate(current)) {
          return current;
        }

        if (overrideValue instanceof Date && !Number.isNaN(overrideValue.getTime())) {
          pendingUpdates[column] = overrideValue;
          return overrideValue;
        }

        if (typeof overrideValue === "string") {
          const parsed = new Date(overrideValue);
          if (!Number.isNaN(parsed.getTime())) {
            pendingUpdates[column] = parsed;
            return parsed;
          }
        }

        return current;
      };

      if (overrideDetails) {
        hotel.hotel_name = applyOverrideText(hotel.hotel_name, overrideDetails.hotelName, "hotel_name");
        hotel.address = applyOverrideText(hotel.address, overrideDetails.address, "address");
        hotel.city = applyOverrideText(hotel.city, overrideDetails.city, "city");
        hotel.country = applyOverrideText(hotel.country, overrideDetails.country, "country");
        hotel.check_in_date = applyOverrideDate(hotel.check_in_date, overrideDetails.checkInDate, "check_in_date");
        hotel.check_out_date = applyOverrideDate(hotel.check_out_date, overrideDetails.checkOutDate, "check_out_date");
      }

      const applyFallbackDate = (
        current: Date | string | null,
        fallback: Date | string | number | null,
        column: string,
      ): Date | string | null => {
        if (ensureValidDate(current)) {
          return current;
        }

        if (ensureValidDate(fallback)) {
          const normalizedFallback =
            fallback instanceof Date ? fallback : new Date(fallback as string | number);
          pendingUpdates[column] = normalizedFallback;
          return normalizedFallback;
        }

        return current;
      };

      hotel.check_in_date = applyFallbackDate(hotel.check_in_date, hotel.trip_start_date, "check_in_date");
      hotel.check_out_date = applyFallbackDate(hotel.check_out_date, hotel.trip_end_date, "check_out_date");

      const applyFallbackText = (
        current: string | null,
        fallback: string,
        column: string,
      ): string | null => {
        if (hasNonEmptyString(current)) {
          return current;
        }

        pendingUpdates[column] = fallback;
        return fallback;
      };

      hotel.hotel_name = applyFallbackText(hotel.hotel_name, "Saved stay", "hotel_name");
      hotel.address = applyFallbackText(hotel.address, "Address to be provided", "address");
      hotel.city = applyFallbackText(
        hotel.city,
        hotel.trip_name ?? "City to be decided",
        "city",
      );
      hotel.country = applyFallbackText(hotel.country, "Country to be decided", "country");

      if (Object.keys(pendingUpdates).length > 0) {
        const assignments: string[] = [];
        const params: unknown[] = [];
        let paramIndex = 1;
        for (const [column, value] of Object.entries(pendingUpdates)) {
          assignments.push(`${column} = $${paramIndex}`);
          params.push(value);
          paramIndex += 1;
        }
        assignments.push("updated_at = NOW()");
        params.push(hotelId);

        await client.query(
          `UPDATE hotels SET ${assignments.join(", ")} WHERE id = $${paramIndex}`,
          params,
        );

        const { rows: refreshedRows } = await client.query<typeof hotel>(
          `
          SELECT
            h.*,
            tc.created_by AS trip_created_by,
            tc.name AS trip_name,
            tc.start_date AS trip_start_date,
            tc.end_date AS trip_end_date
          FROM hotels h
          JOIN trip_calendars tc ON tc.id = h.trip_id
          WHERE h.id = $1
          FOR UPDATE
          `,
          [hotelId],
        );

        if (refreshedRows[0]) {
          Object.assign(hotel, refreshedRows[0]);
        }
      }

      const missingDetails: string[] = [];

      if (!hasNonEmptyString(hotel.hotel_name)) {
        missingDetails.push("hotel name");
      }
      if (!hasNonEmptyString(hotel.address)) {
        missingDetails.push("address");
      }
      if (!hasNonEmptyString(hotel.city)) {
        missingDetails.push("city");
      }
      if (!hasNonEmptyString(hotel.country)) {
        missingDetails.push("country");
      }
      if (!ensureValidDate(hotel.check_in_date)) {
        missingDetails.push("check-in date");
      }
      if (!ensureValidDate(hotel.check_out_date)) {
        missingDetails.push("check-out date");
      }

      if (missingDetails.length > 0) {
        const detailList = missingDetails.join(", ");
        throw new Error(
          `Saved stay is missing required details: ${detailList}. Add them before sharing with the group.`,
        );
      }

      const syncResult = await this.syncHotelProposalFromHotelRow(hotel, {
        client,
        proposedBy: currentUserId,
      });

      if (!syncResult) {
        throw new Error("Failed to load hotel proposal");
      }

      wasCreated = syncResult.wasCreated;
      proposalId = syncResult.proposalId;

      if (wasCreated) {
        const { rows: memberRows } = await client.query<{ user_id: string }>(
          `
          SELECT user_id
          FROM trip_members
          WHERE trip_calendar_id = $1
          `,
          [tripId],
        );

        const recipientIds = new Set<string>();
        for (const row of memberRows) {
          if (typeof row.user_id === "string" && row.user_id.trim().length > 0) {
            recipientIds.add(row.user_id);
          }
        }
        if (normalizedTripOwnerId) {
          recipientIds.add(normalizedTripOwnerId);
        }
        if (normalizedRequesterId) {
          recipientIds.delete(normalizedRequesterId);
        }

        if (recipientIds.size > 0) {
          const { rows: proposerRows } = await client.query<{
            first_name: string | null;
            last_name: string | null;
            username: string | null;
            email: string | null;
          }>(
            `
            SELECT first_name, last_name, username, email
            FROM users
            WHERE id = $1
            `,
            [currentUserId],
          );

          const proposerRow = proposerRows[0];
          const proposerName = (() => {
            const parts = [proposerRow?.first_name, proposerRow?.last_name]
              .map((part) => (typeof part === "string" ? part.trim() : ""))
              .filter((part): part is string => part.length > 0);
            if (parts.length > 0) {
              return parts.join(" ");
            }
            if (typeof proposerRow?.username === "string" && proposerRow.username.trim().length > 0) {
              return proposerRow.username.trim();
            }
            if (typeof proposerRow?.email === "string" && proposerRow.email.trim().length > 0) {
              return proposerRow.email.trim();
            }
            return "A trip member";
          })();

          const formatDateLabel = (value: Date | string | null | undefined): string | null => {
            if (!value) {
              return null;
            }
            const date = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(date.getTime())) {
              return null;
            }
            try {
              return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
            } catch {
              return null;
            }
          };

          const stayLabel = hotel.hotel_name?.trim().length ? hotel.hotel_name.trim() : "this stay";
          const checkInLabel = formatDateLabel(hotel.check_in_date);
          const checkOutLabel = formatDateLabel(hotel.check_out_date);

          const title = `${proposerName} proposed ${stayLabel}`;
          const message =
            checkInLabel && checkOutLabel
              ? `${proposerName} shared ${stayLabel} (${checkInLabel} – ${checkOutLabel}).`
              : `${proposerName} shared ${stayLabel}.`;

          for (const userId of recipientIds) {
            pendingNotifications.push({
              userId,
              type: "proposal-hotel-created",
              title,
              message,
              tripId,
            });
          }
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (proposalId == null) {
      throw new Error("Failed to load hotel proposal");
    }

    const proposal = await this.getHotelProposalById(proposalId, currentUserId);
    if (!proposal) {
      throw new Error("Failed to load hotel proposal");
    }

    if (pendingNotifications.length > 0) {
      try {
        await Promise.all(
          pendingNotifications.map((notification) => this.createNotification(notification)),
        );
      } catch (notificationError) {
        console.error(
          "Failed to send hotel proposal notifications:",
          notificationError,
        );
      }
    }

    return { proposal, wasCreated, stayId: hotelId };
  }

  private async syncFlightProposalFromFlightRow(
    flight: FlightRow,
    options: { client?: PoolClient } = {},
  ): Promise<{ proposalId: number; wasCreated: boolean }> {
    const { client } = options;
    await this.ensureProposalLinkStructures();

    const runQuery = <T>(sql: string, params: unknown[] = []) =>
      client ? client.query<T>(sql, params) : query<T>(sql, params);

    const { rows: existingLinks } = await runQuery<{
      id: number;
      proposal_id: number;
    }>(
      `
      SELECT id, proposal_id
      FROM proposal_schedule_links
      WHERE proposal_type = 'flight'
        AND scheduled_table = 'flights'
        AND scheduled_id = $1
      LIMIT 1
      `,
      [flight.id],
    );

    const departureLabel =
      toOptionalString(flight.departure_airport)?.trim() ||
      toOptionalString(flight.departure_code)?.trim() ||
      "Departure";
    const arrivalLabel =
      toOptionalString(flight.arrival_airport)?.trim() ||
      toOptionalString(flight.arrival_code)?.trim() ||
      "Arrival";

    const departureTime =
      flight.departure_time instanceof Date
        ? flight.departure_time
        : new Date(flight.departure_time);
    const arrivalTime =
      flight.arrival_time instanceof Date ? flight.arrival_time : new Date(flight.arrival_time);

    const diffMs = arrivalTime.getTime() - departureTime.getTime();
    let durationLabel = "Duration TBD";
    if (Number.isFinite(diffMs) && diffMs > 0) {
      const totalMinutes = Math.round(diffMs / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const parts: string[] = [];
      if (hours > 0) {
        parts.push(`${hours}h`);
      }
      parts.push(`${minutes}m`);
      durationLabel = parts.join(" ").trim();
    }

    const parseStops = (value: unknown): number => {
      if (!value) {
        return 0;
      }
      if (Array.isArray(value)) {
        return value.length;
      }
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.length;
          }
        } catch {
          return 0;
        }
      }
      if (typeof value === "object") {
        const layoverArray =
          Array.isArray((value as { layovers?: unknown }).layovers)
            ? ((value as { layovers: unknown[] }).layovers as unknown[])
            : Array.isArray((value as { segments?: unknown }).segments)
            ? ((value as { segments: unknown[] }).segments as unknown[])
            : null;
        return Array.isArray(layoverArray) ? layoverArray.length : 0;
      }
      return 0;
    };

    const stopsCount = parseStops(flight.layovers);
    const priceString = toOptionalString(flight.price) ?? "0";
    const currency = toOptionalString(flight.currency) ?? "USD";
    const bookingUrl =
      toOptionalString(flight.purchase_url)?.trim() || "https://manual-entry.local/manual-flight";
    const platform = toOptionalString(flight.booking_source) ?? "Manual Save";

    const normalizedFlightStatus = (toOptionalString(flight.status) || "").toLowerCase();
    let proposalStatus = "proposed";
    if (normalizedFlightStatus.includes("cancel")) {
      proposalStatus = "canceled";
    } else if (
      ["selected", "booked", "scheduled", "active", "proposed", "confirmed"].includes(
        normalizedFlightStatus,
      )
    ) {
      proposalStatus = normalizedFlightStatus;
    }

    const departureIso = departureTime.toISOString();
    const arrivalIso = arrivalTime.toISOString();

    if (existingLinks.length > 0) {
      const link = existingLinks[0];
      const proposalId = link.proposal_id;
      await runQuery(
        `
        UPDATE flight_proposals
        SET
          trip_id = $1,
          proposed_by = $2,
          airline = $3,
          flight_number = $4,
          departure_airport = $5,
          departure_time = $6,
          departure_terminal = $7,
          arrival_airport = $8,
          arrival_time = $9,
          arrival_terminal = $10,
          duration = $11,
          stops = $12,
          aircraft = $13,
          price = $14,
          currency = $15,
          booking_url = $16,
          platform = $17,
          status = $18,
          updated_at = NOW()
        WHERE id = $19
        `,
        [
          flight.trip_id,
          flight.user_id,
          flight.airline,
          flight.flight_number,
          departureLabel,
          departureIso,
          toOptionalString(flight.departure_terminal),
          arrivalLabel,
          arrivalIso,
          toOptionalString(flight.arrival_terminal),
          durationLabel,
          stopsCount,
          toOptionalString(flight.aircraft),
          priceString,
          currency,
          bookingUrl,
          platform,
          proposalStatus,
          proposalId,
        ],
      );
      await runQuery(
        `UPDATE proposal_schedule_links SET trip_id = $1 WHERE id = $2`,
        [flight.trip_id, link.id],
      );
      return { proposalId, wasCreated: false };
    }

    const { rows: proposalRows } = await runQuery<FlightProposalRow>(
      `
      INSERT INTO flight_proposals (
        trip_id,
        proposed_by,
        airline,
        flight_number,
        departure_airport,
        departure_time,
        departure_terminal,
        arrival_airport,
        arrival_time,
        arrival_terminal,
        duration,
        stops,
        aircraft,
        price,
        currency,
        booking_url,
        platform,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, COALESCE($18, 'proposed')
      )
      RETURNING
        id,
        trip_id,
        proposed_by,
        airline,
        flight_number,
        departure_airport,
        departure_time,
        departure_terminal,
        arrival_airport,
        arrival_time,
        arrival_terminal,
        duration,
        stops,
        aircraft,
        price,
        currency,
        booking_url,
        platform,
        status,
        average_ranking,
        created_at,
        updated_at
      `,
      [
        flight.trip_id,
        flight.user_id,
        flight.airline,
        flight.flight_number,
        departureLabel,
        departureIso,
        toOptionalString(flight.departure_terminal),
        arrivalLabel,
        arrivalIso,
        toOptionalString(flight.arrival_terminal),
        durationLabel,
        stopsCount,
        toOptionalString(flight.aircraft),
        priceString,
        currency,
        bookingUrl,
        platform,
        proposalStatus,
      ],
    );

    const insertedProposal = proposalRows[0];
    if (!insertedProposal) {
      throw new Error("Failed to create flight proposal");
    }

    await runQuery(
      `
      INSERT INTO proposal_schedule_links (
        proposal_type,
        proposal_id,
        scheduled_table,
        scheduled_id,
        trip_id
      )
      VALUES ('flight', $1, 'flights', $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [insertedProposal.id, flight.id, flight.trip_id],
    );

    return { proposalId: insertedProposal.id, wasCreated: true };
  }

  async ensureFlightProposalForSavedFlight(options: {
    flightId: number;
    tripId: number;
    currentUserId: string;
  }): Promise<{ proposal: FlightProposalWithDetails; wasCreated: boolean; flightId: number }> {
    const { flightId, tripId, currentUserId } = options;

    const client = await pool.connect();
    let wasCreated = false;
    let proposalId: number | null = null;

    try {
      await client.query("BEGIN");

      const { rows } = await client.query<
        FlightRow & {
          trip_created_by: string | null;
          trip_name: string | null;
        }
      >(
        `
        SELECT
          f.*,
          tc.created_by AS trip_created_by,
          tc.name AS trip_name
        FROM flights f
        JOIN trip_calendars tc ON tc.id = f.trip_id
        WHERE f.id = $1
        FOR UPDATE
        `,
        [flightId],
      );

      const flight = rows[0];
      if (!flight) {
        throw new Error("Flight not found");
      }

      if (flight.trip_id !== tripId) {
        throw new Error("Flight does not belong to this trip");
      }

      const normalizedRequesterId = normalizeUserId(currentUserId);
      const normalizedFlightCreatorId = normalizeUserId(flight.user_id);
      const normalizedTripOwnerId = normalizeUserId(flight.trip_created_by);

      const { rows: membershipRows } = await client.query<{ role: string }>(
        `
        SELECT role
        FROM trip_members
        WHERE trip_calendar_id = $1
          AND user_id = $2
        `,
        [tripId, currentUserId],
      );

      const isTripEditor = membershipRows.some((row) =>
        typeof row.role === 'string' && ['admin', 'owner', 'organizer'].includes(row.role.toLowerCase()),
      );
      const isTripMember = membershipRows.length > 0;
      const isTripOwner = Boolean(
        normalizedTripOwnerId && normalizedRequesterId && normalizedTripOwnerId === normalizedRequesterId,
      );

      if (!isTripMember && !isTripOwner && normalizedFlightCreatorId !== normalizedRequesterId) {
        throw new Error("You must be a member of this trip to share flights with the group");
      }

      if (
        normalizedFlightCreatorId !== normalizedRequesterId &&
        !isTripOwner &&
        !isTripEditor
      ) {
        throw new Error("Only the flight creator or a trip editor can propose this flight");
      }

      const syncResult = await this.syncFlightProposalFromFlightRow(flight, { client });
      if (!syncResult) {
        throw new Error("Failed to load flight proposal");
      }

      wasCreated = syncResult.wasCreated;
      proposalId = syncResult.proposalId;

      if (wasCreated) {
        const { rows: memberRows } = await client.query<{ user_id: string }>(
          `
          SELECT user_id
          FROM trip_members
          WHERE trip_calendar_id = $1
          `,
          [tripId],
        );

        const recipientIds = new Set<string>();
        for (const row of memberRows) {
          if (typeof row.user_id === 'string' && row.user_id.trim().length > 0) {
            recipientIds.add(row.user_id);
          }
        }

        if (normalizedTripOwnerId) {
          recipientIds.add(normalizedTripOwnerId);
        }

        if (normalizedRequesterId) {
          recipientIds.delete(normalizedRequesterId);
        }

        if (recipientIds.size > 0) {
          const { rows: proposerRows } = await client.query<{
            first_name: string | null;
            last_name: string | null;
            username: string | null;
            email: string | null;
          }>(
            `
            SELECT first_name, last_name, username, email
            FROM users
            WHERE id = $1
            `,
            [currentUserId],
          );

          const proposerRow = proposerRows[0];
          const proposerName = (() => {
            const parts = [proposerRow?.first_name, proposerRow?.last_name]
              .map((part) => (typeof part === 'string' ? part.trim() : ''))
              .filter((part): part is string => part.length > 0);
            if (parts.length > 0) {
              return parts.join(' ');
            }
            if (typeof proposerRow?.username === 'string' && proposerRow.username.trim().length > 0) {
              return proposerRow.username.trim();
            }
            if (typeof proposerRow?.email === 'string' && proposerRow.email.trim().length > 0) {
              return proposerRow.email.trim();
            }
            return 'A trip member';
          })();

          const formatDateTimeLabel = (value: Date | string | null | undefined): string | null => {
            if (!value) {
              return null;
            }
            const date = value instanceof Date ? value : new Date(value);
            if (Number.isNaN(date.getTime())) {
              return null;
            }
            try {
              return date.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });
            } catch {
              return null;
            }
          };

          const departureLabel = toOptionalString(flight.departure_airport) ?? 'Departure';
          const arrivalLabel = toOptionalString(flight.arrival_airport) ?? 'Arrival';
          const routeLabel = `${departureLabel} → ${arrivalLabel}`;
          const departureTimeLabel = formatDateTimeLabel(flight.departure_time);

          const title = `${proposerName} proposed a flight`;
          const message = departureTimeLabel
            ? `${proposerName} shared a flight (${routeLabel}) departing ${departureTimeLabel}.`
            : `${proposerName} shared a flight (${routeLabel}).`;

          await Promise.all(
            Array.from(recipientIds).map((userId) =>
              this.createNotification(
                {
                  userId,
                  type: "proposal-flight-created",
                  title,
                  message,
                  tripId,
                },
                client,
              ),
            ),
          );
        }
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    if (proposalId == null) {
      throw new Error("Failed to load flight proposal");
    }

    const proposal = await this.getFlightProposalById(proposalId, currentUserId);
    if (!proposal) {
      throw new Error("Failed to load flight proposal");
    }

    return { proposal, wasCreated, flightId };
  }

  private async removeFlightProposalLinksForFlight(
    flightId: number,
  ): Promise<{ removedProposalIds: number[]; remainingProposalIds: number[] }> {
    await this.ensureProposalLinkStructures();

    const { rows } = await query<{
      id: number;
      proposal_id: number;
    }>(
      `
      SELECT id, proposal_id
      FROM proposal_schedule_links
      WHERE proposal_type = 'flight'
        AND scheduled_table = 'flights'
        AND scheduled_id = $1
      `,
      [flightId],
    );

    if (rows.length === 0) {
      return { removedProposalIds: [], remainingProposalIds: [] };
    }

    const linkIds = rows.map((row) => row.id);
    const proposalIds = Array.from(new Set(rows.map((row) => row.proposal_id)));

    await query(`DELETE FROM proposal_schedule_links WHERE id = ANY($1::int[])`, [linkIds]);

    if (proposalIds.length === 0) {
      return { removedProposalIds: [], remainingProposalIds: [] };
    }

    const { rows: remainingRows } = await query<{ proposal_id: number }>(
      `
      SELECT DISTINCT proposal_id
      FROM proposal_schedule_links
      WHERE proposal_type = 'flight'
        AND proposal_id = ANY($1::int[])
      `,
      [proposalIds],
    );

    const remainingIds = new Set(remainingRows.map((row) => row.proposal_id));
    const removedProposalIds = proposalIds.filter((id) => !remainingIds.has(id));
    const remainingProposalIds = proposalIds.filter((id) => remainingIds.has(id));

    if (removedProposalIds.length > 0) {
      await query(`DELETE FROM flight_rankings WHERE proposal_id = ANY($1::int[])`, [
        removedProposalIds,
      ]);
      await query(`DELETE FROM flight_proposals WHERE id = ANY($1::int[])`, [removedProposalIds]);
    }

    return { removedProposalIds, remainingProposalIds };
  }

  // PROPOSALS FEATURE: remove linked proposals when a saved hotel is deleted.
  private async removeHotelProposalLinks(hotelId: number): Promise<void> {
    await this.ensureProposalLinkStructures();

    const { rows } = await query<{
      id: number;
      proposal_id: number;
    }>(
      `
      SELECT id, proposal_id
      FROM proposal_schedule_links
      WHERE proposal_type = 'hotel'
        AND scheduled_table = 'hotels'
        AND scheduled_id = $1
      `,
      [hotelId],
    );

    if (rows.length === 0) {
      return;
    }

    const linkIds = rows.map((row) => row.id);
    const proposalIds = rows.map((row) => row.proposal_id);

    await query(
      `DELETE FROM proposal_schedule_links WHERE id = ANY($1::int[])`,
      [linkIds],
    );

    if (proposalIds.length > 0) {
      await query(
        `DELETE FROM hotel_rankings WHERE proposal_id = ANY($1::int[])`,
        [proposalIds],
      );
      await query(
        `DELETE FROM hotel_proposals WHERE id = ANY($1::int[])`,
        [proposalIds],
      );
    }
  }

  async getTripHotels(tripId: number): Promise<HotelWithDetails[]> {
    const { rows } = await query<HotelWithDetailsRow>(
      `
      SELECT
        h.id,
        h.trip_id,
        h.user_id,
        h.hotel_name,
        h.hotel_chain,
        h.hotel_rating,
        h.address,
        h.city,
        h.country,
        h.zip_code,
        h.latitude,
        h.longitude,
        h.check_in_date,
        h.check_out_date,
        h.room_type,
        h.room_count,
        h.guest_count,
        h.booking_reference,
        h.total_price,
        h.price_per_night,
        h.currency,
        h.status,
        h.booking_source,
        h.purchase_url,
        h.amenities,
        h.images,
        h.policies,
        h.contact_info,
        h.booking_platform,
        h.booking_url,
        h.cancellation_policy,
        h.notes,
        h.created_at,
        h.updated_at,
        psl.proposal_id AS linked_proposal_id,
        hp.status AS linked_proposal_status,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        t.name AS trip_name,
        t.destination AS trip_destination,
        t.start_date AS trip_start_date,
        t.end_date AS trip_end_date,
        t.share_code AS trip_share_code,
        t.created_by AS trip_created_by,
        t.created_at AS trip_created_at
      FROM hotels h
      LEFT JOIN proposal_schedule_links psl
        ON psl.proposal_type = 'hotel'
       AND psl.scheduled_table = 'hotels'
       AND psl.scheduled_id = h.id
      LEFT JOIN hotel_proposals hp ON hp.id = psl.proposal_id
      JOIN users u ON u.id = h.user_id
      JOIN trip_calendars t ON t.id = h.trip_id
      WHERE h.trip_id = $1
      ORDER BY h.check_in_date ASC NULLS LAST, h.id ASC
      `,
      [tripId],
    );

    return rows.map(mapHotelWithDetails);
  }

  async updateHotel(
    hotelId: number,
    updates: Partial<InsertHotel>,
    userId: string,
  ): Promise<Hotel> {
    const { rows: existingRows } = await query<HotelRow>(
      `
      SELECT
        id,
        trip_id,
        user_id,
        hotel_name,
        hotel_chain,
        hotel_rating,
        address,
        city,
        country,
        zip_code,
        latitude,
        longitude,
        check_in_date,
        check_out_date,
        room_type,
        room_count,
        guest_count,
        booking_reference,
        total_price,
        price_per_night,
        currency,
        status,
        booking_source,
        purchase_url,
        amenities,
        images,
        policies,
        contact_info,
        booking_platform,
        booking_url,
        cancellation_policy,
        notes,
        created_at,
        updated_at
      FROM hotels
      WHERE id = $1
      `,
      [hotelId],
    );

    const existing = existingRows[0];
    if (!existing) {
      throw new Error("Hotel not found");
    }

    if (existing.user_id !== userId) {
      throw new Error("Only the creator can update this hotel");
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const setField = (column: string, value: unknown) => {
      setClauses.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (updates.hotelName !== undefined) {
      setField("hotel_name", updates.hotelName);
    }
    if (updates.hotelChain !== undefined) {
      setField("hotel_chain", updates.hotelChain ?? null);
    }
    if (updates.hotelRating !== undefined) {
      setField(
        "hotel_rating",
        toNumberOrNull(updates.hotelRating as string | number | null | undefined),
      );
    }
    if (updates.address !== undefined) {
      setField("address", updates.address);
    }
    if (updates.city !== undefined) {
      setField("city", updates.city);
    }
    if (updates.country !== undefined) {
      setField("country", updates.country);
    }
    if (updates.zipCode !== undefined) {
      setField("zip_code", updates.zipCode ?? null);
    }
    if (updates.latitude !== undefined) {
      setField(
        "latitude",
        toNumberOrNull(updates.latitude as string | number | null | undefined),
      );
    }
    if (updates.longitude !== undefined) {
      setField(
        "longitude",
        toNumberOrNull(updates.longitude as string | number | null | undefined),
      );
    }
    if (updates.checkInDate !== undefined) {
      setField("check_in_date", updates.checkInDate);
    }
    if (updates.checkOutDate !== undefined) {
      setField("check_out_date", updates.checkOutDate);
    }
    if (updates.roomType !== undefined) {
      setField("room_type", updates.roomType ?? null);
    }
    if (updates.roomCount !== undefined) {
      setField("room_count", updates.roomCount ?? null);
    }
    if (updates.guestCount !== undefined) {
      setField("guest_count", updates.guestCount ?? null);
    }
    if (updates.bookingReference !== undefined) {
      setField("booking_reference", updates.bookingReference ?? null);
    }
    if (updates.totalPrice !== undefined) {
      setField("total_price", updates.totalPrice ?? null);
    }
    if (updates.pricePerNight !== undefined) {
      setField("price_per_night", updates.pricePerNight ?? null);
    }
    if (updates.currency !== undefined) {
      setField("currency", updates.currency);
    }
    if (updates.status !== undefined) {
      setField("status", updates.status);
    }
    if (updates.bookingSource !== undefined) {
      setField("booking_source", updates.bookingSource ?? null);
    }
    if (updates.purchaseUrl !== undefined) {
      setField("purchase_url", updates.purchaseUrl ?? null);
    }
    if (updates.amenities !== undefined) {
      setField("amenities", updates.amenities ?? null);
    }
    if (updates.images !== undefined) {
      setField("images", updates.images ?? null);
    }
    if (updates.policies !== undefined) {
      setField("policies", updates.policies ?? null);
    }
    if (updates.contactInfo !== undefined) {
      setField("contact_info", updates.contactInfo ?? null);
    }
    if (updates.bookingPlatform !== undefined) {
      setField("booking_platform", updates.bookingPlatform ?? null);
    }
    if (updates.bookingUrl !== undefined) {
      setField("booking_url", updates.bookingUrl ?? null);
    }
    if (updates.cancellationPolicy !== undefined) {
      setField("cancellation_policy", updates.cancellationPolicy ?? null);
    }
    if (updates.notes !== undefined) {
      setField("notes", updates.notes ?? null);
    }

    if (setClauses.length === 0) {
      return mapHotel(existing);
    }

    setClauses.push("updated_at = NOW()");

    const sql = `
      UPDATE hotels
      SET ${setClauses.join(", ")}
      WHERE id = $${index}
      RETURNING
        id,
        trip_id,
        user_id,
        hotel_name,
        hotel_chain,
        hotel_rating,
        address,
        city,
        country,
        zip_code,
        latitude,
        longitude,
        check_in_date,
        check_out_date,
        room_type,
        room_count,
        guest_count,
        booking_reference,
        total_price,
        price_per_night,
        currency,
        status,
        booking_source,
        purchase_url,
        amenities,
        images,
        policies,
        contact_info,
        booking_platform,
        booking_url,
        cancellation_policy,
        notes,
        created_at,
        updated_at
    `;

    values.push(hotelId);

    const { rows } = await query<HotelRow>(sql, values);
    const updatedRow = rows[0];
    if (!updatedRow) {
      throw new Error("Failed to update hotel");
    }

    // PROPOSALS FEATURE: keep the linked proposal in sync with manual hotel edits.
    await this.syncHotelProposalFromHotelRow(updatedRow, { allowCreate: false });

    return mapHotel(updatedRow);
  }

  async deleteHotel(hotelId: number, userId: string): Promise<void> {
    const { rows } = await query<{ user_id: string }>(
      `
      SELECT user_id
      FROM hotels
      WHERE id = $1
      `,
      [hotelId],
    );

    const existing = rows[0];
    if (!existing) {
      throw new Error("Hotel not found");
    }

    if (existing.user_id !== userId) {
      throw new Error("Only the creator can delete this hotel");
    }

    // PROPOSALS FEATURE: clean up any linked proposals tied to this saved hotel.
    await this.removeHotelProposalLinks(hotelId);

    await query(
      `
      DELETE FROM hotels
      WHERE id = $1
      `,
      [hotelId],
    );
  }

  async getUserHotels(userId: string): Promise<HotelWithDetails[]> {
    const { rows } = await query<HotelWithDetailsRow>(
      `
      SELECT
        h.id,
        h.trip_id,
        h.user_id,
        h.hotel_name,
        h.hotel_chain,
        h.hotel_rating,
        h.address,
        h.city,
        h.country,
        h.zip_code,
        h.latitude,
        h.longitude,
        h.check_in_date,
        h.check_out_date,
        h.room_type,
        h.room_count,
        h.guest_count,
        h.booking_reference,
        h.total_price,
        h.price_per_night,
        h.currency,
        h.status,
        h.booking_source,
        h.purchase_url,
        h.amenities,
        h.images,
        h.policies,
        h.contact_info,
        h.booking_platform,
        h.booking_url,
        h.cancellation_policy,
        h.notes,
        h.created_at,
        h.updated_at,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        t.name AS trip_name,
        t.destination AS trip_destination,
        t.start_date AS trip_start_date,
        t.end_date AS trip_end_date,
        t.share_code AS trip_share_code,
        t.created_by AS trip_created_by,
        t.created_at AS trip_created_at
      FROM hotels h
      JOIN users u ON u.id = h.user_id
      JOIN trip_calendars t ON t.id = h.trip_id
      WHERE h.user_id = $1
      ORDER BY h.check_in_date ASC NULLS LAST, h.id ASC
      `,
      [userId],
    );

    return rows.map(mapHotelWithDetails);
  }

  async createRestaurant(
    restaurant: InsertRestaurant,
    userId: string,
  ): Promise<Restaurant> {
    const latitudeValue = toNumberOrNull(
      restaurant.latitude as string | number | null | undefined,
    );
    const longitudeValue = toNumberOrNull(
      restaurant.longitude as string | number | null | undefined,
    );
    const ratingValue = toNumberOrNull(
      restaurant.rating as string | number | null | undefined,
    );

    const { rows } = await query<RestaurantRow>(
      `
      INSERT INTO restaurants (
        trip_id,
        user_id,
        name,
        cuisine_type,
        address,
        city,
        country,
        zip_code,
        latitude,
        longitude,
        phone_number,
        website,
        open_table_url,
        price_range,
        rating,
        reservation_date,
        reservation_time,
        party_size,
        confirmation_number,
        reservation_status,
        special_requests,
        notes
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22
      )
      RETURNING
        id,
        trip_id,
        user_id,
        name,
        cuisine_type,
        address,
        city,
        country,
        zip_code,
        latitude,
        longitude,
        phone_number,
        website,
        open_table_url,
        price_range,
        rating,
        reservation_date,
        reservation_time,
        party_size,
        confirmation_number,
        reservation_status,
        special_requests,
        notes,
        created_at,
        updated_at
      `,
      [
        restaurant.tripId,
        userId,
        restaurant.name,
        restaurant.cuisineType ?? null,
        restaurant.address,
        restaurant.city,
        restaurant.country,
        restaurant.zipCode ?? null,
        latitudeValue,
        longitudeValue,
        restaurant.phoneNumber ?? null,
        restaurant.website ?? null,
        restaurant.openTableUrl ?? null,
        restaurant.priceRange,
        ratingValue,
        restaurant.reservationDate,
        restaurant.reservationTime,
        restaurant.partySize,
        restaurant.confirmationNumber ?? null,
        restaurant.reservationStatus,
        restaurant.specialRequests ?? null,
        restaurant.notes ?? null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create restaurant");
    }

    await this.syncRestaurantProposalFromRestaurantRow(row);

    return mapRestaurant(row);
  }

  private async syncRestaurantProposalFromRestaurantRow(
    restaurant: RestaurantRow,
    options: { allowCreate?: boolean } = {},
  ): Promise<number | null> {
    const { allowCreate = true } = options;
    await this.ensureProposalLinkStructures();

    const { rows: existingLinks } = await query<{
      id: number;
      proposal_id: number;
    }>(
      `
      SELECT id, proposal_id
      FROM proposal_schedule_links
      WHERE proposal_type = 'restaurant'
        AND scheduled_table = 'restaurants'
        AND scheduled_id = $1
      LIMIT 1
      `,
      [restaurant.id],
    );

    const addressSegments = [restaurant.address, restaurant.city, restaurant.country]
      .map((segment) => (segment ?? "").trim())
      .filter((segment) => segment.length > 0);

    const seenAddressSegments = new Set<string>();
    const normalizedAddress =
      addressSegments
        .filter((segment) => {
          const key = segment.toLowerCase();
          if (seenAddressSegments.has(key)) {
            return false;
          }
          seenAddressSegments.add(key);
          return true;
        })
        .join(", ") || restaurant.address;

    const reservationUrl = restaurant.open_table_url ?? restaurant.website ?? null;
    const ratingValue = safeNumberOrNull(restaurant.rating);
    const priceRange = toOptionalString(restaurant.price_range) ?? null;
    const preferredMealTime = inferRestaurantMealTime(restaurant.reservation_time);
    const reservationDateIso = toDateOnlyIso(restaurant.reservation_date);
    const preferredDates = reservationDateIso ? [reservationDateIso] : [];

    const features: string[] = [];
    if (Number.isFinite(restaurant.party_size) && restaurant.party_size > 0) {
      features.push(`Party of ${restaurant.party_size}`);
    }
    if (restaurant.reservation_time?.trim()) {
      features.push(`Time: ${restaurant.reservation_time.trim()}`);
    }
    if (restaurant.special_requests?.trim()) {
      features.push(`Requests: ${restaurant.special_requests.trim()}`);
    }

    const dietarySource = restaurant.special_requests?.trim();
    const dietaryOptions = dietarySource
      ? dietarySource
          .split(/[,;]+/)
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      : [];

    const normalizedStatus = (restaurant.reservation_status ?? "").toLowerCase();
    let proposalStatus = "booked";
    if (normalizedStatus.includes("cancel")) {
      proposalStatus = "canceled";
    } else if (normalizedStatus.includes("pending") || normalizedStatus.includes("hold")) {
      proposalStatus = "proposed";
    } else if (
      ["booked", "confirmed", "active", "selected", "scheduled"].includes(normalizedStatus)
    ) {
      proposalStatus = normalizedStatus;
    }

    const notesLower = (restaurant.notes ?? "").toLowerCase();
    let platform = "Manual Reservation";
    if (restaurant.open_table_url) {
      platform = "OpenTable";
    } else if (notesLower.includes("resy")) {
      platform = "Resy";
    } else if (notesLower.includes("yelp")) {
      platform = "Yelp";
    } else if (notesLower.includes("google")) {
      platform = "Google Maps";
    }

    const dietaryJson = dietaryOptions.length > 0 ? toDbJson(dietaryOptions) : null;
    const preferredDatesJson = preferredDates.length > 0 ? toDbJson(preferredDates) : null;
    const featuresJson = features.length > 0 ? toDbJson(features) : null;

    if (existingLinks.length > 0) {
      const link = existingLinks[0];
      const proposalId = link.proposal_id;
      await query(
        `
        UPDATE restaurant_proposals
        SET
          trip_id = $1,
          proposed_by = $2,
          restaurant_name = $3,
          address = $4,
          cuisine_type = $5,
          price_range = $6,
          rating = $7,
          phone_number = $8,
          website = $9,
          reservation_url = $10,
          platform = $11,
          atmosphere = $12,
          specialties = $13,
          dietary_options = $14,
          preferred_meal_time = $15,
          preferred_dates = $16,
          features = $17,
          status = $18,
          updated_at = NOW()
        WHERE id = $19
        `,
        [
          restaurant.trip_id,
          restaurant.user_id,
          restaurant.name,
          normalizedAddress,
          restaurant.cuisine_type ?? null,
          priceRange,
          ratingValue,
          restaurant.phone_number ?? null,
          restaurant.website ?? null,
          reservationUrl,
          platform,
          null,
          null,
          dietaryJson,
          preferredMealTime,
          preferredDatesJson,
          featuresJson,
          proposalStatus,
          proposalId,
        ],
      );
      await query(
        `UPDATE proposal_schedule_links SET trip_id = $1 WHERE id = $2`,
        [restaurant.trip_id, link.id],
      );
      return proposalId;
    }

    if (!allowCreate) {
      return null;
    }

    const created = await this.createRestaurantProposal(
      {
        tripId: restaurant.trip_id,
        restaurantName: restaurant.name,
        address: normalizedAddress,
        cuisineType: restaurant.cuisine_type ?? null,
        priceRange,
        rating: ratingValue,
        phoneNumber: restaurant.phone_number ?? null,
        website: restaurant.website ?? null,
        reservationUrl,
        platform,
        atmosphere: null,
        specialties: null,
        dietaryOptions: dietaryOptions.length > 0 ? dietaryOptions : null,
        preferredMealTime,
        preferredDates,
        features: features.length > 0 ? features : null,
        status: proposalStatus,
      },
      restaurant.user_id,
    );

    await query(
      `
      INSERT INTO proposal_schedule_links (
        proposal_type,
        proposal_id,
        scheduled_table,
        scheduled_id,
        trip_id
      )
      VALUES ('restaurant', $1, 'restaurants', $2, $3)
      ON CONFLICT DO NOTHING
      `,
      [created.id, restaurant.id, restaurant.trip_id],
    );

    return created.id;
  }

  private async ensureManualRestaurantsHaveProposals(tripId: number): Promise<void> {
    await this.ensureProposalLinkStructures();

    const { rows } = await query<RestaurantRow>(
      `
      SELECT r.*
      FROM restaurants r
      LEFT JOIN proposal_schedule_links psl
        ON psl.proposal_type = 'restaurant'
       AND psl.scheduled_table = 'restaurants'
       AND psl.scheduled_id = r.id
      WHERE r.trip_id = $1
        AND psl.id IS NULL
      `,
      [tripId],
    );

    if (rows.length === 0) {
      return;
    }

    for (const restaurant of rows) {
      await this.syncRestaurantProposalFromRestaurantRow(restaurant);
    }
  }

  private async removeRestaurantProposalLinks(restaurantId: number): Promise<void> {
    await this.ensureProposalLinkStructures();

    const { rows } = await query<{
      id: number;
      proposal_id: number;
    }>(
      `
      SELECT id, proposal_id
      FROM proposal_schedule_links
      WHERE proposal_type = 'restaurant'
        AND scheduled_table = 'restaurants'
        AND scheduled_id = $1
      `,
      [restaurantId],
    );

    if (rows.length === 0) {
      return;
    }

    const linkIds = rows.map((row) => row.id);
    const proposalIds = Array.from(new Set(rows.map((row) => row.proposal_id)));

    await query(`DELETE FROM proposal_schedule_links WHERE id = ANY($1::int[])`, [linkIds]);

    if (proposalIds.length === 0) {
      return;
    }

    await query(`DELETE FROM restaurant_rankings WHERE proposal_id = ANY($1::int[])`, [proposalIds]);
    await query(`DELETE FROM restaurant_proposals WHERE id = ANY($1::int[])`, [proposalIds]);
  }

  async getTripRestaurants(
    tripId: number,
  ): Promise<RestaurantWithDetails[]> {
    const { rows } = await query<RestaurantWithDetailsRow>(
      `
      SELECT
        r.id,
        r.trip_id,
        r.user_id,
        r.name,
        r.cuisine_type,
        r.address,
        r.city,
        r.country,
        r.zip_code,
        r.latitude,
        r.longitude,
        r.phone_number,
        r.website,
        r.open_table_url,
        r.price_range,
        r.rating,
        r.reservation_date,
        r.reservation_time,
        r.party_size,
        r.confirmation_number,
        r.reservation_status,
        r.special_requests,
        r.notes,
        r.created_at,
        r.updated_at,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        t.name AS trip_name,
        t.destination AS trip_destination,
        t.start_date AS trip_start_date,
        t.end_date AS trip_end_date,
        t.share_code AS trip_share_code,
        t.created_by AS trip_created_by,
        t.created_at AS trip_created_at
      FROM restaurants r
      JOIN users u ON u.id = r.user_id
      JOIN trip_calendars t ON t.id = r.trip_id
      WHERE r.trip_id = $1
      ORDER BY r.reservation_date ASC NULLS LAST, r.reservation_time ASC, r.id ASC
      `,
      [tripId],
    );

    return rows.map(mapRestaurantWithDetails);
  }

  async updateRestaurant(
    restaurantId: number,
    updates: Partial<InsertRestaurant>,
    userId: string,
  ): Promise<Restaurant> {
    const { rows: existingRows } = await query<RestaurantRow>(
      `
      SELECT
        id,
        trip_id,
        user_id,
        name,
        cuisine_type,
        address,
        city,
        country,
        zip_code,
        latitude,
        longitude,
        phone_number,
        website,
        open_table_url,
        price_range,
        rating,
        reservation_date,
        reservation_time,
        party_size,
        confirmation_number,
        reservation_status,
        special_requests,
        notes,
        created_at,
        updated_at
      FROM restaurants
      WHERE id = $1
      `,
      [restaurantId],
    );

    const existing = existingRows[0];
    if (!existing) {
      throw new Error("Restaurant not found");
    }

    if (existing.user_id !== userId) {
      throw new Error("Only the creator can update this restaurant");
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    const setField = (column: string, value: unknown) => {
      setClauses.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    };

    if (updates.name !== undefined) {
      setField("name", updates.name);
    }
    if (updates.cuisineType !== undefined) {
      setField("cuisine_type", updates.cuisineType ?? null);
    }
    if (updates.address !== undefined) {
      setField("address", updates.address);
    }
    if (updates.city !== undefined) {
      setField("city", updates.city);
    }
    if (updates.country !== undefined) {
      setField("country", updates.country);
    }
    if (updates.zipCode !== undefined) {
      setField("zip_code", updates.zipCode ?? null);
    }
    if (updates.latitude !== undefined) {
      setField(
        "latitude",
        toNumberOrNull(updates.latitude as string | number | null | undefined),
      );
    }
    if (updates.longitude !== undefined) {
      setField(
        "longitude",
        toNumberOrNull(updates.longitude as string | number | null | undefined),
      );
    }
    if (updates.phoneNumber !== undefined) {
      setField("phone_number", updates.phoneNumber ?? null);
    }
    if (updates.website !== undefined) {
      setField("website", updates.website ?? null);
    }
    if (updates.openTableUrl !== undefined) {
      setField("open_table_url", updates.openTableUrl ?? null);
    }
    if (updates.priceRange !== undefined) {
      setField("price_range", updates.priceRange);
    }
    if (updates.rating !== undefined) {
      setField(
        "rating",
        toNumberOrNull(updates.rating as string | number | null | undefined),
      );
    }
    if (updates.reservationDate !== undefined) {
      setField("reservation_date", updates.reservationDate);
    }
    if (updates.reservationTime !== undefined) {
      setField("reservation_time", updates.reservationTime);
    }
    if (updates.partySize !== undefined) {
      setField("party_size", updates.partySize);
    }
    if (updates.confirmationNumber !== undefined) {
      setField("confirmation_number", updates.confirmationNumber ?? null);
    }
    if (updates.reservationStatus !== undefined) {
      setField("reservation_status", updates.reservationStatus);
    }
    if (updates.specialRequests !== undefined) {
      setField("special_requests", updates.specialRequests ?? null);
    }
    if (updates.notes !== undefined) {
      setField("notes", updates.notes ?? null);
    }

    if (setClauses.length === 0) {
      return mapRestaurant(existing);
    }

    setClauses.push("updated_at = NOW()");

    const sql = `
      UPDATE restaurants
      SET ${setClauses.join(", ")}
      WHERE id = $${index}
      RETURNING
        id,
        trip_id,
        user_id,
        name,
        cuisine_type,
        address,
        city,
        country,
        zip_code,
        latitude,
        longitude,
        phone_number,
        website,
        open_table_url,
        price_range,
        rating,
        reservation_date,
        reservation_time,
        party_size,
        confirmation_number,
        reservation_status,
        special_requests,
        notes,
        created_at,
        updated_at
    `;

    values.push(restaurantId);

    const { rows } = await query<RestaurantRow>(sql, values);
    const updatedRow = rows[0];
    if (!updatedRow) {
      throw new Error("Failed to update restaurant");
    }

    await this.syncRestaurantProposalFromRestaurantRow(updatedRow);

    return mapRestaurant(updatedRow);
  }

  async deleteRestaurant(
    restaurantId: number,
    userId: string,
  ): Promise<void> {
    const { rows } = await query<{ user_id: string }>(
      `
      SELECT user_id
      FROM restaurants
      WHERE id = $1
      `,
      [restaurantId],
    );

    const existing = rows[0];
    if (!existing) {
      throw new Error("Restaurant not found");
    }

    if (existing.user_id !== userId) {
      throw new Error("Only the creator can delete this restaurant");
    }

    await this.removeRestaurantProposalLinks(restaurantId);

    await query(
      `
      DELETE FROM restaurants
      WHERE id = $1
      `,
      [restaurantId],
    );
  }

  async getUserRestaurants(
    userId: string,
  ): Promise<RestaurantWithDetails[]> {
    const { rows } = await query<RestaurantWithDetailsRow>(
      `
      SELECT
        r.id,
        r.trip_id,
        r.user_id,
        r.name,
        r.cuisine_type,
        r.address,
        r.city,
        r.country,
        r.zip_code,
        r.latitude,
        r.longitude,
        r.phone_number,
        r.website,
        r.open_table_url,
        r.price_range,
        r.rating,
        r.reservation_date,
        r.reservation_time,
        r.party_size,
        r.confirmation_number,
        r.reservation_status,
        r.special_requests,
        r.notes,
        r.created_at,
        r.updated_at,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
        u.cash_app_username AS user_cash_app_username,
        u.cashapp_phone AS user_cashapp_phone,
        u.cash_app_phone AS user_cash_app_phone,
        u.venmo_username AS user_venmo_username,
        u.venmo_phone AS user_venmo_phone,
        u.timezone AS user_timezone,
        u.default_location AS user_default_location,
        u.default_location_code AS user_default_location_code,
        u.default_city AS user_default_city,
        u.default_country AS user_default_country,
        u.auth_provider AS user_auth_provider,
        u.notification_preferences AS user_notification_preferences,
        u.has_seen_home_onboarding AS user_has_seen_home_onboarding,
        u.has_seen_trip_onboarding AS user_has_seen_trip_onboarding,
        u.created_at AS user_created_at,
        u.updated_at AS user_updated_at,
        t.name AS trip_name,
        t.destination AS trip_destination,
        t.start_date AS trip_start_date,
        t.end_date AS trip_end_date,
        t.share_code AS trip_share_code,
        t.created_by AS trip_created_by,
        t.created_at AS trip_created_at
      FROM restaurants r
      JOIN users u ON u.id = r.user_id
      JOIN trip_calendars t ON t.id = r.trip_id
      WHERE r.user_id = $1
      ORDER BY r.reservation_date ASC NULLS LAST, r.reservation_time ASC, r.id ASC
      `,
      [userId],
    );

    return rows.map(mapRestaurantWithDetails);
  }
  private async ensureUniqueHotelRankingsForTrip(tripId: number): Promise<void> {
    const client = await pool.connect();
    const rankingIdsToDelete: number[] = [];
    const affectedProposalIds = new Set<number>();

    try {
      await client.query("BEGIN");

      const { rows } = await client.query<{
        id: number;
        proposal_id: number;
        user_id: string;
        ranking: number;
        updated_at: Date | null;
        created_at: Date | null;
      }>(
        `
        SELECT
          hr.id,
          hr.proposal_id,
          hr.user_id,
          hr.ranking,
          hr.updated_at,
          hr.created_at
        FROM hotel_rankings hr
        JOIN hotel_proposals hp ON hp.id = hr.proposal_id
        WHERE hp.trip_id = $1
        ORDER BY
          hr.user_id,
          hr.ranking,
          COALESCE(hr.updated_at, hr.created_at) DESC,
          hr.id DESC
        `,
        [tripId],
      );

      const seenKeys = new Set<string>();

      for (const row of rows) {
        const key = `${row.user_id}:${row.ranking}`;
        if (seenKeys.has(key)) {
          rankingIdsToDelete.push(row.id);
          affectedProposalIds.add(row.proposal_id);
        } else {
          seenKeys.add(key);
        }
      }

      if (rankingIdsToDelete.length > 0) {
        await client.query(
          `DELETE FROM hotel_rankings WHERE id = ANY($1::int[])`,
          [rankingIdsToDelete],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await Promise.all(
      Array.from(affectedProposalIds).map((proposalId) =>
        this.updateHotelProposalAverageRanking(proposalId),
      ),
    );
  }

  private async fetchHotelProposals(
    options: {
      tripId?: number;
      proposalIds?: number[];
      currentUserId?: string;
      proposedBy?: string;
    },
  ): Promise<HotelProposalWithDetails[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options.tripId != null) {
      conditions.push(`hp.trip_id = $${index}`);
      values.push(options.tripId);
      index += 1;
    }

    if (options.proposalIds && options.proposalIds.length > 0) {
      conditions.push(`hp.id = ANY($${index}::int[])`);
      values.push(options.proposalIds);
      index += 1;
    }

    if (options.proposedBy) {
      conditions.push(`hp.proposed_by = $${index}`);
      values.push(options.proposedBy);
      index += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query<HotelProposalWithProposerRow>(
      `
      SELECT
        hp.id,
        hp.trip_id,
        hp.proposed_by,
        hp.hotel_name,
        hp.location,
        hp.price,
        hp.price_per_night,
        hp.rating,
        hp.amenities,
        hp.platform,
        hp.booking_url,
        hp.status,
        hp.average_ranking,
        hp.created_at,
        hp.updated_at,
        psl.scheduled_id AS linked_hotel_id,
        h.check_in_date AS linked_check_in_date,
        h.check_out_date AS linked_check_out_date,
        h.address AS linked_address,
        h.city AS linked_city,
        h.country AS linked_country,
        h.currency AS linked_currency,
        ${selectUserColumns("u", "proposer_")}
      FROM hotel_proposals hp
      LEFT JOIN proposal_schedule_links psl
        ON psl.proposal_type = 'hotel'
       AND psl.proposal_id = hp.id
       AND psl.scheduled_table = 'hotels'
      LEFT JOIN hotels h ON h.id = psl.scheduled_id
      LEFT JOIN users u ON u.id = hp.proposed_by
      ${whereClause}
      ORDER BY hp.created_at DESC NULLS LAST, hp.id DESC
      `,
      values,
    );

    if (rows.length === 0) {
      return [];
    }

    const proposalIds = rows.map((row) => row.id);

    const { rows: rankingRows } = await query<HotelRankingWithUserRow>(
      `
      SELECT
        hr.id,
        hr.proposal_id,
        hr.user_id,
        hr.ranking,
        hr.notes,
        hr.created_at,
        hr.updated_at,
        ${selectUserColumns("u", "user_")}
      FROM hotel_rankings hr
      JOIN users u ON u.id = hr.user_id
      WHERE hr.proposal_id = ANY($1::int[])
      ORDER BY hr.created_at ASC NULLS LAST, hr.id ASC
      `,
      [proposalIds],
    );

    const rankingsByProposal = new Map<number, (HotelRanking & { user: User })[]>();
    for (const row of rankingRows) {
      const ranking = mapHotelRankingWithUser(row);
      const list = rankingsByProposal.get(ranking.proposalId);
      if (list) {
        list.push(ranking);
      } else {
        rankingsByProposal.set(ranking.proposalId, [ranking]);
      }
    }

    return rows.map((row) =>
      mapHotelProposalWithDetails(
        row,
        rankingsByProposal.get(row.id) ?? [],
        options.currentUserId,
      ),
    );
  }

  private async ensureUniqueFlightRankingsForTrip(tripId: number): Promise<void> {
    const client = await pool.connect();
    const rankingIdsToDelete: number[] = [];
    const affectedProposalIds = new Set<number>();

    try {
      await client.query("BEGIN");

      const { rows } = await client.query<{
        id: number;
        proposal_id: number;
        user_id: string;
        ranking: number;
        updated_at: Date | null;
        created_at: Date | null;
      }>(
        `
        SELECT
          fr.id,
          fr.proposal_id,
          fr.user_id,
          fr.ranking,
          fr.updated_at,
          fr.created_at
        FROM flight_rankings fr
        JOIN flight_proposals fp ON fp.id = fr.proposal_id
        WHERE fp.trip_id = $1
        ORDER BY
          fr.user_id,
          fr.ranking,
          COALESCE(fr.updated_at, fr.created_at) DESC,
          fr.id DESC
        `,
        [tripId],
      );

      const seenKeys = new Set<string>();

      for (const row of rows) {
        const key = `${row.user_id}:${row.ranking}`;
        if (seenKeys.has(key)) {
          rankingIdsToDelete.push(row.id);
          affectedProposalIds.add(row.proposal_id);
        } else {
          seenKeys.add(key);
        }
      }

      if (rankingIdsToDelete.length > 0) {
        await client.query(
          `DELETE FROM flight_rankings WHERE id = ANY($1::int[])`,
          [rankingIdsToDelete],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await Promise.all(
      Array.from(affectedProposalIds).map((proposalId) =>
        this.updateFlightProposalAverageRanking(proposalId),
      ),
    );
  }

  private async fetchFlightProposals(
    options: {
      tripId?: number;
      proposalIds?: number[];
      currentUserId?: string;
      proposedBy?: string;
    },
  ): Promise<FlightProposalWithDetails[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options.tripId != null) {
      conditions.push(`fp.trip_id = $${index}`);
      values.push(options.tripId);
      index += 1;
    }

    if (options.proposalIds && options.proposalIds.length > 0) {
      conditions.push(`fp.id = ANY($${index}::int[])`);
      values.push(options.proposalIds);
      index += 1;
    }

    if (options.proposedBy) {
      conditions.push(`fp.proposed_by = $${index}`);
      values.push(options.proposedBy);
      index += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query<FlightProposalWithProposerRow>(
      `
      SELECT
        fp.id,
        fp.trip_id,
        fp.proposed_by,
        fp.airline,
        fp.flight_number,
        fp.departure_airport,
        fp.departure_time,
        fp.departure_terminal,
        fp.arrival_airport,
        fp.arrival_time,
        fp.arrival_terminal,
        fp.duration,
        fp.stops,
        fp.aircraft,
        fp.price,
        fp.currency,
        fp.booking_url,
        fp.platform,
        fp.status,
        fp.average_ranking,
        fp.created_at,
        fp.updated_at,
        psl.scheduled_id AS linked_flight_id,
        f.departure_code AS linked_departure_code,
        f.arrival_code AS linked_arrival_code,
        f.departure_gate AS linked_departure_gate,
        f.arrival_gate AS linked_arrival_gate,
        f.seat_class AS linked_seat_class,
        f.seat_number AS linked_seat_number,
        f.booking_source AS linked_booking_source,
        f.purchase_url AS linked_purchase_url,
        ${selectUserColumns("u", "proposer_")}
      FROM flight_proposals fp
      LEFT JOIN proposal_schedule_links psl
        ON psl.proposal_type = 'flight'
       AND psl.proposal_id = fp.id
       AND psl.scheduled_table = 'flights'
      LEFT JOIN flights f ON f.id = psl.scheduled_id
      JOIN users u ON u.id = fp.proposed_by
      ${whereClause}
      ORDER BY fp.created_at DESC NULLS LAST, fp.id DESC
      `,
      values,
    );

    if (rows.length === 0) {
      return [];
    }

    const proposalIds = rows.map((row) => row.id);

    const { rows: rankingRows } = await query<FlightRankingWithUserRow>(
      `
      SELECT
        fr.id,
        fr.proposal_id,
        fr.user_id,
        fr.ranking,
        fr.notes,
        fr.created_at,
        fr.updated_at,
        ${selectUserColumns("u", "user_")}
      FROM flight_rankings fr
      JOIN users u ON u.id = fr.user_id
      WHERE fr.proposal_id = ANY($1::int[])
      ORDER BY fr.created_at ASC NULLS LAST, fr.id ASC
      `,
      [proposalIds],
    );

    const rankingsByProposal = new Map<number, (FlightRanking & { user: User })[]>();
    for (const row of rankingRows) {
      const ranking = mapFlightRankingWithUser(row);
      const list = rankingsByProposal.get(ranking.proposalId);
      if (list) {
        list.push(ranking);
      } else {
        rankingsByProposal.set(ranking.proposalId, [ranking]);
      }
    }

    return rows.map((row) =>
      mapFlightProposalWithDetails(
        row,
        rankingsByProposal.get(row.id) ?? [],
        options.currentUserId,
      ),
    );
  }

  private async ensureUniqueRestaurantRankingsForTrip(tripId: number): Promise<void> {
    const client = await pool.connect();
    const rankingIdsToDelete: number[] = [];
    const affectedProposalIds = new Set<number>();

    try {
      await client.query("BEGIN");

      const { rows } = await client.query<{
        id: number;
        proposal_id: number;
        user_id: string;
        ranking: number;
        updated_at: Date | null;
        created_at: Date | null;
      }>(
        `
        SELECT
          rr.id,
          rr.proposal_id,
          rr.user_id,
          rr.ranking,
          rr.updated_at,
          rr.created_at
        FROM restaurant_rankings rr
        JOIN restaurant_proposals rp ON rp.id = rr.proposal_id
        WHERE rp.trip_id = $1
        ORDER BY
          rr.user_id,
          rr.ranking,
          COALESCE(rr.updated_at, rr.created_at) DESC,
          rr.id DESC
        `,
        [tripId],
      );

      const seenKeys = new Set<string>();

      for (const row of rows) {
        const key = `${row.user_id}:${row.ranking}`;
        if (seenKeys.has(key)) {
          rankingIdsToDelete.push(row.id);
          affectedProposalIds.add(row.proposal_id);
        } else {
          seenKeys.add(key);
        }
      }

      if (rankingIdsToDelete.length > 0) {
        await client.query(
          `DELETE FROM restaurant_rankings WHERE id = ANY($1::int[])`,
          [rankingIdsToDelete],
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    await Promise.all(
      Array.from(affectedProposalIds).map((proposalId) =>
        this.updateRestaurantProposalAverageRanking(proposalId),
      ),
    );
  }

  private async fetchRestaurantProposals(
    options: {
      tripId?: number;
      proposalIds?: number[];
      currentUserId?: string;
    },
  ): Promise<RestaurantProposalWithDetails[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (options.tripId != null) {
      conditions.push(`rp.trip_id = $${index}`);
      values.push(options.tripId);
      index += 1;
    }

    if (options.proposalIds && options.proposalIds.length > 0) {
      conditions.push(`rp.id = ANY($${index}::int[])`);
      values.push(options.proposalIds);
      index += 1;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await query<RestaurantProposalWithProposerRow>(
      `
      SELECT
        rp.id,
        rp.trip_id,
        rp.proposed_by,
        rp.restaurant_name,
        rp.address,
        rp.cuisine_type,
        rp.price_range,
        rp.rating,
        rp.phone_number,
        rp.website,
        rp.reservation_url,
        rp.platform,
        rp.atmosphere,
        rp.specialties,
        rp.dietary_options,
        rp.preferred_meal_time,
        rp.preferred_dates,
        rp.features,
        rp.status,
        rp.average_ranking,
        rp.created_at,
        rp.updated_at,
        ${selectUserColumns("u", "proposer_")}
      FROM restaurant_proposals rp
      JOIN users u ON u.id = rp.proposed_by
      ${whereClause}
      ORDER BY rp.created_at DESC NULLS LAST, rp.id DESC
      `,
      values,
    );

    if (rows.length === 0) {
      return [];
    }

    const proposalIds = rows.map((row) => row.id);

    const { rows: rankingRows } = await query<RestaurantRankingWithUserRow>(
      `
      SELECT
        rr.id,
        rr.proposal_id,
        rr.user_id,
        rr.ranking,
        rr.notes,
        rr.created_at,
        rr.updated_at,
        ${selectUserColumns("u", "user_")}
      FROM restaurant_rankings rr
      JOIN users u ON u.id = rr.user_id
      WHERE rr.proposal_id = ANY($1::int[])
      ORDER BY rr.created_at ASC NULLS LAST, rr.id ASC
      `,
      [proposalIds],
    );

    const rankingsByProposal = new Map<number, (RestaurantRanking & { user: User })[]>();
    for (const row of rankingRows) {
      const ranking = mapRestaurantRankingWithUser(row);
      const list = rankingsByProposal.get(ranking.proposalId);
      if (list) {
        list.push(ranking);
      } else {
        rankingsByProposal.set(ranking.proposalId, [ranking]);
      }
    }

    return rows.map((row) =>
      mapRestaurantProposalWithDetails(
        row,
        rankingsByProposal.get(row.id) ?? [],
        options.currentUserId,
      ),
    );
  }

  private async removeScheduledItemsForProposal(
    proposalType: "hotel" | "flight" | "restaurant",
    proposalId: number,
  ): Promise<void> {
    await this.ensureProposalLinkStructures();

    const { rows } = await query<ProposalScheduleLinkRow>(
      `
      SELECT id, scheduled_table, scheduled_id
      FROM proposal_schedule_links
      WHERE proposal_type = $1 AND proposal_id = $2
      `,
      [proposalType, proposalId],
    );

    if (rows.length === 0) {
      return;
    }

    for (const link of rows) {
      switch (link.scheduled_table) {
        case "activities":
          await query(`DELETE FROM activity_invites WHERE activity_id = $1`, [link.scheduled_id]);
          await query(`DELETE FROM activity_comments WHERE activity_id = $1`, [link.scheduled_id]);
          await query(`DELETE FROM activities WHERE id = $1`, [link.scheduled_id]);
          break;
        case "hotels":
          await query(`DELETE FROM hotels WHERE id = $1`, [link.scheduled_id]);
          break;
        case "flights":
          await query(`DELETE FROM flights WHERE id = $1`, [link.scheduled_id]);
          break;
        case "restaurants":
          await query(`DELETE FROM restaurants WHERE id = $1`, [link.scheduled_id]);
          break;
        default:
          break;
      }

      await query(`DELETE FROM proposal_schedule_links WHERE id = $1`, [link.id]);
    }
  }

  private async notifyProposalCancellation(options: {
    tripId: number;
    proposalType: "hotel" | "flight" | "restaurant" | "activity";
    proposalName: string;
    canceledBy: string;
  }): Promise<void> {
    const { tripId, proposalType, proposalName, canceledBy } = options;

    const { rows: memberRows } = await query<{ user_id: string }>(
      `SELECT user_id FROM trip_members WHERE trip_calendar_id = $1`,
      [tripId],
    );

    const memberIds = new Set<string>(memberRows.map((row) => row.user_id));

    const { rows: tripRows } = await query<{ created_by: string | null }>(
      `SELECT created_by FROM trip_calendars WHERE id = $1`,
      [tripId],
    );

    const tripOwnerId = tripRows[0]?.created_by ?? null;
    if (tripOwnerId) {
      memberIds.add(tripOwnerId);
    }

    memberIds.delete(canceledBy);

    if (memberIds.size === 0) {
      return;
    }

    const cancelingUser = await this.getUser(canceledBy);
    const displayName =
      [cancelingUser?.firstName, cancelingUser?.lastName]
        .filter((part): part is string => Boolean(part && part.trim()))
        .join(" ") ||
      cancelingUser?.username ||
      cancelingUser?.email ||
      "A trip member";

    const typeLabel =
      proposalType === "hotel"
        ? "hotel"
        : proposalType === "flight"
        ? "flight"
        : proposalType === "restaurant"
        ? "restaurant"
        : "activity";

    const title = `${typeLabel.charAt(0).toUpperCase()}${typeLabel.slice(1)} proposal canceled`;
    const message = `${displayName} canceled the ${typeLabel} proposal "${proposalName}".`;

    await Promise.all(
      Array.from(memberIds).map((userId) =>
        this.createNotification({
          userId,
          type: "proposal-canceled",
          title,
          message,
          tripId,
        }),
      ),
    );
  }

  async createHotelProposal(
    proposal: InsertHotelProposal,
    userId: string,
  ): Promise<HotelProposalWithDetails> {
    const { rows } = await query<HotelProposalRow>(
      `
      INSERT INTO hotel_proposals (
        trip_id,
        proposed_by,
        hotel_name,
        location,
        price,
        price_per_night,
        rating,
        amenities,
        platform,
        booking_url,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'proposed'))
      RETURNING
        id,
        trip_id,
        proposed_by,
        hotel_name,
        location,
        price,
        price_per_night,
        rating,
        amenities,
        platform,
        booking_url,
        status,
        average_ranking,
        created_at,
        updated_at
      `,
      [
        proposal.tripId,
        userId,
        proposal.hotelName,
        proposal.location,
        proposal.price,
        proposal.pricePerNight ?? null,
        safeNumberOrNull(proposal.rating as string | number | null | undefined),
        proposal.amenities ?? null,
        proposal.platform,
        proposal.bookingUrl,
        proposal.status ?? "proposed",
      ],
    );

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("Failed to create hotel proposal");
    }

    const proposals = await this.fetchHotelProposals({
      proposalIds: [inserted.id],
      currentUserId: userId,
    });

    const created = proposals[0];
    if (!created) {
      throw new Error("Failed to load created hotel proposal");
    }

    return created;
  }

  async getTripHotelProposals(
    tripId: number,
    currentUserId: string,
    options: { proposedBy?: string } = {},
  ): Promise<HotelProposalWithDetails[]> {
    await this.ensureUniqueHotelRankingsForTrip(tripId);
    return this.fetchHotelProposals({
      tripId,
      currentUserId,
      proposedBy: options.proposedBy,
    });
  }

  async getHotelProposalById(
    proposalId: number,
    currentUserId?: string,
  ): Promise<HotelProposalWithDetails | undefined> {
    const proposals = await this.fetchHotelProposals({
      proposalIds: [proposalId],
      currentUserId,
    });
    return proposals[0];
  }

  async rankHotelProposal(
    ranking: InsertHotelRanking,
    userId: string,
  ): Promise<{ tripId: number; affectedProposalIds: number[] }> {
    const client = await pool.connect();
    let tripId: number | null = null;
    const affectedProposalIds = new Set<number>();

    try {
      await client.query("BEGIN");

      const { rows: proposalRows } = await client.query<{ trip_id: number }>(
        `SELECT trip_id FROM hotel_proposals WHERE id = $1 FOR UPDATE`,
        [ranking.proposalId],
      );

      const proposalRow = proposalRows[0];
      if (!proposalRow) {
        throw new Error("Hotel proposal not found");
      }

      tripId = proposalRow.trip_id;

      const { rows: conflictingRows } = await client.query<{ proposal_id: number }>(
        `
        SELECT hr.proposal_id
        FROM hotel_rankings hr
        JOIN hotel_proposals hp ON hp.id = hr.proposal_id
        WHERE hr.user_id = $1
          AND hp.trip_id = $2
          AND hr.ranking = $3
          AND hr.proposal_id <> $4
        `,
        [userId, tripId, ranking.ranking, ranking.proposalId],
      );

      const conflictingProposalIds = conflictingRows.map((row) => row.proposal_id);

      if (conflictingProposalIds.length > 0) {
        await client.query(
          `
          DELETE FROM hotel_rankings
          WHERE user_id = $1 AND proposal_id = ANY($2::int[])
          `,
          [userId, conflictingProposalIds],
        );
        conflictingProposalIds.forEach((id) => affectedProposalIds.add(id));
      }

      await client.query(
        `
        INSERT INTO hotel_rankings (proposal_id, user_id, ranking, notes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (proposal_id, user_id) DO UPDATE SET
          ranking = EXCLUDED.ranking,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        `,
        [ranking.proposalId, userId, ranking.ranking, ranking.notes ?? null],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    affectedProposalIds.add(ranking.proposalId);

    await Promise.all(
      Array.from(affectedProposalIds).map((proposalId) =>
        this.updateHotelProposalAverageRanking(proposalId),
      ),
    );

    if (tripId == null) {
      throw new Error("Failed to determine trip id for hotel ranking");
    }

    return { tripId, affectedProposalIds: Array.from(affectedProposalIds) };
  }

  async updateProposalAverageRanking(): Promise<void> {
    // Deprecated method retained for backward compatibility
    return Promise.resolve();
  }

  async updateHotelProposalAverageRanking(proposalId: number): Promise<void> {
    const { rows } = await query<{ average: number | null }>(
      `
      SELECT AVG(ranking)::numeric(10,2) AS average
      FROM hotel_rankings
      WHERE proposal_id = $1
      `,
      [proposalId],
    );

    const average = rows[0]?.average ?? null;

    await query(
      `
      UPDATE hotel_proposals
      SET average_ranking = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [average, proposalId],
    );
  }

  async updateHotelProposalStatus(
    proposalId: number,
    status: string,
    currentUserId: string,
  ): Promise<HotelProposalWithDetails> {
    const { rows } = await query<HotelProposalRow>(
      `
      UPDATE hotel_proposals
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        trip_id,
        proposed_by,
        hotel_name,
        location,
        price,
        price_per_night,
        rating,
        amenities,
        platform,
        booking_url,
        status,
        average_ranking,
        created_at,
        updated_at
      `,
      [status, proposalId],
    );

    const updated = rows[0];
    if (!updated) {
      throw new Error("Hotel proposal not found");
    }

    const proposals = await this.fetchHotelProposals({
      proposalIds: [proposalId],
      currentUserId,
    });

    const detailed = proposals[0];
    if (!detailed) {
      throw new Error("Failed to load hotel proposal");
    }

    return detailed;
  }

  async cancelHotelProposal(
    proposalId: number,
    currentUserId: string,
  ): Promise<HotelProposalWithDetails> {
    const proposal = await this.getHotelProposalById(proposalId, currentUserId);
    if (!proposal) {
      throw new Error("Hotel proposal not found");
    }

    const proposerId = normalizeUserId(proposal.proposedBy);
    const requesterId = normalizeUserId(currentUserId);

    if (!proposerId || !requesterId || proposerId !== requesterId) {
      throw new Error("You can only cancel proposals you created");
    }

    const normalizedStatus = (proposal.status ?? "active").toLowerCase();
    if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
      return proposal;
    }

    await this.removeScheduledItemsForProposal("hotel", proposalId);

    await query(
      `
      UPDATE hotel_proposals
      SET status = 'canceled', updated_at = NOW()
      WHERE id = $1
      `,
      [proposalId],
    );

    const updated = await this.getHotelProposalById(proposalId, currentUserId);
    if (!updated) {
      throw new Error("Failed to load hotel proposal");
    }

    await this.notifyProposalCancellation({
      tripId: updated.tripId,
      proposalType: "hotel",
      proposalName: updated.hotelName,
      canceledBy: currentUserId,
    });

    return updated;
  }
  async addFlight(
    flight: InsertFlight | Record<string, unknown>,
    userId: string,
  ): Promise<Flight> {
    const record = flight as Record<string, unknown>;

    const getValue = (camelKey: string): unknown => {
      if (record[camelKey] !== undefined) {
        return record[camelKey];
      }

      const snakeKey = camelToSnakeCase(camelKey);
      return record[snakeKey];
    };

    const requireValue = (camelKey: string): unknown => {
      const value = getValue(camelKey);
      if (value === undefined || value === null) {
        throw new Error(`Missing required flight field: ${camelKey}`);
      }
      return value;
    };

    const requireString = (camelKey: string): string => {
      const value = requireValue(camelKey);
      const str =
        typeof value === "string" ? value.trim() : String(value).trim();
      if (!str) {
        throw new Error(`Missing required flight field: ${camelKey}`);
      }
      return str;
    };

    const optionalTrimmedString = (camelKey: string): string | null => {
      const value = getValue(camelKey);
      if (value === undefined || value === null) {
        return null;
      }

      const str =
        typeof value === "string" ? value.trim() : String(value).trim();
      return str.length > 0 ? str : null;
    };

    const parseTimestamp = (value: unknown, field: string): Date => {
      if (value instanceof Date) {
        return value;
      }

      if (typeof value === "string" || typeof value === "number") {
        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) {
          return parsed;
        }
      }

      throw new Error(`Invalid date for flight field: ${field}`);
    };

    const parseJsonValue = (value: unknown): unknown | null => {
      if (value === undefined || value === null) {
        return null;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
          return null;
        }

        try {
          return JSON.parse(trimmed);
        } catch {
          return null;
        }
      }

      return value;
    };

    const tripIdRaw = requireValue("tripId");
    const tripId =
      typeof tripIdRaw === "number" ? tripIdRaw : Number(tripIdRaw as string);
    if (!Number.isFinite(tripId)) {
      throw new Error("Invalid trip ID for flight insert");
    }

    const normalizedUserId =
      normalizeUserId(optionalTrimmedString("userId")) ??
      normalizeUserId(userId);
    if (!normalizedUserId) {
      throw new Error("Missing user ID for flight insert");
    }

    const flightNumber = requireString("flightNumber");
    const airline = requireString("airline");
    const airlineCode = requireString("airlineCode");
    const departureAirport = requireString("departureAirport");
    const departureCode = requireString("departureCode");
    const arrivalAirport = requireString("arrivalAirport");
    const arrivalCode = requireString("arrivalCode");
    const flightType = requireString("flightType");

    const departureTime = parseTimestamp(
      requireValue("departureTime"),
      "departureTime",
    );
    const arrivalTime = parseTimestamp(
      requireValue("arrivalTime"),
      "arrivalTime",
    );

    const priceValue = toNumberOrNull(
      getValue("price") as string | number | null | undefined,
    );
    const flightDurationValue = toNumberOrNull(
      getValue("flightDuration") as string | number | null | undefined,
    );

    const layoversValue = parseJsonValue(getValue("layovers"));
    const baggageValue = parseJsonValue(getValue("baggage"));

    const { rows } = await query<FlightRow>(
      `
      INSERT INTO flights (
        trip_id,
        user_id,
        flight_number,
        airline,
        airline_code,
        departure_airport,
        departure_code,
        departure_time,
        departure_terminal,
        departure_gate,
        arrival_airport,
        arrival_code,
        arrival_time,
        arrival_terminal,
        arrival_gate,
        booking_reference,
        seat_number,
        seat_class,
        price,
        currency,
        flight_type,
        status,
        layovers,
        booking_source,
        purchase_url,
        aircraft,
        flight_duration,
        baggage,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, NOW(), NOW()
      )
      RETURNING
        id,
        trip_id,
        user_id,
        flight_number,
        airline,
        airline_code,
        departure_airport,
        departure_code,
        departure_time,
        departure_terminal,
        departure_gate,
        arrival_airport,
        arrival_code,
        arrival_time,
        arrival_terminal,
        arrival_gate,
        booking_reference,
        seat_number,
        seat_class,
        price,
        currency,
        flight_type,
        status,
        layovers,
        booking_source,
        purchase_url,
        aircraft,
        flight_duration,
        baggage,
        created_at,
        updated_at
      `,
      [
        tripId,
        normalizedUserId,
        flightNumber,
        airline,
        airlineCode,
        departureAirport,
        departureCode,
        departureTime,
        optionalTrimmedString("departureTerminal"),
        optionalTrimmedString("departureGate"),
        arrivalAirport,
        arrivalCode,
        arrivalTime,
        optionalTrimmedString("arrivalTerminal"),
        optionalTrimmedString("arrivalGate"),
        optionalTrimmedString("bookingReference"),
        optionalTrimmedString("seatNumber"),
        optionalTrimmedString("seatClass"),
        priceValue,
        optionalTrimmedString("currency") ?? "USD",
        flightType,
        optionalTrimmedString("status") ?? "confirmed",
        layoversValue,
        optionalTrimmedString("bookingSource") ?? "manual",
        optionalTrimmedString("purchaseUrl"),
        optionalTrimmedString("aircraft"),
        flightDurationValue,
        baggageValue,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create flight");
    }

    return mapFlight(row);
  }
  async addHotel(
    hotel: InsertHotel | Record<string, unknown>,
    userId: string,
  ): Promise<Hotel> {
    return this.createHotel(hotel, userId);
  }

  async createFlightProposal(
    proposal: InsertFlightProposal,
    userId: string,
  ): Promise<FlightProposalWithDetails> {
    const { rows } = await query<FlightProposalRow>(
      `
      INSERT INTO flight_proposals (
        trip_id,
        proposed_by,
        airline,
        flight_number,
        departure_airport,
        departure_time,
        departure_terminal,
        arrival_airport,
        arrival_time,
        arrival_terminal,
        duration,
        stops,
        aircraft,
        price,
        currency,
        booking_url,
        platform,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, COALESCE($18, 'active')
      )
      RETURNING
        id,
        trip_id,
        proposed_by,
        airline,
        flight_number,
        departure_airport,
        departure_time,
        departure_terminal,
        arrival_airport,
        arrival_time,
        arrival_terminal,
        duration,
        stops,
        aircraft,
        price,
        currency,
        booking_url,
        platform,
        status,
        average_ranking,
        created_at,
        updated_at
      `,
      [
        proposal.tripId,
        userId,
        proposal.airline,
        proposal.flightNumber,
        proposal.departureAirport,
        proposal.departureTime,
        proposal.departureTerminal ?? null,
        proposal.arrivalAirport,
        proposal.arrivalTime,
        proposal.arrivalTerminal ?? null,
        proposal.duration,
        proposal.stops,
        proposal.aircraft ?? null,
        proposal.price,
        proposal.currency,
        proposal.bookingUrl,
        proposal.platform,
        proposal.status ?? "active",
      ],
    );

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("Failed to create flight proposal");
    }

    const proposals = await this.fetchFlightProposals({
      proposalIds: [inserted.id],
      currentUserId: userId,
    });

    const created = proposals[0];
    if (!created) {
      throw new Error("Failed to load created flight proposal");
    }

    return created;
  }

  async getTripFlightProposals(
    tripId: number,
    currentUserId: string,
    options: { proposedBy?: string } = {},
  ): Promise<FlightProposalWithDetails[]> {
    await this.ensureUniqueFlightRankingsForTrip(tripId);
    return this.fetchFlightProposals({
      tripId,
      currentUserId,
      proposedBy: options.proposedBy,
    });
  }

  async getFlightProposalById(
    proposalId: number,
    currentUserId?: string,
  ): Promise<FlightProposalWithDetails | undefined> {
    const proposals = await this.fetchFlightProposals({
      proposalIds: [proposalId],
      currentUserId,
    });
    return proposals[0];
  }

  async rankFlightProposal(
    ranking: InsertFlightRanking,
    userId: string,
  ): Promise<{ tripId: number; affectedProposalIds: number[] }> {
    const client = await pool.connect();
    const affectedProposalIds = new Set<number>();
    let tripId: number | null = null;

    try {
      await client.query("BEGIN");

      const { rows: proposalRows } = await client.query<{ trip_id: number }>(
        `SELECT trip_id FROM flight_proposals WHERE id = $1 FOR UPDATE`,
        [ranking.proposalId],
      );

      const proposalRow = proposalRows[0];
      if (!proposalRow) {
        throw new Error("Flight proposal not found");
      }

      tripId = proposalRow.trip_id;

      const { rows: conflictingRows } = await client.query<{ proposal_id: number }>(
        `
        SELECT fr.proposal_id
        FROM flight_rankings fr
        JOIN flight_proposals fp ON fp.id = fr.proposal_id
        WHERE fr.user_id = $1
          AND fp.trip_id = $2
          AND fr.ranking = $3
          AND fr.proposal_id <> $4
        `,
        [userId, proposalRow.trip_id, ranking.ranking, ranking.proposalId],
      );

      const conflictingProposalIds = conflictingRows.map((row) => row.proposal_id);

      if (conflictingProposalIds.length > 0) {
        await client.query(
          `
          DELETE FROM flight_rankings
          WHERE user_id = $1 AND proposal_id = ANY($2::int[])
          `,
          [userId, conflictingProposalIds],
        );
        conflictingProposalIds.forEach((id) => affectedProposalIds.add(id));
      }

      await client.query(
        `
        INSERT INTO flight_rankings (proposal_id, user_id, ranking, notes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (proposal_id, user_id) DO UPDATE SET
          ranking = EXCLUDED.ranking,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        `,
        [ranking.proposalId, userId, ranking.ranking, ranking.notes ?? null],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    affectedProposalIds.add(ranking.proposalId);

    await Promise.all(
      Array.from(affectedProposalIds).map((proposalId) =>
        this.updateFlightProposalAverageRanking(proposalId),
      ),
    );

    if (tripId == null) {
      throw new Error("Failed to determine trip id for flight ranking");
    }

    return { tripId, affectedProposalIds: Array.from(affectedProposalIds) };
  }

  async updateFlightProposalAverageRanking(proposalId: number): Promise<void> {
    const { rows } = await query<{ average: number | null }>(
      `
      SELECT AVG(ranking)::numeric(10,2) AS average
      FROM flight_rankings
      WHERE proposal_id = $1
      `,
      [proposalId],
    );

    const average = rows[0]?.average ?? null;

    await query(
      `
      UPDATE flight_proposals
      SET average_ranking = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [average, proposalId],
    );
  }

  async updateFlightProposalStatus(
    proposalId: number,
    status: string,
    currentUserId: string,
  ): Promise<FlightProposalWithDetails> {
    const { rows } = await query<FlightProposalRow>(
      `
      UPDATE flight_proposals
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        trip_id,
        proposed_by,
        airline,
        flight_number,
        departure_airport,
        departure_time,
        departure_terminal,
        arrival_airport,
        arrival_time,
        arrival_terminal,
        duration,
        stops,
        aircraft,
        price,
        currency,
        booking_url,
        platform,
        status,
        average_ranking,
        created_at,
        updated_at
      `,
      [status, proposalId],
    );

    const updated = rows[0];
    if (!updated) {
      throw new Error("Flight proposal not found");
    }

    const proposals = await this.fetchFlightProposals({
      proposalIds: [proposalId],
      currentUserId,
    });

    const detailed = proposals[0];
    if (!detailed) {
      throw new Error("Failed to load flight proposal");
    }

    return detailed;
  }

  async cancelFlightProposal(
    proposalId: number,
    currentUserId: string,
  ): Promise<FlightProposalWithDetails> {
    const proposal = await this.getFlightProposalById(proposalId, currentUserId);
    if (!proposal) {
      throw new Error("Flight proposal not found");
    }

    const proposerId = normalizeUserId(proposal.proposedBy);
    const requesterId = normalizeUserId(currentUserId);

    if (!proposerId || !requesterId || proposerId !== requesterId) {
      throw new Error("You can only cancel proposals you created");
    }

    const normalizedStatus = (proposal.status ?? "active").toLowerCase();
    if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
      return proposal;
    }

    await this.removeScheduledItemsForProposal("flight", proposalId);

    await query(
      `
      UPDATE flight_proposals
      SET status = 'canceled', updated_at = NOW()
      WHERE id = $1
      `,
      [proposalId],
    );

    const updated = await this.getFlightProposalById(proposalId, currentUserId);
    if (!updated) {
      throw new Error("Failed to load flight proposal");
    }

    const proposalLabel = `${updated.airline} ${updated.flightNumber}`.trim();

    await this.notifyProposalCancellation({
      tripId: updated.tripId,
      proposalType: "flight",
      proposalName: proposalLabel,
      canceledBy: currentUserId,
    });

    return updated;
  }

  // Wish List / Ideas board methods
  async createWishListIdea(
    idea: InsertWishListIdea,
    userId: string,
  ): Promise<WishListIdea> {
    await this.ensureWishListStructures();

    const { rows } = await query<WishListIdeaRow>(
      `
      INSERT INTO trip_wish_list_items (
        trip_id,
        title,
        url,
        notes,
        tags,
        thumbnail_url,
        image_url,
        metadata,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING
        id,
        trip_id,
        title,
        url,
        notes,
        tags,
        thumbnail_url,
        image_url,
        metadata,
        created_by,
        promoted_draft_id,
        created_at,
        updated_at
      `,
      [
        idea.tripId,
        idea.title.trim(),
        idea.url ?? null,
        idea.notes ?? null,
        toDbJson(idea.tags ?? []),
        idea.thumbnailUrl ?? null,
        idea.imageUrl ?? null,
        toDbJson(idea.metadata ?? null),
        userId,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create wish list idea");
    }

    return mapWishListIdea(row);
  }

  async getWishListIdeaById(
    ideaId: number,
  ): Promise<WishListIdea | undefined> {
    await this.ensureWishListStructures();

    const { rows } = await query<WishListIdeaRow>(
      `
      SELECT
        id,
        trip_id,
        title,
        url,
        notes,
        tags,
        thumbnail_url,
        image_url,
        metadata,
        created_by,
        promoted_draft_id,
        created_at,
        updated_at
      FROM trip_wish_list_items
      WHERE id = $1
      LIMIT 1
      `,
      [ideaId],
    );

    const row = rows[0];
    if (!row) {
      return undefined;
    }

    return mapWishListIdea(row);
  }

  async getWishListIdeaForUser(
    ideaId: number,
    userId: string,
  ): Promise<WishListIdeaWithDetails | undefined> {
    await this.ensureWishListStructures();

    const { rows } = await query<WishListIdeaWithCountsRow>(
      `
      SELECT
        i.id,
        i.trip_id,
        i.title,
        i.url,
        i.notes,
        i.tags,
        i.thumbnail_url,
        i.image_url,
        i.metadata,
        i.created_by,
        i.promoted_draft_id,
        i.created_at,
        i.updated_at,
        (
          SELECT COUNT(*)::int
          FROM trip_wish_list_saves s
          WHERE s.item_id = i.id
        ) AS save_count,
        EXISTS (
          SELECT 1
          FROM trip_wish_list_saves s
          WHERE s.item_id = i.id AND s.user_id = $2
        ) AS saved_by_user,
        (
          SELECT COUNT(*)::int
          FROM trip_wish_list_comments c
          WHERE c.item_id = i.id
        ) AS comment_count,
        ${selectUserColumns("creator", "creator_")}
      FROM trip_wish_list_items i
      JOIN users creator ON creator.id = i.created_by
      WHERE i.id = $1
      LIMIT 1
      `,
      [ideaId, userId],
    );

    const row = rows[0];
    if (!row) {
      return undefined;
    }

    return mapWishListIdeaWithDetails(row);
  }

  async getTripWishListIdeas(
    tripId: number,
    userId: string | null,
    options: {
      sort?: "newest" | "oldest" | "most_saved";
      tag?: string | null;
      submittedBy?: string | null;
      search?: string | null;
      minLikes?: number | null;
    } = {},
  ): Promise<WishListIdeaWithDetails[]> {
    await this.ensureWishListStructures();

    const conditions: string[] = ["i.trip_id = $1"];
    const values: unknown[] = [tripId];
    let paramIndex = 2;

    let savedByUserSelect = "FALSE AS saved_by_user,";

    if (userId) {
      values.push(userId);
      savedByUserSelect = `
        EXISTS (
          SELECT 1
          FROM trip_wish_list_saves s
          WHERE s.item_id = i.id AND s.user_id = $2
        ) AS saved_by_user,
      `;
      paramIndex = 3;
    }

    if (options.tag) {
      conditions.push(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(COALESCE(i.tags, '[]'::jsonb)) AS tag
          WHERE LOWER(tag) = LOWER($${paramIndex})
        )`,
      );
      values.push(options.tag);
      paramIndex += 1;
    }

    if (options.submittedBy) {
      conditions.push(`i.created_by = $${paramIndex}`);
      values.push(options.submittedBy);
      paramIndex += 1;
    }

    if (options.search) {
      const searchValue = `%${options.search.toLowerCase()}%`;
      conditions.push(
        `(
          LOWER(i.title) LIKE $${paramIndex}
          OR LOWER(COALESCE(i.notes, '')) LIKE $${paramIndex}
          OR LOWER(COALESCE(i.url, '')) LIKE $${paramIndex}
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(COALESCE(i.tags, '[]'::jsonb)) AS tag
            WHERE LOWER(tag) LIKE $${paramIndex}
          )
        )`,
      );
      values.push(searchValue);
      paramIndex += 1;
    }

    if (typeof options.minLikes === "number" && options.minLikes > 0) {
      conditions.push(`(
        SELECT COUNT(*)
        FROM trip_wish_list_saves s
        WHERE s.item_id = i.id
      ) >= $${paramIndex}`);
      values.push(options.minLikes);
      paramIndex += 1;
    }

    let sql = `
      SELECT
        i.id,
        i.trip_id,
        i.title,
        i.url,
        i.notes,
        i.tags,
        i.thumbnail_url,
        i.image_url,
        i.metadata,
        i.created_by,
        i.promoted_draft_id,
        i.created_at,
        i.updated_at,
        (
          SELECT COUNT(*)::int
          FROM trip_wish_list_saves s
          WHERE s.item_id = i.id
        ) AS save_count,
        ${savedByUserSelect}
        (
          SELECT COUNT(*)::int
          FROM trip_wish_list_comments c
          WHERE c.item_id = i.id
        ) AS comment_count,
        ${selectUserColumns("creator", "creator_")}
      FROM trip_wish_list_items i
      JOIN users creator ON creator.id = i.created_by
    `;

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    const sort = options.sort ?? "newest";
    if (sort === "oldest") {
      sql += " ORDER BY i.created_at ASC, i.id ASC";
    } else if (sort === "most_saved") {
      sql += " ORDER BY save_count DESC, i.created_at DESC, i.id DESC";
    } else {
      sql += " ORDER BY i.created_at DESC, i.id DESC";
    }

    const cleanedSql = sql.replace(/,\s*,/g, ",");

    const { rows } = await query<WishListIdeaWithCountsRow>(cleanedSql, values);

    return rows.map(mapWishListIdeaWithDetails);
  }

  async toggleWishListSave(
    ideaId: number,
    userId: string,
  ): Promise<{ saved: boolean; saveCount: number }> {
    await this.ensureWishListStructures();

    await query("BEGIN");
    let saved = false;
    try {
      const { rows: existingRows } = await query<{ id: number }>(
        `
        SELECT id
        FROM trip_wish_list_saves
        WHERE item_id = $1 AND user_id = $2
        LIMIT 1
        `,
        [ideaId, userId],
      );

      if (existingRows[0]) {
        await query(
          `
          DELETE FROM trip_wish_list_saves
          WHERE id = $1
          `,
          [existingRows[0].id],
        );
        saved = false;
      } else {
        await query(
          `
          INSERT INTO trip_wish_list_saves (item_id, user_id)
          VALUES ($1, $2)
          `,
          [ideaId, userId],
        );
        saved = true;
      }

      const { rows: countRows } = await query<{ count: number }>(
        `
        SELECT COUNT(*)::int AS count
        FROM trip_wish_list_saves
        WHERE item_id = $1
        `,
        [ideaId],
      );

      await query("COMMIT");
      return { saved, saveCount: Number(countRows[0]?.count ?? 0) };
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  }

  async addWishListComment(
    ideaId: number,
    userId: string,
    comment: string,
  ): Promise<WishListCommentWithUser> {
    await this.ensureWishListStructures();

    const { rows } = await query<WishListCommentRow>(
      `
      INSERT INTO trip_wish_list_comments (item_id, user_id, comment)
      VALUES ($1, $2, $3)
      RETURNING id, item_id, user_id, comment, created_at
      `,
      [ideaId, userId, comment],
    );

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("Failed to add comment");
    }

    const { rows: withUserRows } = await query<WishListCommentWithUserRow>(
      `
      SELECT
        c.id,
        c.item_id,
        c.user_id,
        c.comment,
        c.created_at,
        ${selectUserColumns("u", "user_")}
      FROM trip_wish_list_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.id = $1
      LIMIT 1
      `,
      [inserted.id],
    );

    const rowWithUser = withUserRows[0];
    if (!rowWithUser) {
      throw new Error("Failed to load created comment");
    }

    return mapWishListCommentWithUser(rowWithUser);
  }

  async getWishListComments(
    ideaId: number,
  ): Promise<WishListCommentWithUser[]> {
    await this.ensureWishListStructures();

    const { rows } = await query<WishListCommentWithUserRow>(
      `
      SELECT
        c.id,
        c.item_id,
        c.user_id,
        c.comment,
        c.created_at,
        ${selectUserColumns("u", "user_")}
      FROM trip_wish_list_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.item_id = $1
      ORDER BY c.created_at ASC, c.id ASC
      `,
      [ideaId],
    );

    return rows.map(mapWishListCommentWithUser);
  }

  async deleteWishListIdea(ideaId: number): Promise<void> {
    await this.ensureWishListStructures();

    const { rows } = await query<{ id: number }>(
      `
      DELETE FROM trip_wish_list_items
      WHERE id = $1
      RETURNING id
      `,
      [ideaId],
    );

    if (!rows[0]) {
      throw new Error("Wish list idea not found");
    }
  }

  async promoteWishListIdea(
    ideaId: number,
    userId: string,
  ): Promise<WishListProposalDraftWithDetails> {
    await this.ensureWishListStructures();

    const idea = await this.getWishListIdeaById(ideaId);
    if (!idea) {
      throw new Error("Wish list idea not found");
    }

    const { rows } = await query<WishListProposalDraftRow>(
      `
      INSERT INTO trip_proposal_drafts (
        trip_id,
        item_id,
        created_by,
        title,
        url,
        notes,
        tags,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft')
      ON CONFLICT (item_id) DO UPDATE SET
        title = EXCLUDED.title,
        url = EXCLUDED.url,
        notes = EXCLUDED.notes,
        tags = EXCLUDED.tags,
        status = 'draft',
        created_by = EXCLUDED.created_by,
        updated_at = NOW()
      RETURNING
        id,
        trip_id,
        item_id,
        created_by,
        title,
        url,
        notes,
        tags,
        status,
        created_at,
        updated_at
      `,
      [
        idea.tripId,
        idea.id,
        userId,
        idea.title,
        idea.url ?? null,
        idea.notes ?? null,
        toDbJson(idea.tags ?? []),
      ],
    );

    const draftRow = rows[0];
    if (!draftRow) {
      throw new Error("Failed to promote wish list idea");
    }

    await query(
      `
      UPDATE trip_wish_list_items
      SET promoted_draft_id = $2, updated_at = NOW()
      WHERE id = $1
      `,
      [ideaId, draftRow.id],
    );

    const { rows: draftWithCreator } = await query<WishListProposalDraftWithCreatorRow>(
      `
      SELECT
        d.id,
        d.trip_id,
        d.item_id,
        d.created_by,
        d.title,
        d.url,
        d.notes,
        d.tags,
        d.status,
        d.created_at,
        d.updated_at,
        ${selectUserColumns("creator", "creator_")}
      FROM trip_proposal_drafts d
      JOIN users creator ON creator.id = d.created_by
      WHERE d.id = $1
      LIMIT 1
      `,
      [draftRow.id],
    );

    const draftWithDetails = draftWithCreator[0];
    if (!draftWithDetails) {
      throw new Error("Failed to load proposal draft");
    }

    return mapWishListProposalDraftWithDetails(draftWithDetails);
  }

  async getTripProposalDrafts(
    tripId: number,
  ): Promise<WishListProposalDraftWithDetails[]> {
    await this.ensureWishListStructures();

    const { rows } = await query<WishListProposalDraftWithCreatorRow>(
      `
      SELECT
        d.id,
        d.trip_id,
        d.item_id,
        d.created_by,
        d.title,
        d.url,
        d.notes,
        d.tags,
        d.status,
        d.created_at,
        d.updated_at,
        ${selectUserColumns("creator", "creator_")}
      FROM trip_proposal_drafts d
      JOIN users creator ON creator.id = d.created_by
      WHERE d.trip_id = $1
      ORDER BY d.created_at DESC, d.id DESC
      `,
      [tripId],
    );

    return rows.map(mapWishListProposalDraftWithDetails);
  }

  async getTravelTips(
    filters: {
      category?: string;
      destination?: string;
      limit?: number;
    } = {},
  ): Promise<TravelTipWithDetails[]> {
    const conditions: string[] = ["tt.is_active = TRUE"];
    const values: unknown[] = [];
    let index = 1;

    if (filters.category) {
      conditions.push(`tt.category = $${index}`);
      values.push(filters.category);
      index += 1;
    }

    if (filters.destination) {
      conditions.push(
        `(tt.destination = $${index} OR tt.destination = '*' OR tt.destination IS NULL)`,
      );
      values.push(filters.destination);
      index += 1;
    }

    let sql = `
      SELECT
        tt.id,
        tt.content,
        tt.category,
        tt.destination,
        tt.applicable_regions,
        tt.activity_categories,
        tt.seasonality,
        tt.priority,
        tt.tags,
        tt.is_active,
        tt.created_by,
        tt.source,
        tt.created_at,
        tt.updated_at,
        creator.id AS creator_id,
        creator.email AS creator_email,
        creator.username AS creator_username,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name,
        creator.phone_number AS creator_phone_number,
        creator.password_hash AS creator_password_hash,
        creator.profile_image_url AS creator_profile_image_url,
        creator.cashapp_username AS creator_cashapp_username,
        creator.cash_app_username AS creator_cash_app_username,
        creator.cashapp_phone AS creator_cashapp_phone,
        creator.cash_app_phone AS creator_cash_app_phone,
        creator.venmo_username AS creator_venmo_username,
        creator.venmo_phone AS creator_venmo_phone,
        creator.timezone AS creator_timezone,
        creator.default_location AS creator_default_location,
        creator.default_location_code AS creator_default_location_code,
        creator.default_city AS creator_default_city,
        creator.default_country AS creator_default_country,
        creator.auth_provider AS creator_auth_provider,
        creator.notification_preferences AS creator_notification_preferences,
        creator.has_seen_home_onboarding AS creator_has_seen_home_onboarding,
        creator.has_seen_trip_onboarding AS creator_has_seen_trip_onboarding,
        creator.created_at AS creator_created_at,
        creator.updated_at AS creator_updated_at
      FROM travel_tips tt
      LEFT JOIN users creator ON creator.id = tt.created_by
    `;

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }

    sql += " ORDER BY tt.priority DESC, tt.id ASC";

    if (filters.limit && filters.limit > 0) {
      sql += ` LIMIT $${index}`;
      values.push(filters.limit);
    }

    const { rows } = await query<TravelTipWithDetailsRow>(sql, values);

    return rows.map(mapTravelTipWithDetails);
  }

  async createTravelTip(tip: InsertTravelTipInput): Promise<TravelTip> {
    const {
      content,
      category,
      destination = null,
      applicableRegions = null,
      activityCategories = null,
      seasonality = null,
      priority = 3,
      tags = null,
      isActive = true,
      createdBy = null,
      source = null,
    } = tip;

    const { rows } = await query<TravelTipRow>(
      `
      INSERT INTO travel_tips (
        content,
        category,
        destination,
        applicable_regions,
        activity_categories,
        seasonality,
        priority,
        tags,
        is_active,
        created_by,
        source
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10,
        $11
      )
      RETURNING
        id,
        content,
        category,
        destination,
        applicable_regions,
        activity_categories,
        seasonality,
        priority,
        tags,
        is_active,
        created_by,
        source,
        created_at,
        updated_at
      `,
      [
        content,
        category,
        destination,
        toDbJson(applicableRegions),
        toDbJson(activityCategories),
        toDbJson(seasonality),
        priority,
        toDbJson(tags),
        isActive,
        createdBy,
        source,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create travel tip");
    }

    return mapTravelTip(row);
  }

  async seedTravelTips(): Promise<void> {
    const { rows: countRows } = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM travel_tips`,
    );

    const count = Number(countRows[0]?.count ?? "0");
    if (count > 0) {
      return;
    }

    const defaultTips: InsertTravelTipInput[] = [
      {
        category: "packing",
        destination: "*",
        content: JSON.stringify({
          title: "Pack a universal power adapter",
          description:
            "Different countries use different plug types. Bring a universal adapter to keep your devices charged.",
        }),
        priority: 5,
        tags: ["electronics", "essentials"],
        activityCategories: ["sightseeing", "business", "family"],
        seasonality: ["all"],
        source: "system",
        isActive: true,
      },
      {
        category: "safety",
        destination: "*",
        content: JSON.stringify({
          title: "Keep digital copies of important documents",
          description:
            "Store scans of your passport, IDs, and travel insurance in a secure cloud service in case originals are lost.",
        }),
        priority: 4,
        tags: ["documents", "preparedness"],
        activityCategories: ["all"],
        seasonality: ["all"],
        source: "system",
        isActive: true,
      },
      {
        category: "transportation",
        destination: "Europe",
        content: JSON.stringify({
          title: "Validate train tickets before boarding",
          description:
            "Many European rail systems require you to validate paper tickets at the platform kiosk before boarding to avoid fines.",
        }),
        priority: 3,
        tags: ["train", "validation"],
        activityCategories: ["sightseeing", "adventure"],
        seasonality: ["all"],
        source: "system",
        isActive: true,
      },
      {
        category: "weather",
        destination: "tropical",
        content: JSON.stringify({
          title: "Plan for sudden rain showers",
          description:
            "In tropical climates, afternoon storms are common. Pack a lightweight rain jacket or poncho for daily excursions.",
        }),
        priority: 3,
        tags: ["rain", "climate"],
        activityCategories: ["outdoor", "beach"],
        seasonality: ["summer", "all"],
        source: "system",
        isActive: true,
      },
      {
        category: "dining",
        destination: "Asia",
        content: JSON.stringify({
          title: "Carry cash for local food markets",
          description:
            "Smaller vendors may not accept cards. Keep small bills ready when exploring street food markets.",
        }),
        priority: 4,
        tags: ["food", "cash"],
        activityCategories: ["culinary", "street_food"],
        seasonality: ["all"],
        source: "system",
        isActive: true,
      },
    ];

    for (const tip of defaultTips) {
      await this.createTravelTip(tip);
    }
  }

  async getUserTipPreferences(
    userId: string,
  ): Promise<UserTipPreferences | undefined> {
    const { rows } = await query<UserTipPreferencesRow>(
      `
      SELECT
        id,
        user_id,
        preferred_categories,
        dismissed_tips,
        preferred_language,
        show_seasonal_tips,
        show_location_tips,
        show_activity_tips,
        tip_frequency,
        created_at,
        updated_at
      FROM user_tip_preferences
      WHERE user_id = $1
      LIMIT 1
      `,
      [userId],
    );

    const row = rows[0];
    if (!row) {
      return undefined;
    }

    return mapUserTipPreferences(row);
  }

  async createOrUpdateUserTipPreferences(
    userId: string,
    preferences: Partial<InsertUserTipPreferences>,
  ): Promise<UserTipPreferences> {
    const existing = await this.getUserTipPreferences(userId);

    const preferredCategories =
      preferences.preferredCategories ?? existing?.preferredCategories ?? [];
    const dismissedTips =
      preferences.dismissedTips ?? existing?.dismissedTips ?? [];
    const preferredLanguage =
      preferences.preferredLanguage ?? existing?.preferredLanguage ?? null;
    const showSeasonalTips =
      preferences.showSeasonalTips ?? existing?.showSeasonalTips ?? true;
    const showLocationTips =
      preferences.showLocationTips ?? existing?.showLocationTips ?? true;
    const showActivityTips =
      preferences.showActivityTips ?? existing?.showActivityTips ?? true;
    const tipFrequency =
      preferences.tipFrequency ?? existing?.tipFrequency ?? "normal";

    const { rows } = await query<UserTipPreferencesRow>(
      `
      INSERT INTO user_tip_preferences (
        user_id,
        preferred_categories,
        dismissed_tips,
        preferred_language,
        show_seasonal_tips,
        show_location_tips,
        show_activity_tips,
        tip_frequency
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8
      )
      ON CONFLICT (user_id) DO UPDATE SET
        preferred_categories = EXCLUDED.preferred_categories,
        dismissed_tips = EXCLUDED.dismissed_tips,
        preferred_language = EXCLUDED.preferred_language,
        show_seasonal_tips = EXCLUDED.show_seasonal_tips,
        show_location_tips = EXCLUDED.show_location_tips,
        show_activity_tips = EXCLUDED.show_activity_tips,
        tip_frequency = EXCLUDED.tip_frequency,
        updated_at = NOW()
      RETURNING
        id,
        user_id,
        preferred_categories,
        dismissed_tips,
        preferred_language,
        show_seasonal_tips,
        show_location_tips,
        show_activity_tips,
        tip_frequency,
        created_at,
        updated_at
      `,
      [
        userId,
        toDbJson(preferredCategories),
        toDbJson(dismissedTips),
        preferredLanguage,
        showSeasonalTips,
        showLocationTips,
        showActivityTips,
        tipFrequency,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to upsert user tip preferences");
    }

    return mapUserTipPreferences(row);
  }

  async dismissTipForUser(userId: string, tipId: number): Promise<void> {
    if (!Number.isFinite(tipId)) {
      throw new Error("Invalid tip identifier");
    }

    const existing = await this.getUserTipPreferences(userId);

    const dismissedSet = new Set<number>();
    if (existing?.dismissedTips && Array.isArray(existing.dismissedTips)) {
      for (const value of existing.dismissedTips) {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue)) {
          dismissedSet.add(numericValue);
        }
      }
    }

    dismissedSet.add(tipId);

    await this.createOrUpdateUserTipPreferences(userId, {
      dismissedTips: Array.from(dismissedSet),
    });
  }
  async createRestaurantProposal(
    proposal: InsertRestaurantProposal,
    userId: string,
  ): Promise<RestaurantProposalWithDetails> {
    const { rows } = await query<RestaurantProposalRow>(
      `
      INSERT INTO restaurant_proposals (
        trip_id,
        proposed_by,
        restaurant_name,
        address,
        cuisine_type,
        price_range,
        rating,
        phone_number,
        website,
        reservation_url,
        platform,
        atmosphere,
        specialties,
        dietary_options,
        preferred_meal_time,
        preferred_dates,
        features,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, COALESCE($18, 'active')
      )
      RETURNING
        id,
        trip_id,
        proposed_by,
        restaurant_name,
        address,
        cuisine_type,
        price_range,
        rating,
        phone_number,
        website,
        reservation_url,
        platform,
        atmosphere,
        specialties,
        dietary_options,
        preferred_meal_time,
        preferred_dates,
        features,
        status,
        average_ranking,
        created_at,
        updated_at
      `,
      [
        proposal.tripId,
        userId,
        proposal.restaurantName,
        proposal.address,
        proposal.cuisineType ?? null,
        proposal.priceRange ?? null,
        proposal.rating ?? null,
        proposal.phoneNumber ?? null,
        proposal.website ?? null,
        proposal.reservationUrl ?? null,
        proposal.platform,
        proposal.atmosphere ?? null,
        proposal.specialties ?? null,
        toDbJson(proposal.dietaryOptions ?? null),
        proposal.preferredMealTime ?? null,
        toDbJson(proposal.preferredDates ?? null),
        toDbJson(proposal.features ?? null),
        proposal.status ?? "active",
      ],
    );

    const inserted = rows[0];
    if (!inserted) {
      throw new Error("Failed to create restaurant proposal");
    }

    const proposals = await this.fetchRestaurantProposals({
      proposalIds: [inserted.id],
      currentUserId: userId,
    });

    const created = proposals[0];
    if (!created) {
      throw new Error("Failed to load created restaurant proposal");
    }

    return created;
  }

  async getTripRestaurantProposals(
    tripId: number,
    currentUserId: string,
  ): Promise<RestaurantProposalWithDetails[]> {
    await this.ensureManualRestaurantsHaveProposals(tripId);
    await this.ensureUniqueRestaurantRankingsForTrip(tripId);
    return this.fetchRestaurantProposals({ tripId, currentUserId });
  }

  async getRestaurantProposalById(
    proposalId: number,
    currentUserId?: string,
  ): Promise<RestaurantProposalWithDetails | undefined> {
    const proposals = await this.fetchRestaurantProposals({
      proposalIds: [proposalId],
      currentUserId,
    });
    return proposals[0];
  }

  async rankRestaurantProposal(
    ranking: InsertRestaurantRanking,
    userId: string,
  ): Promise<void> {
    const client = await pool.connect();
    const affectedProposalIds = new Set<number>();

    try {
      await client.query("BEGIN");

      const { rows: proposalRows } = await client.query<{ trip_id: number }>(
        `SELECT trip_id FROM restaurant_proposals WHERE id = $1 FOR UPDATE`,
        [ranking.proposalId],
      );

      const proposalRow = proposalRows[0];
      if (!proposalRow) {
        throw new Error("Restaurant proposal not found");
      }

      const { rows: conflictingRows } = await client.query<{ proposal_id: number }>(
        `
        SELECT rr.proposal_id
        FROM restaurant_rankings rr
        JOIN restaurant_proposals rp ON rp.id = rr.proposal_id
        WHERE rr.user_id = $1
          AND rp.trip_id = $2
          AND rr.ranking = $3
          AND rr.proposal_id <> $4
        `,
        [userId, proposalRow.trip_id, ranking.ranking, ranking.proposalId],
      );

      const conflictingProposalIds = conflictingRows.map((row) => row.proposal_id);

      if (conflictingProposalIds.length > 0) {
        await client.query(
          `
          DELETE FROM restaurant_rankings
          WHERE user_id = $1 AND proposal_id = ANY($2::int[])
          `,
          [userId, conflictingProposalIds],
        );
        conflictingProposalIds.forEach((id) => affectedProposalIds.add(id));
      }

      await client.query(
        `
        INSERT INTO restaurant_rankings (proposal_id, user_id, ranking, notes)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (proposal_id, user_id) DO UPDATE SET
          ranking = EXCLUDED.ranking,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        `,
        [ranking.proposalId, userId, ranking.ranking, ranking.notes ?? null],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    affectedProposalIds.add(ranking.proposalId);

    await Promise.all(
      Array.from(affectedProposalIds).map((proposalId) =>
        this.updateRestaurantProposalAverageRanking(proposalId),
      ),
    );
  }

  async updateRestaurantProposalAverageRanking(proposalId: number): Promise<void> {
    const { rows } = await query<{ average: number | null }>(
      `
      SELECT AVG(ranking)::numeric(10,2) AS average
      FROM restaurant_rankings
      WHERE proposal_id = $1
      `,
      [proposalId],
    );

    const average = rows[0]?.average ?? null;

    await query(
      `
      UPDATE restaurant_proposals
      SET average_ranking = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [average, proposalId],
    );
  }

  async updateRestaurantProposalStatus(
    proposalId: number,
    status: string,
    currentUserId: string,
  ): Promise<RestaurantProposalWithDetails> {
    const { rows } = await query<RestaurantProposalRow>(
      `
      UPDATE restaurant_proposals
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING
        id,
        trip_id,
        proposed_by,
        restaurant_name,
        address,
        cuisine_type,
        price_range,
        rating,
        phone_number,
        website,
        reservation_url,
        platform,
        atmosphere,
        specialties,
        dietary_options,
        preferred_meal_time,
        preferred_dates,
        features,
        status,
        average_ranking,
        created_at,
        updated_at
      `,
      [status, proposalId],
    );

    const updated = rows[0];
    if (!updated) {
      throw new Error("Restaurant proposal not found");
    }

    const proposals = await this.fetchRestaurantProposals({
      proposalIds: [proposalId],
      currentUserId,
    });

    const detailed = proposals[0];
    if (!detailed) {
      throw new Error("Failed to load restaurant proposal");
    }

    return detailed;
  }

  async cancelRestaurantProposal(
    proposalId: number,
    currentUserId: string,
  ): Promise<RestaurantProposalWithDetails> {
    const proposal = await this.getRestaurantProposalById(proposalId, currentUserId);
    if (!proposal) {
      throw new Error("Restaurant proposal not found");
    }

    const proposerId = normalizeUserId(proposal.proposedBy);
    const requesterId = normalizeUserId(currentUserId);

    if (!proposerId || !requesterId || proposerId !== requesterId) {
      throw new Error("You can only cancel proposals you created");
    }

    const normalizedStatus = (proposal.status ?? "active").toLowerCase();
    if (normalizedStatus === "canceled" || normalizedStatus === "cancelled") {
      return proposal;
    }

    await this.removeScheduledItemsForProposal("restaurant", proposalId);

    await query(
      `
      UPDATE restaurant_proposals
      SET status = 'canceled', updated_at = NOW()
      WHERE id = $1
      `,
      [proposalId],
    );

    const updated = await this.getRestaurantProposalById(proposalId, currentUserId);
    if (!updated) {
      throw new Error("Failed to load restaurant proposal");
    }

    await this.notifyProposalCancellation({
      tripId: updated.tripId,
      proposalType: "restaurant",
      proposalName: updated.restaurantName,
      canceledBy: currentUserId,
    });

    return updated;
  }
}

export const __testables = {
  mapActivityWithDetails,
};

export const storage = new DatabaseStorage();


