import { query } from "./db";
import {
  type User,
  type UpsertUser,
  type TripCalendar,
  type InsertTripCalendar,
  type Activity,
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
  async updateUserProfile(): Promise<void> { throw new Error("Not implemented"); }
  async updateOnboardingStatus(): Promise<void> { throw new Error("Not implemented"); }
  async createTrip(): Promise<TripCalendar> { throw new Error("Not implemented"); }
  async getTripByShareCode(): Promise<TripWithDetails | undefined> { throw new Error("Not implemented"); }
  async getTripById(): Promise<TripWithDetails | undefined> { throw new Error("Not implemented"); }
  async getUserTrips(): Promise<TripWithDetails[]> { throw new Error("Not implemented"); }
  async isTripMember(): Promise<boolean> { throw new Error("Not implemented"); }
  async joinTrip(): Promise<void> { throw new Error("Not implemented"); }
  async leaveTrip(): Promise<void> { throw new Error("Not implemented"); }
  async deleteTrip(): Promise<void> { throw new Error("Not implemented"); }
  async updateTrip(): Promise<TripCalendar> { throw new Error("Not implemented"); }
  async updateMemberLocation(): Promise<void> { throw new Error("Not implemented"); }
  async getMemberLocation(): Promise<{ departureLocation?: string; departureAirport?: string } | undefined> { throw new Error("Not implemented"); }
  async createActivity(): Promise<Activity> { throw new Error("Not implemented"); }
  async getTripActivities(): Promise<ActivityWithDetails[]> { throw new Error("Not implemented"); }
  async acceptActivity(): Promise<void> { throw new Error("Not implemented"); }
  async declineActivity(): Promise<void> { throw new Error("Not implemented"); }
  async addComment(): Promise<ActivityComment> { throw new Error("Not implemented"); }
  async getActivityComments(): Promise<(ActivityComment & { user: User })[]> { throw new Error("Not implemented"); }
  async addPackingItem(): Promise<PackingItem> { throw new Error("Not implemented"); }
  async getTripPackingItems(): Promise<(PackingItem & { user: User })[]> { throw new Error("Not implemented"); }
  async togglePackingItem(): Promise<void> { throw new Error("Not implemented"); }
  async deletePackingItem(): Promise<void> { throw new Error("Not implemented"); }
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


