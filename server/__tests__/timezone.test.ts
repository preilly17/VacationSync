import { describe, expect, it } from "@jest/globals";
import { combineDateAndTimeInUtc } from "../src/utils/timezone";

describe("timezone helpers", () => {
  it("converts America/New_York dinner time into UTC correctly", () => {
    const result = combineDateAndTimeInUtc("2025-02-10", "19:00", "America/New_York");
    expect(result).toBe("2025-02-11T00:00:00.000Z");
  });

  it("converts America/Los_Angeles dinner time into UTC correctly", () => {
    const result = combineDateAndTimeInUtc("2025-02-10", "19:00", "America/Los_Angeles");
    expect(result).toBe("2025-02-11T03:00:00.000Z");
  });
});
