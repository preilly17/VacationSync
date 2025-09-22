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
  cash_app_username: string | null;
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
  cashAppUsername: (row[`${prefix}cash_app_username`] as string | null) ?? null,
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
      cashAppUsername: "cash_app_username",
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

    await query(
      `
      INSERT INTO trip_members (trip_calendar_id, user_id, role, joined_at)
      VALUES ($1, $2, 'organizer', NOW())
      ON CONFLICT (trip_calendar_id, user_id) DO NOTHING
      `,
      [row.id, userId],
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
        row.created_by === userId ? "organizer" : "member",
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
        creator.cash_app_username AS creator_cash_app_username,
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
        creator.cash_app_username AS creator_cash_app_username,
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
        u.cash_app_username AS user_cash_app_username,
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
        u.cash_app_username AS poster_cash_app_username,
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
        u.cash_app_username AS user_cash_app_username,
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
        u.cash_app_username AS user_cash_app_username,
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
        u.cash_app_username AS user_cash_app_username,
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
        u.cash_app_username AS user_cash_app_username,
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
        u.cash_app_username AS paid_by_cash_app_username,
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
        su.cash_app_username AS share_user_cash_app_username,
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
        su.cash_app_username AS share_user_cash_app_username,
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
  async createGroceryItem(): Promise<GroceryItem> { throw new Error("Not implemented"); }
  async getTripGroceryItems(): Promise<GroceryItemWithDetails[]> { throw new Error("Not implemented"); }
  async updateGroceryItem(): Promise<GroceryItem> { throw new Error("Not implemented"); }
  async deleteGroceryItem(): Promise<void> { throw new Error("Not implemented"); }
  async toggleGroceryItemParticipation(): Promise<void> { throw new Error("Not implemented"); }
  async markGroceryItemPurchased(): Promise<void> { throw new Error("Not implemented"); }
  async createGroceryReceipt(): Promise<GroceryReceipt> { throw new Error("Not implemented"); }
  async getTripGroceryReceipts(): Promise<GroceryReceiptWithDetails[]> { throw new Error("Not implemented"); }
  async getGroceryBill(): Promise<{ totalCost: number; costPerPerson: number; items: GroceryItemWithDetails[] }> { throw new Error("Not implemented"); }
  async createFlight(): Promise<Flight> { throw new Error("Not implemented"); }
  async getTripFlights(): Promise<FlightWithDetails[]> { throw new Error("Not implemented"); }
  async updateFlight(): Promise<Flight> { throw new Error("Not implemented"); }
  async deleteFlight(): Promise<void> { throw new Error("Not implemented"); }
  async getUserFlights(): Promise<FlightWithDetails[]> { throw new Error("Not implemented"); }
  async createHotel(): Promise<Hotel> { throw new Error("Not implemented"); }
  async getTripHotels(): Promise<HotelWithDetails[]> { throw new Error("Not implemented"); }
  async updateHotel(): Promise<Hotel> { throw new Error("Not implemented"); }
  async deleteHotel(): Promise<void> { throw new Error("Not implemented"); }
  async getUserHotels(): Promise<HotelWithDetails[]> { throw new Error("Not implemented"); }
  async createRestaurant(): Promise<Restaurant> { throw new Error("Not implemented"); }
  async getTripRestaurants(): Promise<RestaurantWithDetails[]> { throw new Error("Not implemented"); }
  async updateRestaurant(): Promise<Restaurant> { throw new Error("Not implemented"); }
  async deleteRestaurant(): Promise<void> { throw new Error("Not implemented"); }
  async getUserRestaurants(): Promise<RestaurantWithDetails[]> { throw new Error("Not implemented"); }
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
  async getTravelTips(): Promise<TravelTipWithDetails[]> { throw new Error("Not implemented"); }
  async createTravelTip(): Promise<TravelTip> { throw new Error("Not implemented"); }
  async seedTravelTips(): Promise<void> { throw new Error("Not implemented"); }
  async getUserTipPreferences(): Promise<UserTipPreferences | undefined> { throw new Error("Not implemented"); }
  async createOrUpdateUserTipPreferences(): Promise<UserTipPreferences> { throw new Error("Not implemented"); }
  async dismissTipForUser(): Promise<void> { throw new Error("Not implemented"); }
  async createRestaurantProposal(): Promise<RestaurantProposal> { throw new Error("Not implemented"); }
  async getTripRestaurantProposals(): Promise<RestaurantProposalWithDetails[]> { throw new Error("Not implemented"); }
  async rankRestaurantProposal(): Promise<void> { throw new Error("Not implemented"); }
  async updateRestaurantProposalAverageRanking(): Promise<void> { throw new Error("Not implemented"); }
  async updateRestaurantProposalStatus(): Promise<RestaurantProposal> { throw new Error("Not implemented"); }
}

export const storage = new DatabaseStorage();


