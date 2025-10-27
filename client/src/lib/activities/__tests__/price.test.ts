import { extractPriceValue } from "../../activities/price";

describe("extractPriceValue", () => {
  it("returns undefined for empty or missing values", () => {
    expect(extractPriceValue(undefined)).toBeUndefined();
    expect(extractPriceValue(null)).toBeUndefined();
    expect(extractPriceValue("")).toBeUndefined();
    expect(extractPriceValue("   ")).toBeUndefined();
  });

  it("extracts plain numeric strings", () => {
    expect(extractPriceValue("42")).toBe("42");
    expect(extractPriceValue("99.5")).toBe("99.5");
  });

  it("extracts the first numeric amount from formatted prices", () => {
    expect(extractPriceValue("$75.25")).toBe("75.25");
    expect(extractPriceValue("From $150 per adult")).toBe("150");
    expect(extractPriceValue("CAD 1,299.50 per person")).toBe("1299.50");
    expect(extractPriceValue("$199 - $249")).toBe("199");
  });

  it("returns undefined when no numeric value is present", () => {
    expect(extractPriceValue("Free")).toBeUndefined();
    expect(extractPriceValue("Call for pricing")).toBeUndefined();
  });
});
