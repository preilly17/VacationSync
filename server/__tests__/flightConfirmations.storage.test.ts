import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/test";

const queryMock = jest.fn();

let storageModule: typeof import("../storage");
let storage: typeof import("../storage")["storage"];
let dbQuerySpy: jest.SpiedFunction<typeof import("../db")["query"]>;
let poolConnectSpy: jest.SpiedFunction<typeof import("../db")["pool"]["connect"]>;
let mockClient: { query: typeof queryMock; release: jest.Mock };

beforeAll(async () => {
  jest.resetModules();
  const dbModule: any = await import("../db");
  dbQuerySpy = jest.spyOn(dbModule, "query").mockImplementation(queryMock as any);
  poolConnectSpy = jest.spyOn(dbModule.pool, "connect");
  storageModule = await import("../storage");
  storage = storageModule.storage;
});

beforeEach(() => {
  queryMock.mockReset();
  dbQuerySpy.mockImplementation(queryMock as any);
  mockClient = {
    query: queryMock,
    release: jest.fn(),
  } as any;
  poolConnectSpy.mockResolvedValue(mockClient as any);

  (storage as any).flightAttendanceInitialized = true;
  (storage as any).flightConfirmationInitialized = true;
  (storage as any).calendarEventsInitialized = true;
});

describe("confirmFlightWithAttendees", () => {
  it("adds attendees and calendar events for confirmed flights", async () => {
    const flightRow = {
      id: 7,
      trip_id: 77,
      user_id: "creator",
      confirmed_at: null,
      confirmed_by_user_id: null,
      flight_number: "4211",
      airline: "Frontier",
      airline_code: "F9",
      departure_airport: "Atlanta",
      departure_code: "ATL",
      departure_time: new Date("2025-01-12T10:00:00Z"),
      departure_terminal: null,
      departure_gate: null,
      arrival_airport: "Austin",
      arrival_code: "AUS",
      arrival_time: new Date("2025-01-12T13:00:00Z"),
      arrival_terminal: null,
      arrival_gate: null,
      booking_reference: null,
      seat_number: null,
      seat_class: null,
      price: null,
      points_cost: null,
      currency: "USD",
      flight_type: "outbound",
      status: "draft",
      layovers: null,
      booking_source: "manual",
      purchase_url: null,
      aircraft: null,
      flight_duration: null,
      baggage: null,
      created_at: new Date("2025-01-01T00:00:00Z"),
      updated_at: new Date("2025-01-01T00:00:00Z"),
    };

    const confirmedFlight = {
      id: 7,
      tripId: 77,
      userId: "creator",
      confirmedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
      confirmedByUserId: "creator",
      flightNumber: "4211",
      airline: "Frontier",
      airlineCode: "F9",
      departureAirport: "Atlanta",
      departureCode: "ATL",
      departureTime: new Date("2025-01-12T10:00:00Z").toISOString(),
      arrivalAirport: "Austin",
      arrivalCode: "AUS",
      arrivalTime: new Date("2025-01-12T13:00:00Z").toISOString(),
      bookingReference: null,
      seatNumber: null,
      seatClass: null,
      price: null,
      pointsCost: null,
      currency: "USD",
      flightType: "outbound",
      status: "confirmed",
      layovers: null,
      bookingSource: "manual",
      purchaseUrl: null,
      aircraft: null,
      flightDuration: null,
      baggage: null,
      createdAt: new Date("2025-01-01T00:00:00Z").toISOString(),
      updatedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
      attendees: [
        {
          id: 1,
          tripId: 77,
          flightId: 7,
          userId: "creator",
          addedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
          addedByUserId: "creator",
          user: { id: "creator" },
        },
        {
          id: 2,
          tripId: 77,
          flightId: 7,
          userId: "member-b",
          addedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
          addedByUserId: "creator",
          user: { id: "member-b" },
        },
      ],
      user: { id: "creator" },
      trip: { id: 77 },
    } as any;

    jest.spyOn(storage, "getTripFlights").mockResolvedValue([confirmedFlight]);

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // ensureTripTimezoneColumn
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [flightRow] }) // SELECT flight
      .mockResolvedValueOnce({ rows: [{ created_by: "creator", timezone: "UTC" }] }) // trip row
      .mockResolvedValueOnce({ rows: [{ user_id: "creator" }, { user_id: "member-b" }] }) // members
      .mockResolvedValueOnce({ rows: [] }) // existing attendees
      .mockResolvedValueOnce({ rows: [] }) // UPDATE flights
      .mockResolvedValueOnce({ rows: [] }) // DELETE attendees
      .mockResolvedValueOnce({ rows: [] }) // INSERT attendees
      .mockResolvedValueOnce({ rows: [] }) // INSERT calendar events
      .mockResolvedValueOnce({ rows: [] }) // UPDATE proposals
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await storage.confirmFlightWithAttendees({
      tripId: 77,
      flightId: 7,
      attendeeUserIds: ["member-b"],
      currentUserId: "creator",
      notify: true,
    });

    const insertAttendeesCall = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO flight_attendees"),
    );
    expect(insertAttendeesCall?.[1][3]).toEqual(["creator", "member-b"]);

    const insertCalendarCall = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes("INSERT INTO calendar_events"),
    );
    expect(insertCalendarCall?.[1][7]).toEqual(["creator", "member-b"]);
  });

  it("denies confirmation when requester is not the creator", async () => {
    const flightRow = {
      id: 8,
      trip_id: 88,
      user_id: "creator",
      confirmed_at: null,
      confirmed_by_user_id: null,
      flight_number: "9001",
      airline: "Delta",
      airline_code: "DL",
      departure_airport: "Atlanta",
      departure_code: "ATL",
      departure_time: new Date("2025-01-12T10:00:00Z"),
      departure_terminal: null,
      departure_gate: null,
      arrival_airport: "Austin",
      arrival_code: "AUS",
      arrival_time: new Date("2025-01-12T13:00:00Z"),
      arrival_terminal: null,
      arrival_gate: null,
      booking_reference: null,
      seat_number: null,
      seat_class: null,
      price: null,
      points_cost: null,
      currency: "USD",
      flight_type: "outbound",
      status: "draft",
      layovers: null,
      booking_source: "manual",
      purchase_url: null,
      aircraft: null,
      flight_duration: null,
      baggage: null,
      created_at: new Date("2025-01-01T00:00:00Z"),
      updated_at: new Date("2025-01-01T00:00:00Z"),
    };

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // ensureTripTimezoneColumn
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [flightRow] }) // SELECT flight
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(
      storage.confirmFlightWithAttendees({
        tripId: 88,
        flightId: 8,
        attendeeUserIds: [],
        currentUserId: "other-user",
        notify: false,
      }),
    ).rejects.toThrow("Only the creator");
  });

  it("uses an upsert for calendar events to prevent duplicates", async () => {
    const flightRow = {
      id: 9,
      trip_id: 90,
      user_id: "creator",
      confirmed_at: null,
      confirmed_by_user_id: null,
      flight_number: "100",
      airline: "United",
      airline_code: "UA",
      departure_airport: "Atlanta",
      departure_code: "ATL",
      departure_time: new Date("2025-01-12T10:00:00Z"),
      departure_terminal: null,
      departure_gate: null,
      arrival_airport: "Austin",
      arrival_code: "AUS",
      arrival_time: new Date("2025-01-12T13:00:00Z"),
      arrival_terminal: null,
      arrival_gate: null,
      booking_reference: null,
      seat_number: null,
      seat_class: null,
      price: null,
      points_cost: null,
      currency: "USD",
      flight_type: "outbound",
      status: "draft",
      layovers: null,
      booking_source: "manual",
      purchase_url: null,
      aircraft: null,
      flight_duration: null,
      baggage: null,
      created_at: new Date("2025-01-01T00:00:00Z"),
      updated_at: new Date("2025-01-01T00:00:00Z"),
    };

    jest.spyOn(storage, "getTripFlights").mockResolvedValue([
      {
        id: 9,
        tripId: 90,
        userId: "creator",
        flightNumber: "100",
        airline: "United",
        airlineCode: "UA",
        departureAirport: "Atlanta",
        departureCode: "ATL",
        departureTime: new Date("2025-01-12T10:00:00Z").toISOString(),
        arrivalAirport: "Austin",
        arrivalCode: "AUS",
        arrivalTime: new Date("2025-01-12T13:00:00Z").toISOString(),
        bookingReference: null,
        seatNumber: null,
        seatClass: null,
        price: null,
        pointsCost: null,
        currency: "USD",
        flightType: "outbound",
        status: "confirmed",
        layovers: null,
        bookingSource: "manual",
        purchaseUrl: null,
        aircraft: null,
        flightDuration: null,
        baggage: null,
        createdAt: new Date("2025-01-01T00:00:00Z").toISOString(),
        updatedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
        attendees: [],
        user: { id: "creator" },
        trip: { id: 90 },
      } as any,
    ]);

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // ensureTripTimezoneColumn
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [flightRow] }) // SELECT flight
      .mockResolvedValueOnce({ rows: [{ created_by: "creator", timezone: "UTC" }] }) // trip row
      .mockResolvedValueOnce({ rows: [{ user_id: "creator" }] }) // members
      .mockResolvedValueOnce({ rows: [] }) // existing attendees
      .mockResolvedValueOnce({ rows: [] }) // UPDATE flights
      .mockResolvedValueOnce({ rows: [] }) // DELETE attendees
      .mockResolvedValueOnce({ rows: [] }) // INSERT attendees
      .mockResolvedValueOnce({ rows: [] }) // INSERT calendar events
      .mockResolvedValueOnce({ rows: [] }) // UPDATE proposals
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await storage.confirmFlightWithAttendees({
      tripId: 90,
      flightId: 9,
      attendeeUserIds: [],
      currentUserId: "creator",
      notify: false,
    });

    const calendarInsertSql = queryMock.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.includes("INSERT INTO calendar_events"));
    expect(calendarInsertSql).toContain("ON CONFLICT");
  });
});

describe("removeSelfFromFlight", () => {
  it("removes attendee records and calendar events", async () => {
    const flightRow = {
      id: 10,
      trip_id: 91,
      user_id: "creator",
      confirmed_at: null,
      confirmed_by_user_id: null,
      flight_number: "200",
      airline: "Delta",
      airline_code: "DL",
      departure_airport: "Atlanta",
      departure_code: "ATL",
      departure_time: new Date("2025-01-12T10:00:00Z"),
      departure_terminal: null,
      departure_gate: null,
      arrival_airport: "Austin",
      arrival_code: "AUS",
      arrival_time: new Date("2025-01-12T13:00:00Z"),
      arrival_terminal: null,
      arrival_gate: null,
      booking_reference: null,
      seat_number: null,
      seat_class: null,
      price: null,
      points_cost: null,
      currency: "USD",
      flight_type: "outbound",
      status: "confirmed",
      layovers: null,
      booking_source: "manual",
      purchase_url: null,
      aircraft: null,
      flight_duration: null,
      baggage: null,
      created_at: new Date("2025-01-01T00:00:00Z"),
      updated_at: new Date("2025-01-01T00:00:00Z"),
    };

    jest.spyOn(storage, "getTripFlights").mockResolvedValue([
      {
        id: 10,
        tripId: 91,
        userId: "creator",
        flightNumber: "200",
        airline: "Delta",
        airlineCode: "DL",
        departureAirport: "Atlanta",
        departureCode: "ATL",
        departureTime: new Date("2025-01-12T10:00:00Z").toISOString(),
        arrivalAirport: "Austin",
        arrivalCode: "AUS",
        arrivalTime: new Date("2025-01-12T13:00:00Z").toISOString(),
        bookingReference: null,
        seatNumber: null,
        seatClass: null,
        price: null,
        pointsCost: null,
        currency: "USD",
        flightType: "outbound",
        status: "confirmed",
        layovers: null,
        bookingSource: "manual",
        purchaseUrl: null,
        aircraft: null,
        flightDuration: null,
        baggage: null,
        createdAt: new Date("2025-01-01T00:00:00Z").toISOString(),
        updatedAt: new Date("2025-01-01T00:00:00Z").toISOString(),
        attendees: [],
        user: { id: "creator" },
        trip: { id: 91 },
      } as any,
    ]);

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [flightRow] }) // SELECT flight
      .mockResolvedValueOnce({ rows: [{ created_by: "creator" }] }) // trip row
      .mockResolvedValueOnce({ rows: [{ user_id: "member-b" }] }) // member check
      .mockResolvedValueOnce({ rows: [{ id: 55 }] }) // attendee exists
      .mockResolvedValueOnce({ rows: [] }) // delete attendee
      .mockResolvedValueOnce({ rows: [] }) // delete calendar
      .mockResolvedValueOnce({ rows: [] }); // COMMIT

    await storage.removeSelfFromFlight(91, 10, "member-b");

    const deleteCalendarCall = queryMock.mock.calls.find(([sql]) =>
      String(sql).includes("DELETE FROM calendar_events"),
    );
    expect(deleteCalendarCall?.[1]).toEqual([91, 10, "member-b"]);
  });

  it("blocks removal when user is not an attendee", async () => {
    const flightRow = {
      id: 11,
      trip_id: 92,
      user_id: "creator",
      confirmed_at: null,
      confirmed_by_user_id: null,
      flight_number: "300",
      airline: "Delta",
      airline_code: "DL",
      departure_airport: "Atlanta",
      departure_code: "ATL",
      departure_time: new Date("2025-01-12T10:00:00Z"),
      departure_terminal: null,
      departure_gate: null,
      arrival_airport: "Austin",
      arrival_code: "AUS",
      arrival_time: new Date("2025-01-12T13:00:00Z"),
      arrival_terminal: null,
      arrival_gate: null,
      booking_reference: null,
      seat_number: null,
      seat_class: null,
      price: null,
      points_cost: null,
      currency: "USD",
      flight_type: "outbound",
      status: "confirmed",
      layovers: null,
      booking_source: "manual",
      purchase_url: null,
      aircraft: null,
      flight_duration: null,
      baggage: null,
      created_at: new Date("2025-01-01T00:00:00Z"),
      updated_at: new Date("2025-01-01T00:00:00Z"),
    };

    queryMock
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [flightRow] }) // SELECT flight
      .mockResolvedValueOnce({ rows: [{ created_by: "creator" }] }) // trip row
      .mockResolvedValueOnce({ rows: [{ user_id: "member-b" }] }) // member check
      .mockResolvedValueOnce({ rows: [] }) // attendee missing
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(storage.removeSelfFromFlight(92, 11, "member-b")).rejects.toThrow(
      "not an attendee",
    );
  });
});
