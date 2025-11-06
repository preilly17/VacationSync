import { beforeAll, describe, expect, it } from "@jest/globals";

import type { ActivityWithDetails as ActivityWithDetailsV2 } from "@shared/activitiesV2";

let convertActivitiesV2ToLegacy: (typeof import("../activitiesV2"))["convertActivitiesV2ToLegacy"];

beforeAll(async () => {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

  ({ convertActivitiesV2ToLegacy } = await import("../activitiesV2"));
});

describe("convertActivitiesV2ToLegacy", () => {
  it("translates scheduled activities into the legacy calendar shape", () => {
    const createdAt = new Date("2024-01-01T12:00:00.000Z").toISOString();
    const respondedAt = new Date("2024-01-02T10:00:00.000Z").toISOString();

    const activity: ActivityWithDetailsV2 = {
      id: "a3d5f9f6-1111-4cde-a7ad-1234567890ab",
      tripId: "42",
      creatorId: "creator-1",
      title: "Guided hike",
      description: "Morning trek through the valley",
      category: "outdoor",
      date: "2024-01-02",
      startTime: "09:30",
      endTime: "11:00",
      timezone: "UTC",
      location: "Trailhead",
      costPerPerson: 25,
      maxParticipants: 5,
      status: "scheduled",
      visibility: "trip",
      createdAt,
      updatedAt: createdAt,
      version: 1,
      invitees: [
        {
          activityId: "a3d5f9f6-1111-4cde-a7ad-1234567890ab",
          userId: "attendee-1",
          role: "participant",
          createdAt,
          updatedAt: createdAt,
          user: {
            id: "attendee-1",
            email: "attendee@example.com",
            username: "attendee",
            firstName: "Pat",
            lastName: "Hiker",
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
            createdAt: null,
            updatedAt: null,
          },
        },
      ],
      votes: [],
      rsvps: [
        {
          activityId: "a3d5f9f6-1111-4cde-a7ad-1234567890ab",
          userId: "attendee-1",
          response: "yes",
          respondedAt,
          user: null,
        },
      ],
      creator: {
        id: "creator-1",
        email: "guide@example.com",
        username: "guide",
        firstName: "Alex",
        lastName: "Guide",
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
        createdAt: null,
        updatedAt: null,
      },
      currentUserVote: null,
      currentUserRsvp: null,
    };

    const [legacy] = convertActivitiesV2ToLegacy([activity], { currentUserId: "attendee-1" });

    expect(legacy.type).toBe("SCHEDULED");
    expect(legacy.status).toBe("active");
    expect(legacy.poster.id).toBe("creator-1");
    expect(legacy.invites).toHaveLength(1);
    expect(legacy.invites[0]?.status).toBe("accepted");
    expect(legacy.acceptances).toHaveLength(1);
    expect(legacy.currentUserInvite?.status).toBe("accepted");
    expect(legacy.startTime).toBe("2024-01-02T09:30:00.000Z");
    expect(legacy.endTime).toBe("2024-01-02T11:00:00.000Z");
  });
});
