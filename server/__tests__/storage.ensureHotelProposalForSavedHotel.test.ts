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
      trip_start_date: now,
      trip_end_date: now,
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
      overrideDetails: undefined,
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

  it("repairs missing trip references before creating proposals", async () => {
    const now = new Date("2024-06-03T12:00:00Z");

    const hotelRow = {
      id: 77,
      trip_id: null,
      user_id: "user-abc",
      hotel_name: "Harbor View",
      hotel_chain: null,
      hotel_rating: "4.5",
      address: "123 Ocean Ave",
      city: "San Diego",
      country: "USA",
      zip_code: "92101",
      latitude: null,
      longitude: null,
      check_in_date: now,
      check_out_date: now,
      room_type: null,
      room_count: null,
      guest_count: null,
      booking_reference: null,
      total_price: "900",
      price_per_night: "300",
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
      trip_created_by: "user-abc",
      trip_name: "Harbor Escape",
      trip_start_date: now,
      trip_end_date: now,
    };

    clientQueryMock
      // BEGIN
      .mockResolvedValueOnce({ rows: [] })
      // Load hotel row with trip metadata
      .mockResolvedValueOnce({ rows: [hotelRow] })
      // Backfill missing trip id
      .mockResolvedValueOnce({ rows: [] })
      // Membership lookup
      .mockResolvedValueOnce({ rows: [{ role: "member" }] })
      // Existing proposal link check
      .mockResolvedValueOnce({ rows: [] })
      // Insert hotel proposal
      .mockResolvedValueOnce({ rows: [{ id: 305 }] })
      // Insert proposal schedule link
      .mockResolvedValueOnce({ rows: [] })
      // Trip members for notifications (current user only)
      .mockResolvedValueOnce({ rows: [{ user_id: "user-abc" }] })
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
            id: 305,
            trip_id: 10,
            proposed_by: "user-abc",
            hotel_name: "Harbor View",
            location: "San Diego, USA",
            price: "900",
            price_per_night: "300",
            rating: "4.5",
            amenities: null,
            platform: "Manual Save",
            booking_url: "",
            status: "proposed",
            average_ranking: null,
            created_at: now,
            updated_at: now,
            linked_hotel_id: 77,
            linked_check_in_date: now,
            linked_check_out_date: now,
            linked_address: "123 Ocean Ave",
            linked_city: "San Diego",
            linked_country: "USA",
            linked_currency: "USD",
            proposer_id: "user-abc",
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
      hotelId: 77,
      tripId: 10,
      currentUserId: "user-abc",
    });

    expect(clientQueryMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("UPDATE hotels SET trip_id"),
      [10, 77],
    );
    expect(result).toEqual(
      expect.objectContaining({
        stayId: 77,
        wasCreated: true,
        proposal: expect.objectContaining({ tripId: 10, hotelName: "Harbor View" }),
      }),
    );
  });

  it("allows stay creators to propose even when email casing differs", async () => {
    const now = new Date("2024-06-02T12:00:00Z");

    const hotelRow = {
      id: 55,
      trip_id: 10,
      user_id: "Host@Example.com",
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
      trip_created_by: "Owner@example.com",
      trip_name: "Lake Trip",
      trip_start_date: now,
      trip_end_date: now,
    };

    clientQueryMock
      // BEGIN
      .mockResolvedValueOnce({ rows: [] })
      // Load hotel row with trip metadata
      .mockResolvedValueOnce({ rows: [hotelRow] })
      // Membership lookup (not currently a member)
      .mockResolvedValueOnce({ rows: [] })
      // Existing proposal link check
      .mockResolvedValueOnce({ rows: [] })
      // Insert hotel proposal
      .mockResolvedValueOnce({ rows: [{ id: 201 }] })
      // Insert proposal schedule link
      .mockResolvedValueOnce({ rows: [] })
      // Trip members for notifications (none)
      .mockResolvedValueOnce({ rows: [] })
      // Proposer details for notification copy
      .mockResolvedValueOnce({
        rows: [
          {
            first_name: "Host",
            last_name: "User",
            username: null,
            email: "Host@Example.com",
          },
        ],
      })
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
            id: 201,
            trip_id: 10,
            proposed_by: "Host@Example.com",
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
            proposer_id: "host@example.com",
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
      .mockResolvedValueOnce({ rows: [] })
      // Notification insert for trip owner
      .mockResolvedValueOnce({
        rows: [
          {
            id: 500,
            user_id: "owner@example.com",
            type: "proposal-hotel-created",
            title: "Host User proposed Lakeside Lodge",
            message: "Host User shared Lakeside Lodge.",
            trip_id: 10,
            activity_id: null,
            expense_id: null,
            is_read: false,
            created_at: now,
          },
        ],
      });

    const result = await storage.ensureHotelProposalForSavedHotel({
      hotelId: 55,
      tripId: 10,
      currentUserId: "host@example.com",
      overrideDetails: undefined,
    });

    expect(result).toEqual(
      expect.objectContaining({
        stayId: 55,
        wasCreated: true,
        proposal: expect.objectContaining({
          id: 201,
          tripId: 10,
          hotelName: "Lakeside Lodge",
          proposedBy: "Host@Example.com",
        }),
      }),
    );
  });

  it("fills missing stay details from override payload before creating a proposal", async () => {
    const now = new Date("2024-06-04T10:00:00Z");

    const incompleteHotelRow = {
      id: 99,
      trip_id: 10,
      user_id: "user-123",
      hotel_name: "",
      hotel_chain: null,
      hotel_rating: null,
      address: "   ",
      city: "",
      country: "",
      zip_code: null,
      latitude: null,
      longitude: null,
      check_in_date: null,
      check_out_date: null,
      room_type: null,
      room_count: null,
      guest_count: null,
      booking_reference: null,
      total_price: null,
      price_per_night: null,
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
      trip_created_by: "owner@example.com",
      trip_name: "City Escape",
      trip_start_date: now,
      trip_end_date: new Date(now.getTime() + 86400000),
    };

    const refreshedHotelRow = {
      ...incompleteHotelRow,
      hotel_name: "Downtown Suites",
      address: "400 Market St",
      city: "San Francisco",
      country: "USA",
      check_in_date: now,
      check_out_date: new Date(now.getTime() + 86400000),
    };

    clientQueryMock
      // BEGIN
      .mockResolvedValueOnce({ rows: [] })
      // Initial load
      .mockResolvedValueOnce({ rows: [incompleteHotelRow] })
      // Membership lookup
      .mockResolvedValueOnce({ rows: [{ role: "member" }] })
      // Update with override details
      .mockResolvedValueOnce({ rows: [] })
      // Reload with refreshed values
      .mockResolvedValueOnce({ rows: [refreshedHotelRow] })
      // Existing proposal link check
      .mockResolvedValueOnce({ rows: [] })
      // Insert hotel proposal
      .mockResolvedValueOnce({ rows: [{ id: 321 }] })
      // Insert proposal schedule link
      .mockResolvedValueOnce({ rows: [] })
      // Trip members for notifications
      .mockResolvedValueOnce({ rows: [{ user_id: "owner@example.com" }] })
      // Proposer details
      .mockResolvedValueOnce({
        rows: [
          {
            first_name: "Casey",
            last_name: "Traveler",
            username: null,
            email: "user-123",
          },
        ],
      })
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
            id: 321,
            trip_id: 10,
            proposed_by: "user-123",
            hotel_name: "Downtown Suites",
            location: "San Francisco, USA",
            price: "0",
            price_per_night: null,
            rating: null,
            amenities: null,
            platform: "Manual Save",
            booking_url: "",
            status: "proposed",
            average_ranking: null,
            created_at: now,
            updated_at: now,
            linked_hotel_id: 99,
            linked_check_in_date: now,
            linked_check_out_date: new Date(now.getTime() + 86400000),
            linked_address: "400 Market St",
            linked_city: "San Francisco",
            linked_country: "USA",
            linked_currency: "USD",
            proposer_id: "user-123",
            proposer_email: "user-123",
            proposer_username: null,
            proposer_first_name: "Casey",
            proposer_last_name: "Traveler",
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
      // Fetch rankings (none)
      .mockResolvedValueOnce({ rows: [] })
      // Notification insert
      .mockResolvedValueOnce({
        rows: [
          {
            id: 888,
            user_id: "owner@example.com",
            type: "proposal-hotel-created",
            title: "Casey Traveler proposed Downtown Suites",
            message: "Casey Traveler shared Downtown Suites (Jun 4 – Jun 5).",
            trip_id: 10,
            activity_id: null,
            expense_id: null,
            is_read: false,
            created_at: now,
          },
        ],
      });

    const result = await storage.ensureHotelProposalForSavedHotel({
      hotelId: 99,
      tripId: 10,
      currentUserId: "user-123",
      overrideDetails: {
        hotelName: "Downtown Suites",
        address: "400 Market St",
        city: "San Francisco",
        country: "USA",
        checkInDate: now,
        checkOutDate: new Date(now.getTime() + 86400000),
      },
    });

    expect(clientQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE hotels SET"),
      expect.any(Array),
    );

    expect(result).toEqual(
      expect.objectContaining({
        stayId: 99,
        wasCreated: true,
        proposal: expect.objectContaining({
          hotelName: "Downtown Suites",
          city: "San Francisco",
          country: "USA",
        }),
      }),
    );
  });

  it("falls back to placeholder details when the saved stay is incomplete", async () => {
    const now = new Date("2024-06-05T08:00:00Z");

    const minimalHotelRow = {
      id: 77,
      trip_id: 10,
      user_id: "user-123",
      hotel_name: "",
      hotel_chain: null,
      hotel_rating: null,
      address: "",
      city: "",
      country: "",
      zip_code: null,
      latitude: null,
      longitude: null,
      check_in_date: null,
      check_out_date: null,
      room_type: null,
      room_count: null,
      guest_count: null,
      booking_reference: null,
      total_price: null,
      price_per_night: null,
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
      trip_created_by: "owner@example.com",
      trip_name: "Mystery Trip",
      trip_start_date: now,
      trip_end_date: new Date(now.getTime() + 86400000),
    };

    const refreshedRow = {
      ...minimalHotelRow,
      hotel_name: "Saved stay",
      address: "Address to be provided",
      city: "Mystery Trip",
      country: "Country to be decided",
      check_in_date: now,
      check_out_date: new Date(now.getTime() + 86400000),
    };

    clientQueryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [minimalHotelRow] }) // initial load
      .mockResolvedValueOnce({ rows: [{ role: "member" }] }) // membership lookup
      .mockResolvedValueOnce({ rows: [] }) // update
      .mockResolvedValueOnce({ rows: [refreshedRow] }) // refreshed row
      .mockResolvedValueOnce({ rows: [] }) // existing link check
      .mockResolvedValueOnce({ rows: [{ id: 412 }] }) // insert proposal
      .mockResolvedValueOnce({ rows: [] }) // insert link
      .mockResolvedValueOnce({ rows: [] }) // trip members
      .mockResolvedValueOnce({
        rows: [
          {
            first_name: "User",
            last_name: "Example",
            username: null,
            email: "user-123",
          },
        ],
      }) // proposer details
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 412,
            trip_id: 10,
            proposed_by: "user-123",
            hotel_name: "Saved stay",
            location: "Mystery Trip, Country to be decided",
            price: "0",
            price_per_night: null,
            rating: null,
            amenities: null,
            platform: "Manual Save",
            booking_url: "",
            status: "proposed",
            average_ranking: null,
            created_at: now,
            updated_at: now,
            linked_hotel_id: 77,
            linked_check_in_date: now,
            linked_check_out_date: new Date(now.getTime() + 86400000),
            linked_address: "Address to be provided",
            linked_city: "Mystery Trip",
            linked_country: "Country to be decided",
            linked_currency: "USD",
            proposer_id: "user-123",
            proposer_email: "user-123",
            proposer_username: null,
            proposer_first_name: "User",
            proposer_last_name: "Example",
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
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 999,
            user_id: "owner@example.com",
            type: "proposal-hotel-created",
            title: "User Example proposed Saved stay",
            message: "User Example shared Saved stay (Jun 5 – Jun 6).",
            trip_id: 10,
            activity_id: null,
            expense_id: null,
            is_read: false,
            created_at: now,
          },
        ],
      });

    const result = await storage.ensureHotelProposalForSavedHotel({
      hotelId: 77,
      tripId: 10,
      currentUserId: "user-123",
      overrideDetails: undefined,
    });

    expect(result.proposal.hotelName).toBe("Saved stay");
    expect(result.proposal.address).toBe("Address to be provided");
    expect(result.proposal.city).toBe("Mystery Trip");
    expect(result.proposal.country).toBe("Country to be decided");
  });

  it("coerces trip date strings when filling missing stay dates", async () => {
    const nowIso = "2024-06-07T12:00:00.000Z";
    const laterIso = "2024-06-10T12:00:00.000Z";

    const hotelRow = {
      id: 88,
      trip_id: 10,
      user_id: "user-123",
      hotel_name: "",
      hotel_chain: null,
      hotel_rating: null,
      address: "",
      city: "",
      country: "",
      zip_code: null,
      latitude: null,
      longitude: null,
      check_in_date: null,
      check_out_date: null,
      room_type: null,
      room_count: null,
      guest_count: null,
      booking_reference: null,
      total_price: null,
      price_per_night: null,
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
      created_at: new Date(nowIso),
      updated_at: new Date(nowIso),
      trip_created_by: "owner@example.com",
      trip_name: "Summer Trip",
      trip_start_date: nowIso,
      trip_end_date: laterIso,
    };

    const refreshedRow = {
      ...hotelRow,
      hotel_name: "Saved stay",
      address: "Address to be provided",
      city: "Summer Trip",
      country: "Country to be decided",
      check_in_date: new Date(nowIso),
      check_out_date: new Date(laterIso),
    };

    clientQueryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [hotelRow] }) // initial load
      .mockResolvedValueOnce({ rows: [{ role: "member" }] }) // membership
      .mockResolvedValueOnce({ rows: [] }) // update missing fields
      .mockResolvedValueOnce({ rows: [refreshedRow] }) // refreshed row with dates filled
      .mockResolvedValueOnce({ rows: [] }) // existing link check
      .mockResolvedValueOnce({ rows: [{ id: 900 }] }) // insert proposal
      .mockResolvedValueOnce({ rows: [] }) // insert link
      .mockResolvedValueOnce({ rows: [{ user_id: "owner@example.com" }] }) // trip members
      .mockResolvedValueOnce({
        rows: [
          {
            first_name: "Casey",
            last_name: "Traveler",
            username: null,
            email: "user-123",
          },
        ],
      }) // proposer details
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    queryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 900,
            trip_id: 10,
            proposed_by: "user-123",
            hotel_name: "Saved stay",
            location: "Summer Trip, Country to be decided",
            price: "0",
            price_per_night: null,
            rating: null,
            amenities: null,
            platform: "Manual Save",
            booking_url: "",
            status: "proposed",
            average_ranking: null,
            created_at: new Date(nowIso),
            updated_at: new Date(nowIso),
            linked_hotel_id: 88,
            linked_check_in_date: new Date(nowIso),
            linked_check_out_date: new Date(laterIso),
            linked_address: "Address to be provided",
            linked_city: "Summer Trip",
            linked_country: "Country to be decided",
            linked_currency: "USD",
            proposer_id: "user-123",
            proposer_email: "user-123",
            proposer_username: null,
            proposer_first_name: "Casey",
            proposer_last_name: "Traveler",
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
            proposer_created_at: new Date(nowIso),
            proposer_updated_at: new Date(nowIso),
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 111,
            user_id: "owner@example.com",
            type: "proposal-hotel-created",
            title: "Casey Traveler proposed Saved stay",
            message: "Casey Traveler shared Saved stay (Jun 7 – Jun 10).",
            trip_id: 10,
            activity_id: null,
            expense_id: null,
            is_read: false,
            created_at: new Date(nowIso),
          },
        ],
      });

    const result = await storage.ensureHotelProposalForSavedHotel({
      hotelId: 88,
      tripId: 10,
      currentUserId: "user-123",
      overrideDetails: undefined,
    });

    expect(result.proposal.checkInDate).toEqual(new Date(nowIso));
    expect(result.proposal.checkOutDate).toEqual(new Date(laterIso));
  });

  it("logs and continues when notification creation fails", async () => {
    const now = new Date("2024-06-06T09:00:00Z");

    const hotelRow = {
      id: 77,
      trip_id: 10,
      user_id: "host@example.com",
      hotel_name: "Harbor View",
      hotel_chain: null,
      hotel_rating: "4.2",
      address: "55 Dock St",
      city: "Seattle",
      country: "USA",
      zip_code: "98101",
      latitude: null,
      longitude: null,
      check_in_date: now,
      check_out_date: new Date(now.getTime() + 86400000),
      room_type: null,
      room_count: null,
      guest_count: null,
      booking_reference: null,
      total_price: "800",
      price_per_night: "200",
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
      trip_created_by: "owner@example.com",
      trip_name: "Coastal Escape",
      trip_start_date: now,
      trip_end_date: new Date(now.getTime() + 86400000),
    };

    clientQueryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [hotelRow] }) // Load hotel row
      .mockResolvedValueOnce({ rows: [{ role: "member" }] }) // membership
      .mockResolvedValueOnce({ rows: [] }) // existing proposal link check
      .mockResolvedValueOnce({ rows: [{ id: 555 }] }) // insert proposal
      .mockResolvedValueOnce({ rows: [] }) // insert link
      .mockResolvedValueOnce({ rows: [{ user_id: "owner@example.com" }] }) // trip members
      .mockResolvedValueOnce({
        rows: [
          {
            first_name: "Harper",
            last_name: "Lee",
            username: null,
            email: "host@example.com",
          },
        ],
      }) // proposer details
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    const notificationError = new Error("insert failed");

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // ensureProposalLinkStructures -> CREATE TABLE
      .mockResolvedValueOnce({ rows: [] }) // ensureProposalLinkStructures -> CREATE INDEX
      .mockResolvedValueOnce({
        rows: [
          {
            id: 555,
            trip_id: 10,
            proposed_by: "host@example.com",
            hotel_name: "Harbor View",
            location: "Seattle, USA",
            price: "800",
            price_per_night: "200",
            rating: "4.2",
            amenities: null,
            platform: "Manual Save",
            booking_url: "",
            status: "proposed",
            average_ranking: null,
            created_at: now,
            updated_at: now,
            linked_hotel_id: 77,
            linked_check_in_date: now,
            linked_check_out_date: new Date(now.getTime() + 86400000),
            linked_address: "55 Dock St",
            linked_city: "Seattle",
            linked_country: "USA",
            linked_currency: "USD",
            proposer_id: "host@example.com",
            proposer_email: "host@example.com",
            proposer_username: null,
            proposer_first_name: "Harper",
            proposer_last_name: "Lee",
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
      .mockResolvedValueOnce({ rows: [] }) // fetch rankings
      .mockRejectedValueOnce(notificationError); // notification insert fails

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await storage.ensureHotelProposalForSavedHotel({
      hotelId: 77,
      tripId: 10,
      currentUserId: "host@example.com",
      overrideDetails: undefined,
    });

    expect(result.proposal.hotelName).toBe("Harbor View");
    expect(result.wasCreated).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to send hotel proposal notifications:",
      notificationError,
    );

    consoleErrorSpy.mockRestore();
  });
});

