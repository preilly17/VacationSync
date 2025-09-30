import {
  Suspense,
  lazy,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
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

const CurrencyConverterTool = lazy(() =>
  import("@/components/dashboard/currency-converter-tool"),
);

const LAST_CONVERSION_KEY = "dashboard.converter.last";

const themeTokens = {
  "--dashboard-primary": "#f97362",
  "--dashboard-secondary": "#f6b980",
  "--dashboard-accent": "#6a5cff",
  "--dashboard-text": "#0f172a",
  "--dashboard-muted": "rgba(15, 23, 42, 0.7)",
  "--dashboard-surface": "rgba(255, 255, 255, 0.88)",
  "--dashboard-surface-strong": "rgba(255, 255, 255, 0.96)",
  "--dashboard-card-border": "rgba(15, 23, 42, 0.08)",
  "--dashboard-card-border-strong": "rgba(15, 23, 42, 0.16)",
  "--dashboard-canvas": "#f6f5ff",
} as CSSProperties;

const brandGradient =
  "linear-gradient(120deg, var(--dashboard-primary), var(--dashboard-secondary), var(--dashboard-accent))";
const cardShadow = "0 30px 60px -40px rgba(15, 23, 42, 0.55)";

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
  const [lastConversion, setLastConversion] = useState<LastConversion | null>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    setLastConversion(loadLastConversion());
  }, []);

  const {
    data: trips,
    isLoading,
    error,
  } = useQuery<TripWithDetails[]>({
    queryKey: ["/api/trips"],
    enabled: Boolean(user),
    retry: false,
  });

  const today = startOfDay(new Date());

  const {
    primaryTrip,
    upcomingTrips,
    highlightStats,
  } = useMemo(() => {
    const allTrips = trips ?? [];
    const sorted = [...allTrips].sort(
      (a, b) =>
        parseISO(toDateString(a.startDate)).getTime() -
        parseISO(toDateString(b.startDate)).getTime(),
    );

    const futureTrips = sorted.filter(
      (trip) => !isBefore(parseISO(toDateString(trip.endDate)), today),
    );
    const primary = futureTrips[0] ?? null;

    const highlightUpcomingCount = futureTrips.length;
    const destinationSet = new Set(sorted.map((trip) => trip.destination).filter(Boolean));
    const destinationsCount = destinationSet.size;

    const nextTripDays = primary
      ? Math.max(0, differenceInCalendarDays(parseISO(toDateString(primary.startDate)), today))
      : null;

    const currentYear = today.getFullYear();
    const travelersThisYear = sorted
      .filter((trip) => parseISO(toDateString(trip.startDate)).getFullYear() === currentYear)
      .reduce((total, trip) => total + (trip.memberCount ?? 0), 0);

    return {
      primaryTrip: primary,
      upcomingTrips: futureTrips,
      highlightStats: {
        upcoming: highlightUpcomingCount,
        destinations: destinationsCount,
        daysToNext: nextTripDays,
        travelersThisYear,
      },
    };
  }, [today, trips]);

  const upcomingSummaries: TripSummary[] = useMemo(() => {
    return upcomingTrips.map((trip) => ({
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
  }, [upcomingTrips]);

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
        backgroundImage: brandGradient,
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
    <div
      className="relative min-h-screen overflow-hidden bg-[var(--dashboard-canvas,#f6f5ff)]"
      style={themeTokens}
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,var(--dashboard-secondary)/0.15,transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,var(--dashboard-accent)/0.12,transparent_60%)]" />
      </div>
      <div className="mx-auto w-full max-w-6xl px-4 pb-20 pt-24 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-12">
          <section
            aria-labelledby="dashboard-hero"
            className="relative overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.18)] bg-slate-900/80 p-8 text-white shadow-xl backdrop-blur-lg sm:p-12"
            style={heroStyles}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/75 via-slate-900/55 to-slate-900/70" aria-hidden="true" />
            <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_45%,rgba(15,23,42,0.65))]" aria-hidden="true" />
            <div
              className="absolute inset-0 opacity-[0.18] mix-blend-soft-light"
              aria-hidden="true"
              style={{
                backgroundImage:
                  "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAKUlEQVQoU2NkYGD4z0AEYBxVSF8GIg1E0UAMM1ECkWg0GhEExmAwGgAAIuYB+7cwXroAAAAASUVORK5CYII=')",
                backgroundSize: "180px",
              }}
            />
            <div className="relative grid gap-5">
              <div className="text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
                Your Travel Hub
              </div>
              <div className="space-y-4">
                <h1 id="dashboard-hero" className="text-4xl font-black leading-tight sm:text-6xl">
                  Dashboard
                </h1>
                <p className="text-base leading-normal text-white/80">
                  Plan new trips and see what’s next—all in one place.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handlePlanTrip}
                  className="rounded-full px-7 py-2.5 text-base font-semibold text-white transition-transform duration-300 ease-out hover:-translate-y-0.5"
                  style={{
                    backgroundImage: brandGradient,
                    boxShadow: "0 16px 35px -20px rgba(249, 115, 98, 0.65)",
                  }}
                >
                  Plan a New Trip
                </Button>
                {nextTripChip ? (
                  <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium uppercase tracking-wide text-white/85 backdrop-blur-sm">
                    {nextTripChip}
                  </span>
                ) : null}
              </div>
            </div>
          </section>

          <section className="relative" aria-labelledby="dashboard-highlights">
            <div className="pointer-events-none absolute inset-[-28px] -z-10 rounded-[40px] bg-[radial-gradient(circle_at_center,rgba(249,115,98,0.12),transparent_65%)]" />
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-[32px] bg-white/30 blur-3xl" />
            <div className="rounded-[28px] border border-[rgba(15,23,42,0.06)] bg-[color:var(--dashboard-surface)] p-6 shadow-[0_35px_65px_-45px_rgba(15,23,42,0.65)] backdrop-blur">
            <h2 id="dashboard-highlights" className="sr-only">
              Highlights
            </h2>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Card
                    key={`highlight-skeleton-${index}`}
                    className="relative overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/70 p-6 shadow-sm"
                  >
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[rgba(249,115,98,0.45)] via-[rgba(246,185,128,0.45)] to-[rgba(106,92,255,0.45)]" />
                    <Skeleton className="mt-4 h-5 w-10" />
                    <Skeleton className="mt-5 h-7 w-24" />
                    <Skeleton className="mt-3 h-3 w-28" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <HighlightCard
                  icon={<Plane className="h-5 w-5 text-[var(--dashboard-primary)]" aria-hidden="true" />}
                  value={highlightStats.upcoming}
                  label="Upcoming trips"
                  href={primaryTrip ? `/trip/${primaryTrip.id}` : "/"}
                />
                <HighlightCard
                  icon={<Globe2 className="h-5 w-5 text-[var(--dashboard-primary)]" aria-hidden="true" />}
                  value={highlightStats.destinations}
                  label="Destinations"
                  href={primaryTrip ? `/trip/${primaryTrip.id}` : "/"}
                />
                <HighlightCard
                  icon={<CalendarDays className="h-5 w-5 text-[var(--dashboard-primary)]" aria-hidden="true" />}
                  value={highlightStats.daysToNext ?? "—"}
                  label="Days to next trip"
                  href={primaryTrip ? `/trip/${primaryTrip.id}` : "/"}
                />
                <HighlightCard
                  icon={<UserRound className="h-5 w-5 text-[var(--dashboard-primary)]" aria-hidden="true" />}
                  value={highlightStats.travelersThisYear}
                  label="Travelers this year"
                  href={primaryTrip ? `/trip/${primaryTrip.id}?view=members` : "/"}
                />
              </div>
            )}
            </div>
          </section>

          <section className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-10">
              <section aria-labelledby="upcoming-trips-heading" className="space-y-6">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                    Upcoming Trips
                  </span>
                  <div>
                    <h2 id="upcoming-trips-heading" className="text-2xl font-semibold text-slate-900">
                      Upcoming trips
                    </h2>
                    <div className="mt-2 h-px w-14 bg-gradient-to-r from-[var(--dashboard-primary)] via-[var(--dashboard-secondary)] to-[var(--dashboard-accent)]" />
                  </div>
                </div>

                {error ? (
                  <Card className="rounded-[28px] border border-amber-200/70 bg-amber-50/80 p-6 text-amber-900 shadow-sm">
                    We’re having trouble loading your trips right now. Try refreshing the page.
                  </Card>
                ) : null}

                {isLoading ? (
                  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Card
                        key={`trip-skeleton-${index}`}
                        className="relative overflow-hidden rounded-[28px] border border-[rgba(15,23,42,0.08)] bg-white/80 p-5 shadow-sm"
                      >
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[rgba(249,115,98,0.45)] via-[rgba(246,185,128,0.45)] to-[rgba(106,92,255,0.45)]" />
                        <Skeleton className="aspect-video w-full rounded-2xl" />
                        <div className="mt-5 space-y-3">
                          <Skeleton className="h-5 w-2/3" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-2.5 w-full rounded-full" />
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
                  <Card className="flex flex-col items-center justify-center gap-5 rounded-[28px] border border-dashed border-[color:var(--dashboard-card-border-strong)] bg-white/80 p-10 text-center shadow-sm">
                    <div className="text-5xl">🌅</div>
                    <h3 className="text-2xl font-semibold text-slate-900">Ready for your next getaway?</h3>
                    <p className="max-w-md text-sm text-slate-500">
                      Start planning a new adventure to see it appear here with all the essentials at a glance.
                    </p>
                    <Button
                      onClick={handlePlanTrip}
                      className="rounded-full px-6 text-white transition-transform duration-300 ease-out hover:-translate-y-0.5"
                      style={{
                        backgroundImage: brandGradient,
                        boxShadow: "0 16px 35px -20px rgba(249, 115, 98, 0.6)",
                      }}
                    >
                      Plan a New Trip
                    </Button>
                  </Card>
                )}
              </section>

              {insights.length > 0 ? (
                <section aria-labelledby="insights-heading" className="space-y-6">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                      Your Travel Hub
                    </span>
                    <div className="flex items-center justify-between">
                      <h2 id="insights-heading" className="text-2xl font-semibold text-slate-900">
                        Helpful insights
                      </h2>
                    </div>
                    <div className="h-px w-14 bg-gradient-to-r from-[var(--dashboard-primary)] via-[var(--dashboard-secondary)] to-[var(--dashboard-accent)]" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {insights.map((insight) => (
                      <Link key={insight.id} href={insight.href} className="group">
                        <Card
                          className="relative flex h-full flex-col justify-between overflow-hidden rounded-[24px] border border-[rgba(15,23,42,0.08)] bg-white/80 p-6 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.45)] transition-transform duration-300 ease-out group-hover:-translate-y-2 group-hover:shadow-[0_32px_60px_-35px_rgba(15,23,42,0.55)]"
                        >
                          <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--dashboard-primary)] via-[var(--dashboard-secondary)] to-[var(--dashboard-accent)]" aria-hidden="true" />
                          <div className="space-y-3 pt-2">
                            <span
                              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:rgba(249,115,98,0.12)] text-xl"
                              aria-hidden="true"
                            >
                              {insight.icon}
                            </span>
                            <h3 className="text-lg font-semibold text-slate-900">{insight.title}</h3>
                            <p className="text-sm text-slate-500">{insight.description}</p>
                          </div>
                          <span className="mt-6 text-sm font-semibold text-[var(--dashboard-primary)]">Go to trip →</span>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="flex flex-col gap-8 self-start">
              <section aria-labelledby="converter-heading">
                <Card
                  className="relative overflow-hidden rounded-[28px] border border-[color:var(--dashboard-card-border)] bg-[color:var(--dashboard-surface-strong)] p-6 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.4)] transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_35px_65px_-30px_rgba(15,23,42,0.55)]"
                  style={{ boxShadow: cardShadow }}
                >
                  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--dashboard-primary)] via-[var(--dashboard-secondary)] to-[var(--dashboard-accent)]" aria-hidden="true" />
                  <div className="mb-5 flex items-start justify-between">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
                        Travel Tools
                      </span>
                      <h2 id="converter-heading" className="text-lg font-semibold leading-tight text-slate-900">
                        Currency converter
                      </h2>
                      <p className="text-sm text-slate-500">Quick conversions for the road.</p>
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
                <Card
                  className="relative rounded-[28px] border border-[color:var(--dashboard-card-border)] bg-gradient-to-br from-[rgba(249,115,98,0.08)] via-white to-[rgba(106,92,255,0.08)] p-6 text-slate-900 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.4)] transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_35px_65px_-30px_rgba(15,23,42,0.55)]"
                  style={{ boxShadow: cardShadow }}
                >
                  <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--dashboard-primary)] via-[var(--dashboard-secondary)] to-[var(--dashboard-accent)]" aria-hidden="true" />
                  <div className="flex flex-col gap-3 pt-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
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

type HighlightCardProps = {
  icon: ReactNode;
  value: number | string | null;
  label: string;
  href: string;
};

function HighlightCard({ icon, value, label, href }: HighlightCardProps) {
  return (
    <Link href={href} className="group">
      <Card
        className="relative flex h-full flex-col justify-between gap-5 overflow-hidden rounded-[24px] border border-[color:var(--dashboard-card-border)] bg-white/80 p-6 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:shadow-[0_35px_65px_-30px_rgba(15,23,42,0.6)]"
        style={{ boxShadow: cardShadow }}
      >
        <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--dashboard-primary)] via-[var(--dashboard-secondary)] to-[var(--dashboard-accent)]" aria-hidden="true" />
        <div className="flex items-center justify-between pt-2">
          <div
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[color:rgba(249,115,98,0.15)] text-[var(--dashboard-primary)]"
            style={{ animation: "dashboard-icon-pop 0.6s ease-out both" }}
            aria-hidden="true"
          >
            {icon}
          </div>
          <span className="text-[0.7rem] font-semibold uppercase tracking-[0.35em] text-slate-400">
            View
          </span>
        </div>
        <div className="space-y-1">
          <div className="text-4xl font-semibold leading-tight text-slate-900">
            {value ?? "—"}
          </div>
          <p className="text-[0.75rem] uppercase tracking-[0.25em] text-slate-500">{label}</p>
        </div>
      </Card>
    </Link>
  );
}

type TripCardProps = {
  trip: TripSummary;
  onOpen: () => void;
};

function TripCard({ trip, onOpen }: TripCardProps) {
  const imageUrl = trip.coverPhotoCardUrl ?? buildDestinationImageUrl(trip.destination);
  const altText = trip.coverPhotoAlt ?? `${trip.destination} travel inspiration`;
  const [progressValue, setProgressValue] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      setProgressValue(trip.progressPercent);
      return;
    }
    const frame = window.requestAnimationFrame(() => setProgressValue(trip.progressPercent));
    return () => window.cancelAnimationFrame(frame);
  }, [trip.progressPercent]);

  return (
    <Card
      className="group relative flex h-full flex-col overflow-hidden rounded-[28px] border border-[color:var(--dashboard-card-border)] bg-white/85 shadow-[0_25px_45px_-35px_rgba(15,23,42,0.45)] transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_35px_65px_-30px_rgba(15,23,42,0.6)]"
      style={{ boxShadow: cardShadow }}
    >
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--dashboard-primary)] via-[var(--dashboard-secondary)] to-[var(--dashboard-accent)]" aria-hidden="true" />
      <div className="relative aspect-video overflow-hidden">
        <img
          src={imageUrl}
          alt={altText}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/35 to-transparent" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,transparent_45%,rgba(15,23,42,0.5))]" aria-hidden="true" />
        <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2 text-xs font-medium text-white">
          <Badge className="rounded-full border border-white/40 bg-white/30 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {formatDateRange(trip.startDate, trip.endDate)}
          </Badge>
          <Badge className="rounded-full border border-white/35 bg-white/25 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {getTravelersLabel(trip.travelersCount)}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold leading-tight text-slate-900" title={trip.name}>
            {trip.name}
          </h3>
          <p className="text-sm text-slate-500">{getCountdownLabel(trip.startDate, trip.endDate)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {trip.travelers.slice(0, 3).map((traveler, index) => (
              <Avatar
                key={`trip-${trip.id}-traveler-${index}`}
                className="h-8 w-8 border-2 border-white/80 bg-slate-100 shadow-[0_6px_18px_-12px_rgba(15,23,42,0.45)]"
              >
                <AvatarImage src={traveler.avatar ?? undefined} alt="" loading="lazy" />
                <AvatarFallback>{traveler.initial}</AvatarFallback>
              </Avatar>
            ))}
          </div>
          <Badge className="rounded-full border border-[rgba(249,115,98,0.2)] bg-[rgba(249,115,98,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dashboard-muted)]">
            Planning {trip.progressPercent}%
          </Badge>
        </div>
        <Progress
          value={progressValue}
          className="dashboard-progress h-2 rounded-full bg-[rgba(15,23,42,0.08)]"
          style={{
            overflow: "hidden",
          }}
        />
        <Button
          onClick={onOpen}
          className="mt-auto rounded-full px-6 text-white transition-transform duration-300 ease-out hover:-translate-y-0.5"
          style={{
            backgroundImage: brandGradient,
            boxShadow: "0 16px 35px -20px rgba(249, 115, 98, 0.6)",
          }}
        >
          Open trip
        </Button>
      </div>
    </Card>
  );
}
