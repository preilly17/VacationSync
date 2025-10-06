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
      title: "Sunset Cruise",
      date: "2025-07-04",
      start_time: "18:00",
      end_time: "20:00",
      invitee_ids: ["abc", "def"],
    });

    expect(payload.startTime).toBe(new Date("2025-07-04T18:00:00").toISOString());
    expect(payload.endTime).toBe(new Date("2025-07-04T20:00:00").toISOString());
    const expectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
    expect(payload.timezone).toBe(expectedTimezone);
    expect(typeof payload.idempotency_key).toBe("string");
    expect(payload.idempotency_key.length).toBeGreaterThan(0);
  });

  it("throws when the end time is before the start time", () => {
    expect(() =>
      buildActivitySubmission({
        ...baseInput,
        endTime: "17:00",
      }),
    ).toThrow(END_TIME_AFTER_START_MESSAGE);
  });

  it("allows scheduling without inviting other travelers", () => {
    const { payload } = buildActivitySubmission({
      ...baseInput,
      attendeeIds: [],
    });

    expect(payload.attendeeIds).toEqual([]);
    expect(payload.invitee_ids).toEqual([]);
  });

  it("validates categories", () => {
    expect(() =>
      buildActivitySubmission({
        ...baseInput,
        category: "invalid",
      }),
    ).toThrow();
  });

  it("treats a blank end time as optional", () => {
    const { payload } = buildActivitySubmission({
      ...baseInput,
      endTime: "",
    });

    expect(payload.endTime).toBeNull();
  });
});
