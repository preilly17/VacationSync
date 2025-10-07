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
      mode: "scheduled",
      attendeeIds: ["1", "2"],
    });
    expect(sanitizedValues.attendeeIds).toEqual(["1", "2"]);
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
