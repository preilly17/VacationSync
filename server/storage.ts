import { query } from "./db";
import {
  type User,
  type UpsertUser,
  type TripCalendar,
  type InsertTripCalendar,
  type TripMember,
  type Activity,
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
} from "@shared/schema";

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
  cashAppPhone: null,
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
  created_at: Date | null;
  updated_at: Date | null;
};

type ActivityWithPosterRow = ActivityRow & PrefixedUserRow<"poster_">;

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

const mapUserFromPrefix = (
  row: Record<string, unknown>,
  prefix: string,
): User => ({
  id: (row[`${prefix}id`] as string) ?? "",
  email: (row[`${prefix}email`] as string) ?? "",
  username: (row[`${prefix}username`] as string | null) ?? null,
  firstName: (row[`${prefix}first_name`] as string | null) ?? null,
  lastName: (row[`${prefix}last_name`] as string | null) ?? null,
  phoneNumber: (row[`${prefix}phone_number`] as string | null) ?? null,
  passwordHash: (row[`${prefix}password_hash`] as string | null) ?? null,
  profileImageUrl: (row[`${prefix}profile_image_url`] as string | null) ?? null,
  cashAppUsername: (row[`${prefix}cashapp_username`] as string | null) ?? null,
  cashAppPhone: (row[`${prefix}cash_app_phone`] as string | null) ?? null,
  venmoUsername: (row[`${prefix}venmo_username`] as string | null) ?? null,
  venmoPhone: (row[`${prefix}venmo_phone`] as string | null) ?? null,
  timezone: (row[`${prefix}timezone`] as string | null) ?? null,
  defaultLocation: (row[`${prefix}default_location`] as string | null) ?? null,
  defaultLocationCode: (row[`${prefix}default_location_code`] as string | null) ?? null,
  defaultCity: (row[`${prefix}default_city`] as string | null) ?? null,
  defaultCountry: (row[`${prefix}default_country`] as string | null) ?? null,
  authProvider: (row[`${prefix}auth_provider`] as string | null) ?? null,
  notificationPreferences: (row[`${prefix}notification_preferences`] as User["notificationPreferences"]) ?? null,
  hasSeenHomeOnboarding: Boolean(row[`${prefix}has_seen_home_onboarding`]),
  hasSeenTripOnboarding: Boolean(row[`${prefix}has_seen_trip_onboarding`]),
  createdAt: (row[`${prefix}created_at`] as Date | null) ?? null,
  updatedAt: (row[`${prefix}updated_at`] as Date | null) ?? null,
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

const mapTrip = (row: TripRow): TripCalendar => ({
  id: row.id,
  name: row.name,
  destination: row.destination,
  startDate: row.start_date,
  endDate: row.end_date,
  shareCode: row.share_code,
  createdBy: row.created_by,
  createdAt: row.created_at,
});

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

const mapActivity = (row: ActivityRow): Activity => ({
  id: row.id,
  tripCalendarId: row.trip_calendar_id,
  postedBy: row.posted_by,
  name: row.name,
  description: row.description,
  startTime: row.start_time,
  endTime: row.end_time,
  location: row.location,
  cost: row.cost,
  maxCapacity: row.max_capacity,
  category: row.category,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapActivityWithDetails = (
  row: ActivityRow & {
    poster: User;
    acceptances: (ActivityAcceptance & { user: User })[];
    comments: (ActivityComment & { user: User })[];
    isAccepted?: boolean;
    hasResponded?: boolean;
  },
): ActivityWithDetails => ({
  ...mapActivity(row),
  poster: row.poster,
  acceptances: row.acceptances,
  comments: row.comments,
  acceptedCount: row.acceptances.length,
  isAccepted: row.isAccepted,
  hasResponded: row.hasResponded,
});

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

const mapExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  tripId: row.trip_id,
  paidBy: row.paid_by,
  amount: row.amount,
  currency: row.currency,
  exchangeRate: row.exchange_rate,
  originalCurrency: row.original_currency,
  convertedAmounts: (row.converted_amounts ?? null) as any,
  description: row.description,
  category: row.category,
  activityId: row.activity_id,
  splitType: row.split_type,
  splitData: (row.split_data ?? null) as any,
  receiptUrl: row.receipt_url,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapExpenseShare = (row: ExpenseShareRow): ExpenseShare => ({
  id: row.id,
  expenseId: row.expense_id,
  userId: row.user_id,
  amount: row.amount,
  isPaid: row.is_paid,
  paidAt: row.paid_at,
  createdAt: row.created_at,
});

const mapExpenseWithDetails = (
  row: ExpenseWithPaidByRow & {
    shares: (ExpenseShare & { user: User })[];
    activity?: Activity;
  },
): ExpenseWithDetails => {
  const baseExpense = mapExpense(row);
  return {
    ...baseExpense,
    paidBy: mapUserFromPrefix(row, "paid_by_"),
    activity: row.activity,
    shares: row.shares,
    totalAmount: Number(baseExpense.amount ?? 0),
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
  estimatedCost: row.estimated_cost,
  notes: parseGroceryNotes(row.notes),
  isPurchased: row.is_purchased,
  actualCost: row.actual_cost,
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
  const numericCost = parseFloat(baseItem.actualCost ?? baseItem.estimatedCost ?? "0");
  const costPerPerson = participants.length > 0 && Number.isFinite(numericCost)
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
  totalAmount: row.total_amount,
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
  price: row.price,
  currency: row.currency,
  flightType: row.flight_type,
  status: row.status,
  layovers: (row.layovers ?? null) as any,
  bookingSource: row.booking_source,
  purchaseUrl: row.purchase_url,
  aircraft: row.aircraft,
  flightDuration: row.flight_duration,
  baggage: (row.baggage ?? null) as any,
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
  hotelRating:
    row.hotel_rating === null
      ? null
      : typeof row.hotel_rating === "number"
        ? row.hotel_rating
        : Number(row.hotel_rating),
  address: row.address,
  city: row.city,
  country: row.country,
  zipCode: row.zip_code,
  latitude: row.latitude,
  longitude: row.longitude,
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
  totalPrice: row.total_price,
  pricePerNight: row.price_per_night,
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
  latitude: row.latitude,
  longitude: row.longitude,
  phoneNumber: row.phone_number,
  website: row.website,
  openTableUrl: row.open_table_url,
  priceRange: row.price_range,
  rating: row.rating,
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

const mapUserTipPreferences = (
  row: UserTipPreferencesRow,
): UserTipPreferences => ({
  id: row.id,
  userId: row.user_id,
  preferredCategories:
    (row.preferred_categories as UserTipPreferences["preferredCategories"]) ??
    [],
  dismissedTips:
    (row.dismissed_tips as UserTipPreferences["dismissedTips"]) ?? [],
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
    let shareCode = "";
    let attempts = 0;

    do {
      shareCode = generateShareCode();
      attempts += 1;
      if (attempts > 10) {
        throw new Error("Failed to generate unique share code");
      }
    } while (await this.shareCodeExists(shareCode));

    const { rows } = await query<TripRow>(
      `
      INSERT INTO trip_calendars (name, destination, start_date, end_date, share_code, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, destination, start_date, end_date, share_code, created_by, created_at
      `,
      [
        trip.name,
        trip.destination,
        trip.startDate,
        trip.endDate,
        shareCode,
        userId,
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
        FROM trip_members
        WHERE trip_calendar_id = $1 AND user_id = $2
      ) AS exists
      `,
      [tripId, userId],
    );

    return rows[0]?.exists ?? false;
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

    await query(
      `
      INSERT INTO trip_members (
        trip_calendar_id,
        user_id,
        role,
        departure_location,
        departure_airport,
        joined_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (trip_calendar_id, user_id) DO UPDATE
        SET departure_location = EXCLUDED.departure_location,
            departure_airport = EXCLUDED.departure_airport
      `,
      [
        row.id,
        userId,
        row.created_by === userId ? "owner" : "member",
        options?.departureLocation ?? null,
        options?.departureAirport ?? null,
      ],
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
        DELETE FROM activity_acceptances
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

    if (setClauses.length === 0) {
      return mapTrip(existing);
    }

    const sql = `
      UPDATE trip_calendars
      SET ${setClauses.join(", ")}
      WHERE id = $${index}
      RETURNING id, name, destination, start_date, end_date, share_code, created_by, created_at
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
        creator.id AS creator_id,
        creator.email AS creator_email,
        creator.username AS creator_username,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name,
        creator.phone_number AS creator_phone_number,
        creator.password_hash AS creator_password_hash,
        creator.profile_image_url AS creator_profile_image_url,
        creator.cashapp_username AS creator_cashapp_username,
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
        creator.id AS creator_id,
        creator.email AS creator_email,
        creator.username AS creator_username,
        creator.first_name AS creator_first_name,
        creator.last_name AS creator_last_name,
        creator.phone_number AS creator_phone_number,
        creator.password_hash AS creator_password_hash,
        creator.profile_image_url AS creator_profile_image_url,
        creator.cashapp_username AS creator_cashapp_username,
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
  async createActivity(
    activity: InsertActivity,
    userId: string,
  ): Promise<Activity> {
    const costValue =
      activity.cost === undefined || activity.cost === null
        ? null
        : typeof activity.cost === "string"
          ? activity.cost.trim() === ""
            ? null
            : activity.cost
          : activity.cost;

    const maxCapacityInput = activity.maxCapacity;
    const parsedMaxCapacity =
      maxCapacityInput === undefined || maxCapacityInput === null || maxCapacityInput === ""
        ? null
        : Number(maxCapacityInput);
    const maxCapacityValue =
      parsedMaxCapacity === null || Number.isNaN(parsedMaxCapacity)
        ? null
        : parsedMaxCapacity;

    const { rows } = await query<ActivityRow>(
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
        category
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create activity");
    }

    return mapActivity(row);
  }

  async getTripActivities(
    tripId: number,
    userId: string,
  ): Promise<ActivityWithDetails[]> {
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
      ORDER BY a.start_time ASC, a.id ASC
      `,
      [tripId],
    );

    if (activityRows.length === 0) {
      return [];
    }

    const activityIds = activityRows.map((row) => row.id);

    const { rows: acceptanceRows } = await query<ActivityAcceptanceWithUserRow>(
      `
      SELECT
        aa.id,
        aa.activity_id,
        aa.user_id AS acceptance_user_id,
        aa.accepted_at,
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
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
      FROM activity_acceptances aa
      JOIN users u ON u.id = aa.user_id
      WHERE aa.activity_id = ANY($1::int[])
      ORDER BY aa.accepted_at ASC, aa.id ASC
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

    const acceptanceMap = new Map<number, (ActivityAcceptance & { user: User })[]>();
    for (const row of acceptanceRows) {
      const acceptance: ActivityAcceptance & { user: User } = {
        id: row.id,
        activityId: row.activity_id,
        userId: row.acceptance_user_id,
        acceptedAt: row.accepted_at,
        user: mapUserFromPrefix(row, "user_"),
      };
      const list = acceptanceMap.get(row.activity_id) ?? [];
      list.push(acceptance);
      acceptanceMap.set(row.activity_id, list);
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

    return activityRows.map((row) => {
      const poster = mapUserFromPrefix(row, "poster_");
      const acceptances = acceptanceMap.get(row.id) ?? [];
      const comments = commentMap.get(row.id) ?? [];
      const isAccepted = acceptances.some((acceptance) => acceptance.userId === userId) || undefined;
      const hasResponded = isAccepted;

      return mapActivityWithDetails({
        ...row,
        poster,
        acceptances,
        comments,
        isAccepted,
        hasResponded,
      });
    });
  }

  async acceptActivity(activityId: number, userId: string): Promise<void> {
    await query(
      `
      INSERT INTO activity_acceptances (activity_id, user_id, accepted_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (activity_id, user_id) DO UPDATE
        SET accepted_at = NOW()
      `,
      [activityId, userId],
    );
  }

  async declineActivity(activityId: number, userId: string): Promise<void> {
    await query(
      `
      DELETE FROM activity_acceptances
      WHERE activity_id = $1 AND user_id = $2
      `,
      [activityId, userId],
    );
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

  async getTripPackingItems(
    tripId: number,
  ): Promise<(PackingItem & { user: User })[]> {
    const { rows } = await query<PackingItemWithUserRow>(
      `
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
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
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
      WHERE pi.trip_id = $1
      ORDER BY pi.created_at ASC, pi.id ASC
      `,
      [tripId],
    );

    return rows.map((row) => ({
      ...mapPackingItem({
        id: row.id,
        trip_id: row.trip_id,
        user_id: row.item_user_id,
        item: row.item,
        category: row.category,
        item_type: row.item_type,
        is_checked: row.is_checked,
        assigned_user_id: row.assigned_user_id,
        created_at: row.created_at,
      }),
      user: mapUserFromPrefix(row, "user_"),
    }));
  }

  async togglePackingItem(itemId: number, _userId: string): Promise<void> {
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
    expense: InsertExpense & { selectedMembers?: string[] },
    userId: string,
  ): Promise<Expense> {
    await query("BEGIN");
    try {
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
          expense.paidBy ?? userId,
          expense.amount,
          expense.currency,
          expense.exchangeRate ?? null,
          expense.originalCurrency ?? null,
          expense.convertedAmounts ?? null,
          expense.description,
          expense.category,
          expense.activityId ?? null,
          expense.splitType ?? "equal",
          expense.splitData ?? null,
          expense.receiptUrl ?? null,
        ],
      );

      const row = rows[0];
      if (!row) {
        throw new Error("Failed to create expense");
      }

      const splitData = (expense.splitData ?? null) as
        | Record<string, unknown>
        | null;
      const membersFromSplitData = Array.isArray(
        (splitData as Record<string, unknown>)?.members as unknown[],
      )
        ? ((splitData as { members: string[] }).members ?? [])
        : undefined;
      const selectedMembers = Array.isArray(expense.selectedMembers)
        ? expense.selectedMembers
        : undefined;
      const participantIds = membersFromSplitData ?? selectedMembers ?? [];

      if (participantIds.length > 0) {
        const totalAmount = Number(expense.amount);
        const splitType = expense.splitType ?? "equal";
        const exactAmounts =
          (splitData?.amounts as Record<string, unknown> | undefined) ??
          undefined;
        const percentages =
          (splitData?.percentages as Record<string, unknown> | undefined) ??
          undefined;
        const splitAmountValue = splitData?.splitAmount;

        for (const participantId of participantIds) {
          let shareAmount =
            participantIds.length > 0
              ? totalAmount / participantIds.length
              : 0;

          if (splitType === "exact" && exactAmounts) {
            const value = exactAmounts[participantId];
            if (typeof value === "number") {
              shareAmount = value;
            } else if (typeof value === "string") {
              const parsed = Number(value);
              if (!Number.isNaN(parsed)) {
                shareAmount = parsed;
              }
            }
          } else if (splitType === "percentage" && percentages) {
            const value = percentages[participantId];
            let percentageAmount = 0;
            if (typeof value === "number") {
              percentageAmount = value;
            } else if (typeof value === "string") {
              const parsed = Number(value);
              if (!Number.isNaN(parsed)) {
                percentageAmount = parsed;
              }
            }
            shareAmount = totalAmount * (percentageAmount / 100);
          } else if (splitAmountValue !== undefined) {
            if (typeof splitAmountValue === "number") {
              shareAmount = splitAmountValue;
            } else if (typeof splitAmountValue === "string") {
              const parsed = Number(splitAmountValue);
              if (!Number.isNaN(parsed)) {
                shareAmount = parsed;
              }
            }
          }

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
            [row.id, participantId, shareAmount],
          );
        }
      }

      await query("COMMIT");

      return mapExpense(row);
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
  }

  async getTripExpenses(tripId: number): Promise<ExpenseWithDetails[]> {
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
      (ExpenseShare & { user: User })[]
    >();

    for (const row of shareRows) {
      const share = mapExpenseShare({
        id: row.id,
        expense_id: row.expense_id,
        user_id: row.share_participant_id,
        amount: row.amount,
        is_paid: row.is_paid,
        paid_at: row.paid_at,
        created_at: row.created_at,
      });
      const user = mapUserFromPrefix(row, "share_user_");
      const existingShares = sharesByExpenseId.get(row.expense_id) ?? [];
      existingShares.push({ ...share, user });
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
          const totalAmount =
            updates.amount !== undefined
              ? Number(updates.amount)
              : Number(updatedExpense.amount);
          const splitType = updates.splitType ?? updatedExpense.split_type;
          const exactAmounts =
            (splitData?.amounts as Record<string, unknown> | undefined) ??
            undefined;
          const percentages =
            (splitData?.percentages as Record<string, unknown> | undefined) ??
            undefined;
          const splitAmountValue = splitData?.splitAmount;

          for (const participantId of participantIds) {
            let shareAmount =
              participantIds.length > 0
                ? totalAmount / participantIds.length
                : 0;

            if (splitType === "exact" && exactAmounts) {
              const value = exactAmounts[participantId];
              if (typeof value === "number") {
                shareAmount = value;
              } else if (typeof value === "string") {
                const parsed = Number(value);
                if (!Number.isNaN(parsed)) {
                  shareAmount = parsed;
                }
              }
            } else if (splitType === "percentage" && percentages) {
              const value = percentages[participantId];
              let percentageAmount = 0;
              if (typeof value === "number") {
                percentageAmount = value;
              } else if (typeof value === "string") {
                const parsed = Number(value);
                if (!Number.isNaN(parsed)) {
                  percentageAmount = parsed;
                }
              }
              shareAmount = totalAmount * (percentageAmount / 100);
            } else if (splitAmountValue !== undefined) {
              if (typeof splitAmountValue === "number") {
                shareAmount = splitAmountValue;
              } else if (typeof splitAmountValue === "string") {
                const parsed = Number(splitAmountValue);
                if (!Number.isNaN(parsed)) {
                  shareAmount = parsed;
                }
              }
            }

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
              [expenseId, participantId, shareAmount],
            );
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
    const { rows } = await query<ExpenseShareWithUserRow>(
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
      WHERE es.expense_id = $1
      ORDER BY es.created_at ASC NULLS LAST, es.id ASC
      `,
      [expenseId],
    );

    return rows.map((row) => {
      const share = mapExpenseShare({
        id: row.id,
        expense_id: row.expense_id,
        user_id: row.share_participant_id,
        amount: row.amount,
        is_paid: row.is_paid,
        paid_at: row.paid_at,
        created_at: row.created_at,
      });

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
  ): Promise<Notification> {
    const { rows } = await query<NotificationRow>(
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
      item.estimatedCost === undefined || item.estimatedCost === null
        ? null
        : typeof item.estimatedCost === "number"
          ? item.estimatedCost.toString()
          : item.estimatedCost;

    const actualCostValue =
      item.actualCost === undefined || item.actualCost === null
        ? null
        : typeof item.actualCost === "number"
          ? item.actualCost.toString()
          : item.actualCost;

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
      const value =
        updates.estimatedCost === null
          ? null
          : typeof updates.estimatedCost === "number"
            ? updates.estimatedCost.toString()
            : updates.estimatedCost;
      addClause("estimated_cost", value);
    }
    if (updates.notes !== undefined) {
      addClause("notes", serializeGroceryNotes(updates.notes ?? null));
    }
    if (updates.isPurchased !== undefined) {
      addClause("is_purchased", updates.isPurchased);
    }
    if (updates.actualCost !== undefined) {
      const value =
        updates.actualCost === null
          ? null
          : typeof updates.actualCost === "number"
            ? updates.actualCost.toString()
            : updates.actualCost;
      addClause("actual_cost", value);
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
      actualCost === null
        ? null
        : typeof actualCost === "number"
          ? actualCost.toString()
          : actualCost;

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
    const totalAmountValue =
      receipt.totalAmount === undefined || receipt.totalAmount === null
        ? "0"
        : receipt.totalAmount.toString();

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
      const value = parseFloat(item.actualCost ?? item.estimatedCost ?? "0");
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
    const priceValue =
      flight.price === undefined || flight.price === null
        ? null
        : typeof flight.price === "number"
          ? flight.price.toString()
          : flight.price;

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
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
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
      const priceValue =
        updates.price === null
          ? null
          : typeof updates.price === "number"
            ? updates.price.toString()
            : updates.price;
      setField("price", priceValue);
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

  async deleteFlight(flightId: number, userId: string): Promise<void> {
    const { rows } = await query<{ user_id: string }>(
      `
      SELECT user_id
      FROM flights
      WHERE id = $1
      `,
      [flightId],
    );

    const existing = rows[0];
    if (!existing) {
      throw new Error("Flight not found");
    }

    if (existing.user_id !== userId) {
      throw new Error("Only the creator can delete this flight");
    }

    await query(
      `
      DELETE FROM flights
      WHERE id = $1
      `,
      [flightId],
    );
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

  async createHotel(hotel: InsertHotel, userId: string): Promise<Hotel> {
    const hotelRatingValue =
      hotel.hotelRating === undefined || hotel.hotelRating === null
        ? null
        : typeof hotel.hotelRating === "number"
          ? hotel.hotelRating
          : Number(hotel.hotelRating);
    const totalPriceValue =
      hotel.totalPrice === undefined || hotel.totalPrice === null
        ? null
        : typeof hotel.totalPrice === "number"
          ? hotel.totalPrice.toString()
          : hotel.totalPrice;
    const pricePerNightValue =
      hotel.pricePerNight === undefined || hotel.pricePerNight === null
        ? null
        : typeof hotel.pricePerNight === "number"
          ? hotel.pricePerNight.toString()
          : hotel.pricePerNight;
    const latitudeValue =
      hotel.latitude === undefined || hotel.latitude === null
        ? null
        : typeof hotel.latitude === "string"
          ? hotel.latitude
          : hotel.latitude.toString();
    const longitudeValue =
      hotel.longitude === undefined || hotel.longitude === null
        ? null
        : typeof hotel.longitude === "string"
          ? hotel.longitude
          : hotel.longitude.toString();

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
        hotel.tripId,
        userId,
        hotel.hotelName,
        hotel.hotelChain ?? null,
        hotelRatingValue,
        hotel.address,
        hotel.city,
        hotel.country,
        hotel.zipCode ?? null,
        latitudeValue,
        longitudeValue,
        hotel.checkInDate,
        hotel.checkOutDate,
        hotel.roomType ?? null,
        hotel.roomCount ?? null,
        hotel.guestCount ?? null,
        hotel.bookingReference ?? null,
        totalPriceValue,
        pricePerNightValue,
        hotel.currency,
        hotel.status,
        hotel.bookingSource ?? null,
        hotel.purchaseUrl ?? null,
        hotel.amenities ?? null,
        hotel.images ?? null,
        hotel.policies ?? null,
        hotel.contactInfo ?? null,
        hotel.bookingPlatform ?? null,
        hotel.bookingUrl ?? null,
        hotel.cancellationPolicy ?? null,
        hotel.notes ?? null,
      ],
    );

    const row = rows[0];
    if (!row) {
      throw new Error("Failed to create hotel");
    }

    return mapHotel(row);
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
        u.id AS user_id,
        u.email AS user_email,
        u.username AS user_username,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name,
        u.phone_number AS user_phone_number,
        u.password_hash AS user_password_hash,
        u.profile_image_url AS user_profile_image_url,
        u.cashapp_username AS user_cashapp_username,
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
      const ratingValue =
        updates.hotelRating === null
          ? null
          : typeof updates.hotelRating === "number"
            ? updates.hotelRating
            : Number(updates.hotelRating);
      setField("hotel_rating", ratingValue);
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
      const latitudeValue =
        updates.latitude === null
          ? null
          : typeof updates.latitude === "string"
            ? updates.latitude
            : updates.latitude.toString();
      setField("latitude", latitudeValue);
    }
    if (updates.longitude !== undefined) {
      const longitudeValue =
        updates.longitude === null
          ? null
          : typeof updates.longitude === "string"
            ? updates.longitude
            : updates.longitude.toString();
      setField("longitude", longitudeValue);
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
      const totalPriceValue =
        updates.totalPrice === null
          ? null
          : typeof updates.totalPrice === "number"
            ? updates.totalPrice.toString()
            : updates.totalPrice;
      setField("total_price", totalPriceValue);
    }
    if (updates.pricePerNight !== undefined) {
      const pricePerNightValue =
        updates.pricePerNight === null
          ? null
          : typeof updates.pricePerNight === "number"
            ? updates.pricePerNight.toString()
            : updates.pricePerNight;
      setField("price_per_night", pricePerNightValue);
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
    const latitudeValue =
      restaurant.latitude === undefined || restaurant.latitude === null
        ? null
        : typeof restaurant.latitude === "string"
          ? restaurant.latitude
          : restaurant.latitude.toString();
    const longitudeValue =
      restaurant.longitude === undefined || restaurant.longitude === null
        ? null
        : typeof restaurant.longitude === "string"
          ? restaurant.longitude
          : restaurant.longitude.toString();
    const ratingValue =
      restaurant.rating === undefined || restaurant.rating === null
        ? null
        : typeof restaurant.rating === "string"
          ? restaurant.rating
          : restaurant.rating.toString();

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

    return mapRestaurant(row);
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
      const latitudeValue =
        updates.latitude === null
          ? null
          : typeof updates.latitude === "string"
            ? updates.latitude
            : updates.latitude.toString();
      setField("latitude", latitudeValue);
    }
    if (updates.longitude !== undefined) {
      const longitudeValue =
        updates.longitude === null
          ? null
          : typeof updates.longitude === "string"
            ? updates.longitude
            : updates.longitude.toString();
      setField("longitude", longitudeValue);
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
      const ratingValue =
        updates.rating === null
          ? null
          : typeof updates.rating === "string"
            ? updates.rating
            : updates.rating.toString();
      setField("rating", ratingValue);
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
  async createHotelProposal(): Promise<HotelProposal> { throw new Error("Not implemented"); }
  async getTripHotelProposals(): Promise<HotelProposalWithDetails[]> { throw new Error("Not implemented"); }
  async rankHotelProposal(): Promise<void> { throw new Error("Not implemented"); }
  async updateProposalAverageRanking(): Promise<void> { throw new Error("Not implemented"); }
  async updateHotelProposalStatus(): Promise<HotelProposal> { throw new Error("Not implemented"); }
  async addFlight(): Promise<Flight> { throw new Error("Not implemented"); }
  async addHotel(): Promise<Hotel> { throw new Error("Not implemented"); }
  async createFlightProposal(): Promise<FlightProposal> { throw new Error("Not implemented"); }
  async getTripFlightProposals(): Promise<FlightProposalWithDetails[]> { throw new Error("Not implemented"); }
  async rankFlightProposal(): Promise<void> { throw new Error("Not implemented"); }
  async updateFlightProposalAverageRanking(): Promise<void> { throw new Error("Not implemented"); }
  async updateFlightProposalStatus(): Promise<FlightProposal> { throw new Error("Not implemented"); }
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
  async createRestaurantProposal(): Promise<RestaurantProposal> { throw new Error("Not implemented"); }
  async getTripRestaurantProposals(): Promise<RestaurantProposalWithDetails[]> { throw new Error("Not implemented"); }
  async rankRestaurantProposal(): Promise<void> { throw new Error("Not implemented"); }
  async updateRestaurantProposalAverageRanking(): Promise<void> { throw new Error("Not implemented"); }
  async updateRestaurantProposalStatus(): Promise<RestaurantProposal> { throw new Error("Not implemented"); }
}

export const storage = new DatabaseStorage();


