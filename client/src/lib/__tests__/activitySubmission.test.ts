import { describe, expect, it, jest } from "@jest/globals";

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
      cost_per_person: 49.99,
      maxCapacity: 12,
      max_participants: 12,
      category: "entertainment",
      attendeeIds: ["abc", "def"],
      invitee_ids: ["abc", "def"],
      type: "SCHEDULED",
      mode: "scheduled",
      title: "Sunset Cruise",
      date: "2025-07-04",
      start_time: "18:00",
      end_time: "20:00",
      startDate: "2025-07-04",
    });

    expect(payload.startTime).toBe(new Date("2025-07-04T18:00:00").toISOString());
    expect(payload.endTime).toBe(new Date("2025-07-04T20:00:00").toISOString());
    expect(payload.timezone).toEqual(payload.timeZone);
    expect(payload.timezone).not.toHaveLength(0);
    expect(payload.idempotency_key).toEqual(payload.idempotencyKey);
    expect(payload.idempotency_key).not.toHaveLength(0);
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

  it("preserves the selected calendar date for YYYY-MM-DD inputs", async () => {
    const originalTimeZone = process.env.TZ;

    jest.resetModules();
    process.env.TZ = "America/Los_Angeles";

    const module = await import("../activitySubmission");
    const { payload } = module.buildActivitySubmission({
      ...baseInput,
      date: "2025-07-04",
      startTime: "09:30",
    });

    expect(payload.date).toBe("2025-07-04");
    expect(payload.startDate).toBe("2025-07-04");

    process.env.TZ = originalTimeZone;
    jest.resetModules();
  });
});
