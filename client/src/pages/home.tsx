import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  differenceInCalendarDays,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { LastConversion } from "@/components/dashboard/converter-types";
import type { TripWithDetails } from "@shared/schema";
import {
  CalendarDays,
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
} from "@/lib/dashboardSelectors";
import {
  TRIP_COVER_GRADIENT,
  buildCoverPhotoAltText,
  buildCoverPhotoSrcSet,
  useCoverPhotoImage,
} from "@/lib/tripCover";

const CurrencyConverterTool = lazy(() =>
  import("@/components/dashboard/currency-converter-tool"),
);

const LAST_CONVERSION_KEY = "dashboard.converter.last";

const HERO_OVERLAY_GRADIENT =
  "linear-gradient(180deg, rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.55))";

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

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [lastConversion, setLastConversion] = useState<LastConversion | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

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
      coverPhotoUrl: trip.coverPhotoUrl ?? null,
      coverPhotoCardUrl: trip.coverPhotoCardUrl ?? trip.coverPhotoUrl ?? null,
      coverPhotoThumbUrl: trip.coverPhotoThumbUrl ?? trip.coverPhotoCardUrl ?? trip.coverPhotoUrl ?? null,
      coverPhotoAlt: trip.coverPhotoAlt ?? undefined,
    }));
  }, [upcomingTripsForDisplay]);

  const statsLoading = isLoading && !trips;
  const isError = Boolean(error);
  const upcomingCount = upcomingTripsForStats.length;
  const destinationsCount = uniqueDestinations.size;
  const travelersCount = travelersThisYear.size;
  const currentYear = today.getFullYear();

  const handleNextTripUnavailable = useCallback(() => {
    toast({
      title: "No upcoming trips yet.",
      description: "Plan a new trip to see it appear here.",
    });
  }, [toast]);

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

  const heroCoverPhoto = primaryTrip?.coverPhotoUrl ?? null;
  const heroImageSrcSet = primaryTrip
    ? buildCoverPhotoSrcSet({
        full: primaryTrip.coverPhotoUrl ?? null,
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

  const handlePlanTrip = () => {
    setLocation("/trips/new");
  };

  const handleOpenTrip = (tripId: number) => {
    setLocation(`/trip/${tripId}`);
  };

  const handleConversionUpdate = (conversion: LastConversion) => {
    setLastConversion(conversion);
    storeLastConversion(conversion);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100">
      <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-28 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-16">
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
            <div className="relative grid gap-6">
              <div className="text-sm uppercase tracking-[0.2em] text-white/80">
                Your travel hub
              </div>
              <div className="space-y-4">
                <h1 id="dashboard-hero" className="text-4xl font-semibold sm:text-5xl">
                  Dashboard
                </h1>
                <p className="text-base text-white/80">
                  Plan new trips and see what’s next—all in one place.
                </p>
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
            className="rounded-3xl border border-white/30 bg-white/90 p-6 shadow-lg backdrop-blur"
          >
            <h2 id="dashboard-highlights" className="sr-only">
              Highlights
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<Plane className="h-5 w-5" aria-hidden="true" />}
                value={upcomingCount}
                label="Upcoming trips"
                description={upcomingCount === 0 ? "No trips planned" : undefined}
                ariaLabel={
                  upcomingCount === 0
                    ? "View upcoming trips"
                    : `View ${upcomingCount} upcoming ${upcomingCount === 1 ? "trip" : "trips"}`
                }
                href="/trips?filter=upcoming"
                isLoading={statsLoading}
                isError={isError}
                onRetry={() => {
                  void refetch();
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
                    ? "Add your first destination"
                    : `View ${destinationsCount} saved ${destinationsCount === 1 ? "destination" : "destinations"}`
                }
                href="/destinations"
                isLoading={statsLoading}
                isError={isError}
                onRetry={() => {
                  void refetch();
                }}
                testId="stat-destinations"
              />
              <StatCard
                icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
                value={daysToNextTrip ?? "—"}
                label={nextTrip ? "Days to next trip" : "No upcoming trips"}
                ariaLabel={
                  nextTrip
                    ? `Open next trip: ${nextTrip.name || nextTrip.destination}`
                    : "No upcoming trips yet."
                }
                href={nextTrip ? `/trips/${nextTrip.id}` : undefined}
                onClick={nextTrip ? undefined : handleNextTripUnavailable}
                isLoading={statsLoading}
                isError={isError}
                onRetry={() => {
                  void refetch();
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
                    ? "Invite your crew"
                    : `View ${travelersCount} travelers this year`
                }
                href={`/travelers?year=${currentYear}`}
                isLoading={statsLoading}
                isError={isError}
                onRetry={() => {
                  void refetch();
                }}
                testId="stat-travelers"
              />
            </div>
          </section>

          <section className="grid gap-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-12">
              <section aria-labelledby="upcoming-trips-heading" className="space-y-6">
                <h2 id="upcoming-trips-heading" className="text-2xl font-semibold text-slate-900">
                  Upcoming trips
                </h2>

                {error ? (
                  <Card className="rounded-3xl border border-amber-200 bg-amber-50/80 p-6 text-amber-900">
                    We’re having trouble loading your trips right now. Try refreshing the page.
                  </Card>
                ) : null}

                {isLoading ? (
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Card
                        key={`trip-skeleton-${index}`}
                        className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                      >
                        <Skeleton className="aspect-video w-full rounded-2xl" />
                        <div className="mt-4 space-y-2">
                          <Skeleton className="h-5 w-2/3" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-2 w-full rounded-full" />
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : upcomingSummaries.length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {upcomingSummaries.map((trip) => (
                      <TripCard key={trip.id} trip={trip} onOpen={() => handleOpenTrip(trip.id)} />
                    ))}
                  </div>
                ) : (
                  <Card className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm">
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

              {insights.length > 0 ? (
                <section aria-labelledby="insights-heading" className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 id="insights-heading" className="text-2xl font-semibold text-slate-900">
                      Helpful insights
                    </h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {insights.map((insight) => (
                      <Link key={insight.id} href={insight.href} className="group">
                        <Card className="flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-transform group-hover:-translate-y-1 group-hover:shadow-md">
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
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="flex flex-col gap-6 self-start">
              <section aria-labelledby="converter-heading">
                <Card className="overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 id="converter-heading" className="text-lg font-semibold text-slate-900">
                        Currency converter
                      </h2>
                      <p className="text-sm text-slate-500">
                        Quick conversions for the road.
                      </p>
                    </div>
                  </div>
                  <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                    <CurrencyConverterTool
                      onClose={() => undefined}
                      lastConversion={lastConversion}
                      onConversion={handleConversionUpdate}
                      mobile={!isDesktop}
                    />
                  </Suspense>
                </Card>
              </section>

              {primaryTrip ? (
                <Card className="rounded-3xl border border-slate-100 bg-gradient-to-br from-[#ffecd2] via-white to-[#fcb69f] p-6 shadow-sm">
                  <div className="flex flex-col gap-3">
                    <span className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                      Next destination
                    </span>
                    <h3 className="text-xl font-semibold text-slate-900">
                      {primaryTrip.name || primaryTrip.destination}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <MapPin className="h-4 w-4" />
                      {primaryTrip.destination}
                    </div>
                    <div className="text-sm text-slate-600">
                      {formatDateRange(
                        toDateString(primaryTrip.startDate),
                        toDateString(primaryTrip.endDate),
                      )}
                    </div>
                  </div>
                </Card>
              ) : null}
            </aside>
          </section>
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
  const cardImageSrc = trip.coverPhotoCardUrl ?? trip.coverPhotoUrl ?? null;
  const cardImageSrcSet = buildCoverPhotoSrcSet({
    full: trip.coverPhotoUrl ?? null,
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
    <Card className="group flex h-full flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg">
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
