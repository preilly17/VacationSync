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
  username: row.username,
  firstName: row.first_name,
  lastName: row.last_name,
  phoneNumber: row.phone_number,
  passwordHash: row.password_hash,
  authProvider: row.auth_provider,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
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

const mapUserFromPrefix = (
  row: Record<string, unknown>,
  prefix: "user_" | "creator_" | "poster_",
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

    for (const [key, column] of Object.entries(fieldMap)) {
      const typedKey = key as keyof typeof fieldMap;
      if (data[typedKey] !== undefined) {
        setClauses.push(`${column} = $${index}`);
        values.push(data[typedKey]);
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
  async createExpense(): Promise<Expense> { throw new Error("Not implemented"); }
  async getTripExpenses(): Promise<ExpenseWithDetails[]> { throw new Error("Not implemented"); }
  async updateExpense(): Promise<Expense> { throw new Error("Not implemented"); }
  async deleteExpense(): Promise<void> { throw new Error("Not implemented"); }
  async markExpenseAsPaid(): Promise<void> { throw new Error("Not implemented"); }
  async getExpenseShares(): Promise<(ExpenseShare & { user: User })[]> { throw new Error("Not implemented"); }
  async getUserExpenseBalances(): Promise<{ owes: number; owed: number; balance: number }> { throw new Error("Not implemented"); }
  async createNotification(): Promise<Notification> { throw new Error("Not implemented"); }
  async getUserNotifications(): Promise<(Notification & { trip?: TripCalendar; activity?: Activity; expense?: Expense })[]> { throw new Error("Not implemented"); }
  async markNotificationAsRead(): Promise<void> { throw new Error("Not implemented"); }
  async markAllNotificationsAsRead(): Promise<void> { throw new Error("Not implemented"); }
  async getUnreadNotificationCount(): Promise<number> { throw new Error("Not implemented"); }
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


