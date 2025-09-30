import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
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

const CurrencyConverterTool = lazy(() =>
  import("@/components/dashboard/currency-converter-tool"),
);

const LAST_CONVERSION_KEY = "dashboard.converter.last";

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

function buildDestinationImageUrl(destination: string): string {
  const query = encodeURIComponent(`${destination} travel landscape`);
  return `https://source.unsplash.com/1600x900/?${query}`;
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

  const heroBackground = primaryTrip
    ? primaryTrip.coverPhotoUrl ?? buildDestinationImageUrl(primaryTrip.destination)
    : null;

  const nextTripChip = primaryTrip
    ? `Next up: ${primaryTrip.name || primaryTrip.destination} · ${formatDateRange(
        toDateString(primaryTrip.startDate),
        toDateString(primaryTrip.endDate),
      )}`
    : null;

  const heroStyles: CSSProperties = heroBackground
    ? {
        backgroundImage: `url(${heroBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : {
        backgroundImage:
          "linear-gradient(135deg, rgba(255, 126, 95, 0.88), rgba(254, 180, 123, 0.85), rgba(101, 78, 163, 0.85))",
      };

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
    <div className="dashboard-page min-h-screen">
      <div className="container w-full pb-24 pt-28">
        <div className="flex flex-col gap-12">
          <section
            aria-labelledby="dashboard-hero"
            className="hero section--tight p-8 text-white sm:p-12"
            style={heroStyles}
          >
            <div className="grid gap-6">
              <div className="eyebrow">Your travel hub</div>
              <div className="space-y-4">
                <h1 id="dashboard-hero">Dashboard</h1>
                <p className="body">
                  Plan new trips and see what’s next—all in one place.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handlePlanTrip}
                  className="button-primary rounded-full px-6 text-base font-semibold"
                >
                  Plan a New Trip
                </Button>
                {nextTripChip ? (
                  <span className="chip text-xs font-medium text-slate-900/85">
                    {nextTripChip}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section aria-labelledby="dashboard-highlights" className="card section p-6">
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
              <section aria-labelledby="upcoming-trips-heading" className="section space-y-6">
                <div>
                  <div className="eyebrow">Plan ahead</div>
                  <h2 id="upcoming-trips-heading" className="section-title text-2xl">
                    Upcoming trips
                  </h2>
                  <div className="divider" />
                </div>

                {error ? (
                  <Card className="section--tight border border-amber-200 bg-amber-50/90 p-6 text-amber-900">
                    We’re having trouble loading your trips right now. Try refreshing the page.
                  </Card>
                ) : null}

                {isLoading ? (
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Card
                        key={`trip-skeleton-${index}`}
                        className="overflow-hidden p-4"
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
                  <Card className="flex flex-col items-center justify-center gap-5 border border-dashed border-slate-200 bg-white p-10 text-center">
                    <div className="text-5xl">🌅</div>
                    <h3 className="title text-2xl text-slate-900">Ready for your next getaway?</h3>
                    <p className="body max-w-md text-sm text-slate-500">
                      Start planning a new adventure to see it appear here with all the essentials at a glance.
                    </p>
                    <Button
                      onClick={handlePlanTrip}
                      className="button-primary rounded-full px-6 text-white"
                    >
                      Plan a New Trip
                    </Button>
                  </Card>
                )}
              </section>

              {insights.length > 0 ? (
                <section aria-labelledby="insights-heading" className="section space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="eyebrow">Make the most</div>
                      <h2 id="insights-heading" className="section-title text-2xl">
                        Helpful insights
                      </h2>
                      <div className="divider" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {insights.map((insight) => (
                      <Link key={insight.id} href={insight.href} className="group">
                        <Card className="flex h-full flex-col justify-between overflow-hidden p-6">
                          <div className="space-y-3">
                            <span className="text-2xl" aria-hidden="true">
                              {insight.icon}
                            </span>
                            <h3 className="title text-lg text-slate-900">{insight.title}</h3>
                            <p className="body text-sm text-slate-500">{insight.description}</p>
                          </div>
                          <span className="mt-6 text-sm font-semibold text-[#7c5cff]">Go to trip →</span>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="flex flex-col gap-6 self-start">
              <section aria-labelledby="converter-heading">
                <Card className="card--accent overflow-hidden p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="eyebrow">Quick tools</div>
                      <h2 id="converter-heading" className="section-title text-lg text-slate-900">
                        Currency converter
                      </h2>
                      <p className="body text-sm text-slate-500">
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
                <Card className="overflow-hidden bg-gradient-to-br from-[#ffecd2] via-white to-[#fcb69f] p-6">
                  <div className="flex flex-col gap-3">
                    <span className="eyebrow text-slate-700">Next destination</span>
                    <h3 className="title text-xl text-slate-900">
                      {primaryTrip.name || primaryTrip.destination}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <MapPin className="h-4 w-4" />
                      {primaryTrip.destination}
                    </div>
                    <div className="body text-sm text-slate-600">
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
  const imageUrl = trip.coverPhotoCardUrl ?? buildDestinationImageUrl(trip.destination);
  const altText = trip.coverPhotoAlt ?? `${trip.destination} travel inspiration`;
  return (
    <Card className="group flex h-full flex-col overflow-hidden">
      <div className="trip-card__media relative aspect-video">
        <img
          src={imageUrl}
          alt={altText}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2 text-xs font-medium text-white">
          <Badge className="chip px-3 py-1 text-xs font-medium text-slate-700">
            {formatDateRange(trip.startDate, trip.endDate)}
          </Badge>
          <Badge className="chip px-3 py-1 text-xs font-medium text-slate-700">
            {getTravelersLabel(trip.travelersCount)}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2">
          <h3 className="title text-xl text-slate-900" title={trip.name}>
            {trip.name}
          </h3>
          <p className="body text-sm text-slate-500">{getCountdownLabel(trip.startDate, trip.endDate)}</p>
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
          <Badge variant="secondary" className="chip px-3 py-1 text-xs font-medium text-slate-700">
            Planning {trip.progressPercent}%
          </Badge>
        </div>
        <Progress value={trip.progressPercent} className="progress h-2 rounded-full bg-slate-100" />
        <Button
          onClick={onOpen}
          className="button-primary mt-auto rounded-full text-white"
        >
          Open trip
        </Button>
      </div>
    </Card>
  );
}
