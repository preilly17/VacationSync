import {
  users,
  tripCalendars,
  tripMembers,
  activities,
  activityAcceptances,
  activityResponses,
  activityComments,

  packingItems,
  expenses,
  expenseShares,
  notifications,
  groceryItems,
  groceryItemParticipants,
  groceryReceipts,
  flights,
  hotels,
  restaurants,
  hotelProposals,
  hotelRankings,
  flightProposals,
  flightRankings,
  restaurantProposals,
  restaurantRankings,
  travelTips,
  userTipPreferences,
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
import { db } from "./db";
import { eq, and, desc, sql, asc, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";

export interface IStorage {
  // User operations (mandatory for Replit Auth and custom auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, data: { cashAppUsername?: string; venmoUsername?: string }): Promise<void>;
  
  // Trip operations
  createTrip(trip: InsertTripCalendar, creatorId: string): Promise<TripCalendar>;
  getTripByShareCode(shareCode: string): Promise<TripWithDetails | undefined>;
  getTripById(id: number): Promise<TripWithDetails | undefined>;
  getUserTrips(userId: string): Promise<TripWithDetails[]>;
  isTripMember(tripId: number, userId: string): Promise<boolean>;
  joinTrip(tripId: number, userId: string, departureLocation?: string, departureAirport?: string): Promise<void>;
  leaveTrip(tripId: number, userId: string): Promise<void>;
  deleteTrip(tripId: number, userId: string): Promise<void>;
  updateTrip(tripId: number, updates: Partial<InsertTripCalendar>, userId: string): Promise<TripCalendar>;
  updateMemberLocation(tripId: number, userId: string, departureLocation: string, departureAirport: string): Promise<void>;
  getMemberLocation(tripId: number, userId: string): Promise<{ departureLocation?: string; departureAirport?: string } | undefined>;
  
  // Activity operations
  createActivity(activity: InsertActivity, userId: string): Promise<Activity>;
  getTripActivities(tripId: number, userId?: string): Promise<ActivityWithDetails[]>;
  acceptActivity(activityId: number, userId: string): Promise<void>;
  declineActivity(activityId: number, userId: string): Promise<void>;
  
  // Comment operations
  addComment(comment: InsertActivityComment, userId: string): Promise<ActivityComment>;
  getActivityComments(activityId: number): Promise<(ActivityComment & { user: User })[]>;
  
  // Packing item operations
  addPackingItem(item: InsertPackingItem, userId: string): Promise<PackingItem>;
  getTripPackingItems(tripId: number): Promise<(PackingItem & { user: User })[]>;
  togglePackingItem(itemId: number, userId: string): Promise<void>;
  deletePackingItem(itemId: number, userId: string): Promise<void>;
  
  // Expense operations
  createExpense(expense: InsertExpense, userId: string): Promise<Expense>;
  getTripExpenses(tripId: number): Promise<ExpenseWithDetails[]>;
  updateExpense(expenseId: number, updates: Partial<InsertExpense>, userId: string): Promise<Expense>;
  deleteExpense(expenseId: number, userId: string): Promise<void>;
  
  // Expense share operations
  markExpenseAsPaid(expenseId: number, userId: string): Promise<void>;
  getExpenseShares(expenseId: number): Promise<(ExpenseShare & { user: User })[]>;
  getUserExpenseBalances(tripId: number, userId: string): Promise<{ owes: number; owed: number; balance: number }>;
  
  // Notification operations
  createNotification(notification: InsertNotification): Promise<Notification>;
  getUserNotifications(userId: string): Promise<(Notification & { trip?: TripCalendar; activity?: Activity; expense?: Expense })[]>;
  markNotificationAsRead(notificationId: number, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  
  // Grocery operations
  createGroceryItem(item: InsertGroceryItem, userId: string): Promise<GroceryItem>;
  getTripGroceryItems(tripId: number): Promise<GroceryItemWithDetails[]>;
  updateGroceryItem(itemId: number, updates: Partial<InsertGroceryItem>): Promise<GroceryItem>;
  deleteGroceryItem(itemId: number, userId: string): Promise<void>;
  toggleGroceryItemParticipation(itemId: number, userId: string): Promise<void>;
  markGroceryItemPurchased(itemId: number, actualCost?: string): Promise<void>;
  createGroceryReceipt(receipt: InsertGroceryReceipt, userId: string): Promise<GroceryReceipt>;
  getTripGroceryReceipts(tripId: number): Promise<GroceryReceiptWithDetails[]>;
  getGroceryBill(tripId: number): Promise<{ totalCost: number; costPerPerson: number; items: GroceryItemWithDetails[] }>;
  
  // Flight operations
  createFlight(flight: InsertFlight, userId: string): Promise<Flight>;
  getTripFlights(tripId: number): Promise<FlightWithDetails[]>;
  updateFlight(flightId: number, updates: Partial<InsertFlight>, userId: string): Promise<Flight>;
  deleteFlight(flightId: number, userId: string): Promise<void>;
  getUserFlights(userId: string, tripId?: number): Promise<FlightWithDetails[]>;
  
  // Hotel operations
  createHotel(hotel: InsertHotel, userId: string): Promise<Hotel>;
  getTripHotels(tripId: number): Promise<HotelWithDetails[]>;
  updateHotel(hotelId: number, updates: Partial<InsertHotel>, userId: string): Promise<Hotel>;
  deleteHotel(hotelId: number, userId: string): Promise<void>;
  getUserHotels(userId: string, tripId?: number): Promise<HotelWithDetails[]>;
  
  // Restaurant operations
  createRestaurant(restaurant: InsertRestaurant, userId: string): Promise<Restaurant>;
  getTripRestaurants(tripId: number): Promise<RestaurantWithDetails[]>;
  updateRestaurant(restaurantId: number, updates: Partial<InsertRestaurant>, userId: string): Promise<Restaurant>;
  deleteRestaurant(restaurantId: number, userId: string): Promise<void>;
  getUserRestaurants(userId: string, tripId?: number): Promise<RestaurantWithDetails[]>;

  // Hotel proposal operations for group voting
  createHotelProposal(proposal: any, userId: string): Promise<HotelProposal>;
  getTripHotelProposals(tripId: number, userId: string): Promise<HotelProposalWithDetails[]>;
  rankHotelProposal(ranking: InsertHotelRanking, userId: string): Promise<void>;
  updateProposalAverageRanking(proposalId: number): Promise<void>;
  updateHotelProposalStatus(proposalId: number, status: string): Promise<HotelProposal>;
  addFlight(flight: InsertFlight, userId: string): Promise<Flight>;
  addHotel(hotel: InsertHotel, userId: string): Promise<Hotel>;

  // Flight proposal operations for group voting
  createFlightProposal(proposal: any, userId: string): Promise<FlightProposal>;
  getTripFlightProposals(tripId: number, userId: string): Promise<FlightProposalWithDetails[]>;
  rankFlightProposal(ranking: InsertFlightRanking, userId: string): Promise<void>;
  updateFlightProposalAverageRanking(proposalId: number): Promise<void>;

  // Travel tips operations
  getTravelTips(options?: { category?: string; destination?: string; limit?: number }): Promise<TravelTipWithDetails[]>;
  createTravelTip(tip: InsertTravelTip): Promise<TravelTip>;
  seedTravelTips(tips: InsertTravelTip[]): Promise<void>;
  getUserTipPreferences(userId: string): Promise<UserTipPreferences | undefined>;
  createOrUpdateUserTipPreferences(userId: string, preferences: Partial<InsertUserTipPreferences>): Promise<UserTipPreferences>;
  dismissTipForUser(userId: string, tipId: number): Promise<void>;
  updateFlightProposalStatus(proposalId: number, status: string): Promise<FlightProposal>;

}

export class DatabaseStorage implements IStorage {
  // In-memory state for development mode packing items
  private samplePackingState: Map<number, boolean> = new Map();

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfile(id: string, data: { 
    cashAppUsername?: string; 
    venmoUsername?: string;
    defaultLocation?: string;
    defaultLocationCode?: string;
    defaultCity?: string;
    defaultCountry?: string;
  }): Promise<void> {
    const updateFields: any = {
      updatedAt: new Date(),
    };

    // Only include provided fields in the update
    if (data.cashAppUsername !== undefined) updateFields.cashAppUsername = data.cashAppUsername;
    if (data.venmoUsername !== undefined) updateFields.venmoUsername = data.venmoUsername;
    if (data.defaultLocation !== undefined) updateFields.defaultLocation = data.defaultLocation;
    if (data.defaultLocationCode !== undefined) updateFields.defaultLocationCode = data.defaultLocationCode;
    if (data.defaultCity !== undefined) updateFields.defaultCity = data.defaultCity;
    if (data.defaultCountry !== undefined) updateFields.defaultCountry = data.defaultCountry;

    await db
      .update(users)
      .set(updateFields)
      .where(eq(users.id, id));
  }

  async updateOnboardingStatus(userId: string, type: 'home' | 'trip'): Promise<void> {
    // Development mode bypass - use in-memory state when database is unavailable
    if (process.env.NODE_ENV === 'development') {
      try {
        await db
          .update(users)
          .set({
            ...(type === 'home' ? { hasSeenHomeOnboarding: true } : { hasSeenTripOnboarding: true }),
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      } catch (error) {
        console.log(`Database unavailable in development, onboarding status for ${type} updated in memory`);
        return;
      }
      return;
    }
    
    await db
      .update(users)
      .set({
        ...(type === 'home' ? { hasSeenHomeOnboarding: true } : { hasSeenTripOnboarding: true }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  // Trip operations
  async createTrip(trip: InsertTripCalendar, creatorId: string): Promise<TripCalendar> {
    const shareCode = nanoid(16);
    const [newTrip] = await db
      .insert(tripCalendars)
      .values({
        ...trip,
        shareCode,
        createdBy: creatorId,
      })
      .returning();

    // Add creator as organizer
    await db.insert(tripMembers).values({
      tripCalendarId: newTrip.id,
      userId: creatorId,
      role: "organizer",
    });

    return newTrip;
  }

  async getTripByShareCode(shareCode: string): Promise<TripWithDetails | undefined> {
    const result = await db
      .select({
        trip: tripCalendars,
        creator: users,
      })
      .from(tripCalendars)
      .innerJoin(users, eq(tripCalendars.createdBy, users.id))
      .where(eq(tripCalendars.shareCode, shareCode));

    if (!result.length) return undefined;

    const trip = result[0];
    const members = await this.getTripMembers(trip.trip.id);

    return {
      ...trip.trip,
      creator: trip.creator,
      members,
      memberCount: members.length,
    };
  }

  async getTripById(id: number): Promise<TripWithDetails | undefined> {
    const result = await db
      .select({
        trip: tripCalendars,
        creator: users,
      })
      .from(tripCalendars)
      .innerJoin(users, eq(tripCalendars.createdBy, users.id))
      .where(eq(tripCalendars.id, id));

    if (!result.length) return undefined;

    const trip = result[0];
    const members = await this.getTripMembers(id);

    return {
      ...trip.trip,
      creator: trip.creator,
      members,
      memberCount: members.length,
    };
  }

  async getUserTrips(userId: string): Promise<TripWithDetails[]> {
    // Development mode bypass - return sample data when database is unavailable
    if (process.env.NODE_ENV === 'development' && userId === 'demo-user') {
      try {
        const result = await db
          .select({
            trip: tripCalendars,
            creator: users,
          })
          .from(tripMembers)
          .innerJoin(tripCalendars, eq(tripMembers.tripCalendarId, tripCalendars.id))
          .innerJoin(users, eq(tripCalendars.createdBy, users.id))
          .where(eq(tripMembers.userId, userId))
          .orderBy(desc(tripCalendars.startDate));

        const trips = await Promise.all(
          result.map(async ({ trip, creator }) => {
            const members = await this.getTripMembers(trip.id);
            return {
              ...trip,
              creator,
              members,
              memberCount: members.length,
            };
          })
        );

        return trips;
      } catch (error) {
        console.log("Database unavailable in development, returning sample trip data");
        // Return sample trip data for development
        return [
          {
            id: 1,
            name: "Sample Trip to Japan",
            destination: "Tokyo, Japan",
            startDate: new Date("2025-03-15"),
            endDate: new Date("2025-03-25"),
            shareCode: "DEMO123",
            createdBy: "demo-user",
            createdAt: new Date("2025-01-01"),
            creator: {
              id: "demo-user",
              email: "demo@example.com",
              username: null,
              firstName: "Demo",
              lastName: "User",
              phoneNumber: null,
              passwordHash: null,
              profileImageUrl: null,
              cashAppUsername: null,
              cashAppPhone: null,
              venmoUsername: null,
              venmoPhone: null,
              timezone: "UTC",
              defaultLocation: null,
              defaultLocationCode: null,
              defaultCity: null,
              defaultCountry: null,
              authProvider: "replit",
              notificationPreferences: {"oneHour": true, "thirtyMinutes": true, "newActivities": true, "updates": true},
              hasSeenHomeOnboarding: false,
              hasSeenTripOnboarding: false,
              createdAt: new Date("2025-01-01"),
              updatedAt: new Date("2025-01-01"),
            },
            members: [
              {
                id: 1,
                userId: "demo-user",
                tripCalendarId: 1,
                role: "organizer" as const,
                joinedAt: new Date("2025-01-01"),
                departureLocation: null,
                departureAirport: null,
                user: {
                  id: "demo-user",
                  email: "demo@example.com",
                  username: null,
                  firstName: "Demo",
                  lastName: "User",
                  phoneNumber: null,
                  passwordHash: null,
                  profileImageUrl: null,
                  cashAppUsername: null,
                  cashAppPhone: null,
                  venmoUsername: null,
                  venmoPhone: null,
                  timezone: "UTC",
                  defaultLocation: null,
                  defaultLocationCode: null,
                  defaultCity: null,
                  defaultCountry: null,
                  authProvider: "replit",
                  notificationPreferences: {"oneHour": true, "thirtyMinutes": true, "newActivities": true, "updates": true},
                  hasSeenHomeOnboarding: false,
                  hasSeenTripOnboarding: false,
                  createdAt: new Date("2025-01-01"),
                  updatedAt: new Date("2025-01-01"),
                },
              },
            ],
            memberCount: 1,
          },
          {
            id: 2,
            name: "Past Trip to Paris",
            destination: "Paris, France",
            startDate: new Date("2024-06-10"),
            endDate: new Date("2024-06-20"),
            shareCode: "DEMO456",
            createdBy: "demo-user",
            createdAt: new Date("2024-05-01"),
            creator: {
              id: "demo-user",
              email: "demo@example.com",
              username: null,
              firstName: "Demo",
              lastName: "User",
              phoneNumber: null,
              passwordHash: null,
              profileImageUrl: null,
              cashAppUsername: null,
              cashAppPhone: null,
              venmoUsername: null,
              venmoPhone: null,
              timezone: "UTC",
              defaultLocation: null,
              defaultLocationCode: null,
              defaultCity: null,
              defaultCountry: null,
              authProvider: "replit",
              notificationPreferences: {"oneHour": true, "thirtyMinutes": true, "newActivities": true, "updates": true},
              hasSeenHomeOnboarding: false,
              hasSeenTripOnboarding: false,
              createdAt: new Date("2025-01-01"),
              updatedAt: new Date("2025-01-01"),
            },
            members: [
              {
                id: 2,
                userId: "demo-user",
                tripCalendarId: 2,
                role: "organizer" as const,
                joinedAt: new Date("2024-05-01"),
                departureLocation: null,
                departureAirport: null,
                user: {
                  id: "demo-user",
                  email: "demo@example.com",
                  username: null,
                  firstName: "Demo",
                  lastName: "User",
                  phoneNumber: null,
                  passwordHash: null,
                  profileImageUrl: null,
                  cashAppUsername: null,
                  cashAppPhone: null,
                  venmoUsername: null,
                  venmoPhone: null,
                  timezone: "UTC",
                  defaultLocation: null,
                  defaultLocationCode: null,
                  defaultCity: null,
                  defaultCountry: null,
                  authProvider: "replit",
                  notificationPreferences: {"oneHour": true, "thirtyMinutes": true, "newActivities": true, "updates": true},
                  hasSeenHomeOnboarding: false,
                  hasSeenTripOnboarding: false,
                  createdAt: new Date("2025-01-01"),
                  updatedAt: new Date("2025-01-01"),
                },
              },
            ],
            memberCount: 1,
          },
        ];
      }
    }

    const result = await db
      .select({
        trip: tripCalendars,
        creator: users,
      })
      .from(tripMembers)
      .innerJoin(tripCalendars, eq(tripMembers.tripCalendarId, tripCalendars.id))
      .innerJoin(users, eq(tripCalendars.createdBy, users.id))
      .where(eq(tripMembers.userId, userId))
      .orderBy(desc(tripCalendars.startDate));

    const trips = await Promise.all(
      result.map(async ({ trip, creator }) => {
        const members = await this.getTripMembers(trip.id);
        return {
          ...trip,
          creator,
          members,
          memberCount: members.length,
        };
      })
    );

    return trips;
  }

  async isTripMember(tripId: number, userId: string): Promise<boolean> {
    const result = await db
      .select({ id: tripMembers.id })
      .from(tripMembers)
      .where(
        and(
          eq(tripMembers.tripCalendarId, tripId),
          eq(tripMembers.userId, userId)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async joinTrip(tripId: number, userId: string, departureLocation?: string, departureAirport?: string): Promise<void> {
    await db.insert(tripMembers).values({
      tripCalendarId: tripId,
      userId,
      role: "member",
      departureLocation,
      departureAirport,
    });
  }

  async leaveTrip(tripId: number, userId: string): Promise<void> {
    // Check if user is the creator
    const trip = await this.getTripById(tripId);
    if (trip?.createdBy === userId) {
      throw new Error("Trip creator cannot leave the trip. Please delete the trip instead.");
    }

    // Remove user from trip members
    await db.delete(tripMembers).where(
      and(
        eq(tripMembers.tripCalendarId, tripId),
        eq(tripMembers.userId, userId)
      )
    );

    // Note: We intentionally don't delete activity acceptances or other user data
    // This preserves the shared calendar and other members' experiences
  }

  async deleteTrip(tripId: number, userId: string): Promise<void> {
    // Handle development mode
    if (process.env.NODE_ENV === 'development' && userId === 'demo-user') {
      // In development mode, allow demo user to delete the sample trip
      if (tripId === 1) {
        console.log("Development mode: demo user deleting sample trip");
        return; // Simply return success for demo data
      }
    }

    // First verify the user is the creator of the trip - use simple select
    const [trip] = await db.select().from(tripCalendars).where(eq(tripCalendars.id, tripId));
    if (!trip || trip.createdBy !== userId) {
      throw new Error("Only the trip creator can delete the trip");
    }

    // Get all activity IDs for this trip first
    const tripActivities = await db.select({ id: activities.id }).from(activities).where(eq(activities.tripCalendarId, tripId));
    const activityIds = tripActivities.map(a => a.id);
    
    // Get all expense IDs for this trip first
    const tripExpenses = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.tripId, tripId));
    const expenseIds = tripExpenses.map(e => e.id);
    
    // Get all grocery item IDs for this trip first
    const tripGroceryItems = await db.select({ id: groceryItems.id }).from(groceryItems).where(eq(groceryItems.tripId, tripId));
    const groceryItemIds = tripGroceryItems.map(g => g.id);

    // Delete all related data in the correct order to avoid foreign key constraints
    // Delete activity-related data first
    if (activityIds.length > 0) {
      await db.delete(activityComments).where(inArray(activityComments.activityId, activityIds));
      await db.delete(activityAcceptances).where(inArray(activityAcceptances.activityId, activityIds));
      await db.delete(activityResponses).where(inArray(activityResponses.activityId, activityIds));
    }
    await db.delete(activities).where(eq(activities.tripCalendarId, tripId));
    
    // Delete packing items
    await db.delete(packingItems).where(eq(packingItems.tripId, tripId));
    
    // Delete expense-related data
    if (expenseIds.length > 0) {
      await db.delete(expenseShares).where(inArray(expenseShares.expenseId, expenseIds));
    }
    await db.delete(expenses).where(eq(expenses.tripId, tripId));
    
    // Delete notifications
    await db.delete(notifications).where(eq(notifications.tripId, tripId));
    
    // Delete grocery-related data
    if (groceryItemIds.length > 0) {
      await db.delete(groceryItemParticipants).where(inArray(groceryItemParticipants.groceryItemId, groceryItemIds));
    }
    await db.delete(groceryItems).where(eq(groceryItems.tripId, tripId));
    await db.delete(groceryReceipts).where(eq(groceryReceipts.tripId, tripId));
    
    // Delete travel-related data
    await db.delete(flights).where(eq(flights.tripId, tripId));
    await db.delete(hotels).where(eq(hotels.tripId, tripId));
    await db.delete(restaurants).where(eq(restaurants.tripId, tripId));
    
    // Delete trip members
    await db.delete(tripMembers).where(eq(tripMembers.tripCalendarId, tripId));
    
    // Finally, delete the trip itself
    await db.delete(tripCalendars).where(eq(tripCalendars.id, tripId));
  }

  async updateTrip(tripId: number, updates: Partial<InsertTripCalendar>, userId: string): Promise<TripCalendar> {
    // Handle development mode
    if (process.env.NODE_ENV === 'development' && userId === 'demo-user') {
      console.log("Development mode: demo user updating trip");
      // In development mode, allow demo user to update
    } else {
      // First verify the user is the creator of the trip
      const [trip] = await db.select().from(tripCalendars).where(eq(tripCalendars.id, tripId));
      if (!trip || trip.createdBy !== userId) {
        throw new Error("Only the trip creator can edit the trip");
      }
    }

    const updateFields: any = {
      updatedAt: new Date(),
    };

    // Only include provided fields in the update
    if (updates.name !== undefined) updateFields.name = updates.name;
    if (updates.destination !== undefined) updateFields.destination = updates.destination;
    if (updates.startDate !== undefined) updateFields.startDate = updates.startDate;
    if (updates.endDate !== undefined) updateFields.endDate = updates.endDate;

    const [updatedTrip] = await db
      .update(tripCalendars)
      .set(updateFields)
      .where(eq(tripCalendars.id, tripId))
      .returning();

    return updatedTrip;
  }

  private async getTripMembers(tripId: number) {
    return await db
      .select({
        id: tripMembers.id,
        tripCalendarId: tripMembers.tripCalendarId,
        userId: tripMembers.userId,
        role: tripMembers.role,
        departureLocation: tripMembers.departureLocation,
        departureAirport: tripMembers.departureAirport,
        joinedAt: tripMembers.joinedAt,
        user: users,
      })
      .from(tripMembers)
      .innerJoin(users, eq(tripMembers.userId, users.id))
      .where(eq(tripMembers.tripCalendarId, tripId));
  }

  // Activity operations
  async createActivity(activity: InsertActivity, userId: string): Promise<Activity> {
    const [newActivity] = await db
      .insert(activities)
      .values({
        ...activity,
        postedBy: userId,
      })
      .returning();

    return newActivity;
  }

  async getTripActivities(tripId: number, userId?: string): Promise<ActivityWithDetails[]> {
    const result = await db
      .select({
        activity: activities,
        poster: users,
      })
      .from(activities)
      .innerJoin(users, eq(activities.postedBy, users.id))
      .where(eq(activities.tripCalendarId, tripId))
      .orderBy(activities.startTime);

    const activitiesWithDetails = await Promise.all(
      result.map(async ({ activity, poster }) => {
        const acceptances = await db
          .select({
            id: activityAcceptances.id,
            activityId: activityAcceptances.activityId,
            userId: activityAcceptances.userId,
            acceptedAt: activityAcceptances.acceptedAt,
            user: users,
          })
          .from(activityAcceptances)
          .innerJoin(users, eq(activityAcceptances.userId, users.id))
          .where(eq(activityAcceptances.activityId, activity.id));

        const comments = await this.getActivityComments(activity.id);

        let isAccepted = false;
        let hasResponded = false;
        
        if (userId) {
          // Check if user has responded to this activity
          const userResponse = await db
            .select()
            .from(activityResponses)
            .where(
              and(
                eq(activityResponses.activityId, activity.id),
                eq(activityResponses.userId, userId)
              )
            )
            .limit(1);

          if (userResponse.length > 0) {
            hasResponded = true;
            isAccepted = userResponse[0].response === 'accepted';
          }
        }

        return {
          ...activity,
          poster,
          acceptances,
          comments,
          acceptedCount: acceptances.length,
          isAccepted,
          hasResponded,
        };
      })
    );

    return activitiesWithDetails;
  }

  async acceptActivity(activityId: number, userId: string): Promise<void> {
    // Insert into acceptances table
    await db
      .insert(activityAcceptances)
      .values({
        activityId,
        userId,
      })
      .onConflictDoNothing();

    // Insert or update response
    await db
      .insert(activityResponses)
      .values({
        activityId,
        userId,
        response: 'accepted',
      })
      .onConflictDoUpdate({
        target: [activityResponses.activityId, activityResponses.userId],
        set: {
          response: 'accepted',
          respondedAt: new Date(),
        },
      });
  }

  async declineActivity(activityId: number, userId: string): Promise<void> {
    // Remove from acceptances table
    await db
      .delete(activityAcceptances)
      .where(
        and(
          eq(activityAcceptances.activityId, activityId),
          eq(activityAcceptances.userId, userId)
        )
      );

    // Insert or update response
    await db
      .insert(activityResponses)
      .values({
        activityId,
        userId,
        response: 'declined',
      })
      .onConflictDoUpdate({
        target: [activityResponses.activityId, activityResponses.userId],
        set: {
          response: 'declined',
          respondedAt: new Date(),
        },
      });
  }

  // Comment operations
  async addComment(comment: InsertActivityComment, userId: string): Promise<ActivityComment> {
    const [newComment] = await db
      .insert(activityComments)
      .values({
        ...comment,
        userId,
      })
      .returning();

    return newComment;
  }

  async getActivityComments(activityId: number): Promise<(ActivityComment & { user: User })[]> {
    return await db
      .select({
        id: activityComments.id,
        activityId: activityComments.activityId,
        userId: activityComments.userId,
        comment: activityComments.comment,
        createdAt: activityComments.createdAt,
        user: users,
      })
      .from(activityComments)
      .innerJoin(users, eq(activityComments.userId, users.id))
      .where(eq(activityComments.activityId, activityId))
      .orderBy(activityComments.createdAt);
  }

  // Packing item operations
  async addPackingItem(item: InsertPackingItem, userId: string): Promise<PackingItem> {
    const [newItem] = await db
      .insert(packingItems)
      .values({
        ...item,
        userId,
        itemType: item.itemType || 'personal',
      })
      .returning();

    return newItem;
  }

  async getTripPackingItems(tripId: number): Promise<(PackingItem & { user: User })[]> {
    // Development mode bypass - return sample packing data when database is unavailable
    if (process.env.NODE_ENV === 'development') {
      try {
        const result = await db
          .select({
            id: packingItems.id,
            tripId: packingItems.tripId,
            userId: packingItems.userId,
            item: packingItems.item,
            category: packingItems.category,
            itemType: packingItems.itemType,
            isChecked: packingItems.isChecked,
            assignedUserId: packingItems.assignedUserId,
            createdAt: packingItems.createdAt,
            user: users,
          })
          .from(packingItems)
          .innerJoin(users, eq(packingItems.userId, users.id))
          .where(eq(packingItems.tripId, tripId))
          .orderBy(packingItems.createdAt);
        return result;
      } catch (error) {
        console.log("Database unavailable in development, returning sample packing data");
        // Return sample packing data for development
        return [
          {
            id: 13,
            tripId: tripId,
            userId: "demo-user",
            item: "Three Piece Suit",
            category: "general",
            itemType: "group" as const,
            isChecked: this.samplePackingState.get(13) || false,
            assignedUserId: null,
            createdAt: new Date("2025-01-01"),
            user: {
              id: "demo-user",
              email: "demo@example.com",
              username: null,
              firstName: "Demo",
              lastName: "User",
              phoneNumber: null,
              passwordHash: null,
              profileImageUrl: null,
              cashAppUsername: null,
              cashAppPhone: null,
              venmoUsername: null,
              venmoPhone: null,
              timezone: "UTC",
              defaultLocation: null,
              defaultLocationCode: null,
              defaultCity: null,
              defaultCountry: null,
              authProvider: "replit",
              notificationPreferences: {"oneHour": true, "thirtyMinutes": true, "newActivities": true, "updates": true},
              hasSeenHomeOnboarding: false,
              hasSeenTripOnboarding: false,
              createdAt: new Date("2025-01-01"),
              updatedAt: new Date("2025-01-01"),
            },
          },
          {
            id: 14,
            tripId: tripId,
            userId: "demo-user",
            item: "Booze",
            category: "food-snacks",
            itemType: "group" as const,
            isChecked: this.samplePackingState.get(14) || false,
            assignedUserId: null,
            createdAt: new Date("2025-01-01"),
            user: {
              id: "demo-user",
              email: "demo@example.com",
              username: null,
              firstName: "Demo",
              lastName: "User",
              phoneNumber: null,
              passwordHash: null,
              profileImageUrl: null,
              cashAppUsername: null,
              cashAppPhone: null,
              venmoUsername: null,
              venmoPhone: null,
              timezone: "UTC",
              defaultLocation: null,
              defaultLocationCode: null,
              defaultCity: null,
              defaultCountry: null,
              authProvider: "replit",
              notificationPreferences: {"oneHour": true, "thirtyMinutes": true, "newActivities": true, "updates": true},
              hasSeenHomeOnboarding: false,
              hasSeenTripOnboarding: false,
              createdAt: new Date("2025-01-01"),
              updatedAt: new Date("2025-01-01"),
            },
          },
        ];
      }
    }
    
    return await db
      .select({
        id: packingItems.id,
        tripId: packingItems.tripId,
        userId: packingItems.userId,
        item: packingItems.item,
        category: packingItems.category,
        itemType: packingItems.itemType,
        isChecked: packingItems.isChecked,
        assignedUserId: packingItems.assignedUserId,
        createdAt: packingItems.createdAt,
        user: users,
      })
      .from(packingItems)
      .innerJoin(users, eq(packingItems.userId, users.id))
      .where(eq(packingItems.tripId, tripId))
      .orderBy(packingItems.createdAt);
  }

  async addFlight(flight: InsertFlight, userId: string): Promise<Flight> {
    const [newFlight] = await db
      .insert(flights)
      .values({
        ...flight,
        userId,
      })
      .returning();
    return newFlight;
  }

  async addHotel(hotel: InsertHotel, userId: string): Promise<Hotel> {
    const [newHotel] = await db
      .insert(hotels)
      .values({
        ...hotel,
        userId,
      })
      .returning();
    return newHotel;
  }

  async rankHotelProposal(ranking: InsertHotelRanking, userId: string): Promise<void> {
    await db
      .insert(hotelRankings)
      .values({
        ...ranking,
        userId: userId,
      })
      .onConflictDoUpdate({
        target: [hotelRankings.proposalId, hotelRankings.userId],
        set: {
          ranking: ranking.ranking,
          updatedAt: new Date(),
        },
      });
  }

  async togglePackingItem(itemId: number, userId: string): Promise<void> {
    // Development mode bypass - use in-memory state when database is unavailable
    if (process.env.NODE_ENV === 'development') {
      try {
        await db
          .update(packingItems)
          .set({
            isChecked: sql`NOT ${packingItems.isChecked}`,
          })
          .where(eq(packingItems.id, itemId));
      } catch (error) {
        console.log("Database unavailable in development, using in-memory toggle");
        // Toggle the in-memory state for sample data
        const currentState = this.samplePackingState.get(itemId) || false;
        this.samplePackingState.set(itemId, !currentState);
        return;
      }
      return;
    }
    
    await db
      .update(packingItems)
      .set({
        isChecked: sql`NOT ${packingItems.isChecked}`,
      })
      .where(eq(packingItems.id, itemId));
  }

  async deletePackingItem(itemId: number, userId: string): Promise<void> {
    await db
      .delete(packingItems)
      .where(
        and(
          eq(packingItems.id, itemId),
          eq(packingItems.userId, userId)
        )
      );
  }

  // Expense operations
  async createExpense(expense: InsertExpense, userId: string): Promise<Expense> {
    const [newExpense] = await db
      .insert(expenses)
      .values({
        ...expense,
        paidBy: userId,
      })
      .returning();

    // Calculate splits based on selected members from splitData
    let participants: string[] = [];
    let splitAmount: number = 0;

    if (expense.splitData && typeof expense.splitData === 'object') {
      const splitData = expense.splitData as any;
      if (splitData.members && Array.isArray(splitData.members)) {
        participants = splitData.members;
        splitAmount = parseFloat(expense.amount.toString()) / participants.length;
      }
    }

    // Fallback to all trip members if no specific members selected
    if (participants.length === 0) {
      const trip = await this.getTripById(expense.tripId);
      if (!trip) throw new Error("Trip not found");
      participants = trip.members.map(member => member.userId);
      splitAmount = parseFloat(expense.amount.toString()) / participants.length;
    }

    // Create expense shares for each participant
    const shares = participants.map(participantId => ({
      expenseId: newExpense.id,
      userId: participantId,
      amount: splitAmount.toString(),
    }));

    await db.insert(expenseShares).values(shares);

    return newExpense;
  }

  async getTripExpenses(tripId: number): Promise<ExpenseWithDetails[]> {
    const result = await db
      .select({
        expense: expenses,
        paidBy: users,
        activity: activities,
      })
      .from(expenses)
      .leftJoin(users, eq(expenses.paidBy, users.id))
      .leftJoin(activities, eq(expenses.activityId, activities.id))
      .where(eq(expenses.tripId, tripId))
      .orderBy(desc(expenses.createdAt));

    const expensesWithShares = await Promise.all(
      result.map(async (row) => {
        const shares = await db
          .select({
            expenseShare: expenseShares,
            user: users,
          })
          .from(expenseShares)
          .leftJoin(users, eq(expenseShares.userId, users.id))
          .where(eq(expenseShares.expenseId, row.expense.id));

        const expenseWithDetails = {
          ...row.expense,
          paidBy: row.paidBy!,
          activity: row.activity || null,
          shares: shares.map(s => ({ ...s.expenseShare, user: s.user! })),
          totalAmount: parseFloat(row.expense.amount.toString()),
        };
        return expenseWithDetails as any;
      })
    );

    return expensesWithShares;
  }

  async updateExpense(expenseId: number, updates: Partial<InsertExpense>, userId: string): Promise<Expense> {
    const [expense] = await db
      .update(expenses)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(expenses.id, expenseId), eq(expenses.paidBy, userId)))
      .returning();

    return expense;
  }

  async deleteExpense(expenseId: number, userId: string): Promise<void> {
    await db.delete(expenses).where(
      and(
        eq(expenses.id, expenseId),
        eq(expenses.paidBy, userId)
      )
    );
  }

  async markExpenseAsPaid(expenseId: number, userId: string): Promise<void> {
    await db
      .update(expenseShares)
      .set({
        isPaid: true,
        paidAt: new Date(),
      })
      .where(and(eq(expenseShares.expenseId, expenseId), eq(expenseShares.userId, userId)));
  }

  async getExpenseShares(expenseId: number): Promise<(ExpenseShare & { user: User })[]> {
    const result = await db
      .select({
        expenseShare: expenseShares,
        user: users,
      })
      .from(expenseShares)
      .leftJoin(users, eq(expenseShares.userId, users.id))
      .where(eq(expenseShares.expenseId, expenseId));

    return result.map(row => ({ ...row.expenseShare, user: row.user! }));
  }

  async getUserExpenseBalances(tripId: number, userId: string): Promise<{ owes: number; owed: number; balance: number }> {
    // Calculate how much this user owes
    const owesResult = await db
      .select({
        totalOwed: sql<number>`SUM(${expenseShares.amount})`.mapWith(Number),
      })
      .from(expenseShares)
      .leftJoin(expenses, eq(expenseShares.expenseId, expenses.id))
      .where(
        and(
          eq(expenses.tripId, tripId),
          eq(expenseShares.userId, userId),
          eq(expenseShares.isPaid, false)
        )
      );

    // Calculate how much this user is owed
    const owedResult = await db
      .select({
        totalOwed: sql<number>`SUM(${expenseShares.amount})`.mapWith(Number),
      })
      .from(expenseShares)
      .leftJoin(expenses, eq(expenseShares.expenseId, expenses.id))
      .where(
        and(
          eq(expenses.tripId, tripId),
          eq(expenses.paidBy, userId),
          eq(expenseShares.isPaid, false)
        )
      );

    const owes = owesResult[0]?.totalOwed || 0;
    const owed = owedResult[0]?.totalOwed || 0;
    const balance = owed - owes;

    return { owes, owed, balance };
  }

  // Notification operations
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return created;
  }

  async getUserNotifications(userId: string): Promise<(Notification & { trip?: TripCalendar; activity?: Activity; expense?: Expense })[]> {
    const result = await db
      .select()
      .from(notifications)
      .leftJoin(tripCalendars, eq(notifications.tripId, tripCalendars.id))
      .leftJoin(activities, eq(notifications.activityId, activities.id))
      .leftJoin(expenses, eq(notifications.expenseId, expenses.id))
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));

    return result.map(row => ({
      ...row.notifications,
      trip: row.trip_calendars || undefined,
      activity: row.activities || undefined,
      expense: row.expenses || undefined,
    }));
  }

  async markNotificationAsRead(notificationId: number, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      ));
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
    
    return result[0]?.count || 0;
  }

  // Grocery operations
  async createGroceryItem(item: InsertGroceryItem, userId: string): Promise<GroceryItem> {
    const [created] = await db
      .insert(groceryItems)
      .values({
        ...item,
        addedBy: userId,
      })
      .returning();
    return created;
  }

  async getTripGroceryItems(tripId: number): Promise<GroceryItemWithDetails[]> {
    const result = await db
      .select({
        groceryItem: groceryItems,
        user: users,
      })
      .from(groceryItems)
      .leftJoin(users, eq(groceryItems.addedBy, users.id))
      .where(eq(groceryItems.tripId, tripId))
      .orderBy(asc(groceryItems.category), asc(groceryItems.item));

    const items = result.map(row => ({
      ...row.groceryItem,
      addedBy: row.user!,
    }));

    // Get participants for each item
    const itemsWithParticipants = await Promise.all(
      items.map(async (item) => {
        const participantResult = await db
          .select({
            participant: groceryItemParticipants,
            user: users,
          })
          .from(groceryItemParticipants)
          .leftJoin(users, eq(groceryItemParticipants.userId, users.id))
          .where(eq(groceryItemParticipants.groceryItemId, item.id));

        const participants = participantResult.map(row => ({
          ...row.participant,
          user: row.user!,
        }));

        const participantCount = participants.length;
        const estimatedCost = parseFloat(item.estimatedCost || "0");
        const actualCost = parseFloat(item.actualCost || "0");
        const cost = actualCost > 0 ? actualCost : estimatedCost;
        const costPerPerson = participantCount > 0 ? cost / participantCount : 0;

        const itemWithDetails = {
          ...item,
          participants,
          participantCount,
          costPerPerson,
        };
        return itemWithDetails as any;
      })
    );

    return itemsWithParticipants;
  }

  async updateGroceryItem(itemId: number, updates: Partial<InsertGroceryItem>): Promise<GroceryItem> {
    const [updated] = await db
      .update(groceryItems)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(groceryItems.id, itemId))
      .returning();
    return updated;
  }

  async deleteGroceryItem(itemId: number, userId: string): Promise<void> {
    await db.delete(groceryItems).where(
      and(
        eq(groceryItems.id, itemId),
        eq(groceryItems.addedBy, userId)
      )
    );
  }

  async toggleGroceryItemParticipation(itemId: number, userId: string): Promise<void> {
    const existing = await db
      .select()
      .from(groceryItemParticipants)
      .where(
        and(
          eq(groceryItemParticipants.groceryItemId, itemId),
          eq(groceryItemParticipants.userId, userId)
        )
      );

    if (existing.length > 0) {
      // Remove participation
      await db.delete(groceryItemParticipants).where(
        and(
          eq(groceryItemParticipants.groceryItemId, itemId),
          eq(groceryItemParticipants.userId, userId)
        )
      );
    } else {
      // Add participation
      await db.insert(groceryItemParticipants).values({
        groceryItemId: itemId,
        userId,
      });
    }
  }

  async markGroceryItemPurchased(itemId: number, actualCost?: string): Promise<void> {
    const updates: any = {
      isPurchased: true,
    };

    if (actualCost) {
      updates.actualCost = actualCost;
    }

    await db
      .update(groceryItems)
      .set(updates)
      .where(eq(groceryItems.id, itemId));
  }

  async createGroceryReceipt(receipt: InsertGroceryReceipt, userId: string): Promise<GroceryReceipt> {
    const [created] = await db
      .insert(groceryReceipts)
      .values({
        ...receipt,
        uploadedBy: userId,
      })
      .returning();
    return created;
  }

  async getTripGroceryReceipts(tripId: number): Promise<GroceryReceiptWithDetails[]> {
    const result = await db
      .select({
        receipt: groceryReceipts,
        user: users,
      })
      .from(groceryReceipts)
      .leftJoin(users, eq(groceryReceipts.uploadedBy, users.id))
      .where(eq(groceryReceipts.tripId, tripId))
      .orderBy(desc(groceryReceipts.createdAt));

    const receiptsWithDetails = await Promise.all(
      result.map(async (row) => {
        const items = await this.getTripGroceryItems(tripId);
        const receiptWithDetails = {
          ...row.receipt,
          uploadedBy: row.user!,
          items,
        };
        return receiptWithDetails as any;
      })
    );

    return receiptsWithDetails;
  }

  async getGroceryBill(tripId: number): Promise<{ totalCost: number; costPerPerson: number; items: GroceryItemWithDetails[] }> {
    const items = await this.getTripGroceryItems(tripId);
    const totalCost = items.reduce((sum, item) => {
      const cost = parseFloat(item.actualCost || item.estimatedCost || "0");
      return sum + cost;
    }, 0);

    // Get unique participants across all items
    const allParticipants = new Set<string>();
    items.forEach(item => {
      item.participants.forEach(participant => {
        allParticipants.add(participant.userId);
      });
    });

    const costPerPerson = allParticipants.size > 0 ? totalCost / allParticipants.size : 0;

    return {
      totalCost,
      costPerPerson,
      items,
    };
  }

  // Flight operations
  async createFlight(flight: InsertFlight, userId: string): Promise<Flight> {
    const [newFlight] = await db
      .insert(flights)
      .values({
        ...flight,
        userId,
      })
      .returning();
    return newFlight;
  }

  async getTripFlights(tripId: number): Promise<FlightWithDetails[]> {
    const tripFlights = await db
      .select({
        flight: flights,
        user: users,
      })
      .from(flights)
      .leftJoin(users, eq(flights.userId, users.id))
      .where(eq(flights.tripId, tripId))
      .orderBy(flights.departureTime);

    return tripFlights.map((row) => ({
      ...row.flight,
      user: row.user!,
      trip: { id: tripId, name: "", destination: "", startDate: new Date(), endDate: new Date(), shareCode: "", createdBy: "", createdAt: new Date() },
    } as any));
  }

  async updateFlight(flightId: number, updates: Partial<InsertFlight>, userId: string): Promise<Flight> {
    const [flight] = await db
      .update(flights)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(flights.id, flightId), eq(flights.userId, userId)))
      .returning();
    
    if (!flight) {
      throw new Error("Flight not found or not authorized");
    }
    
    return flight;
  }

  async deleteFlight(flightId: number, userId: string): Promise<void> {
    const result = await db
      .delete(flights)
      .where(and(eq(flights.id, flightId), eq(flights.userId, userId)))
      .returning({ id: flights.id });
    
    if (result.length === 0) {
      throw new Error("Flight not found or not authorized");
    }
  }

  async getUserFlights(userId: string, tripId?: number): Promise<FlightWithDetails[]> {
    let query = db
      .select({
        flight: flights,
        user: users,
        trip: tripCalendars,
      })
      .from(flights)
      .leftJoin(users, eq(flights.userId, users.id))
      .leftJoin(tripCalendars, eq(flights.tripId, tripCalendars.id))
      .where(eq(flights.userId, userId));

    let finalQuery = query;
    if (tripId) {
      finalQuery = db
        .select({
          flight: flights,
          user: users,
          trip: tripCalendars,
        })
        .from(flights)
        .leftJoin(users, eq(flights.userId, users.id))
        .leftJoin(tripCalendars, eq(flights.tripId, tripCalendars.id))
        .where(and(eq(flights.userId, userId), eq(flights.tripId, tripId)));
    }

    const userFlights = await finalQuery.orderBy(flights.departureTime);

    return userFlights.map((row) => ({
      ...row.flight,
      user: row.user!,
      trip: row.trip!,
    }));
  }

  async updateMemberLocation(tripId: number, userId: string, departureLocation: string, departureAirport: string): Promise<void> {
    await db
      .update(tripMembers)
      .set({
        departureLocation,
        departureAirport,
      })
      .where(and(eq(tripMembers.tripCalendarId, tripId), eq(tripMembers.userId, userId)));
  }

  async getMemberLocation(tripId: number, userId: string): Promise<{ departureLocation?: string; departureAirport?: string } | undefined> {
    const [member] = await db
      .select({
        departureLocation: tripMembers.departureLocation,
        departureAirport: tripMembers.departureAirport,
      })
      .from(tripMembers)
      .where(and(eq(tripMembers.tripCalendarId, tripId), eq(tripMembers.userId, userId)));
    
    return member ? {
      departureLocation: member.departureLocation || undefined,
      departureAirport: member.departureAirport || undefined,
    } : undefined;
  }

  async createHotel(hotel: InsertHotel, userId: string): Promise<Hotel> {
    const [newHotel] = await db
      .insert(hotels)
      .values({
        ...hotel,
        userId,
      })
      .returning();
    return newHotel;
  }

  async getTripHotels(tripId: number): Promise<HotelWithDetails[]> {
    const result = await db
      .select()
      .from(hotels)
      .leftJoin(users, eq(hotels.userId, users.id))
      .leftJoin(tripCalendars, eq(hotels.tripId, tripCalendars.id))
      .where(eq(hotels.tripId, tripId))
      .orderBy(desc(hotels.createdAt));

    return result.map(row => ({
      ...row.hotels,
      user: row.users!,
      trip: row.trip_calendars!,
    }));
  }

  async updateHotel(hotelId: number, updates: Partial<InsertHotel>, userId: string): Promise<Hotel> {
    const [updatedHotel] = await db
      .update(hotels)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(hotels.id, hotelId), eq(hotels.userId, userId)))
      .returning();
    
    if (!updatedHotel) {
      throw new Error('Hotel not found or unauthorized');
    }
    
    return updatedHotel;
  }

  async deleteHotel(hotelId: number, userId: string): Promise<void> {
    const result = await db
      .delete(hotels)
      .where(and(eq(hotels.id, hotelId), eq(hotels.userId, userId)))
      .returning();
    
    if (result.length === 0) {
      throw new Error('Hotel not found or unauthorized');
    }
  }

  async getUserHotels(userId: string, tripId?: number): Promise<HotelWithDetails[]> {
    const conditions = [eq(hotels.userId, userId)];
    if (tripId) {
      conditions.push(eq(hotels.tripId, tripId));
    }

    const result = await db
      .select()
      .from(hotels)
      .leftJoin(users, eq(hotels.userId, users.id))
      .leftJoin(tripCalendars, eq(hotels.tripId, tripCalendars.id))
      .where(and(...conditions))
      .orderBy(desc(hotels.createdAt));

    return result.map(row => ({
      ...row.hotels,
      user: row.users!,
      trip: row.trip_calendars!,
    }));
  }

  // Restaurant operations
  async createRestaurant(restaurant: InsertRestaurant, userId: string): Promise<Restaurant> {
    const [newRestaurant] = await db
      .insert(restaurants)
      .values({
        ...restaurant,
        userId,
      })
      .returning();
    return newRestaurant;
  }

  async getTripRestaurants(tripId: number): Promise<RestaurantWithDetails[]> {
    const result = await db
      .select()
      .from(restaurants)
      .leftJoin(users, eq(restaurants.userId, users.id))
      .leftJoin(tripCalendars, eq(restaurants.tripId, tripCalendars.id))
      .where(eq(restaurants.tripId, tripId))
      .orderBy(desc(restaurants.createdAt));

    return result.map(row => ({
      ...row.restaurants,
      user: row.users!,
      trip: row.trip_calendars!,
    }));
  }

  async updateRestaurant(restaurantId: number, updates: Partial<InsertRestaurant>, userId: string): Promise<Restaurant> {
    const [updatedRestaurant] = await db
      .update(restaurants)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(eq(restaurants.id, restaurantId), eq(restaurants.userId, userId)))
      .returning();
    
    if (!updatedRestaurant) {
      throw new Error('Restaurant not found or unauthorized');
    }
    
    return updatedRestaurant;
  }

  async deleteRestaurant(restaurantId: number, userId: string): Promise<void> {
    const result = await db
      .delete(restaurants)
      .where(and(eq(restaurants.id, restaurantId), eq(restaurants.userId, userId)))
      .returning();
    
    if (result.length === 0) {
      throw new Error('Restaurant not found or unauthorized');
    }
  }

  async getUserRestaurants(userId: string, tripId?: number): Promise<RestaurantWithDetails[]> {
    const conditions = [eq(restaurants.userId, userId)];
    if (tripId) {
      conditions.push(eq(restaurants.tripId, tripId));
    }

    const result = await db
      .select()
      .from(restaurants)
      .leftJoin(users, eq(restaurants.userId, users.id))
      .leftJoin(tripCalendars, eq(restaurants.tripId, tripCalendars.id))
      .where(and(...conditions))
      .orderBy(desc(restaurants.createdAt));

    return result.map(row => ({
      ...row.restaurants,
      user: row.users!,
      trip: row.trip_calendars!,
    }));
  }

  // Hotel proposal operations for group voting system
  async createHotelProposal(proposal: any, userId: string): Promise<HotelProposal> {
    const proposalData = {
      ...proposal,
      proposedBy: userId,
      rating: typeof proposal.rating === 'number' ? proposal.rating.toString() : (proposal.rating || '4.0')
    };
    const [newProposal] = await db
      .insert(hotelProposals)
      .values(proposalData)
      .returning();
    return newProposal;
  }

  async getTripHotelProposals(tripId: number, userId: string): Promise<HotelProposalWithDetails[]> {
    const result = await db
      .select()
      .from(hotelProposals)
      .leftJoin(users, eq(hotelProposals.proposedBy, users.id))
      .where(eq(hotelProposals.tripId, tripId))
      .orderBy(asc(hotelProposals.averageRanking), desc(hotelProposals.createdAt));

    // Get rankings for each proposal
    const proposalIds = result.map(row => row.hotel_proposals.id);
    const rankings = await db
      .select()
      .from(hotelRankings)
      .leftJoin(users, eq(hotelRankings.userId, users.id))
      .where(inArray(hotelRankings.proposalId, proposalIds))
      .orderBy(asc(hotelRankings.ranking));

    // Group rankings by proposal ID
    const rankingsByProposal = rankings.reduce((acc, row) => {
      const proposalId = row.hotel_rankings.proposalId;
      if (!acc[proposalId]) acc[proposalId] = [];
      acc[proposalId].push({
        ...row.hotel_rankings,
        user: row.users!
      });
      return acc;
    }, {} as Record<number, (HotelRanking & { user: User })[]>);

    return result.map(row => ({
      ...row.hotel_proposals,
      proposer: row.users!,
      rankings: rankingsByProposal[row.hotel_proposals.id] || [],
      currentUserRanking: rankingsByProposal[row.hotel_proposals.id]?.find(r => r.userId === userId)
    }));
  }

  async createOrUpdateHotelRanking(ranking: InsertHotelRanking & { userId: string }): Promise<HotelRanking> {
    const [newRanking] = await db
      .insert(hotelRankings)
      .values(ranking)
      .onConflictDoUpdate({
        target: [hotelRankings.proposalId, hotelRankings.userId],
        set: {
          ranking: ranking.ranking,
          notes: ranking.notes,
          updatedAt: new Date()
        }
      })
      .returning();
    return newRanking;
  }

  async updateProposalAverageRanking(proposalId: number): Promise<void> {
    const result = await db
      .select({
        avgRanking: sql<number>`ROUND(AVG(${hotelRankings.ranking}), 2)`
      })
      .from(hotelRankings)
      .where(eq(hotelRankings.proposalId, proposalId));

    const avgRanking = result[0]?.avgRanking || null;

    await db
      .update(hotelProposals)
      .set({ averageRanking: avgRanking?.toString() || null })
      .where(eq(hotelProposals.id, proposalId));
  }

  async updateHotelProposalStatus(proposalId: number, status: string): Promise<HotelProposal> {
    const [updatedProposal] = await db
      .update(hotelProposals)
      .set({ status })
      .where(eq(hotelProposals.id, proposalId))
      .returning();

    if (!updatedProposal) {
      throw new Error('Hotel proposal not found');
    }

    return updatedProposal;
  }

  // Flight proposal operations for group voting system
  async createFlightProposal(proposal: any, userId: string): Promise<FlightProposal> {
    const proposalData = {
      ...proposal,
      proposedBy: userId,
    };
    const [newProposal] = await db
      .insert(flightProposals)
      .values(proposalData)
      .returning();
    return newProposal;
  }

  async getTripFlightProposals(tripId: number, userId: string): Promise<FlightProposalWithDetails[]> {
    const result = await db
      .select()
      .from(flightProposals)
      .leftJoin(users, eq(flightProposals.proposedBy, users.id))
      .where(eq(flightProposals.tripId, tripId))
      .orderBy(asc(flightProposals.averageRanking), desc(flightProposals.createdAt));

    // Get rankings for each proposal
    const proposalIds = result.map(row => row.flight_proposals.id);
    const rankings = await db
      .select()
      .from(flightRankings)
      .leftJoin(users, eq(flightRankings.userId, users.id))
      .where(inArray(flightRankings.proposalId, proposalIds))
      .orderBy(asc(flightRankings.ranking));

    // Group rankings by proposal ID
    const rankingsByProposal = rankings.reduce((acc, row) => {
      const proposalId = row.flight_rankings.proposalId;
      if (!acc[proposalId]) acc[proposalId] = [];
      acc[proposalId].push({
        ...row.flight_rankings,
        user: row.users!
      });
      return acc;
    }, {} as Record<number, (FlightRanking & { user: User })[]>);

    return result.map(row => ({
      ...row.flight_proposals,
      proposer: row.users!,
      rankings: rankingsByProposal[row.flight_proposals.id] || [],
      currentUserRanking: rankingsByProposal[row.flight_proposals.id]?.find(r => r.userId === userId)
    }));
  }

  async rankFlightProposal(ranking: InsertFlightRanking, userId: string): Promise<void> {
    await db
      .insert(flightRankings)
      .values({
        ...ranking,
        userId: userId,
      })
      .onConflictDoUpdate({
        target: [flightRankings.proposalId, flightRankings.userId],
        set: {
          ranking: ranking.ranking,
          notes: ranking.notes,
          updatedAt: new Date(),
        },
      });
  }

  async updateFlightProposalAverageRanking(proposalId: number): Promise<void> {
    const result = await db
      .select({
        avgRanking: sql<number>`ROUND(AVG(${flightRankings.ranking}), 2)`
      })
      .from(flightRankings)
      .where(eq(flightRankings.proposalId, proposalId));

    const avgRanking = result[0]?.avgRanking || null;

    await db
      .update(flightProposals)
      .set({ averageRanking: avgRanking?.toString() || null })
      .where(eq(flightProposals.id, proposalId));
  }

  async updateFlightProposalStatus(proposalId: number, status: string): Promise<FlightProposal> {
    const [updatedProposal] = await db
      .update(flightProposals)
      .set({ status })
      .where(eq(flightProposals.id, proposalId))
      .returning();

    if (!updatedProposal) {
      throw new Error('Flight proposal not found');
    }

    return updatedProposal;
  }

  // Restaurant proposal operations for group voting system
  async createRestaurantProposal(proposal: any, userId: string): Promise<RestaurantProposal> {
    const proposalData = {
      ...proposal,
      proposedBy: userId,
      rating: typeof proposal.rating === 'number' ? proposal.rating.toString() : (proposal.rating || '4.0')
    };
    const [newProposal] = await db
      .insert(restaurantProposals)
      .values(proposalData)
      .returning();
    return newProposal;
  }

  async getTripRestaurantProposals(tripId: number, userId: string): Promise<RestaurantProposalWithDetails[]> {
    const result = await db
      .select()
      .from(restaurantProposals)
      .leftJoin(users, eq(restaurantProposals.proposedBy, users.id))
      .where(eq(restaurantProposals.tripId, tripId))
      .orderBy(asc(restaurantProposals.averageRanking), desc(restaurantProposals.createdAt));

    // Get rankings for each proposal
    const proposalIds = result.map(row => row.restaurant_proposals.id);
    const rankings = await db
      .select()
      .from(restaurantRankings)
      .leftJoin(users, eq(restaurantRankings.userId, users.id))
      .where(inArray(restaurantRankings.proposalId, proposalIds))
      .orderBy(asc(restaurantRankings.ranking));

    // Group rankings by proposal ID
    const rankingsByProposal = rankings.reduce((acc, row) => {
      const proposalId = row.restaurant_rankings.proposalId;
      if (!acc[proposalId]) acc[proposalId] = [];
      acc[proposalId].push({
        ...row.restaurant_rankings,
        user: row.users!
      });
      return acc;
    }, {} as Record<number, (RestaurantRanking & { user: User })[]>);

    return result.map(row => ({
      ...row.restaurant_proposals,
      proposer: row.users!,
      rankings: rankingsByProposal[row.restaurant_proposals.id] || [],
      currentUserRanking: rankingsByProposal[row.restaurant_proposals.id]?.find(r => r.userId === userId)
    }));
  }

  async rankRestaurantProposal(ranking: InsertRestaurantRanking, userId: string): Promise<void> {
    await db
      .insert(restaurantRankings)
      .values({
        ...ranking,
        userId: userId,
      })
      .onConflictDoUpdate({
        target: [restaurantRankings.proposalId, restaurantRankings.userId],
        set: {
          ranking: ranking.ranking,
          notes: ranking.notes,
          updatedAt: new Date(),
        },
      });
  }

  async updateRestaurantProposalAverageRanking(proposalId: number): Promise<void> {
    const result = await db
      .select({
        avgRanking: sql<number>`ROUND(AVG(${restaurantRankings.ranking}), 2)`
      })
      .from(restaurantRankings)
      .where(eq(restaurantRankings.proposalId, proposalId));

    const avgRanking = result[0]?.avgRanking || null;

    await db
      .update(restaurantProposals)
      .set({ averageRanking: avgRanking?.toString() || null })
      .where(eq(restaurantProposals.id, proposalId));
  }

  async updateRestaurantProposalStatus(proposalId: number, status: string): Promise<RestaurantProposal> {
    const [updatedProposal] = await db
      .update(restaurantProposals)
      .set({ status })
      .where(eq(restaurantProposals.id, proposalId))
      .returning();

    if (!updatedProposal) {
      throw new Error('Restaurant proposal not found');
    }

    return updatedProposal;
  }

  // Travel tips operations
  async getTravelTips(options?: { category?: string; destination?: string; limit?: number }): Promise<TravelTipWithDetails[]> {
    // Build where conditions
    let whereConditions = [eq(travelTips.isActive, true)];
    
    if (options?.category) {
      whereConditions.push(eq(travelTips.category, options.category));
    }

    if (options?.destination) {
      whereConditions.push(
        sql`(${travelTips.destination} ILIKE ${'%' + options.destination + '%'} OR ${travelTips.applicableRegions}::text ILIKE ${'%' + options.destination + '%'})`
      );
    }

    let query = db
      .select({
        id: travelTips.id,
        content: travelTips.content,
        category: travelTips.category,
        destination: travelTips.destination,
        applicableRegions: travelTips.applicableRegions,
        activityCategories: travelTips.activityCategories,
        seasonality: travelTips.seasonality,
        priority: travelTips.priority,
        tags: travelTips.tags,
        isActive: travelTips.isActive,
        createdBy: travelTips.createdBy,
        source: travelTips.source,
        createdAt: travelTips.createdAt,
        updatedAt: travelTips.updatedAt,
        creator: {
          id: users.id,
          email: users.email,
          username: users.username,
          firstName: users.firstName,
          lastName: users.lastName,
          phoneNumber: users.phoneNumber,
          passwordHash: users.passwordHash,
          profileImageUrl: users.profileImageUrl,
          cashAppUsername: users.cashAppUsername,
          cashAppPhone: users.cashAppPhone,
          venmoUsername: users.venmoUsername,
          venmoPhone: users.venmoPhone,
          timezone: users.timezone,
          defaultLocation: users.defaultLocation,
          defaultLocationCode: users.defaultLocationCode,
          defaultCity: users.defaultCity,
          defaultCountry: users.defaultCountry,
          authProvider: users.authProvider,
          notificationPreferences: users.notificationPreferences,
          hasSeenHomeOnboarding: users.hasSeenHomeOnboarding,
          hasSeenTripOnboarding: users.hasSeenTripOnboarding,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
        }
      })
      .from(travelTips)
      .leftJoin(users, eq(travelTips.createdBy, users.id))
      .where(and(...whereConditions))
      .orderBy(desc(travelTips.priority), desc(travelTips.createdAt));

    const results = await (options?.limit ? query.limit(options.limit) : query);

    return results.map(row => ({
      id: row.id,
      content: row.content,
      category: row.category,
      destination: row.destination,
      applicableRegions: row.applicableRegions,
      activityCategories: row.activityCategories,
      seasonality: row.seasonality,
      priority: row.priority,
      tags: row.tags,
      isActive: row.isActive,
      createdBy: row.createdBy,
      source: row.source,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      creator: row.creator || undefined,
    }));
  }

  async createTravelTip(tip: InsertTravelTip): Promise<TravelTip> {
    const [newTip] = await db
      .insert(travelTips)
      .values(tip)
      .returning();
    return newTip;
  }

  async seedTravelTips(tips: InsertTravelTip[]): Promise<void> {
    if (tips.length === 0) return;
    
    // Insert in batches to avoid potential query size limits
    const batchSize = 50;
    for (let i = 0; i < tips.length; i += batchSize) {
      const batch = tips.slice(i, i + batchSize);
      await db.insert(travelTips).values(batch).onConflictDoNothing();
    }
  }

  async getUserTipPreferences(userId: string): Promise<UserTipPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userTipPreferences)
      .where(eq(userTipPreferences.userId, userId));
    return preferences;
  }

  async createOrUpdateUserTipPreferences(userId: string, preferences: Partial<InsertUserTipPreferences>): Promise<UserTipPreferences> {
    const [updatedPreferences] = await db
      .insert(userTipPreferences)
      .values({
        userId,
        ...preferences,
      })
      .onConflictDoUpdate({
        target: userTipPreferences.userId,
        set: {
          ...preferences,
          updatedAt: new Date(),
        },
      })
      .returning();
    return updatedPreferences;
  }

  async dismissTipForUser(userId: string, tipId: number): Promise<void> {
    // Get current preferences
    const currentPrefs = await this.getUserTipPreferences(userId);
    const currentDismissedTips = (currentPrefs?.dismissedTips as number[]) || [];
    
    // Add tip to dismissed list if not already there
    if (!currentDismissedTips.includes(tipId)) {
      const updatedDismissedTips = [...currentDismissedTips, tipId];
      await this.createOrUpdateUserTipPreferences(userId, {
        dismissedTips: updatedDismissedTips as any,
      });
    }
  }

}

export const storage = new DatabaseStorage();
