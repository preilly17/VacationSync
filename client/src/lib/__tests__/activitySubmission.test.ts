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
    timezone: "UTC" as const,
  };

  it("normalizes values into a payload the API accepts", () => {
    const { payload, metadata } = buildActivitySubmission(baseInput);

    expect(payload).toMatchObject({
      tripCalendarId: 42,
      name: "Sunset Cruise",
      description: "Enjoy the bay",
      startDate: "2025-07-04",
      location: "Pier 39",
      cost: 49.99,
      maxCapacity: 12,
      category: "entertainment",
      attendeeIds: ["abc", "def"],
      type: "SCHEDULED",
    });

    expect(payload.startTime).toBe(new Date("2025-07-04T18:00:00").toISOString());
    expect(payload.endTime).toBe(new Date("2025-07-04T20:00:00").toISOString());
    expect(metadata).toMatchObject({ startDate: "2025-07-04", startTime: "18:00", endTime: "20:00" });
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

  it("converts local times into UTC using the provided timezone", () => {
    const { payload } = buildActivitySubmission({
      ...baseInput,
      timezone: "America/New_York",
      startTime: "09:30",
      endTime: "11:00",
    });

    expect(payload.startTime).toBe("2025-07-04T13:30:00.000Z");
    expect(payload.endTime).toBe("2025-07-04T15:00:00.000Z");
  });

  it("allows proposals without a start time", () => {
    const { payload, metadata } = buildActivitySubmission({
      ...baseInput,
      type: "PROPOSE",
      startTime: "",
      endTime: undefined,
    });

    expect(payload.startTime).toBeNull();
    expect(payload.endTime).toBeNull();
    expect(payload.startDate).toBe("2025-07-04");
    expect(metadata.startTime).toBeNull();
    expect(metadata.endTime).toBeNull();
  });

  it("preserves the selected calendar date for YYYY-MM-DD inputs", async () => {
    const originalTimeZone = process.env.TZ;

    jest.resetModules();
    process.env.TZ = "America/Los_Angeles";

    const module = await import("../activitySubmission");
    const { payload, metadata } = module.buildActivitySubmission({
      ...baseInput,
      date: "2025-07-04",
      startTime: "09:30",
    });

    expect(metadata.startDate).toBe("2025-07-04");
    expect(metadata.startTime).toBe("09:30");

    process.env.TZ = originalTimeZone;
    jest.resetModules();
  });
});
