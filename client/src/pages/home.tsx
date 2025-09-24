import {
  useQuery,
  useMutation,
  useQueries,
  type UseQueryResult,
} from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Clock,
  Compass,
  ListChecks,
  MapPin,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Users,
  DollarSign,
  Timer,
  PlusCircle,
  ChevronRight,
  Wallet,
  Package,
  NotebookPen,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import { CreateTripModal } from "@/components/create-trip-modal";
import { NotificationIcon } from "@/components/notification-icon";
import { TravelLoading } from "@/components/LoadingSpinners";
import { TravelMascot } from "@/components/TravelMascot";
import { ManualRefreshButton } from "@/components/manual-refresh-button";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  TripWithDetails,
  ActivityWithDetails,
  PackingItem,
  ExpenseWithDetails,
  User,
} from "@shared/schema";

const DEFAULT_DESTINATION_IMAGE =
  "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80";

const DESTINATION_BACKGROUNDS = [
  {
    keywords: ["paris", "france"],
    image:
      "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=80",
  },
  {
    keywords: ["new york", "nyc"],
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80",
  },
  {
    keywords: ["tokyo", "japan"],
    image:
      "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1600&q=80",
  },
  {
    keywords: ["london", "england", "uk"],
    image:
      "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=1600&q=80",
  },
  {
    keywords: ["rome", "italy"],
    image:
      "https://images.unsplash.com/photo-1503264116251-35a269479413?auto=format&fit=crop&w=1600&q=80",
  },
  {
    keywords: ["beach", "island", "bali", "maldives"],
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80",
  },
  {
    keywords: ["mountain", "alps", "swiss", "colorado"],
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=80",
  },
  {
    keywords: ["desert", "morocco", "sahara"],
    image:
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=80",
  },
] as const;

const getDestinationImage = (destination?: string | null) => {
  if (!destination) return DEFAULT_DESTINATION_IMAGE;
  const lowerDestination = destination.toLowerCase();
  const match = DESTINATION_BACKGROUNDS.find(({ keywords }) =>
    keywords.some((keyword) => lowerDestination.includes(keyword))
  );
  return match?.image ?? DEFAULT_DESTINATION_IMAGE;
};

const getCountdownLabel = (startDate: string | Date) => {
  const start = new Date(startDate);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays > 1) {
    return `${diffDays} days to go`;
  }
  if (diffDays === 1) {
    return "1 day to go";
  }
  if (diffDays === 0) {
    return "Happening today";
  }
  return "In progress";
};

const DESTINATION_FUN_FACTS = [
  {
    keywords: ["tokyo", "japan"],
    facts: [
      "Tokyo holds more Michelin stars than any other city—prepare your taste buds!",
      "More than 3,000 people cross Shibuya Crossing at once. Time your group photo!",
      "Vending machines in Tokyo sell everything from umbrellas to ramen—perfect for late nights!",
    ],
  },
  {
    keywords: ["paris", "france"],
    facts: [
      "Parisians bake over 10 billion baguettes a year. Schedule a bakery crawl!",
      "The Eiffel Tower grows up to 6 inches taller in summer heat—sunset views hit different.",
      "There are more than 1,800 bakeries in Paris. Challenge the crew to taste the best croissant.",
    ],
  },
  {
    keywords: ["bali", "maldives", "beach"],
    facts: [
      "Sea turtles have been nesting on Bali's shores for centuries—add a conservation tour!",
      "Bali has over 10,000 temples. Sunrise at a cliffside shrine is an unforgettable kickoff.",
      "The Maldives glow at night thanks to bioluminescent plankton—plan a moonlit beach walk.",
    ],
  },
  {
    keywords: ["new york", "nyc"],
    facts: [
      "NYC's subway runs 24/7—perfect for late-night snack missions with the crew.",
      "There are 843 acres to explore in Central Park. Rent bikes to cover more ground together.",
      "The city hosts 400,000 street trees. Book a walking tour to find hidden green pockets.",
    ],
  },
] as const;

const DEFAULT_FUN_FACTS = [
  "Share your itinerary 48 hours before departure to keep everyone aligned.",
  "Drop packing must-haves into the shared list so nothing gets left behind.",
  "Rotate responsibilities—have one person track expenses each day.",
  "Collect everyone’s flight details to build a single arrival timeline.",
];

const getFunFactsForDestination = (destination?: string | null) => {
  if (!destination) return DEFAULT_FUN_FACTS;
  const lower = destination.toLowerCase();
  const match = DESTINATION_FUN_FACTS.find(({ keywords }) =>
    keywords.some((keyword) => lower.includes(keyword)),
  );
  return match?.facts ?? DEFAULT_FUN_FACTS;
};

type CountdownState = {
  status: "upcoming" | "today" | "inProgress" | "past";
  days: number;
  hours: number;
  minutes: number;
};

const calculateCountdownState = (
  startDate?: string | Date,
): CountdownState | null => {
  if (!startDate) return null;
  const target = new Date(startDate);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      status: diffMs > -1000 * 60 * 60 * 24 ? "today" : "inProgress",
      days: 0,
      hours: 0,
      minutes: 0,
    };
  }

  const totalMinutes = Math.max(0, Math.floor(diffMs / (1000 * 60)));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 24 * 60) / 60);
  const minutes = totalMinutes - days * 24 * 60 - hours * 60;

  return {
    status: "upcoming",
    days,
    hours,
    minutes,
  };
};

type TripActivitySummary = {
  nextActivity: ActivityWithDetails | null;
  totalActivities: number;
  upcomingActivities: number;
  completedActivities: number;
};

type StatKey = "upcoming" | "companions" | "destinations";

const calculatePlanningProgress = (
  trip: TripWithDetails,
  summary?: TripActivitySummary | null,
) => {
  const daysUntilStart = Math.max(
    0,
    Math.round(
      (new Date(trip.startDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const activityBoost = Math.min(40, (summary?.totalActivities ?? 0) * 10);
  const crewBoost = Math.min(20, Math.max(0, (trip.memberCount - 1) * 6));
  const urgencyBoost = Math.min(20, Math.max(0, 20 - daysUntilStart));
  const progress = 30 + activityBoost + crewBoost + urgencyBoost;
  return Math.max(20, Math.min(100, progress));
};

const getTripTags = (destination?: string | null) => {
  if (!destination) return ["Adventure"];
  const lower = destination.toLowerCase();
  const tags: string[] = [];
  if (/(beach|island|coast|bahamas|maldives|bali)/.test(lower)) {
    tags.push("Beach vibes");
  }
  if (/(mountain|alps|hike|trail|andes)/.test(lower)) {
    tags.push("Outdoor escape");
  }
  if (/(tokyo|paris|new york|london|city|urban)/.test(lower)) {
    tags.push("City lights");
  }
  if (!tags.length) {
    tags.push("Signature adventure");
  }
  return tags.slice(0, 2);
};

const formatActivityTimeRange = (activity: ActivityWithDetails) => {
  const start = new Date(activity.startTime);
  const end = activity.endTime ? new Date(activity.endTime) : null;
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const startTime = timeFormatter.format(start);
  const endTime = end ? timeFormatter.format(end) : null;
  return `${dateLabel} • ${startTime}${endTime ? ` – ${endTime}` : ""}`;
};

const getMemberInitial = (firstName?: string | null, email?: string | null) => {
  if (firstName && firstName.trim().length > 0) {
    return firstName[0]?.toUpperCase();
  }
  if (email && email.includes("@")) {
    return email[0]?.toUpperCase();
  }
  return "T";
};

const formatMemberName = (firstName?: string | null, email?: string | null) => {
  if (firstName && firstName.trim().length > 0) {
    return firstName;
  }
  if (email && email.includes("@")) {
    return email.split("@")[0];
  }
  return "Traveler";
};

export default function Home() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { toast } = useToast();

  const { data: trips, isLoading, error } = useQuery<TripWithDetails[]>({
    queryKey: ["/api/trips"],
    enabled: !!user,
    retry: false,
  });

  const deleteTripMutation = useMutation({
    mutationFn: async (tripId: number) => {
      return apiRequest(`/api/trips/${tripId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      toast({
        title: "Trip deleted",
        description: "Your past trip has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to delete trip",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    },
  });

  const formatDateRange = (
    startDate: string | Date,
    endDate: string | Date,
  ) => {
    const start =
      typeof startDate === "string" ? new Date(startDate) : startDate;
    const end = typeof endDate === "string" ? new Date(endDate) : endDate;
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  const handleLogout = async () => {
    console.log("Logout button clicked");
    localStorage.clear();
    sessionStorage.clear();
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch (logoutError) {
      console.error("Error logging out:", logoutError);
    } finally {
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  const [funFactIndex, setFunFactIndex] = useState(0);
  const [countdownState, setCountdownState] = useState<CountdownState | null>(
    null,
  );
  const [activeStat, setActiveStat] = useState<StatKey>("upcoming");

  const upcomingTrips = useMemo(() => {
    if (!trips) return [] as TripWithDetails[];
    const now = new Date();
    return trips.filter((trip) => new Date(trip.startDate) >= now);
  }, [trips]);

  const pastTrips = useMemo(() => {
    if (!trips) return [] as TripWithDetails[];
    const now = new Date();
    return trips.filter((trip) => new Date(trip.endDate) < now);
  }, [trips]);

  const sortedUpcomingTrips = useMemo(
    () =>
      [...upcomingTrips].sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      ),
    [upcomingTrips],
  );

  const highlightTrip = sortedUpcomingTrips[0];
  const highlightDestinationName = highlightTrip?.destination
    ? highlightTrip.destination.split(",")[0]?.trim() || highlightTrip.destination
    : undefined;

  const funFacts = useMemo(
    () => getFunFactsForDestination(highlightTrip?.destination),
    [highlightTrip?.destination],
  );

  useEffect(() => {
    setFunFactIndex(0);
  }, [funFacts]);

  useEffect(() => {
    if (funFacts.length <= 1) return;
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      setFunFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [funFacts]);

  useEffect(() => {
    setCountdownState(calculateCountdownState(highlightTrip?.startDate));
    if (!highlightTrip?.startDate) return;
    if (typeof window === "undefined") return;
    const interval = window.setInterval(() => {
      setCountdownState(calculateCountdownState(highlightTrip.startDate));
    }, 60000);
    return () => window.clearInterval(interval);
  }, [highlightTrip?.startDate]);

  const heroCountdownText = highlightTrip
    ? countdownState
      ? countdownState.status === "upcoming"
        ? `${countdownState.days}d ${countdownState.hours}h ${countdownState.minutes}m until takeoff`
        : countdownState.status === "today"
          ? "It's go day!"
          : "Adventure in motion"
      : getCountdownLabel(highlightTrip.startDate)
    : "Choose your next adventure";

  const heroSubtitle = highlightTrip
    ? countdownState?.status === "today"
      ? `It's go day for ${highlightDestinationName}! Check off your final details below.`
      : countdownState?.status === "upcoming"
        ? `Just ${Math.max(countdownState?.days ?? 0, 0)} day${
            (countdownState?.days ?? 0) === 1 ? "" : "s"
          } until ${highlightDestinationName}. Let's make sure everything is locked in.`
        : `You're already exploring ${highlightDestinationName}. Keep everyone aligned with live updates.`
    : "Plan something unforgettable—start by creating your next itinerary.";


  const uniqueMembersList = useMemo(() => {
    const memberMap = new Map<
      string,
      { id: string; name: string; image?: string | null }
    >();
    (trips ?? []).forEach((trip) => {
      (trip.members ?? []).forEach((member) => {
        const memberId = member.user?.id || member.userId;
        if (!memberId || memberMap.has(memberId)) return;
        memberMap.set(memberId, {
          id: memberId,
          name: formatMemberName(
            member.user.firstName,
            member.user.email,
          ),
          image: member.user.profileImageUrl,
        });
      });
    });
    return Array.from(memberMap.values());
  }, [trips]);

  const destinationSummaries = useMemo(() => {
    if (!trips) return [] as { destination: string; trips: TripWithDetails[] }[];
    const destinationMap = new Map<string, TripWithDetails[]>();
    trips.forEach((trip) => {
      const list = destinationMap.get(trip.destination) ?? [];
      list.push(trip);
      destinationMap.set(trip.destination, list);
    });
    return Array.from(destinationMap.entries()).map(([destination, list]) => ({
      destination,
      trips: list.sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
      ),
    }));
  }, [trips]);

  const uniqueCompanionsCount = uniqueMembersList.length;
  const uniqueDestinations = destinationSummaries.length;

  const upcomingActivitySummaries = useQueries({
    queries: sortedUpcomingTrips.map((trip) => ({
      queryKey: ["/api/trips", trip.id, "activities"] as const,
      enabled: !!user && sortedUpcomingTrips.length > 0,
      select: (activities: ActivityWithDetails[]) => {
        const sortedActivities = [...activities].sort(
          (a, b) =>
            new Date(a.startTime).getTime() -
            new Date(b.startTime).getTime(),
        );
        const now = new Date();
        const upcoming = sortedActivities.filter(
          (activity) => new Date(activity.startTime) >= now,
        );
        const completed = sortedActivities.length - upcoming.length;
        return {
          nextActivity: upcoming[0] ?? null,
          totalActivities: sortedActivities.length,
          upcomingActivities: upcoming.length,
          completedActivities: completed,
        } satisfies TripActivitySummary;
      },
    })),
  }) as UseQueryResult<TripActivitySummary>[];

  const highlightActivitySummary = upcomingActivitySummaries[0]?.data ?? null;
  const highlightTripId = highlightTrip?.id;

  const highlightPackingSummary = useQuery({
    queryKey: ["/api/trips", highlightTripId, "packing"],
    enabled: !!highlightTripId,
    select: (items: (PackingItem & { user: User })[]) => {
      const total = items.length;
      const completed = items.filter((item) => item.isChecked).length;
      return { total, completed };
    },
  });

  const highlightExpensesSummary = useQuery({
    queryKey: ["/api/trips", highlightTripId, "expenses"],
    enabled: !!highlightTripId,
    select: (expenses: ExpenseWithDetails[]) => ({
      total: expenses.length,
    }),
  });

  const packingTotals = highlightPackingSummary.data ?? {
    total: 0,
    completed: 0,
  };
  const packingProgress = packingTotals.total
    ? Math.round((packingTotals.completed / packingTotals.total) * 100)
    : 0;
  const expensesLogged = highlightExpensesSummary.data?.total ?? 0;
  const activeFunFact = funFacts[funFactIndex] ?? funFacts[0];
  const crewName = highlightDestinationName
    ? highlightDestinationName
    : highlightTrip
      ? highlightTrip.name.split(" ")[0] || "Travel"
      : "Travel";
  const crewNickname = `${crewName} crew`;
  const highlightPlanningProgress = highlightTrip
    ? calculatePlanningProgress(highlightTrip, highlightActivitySummary)
    : 0;
  const packingStatusLabel = packingTotals.total
    ? `${packingTotals.completed}/${packingTotals.total} items checked`
    : "Start building your shared packing list";
  const highlightNextActivity = highlightActivitySummary?.nextActivity ?? null;
  const highlightNextActivityTime = highlightNextActivity
    ? formatActivityTimeRange(highlightNextActivity)
    : null;
  const totalActivities = highlightActivitySummary?.totalActivities ?? 0;
  const upcomingActivitiesCount =
    highlightActivitySummary?.upcomingActivities ?? 0;
  const quickActions = [
    {
      label: "Currency toolkit",
      description: "Convert and split costs in seconds.",
      href: "/currency-converter",
      icon: DollarSign,
      accent: "bg-emerald-100 text-emerald-600",
    },
    {
      label: "Explore features",
      description: "Discover tools built for group travel.",
      href: "/how-it-works",
      icon: Compass,
      accent: "bg-sky-100 text-sky-600",
    },
    {
      label: "Profile & preferences",
      description: "Update your travel style and details.",
      href: "/profile",
      icon: Settings,
      accent: "bg-purple-100 text-purple-600",
    },
  ];
  const suggestions = highlightTrip
    ? [
        {
          id: "activities",
          icon: NotebookPen,
          accent: "bg-sky-100 text-sky-600",
          title: totalActivities
            ? `${totalActivities} plan${totalActivities === 1 ? "" : "s"} in motion`
            : `Kickstart ${crewName}'s itinerary`,
          description: highlightNextActivity
            ? `Next: ${highlightNextActivity.name} • ${highlightNextActivityTime}`
            : "Add a hero activity so everyone has something to look forward to.",
          actionLabel: totalActivities ? "Review itinerary" : "Add an activity",
          badge: upcomingActivitiesCount
            ? `${upcomingActivitiesCount} upcoming`
            : "Idea stage",
          href: `/trip/${highlightTrip.id}`,
        },
        {
          id: "expenses",
          icon: Wallet,
          accent: "bg-amber-100 text-amber-600",
          title: expensesLogged
            ? `Logged ${expensesLogged} expense${expensesLogged === 1 ? "" : "s"}`
            : "Split expenses early",
          description: expensesLogged
            ? "Double-check balances so everyone stays square."
            : "Capture the first shared cost to keep budgets aligned.",
          actionLabel: expensesLogged ? "View expenses" : "Log an expense",
          badge: expensesLogged ? "Money matters" : "Fresh start",
          href: `/trip/${highlightTrip.id}`,
        },
        {
          id: "packing",
          icon: Package,
          accent: "bg-emerald-100 text-emerald-600",
          title: packingTotals.total
            ? `Packing list ${packingProgress}% complete`
            : "Prep the packing list",
          description: packingTotals.total
            ? packingStatusLabel
            : "Add essentials so nothing gets left behind.",
          actionLabel: packingTotals.total ? "Review items" : "Add packing item",
          badge: packingTotals.total
            ? `${packingTotals.completed}/${packingTotals.total} checked`
            : "Shared list",
          href: `/trip/${highlightTrip.id}`,
        },
      ]
    : [
        {
          id: "dream",
          icon: Sparkles,
          accent: "bg-rose-100 text-rose-600",
          title: "Imagine the next getaway",
          description:
            "Create your first trip to unlock tailored suggestions for your crew.",
          actionLabel: "Plan a trip",
          badge: "Getting started",
          onAction: () => setShowCreateModal(true),
        },
        {
          id: "features",
          icon: NotebookPen,
          accent: "bg-sky-100 text-sky-600",
          title: "See how planning flows",
          description:
            "Explore how VacationSync keeps everyone aligned across activities, packing, and expenses.",
          actionLabel: "Tour the features",
          badge: "Guided tour",
          href: "/how-it-works",
        },
        {
          id: "profile",
          icon: Users,
          accent: "bg-emerald-100 text-emerald-600",
          title: "Personalize your profile",
          description:
            "Add your travel style and photo so the crew recognizes you instantly.",
          actionLabel: "Update profile",
          badge: "1 min setup",
          href: "/profile",
        },
      ];

  const stats = useMemo(
    () => [
      {
        key: "upcoming" as const,
        label: "Upcoming trips",
        value: upcomingTrips.length,
        icon: Calendar,
        accent: "bg-sky-100 text-sky-600",
        helper: upcomingTrips.length ? "View what's next" : "Plan a trip",
      },
      {
        key: "companions" as const,
        label: "Travel companions",
        value: uniqueCompanionsCount,
        icon: Users,
        accent: "bg-emerald-100 text-emerald-600",
        helper: uniqueCompanionsCount ? "See who's in" : "Invite friends",
      },
      {
        key: "destinations" as const,
        label: "Destinations",
        value: uniqueDestinations,
        icon: MapPin,
        accent: "bg-violet-100 text-violet-600",
        helper: uniqueDestinations ? "Browse list" : "Add a getaway",
      },
    ],
    [upcomingTrips.length, uniqueCompanionsCount, uniqueDestinations],
  );

  useEffect(() => {
    if (activeStat === "upcoming" && stats[0]?.value === 0) {
      if (stats[1]?.value > 0) {
        setActiveStat("companions");
      } else if (stats[2]?.value > 0) {
        setActiveStat("destinations");
      }
    }
  }, [stats, activeStat]);

  const renderStatDetail = () => {
    if (activeStat === "upcoming") {
      if (!sortedUpcomingTrips.length) {
        return (
          <p className="text-sm text-slate-600">
            Plan a new adventure to unlock a snapshot of what’s coming up next.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {sortedUpcomingTrips.slice(0, 3).map((trip, index) => {
            const summary = upcomingActivitySummaries[index]?.data;
            const tripTags = getTripTags(trip.destination);
            return (
              <Link
                key={trip.id}
                href={`/trip/${trip.id}`}
                className="group flex items-start justify-between rounded-2xl border border-slate-200 bg-white/90 p-3 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
              >
                <div className="space-y-2">
                  <div>
                    <p className="font-semibold text-slate-900">{trip.name}</p>
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      {formatDateRange(trip.startDate, trip.endDate)}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600">
                    {summary?.nextActivity
                      ? `Next: ${summary.nextActivity.name}`
                      : "Add your first activity to set the tone."}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {tripTags.map((tag) => (
                      <Badge
                        key={tag}
                        className="rounded-full bg-slate-100 px-2 py-0 text-xs font-medium text-slate-600"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <span className="text-sm font-medium text-slate-700">
                    {getCountdownLabel(trip.startDate)}
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400 transition group-hover:text-slate-600" />
                </div>
              </Link>
            );
          })}
          {sortedUpcomingTrips.length > 3 && (
            <p className="text-xs text-slate-500">
              Showing the next three adventures. Visit your trip hub to see the full list.
            </p>
          )}
        </div>
      );
    }

    if (activeStat === "companions") {
      if (!uniqueMembersList.length) {
        return (
          <p className="text-sm text-slate-600">
            Invite your crew to start seeing faces and roles appear here.
          </p>
        );
      }

      return (
        <ScrollArea className="max-h-56">
          <div className="space-y-3 pr-2">
            {uniqueMembersList.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    {member.image ? (
                      <AvatarImage src={member.image} alt={member.name} />
                    ) : (
                      <AvatarFallback className="bg-slate-100 text-sm font-semibold text-slate-600">
                        {member.name[0]?.toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <p className="font-medium text-slate-900">{member.name}</p>
                    <p className="text-xs text-slate-500">Travel companion</p>
                  </div>
                </div>
                <Users className="h-4 w-4 text-emerald-500" />
              </div>
            ))}
          </div>
        </ScrollArea>
      );
    }

    if (activeStat === "destinations") {
      if (!destinationSummaries.length) {
        return (
          <p className="text-sm text-slate-600">
            Every new trip adds a destination snapshot right here.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {destinationSummaries.slice(0, 4).map(({ destination, trips }) => {
            const upcoming = trips.find(
              (trip) => new Date(trip.startDate) >= new Date(),
            );
            const referenceTrip = upcoming ?? trips[0];
            return (
              <div
                key={destination}
                className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm"
              >
                <div>
                  <p className="font-semibold text-slate-900">{destination}</p>
                  <p className="text-sm text-slate-600">
                    {referenceTrip
                      ? formatDateRange(
                          referenceTrip.startDate,
                          referenceTrip.endDate,
                        )
                      : "Dates to be announced"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {trips.length} trip{trips.length === 1 ? "" : "s"} planned
                  </p>
                </div>
                <MapPin className="h-5 w-5 text-violet-500" />
              </div>
            );
          })}
          {destinationSummaries.length > 4 && (
            <p className="text-xs text-slate-500">
              Keep building your map—only the first four destinations are shown here.
            </p>
          )}
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <TravelLoading
          variant="travel"
          size="lg"
          text="Loading your travel dashboard..."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl">
          <div className="mb-6 flex justify-center">
            <TravelMascot type="plane" animated={false} className="text-primary" />
          </div>
          <h2 className="mb-3 text-xl font-bold text-slate-900">Session issue</h2>
          <p className="mb-6 text-slate-600">
            Your session has expired. Click the refresh button to log in again and continue using the app.
          </p>
          <ManualRefreshButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-r from-sky-50 via-white to-rose-100 p-8 shadow-sm sm:p-12">
            <div className="absolute inset-0">
              <img
                src={getDestinationImage(highlightTrip?.destination)}
                alt={
                  highlightDestinationName
                    ? `Scenic view of ${highlightDestinationName}`
                    : "Colorful travel collage"
                }
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px]" />
            </div>
            <div className="relative z-10 flex h-full flex-col justify-between gap-8 text-slate-900">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-2 rounded-full bg-white/85 px-4 py-1.5 font-semibold text-slate-700 shadow-sm backdrop-blur">
                    <Timer className="h-4 w-4 text-amber-500" />
                    {heroCountdownText}
                  </div>
                  <div className="flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur">
                    {highlightTrip ? (
                      <>
                        <Users className="h-4 w-4 text-sky-600" />
                        Team {crewName} is almost ready
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        Next adventure awaits
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    Welcome back, {user?.firstName || "Traveler"} 👋
                  </h1>
                  <p className="text-xs font-medium uppercase tracking-[0.35em] text-slate-500">
                    {highlightTrip ? crewNickname : "Invite your travel crew"}
                  </p>
                  <p className="max-w-2xl text-lg text-slate-700">{heroSubtitle}</p>
                </div>
                <div className="grid gap-3 sm:max-w-xl sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur">
                    <div className="flex items-start gap-3">
                      <Sparkles className="mt-0.5 h-5 w-5 text-amber-500" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800">
                          Travel fun fact
                        </p>
                        <p className="text-sm text-slate-600">{activeFunFact}</p>
                      </div>
                    </div>
                    {funFacts.length > 1 && (
                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Tip {funFactIndex + 1} of {funFacts.length}
                      </p>
                    )}
                  </div>
                  {highlightTrip && (
                    <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">
                            Planning progress
                          </p>
                          <p className="text-sm text-slate-600">
                            {highlightTrip.name} is {highlightPlanningProgress}% ready
                          </p>
                        </div>
                        <Badge className="rounded-full bg-white/60 px-3 py-1 text-xs font-medium text-slate-700">
                          {packingTotals.total
                            ? `${packingProgress}% packed`
                            : "Just getting started"}
                        </Badge>
                      </div>
                      <Progress
                        value={highlightPlanningProgress}
                        className="mt-3 h-2 bg-white/60"
                      />
                      <p className="mt-3 text-xs text-slate-600">
                        {packingStatusLabel}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button
                    size="lg"
                    className="bg-primary px-6 text-white shadow-md transition hover:shadow-lg"
                    onClick={() => {
                      console.log("Create trip button clicked, setting modal to true");
                      setShowCreateModal(true);
                    }}
                    data-onboarding="create-trip"
                  >
                    <Plus className="h-5 w-5" />
                    Plan New Trip
                  </Button>
                  {highlightTrip && (
                    <Button
                      variant="secondary"
                      size="lg"
                      className="bg-white/80 px-6 text-slate-800 shadow-sm backdrop-blur transition hover:bg-white"
                      asChild
                    >
                      <Link href={`/trip/${highlightTrip.id}`}>
                        <ListChecks className="mr-2 h-5 w-5 text-emerald-600" />
                        Check packing list
                      </Link>
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {highlightTrip && (
                    <Button
                      variant="ghost"
                      size="lg"
                      className="flex items-center gap-2 rounded-full bg-white/0 px-4 text-slate-700 hover:bg-white/60 hover:text-slate-900"
                      asChild
                    >
                      <Link href={`/trip/${highlightTrip.id}`}>
                        <NotebookPen className="h-4 w-4" />
                        Finalize activities
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="lg"
                    className="flex items-center gap-2 rounded-full px-4 text-slate-700 hover:bg-white/60 hover:text-slate-900"
                    asChild
                  >
                    <Link href="/how-it-works">
                      Learn how VacationSync keeps everyone aligned
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-3 -right-3 hidden lg:block">
              <TravelMascot type="plane" size="lg" />
            </div>
          </div>

          <Card className="rounded-3xl border-slate-200 shadow-sm">
            <CardHeader className="space-y-1 pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Quick actions
                </CardTitle>
                <NotificationIcon />
              </div>
              <p className="text-sm text-slate-600">
                Jump back into the tools you need most.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="grid gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.label}
                      href={action.href}
                      className="group flex items-center justify-between rounded-2xl border border-slate-200 bg-white/90 p-4 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${action.accent}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{action.label}</p>
                          <p className="text-sm text-slate-600">{action.description}</p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-5 w-5 text-slate-400 transition group-hover:text-slate-600" />
                    </Link>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-700">
                    <PlusCircle className="h-5 w-5 text-primary" />
                    <span className="font-semibold">Need to add something quick?</span>
                  </div>
                  <Badge className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    Quick add
                  </Badge>
                </div>
                <p>
                  Drop a new activity, expense, or note so the crew stays aligned while you prep.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="rounded-full bg-primary px-4 text-white hover:bg-primary/90"
                    onClick={() => {
                      if (highlightTrip) {
                        window.location.href = `/trip/${highlightTrip.id}`;
                      } else {
                        setShowCreateModal(true);
                      }
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    + Add something
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-3 text-slate-700 hover:bg-white hover:text-slate-900"
                    asChild
                  >
                    <Link href={highlightTrip ? `/trip/${highlightTrip.id}` : "/how-it-works"}>
                      View team hub
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
              <Button
                variant="ghost"
                className="justify-start px-3 text-slate-500 hover:text-slate-900"
                onClick={handleLogout}
              >
                Log out
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-3xl border-slate-200 shadow-sm">
          <CardContent className="space-y-6 p-6">
            <div className="grid gap-3 md:grid-cols-3">
              {stats.map((stat) => {
                const Icon = stat.icon;
                const isActive = activeStat === stat.key;
                return (
                  <button
                    key={stat.key}
                    type="button"
                    onClick={() => setActiveStat(stat.key)}
                    className={`group flex items-center justify-between rounded-2xl border p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                      isActive
                        ? "border-slate-400 bg-white shadow-md"
                        : "border-slate-200 bg-white/70 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.accent}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-2xl font-semibold text-slate-900">
                          {stat.value}
                        </p>
                        <p className="text-sm text-slate-600">{stat.label}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right">
                      <span className="text-xs font-medium text-slate-500">
                        {stat.helper}
                      </span>
                      <ChevronRight
                        className={`h-5 w-5 transition ${
                          isActive
                            ? "text-slate-700"
                            : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              {renderStatDetail()}
            </div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Upcoming adventures</h2>
              <p className="text-sm text-slate-600">Keep tabs on what’s coming up next.</p>
            </div>
            {highlightTrip && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-slate-200"
                asChild
              >
                <Link href={`/trip/${highlightTrip.id}`}>
                  Open {highlightTrip.name}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>

          {upcomingTrips.length === 0 ? (
            <Card className="rounded-3xl border-dashed border-slate-200 bg-white shadow-sm">
              <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                <TravelMascot type="map" size="lg" animated={false} />
                <h3 className="text-lg font-semibold text-slate-900">
                  No upcoming trips yet
                </h3>
                <p className="max-w-md text-slate-600">
                  Start planning your next getaway and invite your travel crew to collaborate.
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-primary text-white hover:bg-primary/90"
                  data-onboarding="create-trip"
                >
                  <Plus className="h-4 w-4" />
                  Plan your first trip
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {sortedUpcomingTrips.map((trip, index) => {
                const summary = upcomingActivitySummaries[index]?.data;
                const nextActivity = summary?.nextActivity ?? null;
                const nextActivityTime = nextActivity
                  ? formatActivityTimeRange(nextActivity)
                  : null;
                const planningProgress = calculatePlanningProgress(
                  trip,
                  summary,
                );
                const tags = getTripTags(trip.destination);

                return (
                  <Card
                    key={trip.id}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                  <div className="relative h-40 w-full overflow-hidden">
                    <img
                      src={getDestinationImage(trip.destination)}
                      alt={`Scenic view of ${trip.destination}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-white/80">
                          Adventure
                        </p>
                        <h3 className="text-lg font-semibold leading-tight">
                          {trip.name}
                        </h3>
                      </div>
                      <Badge className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur">
                        <Users className="h-3.5 w-3.5" />
                        {trip.memberCount}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="space-y-4 p-6">
                    <div className="space-y-3 text-sm text-slate-600">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                          <MapPin className="h-4 w-4" />
                        </span>
                        <span className="font-medium text-slate-900">
                          {trip.destination}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                          <Calendar className="h-4 w-4" />
                        </span>
                        <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                          <Clock className="h-4 w-4" />
                        </span>
                        <span className="font-medium text-slate-900">
                          {getCountdownLabel(trip.startDate)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-sm text-slate-600">
                          <span className="font-semibold text-slate-900">
                            Planning progress
                          </span>
                          <span className="text-xs font-medium text-slate-500">
                            {planningProgress}% ready
                          </span>
                        </div>
                        <Progress value={planningProgress} className="mt-2 h-2" />
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-3">
                        <div className="flex items-start gap-3">
                          <ListChecks className="mt-0.5 h-4 w-4 text-emerald-500" />
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              {nextActivity
                                ? nextActivity.name
                                : "Build out your itinerary"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {nextActivityTime ||
                                "Add an activity so everyone knows what’s next."}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <Badge
                            key={`${trip.id}-${tag}`}
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                          >
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 pt-2">
                      <div className="flex -space-x-2">
                        {(trip.members || []).slice(0, 3).map((member) => (
                          <div
                            key={member.id}
                            className="h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-slate-200 ring-1 ring-slate-200"
                          >
                            {member.user.profileImageUrl ? (
                              <img
                                src={member.user.profileImageUrl}
                                alt={formatMemberName(
                                  member.user.firstName,
                                  member.user.email,
                                )}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                                {getMemberInitial(
                                  member.user.firstName,
                                  member.user.email,
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                        {trip.memberCount > 3 && (
                          <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                            +{trip.memberCount - 3}
                          </div>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="rounded-full px-4"
                        asChild
                      >
                        <Link href={`/trip/${trip.id}`}>View trip</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Helpful insights</h2>
              <p className="text-sm text-slate-600">
                {highlightTrip
                  ? `Smart nudges to keep ${crewNickname} aligned before takeoff.`
                  : "Smart nudges to help you set the stage for an unforgettable adventure."}
              </p>
            </div>
          </div>
          <Carousel className="relative" opts={{ align: "start", slidesToScroll: 1 }}>
            <CarouselContent className="-ml-2">
              {suggestions.map((suggestion) => {
                const Icon = suggestion.icon;
                return (
                  <CarouselItem
                    key={suggestion.id}
                    className="pl-2 md:basis-1/2 lg:basis-1/3"
                  >
                    <Card className="h-full rounded-3xl border-slate-200 bg-white shadow-sm">
                      <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-10 w-10 items-center justify-center rounded-2xl ${suggestion.accent}`}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                              {suggestion.badge}
                            </p>
                            <h3 className="text-base font-semibold text-slate-900">
                              {suggestion.title}
                            </h3>
                            <p className="text-sm text-slate-600">
                              {suggestion.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <Button
                            size="sm"
                            className="rounded-full px-4"
                            onClick={
                              suggestion.href ? undefined : suggestion.onAction
                            }
                            asChild={!!suggestion.href}
                          >
                            {suggestion.href ? (
                              <Link href={suggestion.href}>
                                {suggestion.actionLabel}
                                <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                            ) : (
                              <span className="flex items-center gap-2">
                                {suggestion.actionLabel}
                                <ArrowRight className="h-4 w-4" />
                              </span>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
            <CarouselPrevious className="-left-6 hidden md:flex" />
            <CarouselNext className="-right-6 hidden md:flex" />
          </Carousel>
        </section>

        {pastTrips.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Past trips</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pastTrips.map((trip) => (
                <Card
                  key={trip.id}
                  className="rounded-3xl border border-slate-200 bg-white/90 shadow-sm transition-shadow hover:shadow-md"
                >
                  <CardContent className="space-y-4 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <Link href={`/trip/${trip.id}`} className="flex-1">
                        <h3 className="text-lg font-semibold text-slate-900 transition-colors hover:text-primary">
                          {trip.name}
                        </h3>
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                          Completed
                        </Badge>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-400 hover:bg-red-50 hover:text-red-600"
                              data-testid={`delete-trip-${trip.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Past Trip</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{trip.name}"? This action cannot be undone and will permanently remove all trip data including activities, expenses, and memories.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTripMutation.mutate(trip.id)}
                                disabled={deleteTripMutation.isPending}
                                className="bg-red-600 hover:bg-red-700"
                                data-testid={`confirm-delete-trip-${trip.id}`}
                              >
                                {deleteTripMutation.isPending
                                  ? "Deleting..."
                                  : "Delete Trip"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <Link href={`/trip/${trip.id}`}>
                      <div className="space-y-3 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-500" />
                          <span>{trip.destination}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-500" />
                          <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
                        </div>
                      </div>
                    </Link>
                    <div className="flex -space-x-2">
                      {(trip.members || []).slice(0, 3).map((member) => (
                        <div
                          key={member.id}
                          className="h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-slate-200 ring-1 ring-slate-200"
                        >
                          {member.user.profileImageUrl ? (
                            <img
                              src={member.user.profileImageUrl}
                              alt={formatMemberName(
                                member.user.firstName,
                                member.user.email,
                              )}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600">
                              {getMemberInitial(
                                member.user.firstName,
                                member.user.email,
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      {trip.memberCount > 3 && (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                          +{trip.memberCount - 3}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}
      </div>

      <CreateTripModal
        open={showCreateModal}
        onOpenChange={(open) => {
          console.log("CreateTripModal onOpenChange called with:", open);
          setShowCreateModal(open);
        }}
      />
    </div>
  );
}
