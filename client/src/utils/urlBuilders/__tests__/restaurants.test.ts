import {
  buildOpenTableUrl,
  buildResyUrl,
} from "../restaurants";

describe("buildResyUrl", () => {
  it("builds a Resy url with just a city", () => {
    const url = buildResyUrl({ city: "Atlanta", date: "2025-10-28", partySize: 2 });
    expect(url).toBe("https://resy.com/cities/atlanta/search?date=2025-10-28&seats=2");
  });

  it("adds a state code when provided", () => {
    const url = buildResyUrl({ city: "Atlanta", stateCode: "GA", date: "2025-10-28", partySize: 2 });
    expect(url).toBe("https://resy.com/cities/atlanta-ga/search?date=2025-10-28&seats=2");
  });

  it("forces party size to be at least one and normalizes spaces", () => {
    const url = buildResyUrl({ city: "New   York", date: "2025-10-28", partySize: 0 });
    expect(url).toBe("https://resy.com/cities/new-york/search?date=2025-10-28&seats=1");
  });

  it("throws when the date format is invalid", () => {
    expect(() => buildResyUrl({ city: "Paris", date: "10/28/2025", partySize: 2 })).toThrow(
      "Date must be in YYYY-MM-DD format",
    );
  });
});

describe("buildOpenTableUrl", () => {
  it("requires a time value", () => {
    expect(() =>
      buildOpenTableUrl({ city: "Atlanta", date: "2025-10-28", time: "", partySize: 2 }),
    ).toThrow("Time is required");
  });

  it("omits coordinates when not provided", () => {
    const url = buildOpenTableUrl({ city: "Atlanta", date: "2025-10-28", time: "19:00", partySize: 2 });
    expect(url).toBe(
      "https://www.opentable.com/s?dateTime=2025-10-28T19%3A00%3A00&covers=2&searchedLocationName=Atlanta&shouldUseLatLongSearch=false",
    );
  });

  it("includes coordinates and toggles the flag when provided", () => {
    const url = buildOpenTableUrl({
      city: "Atlanta",
      date: "2025-10-28",
      time: "19:00",
      partySize: 2,
      latitude: 33.874320594174755,
      longitude: -84.35580064660194,
    });

    expect(url).toBe(
      "https://www.opentable.com/s?dateTime=2025-10-28T19%3A00%3A00&covers=2&searchedLocationName=Atlanta&shouldUseLatLongSearch=true&latitude=33.874320594174755&longitude=-84.35580064660194",
    );
  });

  it("throws when the time format is invalid", () => {
    expect(() =>
      buildOpenTableUrl({ city: "Atlanta", date: "2025-10-28", time: "7pm", partySize: 2 }),
    ).toThrow("Time must be in HH:mm format");
  });
});
