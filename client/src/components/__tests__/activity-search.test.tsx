import { describe, expect, it } from "@jest/globals";

import { buildManualMemberOptions } from "@/lib/activities/manualMemberOptions";
import type { TripMember, User } from "@shared/schema";

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: "user-1",
  email: "user@example.com",
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
  ...overrides,
});

const buildMember = (
  userId: string,
  overrides: Partial<TripMember & { user: User }> = {},
): (TripMember & { user: User }) => ({
  id: 1,
  tripCalendarId: 99,
  userId,
  role: "member",
  departureLocation: null,
  departureAirport: null,
  joinedAt: null,
  user: buildUser({ id: userId, email: `${userId}@example.com` }),
  ...overrides,
});

describe("buildManualMemberOptions", () => {
  it("includes the current user when they are not in the trip member list", () => {
    const members = [
      buildMember("friend-1", {
        user: buildUser({ id: "friend-1", firstName: "Jamie", lastName: "Lee" }),
      }),
    ];

    const currentUser = buildUser({ id: "organizer", firstName: "Avery", lastName: "Cole" });

    const options = buildManualMemberOptions(members, currentUser, "organizer");

    expect(options[0]).toEqual({ id: "organizer", name: "Avery Cole (You)" });
    expect(options.some((option) => option.id === "friend-1")).toBe(true);
  });

  it("preserves the current user from the member list and annotates them", () => {
    const members = [
      buildMember("organizer", {
        user: buildUser({ id: "organizer", firstName: "Sky", lastName: "Rivera" }),
      }),
      buildMember("friend-2", {
        user: buildUser({ id: "friend-2", firstName: "Morgan", lastName: "Shaw" }),
      }),
    ];

    const currentUser = buildUser({ id: "organizer", firstName: "Sky", lastName: "Rivera" });

    const options = buildManualMemberOptions(members, currentUser, "organizer");

    expect(options[0]).toEqual({ id: "organizer", name: "Sky Rivera (You)" });
    expect(options[1]).toEqual({ id: "friend-2", name: "Morgan Shaw" });
  });

  it("falls back to a generic label when user details are missing", () => {
    const members: (TripMember & { user: User })[] = [];

    const options = buildManualMemberOptions(members, null, "solo-traveler");

    expect(options).toEqual([{ id: "solo-traveler", name: "You" }]);
  });
});

