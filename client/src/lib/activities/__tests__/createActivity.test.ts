import { jest } from "@jest/globals";

import { ATTENDEE_REQUIRED_MESSAGE, END_TIME_AFTER_START_MESSAGE } from "@shared/activityValidation";

jest.mock("@/lib/queryClient", () => ({
  ApiError: class MockApiError extends Error {
    status: number;
    data: unknown;

    constructor(status: number, data: unknown, message: string) {
      super(message);
      this.status = status;
      this.data = data;
    }
  },
  apiRequest: jest.fn(),
}));

import {
  ActivitySubmissionError,
  prepareActivitySubmission,
  mapApiErrorToValidation,
} from "../activityCreation";
import { normalizeActivityFromServer } from "../createActivity";
import type { User } from "@shared/schema";
import { mapClientErrorToValidation } from "../clientValidation";

describe("mapClientErrorToValidation", () => {
  it("maps known validation messages to the correct field", () => {
    const attendeeError = mapClientErrorToValidation(new Error(ATTENDEE_REQUIRED_MESSAGE));
    expect(attendeeError.fieldErrors).toEqual([
      { field: "attendeeIds", message: ATTENDEE_REQUIRED_MESSAGE },
    ]);
    expect(attendeeError.formMessage).toBeUndefined();

    const endTimeError = mapClientErrorToValidation(new Error(END_TIME_AFTER_START_MESSAGE));
    expect(endTimeError.fieldErrors).toEqual([
      { field: "endTime", message: END_TIME_AFTER_START_MESSAGE },
    ]);
  });

  it("falls back to a form-level message for unknown errors", () => {
    const unexpectedError = mapClientErrorToValidation(new Error("Something odd"));
    expect(unexpectedError.fieldErrors).toEqual([]);
    expect(unexpectedError.formMessage).toBe("Something odd");
  });

  it("returns a helpful fallback message when the error is not an Error", () => {
    const fallback = mapClientErrorToValidation(null);
    expect(fallback.fieldErrors).toEqual([]);
    expect(fallback.formMessage).toMatch(/We couldn’t prepare your activity/);
  });
});

describe("prepareActivitySubmission", () => {
  const baseValues = {
    name: "Morning Hike",
    description: "Enjoy the sunrise",
    startDate: "2024-05-01",
    startTime: "08:00",
    endTime: "10:00",
    location: "Trailhead",
    cost: "25",
    maxCapacity: "8",
    attendeeIds: ["1", "2"],
    category: "outdoor",
    type: "SCHEDULED" as const,
  };

  it("builds a submission payload for valid values", () => {
    const { payload, sanitizedValues } = prepareActivitySubmission({
      tripId: 42,
      values: baseValues,
    });

    expect(payload).toMatchObject({
      tripCalendarId: 42,
      name: "Morning Hike",
      attendeeIds: ["1", "2"],
      type: "SCHEDULED",
    });
    expect(payload).not.toHaveProperty("mode");
    expect(sanitizedValues.attendeeIds).toEqual(["1", "2"]);
    expect(sanitizedValues.startDate).toBe("2024-05-01");
    expect(sanitizedValues.startTime).toBe("08:00");
    expect(sanitizedValues.endTime).toBe("10:00");
  });

  it("throws an ActivitySubmissionError when validation fails", () => {
    expect(() =>
      prepareActivitySubmission({
        tripId: 42,
        values: { ...baseValues, startTime: "" },
      }),
    ).toThrow(ActivitySubmissionError);
  });
});

describe("normalizeActivityFromServer", () => {
  const baseUser: User = {
    id: "organizer",
    email: "organizer@example.com",
    username: null,
    firstName: "Trip",
    lastName: "Lead",
    phoneNumber: null,
    passwordHash: null,
    profileImageUrl: null,
    cashAppUsername: null,
    cashAppUsernameLegacy: null,
    cashAppPhone: null,
    cashAppPhoneLegacy: null,
    venmoUsername: null,
    venmoPhone: null,
    timezone: "America/New_York",
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

  it("preserves ISO timestamps when already provided", () => {
    const now = new Date().toISOString();
    const activity = {
      id: 2,
      tripCalendarId: 123,
      postedBy: "organizer",
      name: "Dinner",
      description: null,
      startTime: "2024-08-01T17:00:00.000Z",
      endTime: null,
      location: null,
      cost: null,
      maxCapacity: null,
      category: "food",
      status: "active",
      type: "SCHEDULED" as const,
      createdAt: now,
      updatedAt: now,
      poster: baseUser,
      invites: [],
      acceptances: [],
      comments: [],
      acceptedCount: 0,
      pendingCount: 0,
      declinedCount: 0,
      waitlistedCount: 0,
      rsvpCloseTime: null,
      currentUserInvite: undefined,
      isAccepted: undefined,
      hasResponded: undefined,
      permissions: undefined,
    } as const;

    const normalized = normalizeActivityFromServer(activity as any);
    expect(normalized.startTime).toBe(activity.startTime);
    expect(normalized.endTime).toBeNull();
  });

  it("fills in empty arrays when the server omits related collections", () => {
    const now = new Date().toISOString();
    const normalized = normalizeActivityFromServer({
      id: 7,
      tripCalendarId: 555,
      postedBy: "organizer",
      name: "Gallery visit",
      description: null,
      startTime: now,
      endTime: null,
      location: null,
      cost: null,
      maxCapacity: null,
      category: "culture",
      status: "active",
      type: "SCHEDULED",
      createdAt: now,
      updatedAt: now,
      poster: baseUser,
    } as any);

    expect(normalized.invites).toEqual([]);
    expect(normalized.acceptances).toEqual([]);
    expect(normalized.comments).toEqual([]);
    expect(normalized.acceptedCount).toBe(0);
    expect(normalized.pendingCount).toBe(0);
    expect(normalized.declinedCount).toBe(0);
    expect(normalized.waitlistedCount).toBe(0);
    expect(normalized.currentUserInvite).toBeNull();
    expect(normalized.isAccepted).toBeUndefined();
    expect(normalized.hasResponded).toBeUndefined();
  });

  it("derives invite counts from invite statuses when aggregates are missing", () => {
    const now = new Date().toISOString();
    const normalized = normalizeActivityFromServer({
      id: 9,
      tripCalendarId: 123,
      postedBy: "organizer",
      name: "Boat ride",
      description: null,
      startTime: now,
      endTime: null,
      location: null,
      cost: null,
      maxCapacity: null,
      category: "activities",
      status: "active",
      type: "SCHEDULED",
      createdAt: now,
      updatedAt: now,
      poster: baseUser,
      invites: [
        {
          id: 1,
          activityId: 9,
          userId: "organizer",
          status: "accepted",
          respondedAt: now,
          createdAt: now,
          updatedAt: now,
          user: baseUser,
        },
        {
          id: 2,
          activityId: 9,
          userId: "friend",
          status: "pending",
          respondedAt: null,
          createdAt: now,
          updatedAt: now,
          user: { ...baseUser, id: "friend", email: "friend@example.com" },
        },
      ],
      acceptances: [],
      comments: [],
    } as any);

    expect(normalized.acceptedCount).toBe(1);
    expect(normalized.pendingCount).toBe(1);
    expect(normalized.declinedCount).toBe(0);
    expect(normalized.waitlistedCount).toBe(0);
  });

});

describe("mapApiErrorToValidation", () => {
  it("maps API validation errors to client fields", () => {
    const apiError = {
      status: 400,
      data: { errors: [{ field: "start_time", message: "Start required" }] },
    } as Parameters<typeof mapApiErrorToValidation>[0];

    const validation = mapApiErrorToValidation(apiError);
    expect(validation).toEqual({
      fieldErrors: [{ field: "startTime", message: "Start required" }],
      formMessage: undefined,
    });
  });

  it("returns null for non-validation errors", () => {
    const apiError = { status: 500, data: { message: "Server error" } } as Parameters<
      typeof mapApiErrorToValidation
    >[0];
    expect(mapApiErrorToValidation(apiError)).toBeNull();
  });
});
