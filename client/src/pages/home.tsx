import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowRight,
  ArrowUpRight,
  Calendar,
  Clock,
  Compass,
  Heart,
  Lightbulb,
  ListChecks,
  MapPin,
  Plane,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  Users,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { CreateTripModal } from "@/components/create-trip-modal";
import { NotificationIcon } from "@/components/notification-icon";
import { TravelLoading } from "@/components/LoadingSpinners";
import { TravelMascot } from "@/components/TravelMascot";
import { ManualRefreshButton } from "@/components/manual-refresh-button";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseDateValue } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { TripWithDetails } from "@shared/schema";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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

const DESTINATION_FUN_FACTS: { keywords: string[]; facts: string[] }[] = [
  {
    keywords: ["tokyo", "japan"],
    facts: [
      "Tokyo is home to more Michelin-starred restaurants than any other city on the planet.",
      "Subways in Tokyo are so punctual that a delay of five minutes earns passengers a formal apology note.",
    ],
  },
  {
    keywords: ["paris", "france"],
    facts: [
      "The Eiffel Tower grows about 6 inches taller during summer as the metal expands in the heat.",
      "Paris has more than 60 open-air markets, perfect for picnic supplies with your travel crew.",
    ],
  },
  {
    keywords: ["new york", "nyc", "manhattan"],
    facts: [
      "New York City's subway system spans more than 665 miles of track—perfect for spontaneous exploring.",
      "Over 800 languages are spoken in New York, making it one of the most linguistically diverse cities in the world.",
    ],
  },
  {
    keywords: ["london", "england", "uk"],
    facts: [
      "In London, you’re never more than two miles from a spot associated with Sherlock Holmes.",
      "The London Underground was the first metro system in the world, opening in 1863.",
    ],
  },
  {
    keywords: ["rome", "italy"],
    facts: [
      "Romans built a 53,000-mile road network—no wonder every path seems to lead to the next discovery.",
      "Gelato was invented in Florence, but Romans eat more of it per capita than anywhere else in Italy.",
    ],
  },
  {
    keywords: ["beach", "island", "bali", "maldives", "hawaii"],
    facts: [
      "Packing sunscreen in reusable containers can save space and reduce plastic waste on beach trips.",
      "Morning beach walks are proven to boost serotonin—schedule one for day one of your getaway.",
    ],
  },
  {
    keywords: ["mountain", "alps", "colorado", "hike", "rocky"],
    facts: [
      "At high altitudes you burn up to 30% more calories—perfect excuse for that extra campfire treat.",
      "Layering is key: temperatures can swing 20°F or more between trailhead and summit in the mountains.",
    ],
  },
];

const DEFAULT_FUN_FACTS = [
  "Packing cubes can free up 30% more luggage space for souvenirs.",
  "Share live locations with your crew to make meetups stress-free.",
  "A group playlist sets the vibe—queue songs before wheels up.",
  "Snap photos of receipts as you go to make expense splitting painless.",
];

const getDestinationImage = (destination?: string | null) => {
  if (!destination) return DEFAULT_DESTINATION_IMAGE;
  const lowerDestination = destination.toLowerCase();
  const match = DESTINATION_BACKGROUNDS.find(({ keywords }) =>
    keywords.some((keyword) => lowerDestination.includes(keyword))
  );
  return match?.image ?? DEFAULT_DESTINATION_IMAGE;
};

const getFunFactsForDestination = (destination?: string | null) => {
  if (!destination) {
    return DEFAULT_FUN_FACTS;
  }
  const lowerDestination = destination.toLowerCase();
  const match = DESTINATION_FUN_FACTS.find(({ keywords }) =>
    keywords.some((keyword) => lowerDestination.includes(keyword))
  );
  return match?.facts ?? DEFAULT_FUN_FACTS;
};

const getTeamLabel = (trip?: TripWithDetails | null) => {
  if (!trip) {
    return null;
  }
  const primaryDestination = trip.destination
    ?.split(",")[0]
    ?.trim();
  if (primaryDestination && primaryDestination.length > 0) {
    return `Team ${primaryDestination}`;
  }
  const trimmedName = trip.name?.trim();
  if (trimmedName && trimmedName.length > 0) {
    return `${trimmedName} crew`;
  }
  return null;
};

const MS_IN_DAY = 1000 * 60 * 60 * 24;

const getDaysUntilTrip = (startDate: string | Date) => {
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((start.getTime() - now.getTime()) / MS_IN_DAY);
};

const calculatePlanningProgress = (trip: TripWithDetails) => {
  const daysUntil = getDaysUntilTrip(trip.startDate);
  const companionBoost = Math.min(30, Math.max(0, trip.memberCount - 1) * 12);
  const photoBoost = Math.min(
    15,
    trip.members.filter((member) => !!member.user.profileImageUrl).length * 5,
  );
  const urgencyBoost =
    daysUntil <= 3
      ? 25
      : daysUntil <= 7
        ? 20
        : daysUntil <= 14
          ? 15
          : daysUntil <= 30
            ? 10
            : 0;
  const progress = 35 + companionBoost + photoBoost + urgencyBoost;
  return Math.max(25, Math.min(progress, 96));
};

type TripTagDefinition = {
  keywords: string[];
  label: string;
};

const TRIP_TAG_LIBRARY: TripTagDefinition[] = [
  { keywords: ["beach", "island", "coast", "maldives", "bali"], label: "Beach" },
  { keywords: ["mountain", "alps", "hike", "rocky", "trail"], label: "Adventure" },
  { keywords: ["tokyo", "new york", "paris", "london", "city"], label: "City Escape" },
  { keywords: ["wedding", "bachelor", "bachelorette", "celebration"], label: "Celebration" },
  { keywords: ["conference", "business", "work"], label: "Business Trip" },
  { keywords: ["family", "kids", "parents"], label: "Family Time" },
];

const getTripTags = (trip: TripWithDetails) => {
  const lowerName = trip.name?.toLowerCase() ?? "";
  const lowerDestination = trip.destination?.toLowerCase() ?? "";
  const detected = new Set<string>();

  TRIP_TAG_LIBRARY.forEach(({ keywords, label }) => {
    if (
      keywords.some(
        (keyword) =>
          lowerName.includes(keyword) || lowerDestination.includes(keyword),
      )
    ) {
      detected.add(label);
    }
  });

  if (detected.size === 0) {
    if (trip.memberCount >= 4) {
      detected.add("Crew Adventure");
    }
    if (lowerDestination.includes("park") || lowerDestination.includes("trail")) {
      detected.add("Outdoors");
    }
  }

  if (detected.size === 0) {
    detected.add("Explorer");
  }

  return Array.from(detected).slice(0, 3);
};

const getTripNextStep = (trip: TripWithDetails) => {
  const daysUntil = getDaysUntilTrip(trip.startDate);

  if (daysUntil <= 0) {
    return "Share live updates while you're on the ground.";
  }
  if (daysUntil <= 2) {
    return "Double-check check-in times and airport transfers.";
  }
  if (daysUntil <= 7) {
    return "Confirm reservations and lock down the final schedule.";
  }
  if (daysUntil <= 14) {
    return "Add one more standout activity to keep the crew excited.";
  }
  return "Start a conversation about everyone's must-do experiences.";
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

type StatType = "upcomingTrips" | "travelCompanions" | "destinations";

interface StatDefinition {
  type: StatType;
  label: string;
  value: number;
  icon: LucideIcon;
  accent: string;
}

interface CompanionDetail {
  id: string;
  name: string;
  email: string | null;
  trips: string[];
  initial: string;
}

interface DestinationDetail {
  name: string;
  totalTrips: number;
  upcomingTrips: number;
}

export default function Home() {
  const { user } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStat, setSelectedStat] = useState<StatType | null>(null);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
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
      typeof startDate === "string"
        ? parseDateValue(startDate) ?? new Date(startDate)
        : startDate;
    const end =
      typeof endDate === "string"
        ? parseDateValue(endDate) ?? new Date(endDate)
        : endDate;
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  };

  const getUpcomingTrips = () => {
    if (!trips) return [];
    const now = new Date();
    return trips.filter((trip) => {
      const tripStart = parseDateValue(trip.startDate) ?? new Date(trip.startDate);
      return tripStart >= now;
    });
  };

  const getPastTrips = () => {
    if (!trips) return [];
    const now = new Date();
    return trips.filter((trip) => {
      const tripEnd = parseDateValue(trip.endDate) ?? new Date(trip.endDate);
      return tripEnd < now;
    });
  };

  const handleStatClick = (statType: StatType) => {
    setSelectedStat(statType);
    setIsStatsDialogOpen(true);
  };

  const handleStatsDialogOpenChange = (open: boolean) => {
    setIsStatsDialogOpen(open);
    if (!open) {
      setSelectedStat(null);
    }
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

  const upcomingTrips = getUpcomingTrips();
  const pastTrips = getPastTrips();
  const totalCompanions =
    trips?.reduce((total, trip) => total + trip.memberCount, 0) ?? 0;
  const uniqueDestinations = trips
    ? new Set(trips.map((trip) => trip.destination)).size
    : 0;
  const sortedUpcomingTrips = [...upcomingTrips].sort(
    (a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
  );
  const highlightTrip = sortedUpcomingTrips[0];
  const highlightCountdown = highlightTrip
    ? getCountdownLabel(highlightTrip.startDate)
    : undefined;
  const highlightDestinationName = highlightTrip?.destination
    ? highlightTrip.destination.split(",")[0]?.trim() || highlightTrip.destination
    : undefined;
  const teamLabel = getTeamLabel(highlightTrip);
  const heroGreeting = `Welcome back, ${user?.firstName || "Traveler"} 👋`;
  const heroHeadline = highlightTrip
    ? `${
        teamLabel ??
        (highlightDestinationName
          ? `Team ${highlightDestinationName}`
          : highlightTrip.name)
      } is almost ready!`
    : "Your next adventure is waiting.";
  const heroSubtitle = highlightTrip
    ? highlightCountdown === "Happening today"
      ? `It's go day for ${highlightDestinationName}! Check off your final details below.`
      : highlightCountdown === "In progress"
        ? `You're already exploring ${highlightDestinationName}. Keep everyone aligned with live updates.`
        : `${highlightCountdown} until ${highlightDestinationName}. Let's make sure everything is locked in.`
    : "Plan something unforgettable—start by creating your next itinerary.";
  const funFacts = useMemo(
    () => getFunFactsForDestination(highlightTrip?.destination),
    [highlightTrip?.destination],
  );
  useEffect(() => {
    setFactIndex(0);
  }, [highlightTrip?.id, funFacts.length]);
  useEffect(() => {
    if (funFacts.length <= 1) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const timer = window.setInterval(() => {
      setFactIndex((prev) => (prev + 1) % funFacts.length);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [funFacts]);
  const currentFunFact =
    funFacts.length > 0 ? funFacts[factIndex % funFacts.length] : undefined;
  const stats: StatDefinition[] = [
    {
      type: "upcomingTrips",
      label: "Upcoming trips",
      value: upcomingTrips.length,
      icon: Calendar,
      accent: "bg-sky-100 text-sky-600",
    },
    {
      type: "travelCompanions",
      label: "Travel companions",
      value: totalCompanions,
      icon: Users,
      accent: "bg-emerald-100 text-emerald-600",
    },
    {
      type: "destinations",
      label: "Destinations",
      value: uniqueDestinations,
      icon: MapPin,
      accent: "bg-violet-100 text-violet-600",
    },
  ];

  const quickActions = [
    {
      title: "Currency toolkit",
      description: "Live rates and quick conversions for the crew.",
      href: "/currency-converter",
      icon: DollarSign,
      accent: "bg-emerald-100 text-emerald-600",
    },
    {
      title: "Explore features",
      description: "Discover collaborative tools you haven't tried yet.",
      href: "/how-it-works",
      icon: Compass,
      accent: "bg-sky-100 text-sky-600",
    },
    {
      title: "Profile & preferences",
      description: "Tune notifications and travel details in seconds.",
      href: "/profile",
      icon: Settings,
      accent: "bg-violet-100 text-violet-600",
    },
  ] as const;

  const quickAddItems: { label: string; href: string; icon: LucideIcon }[] = highlightTrip
    ? [
        {
          label: "Add activity",
          href: `/trip/${highlightTrip.id}?view=activities`,
          icon: Sparkles,
        },
        {
          label: "Log an expense",
          href: `/trip/${highlightTrip.id}?view=expenses`,
          icon: DollarSign,
        },
        {
          label: "Open packing list",
          href: `/trip/${highlightTrip.id}?view=packing`,
          icon: ListChecks,
        },
        {
          label: "Add to wish list",
          href: `/trip/${highlightTrip.id}?view=wish-list`,
          icon: Heart,
        },
      ]
    : [];

  const companionMap = new Map<string, CompanionDetail>();
  (trips ?? []).forEach((trip) => {
    const tripName = trip.name?.trim() || "Unnamed trip";
    (trip.members ?? []).forEach((member) => {
      const user = member.user;
      if (!user?.id) {
        return;
      }
      const existingCompanion = companionMap.get(user.id);
      const companionName = formatMemberName(user.firstName, user.email);
      const companionInitial = getMemberInitial(user.firstName, user.email);
      const email = user.email ?? null;

      if (existingCompanion) {
        if (!existingCompanion.trips.includes(tripName)) {
          existingCompanion.trips.push(tripName);
        }
      } else {
        companionMap.set(user.id, {
          id: user.id,
          name: companionName,
          email,
          trips: [tripName],
          initial: companionInitial,
        });
      }
    });
  });
  const companionDetails = Array.from(companionMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const destinationMap = new Map<string, DestinationDetail>();
  const currentDate = new Date();
  (trips ?? []).forEach((trip) => {
    const rawDestination = trip.destination ?? "Destination TBA";
    const displayDestination =
      rawDestination && rawDestination.trim().length > 0
        ? rawDestination.trim()
        : "Destination TBA";
    const mapKey = rawDestination || "Destination TBA";
    const existingDestination = destinationMap.get(mapKey);
    const tripStart = parseDateValue(trip.startDate) ?? new Date(trip.startDate);
    const isUpcoming = tripStart >= currentDate;

    if (existingDestination) {
      existingDestination.totalTrips += 1;
      if (isUpcoming) {
        existingDestination.upcomingTrips += 1;
      }
    } else {
      destinationMap.set(mapKey, {
        name: displayDestination,
        totalTrips: 1,
        upcomingTrips: isUpcoming ? 1 : 0,
      });
    }
  });
  const destinationDetails = Array.from(destinationMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const topCompanions = companionDetails.slice(0, 3);
  const extraCompanionCount = Math.max(
    companionDetails.length - topCompanions.length,
    0,
  );
  const topDestinations = destinationDetails.slice(0, 3);
  const extraDestinationCount = Math.max(
    destinationDetails.length - topDestinations.length,
    0,
  );
  const highlightNextStep = highlightTrip ? getTripNextStep(highlightTrip) : null;

  type InsightCard = {
    title: string;
    description: string;
    icon: LucideIcon;
    accent: string;
    actionLabel: string;
    href?: string;
    onClick?: () => void;
  };

  const insightCards: InsightCard[] = highlightTrip
    ? [
        {
          title: "Add one more standout",
          description:
            teamLabel && highlightDestinationName
              ? `${teamLabel} still has room for a can't-miss ${highlightDestinationName} moment.`
              : "Drop an activity into the itinerary so everyone can react.",
          icon: ListChecks,
          accent: "bg-emerald-100 text-emerald-600",
          actionLabel: "Add activity",
          href: `/trip/${highlightTrip.id}?view=activities`,
        },
        {
          title: "Split an expense early",
          description: "Capture shared costs now to keep budgets aligned for the trip.",
          icon: DollarSign,
          accent: "bg-amber-100 text-amber-600",
          actionLabel: "Log expense",
          href: `/trip/${highlightTrip.id}?view=expenses`,
        },
        {
          title: "Prep the packing list",
          description: `Keep ${highlightTrip.memberCount} traveler${
            highlightTrip.memberCount === 1 ? "" : "s"
          } synced on essentials before departure.`,
          icon: Plane,
          accent: "bg-sky-100 text-sky-600",
          actionLabel: "Open packing",
          href: `/trip/${highlightTrip.id}?view=packing`,
        },
        {
          title: "Get inspired",
          description:
            "Browse experiences near your destination and drop favorites into proposals.",
          icon: Sparkles,
          accent: "bg-rose-100 text-rose-500",
          actionLabel: "Discover ideas",
          href: "/activities",
        },
      ]
    : [
        {
          title: "Create your first trip space",
          description:
            "Spin up an itinerary, invite friends, and start capturing plans together.",
          icon: Sparkles,
          accent: "bg-emerald-100 text-emerald-600",
          actionLabel: "Start planning",
          onClick: () => setShowCreateModal(true),
        },
        {
          title: "Explore VacationSync tools",
          description:
            "See how shared calendars, polls, and budgets keep everyone aligned.",
          icon: Compass,
          accent: "bg-sky-100 text-sky-600",
          actionLabel: "Tour features",
          href: "/how-it-works",
        },
        {
          title: "Save must-do ideas",
          description:
            "Browse activities and restaurants, then clip your favorites for later.",
          icon: MapPin,
          accent: "bg-violet-100 text-violet-600",
          actionLabel: "Find inspiration",
          href: "/activities",
        },
        {
          title: "Personalize your profile",
          description: "Add a photo and travel preferences so invites feel personal.",
          icon: Users,
          accent: "bg-amber-100 text-amber-600",
          actionLabel: "Update profile",
          href: "/profile",
        },
      ];

  const statDescriptions: Record<StatType, string> = {
    upcomingTrips:
      "Preview names, dates, and destinations for each upcoming trip.",
    travelCompanions:
      "See who is joining you and which adventures you're sharing together.",
    destinations:
      "Review every destination you've saved across your journeys.",
  };

  const activeStat = selectedStat
    ? stats.find((stat) => stat.type === selectedStat)
    : undefined;

  const renderSelectedStatContent = () => {
    if (!selectedStat) {
      return null;
    }

    if (selectedStat === "upcomingTrips") {
      if (sortedUpcomingTrips.length === 0) {
        return (
          <p className="text-sm text-slate-600">
            You're all caught up! Create a new trip to see it here.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {sortedUpcomingTrips.map((trip) => {
            const countdown = getCountdownLabel(trip.startDate);

            return (
              <div
                key={trip.id}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {trip.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {trip.destination || "Destination TBA"}
                    </p>
                  </div>
                  <Badge className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                    {countdown}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-slate-500" />
                    {formatDateRange(trip.startDate, trip.endDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-slate-500" />
                    {trip.memberCount} companion{trip.memberCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (selectedStat === "travelCompanions") {
      if (companionDetails.length === 0) {
        return (
          <p className="text-sm text-slate-600">
            Invite friends and family to your trips to see them listed here.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {companionDetails.map((companion) => {
            const tripNames = companion.trips;
            const displayedTrips = tripNames.slice(0, 3).join(", ");
            const remainingCount = Math.max(tripNames.length - 3, 0);
            const tripLabel =
              tripNames.length === 0
                ? "No trips recorded yet"
                : tripNames.length === 1
                  ? `Trip: ${tripNames[0]}`
                  : `Trips: ${displayedTrips}${
                      remainingCount > 0 ? ` +${remainingCount} more` : ""
                    }`;

            return (
              <div
                key={companion.id}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                  {companion.initial}
                </div>
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-slate-900">{companion.name}</p>
                  {companion.email && (
                    <p className="text-xs text-slate-500">{companion.email}</p>
                  )}
                  <p className="text-xs text-slate-500">{tripLabel}</p>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (selectedStat === "destinations") {
      if (destinationDetails.length === 0) {
        return (
          <p className="text-sm text-slate-600">
            Plan a trip to start building your destination list.
          </p>
        );
      }

      return (
        <div className="space-y-3">
          {destinationDetails.map((destination) => (
            <div
              key={destination.name}
              className="space-y-2 rounded-2xl border border-slate-200 p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-violet-600" />
                  <p className="text-sm font-semibold text-slate-900">
                    {destination.name}
                  </p>
                </div>
                <Badge className="rounded-full bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700">
                  {destination.totalTrips} trip{destination.totalTrips === 1 ? "" : "s"}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                {destination.upcomingTrips > 0
                  ? `${destination.upcomingTrips} upcoming ${
                      destination.upcomingTrips === 1 ? "adventure" : "adventures"
                    } planned`
                  : "No upcoming adventures planned"}
              </p>
            </div>
          ))}
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
                <div className="flex flex-wrap items-center gap-3">
                  <Badge className="w-fit rounded-full bg-white/80 px-4 py-1 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
                    <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                    Next adventure awaits
                  </Badge>
                  {highlightCountdown && (
                    <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-1 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur">
                      <Clock className="h-4 w-4 text-slate-500" />
                      {highlightCountdown}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                    {heroGreeting}
                  </p>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                    {heroHeadline}
                  </h1>
                  <p className="max-w-2xl text-lg text-slate-700">{heroSubtitle}</p>
                </div>
                {currentFunFact && (
                  <div className="flex items-start gap-3 rounded-3xl bg-white/80 p-4 text-sm text-slate-700 shadow-sm backdrop-blur">
                    <Lightbulb className="mt-0.5 h-4 w-4 text-amber-500" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Trip tidbit
                      </p>
                      <p>{currentFunFact}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
                    className="rounded-full px-6 text-slate-900 shadow-sm transition hover:shadow-md"
                    asChild
                  >
                    <Link href={`/trip/${highlightTrip.id}?view=packing`}>
                      Check packing list
                    </Link>
                  </Button>
                )}
                {highlightTrip && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="justify-start px-6 text-slate-700 hover:text-slate-900"
                    asChild
                  >
                    <Link href={`/trip/${highlightTrip.id}?view=activities`}>
                      Finalize activities
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="lg"
                  className="justify-start px-0 text-slate-700 hover:bg-transparent hover:text-slate-900"
                  asChild
                >
                  <Link href="/how-it-works">
                    Learn how VacationSync keeps everyone aligned
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
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
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {quickActions.map((action) => {
                  const ActionIcon = action.icon;
                  return (
                    <Link
                      key={action.title}
                      href={action.href}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${action.accent}`}
                        >
                          <ActionIcon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="font-semibold text-slate-900">{action.title}</p>
                          <p className="text-xs text-slate-500">{action.description}</p>
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-slate-400 transition group-hover:text-slate-600" />
                    </Link>
                  );
                })}
              </div>
              {highlightTrip ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="w-full justify-center rounded-2xl bg-slate-900 py-5 text-base font-semibold text-white shadow-md transition hover:bg-slate-800">
                      <Plus className="mr-2 h-4 w-4" />
                      Add something
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-60 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg">
                    {quickAddItems.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <DropdownMenuItem
                          key={item.label}
                          className="cursor-pointer rounded-xl px-3 py-2 text-sm text-slate-700 focus:bg-slate-100"
                          asChild
                        >
                          <Link
                            href={item.href}
                            className="flex items-center gap-2"
                          >
                            <ItemIcon className="h-4 w-4 text-slate-500" />
                            {item.label}
                            <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-slate-400" />
                          </Link>
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  className="w-full justify-center rounded-2xl bg-slate-900 py-5 text-base font-semibold text-white shadow-md transition hover:bg-slate-800"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add something
                </Button>
              )}
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
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:justify-between">
              {stats.map((stat, index) => {
                const Icon = stat.icon;
                const showDivider = index < stats.length - 1;
                let preview: ReactNode = null;

                if (stat.type === "upcomingTrips") {
                  preview = highlightTrip ? (
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-medium text-slate-700">
                          {highlightTrip.name}
                        </span>
                        {highlightCountdown && (
                          <span className="text-slate-400">• {highlightCountdown}</span>
                        )}
                      </div>
                      {highlightNextStep && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>{highlightNextStep}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      Start a plan to unlock smart trip previews.
                    </p>
                  );
                } else if (stat.type === "travelCompanions") {
                  preview = topCompanions.length > 0 ? (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {topCompanions.map((companion) => (
                          <div
                            key={companion.id}
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-slate-100 text-[11px] font-semibold text-slate-600 shadow-sm"
                          >
                            {companion.initial}
                          </div>
                        ))}
                        {extraCompanionCount > 0 && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-slate-100 text-[11px] font-semibold text-slate-600 shadow-sm">
                            +{extraCompanionCount}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {topCompanions
                          .map((companion) => companion.name.split(" ")[0])
                          .join(", ")}
                        {extraCompanionCount > 0
                          ? ` +${extraCompanionCount} more`
                          : ""}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      Invite friends to start planning together.
                    </p>
                  );
                } else if (stat.type === "destinations") {
                  preview = topDestinations.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      {topDestinations
                        .map((destination) => destination.name.split(",")[0])
                        .join(" • ")}
                      {extraDestinationCount > 0
                        ? ` +${extraDestinationCount}`
                        : ""}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      Add destinations to track your travel map.
                    </p>
                  );
                }

                return (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => handleStatClick(stat.type)}
                    className={`group flex w-full items-stretch gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      showDivider ? "md:border-r md:border-slate-200 md:pr-6" : ""
                    } md:w-auto`}
                    aria-label={`View details for ${stat.label}`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.accent} transition group-hover:scale-105`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex flex-1 flex-col">
                      <p className="text-2xl font-semibold text-slate-900">
                        {stat.value}
                      </p>
                      <p className="text-sm capitalize text-slate-600 group-hover:text-slate-800">
                        {stat.label}
                      </p>
                      {preview}
                    </div>
                    <ArrowRight className="mt-1 hidden h-4 w-4 text-slate-300 transition group-hover:text-slate-500 md:block" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={isStatsDialogOpen}
          onOpenChange={handleStatsDialogOpenChange}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{activeStat?.label ?? "Details"}</DialogTitle>
              {selectedStat && (
                <DialogDescription>
                  {statDescriptions[selectedStat]}
                </DialogDescription>
              )}
            </DialogHeader>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
              {renderSelectedStatContent()}
            </div>
          </DialogContent>
        </Dialog>

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
              {sortedUpcomingTrips.map((trip) => {
                const progress = calculatePlanningProgress(trip);
                const tags = getTripTags(trip);
                const nextStep = getTripNextStep(trip);

                return (
                  <Link
                    key={trip.id}
                    href={`/trip/${trip.id}`}
                    aria-label={`Open trip ${trip.name}`}
                    className="group block rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <Card className="h-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
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
                    <CardContent className="space-y-5 p-6">
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
                        <div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Planning progress</span>
                            <span className="font-semibold text-slate-700">
                              {progress}%
                            </span>
                          </div>
                          <Progress
                            value={progress}
                            className="mt-1 h-2 rounded-full bg-slate-100"
                          />
                        </div>
                        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                          <ListChecks className="h-4 w-4 text-emerald-500" />
                          <span>Next up: {nextStep}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 pt-2">
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
                      </div>
                    </CardContent>
                  </Card>
                  </Link>
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
                Quick suggestions to keep momentum high for {teamLabel ?? "your travel plans"}.
              </p>
            </div>
            {highlightTrip && teamLabel && (
              <Badge className="w-fit rounded-full bg-white px-4 py-1 text-xs font-medium text-slate-600 shadow-sm">
                {teamLabel}
              </Badge>
            )}
          </div>
          <div className="relative">
            <Carousel opts={{ align: "start" }} className="px-1">
              <CarouselContent className="-ml-4">
                {insightCards.map((insight) => {
                  const InsightIcon = insight.icon;
                  return (
                    <CarouselItem
                      key={insight.title}
                      className="pl-4 sm:basis-1/2 lg:basis-1/3"
                    >
                      <Card className="h-full rounded-3xl border-slate-200 bg-white shadow-sm">
                        <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                          <div className="flex items-start gap-3">
                            <span
                              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${insight.accent}`}
                            >
                              <InsightIcon className="h-5 w-5" />
                            </span>
                            <div>
                              <h3 className="text-base font-semibold text-slate-900">
                                {insight.title}
                              </h3>
                              <p className="text-sm text-slate-600">
                                {insight.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 pt-2">
                {insight.href ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full px-4"
                    asChild
                  >
                    <Link href={insight.href}>{insight.actionLabel}</Link>
                  </Button>
                ) : (
                  <Button
                                variant="secondary"
                                size="sm"
                                className="rounded-full px-4"
                                onClick={insight.onClick}
                              >
                                {insight.actionLabel}
                              </Button>
                            )}
                            <ArrowRight className="h-4 w-4 text-slate-300" />
                          </div>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  );
                })}
              </CarouselContent>
              <CarouselPrevious className="hidden sm:flex -left-6" />
              <CarouselNext className="hidden sm:flex -right-6" />
            </Carousel>
          </div>
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
