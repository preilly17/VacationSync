import { activityMatchesPeopleFilter, peopleFilterAllowedStatuses } from "@/lib/activityFilters";
import type { ActivityInvite, ActivityWithDetails, User } from "@shared/schema";

describe("activityMatchesPeopleFilter", () => {
  const baseUser: User = {
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
    timezone: null,
    defaultLocation: null,
    defaultLocationCode: null,
    defaultCity: null,
    defaultCountry: null,
    authProvider: null,
    notificationPreferences: null,
    hasSeenHomeOnboarding: false,
    hasSeenTripOnboarding: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const buildActivity = (
    overrides: Partial<ActivityWithDetails>,
    invites: (ActivityInvite & { user: User })[] = [],
  ): ActivityWithDetails => ({
    id: 1,
    tripCalendarId: 99,
    postedBy: "organizer",
    name: "Dinner",
    description: null,
    startTime: new Date().toISOString(),
    endTime: null,
    location: null,
    cost: null,
    maxCapacity: null,
    category: "food",
    status: "active",
    type: "SCHEDULED",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    poster: baseUser,
    invites,
    acceptances: [],
    comments: [],
    acceptedCount: 0,
    pendingCount: 0,
    declinedCount: 0,
    waitlistedCount: 0,
    currentUserInvite: undefined,
    isAccepted: undefined,
    hasResponded: undefined,
    permissions: { canCancel: true },
    ...overrides,
  });

  const buildInvite = (userId: string, status: ActivityInvite["status"]): ActivityInvite & { user: User } => ({
    id: Math.random(),
    activityId: 1,
    userId,
    status,
    respondedAt: null,
    createdAt: null,
    updatedAt: null,
    user: { ...baseUser, id: userId },
  });

  it("matches activities created by the selected member", () => {
    const activity = buildActivity({ postedBy: "member-1" });
    expect(activityMatchesPeopleFilter(activity, "member-1")).toBe(true);
  });

  it("matches accepted invites for the selected member", () => {
    const invite = buildInvite("member-3", "accepted");
    const activity = buildActivity({}, [invite]);
    expect(activityMatchesPeopleFilter(activity, "member-3")).toBe(true);
  });

  it("does not match pending invites", () => {
    const invite = buildInvite("member-2", "pending");
    const activity = buildActivity({}, [invite]);
    expect(activityMatchesPeopleFilter(activity, "member-2")).toBe(false);
  });

  it("does not match declined invites", () => {
    const invite = buildInvite("member-4", "declined");
    const activity = buildActivity({}, [invite]);
    expect(activityMatchesPeopleFilter(activity, "member-4")).toBe(false);
  });

  it("exposes the allowed statuses for external validation", () => {
    expect(peopleFilterAllowedStatuses).toEqual(["accepted"]);
  });
});
