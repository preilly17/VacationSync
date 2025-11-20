import { buildAdHocHotelProposalRequestBody, buildHotelProposalPayload } from "@/lib/hotel-proposals";
import type { HotelSearchResult } from "@shared/schema";

describe("buildAdHocHotelProposalRequestBody", () => {
  const baseResult: HotelSearchResult = {
    id: "test-hotel",
    name: "Test Hotel",
    location: "",
    rating: 4.2,
    price: "$1,234 total",
    pricePerNight: "$456 per night",
    amenities: "WiFi",
    platform: "Example",
    bookingUrl: "https://example.com",
  };

  it("fills in address, city, and country details when they are missing", () => {
    const payload = buildHotelProposalPayload({ ...baseResult, location: "Lisbon, Portugal" });

    const requestBody = buildAdHocHotelProposalRequestBody(payload, {
      tripId: 99,
      trip: {
        destination: "Lisbon, Portugal",
        startDate: "2025-03-01T00:00:00.000Z",
        endDate: "2025-03-05T00:00:00.000Z",
      },
    });

    expect(requestBody.address).toContain("Lisbon");
    expect(requestBody.city).toBe("Lisbon");
    expect(requestBody.country).toBe("Portugal");
    expect(requestBody.checkInDate).toBe("2025-03-01T00:00:00.000Z");
    expect(requestBody.checkOutDate).toBe("2025-03-05T00:00:00.000Z");
  });

  it("normalizes price fields so the insert schema can parse them", () => {
    const payload = buildHotelProposalPayload({
      ...baseResult,
      price: "$987.65",
      pricePerNight: "€123,45",
      location: "Rome, Italy",
    });

    const requestBody = buildAdHocHotelProposalRequestBody(payload, {
      tripId: 42,
    });

    expect(requestBody.totalPrice).toBeCloseTo(987.65);
    expect(requestBody.pricePerNight).toBeCloseTo(123.45);
    expect(requestBody.address).toContain("Rome");
    expect(requestBody.city).toBe("Rome");
    expect(requestBody.country).toBe("Italy");
  });

  it("serializes date inputs to ISO strings when building the request", () => {
    const checkIn = new Date("2025-07-10T15:00:00Z");
    const checkOut = new Date("2025-07-15T11:00:00Z");

    const payload = buildHotelProposalPayload({
      ...baseResult,
      location: "Oslo, Norway",
    });

    const requestBody = buildAdHocHotelProposalRequestBody(
      { ...payload, checkInDate: checkIn, checkOutDate: checkOut },
      { tripId: 55 },
    );

    expect(requestBody.checkInDate).toBe(checkIn.toISOString());
    expect(requestBody.checkOutDate).toBe(checkOut.toISOString());
  });
});
