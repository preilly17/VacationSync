import {
  getActivityComparisonDate,
  getActivityEndDate,
  getActivityStartDate,
  getActivityTimeOptions,
  isActivityPast,
  parseActivityDate,
} from "@/lib/activityTime";
import type {
  ActivityAcceptance,
  ActivityComment,
  ActivityInvite,
  ActivityWithDetails,
  User,
} from "@shared/schema";

describe("activityTime helpers", () => {
  const baseUser: User = {
    id: "user-1",
    email: "user@example.com",
    username: "user",
    firstName: "User",
    lastName: "Example",
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
  };

  const makeActivity = (
    overrides: Partial<ActivityWithDetails> = {},
  ): ActivityWithDetails => ({
    id: 1,
    tripCalendarId: 1,
    postedBy: baseUser.id,
    name: "Sample activity",
    description: null,
    startTime: null,
    endTime: null,
    location: null,
    cost: null,
    maxCapacity: null,
    category: "general",
    status: "active",
    createdAt: null,
    updatedAt: null,
    type: "SCHEDULED",
    timeOptions: null,
    proposalVotes: null,
    poster: baseUser,
    invites: [] as (ActivityInvite & { user: User })[],
    acceptances: [] as (ActivityAcceptance & { user: User })[],
    comments: [] as (ActivityComment & { user: User })[],
    acceptedCount: 0,
    pendingCount: 0,
    declinedCount: 0,
    ...overrides,
  });

  it("parses activity dates consistently", () => {
    expect(parseActivityDate(null)).toBeNull();
    expect(parseActivityDate(" ")).toBeNull();

    const valid = parseActivityDate("2024-05-01T12:00:00Z");
    expect(valid).not.toBeNull();
    expect(valid?.toISOString()).toBe("2024-05-01T12:00:00.000Z");
  });

  it("derives start and end dates from activity payloads", () => {
    const activity = makeActivity({
      startTime: "2024-05-01T12:00:00Z",
      endTime: "2024-05-01T13:00:00Z",
    });

    expect(getActivityStartDate(activity)?.toISOString()).toBe(
      "2024-05-01T12:00:00.000Z",
    );
    expect(getActivityEndDate(activity)?.toISOString()).toBe(
      "2024-05-01T13:00:00.000Z",
    );
    expect(getActivityComparisonDate(activity)?.toISOString()).toBe(
      "2024-05-01T13:00:00.000Z",
    );
  });

  it("treats undated proposals as upcoming", () => {
    const now = new Date("2024-05-02T12:00:00Z");
    const proposal = makeActivity({ type: "PROPOSE", startTime: null, endTime: null });

    expect(isActivityPast(proposal, now)).toBe(false);
  });

  it("treats proposals with options but no start time as upcoming", () => {
    const now = new Date("2024-05-02T12:00:00Z");
    const proposal = makeActivity({
      type: "PROPOSE",
      timeOptions: ["2024-05-05T16:00:00Z", "2024-05-06T16:00:00Z"],
    });

    expect(isActivityPast(proposal, now)).toBe(false);
    expect(getActivityTimeOptions(proposal)).toHaveLength(2);
  });

  it("respects actual start times when determining past status", () => {
    const now = new Date("2024-05-02T12:00:00Z");
    const pastActivity = makeActivity({
      startTime: "2024-04-30T12:00:00Z",
      endTime: "2024-04-30T13:00:00Z",
    });
    const upcomingActivity = makeActivity({
      startTime: "2024-05-03T12:00:00Z",
    });

    expect(isActivityPast(pastActivity, now)).toBe(true);
    expect(isActivityPast(upcomingActivity, now)).toBe(false);
  });
});
