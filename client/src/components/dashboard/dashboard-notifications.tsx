import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Calendar,
  ClipboardList,
  DollarSign,
  Hotel,
  Plane,
  ShoppingCart,
  Sparkles,
  Utensils,
  MessageSquare,
  Compass,
  Building2,
  PlaneTakeoff,
  PlaneLanding,
  CheckSquare,
  Users,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";

import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { Notification, Activity, Expense } from "@shared/schema";

export type DashboardNotificationMemberProfile = {
  name: string;
  avatar: string | null;
  initial: string;
};

export type DashboardNotificationMemberLookup = {
  byId: Record<string, DashboardNotificationMemberProfile>;
  byName: Record<string, DashboardNotificationMemberProfile>;
};

export type DashboardNotificationTripLookup = Record<
  number,
  {
    name: string;
    destination: string | null;
  }
>;

interface DashboardNotificationsProps {
  memberLookup: DashboardNotificationMemberLookup;
  tripLookup: DashboardNotificationTripLookup;
}

type NotificationWithDetails = Notification & {
  trip?: {
    id: number;
    name: string | null;
    destination: string | null;
  };
  activity?: Activity;
  expense?: Expense;
};

type NotificationVisual = {
  icon: LucideIcon;
  gradient: string;
  view?: string | null;
  label: string;
};

type ActorDetails = DashboardNotificationMemberProfile & {
  isResolved: boolean;
};

const MAX_NOTIFICATIONS = 25;

export function DashboardNotifications({
  memberLookup,
  tripLookup,
}: DashboardNotificationsProps) {
  const { user } = useAuth();

  const {
    data: notifications = [],
    isLoading,
    error,
  } = useQuery<NotificationWithDetails[]>({
    queryKey: ["/api/notifications"],
    enabled: Boolean(user),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const feedItems = useMemo(
    () => notifications.slice(0, MAX_NOTIFICATIONS),
    [notifications],
  );

  const normalizedNameEntries = useMemo(
    () => Object.entries(memberLookup.byName),
    [memberLookup.byName],
  );

  const resolveActor = (notification: NotificationWithDetails): ActorDetails => {
    const candidateFromId =
      memberLookup.byId[notification.activity?.postedBy ?? ""] ??
      memberLookup.byId[notification.expense?.paidBy ?? ""];

    if (candidateFromId) {
      return { ...candidateFromId, isResolved: true };
    }

    const searchHaystack = `${notification.title ?? ""} ${notification.message ?? ""}`.toLowerCase();

    for (const [nameKey, profile] of normalizedNameEntries) {
      if (!nameKey) {
        continue;
      }
      if (
        searchHaystack.startsWith(`${nameKey} `) ||
        searchHaystack.includes(`${nameKey} `) ||
        searchHaystack === nameKey
      ) {
        return { ...profile, isResolved: true };
      }
    }

    const fallbackName =
      extractLeadName(notification.title) ??
      extractLeadName(notification.message) ??
      "Trip collaborator";

    return {
      name: fallbackName,
      avatar: null,
      initial: fallbackName[0]?.toUpperCase() ?? "T",
      isResolved: false,
    };
  };

  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={`notification-skeleton-${index}`}
          className="flex items-start gap-4 rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4"
        >
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Card className="rounded-2xl border border-slate-200/80 bg-white p-0 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Trip activity</h3>
          <p className="text-sm text-slate-500">Catch up on the latest updates from your crew.</p>
        </div>
        {feedItems.length > 0 ? (
          <Badge className="rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] text-xs font-semibold text-white shadow-sm">
            {feedItems.length}
          </Badge>
        ) : null}
      </div>
      <div className="px-2 pb-4 pt-2">
        {isLoading ? (
          renderSkeleton()
        ) : error ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-900">
            We couldn’t load your activity feed right now. Try refreshing the page.
          </div>
        ) : feedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
            <Sparkles className="h-6 w-6 text-[#ff7e5f]" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-base font-medium text-slate-700">No updates just yet</p>
              <p className="text-sm text-slate-500">
                New trip activity will show up here as your team plans together.
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="max-h-[420px] pr-4">
            <ul className="space-y-2">
              {feedItems.map((notification) => {
                const actor = resolveActor(notification);
                const visual = resolveNotificationVisual(notification);
                const tripId =
                  notification.trip?.id ??
                  notification.tripId ??
                  notification.activity?.tripCalendarId ??
                  notification.expense?.tripId ??
                  null;
                const tripInfo =
                  (tripId != null ? tripLookup[tripId] : undefined) ??
                  (notification.trip
                    ? {
                        name: notification.trip.name ?? notification.trip.destination ?? "Trip",
                        destination: notification.trip.destination ?? null,
                      }
                    : undefined);
                const tripName = tripInfo?.name ?? "Trip";
                const href = tripId ? buildNotificationHref(tripId, visual.view) : undefined;
                const timestamp = formatNotificationTimestamp(notification.createdAt);
                const baseClasses = cn(
                  "group relative flex items-start gap-4 rounded-2xl border border-transparent bg-white/40 px-4 py-3 transition-colors",
                  "hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7e5f]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
                );

                const content = (
                  <>
                    <div className="flex-shrink-0">
                      <div
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm",
                          "bg-gradient-to-br",
                          visual.gradient,
                        )}
                      >
                        <visual.icon className="h-5 w-5" aria-hidden="true" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{tripName}</span>
                        {notification.isRead ? null : (
                          <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-800">
                        {notification.title ?? "Trip update"}
                      </p>
                      {notification.message ? (
                        <p className="text-sm text-slate-600 line-clamp-2">{notification.message}</p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 border border-white shadow-sm">
                            <AvatarImage src={actor.avatar ?? undefined} alt="" />
                            <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-600">
                              {actor.initial}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-slate-700">
                            {actor.name}
                            {!actor.isResolved ? (
                              <span className="ml-1 text-[10px] uppercase tracking-wide text-slate-400">(guest)</span>
                            ) : null}
                          </span>
                        </div>
                        {timestamp ? (
                          <span className="bg-gradient-to-r from-[#ff7e5f] via-[#feb47b] to-[#654ea3] bg-clip-text font-semibold text-transparent">
                            {timestamp}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {href ? (
                      <div className="ml-auto flex h-full items-center text-slate-300 transition-colors group-hover:text-[#ff7e5f]">
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </div>
                    ) : null}
                  </>
                );

                return (
                  <li key={notification.id}>
                    {href ? (
                      <Link href={href} className={baseClasses} aria-label={`Go to ${tripName}`}>
                        {content}
                      </Link>
                    ) : (
                      <div className={baseClasses}>{content}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </div>
    </Card>
  );
}

function buildNotificationHref(tripId: number, view?: string | null): string {
  if (!view) {
    return `/trip/${tripId}`;
  }

  if (view === "members") {
    return `/trip/${tripId}/members`;
  }

  return `/trip/${tripId}?view=${view}`;
}

function formatNotificationTimestamp(value?: string | Date | null): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const distance = formatDistanceToNowStrict(date, { addSuffix: false });
  const [rawValue, rawUnit] = distance.split(" ");
  const abbreviation = abbreviateUnit(rawUnit);
  return `${rawValue}${abbreviation} ago`;
}

function abbreviateUnit(unit: string): string {
  const normalized = unit.toLowerCase();
  if (normalized.startsWith("second")) {
    return "s";
  }
  if (normalized.startsWith("minute")) {
    return "m";
  }
  if (normalized.startsWith("hour")) {
    return "h";
  }
  if (normalized.startsWith("day")) {
    return "d";
  }
  if (normalized.startsWith("week")) {
    return "w";
  }
  if (normalized.startsWith("month")) {
    return "mo";
  }
  if (normalized.startsWith("year")) {
    return "y";
  }
  return normalized.slice(0, 1);
}

function extractLeadName(text?: string | null): string | null {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  const lowered = trimmed.toLowerCase();
  const markers = [
    " invited",
    " proposed",
    " scheduled",
    " booked",
    " added",
    " shared",
    " updated",
    " created",
    " posted",
    " commented",
    " accepted",
    " declined",
    " uploaded",
  ];

  for (const marker of markers) {
    const index = lowered.indexOf(marker);
    if (index > 0) {
      return trimmed.slice(0, index).trim();
    }
  }

  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex > 0 && spaceIndex < 40) {
    return trimmed.slice(0, spaceIndex).trim();
  }

  return null;
}

function resolveNotificationVisual(notification: NotificationWithDetails): NotificationVisual {
  const type = notification.type.toLowerCase();
  const combined = `${notification.title ?? ""} ${notification.message ?? ""}`.toLowerCase();

  if (type.includes("flight") || combined.includes("flight")) {
    return {
      icon: type.includes("landing") ? PlaneLanding : type.includes("takeoff") ? PlaneTakeoff : Plane,
      gradient: "from-[#4facfe] to-[#00f2fe]",
      view: "flights",
      label: "Flight update",
    };
  }

  if (type.includes("hotel") || combined.includes("hotel")) {
    return {
      icon: Hotel,
      gradient: "from-[#f093fb] to-[#f5576c]",
      view: "hotels",
      label: "Hotel update",
    };
  }

  if (type.includes("restaurant") || combined.includes("restaurant") || combined.includes("dinner")) {
    return {
      icon: Utensils,
      gradient: "from-[#f83600] to-[#f9d423]",
      view: "restaurants",
      label: "Dining update",
    };
  }

  if (type.includes("grocery") || combined.includes("grocery") || combined.includes("shopping")) {
    return {
      icon: ShoppingCart,
      gradient: "from-[#0ba360] to-[#3cba92]",
      view: "groceries",
      label: "Grocery update",
    };
  }

  if (type.includes("expense") || type.includes("payment") || combined.includes("expense") || combined.includes("payment")) {
    return {
      icon: DollarSign,
      gradient: "from-[#f6d365] to-[#fda085]",
      view: "expenses",
      label: "Expense update",
    };
  }

  if (type.includes("member") || combined.includes("member") || combined.includes("invite")) {
    return {
      icon: Users,
      gradient: "from-[#a18cd1] to-[#fbc2eb]",
      view: "members",
      label: "Crew update",
    };
  }

  if (
    type.includes("activity") ||
    combined.includes("activity") ||
    combined.includes("rsvp") ||
    combined.includes("schedule") ||
    combined.includes("vote")
  ) {
    return {
      icon: Calendar,
      gradient: "from-[#ff7e5f] to-[#feb47b]",
      view: "activities",
      label: "Activity update",
    };
  }

  if (type.includes("packing") || combined.includes("packing")) {
    return {
      icon: ClipboardList,
      gradient: "from-[#43cea2] to-[#185a9d]",
      view: "packing",
      label: "Packing list",
    };
  }

  if (type.includes("proposal") || combined.includes("proposal")) {
    return {
      icon: MessageSquare,
      gradient: "from-[#667eea] to-[#764ba2]",
      view: "proposals",
      label: "Proposal update",
    };
  }

  if (type.includes("itinerary") || combined.includes("itinerary")) {
    return {
      icon: Compass,
      gradient: "from-[#00c6ff] to-[#0072ff]",
      view: "schedule",
      label: "Itinerary",
    };
  }

  if (type.includes("lodging") || combined.includes("lodging")) {
    return {
      icon: Building2,
      gradient: "from-[#f6d365] to-[#fda085]",
      view: "hotels",
      label: "Stay update",
    };
  }

  if (type.includes("checklist") || combined.includes("checklist")) {
    return {
      icon: CheckSquare,
      gradient: "from-[#11998e] to-[#38ef7d]",
      view: "packing",
      label: "Checklist",
    };
  }

  return {
    icon: Sparkles,
    gradient: "from-[#654ea3] to-[#ff7e5f]",
    view: null,
    label: "Trip update",
  };
}
