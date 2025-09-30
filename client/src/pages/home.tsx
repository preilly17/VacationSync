import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  differenceInCalendarDays,
  isAfter,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NotificationIcon } from "@/components/notification-icon";
import { CreateTripModal } from "@/components/create-trip-modal";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import type { LastConversion } from "@/components/dashboard/converter-types";
import type {
  ActivityWithDetails,
  FlightWithDetails,
  HotelWithDetails,
  PackingItem,
  PackingItemGroupStatus,
  TripWithDetails,
  User,
} from "@shared/schema";
import { Calendar, ChevronRight, Ellipsis, MapPin, Users } from "lucide-react";
import { Link } from "wouter";

const CurrencyConverterTool = lazy(() =>
  import("@/components/dashboard/currency-converter-tool"),
);

type TripSummary = {
  id: number;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelersCount: number;
  travelers: { avatar?: string | null; initial: string }[];
  progressPercent: number;
  nextUp: NextUpAction | null;
};

type NextUpAction = {
  label: string;
  href: string;
  ariaLabel: string;
};

type Insight = {
  id: string;
  icon: string;
  title: string;
  description: string;
  action: { label: string; href: string };
};

type ExpenseBalanceSummary = {
  owes: number;
  owed: number;
  balance: number;
};

type PackingItemWithMeta = PackingItem & {
  user: User;
  groupStatus?: PackingItemGroupStatus;
};

type HeroTripDetails = {
  flights: FlightWithDetails[];
  hotels: HotelWithDetails[];
  activities: ActivityWithDetails[];
  expenseBalance: ExpenseBalanceSummary;
  packingItems: PackingItemWithMeta[];
};

const LAST_CONVERSION_KEY = "dashboard.converter.last";
const DISMISSED_INSIGHTS_KEY = "dashboard.dismissed";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

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

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth =
    sameYear && start.getMonth() === end.getMonth();

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

  if (isSameDay(start, today)) {
    return "Starts today";
  }

  if (isAfter(start, today)) {
    const diff = differenceInCalendarDays(start, today);
    if (diff === 1) {
      return "1 day to go";
    }
    return `${diff} days to go`;
  }

  if (isWithinInterval(today, { start, end })) {
    return "In progress";
  }

  const diffFromEnd = differenceInCalendarDays(today, end);
  if (diffFromEnd === 1) {
    return "Ended 1 day ago";
  }
  return `Ended ${diffFromEnd} days ago`;
}

function getTravelersLabel(count: number): string {
  if (count === 1) {
    return "1 traveler";
  }
  return `${count} travelers`;
}

function toDateString(value: TripWithDetails["startDate"]): string {
  return typeof value === "string" ? value : value.toISOString();
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

function calculatePlanningProgress(
  trip: TripWithDetails,
  details?: Partial<HeroTripDetails>,
): number {
  const tasks = [
    { id: "crew", complete: trip.memberCount > 1 },
    {
      id: "invitations",
      complete: trip.members.every((member) => member.joinedAt != null),
    },
    {
      id: "lodging",
      complete: details ? (details.hotels?.length ?? 0) > 0 : false,
    },
    {
      id: "flights",
      complete: details ? (details.flights?.length ?? 0) > 0 : false,
    },
    {
      id: "schedule",
      complete: details
        ? hasDayOneActivity(details.activities, toDateString(trip.startDate))
        : false,
    },
    {
      id: "expenses",
      complete: details ? !hasUnsettledExpenses(details.expenseBalance) : false,
    },
    {
      id: "packing",
      complete: details ? (details.packingItems?.length ?? 0) > 0 : false,
    },
  ];

  const completed = tasks.filter((task) => task.complete).length;
  const progress = Math.round((completed / tasks.length) * 100);
  return Math.min(95, Math.max(progress, completed > 0 ? 20 : 8));
}

function hasDayOneActivity(
  activities: ActivityWithDetails[] | undefined,
  startDate: string,
) {
  if (!activities || activities.length === 0) {
    return false;
  }
  const start = startOfDay(parseISO(startDate));
  return activities.some((activity) =>
    isSameDay(
      startOfDay(parseISO(toActivityDateString(activity.startTime))),
      start,
    ),
  );
}

function toActivityDateString(value: ActivityWithDetails["startTime"]): string {
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}

function hasUnsettledExpenses(balance?: ExpenseBalanceSummary) {
  if (!balance) {
    return false;
  }
  return balance.owes > 0 || balance.owed > 0;
}

function determineNextUp(
  trip: TripWithDetails,
  details: HeroTripDetails | null,
): NextUpAction | null {
  if (!details) {
    return null;
  }

  const tripBasePath = `/trip/${trip.id}`;

  const hasFlights = details.flights.length > 0;
  const hasHotels = details.hotels.length > 0;
  if (!hasFlights || !hasHotels) {
    return {
      label: "Next up: Confirm reservations",
      href: `${tripBasePath}?view=${hasFlights ? "hotels" : "flights"}`,
      ariaLabel: "Open reservations to confirm travel details",
    };
  }

  if (!hasDayOneActivity(details.activities, toDateString(trip.startDate))) {
    return {
      label: "Next up: Add your day-one plans",
      href: `${tripBasePath}?view=activities`,
      ariaLabel: "Open activities to plan the first day",
    };
  }

  if (hasUnsettledExpenses(details.expenseBalance)) {
    return {
      label: "Next up: Settle outstanding expenses",
      href: `${tripBasePath}?view=expenses`,
      ariaLabel: "Open expenses to settle outstanding balances",
    };
  }

  const pendingMembers = trip.members.filter((member) => !member.joinedAt);
  if (pendingMembers.length > 0) {
    return {
      label: "Next up: Follow up on invites",
      href: `${tripBasePath}?view=members`,
      ariaLabel: "Open members list to manage invitations",
    };
  }

  const daysUntil = differenceInCalendarDays(
    startOfDay(parseISO(toDateString(trip.startDate))),
    startOfDay(new Date()),
  );
  if (daysUntil < 7 && details.packingItems.length === 0) {
    return {
      label: "Next up: Start your packing list",
      href: `${tripBasePath}?view=packing`,
      ariaLabel: "Open packing list to add items",
    };
  }

  return null;
}

function buildInsights(
  trip: TripWithDetails | null,
  details: HeroTripDetails | null,
  nextUp: NextUpAction | null,
  dismissed: Record<string, number>,
): Insight[] {
  if (!trip || !details) {
    return [];
  }

  const now = Date.now();
  const shouldShow = (id: string) => {
    const dismissedAt = dismissed[id];
    if (!dismissedAt) {
      return true;
    }
    return now - dismissedAt > DISMISS_COOLDOWN_MS;
  };

  const insights: Insight[] = [];

  if (!details.hotels.length && shouldShow("add-hotel")) {
    insights.push({
      id: "add-hotel",
      icon: "bed",
      title: "Confirm your hotel",
      description: "Lock in a stay so everyone knows where to meet on arrival.",
      action: { label: "Add hotel", href: `/trip/${trip.id}?view=hotels` },
    });
  }

  if (hasUnsettledExpenses(details.expenseBalance) && shouldShow("expenses")) {
    insights.push({
      id: "expenses",
      icon: "wallet",
      title: "Split an expense early",
      description: "Log shared costs before takeoff so everyone stays aligned.",
      action: { label: "Log expense", href: `/trip/${trip.id}?view=expenses` },
    });
  }

  if (
    !hasDayOneActivity(details.activities, toDateString(trip.startDate)) &&
    shouldShow("day-one")
  ) {
    insights.push({
      id: "day-one",
      icon: "calendar",
      title: "Fill day one",
      description: "Add a standout activity to kick the trip off together.",
      action: { label: "Add activity", href: `/trip/${trip.id}?view=activities` },
    });
  }

  if (!details.packingItems.length && shouldShow("packing")) {
    insights.push({
      id: "packing",
      icon: "checklist",
      title: "Prep your packing",
      description: "Start the shared packing list so teammates can contribute.",
      action: { label: "View packing", href: `/trip/${trip.id}?view=packing` },
    });
  }

  if (!insights.length && nextUp && shouldShow("next-up")) {
    insights.push({
      id: "next-up",
      icon: "sparkle",
      title: "Keep momentum",
      description: "Stay on track by completing the highlighted next step.",
      action: { label: "Go now", href: nextUp.href },
    });
  }

  return insights.slice(0, 3);
}

async function fetchHeroTripDetails(tripId: number): Promise<HeroTripDetails> {
  const [flightsRes, hotelsRes, activitiesRes, packingRes, balancesRes] = await Promise.all([
    apiRequest(`/api/trips/${tripId}/flights`),
    apiRequest(`/api/trips/${tripId}/hotels`),
    apiRequest(`/api/trips/${tripId}/activities`),
    apiRequest(`/api/trips/${tripId}/packing`),
    apiRequest(`/api/trips/${tripId}/expenses/balances`),
  ]);

  const [flights, hotels, activities, packingItems, expenseBalance] = await Promise.all([
    flightsRes.json() as Promise<FlightWithDetails[]>,
    hotelsRes.json() as Promise<HotelWithDetails[]>,
    activitiesRes.json() as Promise<ActivityWithDetails[]>,
    packingRes.json() as Promise<PackingItemWithMeta[]>,
    balancesRes.json() as Promise<ExpenseBalanceSummary>,
  ]);

  return {
    flights,
    hotels,
    activities,
    packingItems,
    expenseBalance,
  };
}

function loadDismissedInsights(): Record<string, number> {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const stored = window.localStorage.getItem(DISMISSED_INSIGHTS_KEY);
    if (!stored) {
      return {};
    }
    const parsed = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    return parsed;
  } catch (error) {
    console.warn("Failed to parse dismissed insights", error);
    return {};
  }
}

function storeDismissedInsights(value: Record<string, number>) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(DISMISSED_INSIGHTS_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn("Failed to store dismissed insights", error);
  }
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

function TripHeroSkeleton() {
  return (
    <Card className="relative overflow-hidden rounded-2xl border-0 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-2 w-72 rounded-full" />
        </div>
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
    </Card>
  );
}

function TripGridSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={index} className="rounded-2xl border border-slate-200/70 p-5 shadow-none">
          <Skeleton className="mb-4 h-6 w-44" />
          <Skeleton className="mb-3 h-4 w-32" />
          <Skeleton className="h-2 w-full rounded-full" />
        </Card>
      ))}
    </div>
  );
}

function InsightSkeleton() {
  return (
    <Card className="rounded-2xl border border-slate-200/70 p-5 shadow-none">
      <Skeleton className="mb-3 h-5 w-32" />
      <Skeleton className="mb-2 h-4 w-64" />
      <Skeleton className="h-8 w-24 rounded-full" />
    </Card>
  );
}

function UpcomingTripCard({ trip }: { trip: TripSummary }) {
  const [, setLocation] = useLocation();
  const dateLabel = formatDateRange(trip.startDate, trip.endDate);
  const countdown = getCountdownLabel(trip.startDate, trip.endDate);

  const handleOpen = useCallback(() => {
    setLocation(`/trip/${trip.id}`);
  }, [setLocation, trip.id]);

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleOpen();
        }
      }}
      className="group relative flex cursor-pointer flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-5 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <h3 className="line-clamp-1 text-lg font-semibold text-slate-900">{trip.name}</h3>
          <p className="text-sm text-slate-500">{dateLabel}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-1" />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <span className="inline-flex items-center gap-1">
          <Users className="h-4 w-4" aria-hidden="true" />
          {getTravelersLabel(trip.travelersCount)}
        </span>
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-4 w-4" aria-hidden="true" />
          {countdown}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {trip.travelers.slice(0, 3).map((traveler, index) => (
            <Avatar
              key={`${trip.id}-avatar-${index}`}
              className="h-8 w-8 border-2 border-white bg-slate-100"
            >
              <AvatarImage
                src={traveler.avatar ?? undefined}
                loading="lazy"
                alt="Traveler avatar"
              />
              <AvatarFallback>{traveler.initial}</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Planning {trip.progressPercent}%</span>
          </div>
          <Progress
            value={trip.progressPercent}
            aria-label={`Planning progress ${trip.progressPercent} percent`}
            className="h-2 overflow-hidden rounded-full bg-slate-100"
          />
        </div>
      </div>
    </Card>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [lastConversion, setLastConversion] = useState<LastConversion | null>(null);
  const [dismissedInsights, setDismissedInsights] = useState<Record<string, number>>({});

  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    setLastConversion(loadLastConversion());
    setDismissedInsights(loadDismissedInsights());
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

  const now = startOfDay(new Date());

  const { upcomingTrips, primaryTrip, pastTrips } = useMemo(() => {
    const allTrips = trips ?? [];
    const futureTrips = allTrips
      .filter((trip) => !isBefore(parseISO(toDateString(trip.endDate)), now))
      .sort(
        (a, b) =>
          parseISO(toDateString(a.startDate)).getTime() -
          parseISO(toDateString(b.startDate)).getTime(),
      );
    const selectedPrimary = futureTrips.length > 0 ? futureTrips[0] : null;
    const remainingUpcoming = selectedPrimary
      ? futureTrips.slice(1)
      : futureTrips;
    const previousTrips = allTrips
      .filter((trip) => isBefore(parseISO(toDateString(trip.endDate)), now))
      .sort(
        (a, b) =>
          parseISO(toDateString(b.startDate)).getTime() -
          parseISO(toDateString(a.startDate)).getTime(),
      );

    return {
      upcomingTrips: remainingUpcoming,
      primaryTrip: selectedPrimary,
      pastTrips: previousTrips,
    };
  }, [now, trips]);

  const heroDetailsQuery = useQuery<HeroTripDetails>({
    queryKey: ["dashboard", "hero", primaryTrip?.id],
    queryFn: () => fetchHeroTripDetails(primaryTrip!.id),
    enabled: Boolean(primaryTrip),
    retry: false,
  });

  const heroDetails = heroDetailsQuery.data ?? null;
  const heroNextUp = primaryTrip
    ? determineNextUp(primaryTrip, heroDetails)
    : null;

  const insights = useMemo(
    () => buildInsights(primaryTrip ?? null, heroDetails, heroNextUp, dismissedInsights),
    [dismissedInsights, heroDetails, heroNextUp, primaryTrip],
  );

  const heroSummary: TripSummary | null = useMemo(() => {
    if (!primaryTrip) {
      return null;
    }
    const progress = calculatePlanningProgress(primaryTrip, heroDetails ?? undefined);
    return {
      id: primaryTrip.id,
      name: primaryTrip.name || primaryTrip.destination,
      destination: primaryTrip.destination,
      startDate: toDateString(primaryTrip.startDate),
      endDate: toDateString(primaryTrip.endDate),
      travelersCount: primaryTrip.memberCount,
      travelers: buildTravelerData(primaryTrip.members),
      progressPercent: progress,
      nextUp: heroNextUp,
    };
  }, [heroDetails, heroNextUp, primaryTrip]);

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
      nextUp: null,
    }));
  }, [upcomingTrips]);

  const handleOpenTrip = useCallback(
    (tripId: number) => {
      setLocation(`/trip/${tripId}`);
    },
    [setLocation],
  );

  const handleDismissInsight = useCallback(
    (id: string) => {
      setDismissedInsights((prev) => {
        const next = { ...prev, [id]: Date.now() };
        storeDismissedInsights(next);
        return next;
      });
    },
    [],
  );

  const handleConversionUpdate = useCallback((conversion: LastConversion) => {
    setLastConversion(conversion);
    storeLastConversion(conversion);
  }, []);

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/60 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
              VS
            </span>
            <span className="hidden sm:inline">VacationSync</span>
          </Link>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Dashboard</h1>
          <div className="flex items-center gap-3">
            <NotificationIcon />
            <Link
              href="/profile"
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              aria-label="Open profile"
            >
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                <AvatarImage src={user?.profileImageUrl ?? undefined} alt="Profile" />
                <AvatarFallback>
                  {user?.firstName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-8 lg:flex-row">
        <div className="flex-1 space-y-10">
          {isLoading ? (
            <TripHeroSkeleton />
          ) : error ? (
            <Card className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-sm text-amber-800">
              We’re having trouble loading your trips right now. Try refreshing the page.
            </Card>
          ) : heroSummary ? (
            <section aria-labelledby="primary-trip-heading">
              <Card
                role="group"
                className="relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-white via-white to-sky-50 p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_60%)]" />
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex-1 space-y-3">
                      <h2
                        id="primary-trip-heading"
                        className="text-3xl font-semibold text-slate-900"
                        title={heroSummary.name}
                      >
                        {heroSummary.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-4 w-4" aria-hidden="true" />
                          {formatDateRange(heroSummary.startDate, heroSummary.endDate)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-4 w-4" aria-hidden="true" />
                          {getTravelersLabel(heroSummary.travelersCount)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          {getCountdownLabel(heroSummary.startDate, heroSummary.endDate)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-full bg-white/60 text-slate-500 hover:bg-white"
                            aria-label="Open trip quick actions"
                          >
                            <Ellipsis className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setLocation(`/trip/${heroSummary.id}?view=packing`)}>
                            View packing list
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLocation(`/trip/${heroSummary.id}?view=activities`)}>
                            Finalize activities
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLocation(`/trip/${heroSummary.id}?view=expenses`)}>
                            Log expense
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLocation(`/trip/${heroSummary.id}?view=members`)}>
                            Invite travelers
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        onClick={() => handleOpenTrip(heroSummary.id)}
                        className="rounded-full px-5"
                      >
                        Open trip
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {heroSummary.travelers.slice(0, 3).map((traveler, index) => (
                            <Avatar
                              key={`hero-avatar-${index}`}
                              className="h-10 w-10 border-2 border-white bg-slate-100"
                            >
                              <AvatarImage
                                src={traveler.avatar ?? undefined}
                                loading="lazy"
                                alt="Traveler avatar"
                              />
                              <AvatarFallback>{traveler.initial}</AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                        <Badge variant="secondary" className="rounded-full bg-white/70 text-slate-600">
                          Planning {heroSummary.progressPercent}%
                        </Badge>
                      </div>
                      {heroSummary.nextUp ? (
                        <Link
                          href={heroSummary.nextUp.href}
                          aria-label={heroSummary.nextUp.ariaLabel}
                          className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700"
                        >
                          {heroSummary.nextUp.label}
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      ) : null}
                    </div>
                    <Progress
                      value={heroSummary.progressPercent}
                      aria-label={`Planning progress ${heroSummary.progressPercent} percent`}
                      className="h-2 overflow-hidden rounded-full bg-white/60"
                    />
                    {isSameDay(startOfDay(parseISO(heroSummary.startDate)), startOfDay(new Date())) ? (
                      <Link
                        href={`/trip/${heroSummary.id}?view=schedule`}
                        className="text-sm text-sky-600 hover:text-sky-700"
                      >
                        View today’s schedule
                      </Link>
                    ) : null}
                  </div>
                </div>
              </Card>
            </section>
          ) : (
            <section>
              <Card className="flex flex-col items-center justify-center gap-4 rounded-2xl border-0 bg-white/90 p-10 text-center shadow-sm">
                <div className="text-3xl">🧭</div>
                <h2 className="text-2xl font-semibold text-slate-900">Plan your first trip</h2>
                <p className="max-w-md text-sm text-slate-600">
                  Create a trip to see it highlighted here with one clear next step to keep you moving.
                </p>
                <Button onClick={() => setShowCreateModal(true)} className="rounded-full px-6">
                  Plan a trip
                </Button>
              </Card>
            </section>
          )}

          <section className="space-y-4" aria-labelledby="upcoming-trips-heading">
            <div className="flex items-center justify-between">
              <h2 id="upcoming-trips-heading" className="text-xl font-semibold text-slate-900">
                Upcoming trips
              </h2>
              {upcomingSummaries.length === 0 && primaryTrip && (
                <p className="text-sm text-slate-500">You’re all set for now.</p>
              )}
            </div>
            {isLoading ? (
              <TripGridSkeleton />
            ) : upcomingSummaries.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {upcomingSummaries.map((trip) => (
                  <UpcomingTripCard key={trip.id} trip={trip} />
                ))}
              </div>
            ) : !primaryTrip ? (
              <Card className="rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="text-sm text-slate-500">
                  Future plans will appear here once you’ve created a trip.
                </p>
              </Card>
            ) : null}
            {upcomingSummaries.length === 0 && primaryTrip ? (
              <div className="flex justify-center pt-2">
                <Button variant="ghost" onClick={() => setShowCreateModal(true)} className="rounded-full">
                  Plan a trip
                </Button>
              </div>
            ) : null}
          </section>

          {pastTrips.length > 0 ? (
            <section className="space-y-4" aria-labelledby="past-trips-heading">
              <div className="flex items-center justify-between">
                <h2 id="past-trips-heading" className="text-xl font-semibold text-slate-900">
                  Recent trips
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {pastTrips.slice(0, 4).map((trip) => (
                  <Card
                    key={trip.id}
                    onClick={() => handleOpenTrip(trip.id)}
                    className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white/80 p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{trip.name || trip.destination}</h3>
                        <p className="text-sm text-slate-500">{formatDateRange(toDateString(trip.startDate), toDateString(trip.endDate))}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    </div>
                    <p className="text-xs text-slate-500">
                      {differenceInCalendarDays(now, parseISO(toDateString(trip.endDate)))} days ago
                    </p>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-4" aria-labelledby="insights-heading">
            <div className="flex items-center justify-between">
              <h2 id="insights-heading" className="text-xl font-semibold text-slate-900">
                Helpful insights
              </h2>
              {heroDetailsQuery.isError ? (
                <span className="text-xs text-amber-600">
                  Some suggestions aren’t available right now. Try again later.
                </span>
              ) : null}
            </div>
            {heroDetailsQuery.isLoading ? (
              <div className="grid gap-3 md:grid-cols-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <InsightSkeleton key={index} />
                ))}
              </div>
            ) : insights.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {insights.map((insight) => (
                  <Card key={insight.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/90 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{insight.title}</h3>
                        <p className="text-sm text-slate-600">{insight.description}</p>
                      </div>
                      <button
                        className="text-xs text-slate-400 hover:text-slate-500"
                        onClick={() => handleDismissInsight(insight.id)}
                        aria-label="Dismiss insight"
                      >
                        ×
                      </button>
                    </div>
                    <Button
                      variant="secondary"
                      className="w-fit rounded-full bg-slate-900 text-white hover:bg-slate-800"
                      onClick={() => setLocation(insight.action.href)}
                    >
                      {insight.action.label}
                    </Button>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="rounded-2xl border border-slate-200/80 bg-white/80 p-6 text-sm text-slate-600">
                We’ll surface new tips here as soon as we detect something that needs your attention.
              </Card>
            )}
          </section>
        </div>

        <aside className="lg:w-[320px] lg:flex lg:flex-col lg:gap-6">
          <section className="hidden lg:block">
            <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm">
              <button
                onClick={() => setIsConverterOpen(true)}
                className="flex w-full items-center justify-between gap-4 rounded-xl border border-slate-200/60 bg-slate-50/70 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-expanded={isConverterOpen}
              >
                <span>Convert currency 💱</span>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  {lastConversion ? (
                    <span className="hidden sm:inline">
                      {formatMiniConversion(lastConversion)}
                    </span>
                  ) : null}
                  <ChevronRight className="h-4 w-4" />
                </div>
              </button>
              <div className="mt-4">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between rounded-xl border-slate-200 text-slate-600">
                      <span>+ Add</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={() => primaryTrip && setLocation(`/trip/${primaryTrip.id}?view=activities`)}>
                      Activity
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => primaryTrip && setLocation(`/trip/${primaryTrip.id}?view=expenses`)}>
                      Expense
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => primaryTrip && setLocation(`/trip/${primaryTrip.id}?view=hotels`)}>
                      Hotel
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => primaryTrip && setLocation(`/trip/${primaryTrip.id}?view=flights`)}>
                      Flight
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </section>
        </aside>
      </main>

      {!isDesktop && (
        <button
          onClick={() => setIsConverterOpen(true)}
          className="fixed bottom-6 right-6 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-2xl text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
          aria-label="Open currency converter"
        >
          💱
        </button>
      )}

      <Suspense fallback={null}>
        <CurrencyConverterSheet
          open={isConverterOpen}
          onOpenChange={setIsConverterOpen}
          isDesktop={isDesktop}
          lastConversion={lastConversion}
          onConversion={handleConversionUpdate}
        />
      </Suspense>

      <CreateTripModal open={showCreateModal} onOpenChange={setShowCreateModal} />
    </div>
  );
}

type CurrencyConverterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDesktop: boolean;
  lastConversion: LastConversion | null;
  onConversion: (conversion: LastConversion) => void;
};

function CurrencyConverterSheet({
  open,
  onOpenChange,
  isDesktop,
  lastConversion,
  onConversion,
}: CurrencyConverterSheetProps) {
  if (!open) {
    return null;
  }

  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/30 p-6">
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
          <CurrencyConverterTool
            onClose={() => onOpenChange(false)}
            lastConversion={lastConversion}
            onConversion={onConversion}
          />
        </div>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-lg font-semibold text-slate-900">
            Convert currency
          </SheetTitle>
        </SheetHeader>
        <div className="h-full overflow-y-auto px-4 pb-8">
          <CurrencyConverterTool
            onClose={() => onOpenChange(false)}
            lastConversion={lastConversion}
            onConversion={onConversion}
            mobile
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatMiniConversion(conversion: LastConversion) {
  const amountFormatter = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  });
  return `${amountFormatter.format(conversion.amount)} ${conversion.from} → ${amountFormatter.format(conversion.result)} ${conversion.to}`;
}

