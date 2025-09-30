import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  differenceInCalendarDays,
  endOfYear,
  isBefore,
  parseISO,
  startOfDay,
  startOfYear,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import type { LastConversion } from "@/components/dashboard/converter-types";
import type { TripWithDetails } from "@shared/schema";
import {
  CalendarDays,
  CheckCircle2,
  Globe2,
  Plane,
  UserRound,
  MapPin,
} from "lucide-react";
import { Link } from "wouter";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  selectAllDestinationsUnique,
  selectNextTrip,
  selectUniqueTravelersThisYear,
  selectUpcomingTrips,
  isTripInactive,
} from "@/lib/dashboardSelectors";
import {
  TRIP_COVER_GRADIENT,
  buildCoverPhotoAltText,
  buildCoverPhotoSrcSet,
  useCoverPhotoImage,
} from "@/lib/tripCover";

import CurrencyConverterTool from "@/components/dashboard/currency-converter-tool";

const LAST_CONVERSION_KEY = "dashboard.converter.last";

const HERO_OVERLAY_GRADIENT =
  "linear-gradient(180deg, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.55))";

const MAX_UPCOMING_PREVIEW = 5;
const NEXT_TRIP_CHECKLIST = [
  "Confirm reservations",
  "Share itinerary",
  "Review packing list",
];

type ExpandedCardKey = "upcoming" | "destinations" | "next" | "travelers";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener("change", handler);
    setMatches(mediaQuery.matches);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

function toDateString(value: TripWithDetails["startDate"]): string {
  return typeof value === "string" ? value : value.toISOString();
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  const startFormatter = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  });

  const endFormatter = new Intl.DateTimeFormat(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });

  const yearFormatter = new Intl.DateTimeFormat(undefined, { year: "numeric" });

  const startPart = startFormatter.format(start);
  const endPart = endFormatter.format(end);

  if (sameYear) {
    return `${startPart}–${endPart}, ${yearFormatter.format(start)}`;
  }

  const startYear = yearFormatter.format(start);
  const endYear = yearFormatter.format(end);
  return `${startPart}, ${startYear} – ${endPart}${endPart.includes(endYear) ? "" : `, ${endYear}`}`;
}

function getCountdownLabel(startDate: string, endDate: string): string {
  const start = startOfDay(parseISO(startDate));
  const end = startOfDay(parseISO(endDate));
  const today = startOfDay(new Date());

  if (start.getTime() === today.getTime()) {
    return "Starts today";
  }

  if (start > today) {
    const diff = differenceInCalendarDays(start, today);
    if (diff === 1) {
      return "1 day to go";
    }
    return `${diff} days to go`;
  }

  if (today >= start && today <= end) {
    return "In progress";
  }

  const diffFromEnd = differenceInCalendarDays(today, end);
  if (diffFromEnd === 1) {
    return "Ended 1 day ago";
  }
  return `Ended ${diffFromEnd} days ago`;
}

function getTravelersLabel(count: number): string {
  return count === 1 ? "1 traveler" : `${count} travelers`;
}

function calculatePlanningProgress(trip: TripWithDetails): number {
  const invitesComplete = trip.members.every((member) => member.joinedAt);
  const start = parseISO(toDateString(trip.startDate));
  const today = startOfDay(new Date());
  const daysUntil = differenceInCalendarDays(start, today);

  let progress = 25;
  if (trip.memberCount > 1) {
    progress += 15;
  }
  if (invitesComplete) {
    progress += 20;
  }
  if (daysUntil <= 30) {
    progress += 15;
  }
  if (daysUntil <= 7) {
    progress += 10;
  }
  if (daysUntil <= 0) {
    progress += 10;
  }

  return Math.min(95, Math.max(progress, 20));
}

function buildTravelerData(
  members: TripWithDetails["members"],
): { avatar?: string | null; initial: string }[] {
  return members.map((member) => {
    const firstName = member.user.firstName?.trim();
    const email = member.user.email;
    const initial =
      firstName && firstName.length > 0
        ? firstName[0]!.toUpperCase()
        : email && email.length > 0
          ? email[0]!.toUpperCase()
          : "T";

    return {
      avatar: member.user.profileImageUrl,
      initial,
    };
  });
}

function getMemberDisplayName(
  user: TripWithDetails["members"][number]["user"],
): string {
  const first = user.firstName?.trim();
  const last = user.lastName?.trim();

  if (first && last) {
    return `${first} ${last}`;
  }

  if (first) {
    return first;
  }

  if (user.username?.trim()) {
    return user.username.trim();
  }

  return user.email ?? "Traveler";
}

function getMemberInitial(
  user: TripWithDetails["members"][number]["user"],
): string {
  const displayName = getMemberDisplayName(user);
  if (displayName && displayName.length > 0) {
    return displayName[0]!.toUpperCase();
  }
  const email = user.email ?? "";
  if (email.length > 0) {
    return email[0]!.toUpperCase();
  }
  return "T";
}

function loadLastConversion(): LastConversion | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(LAST_CONVERSION_KEY);
    if (!stored) {
      return null;
    }
    const parsed = JSON.parse(stored);
    if (!parsed) {
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn("Failed to parse last conversion", error);
    return null;
  }
}

function storeLastConversion(conversion: LastConversion) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(LAST_CONVERSION_KEY, JSON.stringify(conversion));
  } catch (error) {
    console.warn("Failed to store conversion", error);
  }
}

type TripSummary = {
  id: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelersCount: number;
  travelers: { avatar?: string | null; initial: string }[];
  progressPercent: number;
  coverImageUrl?: string | null;
  coverPhotoUrl?: string | null;
  coverPhotoCardUrl?: string | null;
  coverPhotoThumbUrl?: string | null;
  coverPhotoAlt?: string | null;
};

type Insight = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
};

type CompactUpcomingTrip = {
  id: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelersCount: number;
  progressPercent: number;
};

type DestinationSummary = {
  key: string;
  city: string;
  country: string | null;
  tripCount: number;
  nextTrip: TripWithDetails | null;
};

type TravelerTrip = {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
};

type TravelerSummaryRow = {
  id: string;
  name: string;
  avatar: string | null;
  initial: string;
  trips: TravelerTrip[];
};

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [lastConversion, setLastConversion] = useState<LastConversion | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const converterDialogId = useId();
  const upcomingCardRegionId = useId();
  const destinationsCardRegionId = useId();
  const nextTripCardRegionId = useId();
  const travelersCardRegionId = useId();
  const converterButtonRef = useRef<HTMLButtonElement | null>(null);
  const upcomingSectionRef = useRef<HTMLHeadingElement | null>(null);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [expandedCard, setExpandedCard] = useState<ExpandedCardKey | null>(null);
  const handleToggleCard = useCallback((card: ExpandedCardKey) => {
    setExpandedCard((current) => (current === card ? null : card));
  }, []);
  const handleScrollToUpcoming = useCallback(() => {
    upcomingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  const handleConverterVisibilityChange = useCallback(
    (open: boolean) => {
      setIsConverterOpen(open);
      if (!open) {
        converterButtonRef.current?.focus();
      }
    },
    [converterButtonRef, setIsConverterOpen],
  );
  const handleConverterClose = useCallback(() => {
    setIsConverterOpen(false);
    converterButtonRef.current?.focus();
  }, [converterButtonRef, setIsConverterOpen]);

  const handleOpenProfile = useCallback(() => {
    setLocation("/profile");
  }, [setLocation]);

  useEffect(() => {
    setLastConversion(loadLastConversion());
  }, []);

  const {
    data: trips,
    isLoading,
    error,
    refetch,
  } = useQuery<TripWithDetails[]>({
    queryKey: ["/api/trips"],
    enabled: Boolean(user),
    retry: false,
  });

  const today = startOfDay(new Date());

  const sortedTrips = useMemo(() => {
    const allTrips = trips ?? [];
    return [...allTrips].sort(
      (a, b) =>
        parseISO(toDateString(a.startDate)).getTime() -
        parseISO(toDateString(b.startDate)).getTime(),
    );
  }, [trips]);

  const upcomingTripsForDisplay = useMemo(
    () =>
      sortedTrips.filter(
        (trip) => !isBefore(parseISO(toDateString(trip.endDate)), today),
      ),
    [sortedTrips, today],
  );

  const primaryTrip = upcomingTripsForDisplay[0] ?? null;

  const upcomingTripsForStats = useMemo(
    () => selectUpcomingTrips(sortedTrips, today),
    [sortedTrips, today],
  );

  const nextTrip = useMemo(
    () => selectNextTrip(sortedTrips, today),
    [sortedTrips, today],
  );

  const uniqueDestinations = useMemo(
    () => selectAllDestinationsUnique(sortedTrips, today),
    [sortedTrips, today],
  );

  const travelersThisYear = useMemo(
    () => selectUniqueTravelersThisYear(sortedTrips, today),
    [sortedTrips, today],
  );

  const daysToNextTrip = useMemo(() => {
    if (!nextTrip) {
      return null;
    }
    const startDate = startOfDay(parseISO(toDateString(nextTrip.startDate)));
    return Math.max(0, differenceInCalendarDays(startDate, today));
  }, [nextTrip, today]);

  const upcomingSummaries: TripSummary[] = useMemo(() => {
    return upcomingTripsForDisplay.map((trip) => ({
      id: trip.id,
      name: trip.name || trip.destination,
      destination: trip.destination,
      startDate: toDateString(trip.startDate),
      endDate: toDateString(trip.endDate),
      travelersCount: trip.memberCount,
      travelers: buildTravelerData(trip.members),
      progressPercent: calculatePlanningProgress(trip),
      coverImageUrl: trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
      coverPhotoUrl: trip.coverPhotoUrl ?? null,
      coverPhotoCardUrl: trip.coverPhotoCardUrl ?? trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
      coverPhotoThumbUrl: trip.coverPhotoThumbUrl ?? trip.coverPhotoCardUrl ?? trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
      coverPhotoAlt: trip.coverPhotoAlt ?? undefined,
    }));
  }, [upcomingTripsForDisplay]);

  const upcomingPreviewTrips: CompactUpcomingTrip[] = useMemo(() => {
    return upcomingTripsForStats.slice(0, MAX_UPCOMING_PREVIEW).map((trip) => ({
      id: trip.id,
      name: trip.name || trip.destination,
      destination: trip.destination,
      startDate: toDateString(trip.startDate),
      endDate: toDateString(trip.endDate),
      travelersCount: trip.memberCount,
      progressPercent: calculatePlanningProgress(trip),
    }));
  }, [upcomingTripsForStats]);

  const destinationSummaries: DestinationSummary[] = useMemo(() => {
    const startYearBoundary = startOfYear(today);
    const endYearBoundary = endOfYear(today);
    const buckets = new Map<string, { city: string; country: string | null; trips: TripWithDetails[] }>();

    for (const trip of sortedTrips) {
      if (isTripInactive(trip)) {
        continue;
      }

      const tripStart = startOfDay(parseISO(toDateString(trip.startDate)));
      const tripEnd = startOfDay(parseISO(toDateString(trip.endDate)));
      const overlapsYear =
        tripEnd.getTime() >= startYearBoundary.getTime() &&
        tripStart.getTime() <= endYearBoundary.getTime();

      if (!overlapsYear) {
        continue;
      }

      const fallbackDestination = trip.destination?.trim() || "Destination TBD";
      const city = trip.cityName?.trim() || fallbackDestination;
      const country = trip.countryName?.trim() ?? null;
      const key = trip.geonameId
        ? `geo-${trip.geonameId}`
        : `${city.toLowerCase()}|${country?.toLowerCase() ?? fallbackDestination.toLowerCase()}`;

      if (!buckets.has(key)) {
        buckets.set(key, { city, country, trips: [] });
      }

      buckets.get(key)!.trips.push(trip);
    }

    return Array.from(buckets.entries())
      .map(([key, bucket]) => {
        const sortedByDate = bucket.trips
          .slice()
          .sort(
            (a, b) =>
              parseISO(toDateString(a.startDate)).getTime() -
              parseISO(toDateString(b.startDate)).getTime(),
          );

        const next =
          sortedByDate.find((trip) => {
            const start = startOfDay(parseISO(toDateString(trip.startDate)));
            return start.getTime() >= today.getTime();
          }) ?? sortedByDate[0] ?? null;

        return {
          key,
          city: bucket.city,
          country: bucket.country,
          tripCount: bucket.trips.length,
          nextTrip: next,
        } satisfies DestinationSummary;
      })
      .sort((a, b) => a.city.localeCompare(b.city));
  }, [sortedTrips, today]);

  const travelerSummaries: TravelerSummaryRow[] = useMemo(() => {
    const startYearBoundary = startOfYear(today);
    const endYearBoundary = endOfYear(today);
    const travelerMap = new Map<string, TravelerSummaryRow>();

    for (const trip of sortedTrips) {
      if (isTripInactive(trip)) {
        continue;
      }

      const tripStart = startOfDay(parseISO(toDateString(trip.startDate)));
      const tripEnd = startOfDay(parseISO(toDateString(trip.endDate)));
      const overlapsYear =
        tripEnd.getTime() >= startYearBoundary.getTime() &&
        tripStart.getTime() <= endYearBoundary.getTime();

      if (!overlapsYear) {
        continue;
      }

      const tripLabel = trip.name || trip.destination;

      for (const member of trip.members) {
        if (!member.userId || member.userId === user?.id || !member.user) {
          continue;
        }

        const tripEntry: TravelerTrip = {
          id: trip.id,
          name: tripLabel,
          startDate: toDateString(trip.startDate),
          endDate: toDateString(trip.endDate),
        };

        const existing = travelerMap.get(member.userId);

        if (existing) {
          if (!existing.trips.some((entry) => entry.id === tripEntry.id)) {
            existing.trips.push(tripEntry);
          }
          if (!existing.avatar && member.user.profileImageUrl) {
            existing.avatar = member.user.profileImageUrl;
          }
        } else {
          travelerMap.set(member.userId, {
            id: member.userId,
            name: getMemberDisplayName(member.user),
            avatar: member.user.profileImageUrl ?? null,
            initial: getMemberInitial(member.user),
            trips: [tripEntry],
          });
        }
      }
    }

    return Array.from(travelerMap.values())
      .map((entry) => ({
        ...entry,
        trips: entry.trips
          .slice()
          .sort(
            (a, b) =>
              parseISO(a.startDate).getTime() -
              parseISO(b.startDate).getTime(),
          ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sortedTrips, today, user?.id]);

  const statsLoading = isLoading && !trips;
  const isError = Boolean(error);
  const upcomingCount = upcomingTripsForStats.length;
  const destinationsCount = uniqueDestinations.size;
  const travelersCount = travelersThisYear.size;
  const isUpcomingExpanded = expandedCard === "upcoming";
  const isDestinationsExpanded = expandedCard === "destinations";
  const isNextTripExpanded = expandedCard === "next";
  const isTravelersExpanded = expandedCard === "travelers";

  const insights: Insight[] = useMemo(() => {
    if (!primaryTrip) {
      return [];
    }
    const base = `/trip/${primaryTrip.id}`;
    return [
      {
        id: "invite",
        title: "Invite your crew",
        description: "Make sure everyone is looped in before takeoff.",
        href: `${base}?view=members`,
        icon: "👥",
      },
      {
        id: "schedule",
        title: "Review day one",
        description: "Double-check the first day’s plans to start strong.",
        href: `${base}?view=activities`,
        icon: "🗓️",
      },
      {
        id: "expenses",
        title: "Track shared costs",
        description: "Peek at expenses so there are no surprises later.",
        href: `${base}?view=expenses`,
        icon: "💳",
      },
    ];
  }, [primaryTrip]);

  const nextTripChip = primaryTrip
    ? `Next up: ${primaryTrip.name || primaryTrip.destination} · ${formatDateRange(
        toDateString(primaryTrip.startDate),
        toDateString(primaryTrip.endDate),
      )}`
    : null;

  const heroCoverPhoto = primaryTrip?.coverImageUrl ?? primaryTrip?.coverPhotoUrl ?? null;
  const heroImageSrcSet = primaryTrip
    ? buildCoverPhotoSrcSet({
        full: primaryTrip.coverImageUrl ?? primaryTrip.coverPhotoUrl ?? null,
        card: primaryTrip.coverPhotoCardUrl ?? null,
        thumb: primaryTrip.coverPhotoThumbUrl ?? null,
      })
    : undefined;
  const heroAltText = primaryTrip
    ? buildCoverPhotoAltText(primaryTrip.name || primaryTrip.destination)
    : "Trip cover photo";
  const {
    showImage: showHeroCover,
    isLoaded: heroCoverLoaded,
    handleLoad: handleHeroCoverLoad,
    handleError: handleHeroCoverError,
  } = useCoverPhotoImage(heroCoverPhoto);

  const handlePlanTrip = useCallback(() => {
    setLocation("/trips/new");
  }, [setLocation]);

  const handleOpenTrip = useCallback(
    (tripId: number) => {
      setLocation(`/trip/${tripId}`);
    },
    [setLocation],
  );

  const handleInviteMore = useCallback(() => {
    if (nextTrip) {
      setLocation(`/trip/${nextTrip.id}/members`);
      return;
    }

    const fallbackTrip = upcomingTripsForStats[0];
    if (fallbackTrip) {
      setLocation(`/trip/${fallbackTrip.id}/members`);
      return;
    }

    setLocation("/trips/new");
  }, [nextTrip, upcomingTripsForStats, setLocation]);

  const handleConversionUpdate = (conversion: LastConversion) => {
    setLastConversion(conversion);
    storeLastConversion(conversion);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="mx-auto w-full max-w-[1240px] px-6 pb-20 pt-24">
        <div className="flex flex-col gap-8">
          <nav
            aria-label="Dashboard quick actions"
            className="rounded-full border border-slate-200/80 bg-white/90 px-4 py-2 text-sm shadow-sm backdrop-blur"
          >
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full px-4 text-sm font-medium text-slate-700 hover:text-slate-900"
                  onClick={() => setIsHowItWorksOpen(true)}
                >
                  How It Works
                </Button>
                <Button
                  ref={converterButtonRef}
                  type="button"
                  variant="ghost"
                  className="rounded-full px-4 text-sm font-medium text-slate-700 hover:text-slate-900"
                  onClick={() => handleConverterVisibilityChange(true)}
                  aria-controls={converterDialogId}
                  aria-expanded={isConverterOpen}
                  aria-haspopup="dialog"
                >
                  Currency Converter
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-full px-4 text-sm font-medium text-slate-700 hover:text-slate-900"
                  onClick={handleOpenProfile}
                >
                  Profile & Preferences
                </Button>
              </div>
            </div>
          </nav>

          <Dialog open={isHowItWorksOpen} onOpenChange={setIsHowItWorksOpen}>
            <DialogContent className="w-full max-w-xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl">
              <DialogHeader>
                <DialogTitle>How VacationSync Works</DialogTitle>
                <DialogDescription className="text-left">
                  VacationSync keeps your travel plans organized in one place. Plan new trips, invite your crew, and track every
                  detail from flights to activities with collaborative tools designed for effortless group travel.
                </DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>

          <Dialog open={isConverterOpen} onOpenChange={handleConverterVisibilityChange}>
            <DialogContent
              id={converterDialogId}
              className="w-full max-w-[560px] rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl"
            >
              <CurrencyConverterTool
                onClose={handleConverterClose}
                lastConversion={lastConversion}
                onConversion={handleConversionUpdate}
                mobile={!isDesktop}
                autoFocusAmount={isConverterOpen}
              />
            </DialogContent>
          </Dialog>

          <section
            aria-labelledby="dashboard-hero"
            className="relative overflow-hidden rounded-[32px] border border-white/20 bg-slate-900 p-8 text-white shadow-xl backdrop-blur-lg sm:p-12"
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: TRIP_COVER_GRADIENT }}
              aria-hidden="true"
            />
            {showHeroCover ? (
              <img
                src={heroCoverPhoto ?? undefined}
                srcSet={heroImageSrcSet}
                sizes="(max-width: 1024px) 100vw, 960px"
                alt={heroAltText}
                className={`pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                  heroCoverLoaded ? "opacity-100" : "opacity-0"
                }`}
                onLoad={handleHeroCoverLoad}
                onError={handleHeroCoverError}
                loading="eager"
                decoding="async"
              />
            ) : null}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: HERO_OVERLAY_GRADIENT }}
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-6">
              <div className="text-sm uppercase tracking-[0.2em] text-white/80">
                Your travel hub
              </div>
              <div className="flex flex-col gap-4">
                <div className="space-y-4">
                  <h1 id="dashboard-hero" className="text-4xl font-semibold sm:text-5xl">
                    Dashboard
                  </h1>
                  <p className="text-base text-white/80">
                    Plan new trips and see what’s next—all in one place.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handlePlanTrip}
                  className="rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] px-6 text-base font-semibold text-white shadow-lg transition-opacity hover:opacity-90"
                >
                  Plan a New Trip
                </Button>
                {nextTripChip ? (
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white/90">
                    {nextTripChip}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section
            aria-labelledby="dashboard-highlights"
            className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
          >
            <h2 id="dashboard-highlights" className="sr-only">
              Highlights
            </h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Plane className="h-5 w-5" aria-hidden="true" />}
                value={upcomingCount}
                label="Upcoming trips"
                description={upcomingCount === 0 ? "No trips planned" : undefined}
                ariaLabel={
                  upcomingCount === 0
                    ? "Show upcoming trips details"
                    : `Show details for ${upcomingCount} upcoming ${upcomingCount === 1 ? "trip" : "trips"}`
                }
                regionId={upcomingCardRegionId}
                regionLabel="Upcoming trips details"
                isLoading={statsLoading}
                isError={isError}
                onRetry={() => {
                  void refetch();
                }}
                isExpanded={isUpcomingExpanded}
                onToggle={() => handleToggleCard("upcoming")}
                renderExpanded={() => {
                  if (statsLoading) {
                    return (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={`upcoming-expanded-skeleton-${index}`}
                            className="space-y-2 rounded-xl border border-slate-200/60 bg-slate-50/60 p-4"
                          >
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="h-2 w-full rounded-full" />
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (upcomingPreviewTrips.length === 0) {
                    return (
                      <div className="space-y-4 text-sm text-slate-600">
                        <p>No upcoming trips yet. Plan a new trip.</p>
                        <Button
                          size="sm"
                          onClick={handlePlanTrip}
                          className="rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] px-4 text-white shadow-md transition-opacity hover:opacity-90"
                        >
                          Plan a New Trip
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        {upcomingPreviewTrips.map((trip) => (
                          <div
                            key={`upcoming-preview-${trip.id}`}
                            className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{trip.name}</p>
                                <p className="text-xs text-slate-500">
                                  {formatDateRange(trip.startDate, trip.endDate)}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleOpenTrip(trip.id)}
                                className="rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] px-4 text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                              >
                                Open trip
                              </Button>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <Badge className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                                {trip.destination}
                              </Badge>
                              <Badge className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                                {getTravelersLabel(trip.travelersCount)}
                              </Badge>
                            </div>
                            <div>
                              <Progress value={trip.progressPercent} className="h-2 rounded-full bg-slate-100" />
                              <p className="mt-1 text-xs text-slate-500">
                                Planning {trip.progressPercent}%
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleScrollToUpcoming}
                        className="text-sm font-semibold text-[#ff7e5f] transition hover:text-[#654ea3]"
                      >
                        View all trips
                      </button>
                    </div>
                  );
                }}
                testId="stat-upcoming"
              />
              <StatCard
                icon={<Globe2 className="h-5 w-5" aria-hidden="true" />}
                value={destinationsCount}
                label="Destinations"
                description={destinationsCount === 0 ? "Add your first destination" : undefined}
                ariaLabel={
                  destinationsCount === 0
                    ? "Show destination details"
                    : `Show ${destinationsCount} destination ${destinationsCount === 1 ? "detail" : "details"}`
                }
                regionId={destinationsCardRegionId}
                regionLabel="Destinations details"
                isLoading={statsLoading}
                isError={isError}
                onRetry={() => {
                  void refetch();
                }}
                isExpanded={isDestinationsExpanded}
                onToggle={() => handleToggleCard("destinations")}
                renderExpanded={() => {
                  if (statsLoading) {
                    return (
                      <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div
                            key={`destinations-skeleton-${index}`}
                            className="space-y-2 rounded-xl border border-slate-200/60 bg-slate-50/60 p-4"
                          >
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-3 w-2/3" />
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (destinationSummaries.length === 0) {
                    return <p className="text-sm text-slate-600">No destinations yet this year.</p>;
                  }

                  return (
                    <div className="space-y-3">
                      {destinationSummaries.map((destination) => (
                        <div
                          key={`destination-summary-${destination.key}`}
                          className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{destination.city}</p>
                              {destination.country ? (
                                <p className="text-xs text-slate-500">{destination.country}</p>
                              ) : null}
                            </div>
                            <Badge className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                              {destination.tripCount} {destination.tripCount === 1 ? "trip" : "trips"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {destination.nextTrip
                              ? `Next: ${formatDateRange(
                                  toDateString(destination.nextTrip.startDate),
                                  toDateString(destination.nextTrip.endDate),
                                )}`
                              : "Dates coming soon"}
                          </p>
                          {destination.nextTrip ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenTrip(destination.nextTrip!.id)}
                              className="self-start rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] px-4 text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                            >
                              Open trip
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                }}
                testId="stat-destinations"
              />
              <StatCard
                icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
                value={daysToNextTrip ?? "—"}
                label={nextTrip ? "Days to next trip" : "No upcoming trips"}
                ariaLabel={
                  nextTrip
                    ? `Show countdown for ${nextTrip.name || nextTrip.destination}`
                    : "Show details about the next trip status"
                }
                regionId={nextTripCardRegionId}
                regionLabel="Days to next trip details"
                isLoading={statsLoading}
                isError={isError}
                onRetry={() => {
                  void refetch();
                }}
                isExpanded={isNextTripExpanded}
                onToggle={() => handleToggleCard("next")}
                renderExpanded={() => {
                  if (statsLoading) {
                    return (
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                        <Skeleton className="h-2 w-full rounded-full" />
                      </div>
                    );
                  }

                  if (!nextTrip) {
                    return <p className="text-sm text-slate-600">No trips scheduled.</p>;
                  }

                  const startsToday = (daysToNextTrip ?? 0) === 0;
                  const travelerCountLabel = getTravelersLabel(
                    nextTrip.memberCount ?? nextTrip.members.length,
                  );

                  return (
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-lg font-semibold text-slate-900">
                          {startsToday ? "Trip starts today 🎉" : nextTrip.name || nextTrip.destination}
                        </p>
                        <p className="text-sm text-slate-500">
                          {startsToday
                            ? `${nextTrip.name || nextTrip.destination} · ${formatDateRange(
                                toDateString(nextTrip.startDate),
                                toDateString(nextTrip.endDate),
                              )}`
                            : `Starts in ${daysToNextTrip} ${
                                daysToNextTrip === 1 ? "day" : "days"
                              } (${formatDateRange(
                                toDateString(nextTrip.startDate),
                                toDateString(nextTrip.endDate),
                              )})`}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                          {startsToday
                            ? "Today"
                            : `${daysToNextTrip} ${daysToNextTrip === 1 ? "day" : "days"} to go`}
                        </Badge>
                        <Badge className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
                          {travelerCountLabel}
                        </Badge>
                      </div>
                      {!startsToday ? (
                        <div className="space-y-2">
                          <Progress
                            value={calculatePlanningProgress(nextTrip)}
                            className="h-2 rounded-full bg-slate-100"
                          />
                          <ul className="space-y-1.5 text-sm text-slate-600">
                            {NEXT_TRIP_CHECKLIST.map((item) => (
                              <li key={item} className="flex items-start gap-2">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#ff7e5f]" aria-hidden="true" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <Button
                        size="sm"
                        onClick={() => handleOpenTrip(nextTrip.id)}
                        className="rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] px-4 text-xs font-semibold text-white shadow-md transition-opacity hover:opacity-90"
                      >
                        Open trip
                      </Button>
                    </div>
                  );
                }}
                testId="stat-next-days"
              />
              <StatCard
                icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
                value={travelersCount}
                label="Travelers this year"
                description={travelersCount === 0 ? "Invite your crew" : undefined}
                ariaLabel={
                  travelersCount === 0
                    ? "Show traveler details"
                    : `Show details for ${travelersCount} travelers this year`
                }
                regionId={travelersCardRegionId}
                regionLabel="Travelers this year details"
                isLoading={statsLoading}
                isError={isError}
                onRetry={() => {
                  void refetch();
                }}
                isExpanded={isTravelersExpanded}
                onToggle={() => handleToggleCard("travelers")}
                renderExpanded={() => {
                  if (statsLoading) {
                    return (
                      <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, index) => (
                          <div
                            key={`travelers-skeleton-${index}`}
                            className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50/60 p-4"
                          >
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="flex-1 space-y-2">
                              <Skeleton className="h-4 w-1/2" />
                              <Skeleton className="h-3 w-2/3" />
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }

                  if (travelerSummaries.length === 0) {
                    return (
                      <div className="space-y-4 text-sm text-slate-600">
                        <p>No co-travelers yet. Invite someone.</p>
                        <Button
                          size="sm"
                          onClick={handleInviteMore}
                          className="rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] px-4 text-white shadow-md transition-opacity hover:opacity-90"
                        >
                          Invite more
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="space-y-3">
                        {travelerSummaries.map((traveler) => (
                          <div
                            key={`traveler-summary-${traveler.id}`}
                            className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm"
                          >
                            <Avatar className="h-10 w-10 border-2 border-white bg-slate-100">
                              <AvatarImage src={traveler.avatar ?? undefined} alt={traveler.name} loading="lazy" />
                              <AvatarFallback>{traveler.initial}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-2">
                              <p className="text-sm font-semibold text-slate-900">{traveler.name}</p>
                              <div className="flex flex-wrap gap-2">
                                {traveler.trips.map((trip) => (
                                  <div
                                    key={`traveler-${traveler.id}-trip-${trip.id}`}
                                    className="flex flex-wrap items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] text-slate-600"
                                  >
                                    <span className="font-medium text-slate-700">{trip.name}</span>
                                    <span className="text-slate-500">
                                      · {formatDateRange(trip.startDate, trip.endDate)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        onClick={handleInviteMore}
                        className="self-start rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] px-4 text-white shadow-md transition-opacity hover:opacity-90"
                      >
                        Invite more
                      </Button>
                    </div>
                  );
                }}
                testId="stat-travelers"
              />
            </div>
          </section>

          <section aria-labelledby="upcoming-trips-heading" className="space-y-6">
            <h2
              id="upcoming-trips-heading"
              ref={upcomingSectionRef}
              className="text-2xl font-semibold text-slate-900"
            >
              Upcoming trips
            </h2>

            {error ? (
              <Card className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-amber-900">
                We’re having trouble loading your trips right now. Try refreshing the page.
              </Card>
            ) : null}

            {isLoading ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Card
                    key={`trip-skeleton-${index}`}
                    className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                  >
                    <Skeleton className="aspect-video w-full rounded-xl" />
                    <div className="mt-4 space-y-2">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-4 w-1/2" />
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : upcomingSummaries.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {upcomingSummaries.map((trip) => (
                  <TripCard key={trip.id} trip={trip} onOpen={() => handleOpenTrip(trip.id)} />
                ))}
              </div>
            ) : (
              <Card className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
                <div className="text-5xl">🌅</div>
                <h3 className="text-2xl font-semibold text-slate-900">Ready for your next getaway?</h3>
                <p className="max-w-md text-sm text-slate-500">
                  Start planning a new adventure to see it appear here with all the essentials at a glance.
                </p>
                <Button
                  onClick={handlePlanTrip}
                  className="rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] px-6 text-white shadow-md transition-opacity hover:opacity-90"
                >
                  Plan a New Trip
                </Button>
              </Card>
            )}
          </section>

          {(insights.length > 0 || primaryTrip) && (
            <section aria-labelledby="insights-heading" className="space-y-6">
              <h2 id="insights-heading" className="text-2xl font-semibold text-slate-900">
                Helpful insights
              </h2>
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {insights.map((insight) => (
                  <Link key={insight.id} href={insight.href} className="group">
                    <Card className="flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-transform group-hover:-translate-y-1 group-hover:shadow-md">
                      <div className="space-y-3">
                        <span className="text-2xl" aria-hidden="true">
                          {insight.icon}
                        </span>
                        <h3 className="text-lg font-semibold text-slate-900">{insight.title}</h3>
                        <p className="text-sm text-slate-500">{insight.description}</p>
                      </div>
                      <span className="mt-6 text-sm font-semibold text-[#ff7e5f]">Go to trip →</span>
                    </Card>
                  </Link>
                ))}
                {primaryTrip ? (
                  <Card className="flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 text-left shadow-sm">
                    <div className="flex flex-col gap-3">
                      <span className="text-sm font-semibold uppercase tracking-wide text-slate-600">
                        Next destination
                      </span>
                      <h3 className="text-xl font-semibold text-slate-900">
                        {primaryTrip.name || primaryTrip.destination}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin className="h-4 w-4" />
                        {primaryTrip.destination}
                      </div>
                      <div className="text-sm text-slate-500">
                        {formatDateRange(
                          toDateString(primaryTrip.startDate),
                          toDateString(primaryTrip.endDate),
                        )}
                      </div>
                    </div>
                  </Card>
                ) : null}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

type TripCardProps = {
  trip: TripSummary;
  onOpen: () => void;
};

function TripCard({ trip, onOpen }: TripCardProps) {
  const cardImageSrc = trip.coverPhotoCardUrl ?? trip.coverImageUrl ?? trip.coverPhotoUrl ?? null;
  const cardImageSrcSet = buildCoverPhotoSrcSet({
    full: trip.coverImageUrl ?? trip.coverPhotoUrl ?? null,
    card: trip.coverPhotoCardUrl ?? null,
    thumb: trip.coverPhotoThumbUrl ?? null,
  });
  const altText = buildCoverPhotoAltText(trip.name);
  const {
    showImage: showCardImage,
    isLoaded: cardImageLoaded,
    handleLoad: handleCardImageLoad,
    handleError: handleCardImageError,
  } = useCoverPhotoImage(cardImageSrc);
  return (
    <Card className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-video overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: TRIP_COVER_GRADIENT }}
          aria-hidden="true"
        />
        {showCardImage ? (
          <img
            src={cardImageSrc ?? undefined}
            srcSet={cardImageSrcSet}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            alt={altText}
            className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
              cardImageLoaded ? "opacity-100" : "opacity-0"
            } transition-opacity duration-700`}
            onLoad={handleCardImageLoad}
            onError={handleCardImageError}
            loading="lazy"
            decoding="async"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" aria-hidden="true" />
        <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2 text-xs font-medium text-white">
          <Badge className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur">
            {formatDateRange(trip.startDate, trip.endDate)}
          </Badge>
          <Badge className="rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur">
            {getTravelersLabel(trip.travelersCount)}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-900" title={trip.name}>
            {trip.name}
          </h3>
          <p className="text-sm text-slate-500">{getCountdownLabel(trip.startDate, trip.endDate)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {trip.travelers.slice(0, 3).map((traveler, index) => (
              <Avatar key={`trip-${trip.id}-traveler-${index}`} className="h-8 w-8 border-2 border-white bg-slate-100">
                <AvatarImage src={traveler.avatar ?? undefined} alt="" loading="lazy" />
                <AvatarFallback>{traveler.initial}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            Planning {trip.progressPercent}%
          </Badge>
        </div>
        <Progress value={trip.progressPercent} className="h-2 rounded-full bg-slate-100" />
        <Button
          onClick={onOpen}
          className="mt-auto rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] text-white shadow-md hover:opacity-90"
        >
          Open trip
        </Button>
      </div>
    </Card>
  );
}
