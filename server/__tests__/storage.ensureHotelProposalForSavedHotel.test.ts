import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

describe("DatabaseStorage.ensureHotelProposalForSavedHotel", () => {
  let queryMock: jest.Mock;
  let clientQueryMock: jest.Mock;
  let clientReleaseMock: jest.Mock;
  let poolConnectMock: jest.Mock;
  let storage: typeof import("../storage").storage;

  beforeEach(async () => {
    jest.resetModules();
    queryMock = jest.fn();
    clientQueryMock = jest.fn();
    clientReleaseMock = jest.fn();
    poolConnectMock = jest.fn().mockResolvedValue({
      query: clientQueryMock,
      release: clientReleaseMock,
    });

    jest.doMock("../db", () => ({
      query: queryMock,
      pool: {
        connect: poolConnectMock,
        query: jest.fn(),
        end: jest.fn(),
      },
    }));

    ({ storage } = await import("../storage"));
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("coerces string trip ids before validating ownership", async () => {
    const now = new Date("2024-06-01T12:00:00Z");

    const hotelRow = {
      id: 55,
      trip_id: "10",
      user_id: "user-123",
      hotel_name: "Lakeside Lodge",
      hotel_chain: null,
      hotel_rating: "4.5",
      address: "500 River Rd",
      city: "Portland",
      country: "USA",
      zip_code: "97201",
      latitude: null,
      longitude: null,
      check_in_date: now,
      check_out_date: now,
      room_type: null,
      room_count: null,
      guest_count: null,
      booking_reference: null,
      total_price: "600",
      price_per_night: "150",
      currency: "USD",
      status: "confirmed",
      booking_source: null,
      purchase_url: null,
      amenities: null,
      images: null,
      policies: null,
      contact_info: null,
      booking_platform: null,
      booking_url: null,
      cancellation_policy: null,
      notes: null,
      created_at: now,
      updated_at: now,
      trip_created_by: "user-123",
      trip_name: "Lake Trip",
    };

    clientQueryMock
      // BEGIN
      .mockResolvedValueOnce({ rows: [] })
      // Load hotel row with trip metadata
      .mockResolvedValueOnce({ rows: [hotelRow] })
      // Membership lookup
      .mockResolvedValueOnce({ rows: [{ role: "member" }] })
      // Existing proposal link check
      .mockResolvedValueOnce({ rows: [] })
      // Insert hotel proposal
      .mockResolvedValueOnce({ rows: [{ id: 200 }] })
      // Insert proposal schedule link
      .mockResolvedValueOnce({ rows: [] })
      // Trip members for notifications (current user only)
      .mockResolvedValueOnce({ rows: [{ user_id: "user-123" }] })
      // COMMIT
      .mockResolvedValueOnce({ rows: [] });

    queryMock
      // ensureProposalLinkStructures -> CREATE TABLE
      .mockResolvedValueOnce({ rows: [] })
      // ensureProposalLinkStructures -> CREATE INDEX
      .mockResolvedValueOnce({ rows: [] })
      // Fetch proposal with proposer details
      .mockResolvedValueOnce({
        rows: [
          {
            id: 200,
            trip_id: 10,
            proposed_by: "user-123",
            hotel_name: "Lakeside Lodge",
            location: "Portland, USA",
            price: "600",
            price_per_night: "150",
            rating: "4.5",
            amenities: null,
            platform: "Manual Save",
            booking_url: "",
            status: "proposed",
            average_ranking: null,
            created_at: now,
            updated_at: now,
            linked_hotel_id: 55,
            linked_check_in_date: now,
            linked_check_out_date: now,
            linked_address: "500 River Rd",
            linked_city: "Portland",
            linked_country: "USA",
            linked_currency: "USD",
            proposer_id: "user-123",
            proposer_email: "host@example.com",
            proposer_username: null,
            proposer_first_name: "Host",
            proposer_last_name: "User",
            proposer_phone_number: null,
            proposer_password_hash: null,
            proposer_profile_image_url: null,
            proposer_cashapp_username: null,
            proposer_cash_app_username: null,
            proposer_cashapp_phone: null,
            proposer_cash_app_phone: null,
            proposer_venmo_username: null,
            proposer_venmo_phone: null,
            proposer_timezone: null,
            proposer_default_location: null,
            proposer_default_location_code: null,
            proposer_default_city: null,
            proposer_default_country: null,
            proposer_auth_provider: null,
            proposer_notification_preferences: null,
            proposer_has_seen_home_onboarding: false,
            proposer_has_seen_trip_onboarding: false,
            proposer_created_at: now,
            proposer_updated_at: now,
          },
        ],
      })
      // Fetch proposal rankings (none yet)
      .mockResolvedValueOnce({ rows: [] });

    const result = await storage.ensureHotelProposalForSavedHotel({
      hotelId: 55,
      tripId: 10,
      currentUserId: "user-123",
    });

    expect(clientQueryMock).toHaveBeenCalledWith(expect.stringContaining("FROM hotels"), [55]);
    expect(result).toEqual(
      expect.objectContaining({
        stayId: 55,
        wasCreated: true,
        proposal: expect.objectContaining({
          id: 200,
          tripId: 10,
          hotelName: "Lakeside Lodge",
        }),
      }),
    );
  });
});

