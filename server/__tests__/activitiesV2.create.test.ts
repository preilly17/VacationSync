import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import type { CreateActivityRequest } from "@shared/activitiesV2";
import type { TripWithDetails } from "@shared/schema";

const ORIGINAL_ENV = process.env.NODE_ENV;

describe("createActivityV2", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_ENV;
  });

  it("treats blank end_time strings as null before inserting", async () => {
    const now = new Date();

    const creatorUser: TripWithDetails["creator"] = {
      id: "organizer",
      email: "organizer@example.com",
      username: "organizer",
      firstName: "Organizer",
      lastName: "User",
      phoneNumber: null,
      passwordHash: null,
      profileImageUrl: null,
      cashAppUsername: null,
      cashAppUsernameLegacy: null,
      cashAppPhone: null,
      cashAppPhoneLegacy: null,
      venmoUsername: null,
      venmoPhone: null,
      timezone: "UTC",
      defaultLocation: null,
      defaultLocationCode: null,
      defaultCity: null,
      defaultCountry: null,
      authProvider: null,
      notificationPreferences: null,
      hasSeenHomeOnboarding: false,
      hasSeenTripOnboarding: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const friendUser: TripWithDetails["creator"] = {
      id: "friend-1",
      email: "friend@example.com",
      username: "friend",
      firstName: "Friend",
      lastName: "Traveler",
      phoneNumber: null,
      passwordHash: null,
      profileImageUrl: null,
      cashAppUsername: null,
      cashAppUsernameLegacy: null,
      cashAppPhone: null,
      cashAppPhoneLegacy: null,
      venmoUsername: null,
      venmoPhone: null,
      timezone: "UTC",
      defaultLocation: null,
      defaultLocationCode: null,
      defaultCity: null,
      defaultCountry: null,
      authProvider: null,
      notificationPreferences: null,
      hasSeenHomeOnboarding: false,
      hasSeenTripOnboarding: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    const trip: TripWithDetails = {
      id: 123,
      name: "Spring Adventure",
      destination: "Paris",
      startDate: now.toISOString(),
      endDate: now.toISOString(),
      shareCode: "share-code",
      createdBy: creatorUser.id,
      createdAt: now.toISOString(),
      geonameId: null,
      cityName: null,
      countryName: null,
      latitude: null,
      longitude: null,
      population: null,
      coverImageUrl: null,
      coverPhotoUrl: null,
      coverPhotoCardUrl: null,
      coverPhotoThumbUrl: null,
      coverPhotoAlt: null,
      coverPhotoAttribution: null,
      coverPhotoStorageKey: null,
      coverPhotoOriginalUrl: null,
      coverPhotoFocalX: null,
      coverPhotoFocalY: null,
      coverPhotoUploadSize: null,
      coverPhotoUploadType: null,
      creator: creatorUser,
      members: [
        {
          id: 1,
          tripCalendarId: 123,
          userId: creatorUser.id,
          role: "organizer",
          departureLocation: null,
          departureAirport: null,
          joinedAt: now.toISOString(),
          user: creatorUser,
        },
        {
          id: 2,
          tripCalendarId: 123,
          userId: friendUser.id,
          role: "member",
          departureLocation: null,
          departureAirport: null,
          joinedAt: now.toISOString(),
          user: friendUser,
        },
      ],
      memberCount: 2,
    };

    const activityRequest: CreateActivityRequest = {
      mode: "scheduled",
      title: "Breakfast Meetup",
      description: "Morning plans",
      category: "food",
      date: "2024-03-01",
      start_time: "09:00",
      end_time: "   ",
      timezone: "UTC",
      location: null,
      cost_per_person: null,
      max_participants: null,
      invitee_ids: [friendUser.id],
      idempotency_key: "demo-key",
    };

    const timestamp = new Date(now);
    let insertedActivityId: string | undefined;

    const queryMock = jest.fn(async (sql: string) => {
      if (typeof sql === "string" && sql.includes("SELECT a.*, u.email AS creator_email")) {
        if (!insertedActivityId) {
          throw new Error("activity insert did not run");
        }

        return {
          rows: [
            {
              id: insertedActivityId,
              trip_id: String(trip.id),
              creator_id: creatorUser.id,
              title: activityRequest.title,
              description: activityRequest.description,
              category: activityRequest.category,
              date: activityRequest.date,
              start_time: activityRequest.start_time,
              end_time: null,
              timezone: activityRequest.timezone,
              location: null,
              cost_per_person: null,
              max_participants: null,
              status: "scheduled",
              visibility: "trip",
              created_at: timestamp,
              updated_at: timestamp,
              version: 1,
              creator_email: creatorUser.email,
              creator_username: creatorUser.username,
              creator_first_name: creatorUser.firstName,
              creator_last_name: creatorUser.lastName,
              creator_phone_number: creatorUser.phoneNumber,
              creator_profile_image_url: creatorUser.profileImageUrl,
              creator_timezone: creatorUser.timezone,
            },
          ],
        };
      }

      if (typeof sql === "string" && sql.includes("FROM activity_invitees_v2")) {
        if (!insertedActivityId) {
          throw new Error("activity insert did not run");
        }

        return {
          rows: [
            {
              activity_id: insertedActivityId,
              user_id: creatorUser.id,
              role: "participant",
              created_at: timestamp,
              updated_at: timestamp,
              user_email: creatorUser.email,
              user_username: creatorUser.username,
              user_first_name: creatorUser.firstName,
              user_last_name: creatorUser.lastName,
              user_phone_number: creatorUser.phoneNumber,
              user_profile_image_url: creatorUser.profileImageUrl,
              user_timezone: creatorUser.timezone,
            },
            {
              activity_id: insertedActivityId,
              user_id: friendUser.id,
              role: "participant",
              created_at: timestamp,
              updated_at: timestamp,
              user_email: friendUser.email,
              user_username: friendUser.username,
              user_first_name: friendUser.firstName,
              user_last_name: friendUser.lastName,
              user_phone_number: friendUser.phoneNumber,
              user_profile_image_url: friendUser.profileImageUrl,
              user_timezone: friendUser.timezone,
            },
          ],
        };
      }

      if (typeof sql === "string" && sql.includes("FROM activity_votes_v2")) {
        return { rows: [] };
      }

      if (typeof sql === "string" && sql.includes("FROM activity_rsvps_v2")) {
        if (!insertedActivityId) {
          throw new Error("activity insert did not run");
        }

        return {
          rows: [
            {
              activity_id: insertedActivityId,
              user_id: creatorUser.id,
              response: "yes",
              responded_at: timestamp,
              rsvp_user_email: creatorUser.email,
              rsvp_user_username: creatorUser.username,
              rsvp_user_first_name: creatorUser.firstName,
              rsvp_user_last_name: creatorUser.lastName,
              rsvp_user_phone_number: creatorUser.phoneNumber,
              rsvp_user_profile_image_url: creatorUser.profileImageUrl,
              rsvp_user_timezone: creatorUser.timezone,
            },
            {
              activity_id: insertedActivityId,
              user_id: friendUser.id,
              response: "pending",
              responded_at: null,
              rsvp_user_email: friendUser.email,
              rsvp_user_username: friendUser.username,
              rsvp_user_first_name: friendUser.firstName,
              rsvp_user_last_name: friendUser.lastName,
              rsvp_user_phone_number: friendUser.phoneNumber,
              rsvp_user_profile_image_url: friendUser.profileImageUrl,
              rsvp_user_timezone: friendUser.timezone,
            },
          ],
        };
      }

      return { rows: [] };
    });

    const clientQueryMock = jest.fn(async (sql: string, params: unknown[] = []) => {
      const text = typeof sql === "string" ? sql : String(sql);

      if (text.startsWith("BEGIN") || text.startsWith("COMMIT") || text.startsWith("ROLLBACK")) {
        return { rows: [] };
      }

      if (text.includes("SELECT id FROM activities_v2")) {
        return { rows: [] };
      }

      if (text.includes("INSERT INTO activities_v2")) {
        insertedActivityId = String(params[0]);
        expect(params[8]).toBeNull();
        return { rows: [] };
      }

      return { rows: [] };
    });

    const connectMock = jest.fn().mockResolvedValue({
      query: clientQueryMock,
      release: jest.fn(),
    });

    jest.doMock("../db", () => ({
      query: queryMock,
      pool: {
        connect: connectMock,
      },
    }));

    const { createActivityV2 } = await import("../activitiesV2");

    const result = await createActivityV2({
      trip,
      creatorId: creatorUser.id,
      body: activityRequest,
    });

    expect(connectMock).toHaveBeenCalled();
    expect(clientQueryMock.mock.calls.some(([sql]) => typeof sql === "string" && sql.includes("INSERT INTO activities_v2"))).toBe(true);
    const insertCall = clientQueryMock.mock.calls.find(
      ([sql]) => typeof sql === "string" && sql.includes("INSERT INTO activities_v2"),
    );
    expect(insertCall?.[1]?.[8]).toBeNull();

    expect(result.endTime).toBeNull();
    expect(result.initialVoteOrRsvpState[creatorUser.id]).toBe("yes");
    expect(result.initialVoteOrRsvpState[friendUser.id]).toBe("pending");
  });
});

