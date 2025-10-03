import { buildActivitySubmission } from "../activitySubmission";
import { END_TIME_AFTER_START_MESSAGE } from "@shared/activityValidation";

describe("buildActivitySubmission", () => {
  const baseInput = {
    tripId: 42,
    name: "Sunset Cruise",
    description: "Enjoy the bay",
    date: "2025-07-04",
    startTime: "18:00",
    endTime: "20:00",
    location: "Pier 39",
    cost: "49.99",
    maxCapacity: "12",
    category: "entertainment",
    attendeeIds: ["abc", "def"],
    type: "SCHEDULED" as const,
  };

  it("normalizes values into a payload the API accepts", () => {
    const { payload } = buildActivitySubmission(baseInput);

    expect(payload).toMatchObject({
      tripCalendarId: 42,
      name: "Sunset Cruise",
      description: "Enjoy the bay",
      location: "Pier 39",
      cost: 49.99,
      maxCapacity: 12,
      category: "entertainment",
      attendeeIds: ["abc", "def"],
      type: "SCHEDULED",
    });

    expect(payload.startTime).toBe(new Date("2025-07-04T18:00:00").toISOString());
    expect(payload.endTime).toBe(new Date("2025-07-04T20:00:00").toISOString());
  });

  it("throws when the end time is before the start time", () => {
    expect(() =>
      buildActivitySubmission({
        ...baseInput,
        endTime: "17:00",
      }),
    ).toThrow(END_TIME_AFTER_START_MESSAGE);
  });

  it("validates categories and attendee ids", () => {
    expect(() =>
      buildActivitySubmission({
        ...baseInput,
        attendeeIds: [],
      }),
    ).toThrow("Include at least one attendee.");

    expect(() =>
      buildActivitySubmission({
        ...baseInput,
        category: "invalid",
      }),
    ).toThrow();
  });
});
