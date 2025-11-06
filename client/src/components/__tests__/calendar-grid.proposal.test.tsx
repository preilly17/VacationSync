import React from "react";
import { renderToString } from "react-dom/server";
import { CalendarGrid } from "../calendar-grid";
import type { ActivityWithDetails, TripWithDetails, User } from "@shared/schema";
import { TooltipProvider } from "@/components/ui/tooltip";

let useLayoutEffectSpy: jest.SpiedFunction<typeof React.useLayoutEffect>;

beforeAll(() => {
  useLayoutEffectSpy = jest
    .spyOn(React, "useLayoutEffect")
    .mockImplementation(React.useEffect);
});

afterAll(() => {
  useLayoutEffectSpy.mockRestore();
});

describe("CalendarGrid proposal handling", () => {
  it("renders proposals without a start time as Time TBD without epoch dates", () => {
    const user: User = {
      id: "user-1",
      email: "user@example.com",
      username: "tester",
      firstName: "Test",
      lastName: "User",
      phoneNumber: null,
      passwordHash: null,
      profileImageUrl: null,
      cashAppUsername: null,
      cashAppUsernameLegacy: null,
      cashAppPhone: null,
      cashAppPhoneLegacy: null,
      venmoUsername: null,
      venmoPhone: null,
      timezone: null,
      defaultLocation: null,
      defaultLocationCode: null,
      defaultCity: null,
      defaultCountry: null,
      authProvider: null,
      notificationPreferences: null,
      hasSeenHomeOnboarding: false,
      hasSeenTripOnboarding: false,
      createdAt: null,
      updatedAt: null,
    };

    const activity = {
      id: 1,
      tripCalendarId: 1,
      postedBy: user.id,
      name: "Sunset Cruise",
      description: null,
      startTime: null as unknown as string,
      endTime: null,
      location: "Harbor",
      cost: null,
      maxCapacity: null,
      category: "activities",
      status: "active",
      type: "PROPOSE" as ActivityWithDetails["type"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      poster: user,
      invites: [],
      acceptances: [],
      comments: [],
      acceptedCount: 0,
      pendingCount: 0,
      declinedCount: 0,
      waitlistedCount: 0,
      timeOptions: [
        new Date(Date.UTC(2024, 0, 15, 18, 0)),
      ] as unknown as string[],
    } as ActivityWithDetails & { timeOptions?: (string | Date)[] };

    const trip: TripWithDetails = {
      id: 1,
      name: "Demo Trip",
      destination: "Testville",
      startDate: new Date(Date.UTC(2024, 0, 1)).toISOString(),
      endDate: new Date(Date.UTC(2024, 0, 31)).toISOString(),
      shareCode: "share-code",
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      geonameId: null,
      cityName: null,
      countryName: null,
      latitude: null,
      longitude: null,
      population: null,
      coverImageUrl: null,
      coverPhotoUrl: null,
      coverPhotoCardUrl: null,
      coverPhotoThumbUrl: null,
      coverPhotoAlt: null,
      coverPhotoAttribution: null,
      coverPhotoStorageKey: null,
      coverPhotoOriginalUrl: null,
      coverPhotoFocalX: null,
      coverPhotoFocalY: null,
      coverPhotoUploadSize: null,
      coverPhotoUploadType: null,
      creator: user,
      members: [
        {
          id: 1,
          tripCalendarId: 1,
          userId: user.id,
          role: "member",
          departureLocation: null,
          departureAirport: null,
          joinedAt: null,
          user,
        },
      ],
      memberCount: 1,
    };

    const markup = renderToString(
      <TooltipProvider>
        <CalendarGrid
          currentMonth={new Date(Date.UTC(2024, 0, 1))}
          activities={[activity]}
          trip={trip}
          selectedDate={new Date(Date.UTC(2024, 0, 15))}
          currentUserId={user.id}
          highlightPersonalProposals
        />
      </TooltipProvider>,
    );

    const textContent = markup.replace(/<[^>]*>/g, " ");

    expect(textContent).not.toContain("Sunset Cruise");
    expect(textContent).not.toContain("Proposed");
    expect(textContent).not.toContain("TBD");
  });
});
